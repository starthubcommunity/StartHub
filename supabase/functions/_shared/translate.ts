// Paylaşılan çeviri yardımcısı — translate-text (Team App) ve translate-post (admin paneli)
// AYNI ücretsiz, anahtarsız servisi kullanır. Mantık burada tek yerde; iki fonksiyon da import eder.
//
// Google'ın anahtarsız uç noktası Supabase'in paylaşımlı IP aralığından 429 (rate limit)
// veriyor — MyMemory (api.mymemory.translated.net) kullanılıyor: anahtarsız, ücretsiz,
// Deno ortamından doğrulandı. Hiçbir metin/kayıt saklanmaz, yalnızca çeviri döner.

export async function translateOne(text: string, from: string, to: string): Promise<string> {
  if (!text || !text.trim()) return "";
  const url = `https://api.mymemory.translated.net/get?q=${encodeURIComponent(text)}&langpair=${from}|${to}`;
  const res = await fetch(url);
  if (!res.ok) throw new Error("çeviri servisi " + res.status);
  const data = await res.json();
  const out = data?.responseData?.translatedText;
  if (!out || data?.responseStatus !== 200) {
    throw new Error("çeviri boş döndü: " + JSON.stringify(data?.responseDetails || data));
  }
  return out;
}

// texts: { anahtar: metin }. Dönüş: { anahtar: çeviri } — başarısız olan anahtarlar boş string.
export async function translateBatch(
  texts: Record<string, string>,
  from = "tr",
  to = "en",
): Promise<Record<string, string>> {
  const keys = Object.keys(texts || {});
  const results = await Promise.all(
    keys.map((k) => translateOne(String(texts[k] || ""), from, to).catch(() => "")),
  );
  const out: Record<string, string> = {};
  keys.forEach((k, i) => { out[k] = results[i]; });
  return out;
}
