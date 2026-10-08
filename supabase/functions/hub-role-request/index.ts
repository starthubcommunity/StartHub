// Supabase Edge Function: hub-role-request
// BU PROJEYE DEPLOY EDİLİR: fdlghaafspcuagxfrofz (ana proje) — `--no-verify-jwt`
// (yalnızca x-hub-bridge-key ile; Team App'in hub-team-role-request'i çağırır,
// o da lead/admin olduğunu kullanıcının KENDİ oturumuyla doğrulamıştır).
//
// 2026-10-08 (0058) — Team Lead'in kişi talebi (Bölüm G m.1-2):
//   action 'create' → hub_open_roles satırı, status='requested', üye hattı,
//                     proje = startups.team_app_id eşlemesi.
//   action 'list'   → o ekibin projesine ait, lead talebiyle açılmış rollerin
//                     durumu (talep edildi / taslak / aranıyor / kısa liste / dolduruldu).

import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const HUB_BRIDGE_SECRET = Deno.env.get("HUB_BRIDGE_SECRET");

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-hub-bridge-key",
};
const json = (b: unknown, s = 200) =>
  new Response(JSON.stringify(b), { status: s, headers: { ...cors, "Content-Type": "application/json" } });

const clip = (v: unknown, n: number) => String(v ?? "").trim().slice(0, n);

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  const token = req.headers.get("x-hub-bridge-key");
  if (!HUB_BRIDGE_SECRET || token !== HUB_BRIDGE_SECRET) return json({ ok: false, error: "unauthorized" }, 401);

  try {
    const body = await req.json();
    const teamId = clip(body?.teamId, 40);
    if (!teamId) return json({ ok: false, error: "teamId zorunlu" }, 400);
    const db = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, { auth: { autoRefreshToken: false, persistSession: false } });

    const { data: st } = await db.from("startups").select("id, name").eq("team_app_id", teamId).maybeSingle();
    if (!st) return json({ ok: false, error: "Bu ekip Kurucu Hattı'nda bir projeye bağlı değil — talep açılamıyor. Yöneticiye haber ver." }, 404);

    if (body?.action === "list") {
      const { data, error } = await db.from("hub_open_roles")
        .select("id, title, status, requested_at, requested_by_name, weekly_hours")
        .eq("startup_id", st.id).not("requested_by_email", "is", null)
        .order("requested_at", { ascending: false }).limit(20);
      if (error) return json({ ok: false, error: error.message }, 500);
      return json({ ok: true, project: st.name, requests: data || [] });
    }

    if (body?.action !== "create") return json({ ok: false, error: "Geçersiz işlem" }, 400);
    const title = clip(body.title, 120);
    if (title.length < 2) return json({ ok: false, error: "Pozisyon adı zorunlu." }, 400);
    const skills = (Array.isArray(body.skills) ? body.skills : String(body.skills || "").split(","))
      .map((s: unknown) => clip(s, 40)).filter(Boolean).slice(0, 12);
    const hours = Number(body.weeklyHours);
    const weeklyHours = Number.isFinite(hours) && hours > 0 && hours <= 60 ? Math.round(hours) : null;
    const email = clip(body.requestedByEmail, 200).toLowerCase();
    if (!email.includes("@")) return json({ ok: false, error: "requestedByEmail zorunlu" }, 400);

    const { data: row, error } = await db.from("hub_open_roles").insert({
      startup_id: st.id, title, track: "member", status: "requested",
      profile: clip(body.profile, 1000) || null, skills, weekly_hours: weeklyHours,
      requested_by_email: email, requested_by_name: clip(body.requestedByName, 120) || null,
      requested_at: new Date().toISOString(),
    }).select("id, title, status, requested_at").single();
    if (error) return json({ ok: false, error: error.message }, 500);
    return json({ ok: true, project: st.name, role: row });
  } catch (e) {
    return json({ ok: false, error: String(e) }, 500);
  }
});
