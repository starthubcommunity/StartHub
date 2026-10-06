// Yayınlanmış yazılarda görsel değişince site yeniden build'i için debounce'lu tetikleyici.
// Hook URL'i istemciye gelmez: çağrı supabase/functions/site-rebuild'e gider (kendi JWT'imizle).
// Debounce: ardarda değişikliklerde tek build. Sekme kapanırsa bekleyen çağrı pagehide'da
// keepalive fetch ile yine gönderilir.
import { supabase } from '../lib/supabase';

export const REBUILD_DELAY_MS = 30_000;

let timer = null;
let pendingToken = null;

async function send(token) {
  try {
    await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/site-rebuild`, {
      method: 'POST',
      keepalive: true,
      headers: {
        Authorization: `Bearer ${token}`,
        apikey: import.meta.env.VITE_SUPABASE_ANON_KEY,
        'Content-Type': 'application/json',
      },
      body: '{}',
    });
  } catch (e) {
    console.warn('[site-rebuild] tetiklenemedi:', e);
  }
}

function flush() {
  clearTimeout(timer);
  timer = null;
  if (!pendingToken) return;
  const token = pendingToken;
  pendingToken = null;
  send(token);
}

// Her çağrı bekleyen build'i erteler; son değişiklikten REBUILD_DELAY_MS sonra tek bir build çalışır.
export async function scheduleSiteRebuild() {
  const { data } = await supabase.auth.getSession();
  const token = data?.session?.access_token;
  if (!token) return;
  pendingToken = token;
  clearTimeout(timer);
  timer = setTimeout(flush, REBUILD_DELAY_MS);
}

if (typeof window !== 'undefined') window.addEventListener('pagehide', flush);
