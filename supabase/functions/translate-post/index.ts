// Supabase Edge Function: translate-post (main proje: fdlghaafspcuagxfrofz)
// Admin panelinde yazı formunun TR alanlarını (başlık/özet/içerik) EN'e otomatik
// çevirir — Team App'in translate-text'iyle AYNI ücretsiz servis (_shared/translate.ts),
// ama yetki farklı: burada çağıranın kendi admin oturumu var, paylaşılan Team App
// anahtarı (TEAM_PUBLISH_KEY) kullanılmaz/sızdırılmaz.
//
// Yetki: has_perm('posts.write') — swap_post_image (0056) ve site-rebuild ile aynı kapı.
//
//   supabase functions deploy translate-post --project-ref fdlghaafspcuagxfrofz

import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { translateBatch } from "../_shared/translate.ts";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY")!;

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};
const json = (b: unknown, s = 200) =>
  new Response(JSON.stringify(b), { status: s, headers: { ...cors, "Content-Type": "application/json" } });

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  if (req.method !== "POST") return json({ ok: false, error: "Yöntem desteklenmiyor" }, 405);

  const auth = req.headers.get("Authorization") ?? "";
  if (!auth) return json({ ok: false, error: "Oturum yok" }, 401);

  const sb = createClient(SUPABASE_URL, ANON_KEY, { global: { headers: { Authorization: auth } } });
  const { data: allowed, error } = await sb.rpc("has_perm", { p_key: "posts.write" });
  if (error || allowed !== true) return json({ ok: false, error: "Yetkin yok" }, 403);

  try {
    const { texts, from = "tr", to = "en" } = await req.json();
    if (!texts || typeof texts !== "object") return json({ ok: false, error: "texts (obje: {key: metin}) zorunlu" }, 400);

    const translations = await translateBatch(texts, from, to);
    return json({ ok: true, translations });
  } catch (e) {
    return json({ ok: false, error: String(e) }, 500);
  }
});
