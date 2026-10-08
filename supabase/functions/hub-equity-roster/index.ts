// Supabase Edge Function: hub-equity-roster
// BU PROJEYE DEPLOY EDİLİR: fdlghaafspcuagxfrofz (ana proje) — JWT doğrulaması AÇIK.
//
// 2026-10-08 — HR › Pay Sözleri: seçilen projenin Team App ekibindeki
// kullanıcıları (ad/e-posta/rol) getirir; ekranda "pay sözü olmayan üyeler"
// ve "e-postası ekipte olmayan söz" uyarıları buradan hesaplanır.
// Yetki: çağıranın KENDİ oturumuyla has_perm('equity.read') (cofounder) —
// Team App e-postaları başka HR rollerine açılmaz. Team App'e
// hub-bridge-team-roster üzerinden HUB_BRIDGE_SECRET ile gider (sır
// tarayıcıya inmez). SALT OKUMA.

import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY")!;
const HUB_BRIDGE_SECRET = Deno.env.get("HUB_BRIDGE_SECRET");
const TEAM_PROJECT_URL = "https://umgdtjlgivvymngsnqtv.supabase.co";

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};
const json = (b: unknown, s = 200) =>
  new Response(JSON.stringify(b), { status: s, headers: { ...cors, "Content-Type": "application/json" } });

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  try {
    const asUser = createClient(SUPABASE_URL, ANON_KEY, {
      global: { headers: { Authorization: req.headers.get("Authorization") || "" } },
      auth: { autoRefreshToken: false, persistSession: false },
    });
    const { data: allowed } = await asUser.rpc("has_perm", { p_key: "equity.read" });
    if (allowed !== true) return json({ ok: false, error: "Yetkisiz — yalnızca pay sözlerini görebilenler." }, 403);

    const { startupId } = await req.json();
    if (startupId == null) return json({ ok: false, error: "startupId zorunlu" }, 400);
    const db = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, { auth: { autoRefreshToken: false, persistSession: false } });
    const { data: st } = await db.from("startups").select("team_app_id").eq("id", Number(startupId)).maybeSingle();
    const teamId = st?.team_app_id || null;
    if (!teamId) return json({ ok: true, teamAppId: null, members: [] });
    if (!HUB_BRIDGE_SECRET) return json({ ok: false, error: "HUB_BRIDGE_SECRET tanımlı değil" }, 500);

    const res = await fetch(`${TEAM_PROJECT_URL}/functions/v1/hub-bridge-team-roster`, {
      method: "POST",
      headers: { "Content-Type": "application/json", "x-hub-bridge-key": HUB_BRIDGE_SECRET },
      body: JSON.stringify({ teamId }),
      signal: AbortSignal.timeout(8000),
    });
    const b = await res.json().catch(() => null);
    if (!res.ok || !b?.ok) return json({ ok: false, error: b?.error || `hub-bridge-team-roster ${res.status}` }, 502);
    return json({ ok: true, teamAppId: teamId, teamExists: b.teamExists, teamName: b.teamName || null, members: b.members || [] });
  } catch (e) {
    return json({ ok: false, error: String(e) }, 500);
  }
});
