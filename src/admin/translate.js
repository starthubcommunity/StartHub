// Yazı formunda tek dilde yazılan içeriği diğer dile otomatik çevirir (ücretsiz, anahtarsız
// MyMemory servisi). Sunucu tarafı: supabase/functions/translate-post (kendi JWT'imizle
// has_perm('posts.write')). Team App'in translate-text'i AYNI çeviri mantığını
// (_shared/translate.ts) kullanır, ama farklı yetkiyle (paylaşılan anahtar) — admin paneli
// kendi oturumunu kullanır.
import { supabase } from '../lib/supabase';

// texts: { anahtar: kaynak metin } → { anahtar: çeviri }. Başarısız anahtarlar boş string döner.
export async function translateText(texts, from = 'tr', to = 'en') {
  const { data } = await supabase.auth.getSession();
  const token = data?.session?.access_token;
  if (!token) throw new Error('Oturum yok');

  const res = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/translate-post`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
      apikey: import.meta.env.VITE_SUPABASE_ANON_KEY,
    },
    body: JSON.stringify({ texts, from, to }),
  });
  const out = await res.json().catch(() => null);
  if (!out?.ok) throw new Error(out?.error || `Çeviri başarısız (HTTP ${res.status})`);
  return out.translations;
}
