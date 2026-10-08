// Supabase Edge Function: hub-team-role-request
// !!! BU PROJEYE DEPLOY EDILIR: umgdtjlgivvymngsnqtv (Team app / Ekip Paneli) !!!
// JWT doğrulaması AÇIK (varsayılan) — çağıranın KENDİ Team App oturumuyla.
//
// 2026-10-08 (0058) — Team Lead'in "Kişi talep et" formu (Bölüm G m.1-2).
// Yetki sunucuda: çağıran app_state.data.users'ta bu ekibin lead'i ya da
// admin olmalı. Ana projedeki hub-role-request'e HUB_BRIDGE_SECRET ile gider.
//   action 'create' { teamId, title, skills, weeklyHours, profile }
//   action 'list'   { teamId } → bu ekibin taleplerinin durumu

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

  let body: any;
  try { body = await req.json(); } catch { return json({ ok: false, error: "geçersiz JSON gövde" }, 400); }
  const teamId = String(body?.teamId || "");
  const action = body?.action === "list" ? "list" : "create";
  if (!teamId) return json({ ok: false, error: "teamId zorunlu" }, 400);

  const admin = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, { auth: { autoRefreshToken: false, persistSession: false } });
  const { data: cur } = await admin.from("app_state").select("data").eq("id", "shl_v5").maybeSingle();
  const me = (cur?.data?.users || []).find((u: any) => (u.email || "").toLowerCase() === email);
  const allowed = !!me && (me.role === "admin" || (teamsOf(me).includes(teamId) && effRole(me, teamId) === "lead"));
  if (!allowed) return json({ ok: false, error: "Bu ekip için talep açma yetkin yok." }, 403);

  const payload = action === "list" ? { action, teamId } : {
    action, teamId, title: body.title, skills: body.skills, weeklyHours: body.weeklyHours, profile: body.profile,
    requestedByEmail: email, requestedByName: me.name || null,
  };
  try {
    const res = await fetch(`${MAIN_PROJECT_URL}/functions/v1/hub-role-request`, {
      method: "POST",
      headers: { "Content-Type": "application/json", "x-hub-bridge-key": HUB_BRIDGE_SECRET },
      body: JSON.stringify(payload),
      signal: AbortSignal.timeout(10000),
    });
    const b = await res.json().catch(() => null);
    if (!res.ok || !b?.ok) return json({ ok: false, error: b?.error || `hub-role-request ${res.status}` }, res.status === 404 ? 404 : 502);
    return json(b);
  } catch (e) {
    return json({ ok: false, error: String(e) }, 502);
  }
});
