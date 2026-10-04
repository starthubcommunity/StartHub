// Görsel stoğu araçları: kategori × tip matrisi (boş hücreler) ve toplu tip düzenleme.
import React, { useMemo, useState } from 'react';
import { supabase } from '../lib/supabase';
import { IMAGE_STOCK_CATEGORIES, VISUAL_TYPES } from './image-constants';

const cellStyle = { padding: '6px 8px', fontSize: 12.5, textAlign: 'center', borderBottom: '1px solid var(--adm-border-light)' };

export function StockMatrix({ images }) {
  const matrix = useMemo(() => {
    const m = {};
    const cats = [...IMAGE_STOCK_CATEGORIES, '(yok)'];
    for (const c of cats) { m[c] = {}; for (const [t] of VISUAL_TYPES) m[c][t] = { n: 0, generic: 0 }; }
    for (const r of images) {
      const c = r.category || '(yok)';
      const t = r.visual_type || null;
      if (!m[c]) m[c] = {};
      if (t && !m[c][t]) m[c][t] = { n: 0, generic: 0 };
      if (!t) continue;
      m[c][t].n += 1;
      if (r.is_generic) m[c][t].generic += 1;
    }
    return { cats: Object.keys(m).filter(c => images.some(r => (r.category || '(yok)') === c) || IMAGE_STOCK_CATEGORIES.includes(c)), m };
  }, [images]);

  const untyped = images.filter(r => !r.visual_type).length;
  const generic = images.filter(r => r.is_generic).length;

  return (
    <div className="adm-card" style={{ marginBottom: 16 }}>
      <div className="adm-card__header"><h3>Stok matrisi (kategori × tip)</h3></div>
      <div className="adm-card__body" style={{ overflowX: 'auto' }}>
        <div style={{ fontSize: 13, marginBottom: 10 }}>
          Toplam {images.length} görsel · klişe {generic} · tipi olmayan {untyped}. Hücrede <strong>sayı (klişe)</strong>; boş hücre = o kategoride o tipten görsel yok.
        </div>
        <table style={{ borderCollapse: 'collapse', minWidth: 720 }}>
          <thead>
            <tr>
              <th style={{ ...cellStyle, textAlign: 'left' }}>Kategori</th>
              {VISUAL_TYPES.map(([t, label]) => <th key={t} style={{ ...cellStyle, fontSize: 11 }} title={t}>{label}</th>)}
              <th style={cellStyle}>Toplam</th>
              <th style={cellStyle}>Klişe</th>
            </tr>
          </thead>
          <tbody>
            {matrix.cats.map(c => {
              const row = matrix.m[c] || {};
              const total = Object.values(row).reduce((s, v) => s + v.n, 0);
              const gen = Object.values(row).reduce((s, v) => s + v.generic, 0);
              return (
                <tr key={c}>
                  <td style={{ ...cellStyle, textAlign: 'left', fontWeight: 600 }}>{c}</td>
                  {VISUAL_TYPES.map(([t]) => {
                    const v = row[t] || { n: 0, generic: 0 };
                    return (
                      <td key={t} style={{ ...cellStyle, background: v.n === 0 ? 'color-mix(in srgb, var(--adm-orange, #f59e0b) 14%, transparent)' : undefined }}>
                        {v.n > 0 ? `${v.n}${v.generic ? ` (${v.generic})` : ''}` : '—'}
                      </td>
                    );
                  })}
                  <td style={cellStyle}>{total}</td>
                  <td style={cellStyle}>{gen}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
        <div style={{ fontSize: 12, color: 'var(--adm-text-dim)', marginTop: 8 }}>Turuncu hücreler: henüz görsel yok.</div>
      </div>
    </div>
  );
}

function BulkRow({ row, onSaved, flash }) {
  const [vt, setVt] = useState(row.visual_type || '');
  const [gen, setGen] = useState(!!row.is_generic);
  const [tags, setTags] = useState((row.tags || []).join(', '));
  const [saving, setSaving] = useState(false);
  const dirty = vt !== (row.visual_type || '') || gen !== !!row.is_generic || tags !== (row.tags || []).join(', ');

  const save = async () => {
    if (!vt) { flash('Görsel tipi zorunlu.', 'orange'); return; }
    setSaving(true);
    const parsed = tags.split(',').map(t => t.trim()).filter(Boolean);
    const { error } = await supabase.from('image_stock')
      .update({ visual_type: vt, is_generic: gen, tags: parsed }).eq('id', row.id);
    setSaving(false);
    if (error) { flash('Kaydedilemedi: ' + error.message, 'orange'); return; }
    flash(`#${row.id} kaydedildi.`);
    onSaved();
  };

  return (
    <tr>
      <td style={cellStyle}><img src={row.url} alt="" width={64} height={36} loading="lazy" style={{ width: 64, height: 36, objectFit: 'cover', borderRadius: 4 }} /></td>
      <td style={{ ...cellStyle, textAlign: 'left' }}>#{row.id} · {row.category || '—'}</td>
      <td style={cellStyle}>
        <select value={vt} onChange={e => setVt(e.target.value)} style={{ fontSize: 12.5, padding: 4 }}>
          <option value="">— seç —</option>
          {VISUAL_TYPES.map(([t, label]) => <option key={t} value={t}>{label}</option>)}
        </select>
      </td>
      <td style={cellStyle}><input type="checkbox" checked={gen} onChange={e => setGen(e.target.checked)} /></td>
      <td style={cellStyle}>
        <input value={tags} onChange={e => setTags(e.target.value)} style={{ width: 260, fontSize: 12.5, padding: 4 }} />
      </td>
      <td style={cellStyle}>
        <button className="adm-btn adm-btn--primary adm-btn--sm" disabled={!dirty || saving} onClick={save}>
          {saving ? 'Kaydediliyor…' : dirty ? 'Kaydet' : 'Kaydedildi'}
        </button>
      </td>
    </tr>
  );
}

export function BulkTypeTable({ images, onSaved, flash }) {
  const [only, setOnly] = useState('untyped'); // untyped | all
  const list = images.filter(r => only === 'all' || !r.visual_type);
  return (
    <div className="adm-card" style={{ marginBottom: 16 }}>
      <div className="adm-card__header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <h3>Toplu tip düzenleme</h3>
        <select value={only} onChange={e => setOnly(e.target.value)} style={{ fontSize: 12.5, padding: 4 }}>
          <option value="untyped">Sadece tipi olmayanlar</option>
          <option value="all">Tümü</option>
        </select>
      </div>
      <div className="adm-card__body" style={{ overflowX: 'auto', padding: 0 }}>
        {list.length === 0 ? (
          <div style={{ padding: 16, fontSize: 13 }}>Düzenlenecek görsel yok.</div>
        ) : (
          <table style={{ borderCollapse: 'collapse', width: '100%' }}>
            <thead>
              <tr>
                <th style={cellStyle}>Önizleme</th>
                <th style={cellStyle}>Görsel</th>
                <th style={cellStyle}>Tip</th>
                <th style={cellStyle}>Klişe</th>
                <th style={cellStyle}>Etiketler (virgülle)</th>
                <th style={cellStyle}></th>
              </tr>
            </thead>
            <tbody>
              {list.map(r => <BulkRow key={r.id} row={r} onSaved={onSaved} flash={flash} />)}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}

