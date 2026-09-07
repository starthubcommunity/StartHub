// Supabase Edge Function: hub-github-scan  (PROMPT_V3 E5)
// GitHub taraması SUNUCUDA — token tarayıcıya inmez (HUB_GITHUB_TOKEN secret).
// Ayrı ekran değil; aday ekleme yöntemlerinden biri (github-import.jsx).
//
//   supabase secrets set HUB_GITHUB_TOKEN=ghp_xxx
//
// Girdi:  { location, language, minRepos, minFollowers, activeMonths, limit }
// Çıktı:  { rows: [{ login, name, url, location, publicRepos, enrichment,
//                     prescore, why, evidence }] }
// Yetki:  çağıranın JWT'si → hub_role() cofounder|recruiter.
// enrichment YALNIZCA ön puan (bitirmişlik) önerir — rubriğin yerine GEÇMEZ.

import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY")!;
const GH_TOKEN = Deno.env.get("HUB_GITHUB_TOKEN");
const API = "https://api.github.com";
const DAY = 86400000;
const GAP = 2200;                       // ~27 istek/dk (sınır 30)
const MAX_USERS = 8;                    // edge timeout altında kalsın
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};
const json = (b: unknown, s = 200) =>
  new Response(JSON.stringify(b), { status: s, headers: { ...cors, "Content-Type": "application/json" } });

async function gh(path: string) {
  const h: Record<string, string> = { Accept: "application/vnd.github+json" };
  if (GH_TOKEN) h.Authorization = `Bearer ${GH_TOKEN}`;
  const res = await fetch(API + path, { headers: h });
  if (res.status === 403 || res.status === 429) throw new Error("GitHub hız sınırı — biraz sonra tekrar dene.");
  if (!res.ok) throw new Error(`GitHub ${res.status}: ${path}`);
  return res.json();
}

function buildQuery({ location = "Turkey", language = "", minRepos = 3, minFollowers = 0 }) {
  const p: string[] = [];
  if (location) p.push(`location:${String(location).replace(/"/g, "")}`);
  if (language) p.push(`language:${language}`);
  if (minRepos) p.push(`repos:>=${minRepos}`);
  if (minFollowers) p.push(`followers:>=${minFollowers}`);
  return p.join(" ");
}

const relDays = (iso?: string) => {
  if (!iso) return "";
  const d = Math.floor((Date.now() - Date.parse(iso)) / DAY);
  if (d < 14) return `${Math.max(d, 0)} gün önce`;
  if (d < 60) return `${Math.round(d / 7)} hafta önce`;
  if (d < 730) return `${Math.round(d / 30)} ay önce`;
  return `${Math.round(d / 365)} yıl önce`;
};

// deep=false vekil: yayınlanmış (homepage/pages/≥5★) + boş kabuk değil.
function isFinished(r: any) {
  const shipped = !!r.homepage || r.has_pages === true || (r.stargazers_count || 0) >= 5;
  if (!shipped) return false;
  return (r.description || "").length >= 20 || (r.stargazers_count || 0) >= 5;
}

function computeEnrichment(user: any, repos: any[]) {
  const login = (user.login || "").toLowerCase();
  const own = repos.filter((r) => !r.fork && (r.owner?.login || "").toLowerCase() === login);
  const finished = own.filter(isFinished);
  const lastPush = repos.reduce((m, r) => Math.max(m, r.pushed_at ? Date.parse(r.pushed_at) : 0), 0);
  const now = Date.now();
  const months = new Set<string>();
  for (const r of repos) for (const d of [r.pushed_at, r.created_at]) {
    if (!d) continue;
    const t = Date.parse(d);
    if (t <= now && now - t <= 366 * DAY) months.add(new Date(t).toISOString().slice(0, 7));
  }
  return {
    finished_projects: finished.length,
    activity_recency: lastPush ? Math.floor((now - lastPush) / DAY) : null,
    consistency: months.size,
    breadth: new Set(repos.map((r) => r.language).filter(Boolean)).size,
    collaboration: 0,
    solo_finisher: finished.length >= 1,
    fetched_at: new Date().toISOString(),
  };
}

function prescoreFinishing(e: any, repos: any[]) {
  const fin = e.finished_projects || 0;
  const recency = e.activity_recency ?? Infinity;
  const live = repos.some((r) => !r.fork && (r.homepage || r.has_pages));
  const n = repos.length;
  let score: number, basis: string;
  if (fin >= 2 && live) { score = 5; basis = "≥ 2 bitmiş proje, en az biri canlı"; }
  else if (fin === 1 && recency <= 180) { score = 4; basis = "1 bitmiş proje + son 6 ayda aktif"; }
  else if (fin === 0 && n >= 5) { score = 3; basis = "çok repo, bitmiş görünen yok"; }
  else if (fin === 0 && n >= 1) { score = 2; basis = "az repo, çoğu eğitim/kopya"; }
  else { score = 1; basis = "boş veya yalnızca fork"; }
  const top = [...repos].sort((a, b) => (b.stargazers_count || 0) - (a.stargazers_count || 0))[0];
  const evidence = top
    ? `${top.full_name || top.name} — ${top.stargazers_count || 0} yıldız${top.homepage || top.has_pages ? ", canlı link" : ""}${top.pushed_at ? `, son push ${relDays(top.pushed_at)}` : ""}`
    : "repo yok";
  return { score, confidence: n ? "orta" : "düşük", evidence, note: `Ön puan ${score} · ${basis}. ${evidence}` };
}

function whyThisOne(repos: any[]) {
  const top = [...repos].filter((r) => !r.fork).sort((a, b) => (b.stargazers_count || 0) - (a.stargazers_count || 0))[0];
  if (!top) return "";
  const f = [`GitHub'daki ${top.name} deposunda ${top.stargazers_count || 0} yıldız var`];
  if (top.homepage || top.has_pages) f.push("canlı demo linki mevcut");
  if (top.language) f.push(`${top.language} ile yazılmış`);
  let s = f.join(", ") + ".";
  if (top.pushed_at) s += ` Son güncelleme ${relDays(top.pushed_at)}.`;
  return s;
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  try {
    const asUser = createClient(SUPABASE_URL, ANON_KEY, {
      global: { headers: { Authorization: req.headers.get("Authorization") || "" } },
      auth: { autoRefreshToken: false, persistSession: false },
    });
    const { data: role } = await asUser.rpc("hub_role");
    if (role !== "cofounder" && role !== "recruiter") return json({ error: "Yetkisiz." }, 403);
    if (!GH_TOKEN) return json({ error: "HUB_GITHUB_TOKEN secret'i tanımlı değil." }, 500);

    const body = await req.json();
    const limit = Math.min(Number(body.limit) || 6, MAX_USERS);
    const activeMonths = Number(body.activeMonths) || 0;

    const q = buildQuery(body);
    const search = await gh(`/search/users?q=${encodeURIComponent(q)}&per_page=${limit}`);
    const logins: string[] = (search.items || []).slice(0, limit).map((u: any) => u.login);

    const rows = [];
    for (const login of logins) {
      const user = await gh(`/users/${login}`); await sleep(GAP);
      const repos = await gh(`/users/${login}/repos?sort=pushed&per_page=100`); await sleep(GAP);
      const top = [...repos].sort((a: any, b: any) => (b.stargazers_count || 0) - (a.stargazers_count || 0)).slice(0, 5);
      const enrichment = computeEnrichment(user, repos);
      if (activeMonths > 0 && enrichment.activity_recency != null && enrichment.activity_recency > activeMonths * 30) continue;
      const prescore = prescoreFinishing(enrichment, repos);
      rows.push({
        login,
        name: user.name || login,
        url: user.html_url || `https://github.com/${login}`,
        location: user.location || "",
        publicRepos: user.public_repos,
        enrichment, prescore,
        why: whyThisOne(repos),
        evidence: top.map((t: any) => ({ type: "repo", url: t.html_url, note: `${t.stargazers_count || 0}★ ${t.language || ""}`.trim() })),
      });
    }
    return json({ rows, query: q });
  } catch (e) {
    return json({ error: String((e as Error)?.message || e) }, 500);
  }
});
