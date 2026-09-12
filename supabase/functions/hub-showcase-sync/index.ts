// Supabase Edge Function: hub-showcase-sync  (main proje: fdlghaafspcuagxfrofz)
// Vitrin sayfası (src/hub/pages/showcase.jsx) ile Team app'in (ayrı proje:
// umgdtjlgivvymngsnqtv) hub-team-sync fonksiyonu arasındaki VEKİL (proxy).
// HUB_BRIDGE_SECRET tarayıcıya asla girmez — bu fonksiyon servis rolüyle
// çalışır, secret'ı kendi ortamından okuyup Team projesine iletir.
//
//   body: { startupId, action: 'push_description' | 'pull_roster', description? }
//
// Yetki: çağıranın JWT'si iletilir; has_perm('showcase.write') gerekir
// (yalnızca cofounder — bkz. 0025_hub_showcase_perm.sql).

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
    const authHeader = req.headers.get("Authorization") || "";
    const { startupId, action, description } = await req.json();
    if (!startupId || !action) return json({ error: "startupId ve action zorunlu" }, 400);
    if (action !== "push_description" && action !== "pull_roster") return json({ error: "geçersiz action" }, 400);

    const asUser = createClient(SUPABASE_URL, ANON_KEY, {
      global: { headers: { Authorization: authHeader } },
      auth: { autoRefreshToken: false, persistSession: false },
    });
    const { data: allowed } = await asUser.rpc("has_perm", { p_key: "showcase.write" });
    if (!allowed) return json({ error: "Yetkisiz — Vitrin senkronizasyonu yalnızca cofounder." }, 403);

    if (!HUB_BRIDGE_SECRET) return json({ error: "HUB_BRIDGE_SECRET tanımlı değil" }, 500);

    const db = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, { auth: { autoRefreshToken: false, persistSession: false } });
    const { data: s, error: sErr } = await db.from("startups").select("team_app_id").eq("id", startupId).single();
    if (sErr || !s) return json({ error: sErr?.message || "proje bulunamadı" }, 404);
    if (!s.team_app_id) return json({ error: "Bu proje Team App'e eşlenmemiş (Team App Ekip ID boş)" }, 404);

    const body = action === "push_description"
      ? { action, teamId: s.team_app_id, description: description || "" }
      : { action, teamId: s.team_app_id };

    const res = await fetch(`${TEAM_PROJECT_URL}/functions/v1/hub-team-sync`, {
      method: "POST",
      headers: { "Content-Type": "application/json", "x-hub-bridge-key": HUB_BRIDGE_SECRET },
      body: JSON.stringify(body),
    });
    const out = await res.json();
    return json(out, res.status);
  } catch (e) {
    return json({ error: String(e) }, 500);
  }
});
