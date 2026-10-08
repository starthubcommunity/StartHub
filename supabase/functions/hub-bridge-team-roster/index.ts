// Supabase Edge Function: hub-bridge-team-roster
// !!! BU PROJEYE DEPLOY EDILIR: umgdtjlgivvymngsnqtv (Team app / Ekip Paneli) !!!
//   supabase functions deploy hub-bridge-team-roster --project-ref umgdtjlgivvymngsnqtv --no-verify-jwt
// Yalnızca x-hub-bridge-key ile (ana projedeki hub-equity-roster çağırır).
//
// 2026-10-08 — HR › Pay Sözleri'ndeki ekip ↔ pay sözü karşılaştırması için
// verilen ekibin kullanıcılarını döndürür: ad, e-posta, o ekipteki etkin rol,
// admin mi. SALT OKUMA — app_state'e hiçbir şey yazılmaz.

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

const teamsOf = (u: any): string[] => ((u.teams && u.teams.length) ? u.teams : (u.team ? [u.team] : []));
const effRole = (u: any, tid: string) => (u.role === "admin" || u.role === "cto") ? u.role : ((u.teamRoles && u.teamRoles[tid]) || u.role);

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  const token = req.headers.get("x-hub-bridge-key");
  if (!HUB_BRIDGE_SECRET || token !== HUB_BRIDGE_SECRET) return json({ ok: false, error: "unauthorized" }, 401);

  let body: any;
  try { body = await req.json(); } catch { return json({ ok: false, error: "geçersiz JSON gövde" }, 400); }
  const teamId = String(body?.teamId || "");
  if (!teamId) return json({ ok: false, error: "teamId zorunlu" }, 400);

  const admin = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, { auth: { autoRefreshToken: false, persistSession: false } });
  const { data: cur, error } = await admin.from("app_state").select("data").eq("id", "shl_v5").maybeSingle();
  if (error || !cur?.data) return json({ ok: false, error: error?.message || "mevcut satır okunamadı" }, 500);

  const team = (cur.data.teams || []).find((t: any) => String(t.id) === teamId);
  if (!team) return json({ ok: true, teamExists: false, members: [] });
  const members = (cur.data.users || [])
    .filter((u: any) => teamsOf(u).map(String).includes(teamId))
    .map((u: any) => ({ name: u.name || "", email: String(u.email || "").toLowerCase(), role: effRole(u, teamId), isAdmin: u.role === "admin" }));
  return json({ ok: true, teamExists: true, teamName: team.name, members });
});
