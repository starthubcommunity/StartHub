// Supabase Edge Function: hub-team-access-request
// !!! BU PROJEYE DEPLOY EDİLİR: umgdtjlgivvymngsnqtv (Team App / Ekip Paneli) !!!
// JWT doğrulaması AÇIK — çağıranın KENDİ Team App oturumuyla. E-posta istemciden ALINMAZ (JWT'den).
//
// 2026-10-14 — giriş hesabı olan ama app_state.users'ta profili OLMAYAN kişi "Hesabın var ama
// ekibe eklenmedin" ekranını görür; bu fonksiyon accessRequests'e talep yazar + admin'lerin ziline
// bildirim düşer. users'a DOKUNMAZ (profil açmak yalnızca admin'in işi; üyelik koruma tetikleyicisi
// ve "yalnızca admin üye ekler" kuralı aynen). Yazma: taze-oku → CAS (_at) → yaz (köprülerle aynı desen).
import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { computeAccessRequest } from "./logic.ts";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY")!;
const MAX_ATTEMPTS = 3;

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};
const json = (b: unknown, s = 200) =>
  new Response(JSON.stringify(b), { status: s, headers: { ...cors, "Content-Type": "application/json" } });

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  const asUser = createClient(SUPABASE_URL, ANON_KEY, {
    global: { headers: { Authorization: req.headers.get("Authorization") || "" } },
    auth: { autoRefreshToken: false, persistSession: false },
  });
  const { data: authData } = await asUser.auth.getUser();
  const email = authData?.user?.email?.toLowerCase();
  if (!email) return json({ ok: false, error: "unauthorized" }, 401);
  const meta = authData?.user?.user_metadata || {};
  const name = String(meta.full_name || meta.name || "");

  const admin = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, { auth: { autoRefreshToken: false, persistSession: false } });
  for (let attempt = 0; attempt < MAX_ATTEMPTS; attempt++) {
    const { data: cur, error: re } = await admin.from("app_state").select("data").eq("id", "shl_v5").maybeSingle();
    if (re || !cur?.data) return json({ ok: false, error: re?.message || "okunamadı" }, 500);
    const knownAt = cur.data._at;
    const r = computeAccessRequest(cur.data, { email, name, now: Date.now(), uid: () => crypto.randomUUID() });
    if (!r.ok) return json({ ok: false, error: r.error }, 400);
    if (r.hasProfile) return json({ ok: true, hasProfile: true });
    const { data: recheck } = await admin.from("app_state").select("data").eq("id", "shl_v5").maybeSingle();
    if (recheck?.data?._at !== knownAt) continue;
    const { error: we } = await admin.from("app_state").upsert({ id: "shl_v5", data: { ...r.snapshot, _by: "hub-access-request", _at: Date.now() } });
    if (we) return json({ ok: false, error: we.message }, 500);
    return json({ ok: true, hasProfile: false, isNew: r.isNew, notified: r.notified });
  }
  return json({ ok: false, error: "çakışma, tekrar dene" }, 409);
});
