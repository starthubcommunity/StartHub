// GECICI ONARIM FONKSIYONU - is bitince silinmeli.
// service_role ile, mevcut app_state satirini TAZE cekip sadece
// body.patch icindeki ust-seviye alanlari uzerine yazar (orn. sadece
// "users") - diger alanlara (tasks, sprints, teams...) HIC dokunmaz.
//   supabase secrets set DEBUG_TOKEN=<ayni token>

import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const DEBUG_TOKEN = Deno.env.get("DEBUG_TOKEN");

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-debug-token",
};

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  const token = req.headers.get("x-debug-token");
  if (!DEBUG_TOKEN || token !== DEBUG_TOKEN) {
    return new Response(JSON.stringify({ error: "unauthorized" }), { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }

  const { patch } = await req.json();
  if (!patch || typeof patch !== "object") {
    return new Response(JSON.stringify({ error: "patch zorunlu" }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }

  const admin = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, { auth: { autoRefreshToken: false, persistSession: false } });

  const { data: cur, error: readErr } = await admin.from("app_state").select("data").eq("id", "shl_v5").maybeSingle();
  if (readErr || !cur || !cur.data) {
    return new Response(JSON.stringify({ error: readErr?.message || "mevcut satir okunamadi" }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }

  const merged = { ...cur.data, ...patch, _by: "repair-tool", _at: Date.now() };
  const { error: writeErr } = await admin.from("app_state").upsert({ id: "shl_v5", data: merged });
  if (writeErr) {
    return new Response(JSON.stringify({ error: writeErr.message }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }

  return new Response(JSON.stringify({ ok: true, patchedKeys: Object.keys(patch) }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
});
