// Supabase Edge Function: site-rebuild (main proje: fdlghaafspcuagxfrofz)
// Yayınlanmış bir yazının görseli değişince sitenin statik build'ini yeniden tetikler.
// Neden gerekli: prerender çıktısındaki og:image, JSON-LD image ve sitemap görsel girdileri
// yalnızca build sırasında yazılır; SPA yazıyı çalışma anında çektiği için o kısım canlıda
// hemen güncellenir, ama statik HTML/sitemap ancak yeniden build'le güncellenir.
//
// Hook URL'i (VERCEL_DEPLOY_HOOK_URL secret'ı) yalnızca bu fonksiyonda; istemci görmez.
// Yetki: çağıranın kendi JWT'siyle has_perm('posts.write') — swap_post_image ile aynı kapı.
// Çağrıyı istemci 30 sn debounce ile yapar (src/admin/site-rebuild.js).
//
//   supabase secrets set VERCEL_DEPLOY_HOOK_URL=<hook-url> --project-ref fdlghaafspcuagxfrofz
//   supabase functions deploy site-rebuild --project-ref fdlghaafspcuagxfrofz

import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY")!;
const DEPLOY_HOOK_URL = Deno.env.get("VERCEL_DEPLOY_HOOK_URL");

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...cors, "Content-Type": "application/json" },
  });
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  if (req.method !== "POST") return json({ ok: false, error: "Yöntem desteklenmiyor" }, 405);

  const auth = req.headers.get("Authorization") ?? "";
  if (!auth) return json({ ok: false, error: "Oturum yok" }, 401);

  // Çağıranın kendi oturumuyla kontrol: RLS/has_perm kullanıcının kimliğine göre çalışır.
  const sb = createClient(SUPABASE_URL, ANON_KEY, { global: { headers: { Authorization: auth } } });
  const { data: allowed, error } = await sb.rpc("has_perm", { p_key: "posts.write" });
  if (error || allowed !== true) return json({ ok: false, error: "Yetkin yok" }, 403);

  if (!DEPLOY_HOOK_URL) return json({ ok: false, error: "VERCEL_DEPLOY_HOOK_URL tanımlı değil" }, 500);

  try {
    const res = await fetch(DEPLOY_HOOK_URL, { method: "POST" });
    return json({ ok: res.ok, status: res.status }, res.ok ? 200 : 502);
  } catch (e) {
    return json({ ok: false, error: String(e) }, 502);
  }
});
