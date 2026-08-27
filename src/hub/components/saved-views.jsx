// saved-views.jsx — kayıtlı görünümler (§8.2).
// Bir görünüm: filtre + görünür sütunlar + sütun sırası + sıralama.
// hub_views tablosunda saklanır (store.addItem/updateItem/deleteItem('views')).
import React, { useState } from 'react';
import { AIcon } from '../../admin/admin-ui';
import { useHubStore } from '../hub-store';

export default function SavedViews({ current, state, onLoad, onClear }) {
  const { views, currentMember, addItem, updateItem, deleteItem } = useHubStore();
  const [naming, setNaming] = useState(false);
  const [name, setName] = useState('');

  const save = async () => {
    const n = name.trim();
    if (!n) return;
    const payload = {
      name: n,
      ownerId: currentMember?.id ?? null,
      filters: state.filters,
      columns: state.columns,
      sort: state.sort,
      shared: true,
    };
    const row = await addItem('views', payload);
    setNaming(false); setName('');
    onLoad(row);
  };

  const overwrite = async () => {
    if (!current) return;
    await updateItem('views', current.id, {
      ...current,
      filters: state.filters, columns: state.columns, sort: state.sort,
    });
  };

  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
      <select
        className="adm-input adm-input--sm adm-select"
        style={{ width: 'auto' }}
        value={current?.id || ''}
        onChange={(e) => {
          const v = views.find((x) => x.id === e.target.value);
          if (v) onLoad(v); else onClear();
        }}
      >
        <option value="">Kayıtlı görünüm…</option>
        {views.map((v) => <option key={v.id} value={v.id}>{v.name}</option>)}
      </select>

      {current && (
        <>
          <button className="adm-btn adm-btn--ghost adm-btn--sm" onClick={overwrite} title="Bu görünümü güncelle">
            <AIcon name="save" size={14} /> Güncelle
          </button>
          <button className="adm-icon-btn adm-icon-btn--danger" title="Görünümü sil"
            onClick={() => deleteItem('views', current.id).then(onClear)}>
            <AIcon name="trash" size={14} />
          </button>
        </>
      )}

      {naming ? (
        <span style={{ display: 'inline-flex', gap: 6 }}>
          <input className="adm-input adm-input--sm" autoFocus value={name}
            onChange={(e) => setName(e.target.value)} placeholder="Görünüm adı"
            onKeyDown={(e) => { if (e.key === 'Enter') save(); if (e.key === 'Escape') setNaming(false); }} />
          <button className="adm-btn adm-btn--primary adm-btn--sm" onClick={save}>Kaydet</button>
        </span>
      ) : (
        <button className="adm-btn adm-btn--ghost adm-btn--sm" onClick={() => setNaming(true)}>
          <AIcon name="save" size={14} /> Görünümü kaydet
        </button>
      )}
    </div>
  );
}
