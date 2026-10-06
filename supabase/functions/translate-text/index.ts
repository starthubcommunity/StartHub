// Supabase Edge Function: translate-text  (main proje: fdlghaafspcuagxfrofz)
// Team App'in ("Proje Vitrini" modalı) TR alanlarını EN'e otomatik çevirmek
// için — kullanıcı kararı: "İngilizce'yi kendimiz yazmayalım, fazla iş yükü".
// Çeviri mantığı _shared/translate.ts'te (admin paneli için translate-post da
// aynı modülü kullanır). Paylaşılan anahtarla korunur (TEAM_PUBLISH_KEY —
// Team App'in diğer köprü fonksiyonlarıyla aynı, spam/kötüye kullanım freni).
//
//   supabase functions deploy translate-text --project-ref fdlghaafspcuagxfrofz --no-verify-jwt

import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import { translateBatch } from "../_shared/translate.ts";

const TEAM_PUBLISH_KEY = Deno.env.get("TEAM_PUBLISH_KEY");

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-team-publish-key",
};
const json = (b: unknown, s = 200) =>
  new Response(JSON.stringify(b), { status: s, headers: { ...cors, "Content-Type": "application/json" } });

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });

  const key = req.headers.get("x-team-publish-key");
  if (!TEAM_PUBLISH_KEY || key !== TEAM_PUBLISH_KEY) return json({ error: "unauthorized" }, 401);

  try {
    const { texts, from = "tr", to = "en" } = await req.json();
    if (!texts || typeof texts !== "object") return json({ error: "texts (obje: {key: metin}) zorunlu" }, 400);

    const translations = await translateBatch(texts, from, to);
    return json({ ok: true, translations });
  } catch (e) {
    return json({ error: String(e) }, 500);
  }
});
