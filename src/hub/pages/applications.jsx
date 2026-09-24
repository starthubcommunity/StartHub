// applications.jsx — LAB (startup) tarafı mentör / destekçi / fikir başvuruları (HR).
// Aynı bileşen üç sayfayı besler (hub-app.jsx: Mentörler · Destekçiler · Fikirler).
// Normal aday başvuruları (proje / proje havuzu) bu sayfalarda DEĞİL, 0041 tetikleyicisiyle
// doğrudan Adaylar'a düşer. HUB (topluluk) başvuruları HR'a hiç gelmez — Google Sheets
// tablosuna gider (Ayarlar › Hub Başvuru Tablosu). Eski kayıtlarda `target` boştur;
// onlar da burada görünür (yalnızca target='community' olanlar dışarıda tutulur).
import React from 'react';
import { useState as useStateA, useEffect as useEffectA } from 'react';
import { supabase } from '../../lib/supabase';
import { AIcon, PageHead } from '../../admin/admin-ui';
import { usePerms } from '../../lib/use-perms';

const KINDS = {
  mentor: {
    intents: ['mentor_application'],
    title: 'Mentörler',
    desc: 'Startup tarafında mentörlük yapmak isteyenlerin başvuruları',
    empty: 'Henüz mentör başvurusu yok.',
    cols: ['Ad Soyad', 'E-posta', 'Uzmanlık', 'Kurum', 'Startup', 'Durum', 'Tarih'],
    cells: (a) => [a.name, a.email, a.expertise, a.company, a.project_name],
  },
  sponsor: {
    intents: ['sponsor_application'],
    title: 'Destekçiler',
    desc: 'Startuplara yatırım / kaynak sağlamak isteyenlerin başvuruları',
    empty: 'Henüz destekçi başvurusu yok.',
    cols: ['Kişi', 'E-posta', 'Kurum', 'İşbirliği türü', 'Startup', 'Durum', 'Tarih'],
    cells: (a) => [a.name, a.email, a.company_name, Array.isArray(a.collaboration_types) ? a.collaboration_types.join(', ') : '', a.project_name],
  },
  idea: {
    intents: ['idea_application'],
    title: 'Fikirler',
    desc: 'Toplulukla geliştirmek üzere gelen yeni fikir başvuruları',
    empty: 'Henüz fikir başvurusu yok.',
    cols: ['Ad Soyad', 'E-posta', 'Fikir', 'Durum', 'Tarih'],
    cells: (a) => [a.name, a.email, (a.pitch || '').length > 70 ? `${a.pitch.slice(0, 69)}…` : a.pitch],
  },
};

const STATUS_CFG = {
  new:      { label: 'Yeni',       color: '#2563EB', bg: '#EFF6FF' },
  reviewed: { label: 'İncelendi',  color: '#D97706', bg: '#FEF3C7' },
  accepted: { label: 'Kabul',      color: '#16A34A', bg: '#F0FDF4' },
  rejected: { label: 'Reddedildi', color: '#DC2626', bg: '#FEF2F2' },
};

function StatusBadge({ status }) {
  const cfg = STATUS_CFG[status] || STATUS_CFG.new;
  return (
    <span style={{ fontSize: 11, fontWeight: 700, padding: '3px 9px', borderRadius: 99, background: cfg.bg, color: cfg.color }}>
      {cfg.label}
    </span>
  );
}

const fmtDate = (iso) => (iso ? new Date(iso).toLocaleDateString('tr-TR', { day: '2-digit', month: 'short', year: 'numeric' }) : '—');

// kind verilirse (eski çağrı biçimi) sabit tek-tip ekran; verilmezse (2026-09-24
// "Diğer Başvurular" birleştirmesi — nav'da 3 ayrı sekme yerine tek sekme) bileşen
// kendi tipini yönetir ve üstte bir tip-seçici çip satırı gösterir.
export default function ApplicationsPage({ kind: fixedKind }) {
  const [activeKind, setActiveKind] = useStateA(fixedKind || 'mentor');
  const cfgKind = KINDS[activeKind] || KINDS.mentor;
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
        .in('intent', cfgKind.intents)
        .or('target.is.null,target.eq.startup')     // HUB (topluluk) başvuruları HR'da yok
        .order('created_at', { ascending: false });
      if (error) throw error;
      setItems(data || []);
    } catch (e) {
      console.error('[HR başvurular] yüklenemedi:', e.message);
    } finally {
      setLoading(false);
    }
  };

  useEffectA(() => { setSelected(null); setFilter('all'); load(); }, [activeKind]); // eslint-disable-line react-hooks/exhaustive-deps

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
  const counts = items.reduce((acc, x) => { const s = x.status || 'new'; acc[s] = (acc[s] || 0) + 1; return acc; }, {});

  return (
    <div>
      <PageHead title={fixedKind ? cfgKind.title : 'Diğer Başvurular'} desc={`${items.length} başvuru — ${cfgKind.desc}`} />

      {!fixedKind && (
        <div style={{ display: 'flex', gap: 8, marginBottom: 18, flexWrap: 'wrap' }}>
          {Object.entries(KINDS).map(([k, c]) => (
            <button key={k} type="button" onClick={() => setActiveKind(k)}
              className={`adm-chip ${activeKind === k ? 'adm-chip--active' : ''}`}>
              {c.title}
            </button>
          ))}
        </div>
      )}

      <div style={{ display: 'flex', gap: 0 }}>
        {/* Sol — liste */}
        <div style={{ flex: 1, minWidth: 0, overflow: 'auto' }}>
          <div style={{ display: 'flex', gap: 10, marginBottom: 20, flexWrap: 'wrap' }}>
            {[['all', 'Tümü', items.length], ...Object.entries(STATUS_CFG).map(([k, v]) => [k, v.label, counts[k] || 0])].map(([key, label, count]) => (
              <button key={key} onClick={() => setFilter(key)}
                style={{ padding: '7px 14px', borderRadius: 8, border: '1px solid var(--adm-border-light)', background: filter === key ? 'var(--adm-text)' : 'var(--adm-bg-card)', color: filter === key ? 'var(--adm-text-inverse)' : 'var(--adm-text)', fontSize: 13, fontWeight: 600, cursor: 'pointer', fontFamily: 'var(--font-body)' }}>
                {label} <span style={{ opacity: 0.6, marginLeft: 4 }}>{count}</span>
              </button>
            ))}
            <button onClick={load} style={{ marginLeft: 'auto', padding: '7px 12px', borderRadius: 8, border: '1px solid var(--adm-border-light)', background: 'var(--adm-bg-card)', color: 'var(--adm-text-dim)', cursor: 'pointer', fontSize: 13, display: 'flex', alignItems: 'center', gap: 6 }}>
              <AIcon name="refresh" size={14} /> Yenile
            </button>
          </div>

          {loading ? (
            <div style={{ textAlign: 'center', padding: 48, color: 'var(--adm-text-dim)' }}>Yükleniyor…</div>
          ) : filtered.length === 0 ? (
            <div style={{ textAlign: 'center', padding: 48, color: 'var(--adm-text-dim)' }}>
              {items.length === 0 ? cfgKind.empty : 'Bu filtrede başvuru yok.'}
            </div>
          ) : (
            <div className="adm-table-wrap">
              <table className="adm-table">
                <thead>
                  <tr>
                    {cfgKind.cols.map((c) => <th key={c}>{c}</th>)}
                    {canWrite && <th></th>}
                  </tr>
                </thead>
                <tbody>
                  {filtered.map((app) => {
                    const cells = cfgKind.cells(app);
                    return (
                      <tr key={app.id} style={{ cursor: 'pointer', background: selected?.id === app.id ? 'var(--adm-bg)' : undefined }}
                        onClick={() => setSelected(app)}>
                        {cells.map((v, i) => (
                          <td key={i} style={i === 0 ? { fontWeight: 600 } : { color: 'var(--adm-text-dim)', fontSize: 13 }}>{v || '—'}</td>
                        ))}
                        <td><StatusBadge status={app.status || 'new'} /></td>
                        <td style={{ color: 'var(--adm-text-dim)', fontSize: 13, whiteSpace: 'nowrap' }}>{fmtDate(app.created_at)}</td>
                        {canWrite && (
                          <td>
                            <button onClick={(e) => { e.stopPropagation(); deleteApp(app.id); }}
                              style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--adm-text-dim)', padding: 4 }} title="Sil">
                              <AIcon name="trash" size={15} />
                            </button>
                          </td>
                        )}
                      </tr>
                    );
                  })}
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
                  {Object.entries(STATUS_CFG).map(([s, c]) => (
                    <button key={s} disabled={updating} onClick={() => updateStatus(selected.id, s)}
                      style={{ padding: '5px 11px', borderRadius: 7, border: `1px solid ${(selected.status || 'new') === s ? c.color : 'var(--adm-border-light)'}`, background: (selected.status || 'new') === s ? c.bg : 'transparent', color: c.color, fontSize: 12, fontWeight: 700, cursor: 'pointer', fontFamily: 'var(--font-body)', opacity: updating ? 0.6 : 1 }}>
                      {c.label}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {[
              ['Ad Soyad', selected.name],
              ['E-posta', selected.email],
              ['Hedef', selected.target === 'startup' ? 'Startup' : ''],
              ['Startup', selected.project_name],
              ['Uzmanlık', selected.expertise],
              ['Deneyim', selected.experience_years ? `${selected.experience_years} yıl` : ''],
              ['Haftalık Süre', selected.weekly_hours ? `${selected.weekly_hours} saat` : ''],
              ['Şirket / Kurum', selected.company || selected.company_name],
              ['Web Sitesi', selected.website],
              ['İşbirliği Türü', Array.isArray(selected.collaboration_types) ? selected.collaboration_types.join(', ') : ''],
              ['Fikir', selected.pitch],
              ['Çözdüğü Problem', selected.problem],
              ['Şu Ana Kadar Yapılan', selected.progress],
              ['LinkedIn', selected.linkedin_url || selected.linkedin],
              ['Üniversite', selected.university],
              ['Bölüm', selected.department],
              ['Tarih', fmtDate(selected.created_at)],
            ].map(([label, val]) => (val ? (
              <div key={label} style={{ marginBottom: 14 }}>
                <div style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em', color: 'var(--adm-text-dim)', marginBottom: 3 }}>{label}</div>
                <div style={{ fontSize: 14, color: 'var(--adm-text)', wordBreak: 'break-word' }}>
                  {(label === 'LinkedIn' || label === 'Web Sitesi') && /^https?:\/\//.test(val)
                    ? <a href={val} target="_blank" rel="noreferrer" style={{ color: 'var(--adm-text)', textDecoration: 'underline' }}>{val}</a>
                    : val}
                </div>
              </div>
            ) : null))}

            {(selected.bio || selected.sponsor_message) && (
              <div style={{ marginBottom: 14 }}>
                <div style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em', color: 'var(--adm-text-dim)', marginBottom: 3 }}>Mesaj / Not</div>
                <div style={{ fontSize: 14, color: 'var(--adm-text)', lineHeight: 1.6, whiteSpace: 'pre-wrap' }}>{selected.sponsor_message || selected.bio}</div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
