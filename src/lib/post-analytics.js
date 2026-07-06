// post-analytics.js — Yazı okuma metrikleri (görüntülenme, okuma süresi, scroll derinliği)
// Supabase "post_views" tablosuna yazar. Kurulum SQL'i için admin-analytics.jsx'e bakın.
import { supabase } from './supabase';

const SUPABASE_URL      = import.meta.env.VITE_SUPABASE_URL;
const SUPABASE_ANON_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY;

function getSessionId() {
  let id = sessionStorage.getItem('sh_session_id');
  if (!id) {
    id = (crypto.randomUUID ? crypto.randomUUID() : `${Date.now()}-${Math.random().toString(36).slice(2)}`);
    sessionStorage.setItem('sh_session_id', id);
  }
  return id;
}

/**
 * Bir yazı sayfası açıldığında çağrılır. Görüntülenmeyi kaydeder, scroll derinliğini
 * izler, sayfadan ayrılırken (sekme değişimi / kapatma / navigasyon) toplam okuma
 * süresini ve ulaşılan en yüksek scroll yüzdesini Supabase'e yazar.
 *
 * Dönüş: temizlik (cleanup) fonksiyonu — component unmount olduğunda çağrılmalı.
 */
export function trackPostView(slug, lang) {
  if (!slug || !SUPABASE_URL) return () => {};

  const sessionId  = getSessionId();
  const startedAt  = Date.now();
  let rowId        = null;
  let maxScrollPct = 0;
  let sent         = false;

  const onScroll = () => {
    const doc = document.documentElement;
    const scrollable = doc.scrollHeight - doc.clientHeight;
    const pct = scrollable > 0 ? Math.min(100, Math.round((window.scrollY / scrollable) * 100)) : 100;
    if (pct > maxScrollPct) maxScrollPct = pct;
  };
  window.addEventListener('scroll', onScroll, { passive: true });
  onScroll();

  supabase.from('post_views')
    .insert({ post_slug: slug, session_id: sessionId, lang: lang || null, entered_at: new Date(startedAt).toISOString() })
    .select('id').single()
    .then(({ data }) => { if (data) rowId = data.id; })
    .catch(() => {});

  const sendFinal = () => {
    if (sent || !rowId) return;
    sent = true;
    const duration = Math.round((Date.now() - startedAt) / 1000);
    fetch(`${SUPABASE_URL}/rest/v1/post_views?id=eq.${rowId}`, {
      method:  'PATCH',
      keepalive: true,
      headers: {
        'Content-Type': 'application/json',
        'Prefer':       'return=minimal',
        apikey:         SUPABASE_ANON_KEY,
        Authorization:  `Bearer ${SUPABASE_ANON_KEY}`,
      },
      body: JSON.stringify({ duration_seconds: duration, max_scroll_pct: maxScrollPct }),
    }).catch(() => {});
  };

  const onVisibilityChange = () => { if (document.visibilityState === 'hidden') sendFinal(); };
  document.addEventListener('visibilitychange', onVisibilityChange);
  window.addEventListener('pagehide', sendFinal);

  return () => {
    window.removeEventListener('scroll', onScroll);
    document.removeEventListener('visibilitychange', onVisibilityChange);
    window.removeEventListener('pagehide', sendFinal);
    sendFinal();
  };
}
