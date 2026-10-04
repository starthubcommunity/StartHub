// Supabase Edge Function: hub-team-my-equity
// !!! BU PROJEYE DEPLOY EDILIR: umgdtjlgivvymngsnqtv (Team app / Ekip Paneli) !!!
// JWT doğrulaması AÇIK (varsayılan) — çağıranın KENDİ Team App oturumuyla.
//
// 2026-10-04 (Adım 5/5) — "Payım" sekmesi. E-posta istemciden ALINMAZ:
// kullanıcının kendi JWT'sinden çıkarılır, böylece kimse başkasının payını
// isteyemez. Lead olduğu ekipler de sunucuda app_state.data.users'tan
// hesaplanır (admin → tüm ekipler). Ana projedeki hub-equity-bridge'e
// HUB_BRIDGE_SECRET ile gider (sır tarayıcıya inmez).

import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY")!;
const HUB_BRIDGE_SECRET = Deno.env.get("HUB_BRIDGE_SECRET");
const MAIN_PROJECT_URL = Deno.env.get("MAIN_PROJECT_URL") || "https://fdlghaafspcuagxfrofz.supabase.co";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};
const json = (b: unknown, s = 200) =>
  new Response(JSON.stringify(b), { status: s, headers: { ...corsHeaders, "Content-Type": "application/json" } });

const teamsOf = (u: any): string[] => ((u.teams && u.teams.length) ? u.teams : (u.team ? [u.team] : []));
const effRole = (u: any, tid: string) => (u.teamRoles && u.teamRoles[tid]) || u.role;

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  const asUser = createClient(SUPABASE_URL, ANON_KEY, {
    global: { headers: { Authorization: req.headers.get("Authorization") || "" } },
    auth: { autoRefreshToken: false, persistSession: false },
  });
  const { data: authData } = await asUser.auth.getUser();
  const email = authData?.user?.email?.toLowerCase();
  if (!email) return json({ ok: false, error: "unauthorized" }, 401);
  if (!HUB_BRIDGE_SECRET) return json({ ok: false, error: "HUB_BRIDGE_SECRET tanımlı değil" }, 500);

  const admin = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, { auth: { autoRefreshToken: false, persistSession: false } });
  const { data: cur } = await admin.from("app_state").select("data").eq("id", "shl_v5").maybeSingle();
  const users: any[] = cur?.data?.users || [];
  const teams: any[] = cur?.data?.teams || [];
  const me = users.find((u) => (u.email || "").toLowerCase() === email);
  const leadTeamIds = !me ? [] : me.role === "admin"
    ? teams.map((t) => String(t.id))
    : teamsOf(me).filter((tid) => effRole(me, tid) === "lead").map(String);

  try {
    const res = await fetch(`${MAIN_PROJECT_URL}/functions/v1/hub-equity-bridge`, {
      method: "POST",
      headers: { "Content-Type": "application/json", "x-hub-bridge-key": HUB_BRIDGE_SECRET },
      body: JSON.stringify({ email, leadTeamIds }),
      signal: AbortSignal.timeout(10000),
    });
    const b = await res.json().catch(() => null);
    if (!res.ok || !b?.ok) return json({ ok: false, error: b?.error || `hub-equity-bridge ${res.status}` }, 502);
    return json({ ok: true, mine: b.mine || [], team: b.team || [], isLead: leadTeamIds.length > 0, asOf: b.asOf });
  } catch (e) {
    return json({ ok: false, error: String(e) }, 502);
  }
});
