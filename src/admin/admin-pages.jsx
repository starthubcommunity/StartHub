// admin-pages.jsx — Dashboard, Projects, Posts
import { useState as useStateP, useEffect as useEffectP, useMemo as useMemoP, useRef as useRefP } from 'react';
import { useAdmin, uid, COLLECTIONS } from './admin-store';
import { AIcon, StatCard, DataTable, Modal, Field, Input, Textarea, Select, ImageUpload, PostCoverUpload, SearchBar, PageHead, ConfirmDialog, TagInput, TriToggle, Stepper, PeoplePicker } from './admin-ui';
import { ProjectPreview, PostPreview, PreviewToggle, PV_STAGE, PV_TAG } from './admin-previews';
import { people } from '../data';

// ============================================
// DASHBOARD — istatistikler (auto/manuel) + özet
// ============================================
const STAT_META = [
  { key: 'projects',  label: 'Projeler',        icon: 'rocket',    color: '#2563EB', auto: true  },
  { key: 'posts',     label: 'Yazılar',         icon: 'layers',    color: '#7C3AED', auto: true  },
  { key: 'openRoles', label: 'Açık Pozisyon',   icon: 'briefcase', color: '#EA580C', auto: true  },
  { key: 'members',   label: 'Aktif Üye',       icon: 'users',     color: '#16A34A', auto: false },
  { key: 'sponsors',  label: 'Destekçi',        icon: 'handshake', color: '#D97706', auto: false },
];

function DashboardPage() {
  const { data, counts, statValue, setStat } = useAdmin();
  const recentPosts = data.posts.slice().sort((a, b) => (b.date || '').localeCompare(a.date || '')).slice(0, 5);

  return (
    <div>
      <PageHead title="Dashboard" desc="Sitede görünen istatistikleri buradan yönet. Otomatik olanlar veriden hesaplanır, dilersen manuel değer gir." />

      <div className="adm-statctl-grid">
        {STAT_META.map(m => {
          const s = data.siteStats[m.key];
          const live = counts[m.key];
          const effective = statValue(m.key);
          return (
            <div key={m.key} className="adm-statctl">
              <div className="adm-statctl__top">
                <div className="adm-stat__icon" style={{ background: `color-mix(in srgb, ${m.color} 12%, transparent)`, color: m.color, width: 36, height: 36 }}>
                  <AIcon name={m.icon} size={18} />
                </div>
                <div>
                  <div className="adm-statctl__value">{effective}{s.suffix}</div>
                  <div className="adm-statctl__label">{m.label}</div>
                </div>
              </div>

              {m.auto && (
                <div className="adm-statctl__modes">
                  <button className={`adm-mini-tab ${s.mode === 'auto' ? 'adm-mini-tab--active' : ''}`} onClick={() => setStat(m.key, { mode: 'auto' })}>
                    Otomatik <span className="adm-mini-tab__hint">({live})</span>
                  </button>
                  <button className={`adm-mini-tab ${s.mode === 'manual' ? 'adm-mini-tab--active' : ''}`} onClick={() => setStat(m.key, { mode: 'manual' })}>
                    Manuel
                  </button>
                </div>
              )}

              <div className="adm-statctl__inputs">
                <input type="number" className="adm-input adm-input--sm" disabled={m.auto && s.mode === 'auto'}
                  value={m.auto && s.mode === 'auto' ? live : (s.value ?? '')}
                  onChange={e => setStat(m.key, { value: parseInt(e.target.value) || 0 })} />
                <input type="text" className="adm-input adm-input--sm adm-input--suffix" placeholder="+"
                  value={s.suffix} onChange={e => setStat(m.key, { suffix: e.target.value })} title="Sonek (örn +)" />
              </div>
              {!m.auto && <div className="adm-statctl__note">Manuel · sadece elle güncellenir</div>}
            </div>
          );
        })}
      </div>

      <div className="adm-grid-2" style={{ marginTop: 28 }}>
        <div className="adm-card">
          <div className="adm-card__header"><h3>Son Yazılar</h3></div>
          <div className="adm-card__body" style={{ padding: 0 }}>
            {recentPosts.map(p => (
              <div key={p.id} className="adm-list-item">
                <div className="adm-list-item__thumb" style={{ background: p.bg || 'var(--adm-border)' }}>
                  {p.cover && <img src={p.cover} alt="" />}
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div className="adm-list-item__title">{p.title_tr}</div>
                  <div className="adm-list-item__sub">{p.date} · {(PV_TAG[p.tag] || {}).label || p.tag}</div>
                </div>
              </div>
            ))}
          </div>
        </div>
        <div className="adm-card">
          <div className="adm-card__header"><h3>Proje Durumları</h3></div>
          <div className="adm-card__body" style={{ padding: 0 }}>
            {data.startups.map(s => (
              <div key={s.id} className="adm-list-item">
                <div className="adm-list-item__logo" style={{ background: s.color }}>
                  {s.logo ? <img src={s.logo} alt="" /> : s.name[0]}
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div className="adm-list-item__title">{s.name}</div>
                  <div className="adm-list-item__sub">{s.team} kişi{s.openRoles > 0 ? ` · ${s.openRoles} açık rol` : ''}</div>
                </div>
                <span className={`adm-badge adm-badge--${s.stage}`}>{(PV_STAGE[s.stage] || {}).label || s.stage}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

// ============================================
// PROJECTS
// ============================================
function ProjectsPage() {
  const { data, addItem, updateItem, deleteItem, clearFlagExcept } = useAdmin();
  const [search, setSearch] = useStateP('');
  const [editing, setEditing] = useStateP(null);
  const [deleting, setDeleting] = useStateP(null);

  const filtered = useMemoP(() => {
    if (!search) return data.startups;
    const q = search.toLowerCase();
    return data.startups.filter(s => s.name.toLowerCase().includes(q) || (s.slug || '').toLowerCase().includes(q));
  }, [data.startups, search]);

  const columns = [
    { key: 'name', label: 'Proje', render: (r) => (
      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
        <div className="adm-cell-logo" style={{ background: r.color }}>
          {r.logo ? <img src={r.logo} alt="" /> : r.name[0]}
        </div>
        <div><div style={{ fontWeight: 600, display: 'flex', alignItems: 'center', gap: 6 }}>{r.name}{r.featured && <span className="adm-pill-featured">★ Öne Çıkan</span>}</div><div style={{ fontSize: 12, color: 'var(--adm-text-dim)' }}>{r.tagline_tr}</div></div>
      </div>
    )},
    { key: 'stage', label: 'Aşama', render: (r) => <span className={`adm-badge adm-badge--${r.stage}`}>{(PV_STAGE[r.stage] || {}).label || r.stage}</span> },
    { key: 'team', label: 'Ekip', style: { width: 70 } },
    { key: 'openRoles', label: 'Açık Rol', style: { width: 90 } },
  ];

  const handleSave = async (formData) => {
    const id = editing === 'new' ? parseInt(uid()) : editing.id;
    if (editing === 'new') await addItem('startups', { ...formData, id });
    else await updateItem('startups', id, formData);
    if (formData.featured === true) clearFlagExcept('startups', id, 'featured');
    setEditing(null);
  };

  return (
    <div>
      <PageHead title="Projeler" desc={`${data.startups.length} proje`} actions={
        <button className="adm-btn adm-btn--primary" onClick={() => setEditing('new')}><AIcon name="plus" size={16} /> Yeni Proje</button>
      } />
      <div className="adm-card">
        <div className="adm-card__header"><SearchBar value={search} onChange={setSearch} placeholder="Proje ara..." /></div>
        <div className="adm-card__body" style={{ padding: 0 }}>
          <DataTable columns={columns} data={filtered} onEdit={setEditing} onDelete={setDeleting} />
        </div>
      </div>
      {!!editing && <ProjectForm item={editing === 'new' ? null : editing} onClose={() => setEditing(null)} onSave={handleSave} people={data.people} />}
      <ConfirmDialog open={!!deleting} onClose={() => setDeleting(null)} onConfirm={() => { deleteItem('startups', deleting.id); setDeleting(null); }}
        title={`"${deleting?.name}" silinecek`} message="Son Silinenler'den geri getirebilirsin." />
    </div>
  );
}

function ProjectForm({ item, onClose, onSave, people }) {
  const blank = { name: '', slug: '', color: '#2563EB', stage: 'idea', logo: null, tagline_tr: '', tagline_en: '', desc_tr: '', desc_en: '', about_tr: '', about_en: '', problem_tr: '', problem_en: '', solution_tr: '', solution_en: '', tags: [], team: 1, openRoles: 0, website: '', demo: '', github: '', openRolesList_tr: [], openRolesList_en: [], featured: null, trending: null, isNew: null, leadId: '', memberIds: [], mentorId: '', metrics: [] };
  const [f, setF] = useStateP(item ? { ...blank, ...item } : blank);
  const [preview, setPreview] = useStateP(false);
  const [err, setErr] = useStateP('');
  const set = (k, v) => setF(prev => ({ ...prev, [k]: v }));
  const setMetric = (i, key, v) => setF(prev => {
    const metrics = [...(prev.metrics || [])];
    metrics[i] = { ...metrics[i], [key]: v };
    return { ...prev, metrics };
  });
  const addMetric = () => setF(prev => ({ ...prev, metrics: [...(prev.metrics || []), { label_tr: '', label_en: '', value: '' }] }));
  const removeMetric = (i) => setF(prev => ({ ...prev, metrics: (prev.metrics || []).filter((_, idx) => idx !== i) }));

  const stageOpts = Object.entries(PV_STAGE).map(([value, v]) => ({ value, label: v.label }));
  const peopleList = people || [];
  const mentorList = peopleList.filter(p => p.type === 'mentor');
  // Panelden "Proje Üyesi" olarak bu projeye bağlanan kişiler (memberIds'e eklenmemiş
  // olsalar bile) — ekip sayısına dahil edilmeleri için. Yeni (henüz id'si olmayan)
  // projelerde hiçbir proje üyesi bağlı olamayacağından bu her zaman 0'dır.
  const projectMembersOfThis = f.id ? peopleList.filter(p => p.type === 'project_member' && p.projectId === f.id) : [];
  const autoTeamCount = (f.leadId ? 1 : 0) + (f.memberIds || []).length + projectMembersOfThis.length;
  // "Açık Rol" sayısı ile "Açık Pozisyonlar" listesi ayrı ayrı elle girilirse
  // birbirinden kopabiliyordu (site bir tarafta sayıyı, diğer tarafta listeyi
  // gösteriyor, tutarsızlık "açık pozisyon var" ile "yok" çelişkisi yaratıyordu).
  // Artık sayı her zaman listeden türetiliyor, elle girilemiyor.
  const autoOpenRoles = (f.openRolesList_tr || []).length;

  const [saving, setSaving] = useStateP(false);

  const submit = async () => {
    if (!f.name.trim() || !f.slug.trim()) { setErr('Proje adı ve slug zorunludur — boş proje yayınlanamaz.'); return; }
    setErr(''); setSaving(true);
    try { await onSave({ ...f, team: autoTeamCount || f.team, openRoles: autoOpenRoles }); }
    catch (e) { setErr(e?.message || 'Kaydedilemedi — lütfen tekrar dene.'); }
    finally { setSaving(false); }
  };

  return (
    <Modal open onClose={onClose} title={item ? `${item.name} Düzenle` : 'Yeni Proje'} wide
      headerExtra={<PreviewToggle on={preview} onClick={() => setPreview(p => !p)} />}>
      {preview ? <ProjectPreview f={f} /> : (
      <form onSubmit={e => { e.preventDefault(); submit(); }} className="adm-form">
        <div style={{ display: 'flex', gap: 18, alignItems: 'flex-start', marginBottom: 16 }}>
          <div>
            <label className="adm-field__label">Logo</label>
            <ImageUpload value={f.logo} onChange={v => set('logo', v)} size={84} shape="rounded" format="png" maxDim={400} />
          </div>
          <div style={{ flex: 1 }}>
            <div className="adm-form-grid">
              <Field label="Proje Adı" required><Input value={f.name} onChange={v => set('name', v)} placeholder="FinTrack" /></Field>
              <Field label="Slug" required><Input value={f.slug} onChange={v => set('slug', v)} placeholder="fintrack" /></Field>
            </div>
            <div className="adm-form-grid">
              <Field label="Marka Rengi"><Input type="color" value={f.color} onChange={v => set('color', v)} style={{ height: 42, padding: 4 }} /></Field>
              <Field label="Aşama"><Select value={f.stage} onChange={v => set('stage', v)} options={stageOpts} /></Field>
            </div>
          </div>
        </div>
        <Field label="Etiketler"><TagInput tags={f.tags || []} onChange={v => set('tags', v)} /></Field>
        <div className="adm-form-grid">
          <Field label="Slogan (TR)"><Input value={f.tagline_tr} onChange={v => set('tagline_tr', v)} /></Field>
          <Field label="Slogan (EN)"><Input value={f.tagline_en} onChange={v => set('tagline_en', v)} /></Field>
        </div>
        <div className="adm-form-grid">
          <Field label="Açıklama (TR)"><Textarea value={f.desc_tr} onChange={v => set('desc_tr', v)} /></Field>
          <Field label="Açıklama (EN)"><Textarea value={f.desc_en} onChange={v => set('desc_en', v)} /></Field>
        </div>
        <div className="adm-form-grid">
          <Field label="Detay (TR)"><Textarea value={f.about_tr} onChange={v => set('about_tr', v)} rows={4} /></Field>
          <Field label="Detay (EN)"><Textarea value={f.about_en} onChange={v => set('about_en', v)} rows={4} /></Field>
        </div>
        <div className="adm-form-grid">
          <Field label="Problem (TR)"><Textarea value={f.problem_tr} onChange={v => set('problem_tr', v)} /></Field>
          <Field label="Problem (EN)"><Textarea value={f.problem_en} onChange={v => set('problem_en', v)} /></Field>
        </div>
        <div className="adm-form-grid">
          <Field label="Çözüm (TR)"><Textarea value={f.solution_tr} onChange={v => set('solution_tr', v)} /></Field>
          <Field label="Çözüm (EN)"><Textarea value={f.solution_en} onChange={v => set('solution_en', v)} /></Field>
        </div>
        <div className="adm-form-grid adm-form-grid--2">
          <Field label="Ekip (otomatik)" hint="Lider + üyeler + bu projeye bağlı proje üyelerinden hesaplanır"><Input type="number" value={autoTeamCount || f.team} disabled /></Field>
          <Field label="Açık Rol (otomatik)" hint="Aşağıdaki 'Açık Pozisyonlar' listesinden hesaplanır"><Input type="number" value={autoOpenRoles} disabled /></Field>
        </div>

        {/* Ekip üyeleri editörü */}
        <div className="adm-team-edit">
          <div className="adm-field__label" style={{ marginBottom: 10, fontSize: 13 }}>Bu projeyi inşa eden ekip</div>
          <div className="adm-form-grid">
            <Field label="Ekip Lideri"><Select value={f.leadId} onChange={v => set('leadId', v)} placeholder="Seç..." options={peopleList.map(p => ({ value: p.id, label: p.name }))} /></Field>
            <Field label="Mentör"><Select value={f.mentorId} onChange={v => set('mentorId', v)} placeholder="Yok" options={mentorList.map(p => ({ value: p.id, label: p.name }))} /></Field>
          </div>
          <Field label="Ekip Üyeleri" hint="Birden fazla seçebilirsin">
            <PeoplePicker people={peopleList} selected={f.memberIds || []} onChange={v => set('memberIds', v)}
              excludeIds={[f.leadId, f.mentorId, ...projectMembersOfThis.map(p => p.id)].filter(Boolean)} />
          </Field>
          {f.id && (
            <Field label="Bu Projeye Bağlı Proje Üyeleri" hint="Ekip & Mentörler sayfasında 'Proje Üyesi' olarak bu projeye bağlanan kişiler — buradan değil, kişinin kendi formundan eklenir/kaldırılır">
              {projectMembersOfThis.length === 0 ? (
                <div style={{ fontSize: 13, color: 'var(--adm-text-dim)' }}>Henüz proje üyesi eklenmemiş.</div>
              ) : (
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
                  {projectMembersOfThis.map(p => (
                    <span key={p.id} style={{ display: 'inline-flex', alignItems: 'center', gap: 6, padding: '5px 10px 5px 5px', borderRadius: 999, background: 'var(--adm-bg)', border: '1px solid var(--adm-border-light)', fontSize: 13 }}>
                      <span style={{ width: 20, height: 20, borderRadius: '50%', background: p.color, color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 10, fontWeight: 700, overflow: 'hidden', flexShrink: 0 }}>
                        {p.photo ? <img src={p.photo} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} /> : p.name[0]}
                      </span>
                      {p.name}
                      {f.leadId === p.id && <AIcon name="star" size={11} />}
                    </span>
                  ))}
                </div>
              )}
            </Field>
          )}
        </div>

        <div className="adm-form-grid adm-form-grid--3">
          <Field label="Website"><Input value={f.website} onChange={v => set('website', v)} placeholder="https://" /></Field>
          <Field label="Demo"><Input value={f.demo} onChange={v => set('demo', v)} placeholder="https://" /></Field>
          <Field label="GitHub"><Input value={f.github} onChange={v => set('github', v)} placeholder="https://" /></Field>
        </div>

        {/* Metrikler editörü */}
        <div className="adm-team-edit">
          <div className="adm-field__label" style={{ marginBottom: 4, fontSize: 13 }}>Proje Metrikleri</div>
          <div style={{ fontSize: 12, color: 'var(--adm-text-dim)', marginBottom: 10 }}>Proje detay sayfasındaki "Metrikler" kartında gösterilir (ör. Kullanıcı: 8.4K, Aylık Büyüme: %22).</div>
          {(f.metrics || []).map((m, i) => (
            <div key={i} style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 110px 32px', gap: 8, marginBottom: 8, alignItems: 'center' }}>
              <Input value={m.label_tr || ''} onChange={v => setMetric(i, 'label_tr', v)} placeholder="Etiket (TR) — ör. Kullanıcı" />
              <Input value={m.label_en || ''} onChange={v => setMetric(i, 'label_en', v)} placeholder="Etiket (EN) — ör. Users" />
              <Input value={m.value || ''} onChange={v => setMetric(i, 'value', v)} placeholder="Değer — 8.4K" />
              <button type="button" className="adm-icon-btn adm-icon-btn--danger" onClick={() => removeMetric(i)} title="Sil"><AIcon name="x" size={14} /></button>
            </div>
          ))}
          <button type="button" className="adm-btn adm-btn--ghost adm-btn--sm" onClick={addMetric}>
            <AIcon name="plus" size={14} /> Metrik Ekle
          </button>
        </div>
        <div className="adm-form-grid adm-form-grid--3">
          <Field label="Öne Çıkan" hint="Hero'da gösterilir · en fazla 1"><TriToggle value={f.featured} onChange={v => set('featured', v)} /></Field>
          <Field label="Trend"><TriToggle value={f.trending} onChange={v => set('trending', v)} /></Field>
          <Field label="Yeni"><TriToggle value={f.isNew} onChange={v => set('isNew', v)} /></Field>
        </div>
        <Field label="Açık Pozisyonlar (TR)" hint="Virgülle ayır: Flutter Geliştirici, UI/UX Tasarımcı">
          <Input value={(f.openRolesList_tr || []).join(', ')} onChange={v => set('openRolesList_tr', v.split(',').map(s => s.trim()).filter(Boolean))} />
        </Field>
        <Field label="Açık Pozisyonlar (EN)">
          <Input value={(f.openRolesList_en || []).join(', ')} onChange={v => set('openRolesList_en', v.split(',').map(s => s.trim()).filter(Boolean))} />
        </Field>
        <div className="adm-form__footer">
          {err && <span className="adm-form__err">{err}</span>}
          <button type="button" className="adm-btn adm-btn--ghost" onClick={onClose} disabled={saving}>İptal</button>
          <button type="submit" className="adm-btn adm-btn--primary" disabled={saving}>
            <AIcon name="save" size={16} /> {saving ? 'Kaydediliyor…' : 'Kaydet'}
          </button>
        </div>
      </form>
      )}
    </Modal>
  );
}

function toSlug(str) {
  return (str || '').toLowerCase()
    .replace(/ğ/g,'g').replace(/ü/g,'u').replace(/ş/g,'s')
    .replace(/ı/g,'i').replace(/ö/g,'o').replace(/ç/g,'c')
    .replace(/[^a-z0-9]+/g,'-').replace(/^-+|-+$/g,'');
}

// ============================================
// POSTS — 2 adımlı (önce içerik, sonra detaylar)
// ============================================
function PostsPage() {
  const { data, addItem, updateItem, deleteItem, clearFlagExcept, countFlag } = useAdmin();
  const [search, setSearch] = useStateP('');
  const [editing, setEditing] = useStateP(null);
  const [deleting, setDeleting] = useStateP(null);

  const filtered = useMemoP(() => {
    if (!search) return data.posts;
    const q = search.toLowerCase();
    return data.posts.filter(p => (p.title_tr || '').toLowerCase().includes(q) || (p.title_en || '').toLowerCase().includes(q));
  }, [data.posts, search]);

  const columns = [
    { key: 'title_tr', label: 'Başlık', render: (r) => (
      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
        <div className="adm-cell-cover" style={{ background: r.bg }}>{r.cover && <img src={r.cover} alt="" />}</div>
        <div><div style={{ fontWeight: 600, maxWidth: 280, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', display: 'flex', alignItems: 'center', gap: 6 }}>{r.title_tr}{r.recommended && <span className="adm-pill-rec">★</span>}{r.homePinned && <span className="adm-pill-home">⌂</span>}</div>
        <div style={{ fontSize: 12, color: 'var(--adm-text-dim)', maxWidth: 280, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{r.title_en}</div></div>
      </div>
    )},
    { key: 'tag', label: 'Kategori', style: { width: 100 }, render: (r) => <span className="adm-badge adm-badge--tag">{(PV_TAG[r.tag] || {}).label || r.tag}</span> },
    { key: 'authorId', label: 'Yazar', style: { width: 120 }, render: (r) => { const p = data.people.find(pp => pp.id === r.authorId); return p ? p.name : '—'; } },
    { key: 'date', label: 'Tarih', style: { width: 110 } },
    { key: 'status', label: 'Durum', style: { width: 110 }, render: (r) => {
      const s = r.status || 'published';
      const cfg = { published: { label: 'Yayında', color: 'var(--adm-green)', bg: 'var(--adm-green-light)' }, draft: { label: 'Taslak', color: 'var(--adm-text-dim)', bg: 'var(--adm-border-light)' }, rejected: { label: 'Reddedildi', color: 'var(--adm-red)', bg: 'var(--adm-red-light)' } };
      const { label, color, bg } = cfg[s] || cfg.published;
      return <span style={{ fontSize: 11, fontWeight: 600, padding: '3px 8px', borderRadius: 99, background: bg, color }}>{label}</span>;
    }},
  ];

  const handleSave = async (formData) => {
    const id = editing === 'new' ? parseInt(uid()) : editing.id;
    if (editing === 'new') await addItem('posts', { ...formData, id });
    else await updateItem('posts', id, formData);
    if (formData.homePinned === true) clearFlagExcept('posts', id, 'homePinned');
    setEditing(null);
  };

  return (
    <div>
      <PageHead title="Yazılar" desc={`${data.posts.length} yazı`} actions={
        <button className="adm-btn adm-btn--primary" onClick={() => setEditing('new')}><AIcon name="plus" size={16} /> Yeni Yazı</button>
      } />
      <div className="adm-card">
        <div className="adm-card__header"><SearchBar value={search} onChange={setSearch} placeholder="Yazı ara..." /></div>
        <div className="adm-card__body" style={{ padding: 0 }}>
          <DataTable columns={columns} data={filtered} onEdit={setEditing} onDelete={setDeleting} />
        </div>
      </div>
      {!!editing && <PostForm item={editing === 'new' ? null : editing} onClose={() => setEditing(null)} onSave={handleSave} people={data.people} startups={data.startups} recCount={countFlag('posts', 'recommended', editing === 'new' ? undefined : editing.id)} />}
      <ConfirmDialog open={!!deleting} onClose={() => setDeleting(null)} onConfirm={() => { deleteItem('posts', deleting.id); setDeleting(null); }}
        title="Yazı silinecek" message="Son Silinenler'den geri getirebilirsin." />
    </div>
  );
}

function PostForm({ item, onClose, onSave, people, startups, recCount }) {
  const blank = { slug: '', tag: 'blog', authorId: '', projectId: null, date: new Date().toISOString().slice(0,10), readTime: 5, bg: 'var(--blue-light)', cover: null, title_tr: '', title_en: '', excerpt_tr: '', excerpt_en: '', body_tr: [], body_en: [], source: null, recommended: false, homePinned: false, status: 'published', publishedAt: new Date().toISOString() };
  const [f, setF] = useStateP(item ? { ...blank, ...item } : blank);
  const [step, setStep] = useStateP(0);
  const [preview, setPreview] = useStateP(false);
  const [err, setErr] = useStateP('');
  const [saving, setSaving] = useStateP(false);
  const slugLocked = useRefP(!!item?.slug);

  const set = (k, v) => setF(prev => {
    const next = { ...prev, [k]: v };
    if (k === 'title_tr' && !slugLocked.current) next.slug = toSlug(v);
    return next;
  });
  const setSlug = (v) => { slugLocked.current = true; setF(prev => ({ ...prev, slug: v.toLowerCase().replace(/[^a-z0-9-]/g, '-') })); };

  const authorName = (people.find(p => p.id === f.authorId) || {}).name;
  const authors = people.filter(p => p.type === 'author' || p.type === 'team' || p.type === 'mentor');

  const contentValid = f.title_tr.trim() && f.excerpt_tr.trim() && (f.body_tr || []).length > 0;
  const goNext = () => {
    if (!contentValid) { setErr('Başlık, özet ve içerik zorunludur — boş yazı yayınlanamaz.'); return; }
    setErr(''); setStep(1);
  };
  const submit = async () => {
    if (!contentValid) { setErr('Başlık, özet ve içerik zorunludur — boş yazı yayınlanamaz.'); setStep(0); return; }
    if (!f.slug) { setErr('Slug boş olamaz — başlık girilince otomatik oluşur.'); setStep(0); return; }
    setSaving(true); setErr('');
    try {
      const payload = { ...f };
      if (payload.status === 'published' && !payload.publishedAt) {
        payload.publishedAt = new Date().toISOString();
      } else if (payload.status === 'draft' || payload.status === 'rejected') {
        payload.publishedAt = null;
      }
      await onSave(payload);
    } catch (e) {
      if (e.code === '23505' || (e.message || '').includes('duplicate') || (e.message || '').includes('unique')) {
        setErr('Bu slug zaten kullanılıyor, değiştirin.');
        setStep(0);
      } else {
        setErr('Kayıt başarısız: ' + (e.message || 'Bilinmeyen hata'));
      }
      setSaving(false);
    }
  };
  // Tavsiye Edilen max 3
  const toggleRec = (v) => {
    if (v && recCount >= 3) { setErr('En fazla 3 yazı "Tavsiye Edilen" olabilir. Önce birini kaldır.'); return; }
    setErr(''); set('recommended', v);
  };

  return (
    <Modal open onClose={onClose} title={item ? 'Yazı Düzenle' : 'Yeni Yazı'} wide
      headerExtra={<PreviewToggle on={preview} onClick={() => setPreview(p => !p)} />}>
      {preview ? <PostPreview f={f} authorName={authorName} /> : (
      <div className="adm-form">
        <Stepper steps={['İçerik', 'Detaylar & Görsel']} current={step} />

        {step === 0 && (
          <div style={{ marginTop: 18 }}>
            <Field label="Başlık (TR)" required><Input value={f.title_tr} onChange={v => set('title_tr', v)} placeholder="Yazının başlığı" /></Field>
            <Field label="Başlık (EN)"><Input value={f.title_en} onChange={v => set('title_en', v)} /></Field>
            <Field label="Slug (URL)" hint="Başlıktan otomatik oluşur, düzenleyebilirsin"><Input value={f.slug} onChange={setSlug} placeholder="yazi-basligi-buraya" /></Field>
            <Field label="Durum">
              <Select
                value={f.status || 'published'}
                onChange={v => set('status', v)}
                options={[
                  { value: 'published', label: 'Yayınlandı' },
                  { value: 'draft',     label: 'Taslak' },
                  { value: 'rejected',  label: 'Reddedildi' },
                ]}
              />
            </Field>
            {f.status === 'rejected' && (
              <div style={{ display: 'flex', alignItems: 'flex-start', gap: 10, padding: '10px 14px', background: 'var(--adm-orange-light, #fff7ed)', border: '1px solid var(--adm-orange, #f97316)', borderRadius: 8, marginBottom: 8, fontSize: 13, color: 'var(--adm-orange, #c2410c)' }}>
                <AIcon name="alertTriangle" size={16} style={{ marginTop: 1, flexShrink: 0 }} />
                <span>Bu yazı <strong>reddedildi</strong> — sitede görünmüyor. Yeniden yayınlamak için durumu "Yayınlandı"ya çevir ya da <strong>Otomasyon → Taslaklar → Reddedilenler</strong> sekmesindeki "Geri Al" akışını kullan.</span>
              </div>
            )}
            <div className="adm-form-grid">
              <Field label="Özet (TR)" required hint="Kartlarda ve giriş bölümünde görünür"><Textarea value={f.excerpt_tr} onChange={v => set('excerpt_tr', v)} /></Field>
              <Field label="Özet (EN)"><Textarea value={f.excerpt_en} onChange={v => set('excerpt_en', v)} /></Field>
            </div>
            <Field label="İçerik (TR)" required hint="Her paragraf ayrı satırda"><Textarea value={(f.body_tr || []).join('\n')} onChange={v => set('body_tr', v.split('\n').filter(Boolean))} rows={8} /></Field>
            <Field label="İçerik (EN)"><Textarea value={(f.body_en || []).join('\n')} onChange={v => set('body_en', v.split('\n').filter(Boolean))} rows={6} /></Field>
          </div>
        )}

        {step === 1 && (
          <div style={{ marginTop: 18 }}>
            <div style={{ display: 'flex', gap: 18, alignItems: 'flex-start', marginBottom: 8 }}>
              <div>
                <label className="adm-field__label">Kapak Görseli</label>
                <PostCoverUpload value={f.cover} onChange={v => set('cover', v)} postSlug={f.slug || ''} />
              </div>
              <div style={{ flex: 1 }}>
                <Field label="Kategori"><Select value={f.tag} onChange={v => set('tag', v)} options={[{value:'blog',label:'Blog'},{value:'gundem',label:'Gündem'}]} /></Field>
                <Field label="Yazar"><Select value={f.authorId} onChange={v => set('authorId', v)} placeholder="Seç..." options={authors.map(p => ({value:p.id,label:p.name}))} /></Field>
                <Field label="İlgili Proje"><Select value={f.projectId || ''} onChange={v => set('projectId', v ? parseInt(v) : null)} placeholder="Yok" options={startups.map(s => ({value:String(s.id),label:s.name}))} /></Field>
              </div>
            </div>
            <div className="adm-form-grid adm-form-grid--3">
              <Field label="Tarih"><Input type="date" value={f.date} onChange={v => set('date', v)} /></Field>
              <Field label="Okuma (dk)"><Input type="number" value={f.readTime} onChange={v => set('readTime', parseInt(v) || 0)} /></Field>
              <Field label="Kart Rengi"><Select value={f.bg} onChange={v => set('bg', v)} options={[{value:'var(--blue-light)',label:'Mavi'},{value:'var(--red-light)',label:'Kırmızı'},{value:'var(--green-light)',label:'Yeşil'},{value:'var(--purple-light)',label:'Mor'},{value:'var(--orange-light)',label:'Turuncu'}]} /></Field>
            </div>
            {f.tag === 'gundem' && (
              <div className="adm-form-grid">
                <Field label="Kaynak Adı" hint="Gündem yazıları için"><Input value={f.source?.name || ''} onChange={v => set('source', { ...(f.source||{}), name: v })} placeholder="TechCrunch" /></Field>
                <Field label="Kaynak URL"><Input value={f.source?.url || ''} onChange={v => set('source', { ...(f.source||{}), url: v })} placeholder="https://" /></Field>
              </div>
            )}

            {/* Sabitleme / Tavsiye */}
            <div className="adm-pin-box">
              <div className="adm-pin-row">
                <div>
                  <div className="adm-pin-row__title"><AIcon name="star" size={14} /> Tavsiye Edilen</div>
                  <div className="adm-pin-row__sub">Yazılar sayfasında öne çıkar · en fazla 3 ({recCount}/3 dolu)</div>
                </div>
                <label className="adm-switch">
                  <input type="checkbox" checked={!!f.recommended} onChange={e => toggleRec(e.target.checked)} />
                  <span></span>
                </label>
              </div>
              <div className="adm-pin-row">
                <div>
                  <div className="adm-pin-row__title"><AIcon name="dashboard" size={14} /> Ana Sayfada Sabitle</div>
                  <div className="adm-pin-row__sub">Ana sayfada en büyük kartta gösterilir · en fazla 1</div>
                </div>
                <label className="adm-switch">
                  <input type="checkbox" checked={!!f.homePinned} onChange={e => set('homePinned', e.target.checked)} />
                  <span></span>
                </label>
              </div>
            </div>
          </div>
        )}

        <div className="adm-form__footer">
          {err && <span className="adm-form__err">{err}</span>}
          {step === 1
            ? <button type="button" className="adm-btn adm-btn--ghost" onClick={() => setStep(0)}><AIcon name="arrowLeft" size={15} /> Geri</button>
            : <button type="button" className="adm-btn adm-btn--ghost" onClick={onClose}>İptal</button>}
          {step === 0
            ? <button type="button" className="adm-btn adm-btn--primary" onClick={goNext}>İleri <AIcon name="arrowRight" size={15} /></button>
            : <button type="button" className="adm-btn adm-btn--primary" onClick={submit} disabled={saving}><AIcon name={saving ? 'refresh' : 'save'} size={16} /> {saving ? 'Kaydediliyor…' : 'Kaydet'}</button>}
        </div>
      </div>
      )}
    </Modal>
  );
}

export { DashboardPage, ProjectsPage, PostsPage, STAT_META };
