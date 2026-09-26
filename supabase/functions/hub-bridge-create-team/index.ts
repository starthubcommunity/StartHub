// Supabase Edge Function: hub-bridge-create-team
// !!! BU PROJEYE DEPLOY EDILIR: umgdtjlgivvymngsnqtv (Team app / Ekip Paneli),
//     fdlghaafspcuagxfrofz (Ana Site/Admin/Hub projesi) DEGIL !!!
//   supabase link --project-ref umgdtjlgivvymngsnqtv
//   supabase functions deploy hub-bridge-create-team
//   (HUB_BRIDGE_SECRET zaten hub-bridge-add-member ile ortak — yeniden
//   set edilmesine gerek yok)
//
// Kurucu Hattı'nda (HR) "Yeni bir proje taslağı oluştur" denince (bkz. ana
// projedeki hub-create-draft-project), burada Ekip Paneli'nin KENDİ
// app_state.data.teams listesine gerçek bir ekip eklenir — 2026-09-26
// öncesinde yalnızca ana projenin `startups` tablosuna "hayalet" bir satır
// düşüyordu, team_app_id boş kalıyordu, Team App bu projeden hiç haberdar
// olmuyordu. Artık ikisi EŞZAMANLI oluşturuluyor; detaylar hâlâ YALNIZCA
// Team App'in kendi Overview "Düzenle" modalından (team-project-save)
// ayarlanır — o akış DEĞİŞMEDİ, team_app_id zaten eşli geldiği için ilk
// "Düzenle" bir CREATE değil UPDATE olarak işler.
//
// repair-write'ın "taze-oku -> üst-seviye alanı birleştir -> yaz" deseni +
// optimistic-concurrency (CAS) retry — hub-bridge-add-member ile AYNI.

import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { computeCreateTeam } from "./logic.ts";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const HUB_BRIDGE_SECRET = Deno.env.get("HUB_BRIDGE_SECRET");
const MAX_ATTEMPTS = 3;

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-hub-bridge-key",
};

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: { ...corsHeaders, "Content-Type": "application/json" } });
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  const token = req.headers.get("x-hub-bridge-key");
  if (!HUB_BRIDGE_SECRET || token !== HUB_BRIDGE_SECRET) return json({ ok: false, error: "unauthorized" }, 401);

  let payload: any;
  try { payload = await req.json(); } catch { return json({ ok: false, error: "geçersiz JSON gövde" }, 400); }

  const admin = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, { auth: { autoRefreshToken: false, persistSession: false } });

  for (let attempt = 0; attempt < MAX_ATTEMPTS; attempt++) {
    const { data: cur, error: readErr } = await admin.from("app_state").select("data").eq("id", "shl_v5").maybeSingle();
    if (readErr || !cur || !cur.data) return json({ ok: false, error: readErr?.message || "mevcut satır okunamadı" }, 500);

    const knownAt = cur.data._at;
    const result = computeCreateTeam(cur.data, payload);
    if (!result.ok) return json(result, result.error?.includes("zorunlu") ? 400 : 500);

    const merged = { ...result.snapshot, _by: "hub-bridge", _at: Date.now() };

    // CAS: yazmadan hemen önce satırın hâlâ bildiğimiz sürüm olduğunu doğrula.
    const { data: recheck } = await admin.from("app_state").select("data").eq("id", "shl_v5").maybeSingle();
    if (recheck?.data?._at !== knownAt) continue; // aradan biri yazdı — yeniden oku + yeniden hesapla

    const { error: writeErr } = await admin.from("app_state").upsert({ id: "shl_v5", data: merged });
    if (writeErr) return json({ ok: false, error: writeErr.message }, 500);

    return json({ ok: true, teamId: result.teamId });
  }

  return json({ ok: false, error: "çok fazla eşzamanlı yazma çakışması, tekrar deneyin" }, 409);
});
