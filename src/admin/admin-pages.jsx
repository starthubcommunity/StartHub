// admin-pages.jsx — Dashboard, Projects, Posts
import { useState as useStateP, useEffect as useEffectP, useMemo as useMemoP, useRef as useRefP } from 'react';
import { useAdmin, uid, nextId, COLLECTIONS } from './admin-store';
import { AIcon, StatCard, DataTable, Modal, Field, Input, Textarea, Select, ImageUpload, PostCoverUpload, SearchBar, PageHead, ConfirmDialog, TagInput, TriToggle, Stepper } from './admin-ui';
import { ProjectPreview, PostPreview, PreviewToggle, PV_STAGE, PV_TAG } from './admin-previews';
import { usePerms } from '../lib/use-perms';
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
                  <div className="adm-list-item__sub">{s.team} kişi{(s.openRolesLive || []).length > 0 ? ` · ${s.openRolesLive.length} açık rol` : ''}</div>
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
  const { can } = usePerms();
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
        <div><div style={{ fontWeight: 600, display: 'flex', alignItems: 'center', gap: 6 }}>{r.name}{r.featured && <span className="adm-pill-featured">★ Öne Çıkan</span>}{r.published === false && <span className="adm-badge" style={{ background: 'var(--adm-text-dim)', color: '#fff' }}>Gizli</span>}</div><div style={{ fontSize: 12, color: 'var(--adm-text-dim)' }}>{r.tagline_tr}</div></div>
      </div>
    )},
    { key: 'stage', label: 'Aşama', render: (r) => <span className={`adm-badge adm-badge--${r.stage}`}>{(PV_STAGE[r.stage] || {}).label || r.stage}</span> },
    { key: 'team', label: 'Ekip', style: { width: 70 }, render: (r) => new Set([
      ...(r.leadId ? [r.leadId] : []),
      ...(r.memberIds || []),
      ...data.people.filter(p => p.type === 'project_member' && p.projectId === r.id).map(p => p.id),
    ]).size },
    { key: 'openRoles', label: 'Açık Rol', style: { width: 90 }, render: (r) => (r.openRolesLive || []).length },
  ];

  const handleSave = async (formData) => {
    const id = editing === 'new' ? nextId(data.startups) : editing.id;
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
          <DataTable columns={columns} data={filtered} onEdit={setEditing} onDelete={can('projects.write') ? setDeleting : undefined} />
        </div>
      </div>
      {!!editing && <ProjectForm item={editing === 'new' ? null : editing} onClose={() => setEditing(null)} onSave={handleSave} people={data.people} />}
      <ConfirmDialog open={!!deleting} onClose={() => setDeleting(null)} onConfirm={() => { deleteItem('startups', deleting.id); setDeleting(null); }}
        title={`"${deleting?.name}" silinecek`} message="Son Silinenler'den geri getirebilirsin." />
    </div>
  );
}

function ProjectForm({ item, onClose, onSave, people }) {
  const { updateItem: updatePersonLink } = useAdmin();
  const blank = { name: '', slug: '', color: '#2563EB', stage: 'idea', logo: null, tagline_tr: '', tagline_en: '', desc_tr: '', desc_en: '', about_tr: '', about_en: '', problem_tr: '', problem_en: '', solution_tr: '', solution_en: '', tags: [], team: 1, openRoles: 0, website: '', demo: '', github: '', openRolesList_tr: [], openRolesList_en: [], featured: null, trending: null, isNew: null, published: true, leadId: '', memberIds: [], mentorId: '', metrics: [] };
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
  // Bu projeye eklenebilecek, tur "Proje Uyesi" olan ama henuz bu projeye
  // bagli olmayan kisiler (baska projeye bagli olabilir ya da bos olabilir).
  const availableProjectMembers = f.id ? peopleList.filter(p => p.type === 'project_member' && p.projectId !== f.id) : [];
  // Set kullanmamizin sebebi: lider AYNI ZAMANDA proje uyesi olabilir
  // (bkz. PersonForm'daki "Bu projenin ekip lideri" checkbox'i). Bu durumda
  // toplama ayri ayri eklersek ayni kisi iki kez sayilir (4 kisi 6 gorunur).
  const autoTeamIds = new Set([
    ...(f.leadId ? [f.leadId] : []),
    ...(f.memberIds || []),
    ...projectMembersOfThis.map(p => p.id),
  ]);
  const autoTeamCount = autoTeamIds.size;
  // Ekip Lideri artik yalnizca bu projenin proje uyeleri arasindan secilir.
  // Mevcut lider proje uyesi degilse (eski memberIds sisteminden geliyorsa)
  // listeden sessizce dusmesin diye ayri isaretle ekleniyor.
  const currentLeadPerson = f.leadId ? peopleList.find(p => p.id === f.leadId) : null;
  const leadIsProjectMember = !!currentLeadPerson && projectMembersOfThis.some(p => p.id === currentLeadPerson.id);
  const leadOptions = [
    ...projectMembersOfThis.map(p => ({ value: p.id, label: p.name })),
    ...(currentLeadPerson && !leadIsProjectMember ? [{ value: currentLeadPerson.id, label: `${currentLeadPerson.name} (eski sistem)` }] : []),
  ];
  const [memberBusy, setMemberBusy] = useStateP(null);
  const linkProjectMember = async (personId) => {
    const person = peopleList.find(p => p.id === personId);
    if (!person || !f.id) return;
    setMemberBusy(personId);
    try { await updatePersonLink('people', person.id, { ...person, projectId: f.id }); }
    catch (e) { setErr(e?.message || 'Eklenemedi — lütfen tekrar dene.'); }
    finally { setMemberBusy(null); }
  };
  const unlinkProjectMember = async (person) => {
    setMemberBusy(person.id);
    try { await updatePersonLink('people', person.id, { ...person, projectId: null }); }
    catch (e) { setErr(e?.message || 'Çıkarılamadı — lütfen tekrar dene.'); }
    finally { setMemberBusy(null); }
  };
  const [saving, setSaving] = useStateP(false);

  const submit = async () => {
    if (!f.name.trim() || !f.slug.trim()) { setErr('Proje adı ve slug zorunludur — boş proje yayınlanamaz.'); return; }
    setErr(''); setSaving(true);
    // openRoles/openRolesList artık Kurucu Hattı'ndan (hub_open_roles) türetiliyor,
    // bu form onları hiç göndermiyor — kolonlar drop edilmedi (0021), sadece
    // buradan bir daha yazılmıyor.
    try { await onSave({ ...f, team: autoTeamCount || f.team }); }
    catch (e) { setErr(e?.message || 'Kaydedilemedi — lütfen tekrar dene.'); }
    finally { setSaving(false); }
  };

  return (
    <Modal open onClose={onClose} title={item ? `${item.name} Düzenle` : 'Yeni Proje'} wide
      headerExtra={<PreviewToggle on={preview} onClick={() => setPreview(p => !p)} />}>
      {preview ? <ProjectPreview f={f} teamCount={autoTeamCount} /> : (
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
        <Field label="Web Sitesinde Yayında mı?" hint="Kapalıysa proje yalnızca admin panel/Kurucu Hattı'nda görünür — ana sayfa ve proje detayından gizlenir. Arka planda yönetilen projeler için kapatın.">
          <div className="adm-tri">
            <button type="button" className={`adm-tri__btn adm-tri__btn--yes ${f.published !== false ? 'adm-tri__btn--active' : ''}`} onClick={() => set('published', true)}>Evet, yayında</button>
            <button type="button" className={`adm-tri__btn ${f.published === false ? 'adm-tri__btn--active' : ''}`} onClick={() => set('published', false)}>Hayır, gizli</button>
          </div>
        </Field>
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
        <Field label="Ekip (otomatik)" hint="Lider + üyeler + bu projeye bağlı proje üyelerinden hesaplanır"><Input type="number" value={autoTeamCount || f.team} disabled style={{ maxWidth: 160 }} /></Field>
        <Field label="Team App Ekip ID" hint="Ekip Paneli'ndeki (/team/) ekip id'si — ör. 'A', 'B', 'C', 'BD'. Boşsa Kurucu Hattı'ndan bu projeye işe alınan adaylar Ekip Paneli'ne otomatik eklenmez.">
          <Input value={f.teamAppId || ''} onChange={v => set('teamAppId', v.toUpperCase().trim())} placeholder="A" style={{ maxWidth: 160 }} />
        </Field>

        {/* Ekip üyeleri editörü */}
        <div className="adm-team-edit">
          <div className="adm-field__label" style={{ marginBottom: 10, fontSize: 13 }}>Bu projeyi inşa eden ekip</div>
          <div className="adm-form-grid">
            <Field label="Ekip Lideri" hint="Yalnızca bu projenin proje üyeleri arasından seçilir">
              <Select value={f.leadId} onChange={v => set('leadId', v)} placeholder="Seç..." options={leadOptions} />
            </Field>
            <Field label="Mentör"><Select value={f.mentorId} onChange={v => set('mentorId', v)} placeholder="Yok" options={mentorList.map(p => ({ value: p.id, label: p.name }))} /></Field>
          </div>
          {!f.id ? (
            <Field label="Ekip Üyeleri">
              <div style={{ fontSize: 12.5, color: 'var(--adm-text-dim)' }}>Önce projeyi kaydet, sonra ekip üyesi ekleyebilirsin.</div>
            </Field>
          ) : (
            <>
              <Field label="Eklenebilir Proje Üyeleri" hint="Yalnızca türü 'Proje Üyesi' olan kişiler listelenir — bir karta tıklamak onu anında bu projeye ekler">
                {availableProjectMembers.length === 0 ? (
                  <div style={{ fontSize: 13, color: 'var(--adm-text-dim)' }}>
                    {projectMembersOfThis.length === 0
                      ? 'Eklenebilecek proje üyesi yok — Ekip & Mentörler sayfasından tür "Proje Üyesi" olan bir kişi oluştur.'
                      : 'Eklenebilecek başka proje üyesi yok.'}
                  </div>
                ) : (
                  <div className="adm-picker">
                    {availableProjectMembers.map(p => (
                      <button type="button" key={p.id} className="adm-picker__chip" onClick={() => linkProjectMember(p.id)} disabled={memberBusy === p.id} style={{ opacity: memberBusy === p.id ? 0.6 : 1 }}>
                        <span className="adm-picker__av" style={{ background: p.color }}>
                          {p.photo ? <img src={p.photo} alt="" /> : p.name[0]}
                        </span>
                        <span>{p.name}</span>
                      </button>
                    ))}
                  </div>
                )}
              </Field>
              <Field label="Bu Projeye Bağlı Üyeler" hint="Bir karta tıklamak onu anında projeden çıkarır">
                {projectMembersOfThis.length === 0 ? (
                  <div style={{ fontSize: 13, color: 'var(--adm-text-dim)' }}>Henüz proje üyesi eklenmemiş.</div>
                ) : (
                  <div className="adm-picker">
                    {projectMembersOfThis.map(p => (
                      <button type="button" key={p.id} className="adm-picker__chip adm-picker__chip--on" onClick={() => unlinkProjectMember(p)} disabled={memberBusy === p.id} style={{ opacity: memberBusy === p.id ? 0.6 : 1 }}>
                        <span className="adm-picker__av" style={{ background: p.color }}>
                          {p.photo ? <img src={p.photo} alt="" /> : p.name[0]}
                        </span>
                        <span>{p.name}</span>
                        {f.leadId === p.id && <AIcon name="star" size={11} />}
                        <AIcon name="check" size={13} />
                      </button>
                    ))}
                  </div>
                )}
              </Field>
            </>
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
        <div className="adm-field" style={{ background: 'var(--adm-bg-2)', borderRadius: 10, padding: '10px 13px', fontSize: 12.5, color: 'var(--adm-text-dim)' }}>
          Açık pozisyonlar artık burada elle yazılmıyor — Kurucu Hattı'ndaki "Açık Pozisyonlar" (Roller) sayfasından bu projeye bağlı, "Aranıyor"/"Aday sunuldu" durumundaki roller siteye otomatik yansır.
        </div>
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
  const { data, addItem, updateItem, deleteItem, patchLocal, clearFlagExcept, countFlag } = useAdmin();
  const { can } = usePerms();
  const [search, setSearch] = useStateP('');
  const [statusFilter, setStatusFilter] = useStateP('all');
  const [editing, setEditing] = useStateP(null);
  const [deleting, setDeleting] = useStateP(null);
  const [toast, setToast] = useStateP(null);
  const [linkedinBusy, setLinkedinBusy] = useStateP({}); // {postId: true} — istek sürerken çift tıkı/yarışı önler
  const [turnOffConfirm, setTurnOffConfirm] = useStateP(null); // zaten paylaşılmış bir yazıda kapatma onayı bekleyen post
  const [repostConfirm, setRepostConfirm] = useStateP(null); // "LinkedIn'den sildim, yeniden paylaş" onayı bekleyen post

  const flash = (msg, kind = 'green') => {
    setToast({ msg, kind });
    setTimeout(() => setToast(null), 3500);
  };

  const STATUS_FILTERS = [
    { key: 'all',      label: 'Tümü' },
    { key: 'published', label: 'Yayında' },
    { key: 'draft',      label: 'Taslak' },
    { key: 'rejected',   label: 'Reddedildi' },
  ];

  const filtered = useMemoP(() => {
    let list = data.posts;
    if (statusFilter !== 'all') list = list.filter(p => (p.status || 'published') === statusFilter);
    if (search) {
      const q = search.toLowerCase();
      list = list.filter(p => (p.title_tr || '').toLowerCase().includes(q) || (p.title_en || '').toLowerCase().includes(q));
    }
    return list;
  }, [data.posts, search, statusFilter]);

  // Gerçek toggle: local state'i anında günceller (optimistic), sonra Supabase'e yazar.
  // İstek başarısız olursa önceki değere geri döner.
  const applyLinkedinToggle = async (r, next) => {
    setLinkedinBusy(prev => ({ ...prev, [r.id]: true }));
    patchLocal('posts', r.id, { linkedinShare: next });
    try {
      await updateItem('posts', r.id, { ...r, linkedinShare: next });
      flash(next ? 'LinkedIn paylaşımı açıldı.' : 'LinkedIn paylaşımı kapatıldı.');
    } catch (e) {
      patchLocal('posts', r.id, { linkedinShare: r.linkedinShare }); // rollback
      flash('İşlem başarısız: ' + (e.message || 'Bilinmeyen hata'), 'orange');
    } finally {
      setLinkedinBusy(prev => { const n = { ...prev }; delete n[r.id]; return n; });
    }
  };

  const toggleLinkedinShare = (r) => {
    if (linkedinBusy[r.id]) return;
    const next = !r.linkedinShare;
    // linkedin_posted=true iken KAPATMA girişimi — geri alınamaz sonuçları olabileceği
    // için önce onay iste. Açma (next=true) veya henüz paylaşılmamış yazılarda onaya gerek yok.
    if (!next && r.linkedinPosted) {
      setTurnOffConfirm(r);
      return;
    }
    applyLinkedinToggle(r, next);
  };

  const confirmTurnOff = () => {
    const r = turnOffConfirm;
    setTurnOffConfirm(null);
    if (r) applyLinkedinToggle(r, false);
  };

  // Yazı LinkedIn'de "yayında" görünüyor ama gönderi LinkedIn'den elle silindiyse,
  // yeniden paylaşılabilmesi lazım. Make.com'daki Filter adımı şu dört koşulu ARADA
  // birlikte istiyor: record.linkedin_share=true, record.status=published,
  // record.linkedin_posted=false, VE old_record.linkedin_share != true — yani
  // linkedin_share'in gerçekten false'tan true'ya GEÇTİĞİ anı (yükselen kenar)
  // arıyor, sadece "şu an true olması" yetmiyor. linkedin_share zaten true
  // olduğu için tek adımda posted:false yazmak old_record.linkedin_share'i de
  // true bırakıyor ve filtre hiç geçmiyordu. Bu yüzden önce false'a, sonra
  // (gerçek bir DB geçişi oluşacak şekilde) tekrar true'ya yazıyoruz — filtrenin
  // yinelenen-paylaşım korumasını bozmadan, gerçek bir "yeniden aç" olayı üretir.
  const resetLinkedinRepost = async (r) => {
    if (linkedinBusy[r.id]) return;
    setLinkedinBusy(prev => ({ ...prev, [r.id]: true }));
    try {
      patchLocal('posts', r.id, { linkedinShare: false, linkedinPosted: false });
      await updateItem('posts', r.id, { ...r, linkedinShare: false, linkedinPosted: false });
      await new Promise(resolve => setTimeout(resolve, 800));
      patchLocal('posts', r.id, { linkedinShare: true });
      await updateItem('posts', r.id, { ...r, linkedinShare: true, linkedinPosted: false });
      flash('Yeniden paylaşım için işaretlendi — birkaç dakika içinde LinkedIn\'de tekrar yayınlanır.');
    } catch (e) {
      patchLocal('posts', r.id, { linkedinShare: r.linkedinShare, linkedinPosted: r.linkedinPosted });
      flash('İşlem başarısız: ' + (e.message || 'Bilinmeyen hata'), 'orange');
    } finally {
      setLinkedinBusy(prev => { const n = { ...prev }; delete n[r.id]; return n; });
    }
  };
  const confirmRepost = () => {
    const r = repostConfirm;
    setRepostConfirm(null);
    if (r) resetLinkedinRepost(r);
  };

  const columns = [
    { key: 'title_tr', label: 'Başlık', render: (r) => (
      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
        <div className="adm-cell-cover" style={{ background: r.bg }}>{r.cover && <img src={r.cover} alt="" />}</div>
        <div><div style={{ fontWeight: 600, maxWidth: 280, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', display: 'flex', alignItems: 'center', gap: 6 }}>{r.title_tr}{r.recommended && <span className="adm-pill-rec">★</span>}{r.homePinned && <span className="adm-pill-home">⌂</span>}</div>
        <div style={{ fontSize: 12, color: 'var(--adm-text-dim)', maxWidth: 280, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{r.title_en}</div></div>
      </div>
    )},
    { key: 'tag', label: 'Kategori', style: { width: 100 }, render: (r) => <span className="adm-badge adm-badge--tag">{(PV_TAG[r.tag] || {}).label || r.tag}</span> },
    { key: 'authorId', label: 'Yazar', style: { width: 120 }, render: (r) => {
      if (r.guestAuthor?.name) return <span>{r.guestAuthor.name} <span style={{ color: 'var(--adm-text-dim)', fontSize: 11 }}>(misafir)</span></span>;
      const p = data.people.find(pp => pp.id === r.authorId);
      return p ? p.name : '—';
    } },
    { key: 'date', label: 'Tarih', style: { width: 110 } },
    { key: 'status', label: 'Durum', style: { width: 110 }, render: (r) => {
      const s = r.status || 'published';
      const cfg = { published: { label: 'Yayında', color: 'var(--adm-green)', bg: 'var(--adm-green-light)' }, draft: { label: 'Taslak', color: 'var(--adm-text-dim)', bg: 'var(--adm-border-light)' }, rejected: { label: 'Reddedildi', color: 'var(--adm-red)', bg: 'var(--adm-red-light)' } };
      const { label, color, bg } = cfg[s] || cfg.published;
      return <span style={{ fontSize: 11, fontWeight: 600, padding: '3px 8px', borderRadius: 99, background: bg, color }}>{label}</span>;
    }},
    { key: 'linkedin', label: 'LinkedIn', style: { width: 92, textAlign: 'center' }, tdStyle: { textAlign: 'center' }, render: (r) => {
      const busy = !!linkedinBusy[r.id];
      const statusTitle = !r.linkedinShare
        ? 'LinkedIn\'de paylaşmak için tıkla'
        : r.linkedinPosted
          ? 'LinkedIn\'de yayında — kapatmak için tıkla'
          : 'Paylaşım kuyrukta, birkaç dakika içinde LinkedIn\'de yayınlanacak — durdurmak için tıkla';
      return (
        <div style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}>
          <div style={{ position: 'relative', display: 'inline-flex' }}>
            <button
              className="adm-icon-btn"
              aria-pressed={!!r.linkedinShare}
              disabled={busy}
              title={statusTitle}
              onClick={() => toggleLinkedinShare(r)}
              style={{
                color: r.linkedinShare ? '#0A66C2' : 'var(--adm-text-dim)',
                background: r.linkedinShare ? 'rgba(10,102,194,0.1)' : 'transparent',
                opacity: busy ? 0.5 : 1,
                cursor: busy ? 'wait' : 'pointer',
              }}
            >
              {busy
                ? <span className="adm-spinner" style={{ width: 14, height: 14, borderColor: 'rgba(10,102,194,0.25)', borderTopColor: '#0A66C2' }}></span>
                : <AIcon name="linkedin" size={16} />}
            </button>
            {r.linkedinPosted && (
              <span
                title="LinkedIn'de yayınlandı"
                style={{ position: 'absolute', bottom: -2, right: -2, width: 12, height: 12, borderRadius: '50%', background: 'var(--adm-green)', display: 'flex', alignItems: 'center', justifyContent: 'center', border: '1.5px solid var(--adm-bg-card, #fff)' }}
              >
                <AIcon name="check" size={8} style={{ color: '#fff' }} />
              </span>
            )}
          </div>
          {r.linkedinPosted && (
            <button
              className="adm-icon-btn"
              disabled={busy}
              title="LinkedIn'de bu gönderiyi elle sildiysen, yeniden paylaşmak için tıkla"
              onClick={() => setRepostConfirm(r)}
              style={{ color: 'var(--adm-text-dim)', opacity: busy ? 0.5 : 1, cursor: busy ? 'wait' : 'pointer' }}
            >
              <AIcon name="refresh" size={14} />
            </button>
          )}
        </div>
      );
    }},
  ];

  const handleSave = async (formData) => {
    const id = editing === 'new' ? nextId(data.posts) : editing.id;
    if (editing === 'new') await addItem('posts', { ...formData, id });
    else await updateItem('posts', id, formData);
    if (formData.homePinned === true) clearFlagExcept('posts', id, 'homePinned');
    setEditing(null);
  };

  return (
    <div>
      {toast && (
        <div className="adm-auto-status" style={{
          background: toast.kind === 'orange' ? 'var(--adm-orange-light)' : 'var(--adm-green-light)',
          color: toast.kind === 'orange' ? 'var(--adm-orange)' : 'var(--adm-green)',
        }}>
          <AIcon name="check" size={14} /><span>{toast.msg}</span>
        </div>
      )}
      <PageHead title="Yazılar" desc={`${filtered.length} / ${data.posts.length} yazı`} actions={
        <button className="adm-btn adm-btn--primary" onClick={() => setEditing('new')}><AIcon name="plus" size={16} /> Yeni Yazı</button>
      } />
      <div className="adm-card">
        <div className="adm-card__header" style={{ display: 'flex', flexWrap: 'wrap', gap: 12, alignItems: 'center', justifyContent: 'space-between' }}>
          <SearchBar value={search} onChange={setSearch} placeholder="Yazı ara..." />
          <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
            {STATUS_FILTERS.map(f => (
              <button key={f.key} className={`adm-chip ${statusFilter === f.key ? 'adm-chip--active' : ''}`} onClick={() => setStatusFilter(f.key)}>
                {f.label}
              </button>
            ))}
          </div>
        </div>
        <div className="adm-card__body" style={{ padding: 0 }}>
          <DataTable columns={columns} data={filtered} onEdit={setEditing} onDelete={can('posts.delete') ? setDeleting : undefined} />
        </div>
      </div>
      {!!editing && <PostForm item={editing === 'new' ? null : editing} onClose={() => setEditing(null)} onSave={handleSave} people={data.people} startups={data.startups} recCount={countFlag('posts', 'recommended', editing === 'new' ? undefined : editing.id)} />}
      <ConfirmDialog open={!!deleting} onClose={() => setDeleting(null)} onConfirm={() => { deleteItem('posts', deleting.id); setDeleting(null); }}
        title="Yazı silinecek" message="Son Silinenler'den geri getirebilirsin." />

      {/* LinkedIn'de zaten paylaşılmış bir yazıda kapatma onayı.
          NOT (tasarım kararı): "Evet, kapat" SADECE linkedin_share bayrağını false yapar —
          LinkedIn'deki gerçek gönderiyi silmez/geri çekmez. Make.com senaryosu bu geçişi
          (posted=true iken share=false) izlememeli/repost etmemeli; gönderiyi gerçekten
          kaldırmak istenirse LinkedIn üzerinden elle silinmesi gerekir. */}
      {turnOffConfirm && (
        <Modal open onClose={() => setTurnOffConfirm(null)} title="LinkedIn paylaşımını kapat">
          <div style={{ textAlign: 'center', padding: '4px 4px 4px' }}>
            <div style={{ width: 48, height: 48, borderRadius: '50%', background: 'var(--adm-orange-light)', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 16px' }}>
              <AIcon name="alertTriangle" size={22} style={{ color: 'var(--adm-orange)' }} />
            </div>
            <p style={{ fontSize: 14, color: 'var(--adm-text-dim)', marginBottom: 24, lineHeight: 1.5 }}>
              Bu yazı LinkedIn'de zaten paylaşıldı. Kutucuğu kapatmak sadece buradaki takip
              bayrağını sıfırlar — LinkedIn'deki gönderiyi silmez. Gönderiyi kaldırmak
              isterseniz LinkedIn üzerinden elle silmeniz gerekir; sildikten sonra yeniden
              paylaşmak isterseniz yenileme (↻) ikonunu kullanabilirsiniz. Devam etmek
              istiyor musunuz?
            </p>
            <div style={{ display: 'flex', gap: 10, justifyContent: 'center' }}>
              <button className="adm-btn adm-btn--ghost" onClick={() => setTurnOffConfirm(null)}>Vazgeç</button>
              <button className="adm-btn adm-btn--danger" onClick={confirmTurnOff}>Evet, kapat</button>
            </div>
          </div>
        </Modal>
      )}

      {/* LinkedIn'de yayında görünen ama gerçekte LinkedIn üzerinden elle silinmiş
          bir gönderiyi yeniden paylaşabilmek için: sadece linkedin_posted bayrağını
          sıfırlar, Make.com senaryosunun yinelenen-paylaşım kontrolünü aşıp yeniden
          göndermesine izin verir. linkedin_share açık kalır. */}
      {repostConfirm && (
        <Modal open onClose={() => setRepostConfirm(null)} title="LinkedIn'de yeniden paylaş">
          <div style={{ textAlign: 'center', padding: '4px 4px 4px' }}>
            <div style={{ width: 48, height: 48, borderRadius: '50%', background: 'rgba(10,102,194,0.1)', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 16px' }}>
              <AIcon name="refresh" size={22} style={{ color: '#0A66C2' }} />
            </div>
            <p style={{ fontSize: 14, color: 'var(--adm-text-dim)', marginBottom: 24, lineHeight: 1.5 }}>
              Bu, "LinkedIn'de yayında" durumunu sıfırlar ve yazıyı yeniden paylaşım
              kuyruğuna alır — birkaç dakika içinde LinkedIn'de tekrar yayınlanır. Sadece
              gönderiyi LinkedIn'den kendiniz sildiyseniz kullanın; hâlâ yayındaysa
              yinelenen bir gönderi oluşur. Devam etmek istiyor musunuz?
            </p>
            <div style={{ display: 'flex', gap: 10, justifyContent: 'center' }}>
              <button className="adm-btn adm-btn--ghost" onClick={() => setRepostConfirm(null)}>Vazgeç</button>
              <button className="adm-btn adm-btn--primary" onClick={confirmRepost}>Evet, yeniden paylaş</button>
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
}

function PostForm({ item, onClose, onSave, people, startups, recCount }) {
  const blank = { slug: '', tag: 'blog', authorId: '', guestAuthor: null, projectId: null, date: new Date().toISOString().slice(0,10), readTime: 5, bg: 'var(--blue-light)', cover: null, title_tr: '', title_en: '', excerpt_tr: '', excerpt_en: '', body_tr: [], body_en: [], source: null, recommended: false, homePinned: false, status: 'published', publishedAt: new Date().toISOString() };
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

  const authorName = f.guestAuthor?.name || (people.find(p => p.id === f.authorId) || {}).name;
  const authors = people.filter(p => p.type === 'author' || p.type === 'team' || p.type === 'mentor');

  const contentValid = f.title_tr.trim() && f.excerpt_tr.trim() && (f.body_tr || []).length > 0;
  const goNext = () => {
    if (!contentValid) { setErr('Başlık, özet ve içerik zorunludur — boş yazı yayınlanamaz.'); return; }
    setErr(''); setStep(1);
  };
  const submit = async () => {
    if (!contentValid) { setErr('Başlık, özet ve içerik zorunludur — boş yazı yayınlanamaz.'); setStep(0); return; }
    if (!f.slug) { setErr('Slug boş olamaz — başlık girilince otomatik oluşur.'); setStep(0); return; }
    if (f.guestAuthor && !f.guestAuthor.name?.trim()) { setErr('Misafir yazarın adı zorunludur.'); setStep(1); return; }
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
                <Field label="Yazar">
                  <div className="adm-tri" style={{ marginBottom: 10, display: 'inline-flex' }}>
                    <button type="button" className={`adm-tri__btn ${!f.guestAuthor ? 'adm-tri__btn--active' : ''}`}
                      onClick={() => set('guestAuthor', null)}>Ekipten Seç</button>
                    <button type="button" className={`adm-tri__btn ${f.guestAuthor ? 'adm-tri__btn--active' : ''}`}
                      onClick={() => { set('authorId', ''); set('guestAuthor', f.guestAuthor || { name: '', title: '', avatar: '' }); }}>Misafir Yazar</button>
                  </div>
                  {!f.guestAuthor ? (
                    <Select value={f.authorId} onChange={v => set('authorId', v)} placeholder="Seç..." options={authors.map(p => ({value:p.id,label:p.name}))} />
                  ) : (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                      <Input value={f.guestAuthor.name} onChange={v => set('guestAuthor', { ...f.guestAuthor, name: v })} placeholder="Ad Soyad" />
                      <Input value={f.guestAuthor.title} onChange={v => set('guestAuthor', { ...f.guestAuthor, title: v })} placeholder="Unvan / Açıklama (örn. Konuk Yazar)" />
                      <Input value={f.guestAuthor.avatar} onChange={v => set('guestAuthor', { ...f.guestAuthor, avatar: v })} placeholder="Profil fotoğrafı URL (opsiyonel)" />
                    </div>
                  )}
                </Field>
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
