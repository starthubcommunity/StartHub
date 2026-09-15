// applications.jsx — Diğer Başvurular (HR, Yönetim altında). 'community' ve
// 'project' türü başvurular artık burada YOK — 0022 tetikleyicisiyle otomatik
// hub_candidates'a (Adaylar) düşüyorlar, ayrı bir inceleme/aktarım adımına
// gerek kalmadı (kullanıcı kararı, 2026-09-16). Bu sayfada yalnızca
// 'mentor_application' / 'sponsor_application' kalıyor — bunlar hiring
// pipeline'a girmez (aday değiller), tek görünür oldukları yer burası.
import React from 'react';
import { useState as useStateA, useEffect as useEffectA } from 'react';
import { supabase } from '../../lib/supabase';
import { AIcon, PageHead } from '../../admin/admin-ui';
import { usePerms } from '../../lib/use-perms';

const OTHER_INTENTS = ['mentor_application', 'sponsor_application'];

const STATUS_CFG = {
  new:      { label: 'Yeni',       color: '#2563EB', bg: '#EFF6FF' },
  reviewed: { label: 'İncelendi',  color: '#D97706', bg: '#FEF3C7' },
  accepted: { label: 'Kabul',      color: '#16A34A', bg: '#F0FDF4' },
  rejected: { label: 'Reddedildi', color: '#DC2626', bg: '#FEF2F2' },
};

const INTENT_LABEL = {
  community: 'Topluluk', project: 'Proje', mentor_application: 'Mentörlük', sponsor_application: 'Destekçilik',
};

function StatusBadge({ status }) {
  const cfg = STATUS_CFG[status] || STATUS_CFG.new;
  return (
    <span style={{ fontSize: 11, fontWeight: 700, padding: '3px 9px', borderRadius: 99, background: cfg.bg, color: cfg.color }}>
      {cfg.label}
    </span>
  );
}

export default function ApplicationsPage() {
  const { can } = usePerms();
  const canWrite = can('applications.write');

  const [items, setItems] = useStateA([]);
  const [loading, setLoading] = useStateA(true);
  const [selected, setSelected] = useStateA(null);
  const [filter, setFilter] = useStateA('all');
  const [updating, setUpdating] = useStateA(false);

  const load = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('applications')
        .select('*')
        .in('intent', OTHER_INTENTS)
        .order('created_at', { ascending: false });
      if (error) throw error;
      setItems(data || []);
    } catch (e) {
      console.error('[Diğer Başvurular] yüklenemedi:', e.message);
    } finally {
      setLoading(false);
    }
  };

  useEffectA(() => { load(); }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const updateStatus = async (id, status) => {
    setUpdating(true);
    try {
      await supabase.from('applications').update({ status }).eq('id', id);
      setItems((prev) => prev.map((x) => (x.id === id ? { ...x, status } : x)));
      if (selected?.id === id) setSelected((prev) => ({ ...prev, status }));
    } finally {
      setUpdating(false);
    }
  };

  const deleteApp = async (id) => {
    if (!window.confirm('Bu başvuruyu kalıcı olarak silmek istiyor musun?')) return;
    await supabase.from('applications').delete().eq('id', id);
    setItems((prev) => prev.filter((x) => x.id !== id));
    if (selected?.id === id) setSelected(null);
  };

  const filtered = filter === 'all' ? items : items.filter((x) => (x.status || 'new') === filter);

  const counts = items.reduce((acc, x) => {
    const s = x.status || 'new';
    acc[s] = (acc[s] || 0) + 1;
    return acc;
  }, {});

  const fmtDate = (iso) => {
    if (!iso) return '—';
    const d = new Date(iso);
    return d.toLocaleDateString('tr-TR', { day: '2-digit', month: 'short', year: 'numeric' });
  };

  return (
    <div>
      <PageHead title="Diğer Başvurular" desc={`${items.length} başvuru — mentörlük ve destekçilik (topluluk/proje başvuruları otomatik Adaylar'a düşer)`} />
      <div style={{ display: 'flex', gap: 0 }}>
        {/* Sol — liste */}
        <div style={{ flex: 1, minWidth: 0, overflow: 'auto' }}>
          <div style={{ display: 'flex', gap: 12, marginBottom: 20, flexWrap: 'wrap' }}>
            {[['all', 'Tümü', items.length], ...Object.entries(STATUS_CFG).map(([k, v]) => [k, v.label, counts[k] || 0])].map(([key, label, count]) => (
              <button key={key} onClick={() => setFilter(key)}
                style={{ padding: '7px 14px', borderRadius: 8, border: '1px solid var(--adm-border-light)', background: filter === key ? 'var(--adm-text)' : 'var(--adm-card)', color: filter === key ? 'var(--adm-bg)' : 'var(--adm-text)', fontSize: 13, fontWeight: 600, cursor: 'pointer', fontFamily: 'var(--font-body)' }}>
                {label} <span style={{ opacity: 0.6, marginLeft: 4 }}>{count}</span>
              </button>
            ))}
            <button onClick={load} style={{ marginLeft: 'auto', padding: '7px 12px', borderRadius: 8, border: '1px solid var(--adm-border-light)', background: 'var(--adm-card)', color: 'var(--adm-text-dim)', cursor: 'pointer', fontFamily: 'var(--font-body)', fontSize: 13, display: 'flex', alignItems: 'center', gap: 6 }}>
              <AIcon name="refresh" size={14} /> Yenile
            </button>
          </div>

          {loading ? (
            <div style={{ textAlign: 'center', padding: 48, color: 'var(--adm-text-dim)' }}>Yükleniyor…</div>
          ) : filtered.length === 0 ? (
            <div style={{ textAlign: 'center', padding: 48, color: 'var(--adm-text-dim)' }}>
              {items.length === 0 ? 'Henüz başvuru yok.' : 'Bu filtrede başvuru yok.'}
            </div>
          ) : (
            <div className="adm-table-wrap">
              <table className="adm-table">
                <thead>
                  <tr>
                    <th>Ad Soyad</th>
                    <th>E-posta</th>
                    <th>Tür</th>
                    <th>İlgi / Proje</th>
                    <th>Durum</th>
                    <th>Tarih</th>
                    {canWrite && <th></th>}
                  </tr>
                </thead>
                <tbody>
                  {filtered.map((app) => (
                    <tr key={app.id} style={{ cursor: 'pointer', background: selected?.id === app.id ? 'var(--adm-bg)' : undefined }}
                      onClick={() => setSelected(app)}>
                      <td style={{ fontWeight: 600 }}>{app.name || '—'}</td>
                      <td style={{ color: 'var(--adm-text-dim)', fontSize: 13 }}>{app.email || '—'}</td>
                      <td style={{ fontSize: 12.5, color: 'var(--adm-text-dim)' }}>{INTENT_LABEL[app.intent] || app.intent || '—'}</td>
                      <td style={{ fontSize: 13 }}>
                        {app.project_name
                          ? <span style={{ color: 'var(--adm-text-dim)' }}>📁 {app.project_name}</span>
                          : <span style={{ color: 'var(--adm-text-dim)' }}>{app.role || '—'}</span>}
                      </td>
                      <td><StatusBadge status={app.status || 'new'} /></td>
                      <td style={{ color: 'var(--adm-text-dim)', fontSize: 13, whiteSpace: 'nowrap' }}>{fmtDate(app.created_at)}</td>
                      {canWrite && (
                        <td>
                          <button onClick={(e) => { e.stopPropagation(); deleteApp(app.id); }}
                            style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--adm-text-dim)', padding: 4 }}
                            title="Sil">
                            <AIcon name="trash" size={15} />
                          </button>
                        </td>
                      )}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* Sağ — detay paneli */}
        {selected && (
          <div style={{ width: 340, flexShrink: 0, borderLeft: '1px solid var(--adm-border-light)', paddingLeft: 24, marginLeft: 24, overflowY: 'auto' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20 }}>
              <div style={{ fontFamily: 'var(--font-heading)', fontWeight: 700, fontSize: 16 }}>Başvuru Detayı</div>
              <button onClick={() => setSelected(null)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--adm-text-dim)' }}>
                <AIcon name="x" size={18} />
              </button>
            </div>

            {canWrite && (
              <div style={{ marginBottom: 20 }}>
                <div style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em', color: 'var(--adm-text-dim)', marginBottom: 8 }}>Durum</div>
                <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                  {Object.entries(STATUS_CFG).map(([s, cfg]) => (
                    <button key={s} disabled={updating} onClick={() => updateStatus(selected.id, s)}
                      style={{ padding: '5px 11px', borderRadius: 7, border: `1px solid ${(selected.status || 'new') === s ? cfg.color : 'var(--adm-border-light)'}`, background: (selected.status || 'new') === s ? cfg.bg : 'transparent', color: cfg.color, fontSize: 12, fontWeight: 700, cursor: 'pointer', fontFamily: 'var(--font-body)', opacity: updating ? 0.6 : 1 }}>
                      {cfg.label}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {[
              ['Ad Soyad', selected.name],
              ['E-posta', selected.email],
              ['Üniversite', selected.university],
              ['Bölüm', selected.department],
              ['İlgi Alanı', selected.role],
              ['Katılım Amacı', INTENT_LABEL[selected.intent] || selected.intent],
              ['Proje', selected.project_name],
              ['Yetenekler', selected.skills],
              ['LinkedIn', selected.linkedin],
              ['Portfolyo', selected.portfolio],
              ['Tarih', fmtDate(selected.created_at)],
            ].map(([label, val]) => (val ? (
              <div key={label} style={{ marginBottom: 14 }}>
                <div style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em', color: 'var(--adm-text-dim)', marginBottom: 3 }}>{label}</div>
                <div style={{ fontSize: 14, color: 'var(--adm-text)' }}>
                  {(label === 'LinkedIn' || label === 'Portfolyo') && val.startsWith('http')
                    ? <a href={val} target="_blank" rel="noreferrer" style={{ color: 'var(--adm-text)', textDecoration: 'underline' }}>{val}</a>
                    : val}
                </div>
              </div>
            ) : null))}

            {selected.bio && (
              <div style={{ marginBottom: 14 }}>
                <div style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em', color: 'var(--adm-text-dim)', marginBottom: 3 }}>Bio</div>
                <div style={{ fontSize: 14, color: 'var(--adm-text)', lineHeight: 1.6 }}>{selected.bio}</div>
              </div>
            )}

          </div>
        )}
      </div>
    </div>
  );
}
