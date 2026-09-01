// hub-ai-draft.js — AI ilk-taslak cümlesi (v2 §7).
//
// Tek senkron çağrı: `hub-ai-draft` edge function'ına POST. Function, adayın
// somut alanlarını (ad, kaynak detayı, "neden bu kişi", link) bir sistem
// promptuyla modele verir; dönen tek satırlık kişiselleştirme cümlesi
// `draft_text`'e yazılır. İnsan düzenler; gönderen HER ZAMAN insan.
//
// ⚠️ Edge function ayrıca deploy edilmeli: supabase/functions/hub-ai-draft/
import { supabase } from '../lib/supabase';
import { canDraftAI } from './hub-rules';

// candidate -> { text } | throw
export async function generateDraft(candidate) {
  if (!canDraftAI(candidate)) {
    const e = new Error('Veri yetersiz — bu adayda AI taslağı üretmek için yeterli somut bilgi yok. Elle yaz.');
    e.code = 'INSUFFICIENT_DATA';
    throw e;
  }
  const link = candidate.github || candidate.linkedin || candidate.email || null;
  const { data, error } = await supabase.functions.invoke('hub-ai-draft', {
    body: {
      fullName: candidate.fullName || '',
      sourceDetail: candidate.sourceDetail || '',
      whyThisOne: candidate.whyThisOne || '',
      link,
      evidence: (candidate.evidence || []).map((e) => e.url).filter(Boolean).slice(0, 3),
    },
  });
  if (error) throw new Error(error.message || 'Taslak üretilemedi.');
  const text = (data?.text || data?.draft || '').trim();
  if (!text) throw new Error('Model boş yanıt döndü.');
  return { text };
}
