// admin-pages2.jsx — People, Sponsors, Recently Deleted
import { useState as useStateP2, useMemo as useMemoP2 } from 'react';
import { useAdmin, uid, nextId, COLLECTIONS } from './admin-store';
import { AIcon, DataTable, Modal, Field, Input, Textarea, Select, ImageUpload, SearchBar, PageHead, ConfirmDialog, TagInput, PeoplePicker } from './admin-ui';
import { usePerms } from '../lib/use-perms';

// ============================================
// PEOPLE — ekip / mentör / yazar
// ============================================
const PERSON_TYPES = { team: 'Ekip', project_member: 'Proje Üyesi', mentor: 'Mentör', author: 'Yazar' };

function PeoplePage() {
  const { data, addItem, updateItem, deleteItem } = useAdmin();
  const { can } = usePerms();
  const [search, setSearch] = useStateP2('');
  const [filter, setFilter] = useStateP2('all');
  const [editing, setEditing] = useStateP2(null);
  const [deleting, setDeleting] = useStateP2(null);

  const filtered = useMemoP2(() => {
    let list = data.people;
    if (filter !== 'all') list = list.filter(p => p.type === filter);
    if (search) { const q = search.toLowerCase(); list = list.filter(p => p.name.toLowerCase().includes(q)); }
    return list;
  }, [data.people, search, filter]);

  const handleSave = async (formData) => {
    const { isProjectLead, ...personData } = formData;
    if (editing === 'new') await addItem('people', personData);
    else await updateItem('people', editing.id, personData);

    // Proje üyesi "bu projenin ekip lideri" olarak işaretlendiyse/işareti
    // kaldırıldıysa, ilgili startup'ın lead_id'sini de güncelle. Kısmi obje
    // değil TÜM startup kaydı gönderiliyor — mapStartupToDb eksik alanları
    // varsayılana sıfırlıyor, bu yüzden mevcut proje objesi olduğu gibi
    // (sadece leadId değişmiş) geri yazılıyor.
    if (personData.type === 'project_member' && personData.projectId) {
      const proj = data.startups.find(s => s.id === personData.projectId);
      if (proj) {
        const isCurrentLead = proj.leadId === personData.id;
        if (isProjectLead && !isCurrentLead) {
          await updateItem('startups', proj.id, { ...proj, leadId: personData.id });
        } else if (!isProjectLead && isCurrentLead) {
          await updateItem('startups', proj.id, { ...proj, leadId: '' });
        }
      }
    }
    setEditing(null);
  };

  return (
    <div>
      <PageHead title="Ekip & Mentörler" desc={`${data.people.length} kişi`} actions={
        <button className="adm-btn adm-btn--primary" onClick={() => setEditing('new')}><AIcon name="plus" size={16} /> Yeni Kişi</button>
      } />
      <div className="adm-card">
        <div className="adm-card__header" style={{ display: 'flex', gap: 12, alignItems: 'center', flexWrap: 'wrap' }}>
          <SearchBar value={search} onChange={setSearch} placeholder="İsim ara..." />
          <div style={{ display: 'flex', gap: 6 }}>
            {['all', 'team', 'project_member', 'mentor', 'author'].map(ff => (
              <button key={ff} className={`adm-chip ${filter === ff ? 'adm-chip--active' : ''}`} onClick={() => setFilter(ff)}>
                {ff === 'all' ? 'Tümü' : PERSON_TYPES[ff]}
              </button>
            ))}
          </div>
        </div>
        <div className="adm-card__body">
          <div className="adm-people-grid">
            {filtered.map(p => (
              <div key={p.id} className="adm-person-card">
                <div className="adm-person-card__avatar" style={{ background: p.color }}>
                  {p.photo ? <img src={p.photo} alt="" /> : <span>{p.name[0]}</span>}
                </div>
                <div className="adm-person-card__info">
                  <div className="adm-person-card__name">{p.name}</div>
                  <div className="adm-person-card__role">{p.role_tr}</div>
                  <span className={`adm-badge adm-badge--${p.type === 'mentor' ? 'mentor' : p.type === 'author' ? 'tag' : p.type === 'project_member' ? 'building' : 'team'}`}>
                    {PERSON_TYPES[p.type] || p.type}{p.type === 'team' && p.tier ? ` · T${p.tier}` : ''}
                  </span>
                  {p.type === 'project_member' && p.projectId && (
                    <div style={{ fontSize: 11.5, color: 'var(--adm-text-dim)', marginTop: 4 }}>
                      {data.startups.find(s => s.id === p.projectId)?.name || `#${p.projectId}`}
                    </div>
                  )}
                </div>
                <div className="adm-person-card__actions">
                  <button className="adm-icon-btn" onClick={() => setEditing(p)}><AIcon name="edit" size={14} /></button>
                  {can('people.write') && <button className="adm-icon-btn adm-icon-btn--danger" onClick={() => setDeleting(p)}><AIcon name="trash" size={14} /></button>}
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
      {!!editing && <PersonForm item={editing === 'new' ? null : editing} onClose={() => setEditing(null)} onSave={handleSave} />}
      <ConfirmDialog open={!!deleting} onClose={() => setDeleting(null)} onConfirm={() => { deleteItem('people', deleting.id); setDeleting(null); }}
        title={`"${deleting?.name}" silinecek`} message="Son Silinenler'den geri getirebilirsin." />
    </div>
  );
}

function PersonForm({ item, onClose, onSave }) {
  const { data } = useAdmin();
  const blank = { id: uid(), name: '', role_tr: '', role_en: '', type: 'team', tier: 3, color: '#2563EB', photo: null, linkedin: '', bio_tr: '', bio_en: '', projectId: null, isProjectLead: false };
  const [f, setF] = useStateP2(() => {
    if (!item) return blank;
    const merged = { ...blank, ...item };
    if (merged.type === 'project_member' && merged.projectId) {
      const proj = data.startups.find(s => s.id === merged.projectId);
      merged.isProjectLead = proj?.leadId === merged.id;
    }
    return merged;
  });
  const set = (k, v) => setF(prev => ({ ...prev, [k]: v }));
  const [saving, setSaving] = useStateP2(false);
  const [err, setErr] = useStateP2('');

  const submit = async () => {
    if (f.type === 'project_member' && !f.projectId) { setErr('Proje üyesi için bir proje seçmelisin.'); return; }
    setErr(''); setSaving(true);
    try { await onSave(f); }
    catch (e) { setErr(e?.message || 'Kaydedilemedi — lütfen tekrar dene.'); }
    finally { setSaving(false); }
  };

  return (
    <Modal open onClose={onClose} title={item ? `${item.name} Düzenle` : 'Yeni Kişi'}>
      <form onSubmit={e => { e.preventDefault(); submit(); }} className="adm-form">
        <div style={{ display: 'flex', gap: 16, alignItems: 'flex-start', marginBottom: 16 }}>
          <div>
            <label className="adm-field__label">Profil Fotoğrafı</label>
            <ImageUpload value={f.photo} onChange={v => set('photo', v)} size={84} shape="circle" format="jpeg" maxDim={400} />
          </div>
          <div style={{ flex: 1 }}>
            <Field label="Ad Soyad" required><Input value={f.name} onChange={v => set('name', v)} /></Field>
            <Field label="Avatar Rengi" hint="Foto yoksa baş harf bu renkte görünür"><Input type="color" value={f.color} onChange={v => set('color', v)} style={{ height: 42, padding: 4 }} /></Field>
          </div>
        </div>
        <div className="adm-form-grid adm-form-grid--3">
          <Field label="ID"><Input value={f.id} onChange={v => set('id', v)} placeholder="can" /></Field>
          <Field label="Tür"><Select value={f.type} onChange={v => set('type', v)} options={Object.entries(PERSON_TYPES).map(([value, label]) => ({ value, label }))} /></Field>
          {f.type === 'team' && <Field label="Tier"><Select value={String(f.tier || 3)} onChange={v => set('tier', parseInt(v))} options={[{value:'1',label:'1 - Kurucu'},{value:'2',label:'2 - Lider'},{value:'3',label:'3 - Takım Lideri'}]} /></Field>}
          {f.type === 'project_member' && (
            <Field label="Bağlı Proje" required>
              <Select value={f.projectId ? String(f.projectId) : ''} onChange={v => set('projectId', v ? parseInt(v) : null)}
                options={data.startups.map(s => ({ value: String(s.id), label: s.name }))} placeholder="Proje seç…" />
            </Field>
          )}
        </div>
        {f.type === 'author' && (
          <div className="adm-note">
            <AIcon name="edit" size={14} /> Yazar olarak işaretlendi — yazı eklerken yazar listesinde görünür.
          </div>
        )}
        {f.type === 'project_member' && (
          <div className="adm-note">
            <AIcon name="rocket" size={14} /> Proje üyesi olarak işaretlendi — Hakkımızda'daki yönetim ekibinde görünmez, sadece bağlı olduğu projenin detay sayfasında listelenir.
          </div>
        )}
        {f.type === 'project_member' && f.projectId && (
          <label style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 10, marginBottom: 14, fontSize: 13, cursor: 'pointer' }}>
            <input type="checkbox" checked={!!f.isProjectLead} onChange={e => set('isProjectLead', e.target.checked)} style={{ accentColor: 'var(--adm-blue)', width: 15, height: 15 }} />
            Bu projenin ekip lideri
          </label>
        )}
        <div className="adm-form-grid">
          <Field label="Ünvan (TR)"><Input value={f.role_tr} onChange={v => set('role_tr', v)} placeholder={f.type === 'author' ? 'Konuk Yazar' : ''} /></Field>
          <Field label="Ünvan (EN)"><Input value={f.role_en} onChange={v => set('role_en', v)} /></Field>
        </div>
        <div className="adm-form-grid">
          <Field label="Bio (TR)"><Textarea value={f.bio_tr} onChange={v => set('bio_tr', v)} /></Field>
          <Field label="Bio (EN)"><Textarea value={f.bio_en} onChange={v => set('bio_en', v)} /></Field>
        </div>
        <Field label="LinkedIn"><Input value={f.linkedin} onChange={v => set('linkedin', v)} placeholder="https://linkedin.com/in/..." /></Field>
        <div className="adm-form__footer">
          {err && <span className="adm-form__err">{err}</span>}
          <button type="button" className="adm-btn adm-btn--ghost" onClick={onClose} disabled={saving}>İptal</button>
          <button type="submit" className="adm-btn adm-btn--primary" disabled={saving}>
            <AIcon name="save" size={16} /> {saving ? 'Kaydediliyor…' : 'Kaydet'}
          </button>
        </div>
      </form>
    </Modal>
  );
}

// Not: Destekçiler yönetimi (logo + açıklama) artık burada değil —
// Kurucu Hattı (HR) > Destekçiler sayfasından yapılıyor (bkz.
// src/hub/pages/sponsors.jsx). Aynı sponsors tablosu, aynı site render'ı
// (SponsorsMarquee) — sadece yönetim yeri değişti.

// ============================================
// RECENTLY DELETED — son silinenler
// ============================================
function TrashPage() {
  const { trash, restoreItem, purgeItem, emptyTrash, COLLECTIONS } = useAdmin();
  const [purging, setPurging] = useStateP2(null);

  const labelOf = (entry) => {
    const it = entry.item;
    return it.name || it.title_tr || it.role_tr || 'Kayıt';
  };
  const ago = (ts) => {
    const m = Math.floor((Date.now() - ts) / 60000);
    if (m < 1) return 'az önce'; if (m < 60) return `${m} dk önce`;
    const h = Math.floor(m / 60); if (h < 24) return `${h} sa önce`;
    return `${Math.floor(h / 24)} gün önce`;
  };

  return (
    <div>
      <PageHead title="Son Silinenler" desc={`${trash.length} kayıt · geri getirilebilir`} actions={
        trash.length > 0 && <button className="adm-btn adm-btn--ghost" onClick={emptyTrash}><AIcon name="trash" size={15} /> Tümünü Temizle</button>
      } />
      <div className="adm-card">
        <div className="adm-card__body" style={{ padding: trash.length ? 0 : 20 }}>
          {trash.length === 0 ? (
            <div className="adm-empty"><AIcon name="trash" size={40} style={{ opacity: 0.25 }} /><p>Silinen kayıt yok. Sildiğin projeler ve yazılar burada belirir.</p></div>
          ) : trash.map(entry => (
            <div key={entry._key} className="adm-list-item">
              <span className="adm-trash-type">{(COLLECTIONS[entry.collection] || {}).label || entry.collection}</span>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div className="adm-list-item__title">{labelOf(entry)}</div>
                <div className="adm-list-item__sub">{ago(entry.deletedAt)} silindi</div>
              </div>
              <button className="adm-btn adm-btn--ghost adm-btn--sm" onClick={() => restoreItem(entry._key)}><AIcon name="restore" size={14} /> Geri Getir</button>
              <button className="adm-icon-btn adm-icon-btn--danger" title="Kalıcı sil" onClick={() => setPurging(entry)}><AIcon name="trash" size={15} /></button>
            </div>
          ))}
        </div>
      </div>
      <ConfirmDialog open={!!purging} onClose={() => setPurging(null)} onConfirm={() => { purgeItem(purging._key); setPurging(null); }}
        title="Kalıcı olarak silinecek" message="Bu işlem geri alınamaz." />
    </div>
  );
}

export { PeoplePage, TrashPage, PersonForm, PERSON_TYPES };
