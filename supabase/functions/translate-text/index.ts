// Supabase Edge Function: translate-text  (main proje: fdlghaafspcuagxfrofz)
// Team App'in ("Proje Vitrini" modalı) TR alanlarını EN'e otomatik çevirmek
// için — kullanıcı kararı: "İngilizce'yi kendimiz yazmayalım, fazla iş yükü".
// Ücretsiz, anahtarsız Google Translate uç noktasını SUNUCU tarafında
// çağırır (tarayıcıdan CORS engeller). Yalnızca metin döner, hiçbir kayıt
// tutulmaz. Paylaşılan anahtarla korunur (TEAM_PUBLISH_KEY — Team App'in
// diğer köprü fonksiyonlarıyla aynı, spam/kötüye kullanım freni).
//
//   supabase functions deploy translate-text --project-ref fdlghaafspcuagxfrofz --no-verify-jwt

import { serve } from "https://deno.land/std@0.224.0/http/server.ts";

const TEAM_PUBLISH_KEY = Deno.env.get("TEAM_PUBLISH_KEY");

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-team-publish-key",
};
const json = (b: unknown, s = 200) =>
  new Response(JSON.stringify(b), { status: s, headers: { ...cors, "Content-Type": "application/json" } });

// Google'ın anahtarsız uç noktası Supabase'in paylaşımlı IP aralığından
// 429 (rate limit) veriyor — MyMemory (api.mymemory.translated.net)
// kullanılıyor: anahtarsız, ücretsiz, Deno ortamından doğrulandı.
async function translateOne(text: string, from: string, to: string): Promise<string> {
  if (!text || !text.trim()) return "";
  const url = `https://api.mymemory.translated.net/get?q=${encodeURIComponent(text)}&langpair=${from}|${to}`;
  const res = await fetch(url);
  if (!res.ok) throw new Error("çeviri servisi " + res.status);
  const data = await res.json();
  const out = data?.responseData?.translatedText;
  if (!out || data?.responseStatus !== 200) throw new Error("çeviri boş döndü: " + JSON.stringify(data?.responseDetails || data));
  return out;
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });

  const key = req.headers.get("x-team-publish-key");
  if (!TEAM_PUBLISH_KEY || key !== TEAM_PUBLISH_KEY) return json({ error: "unauthorized" }, 401);

  try {
    const { texts, from = "tr", to = "en" } = await req.json();
    if (!texts || typeof texts !== "object") return json({ error: "texts (obje: {key: metin}) zorunlu" }, 400);

    const keys = Object.keys(texts);
    const results = await Promise.all(keys.map((k) => translateOne(String(texts[k] || ""), from, to).catch(() => "")));
    const out: Record<string, string> = {};
    keys.forEach((k, i) => { out[k] = results[i]; });

    return json({ ok: true, translations: out });
  } catch (e) {
    return json({ error: String(e) }, 500);
  }
});
