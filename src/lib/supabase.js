import { createClient } from '@supabase/supabase-js';

const supabaseUrl  = import.meta.env.VITE_SUPABASE_URL;
const supabaseKey  = import.meta.env.VITE_SUPABASE_ANON_KEY;

// "Beni hatırla" işaretliyse oturum localStorage'da tutulur (tarayıcı
// kapansa da kalıcı) — varsayılan (önceki davranışla aynı). İşaretli
// değilse sessionStorage kullanılır, sekme/tarayıcı kapanınca oturum
// biter. Tercih ayrı bir localStorage anahtarında saklanır; asıl oturum
// jetonu değil, sadece "hangi depoyu kullan" bilgisidir.
const REMEMBER_KEY = 'sh_adm_remember';
function activeStorage() {
  try {
    return localStorage.getItem(REMEMBER_KEY) === '0' ? sessionStorage : localStorage;
  } catch {
    return localStorage;
  }
}
export function setRememberMe(remember) {
  try { localStorage.setItem(REMEMBER_KEY, remember ? '1' : '0'); } catch {}
}

export const supabase = createClient(supabaseUrl, supabaseKey, {
  auth: {
    storage: {
      getItem: (key) => activeStorage().getItem(key),
      setItem: (key, value) => activeStorage().setItem(key, value),
      removeItem: (key) => activeStorage().removeItem(key),
    },
  },
});
