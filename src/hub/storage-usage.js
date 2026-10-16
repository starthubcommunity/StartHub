// storage-usage.js — D2 (2026-10-16): ana projenin toplam depolama kullanımı (ücretsiz plan 1 GB).
// hub_storage_usage() RPC'si yalnızca equity.read (cofounder) için çalışır; diğerlerinde null döner.
// HR kenar menüsündeki satır ve Genel Bakış'taki uyarı aynı kaynaktan beslenir.
import { supabase } from '../lib/supabase';

export async function fetchStorageUsage() {
  try {
    const { data, error } = await supabase.rpc('hub_storage_usage');
    if (error || !data) return null;
    return { used: Number(data.used) || 0, limit: Number(data.limit) || 1073741824, stopAt: Number(data.stopAt) || 734003200 };
  } catch { return null; }
}

export function formatStorage(u) {
  if (!u) return '';
  const mb = (b) => Math.round(b / 1048576);
  return `${mb(u.used)} MB / ${u.limit >= 1073741824 ? Math.round(u.limit / 1073741824) + ' GB' : mb(u.limit) + ' MB'}`;
}
export const storageOverStop = (u) => !!u && u.used >= u.stopAt;
