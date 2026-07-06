// post-analytics.js — Yazı okuma metrikleri (görüntülenme, okuma süresi, scroll derinliği,
// cihaz, trafik kaynağı, kalıcı ziyaretçi kimliği). Supabase "post_views" tablosuna yazar.
// Kurulum SQL'i için admin-analytics.jsx'e bakın.
import { supabase } from './supabase';

const SUPABASE_URL      = import.meta.env.VITE_SUPABASE_URL;
const SUPABASE_ANON_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY;

// Oturum kimliği: sekme/oturum bazlı (sessionStorage) — "kaç ziyaret" sayımı için.
function getSessionId() {
  let id = sessionStorage.getItem('sh_session_id');
  if (!id) {
    id = uuid();
    sessionStorage.setItem('sh_session_id', id);
  }
  return id;
}

// Ziyaretçi kimliği: kalıcı (localStorage) — "kaç farklı kişi" ve "geri dönen ziyaretçi
// oranı" gibi oturumlar arası metrikler için. Kimlik bilgisi taşımaz, sadece rastgele id.
function getVisitorId() {
  let id = localStorage.getItem('sh_visitor_id');
  if (!id) {
    id = uuid();
    localStorage.setItem('sh_visitor_id', id);
  }
  return id;
}

function uuid() {
  return crypto.randomUUID ? crypto.randomUUID() : `${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

function detectReferrerType() {
  const ref = document.referrer;
  if (!ref) return 'direct';
  let host = '';
  try { host = new URL(ref).hostname.replace(/^www\./, ''); } catch { return 'other'; }
  if (host === window.location.hostname.replace(/^www\./, '')) return 'internal';
  if (/google\.|bing\.|yahoo\.|duckduckgo\./.test(host)) return 'search';
  if (/linkedin\.|twitter\.|x\.com|facebook\.|instagram\.|t\.co/.test(host)) return 'social';
  return 'other';
}

function detectDeviceType() {
  return window.innerWidth < 768 ? 'mobile' : 'desktop';
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
  const visitorId  = getVisitorId();
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

  const baseRow = { post_slug: slug, session_id: sessionId, lang: lang || null, entered_at: new Date(startedAt).toISOString() };
  const fullRow = { ...baseRow, visitor_id: visitorId, referrer_type: detectReferrerType(), device_type: detectDeviceType() };

  // "post_views" tablosu yeni kolonlar (visitor_id/referrer_type/device_type) eklenmeden
  // önce oluşturulduysa PostgREST tüm insert'i reddeder (PGRST204). Bu durumda temel
  // alanlarla tekrar denenir — migration SQL'i çalıştırılana kadar bile görüntülenme
  // sayımı kesintiye uğramasın diye.
  supabase.from('post_views').insert(fullRow).select('id').single()
    .then(({ data, error }) => {
      if (data) { rowId = data.id; return; }
      if (error?.code === 'PGRST204') {
        return supabase.from('post_views').insert(baseRow).select('id').single()
          .then(({ data: d2 }) => { if (d2) rowId = d2.id; });
      }
    })
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
