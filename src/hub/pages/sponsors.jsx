// sponsors.jsx — Destekçiler (HR). Web sitesinin anasayfasındaki destekçi/
// ortak logo şeridini besler — admin panelden taşındı (yalnızca cofounder).
import React from 'react';
import { useState as useStateA, useEffect as useEffectA } from 'react';
import { supabase } from '../../lib/supabase';
import { AIcon, PageHead, Modal, Field, Input, Textarea, ImageUpload, ConfirmDialog } from '../../admin/admin-ui';
import { usePerms } from '../../lib/use-perms';

function nextSponsorId(list) {
  const normal = (list || []).map((x) => Number(x.id)).filter((n) => Number.isFinite(n) && n < 1e9);
  return (normal.length ? Math.max(...normal) : 0) + 1;
}

function SponsorForm({ item, onClose, onSave }) {
  const blank = { name: '', color: '#2563EB', logo: null, desc_tr: '', desc_en: '', url: '' };
  const [f, setF] = useStateA(item ? { ...blank, ...item } : blank);
  const set = (k, v) => setF((prev) => ({ ...prev, [k]: v }));
  const [saving, setSaving] = useStateA(false);
  const [err, setErr] = useStateA('');
  const submit = async () => {
    if (!f.name.trim()) { setErr('İsim zorunlu.'); return; }
    setErr(''); setSaving(true);
    try { await onSave(f); }
    catch (e) { setErr(e?.message || 'Kaydedilemedi — lütfen tekrar dene.'); }
    finally { setSaving(false); }
  };
  return (
    <Modal open onClose={onClose} title={item ? `${item.name} Düzenle` : 'Yeni Destekçi'}>
      <form onSubmit={(e) => { e.preventDefault(); submit(); }} className="adm-form">
        <div style={{ display: 'flex', gap: 16, alignItems: 'flex-start', marginBottom: 16 }}>
          <div>
            <label className="adm-field__label">Logo</label>
            <ImageUpload value={f.logo} onChange={(v) => set('logo', v)} size={84} shape="rounded" format="png" maxDim={400} />
          </div>
          <div style={{ flex: 1 }}>
            <Field label="İsim" required><Input value={f.name} onChange={(v) => set('name', v)} /></Field>
            <Field label="Marka Rengi"><Input type="color" value={f.color} onChange={(v) => set('color', v)} style={{ height: 42, padding: 4 }} /></Field>
          </div>
        </div>
        <Field label="Açıklama (TR)" hint="Destekçi hakkında kısa not"><Textarea value={f.desc_tr} onChange={(v) => set('desc_tr', v)} /></Field>
        <Field label="Açıklama (EN)"><Textarea value={f.desc_en} onChange={(v) => set('desc_en', v)} /></Field>
        <Field label="Website"><Input value={f.url} onChange={(v) => set('url', v)} placeholder="https://" /></Field>
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

export default function SponsorsPage() {
  const { can } = usePerms();
  const canWrite = can('sponsors.write');

  const [items, setItems] = useStateA([]);
  const [loading, setLoading] = useStateA(true);
  const [editing, setEditing] = useStateA(null);
  const [deleting, setDeleting] = useStateA(null);
  const [toast, setToast] = useStateA('');
  const flash = (m) => { setToast(m); setTimeout(() => setToast(''), 3000); };

  const load = () => {
    setLoading(true);
    supabase.from('sponsors').select('*').order('sort_order', { ascending: true, nullsFirst: false }).then(({ data, error }) => {
      if (error) { flash('Yüklenemedi: ' + error.message); setLoading(false); return; }
      setItems(data || []);
      setLoading(false);
    });
  };
  useEffectA(load, []);

  const handleSave = async (f) => {
    if (editing === 'new') {
      const row = { ...f, id: nextSponsorId(items) };
      const { data, error } = await supabase.from('sponsors').insert(row).select().single();
      if (error) throw error;
      setItems((prev) => [...prev, data]);
    } else {
      const { data, error } = await supabase.from('sponsors').update(f).eq('id', editing.id).select().single();
      if (error) throw error;
      setItems((prev) => prev.map((x) => (x.id === editing.id ? data : x)));
    }
    setEditing(null);
    flash('Kaydedildi — web sitesine yansıdı.');
  };

  const confirmDelete = async () => {
    const id = deleting.id;
    setDeleting(null);
    const { error } = await supabase.from('sponsors').delete().eq('id', id);
    if (error) { flash('Silinemedi: ' + error.message); return; }
    setItems((prev) => prev.filter((x) => x.id !== id));
    flash('Silindi.');
  };

  return (
    <div>
      <PageHead title="Destekçiler" desc={`${items.length} destekçi — web sitesi anasayfasındaki logo şeridi`} actions={
        canWrite && <button className="adm-btn adm-btn--primary" onClick={() => setEditing('new')}><AIcon name="plus" size={16} /> Yeni Destekçi</button>
      } />
      {toast && <div className="adm-toast">{toast}</div>}
      <div className="adm-card">
        <div className="adm-card__body">
          {loading ? (
            <div style={{ textAlign: 'center', padding: 32, color: 'var(--adm-text-dim)' }}>Yükleniyor…</div>
          ) : items.length === 0 ? (
            <div style={{ textAlign: 'center', padding: 32, color: 'var(--adm-text-dim)' }}>Henüz destekçi yok.</div>
          ) : (
            <div className="adm-people-grid">
              {items.map((s) => (
                <div key={s.id} className="adm-person-card">
                  <div className="adm-sponsor-logo" style={{ background: `color-mix(in srgb, ${s.color} 12%, #f5f5f5)`, color: s.color }}>
                    {s.logo ? <img src={s.logo} alt="" /> : s.name[0]}
                  </div>
                  <div className="adm-person-card__info">
                    <div className="adm-person-card__name">{s.name}</div>
                    {s.desc_tr && <div className="adm-person-card__role" style={{ whiteSpace: 'normal' }}>{s.desc_tr}</div>}
                  </div>
                  {canWrite && (
                    <div className="adm-person-card__actions">
                      <button className="adm-icon-btn" onClick={() => setEditing(s)}><AIcon name="edit" size={14} /></button>
                      <button className="adm-icon-btn adm-icon-btn--danger" onClick={() => setDeleting(s)}><AIcon name="trash" size={14} /></button>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
      {!!editing && <SponsorForm item={editing === 'new' ? null : editing} onClose={() => setEditing(null)} onSave={handleSave} />}
      <ConfirmDialog open={!!deleting} onClose={() => setDeleting(null)} onConfirm={confirmDelete}
        title={`"${deleting?.name}" silinecek`} message="Bu işlem geri alınamaz." />
    </div>
  );
}
