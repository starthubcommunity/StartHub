// showcase.jsx — Vitrin. YALNIZCA cofounder (showcase.write).
// Web sitesinde gösterilen proje kartının (logo, TR/EN slogan+açıklama,
// trend, yayında/gizli) düzenlendiği tek yer. Admin panelin proje
// formundaki bu alanlar buraya taşındı — startups tablosu ortak, admin
// panel geri kalan alanları (ekip, etiket, metrik, linkler) düzenlemeye
// devam eder.
import React, { useState, useEffect } from 'react';
import { AIcon, Field, Input, Textarea, ImageUpload, Modal, PageHead } from '../../admin/admin-ui';
import { supabase } from '../../lib/supabase';

const SHOWCASE_FIELDS = ['logo', 'tagline_tr', 'tagline_en', 'desc_tr', 'desc_en', 'trending', 'published'];

function pick(row) {
  const o = {};
  SHOWCASE_FIELDS.forEach((k) => { o[k] = row[k]; });
  return o;
}

function BoolToggle({ value, onChange, yesLabel, noLabel }) {
  return (
    <div className="adm-tri">
      <button type="button" className={`adm-tri__btn adm-tri__btn--yes ${value ? 'adm-tri__btn--active' : ''}`} onClick={() => onChange(true)}>{yesLabel}</button>
      <button type="button" className={`adm-tri__btn ${!value ? 'adm-tri__btn--active' : ''}`} onClick={() => onChange(false)}>{noLabel}</button>
    </div>
  );
}

function ShowcaseForm({ item, onClose, onSave }) {
  const [f, setF] = useState(() => pick(item));
  const [saving, setSaving] = useState(false);
  const set = (k, v) => setF((prev) => ({ ...prev, [k]: v }));

  const submit = async () => {
    setSaving(true);
    await onSave(f);
    setSaving(false);
  };

  return (
    <Modal open onClose={onClose} title={`${item.name} — Vitrin`} wide>
      <div className="adm-form">
        <div style={{ display: 'flex', gap: 18, alignItems: 'flex-start', marginBottom: 16 }}>
          <div>
            <label className="adm-field__label">Logo</label>
            <ImageUpload value={f.logo} onChange={(v) => set('logo', v)} size={84} shape="rounded" format="png" maxDim={400} />
          </div>
        </div>
        <div className="adm-form-grid">
          <Field label="Slogan (TR)"><Input value={f.tagline_tr || ''} onChange={(v) => set('tagline_tr', v)} /></Field>
          <Field label="Slogan (EN)"><Input value={f.tagline_en || ''} onChange={(v) => set('tagline_en', v)} /></Field>
        </div>
        <div className="adm-form-grid">
          <Field label="Açıklama (TR)"><Textarea value={f.desc_tr || ''} onChange={(v) => set('desc_tr', v)} /></Field>
          <Field label="Açıklama (EN)"><Textarea value={f.desc_en || ''} onChange={(v) => set('desc_en', v)} /></Field>
        </div>
        <div className="adm-form-grid">
          <Field label="Trend"><BoolToggle value={!!f.trending} onChange={(v) => set('trending', v)} yesLabel="Evet" noLabel="Hayır" /></Field>
          <Field label="Web Sitesinde Yayında mı?" hint="Kapalıysa proje sitede gösterilmez">
            <BoolToggle value={f.published !== false} onChange={(v) => set('published', v)} yesLabel="Evet, yayında" noLabel="Hayır, gizli" />
          </Field>
        </div>
        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, marginTop: 8 }}>
          <button type="button" className="adm-btn" onClick={onClose} disabled={saving}>Vazgeç</button>
          <button type="button" className="adm-btn adm-btn--primary" onClick={submit} disabled={saving}>{saving ? 'Kaydediliyor...' : 'Kaydet'}</button>
        </div>
      </div>
    </Modal>
  );
}

export default function ShowcasePage() {
  const [rows, setRows] = useState(null);
  const [editing, setEditing] = useState(null);
  const [toast, setToast] = useState('');
  const flash = (m) => { setToast(m); setTimeout(() => setToast(''), 3500); };

  const load = () => {
    supabase.from('startups').select('id,slug,name,logo,tagline_tr,tagline_en,desc_tr,desc_en,trending,published,team_app_id')
      .order('id').then(({ data, error }) => {
        if (error) { flash('Yüklenemedi: ' + error.message); return; }
        setRows(data || []);
      });
  };
  useEffect(load, []);

  const save = async (patch) => {
    const { error } = await supabase.from('startups').update(patch).eq('id', editing.id);
    if (error) { flash('Kaydedilemedi: ' + error.message); return; }
    setEditing(null);
    flash('Kaydedildi — web sitesine yansıdı.');
    load();
  };

  if (rows === null) return <div style={{ padding: 24, color: 'var(--adm-text-dim)' }}>Yükleniyor...</div>;

  return (
    <div>
      <PageHead title="Vitrin" desc="Web sitesinde gösterilen proje kartları — logo, slogan, açıklama, trend, yayın durumu" />
      {toast && <div className="adm-toast">{toast}</div>}
      <div className="adm-card">
        <div className="adm-card__body" style={{ padding: 0 }}>
          {rows.map((r) => (
            <div key={r.id} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '14px 18px', borderBottom: '1px solid var(--adm-border)' }}>
              <div className="adm-cell-logo" style={{ background: '#2563EB' }}>
                {r.logo ? <img src={r.logo} alt="" /> : r.name[0]}
              </div>
              <div style={{ flex: 1 }}>
                <div style={{ fontWeight: 600, display: 'flex', alignItems: 'center', gap: 8 }}>
                  {r.name}
                  {r.trending && <span className="adm-pill-featured">Trend</span>}
                  {r.published === false && <span className="adm-badge" style={{ background: 'var(--adm-text-dim)', color: '#fff' }}>Gizli</span>}
                  {!r.team_app_id && <span style={{ fontSize: 11.5, color: 'var(--adm-text-dim)' }}>· Team App'e eşlenmemiş</span>}
                </div>
                <div style={{ fontSize: 12.5, color: 'var(--adm-text-dim)' }}>{r.tagline_tr || '(slogan yok)'}</div>
              </div>
              <button className="adm-btn" onClick={() => setEditing(r)}><AIcon name="penEdit" size={15} /> Düzenle</button>
            </div>
          ))}
          {rows.length === 0 && <div style={{ padding: 24, color: 'var(--adm-text-dim)' }}>Henüz proje yok.</div>}
        </div>
      </div>
      {editing && <ShowcaseForm item={editing} onClose={() => setEditing(null)} onSave={save} />}
    </div>
  );
}
