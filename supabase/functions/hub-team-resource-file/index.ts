// Supabase Edge Function: hub-team-resource-file
// !!! BU PROJEYE DEPLOY EDİLİR: umgdtjlgivvymngsnqtv (Team App / Ekip Paneli) !!!
// JWT doğrulaması AÇIK — çağıranın KENDİ Team App oturumuyla.
//
// C (0062) — "Kaynaklar"a PDF. Yetki SUNUCUDA, app_state'ten (shl_v5) hesaplanır:
//   upload_url / finalize / delete → admin her ekipte; lead yalnızca kendi ekibinde; Genel yalnızca admin
//   download_url                   → admin/cto; ekibin üyesi/mentörü; Genel herkes
// Dosya işlemleri ana projedeki hub-resource-files'a HUB_BRIDGE_SECRET ile gider (sır tarayıcıya inmez).
import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { canManageResFiles, canReadResFiles } from "../_shared/resource-files.js";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY")!;
const HUB_BRIDGE_SECRET = Deno.env.get("HUB_BRIDGE_SECRET");
const MAIN_PROJECT_URL = Deno.env.get("MAIN_PROJECT_URL") || "https://fdlghaafspcuagxfrofz.supabase.co";

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};
const json = (b: unknown, s = 200) =>
  new Response(JSON.stringify(b), { status: s, headers: { ...cors, "Content-Type": "application/json" } });

const MAP: Record<string, string> = { upload_url: "sign_upload", finalize: "finalize", download_url: "download", delete: "delete" };

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  const asUser = createClient(SUPABASE_URL, ANON_KEY, {
    global: { headers: { Authorization: req.headers.get("Authorization") || "" } },
    auth: { autoRefreshToken: false, persistSession: false },
  });
  const { data: authData } = await asUser.auth.getUser();
  const email = authData?.user?.email?.toLowerCase();
  if (!email) return json({ ok: false, error: "unauthorized" }, 401);
  if (!HUB_BRIDGE_SECRET) return json({ ok: false, error: "HUB_BRIDGE_SECRET tanımlı değil" }, 500);

  try {
    const body = await req.json();
    const action = MAP[String(body?.action || "")];
    if (!action) return json({ ok: false, error: "bilinmeyen action" }, 400);
    const teamId = String(body?.teamId || "");

    const admin = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, { auth: { autoRefreshToken: false, persistSession: false } });
    const { data: cur } = await admin.from("app_state").select("data").eq("id", "shl_v5").maybeSingle();
    // deno-lint-ignore no-explicit-any
    const me = (cur?.data?.users || []).find((u: any) => String(u.email || "").toLowerCase() === email);
    if (!me) return json({ ok: false, error: "Ekip Paneli'nde profilin yok." }, 403);
    const allowed = action === "download" ? canReadResFiles(me, teamId) : canManageResFiles(me, teamId);
    if (!allowed) return json({ ok: false, error: action === "download" ? "Bu ekibin dosyalarını göremezsin." : "Bu ekibe dosya yükleme/silme yetkin yok." }, 403);

    const res = await fetch(`${MAIN_PROJECT_URL}/functions/v1/hub-resource-files`, {
      method: "POST",
      headers: { "Content-Type": "application/json", "x-hub-bridge-key": HUB_BRIDGE_SECRET },
      body: JSON.stringify({ action, teamId, fileName: body?.fileName, size: body?.size, fileId: body?.fileId, actorEmail: email }),
      signal: AbortSignal.timeout(20000),
    });
    const b = await res.json().catch(() => null);
    return json(b || { ok: false, error: `hub-resource-files ${res.status}` }, b?.ok ? 200 : (res.status >= 400 && res.status < 500 ? res.status : 502));
  } catch (e) {
    return json({ ok: false, error: String(e) }, 500);
  }
});
