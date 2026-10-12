// recent-acceptances.js — B (0061): son 7 günde onaylanan pay sözü sözleşmeleri.
// HR zili (hub-app.jsx) ve Genel Bakış'taki "Onaylandı" satırı AYNI kaynaktan beslenir.
// RLS: contract_acceptances yalnızca equity.read (cofounder) için okunur; diğerlerine boş döner.
import { supabase } from '../lib/supabase';

export const RECENT_ACCEPT_DAYS = 7;

export async function recentAcceptances(days = RECENT_ACCEPT_DAYS) {
  const since = new Date(Date.now() - days * 86400000).toISOString();
  const { data, error } = await supabase.from('contract_acceptances')
    .select('id, typed_name, accepted_at, terms').gte('accepted_at', since).order('accepted_at', { ascending: false });
  if (error) return [];
  return (data || []).map((a) => ({
    id: a.id,
    name: a.terms?.holderName || a.typed_name,
    project: a.terms?.project || '—',
    pct: String(Math.round(Number(a.terms?.grantPct || 0) * 1000) / 1000).replace('.', ','),
    when: new Date(a.accepted_at).toLocaleDateString('tr-TR', { day: 'numeric', month: 'short' }),
  }));
}
