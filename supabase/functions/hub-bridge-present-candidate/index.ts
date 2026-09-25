// Supabase Edge Function: hub-bridge-present-candidate
// !!! BU PROJEYE DEPLOY EDILIR: umgdtjlgivvymngsnqtv (Team app / Ekip Paneli),
//     fdlghaafspcuagxfrofz (Ana Site/Admin/Hub projesi) DEGIL !!!
//   supabase link --project-ref umgdtjlgivvymngsnqtv
//   supabase functions deploy hub-bridge-present-candidate
//   (HUB_BRIDGE_SECRET zaten hub-bridge-add-member için tanımlı, aynısı kullanılır)
//
// Kurucu Hattı'nda üye hattındaki bir aday Kapı A'yı geçip "Proje sahibine
// sun"a basılınca çağrılır. Adayı doğrudan ekibe EKLEMEZ — yalnızca o ekibin
// Team Lead'inin (Team sayfasında) görüp Kabul/Ret vereceği bir "bekleyen
// aday" kaydı düşer (app_state.data.candidateOffers). Gerçek ekleme +davet
// maili, Team Lead kabul edince hub-team-decide-offer'da olur.
//
// hub-bridge-add-member ile AYNI CAS/repair-write iskeleti: oku -> hesapla ->
// yaz, tekrar okuyup sürüm değişmediyse commit et.

import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { computeOfferPresentPatch } from "./logic.ts";

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
    const result = computeOfferPresentPatch(cur.data, payload);
    if (!result.ok) return json(result, result.error?.includes("zorunlu") ? 400 : 404);

    if (result.alreadyPending) return json({ ok: true, offerId: result.offerId, alreadyPending: true });

    const merged = { ...result.snapshot, _by: "hub-bridge", _at: Date.now() };

    const { data: recheck } = await admin.from("app_state").select("data").eq("id", "shl_v5").maybeSingle();
    if (recheck?.data?._at !== knownAt) continue; // aradan biri yazdı — yeniden oku + yeniden hesapla

    const { error: writeErr } = await admin.from("app_state").upsert({ id: "shl_v5", data: merged });
    if (writeErr) return json({ ok: false, error: writeErr.message }, 500);

    return json({ ok: true, offerId: result.offerId, alreadyPending: false });
  }

  return json({ ok: false, error: "çok fazla eşzamanlı yazma çakışması, tekrar deneyin" }, 409);
});
