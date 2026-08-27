// filter-bar.jsx — aday tablosu filtre çubuğu (§8.2).
// Altı grup: Aşama · Kaynak · Sorumlu · Rol tipi · Puan durumu · Kırmızı bayrak
// + metin araması (ad / üniversite / etiket). Filtre state'i hub_views.filters
// JSON'una olduğu gibi kaydedilir.
import React from 'react';
import { SearchBar } from '../../admin/admin-ui';
import { ALL_STAGES, SOURCES, ROLE_TYPES } from '../hub-constants';
import { thresholdMet, rubricComplete } from '../hub-rules';

export const EMPTY_FILTERS = {
  q: '', stage: [], source: [], ownerId: [], roleType: [], score: [], flags: [],
};

const SCORE_OPTS = [
  { value: 'threshold', label: 'Eşiği geçen' },
  { value: 'scored',    label: 'Puanlanmış' },
  { value: 'unscored',  label: 'Puanlanmamış' },
];
const FLAG_OPTS = [
  { value: '0',  label: 'Bayrak yok' },
  { value: '1',  label: '1 bayrak' },
  { value: '2+', label: '2+ bayrak' },
];

// Saf: aday listesini filtrelere göre süzer. Tablo ve CSV dışa aktarma
// aynı fonksiyonu kullanır ki "aktif filtre" tek yerde tanımlı olsun.
export function applyFilters(candidates, filters, members = []) {
  const f = { ...EMPTY_FILTERS, ...(filters || {}) };
  const q = f.q.trim().toLowerCase();
  return candidates.filter((c) => {
    if (q) {
      const hay = [c.fullName, c.university, ...(c.tags || [])].join(' ').toLowerCase();
      if (!hay.includes(q)) return false;
    }
    if (f.stage.length && !f.stage.includes(c.stage)) return false;
    if (f.source.length && !f.source.includes(c.source)) return false;
    if (f.ownerId.length && !f.ownerId.includes(c.ownerId || '')) return false;
    if (f.roleType.length && !f.roleType.includes(c.roleType || '')) return false;
    if (f.score.length) {
      const ok = f.score.some((s) =>
        s === 'threshold' ? thresholdMet(c)
        : s === 'scored'  ? rubricComplete(c)
        : /* unscored */    !rubricComplete(c));
      if (!ok) return false;
    }
    if (f.flags.length) {
      const n = (c.redFlags || []).length;
      const bucket = n === 0 ? '0' : n === 1 ? '1' : '2+';
      if (!f.flags.includes(bucket)) return false;
    }
    return true;
  });
}

export function countActiveFilters(filters) {
  const f = { ...EMPTY_FILTERS, ...(filters || {}) };
  return ['stage', 'source', 'ownerId', 'roleType', 'score', 'flags']
    .reduce((n, k) => n + f[k].length, 0) + (f.q.trim() ? 1 : 0);
}

function Group({ label, options, selected, onToggle }) {
  return (
    <details className="hub-filter">
      <summary>
        {label}
        {selected.length > 0 && <span className="hub-filter__count">{selected.length}</span>}
      </summary>
      <div className="hub-filter__pop">
        {options.map((o) => (
          <label key={o.value} className="hub-filter__opt">
            <input
              type="checkbox"
              checked={selected.includes(o.value)}
              onChange={() => onToggle(o.value)}
            />
            {o.label}
          </label>
        ))}
      </div>
    </details>
  );
}

export default function FilterBar({ filters, onChange, members = [] }) {
  const f = { ...EMPTY_FILTERS, ...(filters || {}) };
  const set = (key, value) => onChange({ ...f, [key]: value });
  const toggle = (key, value) => {
    const cur = f[key];
    set(key, cur.includes(value) ? cur.filter((x) => x !== value) : [...cur, value]);
  };
  const memberOpts = members.map((m) => ({ value: m.id, label: m.fullName || m.email }));

  return (
    <div className="hub-filterbar">
      <SearchBar value={f.q} onChange={(v) => set('q', v)} placeholder="Ad, üniversite, etiket…" />
      <Group label="Aşama"   options={ALL_STAGES}  selected={f.stage}    onToggle={(v) => toggle('stage', v)} />
      <Group label="Kaynak"  options={SOURCES}     selected={f.source}   onToggle={(v) => toggle('source', v)} />
      <Group label="Sorumlu" options={memberOpts}  selected={f.ownerId}  onToggle={(v) => toggle('ownerId', v)} />
      <Group label="Rol tipi" options={ROLE_TYPES} selected={f.roleType} onToggle={(v) => toggle('roleType', v)} />
      <Group label="Puan durumu" options={SCORE_OPTS} selected={f.score} onToggle={(v) => toggle('score', v)} />
      <Group label="Bayrak"  options={FLAG_OPTS}   selected={f.flags}    onToggle={(v) => toggle('flags', v)} />
      {countActiveFilters(f) > 0 && (
        <button className="adm-btn adm-btn--ghost adm-btn--sm" onClick={() => onChange({ ...EMPTY_FILTERS })}>
          Temizle
        </button>
      )}
    </div>
  );
}
