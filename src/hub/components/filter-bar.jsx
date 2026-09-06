// filter-bar.jsx — aday listesi filtre çubuğu (HUB_SPEC v3 §5). GÖRSEL katman.
// Kural/predikat mantığı `../hub-filter.js`'te (saf, node testli).
// Üstte SAYI GÖSTEREN hazır çipler (tek seçim, sessionStorage'da kalır),
// altında serbest arama + üç açılır menü (aşama · kaynak · rol).
import React from 'react';
import { SearchBar } from '../../admin/admin-ui';
import { STAGES, SOURCES } from '../hub-constants';
import {
  EMPTY_FILTERS, QUICK_CHIPS, chipPredicate, applyFilters, countActiveFilters,
} from '../hub-filter';

export { EMPTY_FILTERS, QUICK_CHIPS, applyFilters, countActiveFilters };

function Group({ label, options, selected, onToggle }) {
  return (
    <details className="hub-filter">
      <summary>
        {label}
        {selected.length > 0 && <span className="hub-filter__count">{selected.length}</span>}
      </summary>
      <div className="hub-filter__pop">
        {options.length === 0 && <div style={{ fontSize: 12, color: 'var(--adm-text-dim)', padding: '4px 6px' }}>—</div>}
        {options.map((o) => (
          <label key={o.value} className="hub-filter__opt">
            <input type="checkbox" checked={selected.includes(o.value)} onChange={() => onToggle(o.value)} />
            {o.label}
          </label>
        ))}
      </div>
    </details>
  );
}

export default function FilterBar({ filters, onChange, candidates = [], openRoles = [], ctx = {} }) {
  const f = { ...EMPTY_FILTERS, ...(filters || {}) };
  const set = (key, value) => onChange({ ...f, [key]: value });
  const toggle = (key, value) => {
    const cur = f[key];
    set(key, cur.includes(value) ? cur.filter((x) => x !== value) : [...cur, value]);
  };

  const active = candidates.filter((c) => c.stage !== 'archived');
  const counts = {};
  QUICK_CHIPS.forEach((ch) => { counts[ch.key] = active.filter(chipPredicate(ch.key, ctx)).length; });
  const roleOpts = openRoles.map((r) => ({ value: r.id, label: r.title }));

  return (
    <div className="hub-filterbar" style={{ flexDirection: 'column', alignItems: 'stretch', gap: 10 }}>
      <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
        {QUICK_CHIPS.map((ch) => (
          <button key={ch.key} type="button"
            className={`adm-chip ${f.chip === ch.key ? 'adm-chip--on' : ''}`}
            onClick={() => set('chip', f.chip === ch.key ? '' : ch.key)}>
            {ch.label} <span className="hub-filter__count">{counts[ch.key]}</span>
          </button>
        ))}
      </div>
      <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
        <SearchBar value={f.q} onChange={(v) => set('q', v)} placeholder="Ad, okul, kaynak detayı…" />
        <Group label="Aşama"  options={STAGES}   selected={f.stage}      onToggle={(v) => toggle('stage', v)} />
        <Group label="Kaynak" options={SOURCES}  selected={f.source}     onToggle={(v) => toggle('source', v)} />
        <Group label="Rol"    options={roleOpts} selected={f.openRoleId} onToggle={(v) => toggle('openRoleId', v)} />
        {countActiveFilters(f) > 0 && (
          <button className="adm-btn adm-btn--ghost adm-btn--sm" onClick={() => onChange({ ...EMPTY_FILTERS })}>
            Temizle
          </button>
        )}
      </div>
    </div>
  );
}
