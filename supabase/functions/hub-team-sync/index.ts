// Supabase Edge Function: hub-team-sync
// !!! BU PROJEYE DEPLOY EDILIR: umgdtjlgivvymngsnqtv (Team app / Ekip Paneli),
//     fdlghaafspcuagxfrofz (Ana Site/Admin/Hub projesi) DEGIL !!!
//   supabase functions deploy hub-team-sync --project-ref umgdtjlgivvymngsnqtv --no-verify-jwt
//   (HUB_BRIDGE_SECRET zaten hub-bridge-add-member ile aynı — ayrıca set edilmez)
//
// Kurucu Hattı'nın Vitrin sayfası ile Team app'in kendi app_state'i
// arasında İKİ YÖNLÜ, isteğe bağlı (buton tetiklemeli — otomatik cron
// değil) senkronizasyon:
//   - push_description: Vitrin'de kaydedilen açıklama Team app'in
//     teams[].description alanına yazılır (CAS retry ile, repair-write
//     deseninde).
//   - pull_roster: o teamId'ye ait üye özetini (isim/e-posta/rol, salt
//     okunur) döner — TÜM app_state'i değil, tek bir ekibe ait küçük bir
//     özet. Vitrin bunu "Ekip: N kişi" göstermek/site tarafını güncel
//     tutmak için çağırır.
//
// x-dry-run: 1 → push_description'da hiçbir şey yazılmaz, yalnızca
// hesaplanan sonuç (changed) döner.

import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { computePushDescription, computeRosterSummary } from "./logic.ts";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const HUB_BRIDGE_SECRET = Deno.env.get("HUB_BRIDGE_SECRET");
const MAX_ATTEMPTS = 3;

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-hub-bridge-key, x-dry-run",
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
  const { action } = payload || {};

  const admin = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, { auth: { autoRefreshToken: false, persistSession: false } });

  if (action === "pull_roster") {
    const { data: cur, error } = await admin.from("app_state").select("data").eq("id", "shl_v5").maybeSingle();
    if (error || !cur?.data) return json({ ok: false, error: error?.message || "okunamadı" }, 500);
    const result = computeRosterSummary(cur.data, payload);
    return json(result, result.ok ? 200 : 404);
  }

  if (action === "push_description") {
    const dryRun = req.headers.get("x-dry-run") === "1";
    for (let attempt = 0; attempt < MAX_ATTEMPTS; attempt++) {
      const { data: cur, error } = await admin.from("app_state").select("data").eq("id", "shl_v5").maybeSingle();
      if (error || !cur?.data) return json({ ok: false, error: error?.message || "okunamadı" }, 500);
      const knownAt = cur.data._at;
      const result = computePushDescription(cur.data, payload);
      if (!result.ok) return json(result, 404);
      if (dryRun) return json({ ok: true, changed: result.changed, dryRun: true });
      if (!result.changed) return json({ ok: true, changed: false }); // zaten aynı, yazmaya gerek yok

      const merged = { ...result.snapshot, _by: "hub-team-sync", _at: Date.now() };
      const { data: recheck } = await admin.from("app_state").select("data").eq("id", "shl_v5").maybeSingle();
      if (recheck?.data?._at !== knownAt) continue; // aradan biri yazdı, tekrar dene

      const { error: writeErr } = await admin.from("app_state").upsert({ id: "shl_v5", data: merged });
      if (writeErr) return json({ ok: false, error: writeErr.message }, 500);
      return json({ ok: true, changed: true });
    }
    return json({ ok: false, error: "çok fazla eşzamanlı yazma çakışması, tekrar deneyin" }, 409);
  }

  return json({ ok: false, error: "geçersiz action — 'push_description' veya 'pull_roster' olmalı" }, 400);
});
