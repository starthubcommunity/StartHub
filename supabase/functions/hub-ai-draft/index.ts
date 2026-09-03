// Supabase Edge Function: hub-ai-draft
// Frontend: supabase.functions.invoke("hub-ai-draft", { body: { fullName, sourceDetail, whyThisOne, link, evidence } })
// Dönüş: { text: "<tek satır kişiselleştirme cümlesi>" }
//
// Admin panelin içerik otomasyonundaki Gemini desenini izler
// (automation/generate.py — gemini-2.5-flash, Generative Language API), ama
// AYRI bir secret kullanır. Admin panelin GEMINI_API_KEY'ine DOKUNMAZ.
//
//   supabase secrets set HUB_GEMINI_API_KEY=<anahtar>
//   # ops.: supabase secrets set HUB_GEMINI_MODEL=gemini-2.5-flash
//
// v2 §7: AI YALNIZCA ilk taslağı yazar. Gönderim her zaman insanla. Somut veri
// yoksa istemci canDraftAI() ile engelliyor; burada da kısa kontrol var.

import { serve } from "https://deno.land/std@0.224.0/http/server.ts";

const GEMINI_API_KEY = Deno.env.get("HUB_GEMINI_API_KEY");
const GEMINI_MODEL = Deno.env.get("HUB_GEMINI_MODEL") || "gemini-2.5-flash";
const API_BASE = "https://generativelanguage.googleapis.com/v1beta/models";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const SYSTEM = `Sen bir işe alım ekibine yardım eden bir asistansın. Görevin, bir adaya
LinkedIn/e-posta ile atılacak ilk mesajın SADECE kişiselleştirme cümlesini yazmak.

Kurallar:
- TEK cümle, en fazla 30 kelime. Türkçe.
- Adayın SOMUT bir eserine atıf yap ve mümkünse verilen sayısal ayrıntıyı
  kullan (repo adı + yıldız sayısı, kullanılan dil, ne kadar güncel olduğu,
  bitmiş proje sayısı). Verilen bilgide somut bir şey yoksa "" (boş string) döndür.
- Sıfat kullanma ("yetenekli", "başarılı", "etkileyici" YASAK). Ne yaptığını söyle.
- Şablon hissi verme. "Profilinizi inceledim" gibi klişe yok.
- Selamlama, imza, "merhaba" YOK — yalnızca o tek cümle.
- Yalnızca cümleyi döndür, tırnak veya açıklama ekleme.`;

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const { fullName, sourceDetail, whyThisOne, link, evidence, signals, aiScoreNote } = await req.json();

    const hasConcrete =
      (whyThisOne && String(whyThisOne).trim()) ||
      (sourceDetail && String(sourceDetail).trim()) ||
      (Array.isArray(evidence) && evidence.length > 0) ||
      (Array.isArray(signals) && signals.length > 0);
    if (!hasConcrete) {
      return new Response(JSON.stringify({ text: "" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    if (!GEMINI_API_KEY) {
      return new Response(JSON.stringify({ error: "HUB_GEMINI_API_KEY secret'i tanimli degil" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const userMsg = [
      `Ad: ${fullName || "(bilinmiyor)"}`,
      sourceDetail ? `Kaynak detayı: ${sourceDetail}` : null,
      whyThisOne ? `Neden bu kişi: ${whyThisOne}` : null,
      link ? `Link: ${link}` : null,
      Array.isArray(evidence) && evidence.length
        ? `Kanıt (link — not: yıldız / dil / güncellik):\n${evidence.map((e: string) => `  - ${e}`).join("\n")}`
        : null,
      Array.isArray(signals) && signals.length
        ? `GitHub sinyalleri: ${signals.join(" · ")}`
        : null,
      aiScoreNote ? `AI ön puan notu: ${aiScoreNote}` : null,
    ].filter(Boolean).join("\n");

    const url = `${API_BASE}/${GEMINI_MODEL}:generateContent?key=${encodeURIComponent(GEMINI_API_KEY)}`;
    const res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        system_instruction: { parts: [{ text: SYSTEM }] },
        contents: [{ role: "user", parts: [{ text: userMsg }] }],
        generationConfig: { maxOutputTokens: 200, temperature: 0.7 },
      }),
    });

    if (!res.ok) {
      const detail = await res.text();
      return new Response(JSON.stringify({ error: `Model hatası: ${res.status}`, detail }), {
        status: 502,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    const data = await res.json();
    const text = (data?.candidates?.[0]?.content?.parts?.[0]?.text || "")
      .trim()
      .replace(/^["']|["']$/g, "");

    return new Response(JSON.stringify({ text }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    return new Response(JSON.stringify({ error: String(e?.message || e) }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
