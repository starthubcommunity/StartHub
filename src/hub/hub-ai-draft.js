// hub-ai-draft.js — AI ilk-taslak cümlesi (v2 §7).
//
// Tek senkron çağrı: `hub-ai-draft` edge function'ına POST. Function, adayın
// somut alanlarını (ad, kaynak detayı, "neden bu kişi", kanıt + sinyaller)
// bir sistem promptuyla Gemini'ye (gemini-2.5-flash) verir; dönen tek satırlık
// kişiselleştirme cümlesi `draft_text`'e yazılır. İnsan düzenler; gönderen
// HER ZAMAN insan.
//
// ⚠️ Edge function deploy edilmeli + ayrı secret:
//    supabase secrets set HUB_GEMINI_API_KEY=<anahtar>
//    (admin panelin GEMINI_API_KEY'ine dokunmaz)
import { supabase } from '../lib/supabase';
import { canDraftAI } from './hub-rules';

const INSUFFICIENT = 'Veri yetersiz, elle yaz. (Kaynak detayı / "neden bu kişi" / kanıt linki gerekli.)';

// candidate -> { text } | throw
export async function generateDraft(candidate) {
  // UI de aynı kontrolü yapar; burası ikinci kapı — veri yoksa HİÇ istek gitmez.
  if (!canDraftAI(candidate)) {
    const e = new Error(INSUFFICIENT);
    e.code = 'INSUFFICIENT_DATA';
    throw e;
  }

  const link = candidate.github || candidate.linkedin || candidate.email || null;

  // Zengin bağlam: kanıt linkleri + notları (yıldız/dil/güncellik), GitHub
  // sinyalleri ve AI ön puan notu — sadece repo adı değil.
  const evidence = (candidate.evidence || [])
    .map((e) => [e.url, e.note].filter(Boolean).join(' — '))
    .filter(Boolean)
    .slice(0, 5);

  const en = candidate.enrichment || {};
  const signals = [];
  if (en.finished_projects != null) signals.push(`bitmiş proje: ${en.finished_projects}`);
  if (en.activity_recency != null) signals.push(`son aktiflik: ${en.activity_recency} gün önce`);
  if (en.consistency != null) signals.push(`süreklilik: ${en.consistency}/12 ay`);
  if (en.breadth != null) signals.push(`dil çeşitliliği: ${en.breadth}`);
  if (en.collaboration != null) signals.push(`iş birliği (PR): ${en.collaboration}`);

  const { data, error } = await supabase.functions.invoke('hub-ai-draft', {
    body: {
      fullName: candidate.fullName || '',
      sourceDetail: candidate.sourceDetail || '',
      whyThisOne: candidate.whyThisOne || '',
      link,
      evidence,
      signals,
      aiScoreNote: candidate.aiScoreNote || '',
    },
  });
  if (error) throw new Error(error.message || 'Taslak üretilemedi.');
  const text = (data?.text || data?.draft || '').trim();
  // Model somut bir şey bulamazsa "" döner — bunu ham hata değil, "elle yaz" say.
  if (!text) throw new Error(INSUFFICIENT);
  return { text };
}
