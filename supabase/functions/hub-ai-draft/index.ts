// Supabase Edge Function: hub-ai-draft
// Frontend: supabase.functions.invoke("hub-ai-draft", { body: { fullName, sourceDetail, whyThisOne, link, evidence } })
// Dönüş: { text: "<tek satır kişiselleştirme cümlesi>" }
//
// Anthropic API anahtarını asla buraya yazma; project secret olarak sakla:
//   supabase secrets set ANTHROPIC_API_KEY=sk-ant-xxx
//
// v2 §7: AI YALNIZCA ilk taslağı yazar. Gönderim her zaman insanla. Somut veri
// yoksa istemci zaten canDraftAI() ile engelliyor; burada da kısa kontrol var.

import { serve } from "https://deno.land/std@0.224.0/http/server.ts";

const ANTHROPIC_API_KEY = Deno.env.get("ANTHROPIC_API_KEY");
const MODEL = Deno.env.get("HUB_AI_MODEL") || "claude-sonnet-5";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const SYSTEM = `Sen bir işe alım ekibine yardım eden bir asistansın. Görevin, bir adaya
LinkedIn/e-posta ile atılacak ilk mesajın SADECE kişiselleştirme cümlesini yazmak.

Kurallar:
- TEK cümle, en fazla 30 kelime. Türkçe.
- Adayın SOMUT bir eserine atıf yap (proje, repo, yarışma, yazı). Verilen bilgide
  somut bir şey yoksa "" (boş string) döndür.
- Sıfat kullanma ("yetenekli", "başarılı", "etkileyici" YASAK). Ne yaptığını söyle.
- Şablon hissi verme. "Profilinizi inceledim" gibi klişe yok.
- Selamlama, imza, "merhaba" YOK — yalnızca o tek cümle.
- Yalnızca cümleyi döndür, tırnak veya açıklama ekleme.`;

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const { fullName, sourceDetail, whyThisOne, link, evidence } = await req.json();

    const hasConcrete =
      (whyThisOne && String(whyThisOne).trim()) ||
      (sourceDetail && String(sourceDetail).trim()) ||
      (Array.isArray(evidence) && evidence.length > 0);
    if (!hasConcrete) {
      return new Response(JSON.stringify({ text: "" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    if (!ANTHROPIC_API_KEY) {
      return new Response(JSON.stringify({ error: "ANTHROPIC_API_KEY secret'i tanimli degil" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const userMsg = [
      `Ad: ${fullName || "(bilinmiyor)"}`,
      sourceDetail ? `Kaynak detayı: ${sourceDetail}` : null,
      whyThisOne ? `Neden bu kişi: ${whyThisOne}` : null,
      link ? `Link: ${link}` : null,
      Array.isArray(evidence) && evidence.length ? `Kanıt: ${evidence.join(", ")}` : null,
    ].filter(Boolean).join("\n");

    const res = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "x-api-key": ANTHROPIC_API_KEY,
        "anthropic-version": "2023-06-01",
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: MODEL,
        max_tokens: 200,
        system: SYSTEM,
        messages: [{ role: "user", content: userMsg }],
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
    const text = (data?.content?.[0]?.text || "").trim().replace(/^["']|["']$/g, "");

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
