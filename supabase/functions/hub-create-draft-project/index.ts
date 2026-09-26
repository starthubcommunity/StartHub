// Supabase Edge Function: hub-create-draft-project  (main proje: fdlghaafspcuagxfrofz)
// Kurucu Hattı'ndan (Açık Pozisyonlar → "Kurucu" hattı rol oluşturma akışı)
// fikir aşamasındaki bir proje için minimal bir `startups` taslağı oluşturur
// — henüz web sitesinde YOK (published:false, stage:'idea'). Amaç: kurucu
// arayışı için gerçek bir ekip/proje henüz varken bile rol açılabilsin.
//
// HR/hub oturumunun `startups` tablosuna doğrudan yazma yetkisi yok
// (startups_write RLS'i has_perm('projects.write') ister — bu admin alanına
// ait bir izin, hub alanına değil). Bu yüzden team-project-save deseninde:
// servis rolüyle, id/slug üretimi elle (bkz. team-project-save'in aynı
// helper'ları — id: Date.now() ile admin'in sıralı nextId()'siyle asla
// çakışmaz).
//
// 2026-09-26 — EŞZAMANLI Ekip Paneli oluşturma: önceden bu satır yalnızca
// ana projenin `startups` tablosuna düşüyordu, team_app_id boş kalıyordu —
// Team App'in bundan hiç haberi olmuyordu ("hayalet" proje). Artık ÖNCE
// hub-bridge-create-team (Team App'in KENDİ projesi) ile gerçek bir ekip
// açılır, dönen teamId ile startups satırı team_app_id EŞLİ oluşturulur.
// Böylece founder Team App'e girince ekibini zaten orada bulur ve detayları
// (logo/açıklama/problem/çözüm/…) hâlâ Team App'in kendi Overview "Düzenle"
// modalından (team-project-save) ayarlar — o akış DEĞİŞMEDİ, team_app_id
// zaten eşli geldiği için ilk "Düzenle" bir CREATE değil UPDATE olur.
// Köprü başarısız olursa taslak İKİ TARAFTA TUTARSIZ kalmasın diye hiçbir
// şey oluşturulmaz — hata kullanıcıya döner.
//
// Yetki: çağıranın JWT'si iletilir; hub_role() cofounder|recruiter olmalı
// (rol oluşturma zaten roller sayfasında bu ikisine açık).
//
//   supabase functions deploy hub-create-draft-project --project-ref fdlghaafspcuagxfrofz --no-verify-jwt

import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY")!;
// Team app'in KENDİ (ayrı) Supabase projesi — main projeyle karıştırılmaz.
const TEAM_PROJECT_URL = "https://umgdtjlgivvymngsnqtv.supabase.co";
const HUB_BRIDGE_SECRET = Deno.env.get("HUB_BRIDGE_SECRET");

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};
const json = (b: unknown, s = 200) =>
  new Response(JSON.stringify(b), { status: s, headers: { ...cors, "Content-Type": "application/json" } });

function slugify(s: string): string {
  const base = (s || "")
    .toLowerCase()
    .replace(/ğ/g, "g").replace(/ü/g, "u").replace(/ş/g, "s")
    .replace(/ı/g, "i").replace(/ö/g, "o").replace(/ç/g, "c")
    .replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "");
  return base || "proje-taslagi";
}

async function uniqueSlug(db: ReturnType<typeof createClient>, base: string): Promise<string> {
  let candidate = base;
  for (let i = 0; i < 20; i++) {
    const { data } = await db.from("startups").select("id").eq("slug", candidate).maybeSingle();
    if (!data) return candidate;
    candidate = `${base}-${i + 2}`;
  }
  return `${base}-${Date.now()}`;
}

const PALETTE = ["#2563EB", "#DC2626", "#7C3AED", "#EA580C", "#16A34A", "#0891B2"];

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });

  try {
    const authHeader = req.headers.get("Authorization") || "";
    const { name, oneLiner } = await req.json();
    if (!name || !String(name).trim()) return json({ error: "Proje adı zorunlu" }, 400);

    const asUser = createClient(SUPABASE_URL, ANON_KEY, {
      global: { headers: { Authorization: authHeader } },
      auth: { autoRefreshToken: false, persistSession: false },
    });
    const { data: role } = await asUser.rpc("hub_role");
    if (role !== "cofounder" && role !== "recruiter") {
      return json({ error: "Yetkisiz — proje taslağı yalnızca cofounder/recruiter oluşturabilir." }, 403);
    }

    const db = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, {
      auth: { autoRefreshToken: false, persistSession: false },
    });

    // ── ÖNCE Ekip Paneli'nde gerçek bir ekip aç (Team App'in KENDİ projesi).
    // Başarısız olursa startups satırı da açılmaz — iki taraf arasında
    // eşlenmemiş "hayalet" bir proje kalmasın diye.
    if (!HUB_BRIDGE_SECRET) {
      return json({ error: "HUB_BRIDGE_SECRET tanımlı değil — Ekip Paneli köprüsü kullanılamıyor." }, 500);
    }
    const color = PALETTE[Math.floor(Math.random() * PALETTE.length)];
    let teamId: string;
    try {
      const bRes = await fetch(`${TEAM_PROJECT_URL}/functions/v1/hub-bridge-create-team`, {
        method: "POST",
        headers: { "Content-Type": "application/json", "x-hub-bridge-key": HUB_BRIDGE_SECRET },
        body: JSON.stringify({ name: String(name).trim(), oneLiner: (oneLiner || "").trim(), color, source: { actorEmail: null } }),
        signal: AbortSignal.timeout(8000),
      });
      const b = await bRes.json();
      if (!bRes.ok || !b?.ok || !b.teamId) throw new Error(b?.error || `hub-bridge-create-team ${bRes.status}`);
      teamId = b.teamId;
    } catch (e) {
      return json({ error: "Ekip Paneli'nde ekip açılamadı: " + (e as Error).message }, 500);
    }

    const slug = await uniqueSlug(db, slugify(String(name)));
    const row = {
      id: Date.now(),
      name: String(name).trim(),
      slug,
      color,
      stage: "idea",
      tagline_tr: (oneLiner || "").trim(),
      tagline_en: "", desc_tr: "", desc_en: "", about_tr: "", about_en: "",
      problem_tr: "", problem_en: "", solution_tr: "", solution_en: "",
      tags: [], team: 0, member_ids: [],
      published: false, featured: false, trending: false, is_new: false,
      team_app_id: teamId,
    };
    const { data: created, error } = await db.from("startups").insert(row).select("id,name,slug").single();
    if (error) return json({ error: error.message }, 500);

    return json({ ok: true, project: created });
  } catch (e) {
    return json({ error: e instanceof Error ? e.message : "Beklenmeyen hata" }, 500);
  }
});
