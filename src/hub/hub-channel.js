// hub-channel.js — son kullanılan iletişim kanalı (aday kartı + hızlı eleme
// aynı varsayılanı paylaşsın). sessionStorage/localStorage başarısız olabilir.
const KEY = 'sh_hub_last_channel';

export const lastChannel = () => {
  try { return localStorage.getItem(KEY) || 'linkedin'; } catch { return 'linkedin'; }
};
export const rememberChannel = (ch) => {
  try { localStorage.setItem(KEY, ch); } catch { /* yoksay */ }
};
