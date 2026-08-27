// table.jsx — Kurucu Hattı asıl çalışma ekranı (§8.2). Excel gibi davranır:
// satır içi ekleme, hücre düzenleme (Tab/Enter/Esc), çoklu seçim + toplu işlem,
// sütun gizle/göster + sıra, çoklu sütun sıralama, CSV dışa aktarma.
// Aşama değişiklikleri her zaman hub-rules.canAdvance() üzerinden geçer.
import React, { useState, useMemo, useRef } from 'react';
import { AIcon } from '../../admin/admin-ui';
import { useHubStore } from '../hub-store';
import { useHubMember } from '../hub-member';
import {
  ALL_STAGES, SOURCES, ROLE_TYPES, DATA_TRUST, ARCHIVE_REASONS,
  DATA_TRUST_MANUAL_DEFAULT, STAGE_LABEL,
} from '../hub-constants';
import { canAdvance, thresholdMet } from '../hub-rules';
import FilterBar, { applyFilters, EMPTY_FILTERS } from '../components/filter-bar';
import SavedViews from '../components/saved-views';
import CandidatePanel from './candidate';

const labelOf = (opts, v) => opts.find((o) => o.value === v)?.label ?? (v || '');
const num = (v) => (v === '' || v == null ? null : Number(v));

// Sütun tanımları — sabit listeler hub-constants'tan.
const COLS = {
  fullName:     { label: 'Ad',              w: 190, type: 'open',    frozen: true },
  stage:        { label: 'Aşama',           w: 130, type: 'select',  options: ALL_STAGES },
  source:       { label: 'Kaynak',          w: 150, type: 'select',  options: SOURCES },
  ownerId:      { label: 'Sorumlu',         w: 150, type: 'member' },
  roleType:     { label: 'Rol',             w: 120, type: 'select',  options: ROLE_TYPES, nullable: true },
  university:   { label: 'Üniversite',      w: 170, type: 'text' },
  email:        { label: 'E-posta',         w: 190, type: 'text' },
  linkedin:     { label: 'LinkedIn',        w: 160, type: 'text' },
  github:       { label: 'GitHub',          w: 150, type: 'text' },
  city:         { label: 'Şehir',           w: 110, type: 'text' },
  weeklyHours:  { label: 'Saat/hf',         w: 80,  type: 'number' },
  dataTrust:    { label: 'Veri güveni',     w: 120, type: 'select',  options: DATA_TRUST },
  scoreTotal:   { label: 'Puan',            w: 90,  type: 'readonly' },
  redFlags:     { label: 'Bayrak',          w: 90,  type: 'readonly' },
  tags:         { label: 'Etiketler',       w: 170, type: 'tags' },
  nextAction:   { label: 'Sonraki aksiyon', w: 200, type: 'text' },
  nextActionAt: { label: 'Tarih',           w: 130, type: 'date' },
  createdAt:    { label: 'Eklendi',         w: 120, type: 'readonly' },
};
const ALL_KEYS = Object.keys(COLS);
const DEFAULT_COLUMNS = ['fullName', 'stage', 'source', 'ownerId', 'roleType', 'university', 'scoreTotal', 'redFlags', 'tags', 'nextAction'];

// ── hücre görüntü değeri ──────────────────────────────────────────────
function displayValue(row, key, members) {
  const v = row[key];
  const col = COLS[key];
  if (key === 'ownerId') return members.find((m) => m.id === v)?.fullName || '';
  if (key === 'scoreTotal') return v ?? 0;
  if (key === 'redFlags') return (v || []).length || '';
  if (key === 'tags') return (v || []).join(', ');
  if (col.type === 'select') return labelOf(col.options, v);
  if (col.type === 'date' && v) return String(v).slice(0, 10);
  if (key === 'createdAt' && v) return String(v).slice(0, 10);
  return v ?? '';
}

// ── CSV ──────────────────────────────────────────────────────────────
const csvEscape = (s) => {
  const str = String(s ?? '');
  return /[",\r\n]/.test(str) ? `"${str.replace(/"/g, '""')}"` : str;
};
function csvCell(row, key, members) {
  const v = row[key];
  if (key === 'ownerId') return members.find((m) => m.id === v)?.fullName || '';
  if (key === 'redFlags') return (v || []).length;
  if (Array.isArray(v)) return v.join('; ');
  if (COLS[key].type === 'select') return labelOf(COLS[key].options, v);
  if ((COLS[key].type === 'date' || key === 'createdAt') && v) return String(v).slice(0, 10);
  return v ?? '';
}

// ── sıralama ─────────────────────────────────────────────────────────
function cmp(a, b, key) {
  let va = a[key], vb = b[key];
  if (key === 'redFlags') { va = (va || []).length; vb = (vb || []).length; }
  if (va == null || va === '') return 1;
  if (vb == null || vb === '') return -1;
  if (typeof va === 'number' && typeof vb === 'number') return va - vb;
  return String(va).localeCompare(String(vb), 'tr');
}

export default function TablePage({ filters, setFilters }) {
  const store = useHubStore();
  const { candidates, members, loading } = store;
  const role = useHubMember();

  const [columns, setColumns] = useState(DEFAULT_COLUMNS);
  const [sort, setSort]       = useState([{ key: 'createdAt', dir: 'desc' }]);
  const [view, setView]       = useState(null);

  const [editing, setEditing]   = useState(null);   // { id, key }
  const [draft, setDraft]       = useState('');
  const [newRow, setNewRow]     = useState(null);   // {} | null
  const [selected, setSelected] = useState(() => new Set());
  const anchorRef = useRef(null);
  const [openId, setOpenId]     = useState(null);
  const [toast, setToast]       = useState(null);
  const flash = (m) => { setToast(m); setTimeout(() => setToast(null), 3500); };

  // ── görünür + filtreli + sıralı satırlar ──────────────────────────
  const rows = useMemo(() => {
    const filtered = applyFilters(candidates, filters, members);
    const sorted = [...filtered].sort((a, b) => {
      for (const s of sort) {
        const r = cmp(a, b, s.key) * (s.dir === 'desc' ? -1 : 1);
        if (r) return r;
      }
      return 0;
    });
    return sorted;
  }, [candidates, filters, members, sort]);

  // ── hücre düzenleme ──────────────────────────────────────────────
  const startEdit = (id, key) => {
    if (COLS[key].type === 'readonly' || COLS[key].type === 'open') return;
    const row = candidates.find((c) => c.id === id);
    let cur = row[key];
    if (key === 'tags') cur = (cur || []).join(', ');
    setEditing({ id, key });
    setDraft(cur ?? '');
  };

  const commit = async (id, key, raw) => {
    setEditing(null);
    const row = candidates.find((c) => c.id === id);
    if (!row) return;
    const col = COLS[key];
    let value = raw;
    if (col.type === 'number') value = num(raw);
    else if (col.type === 'tags') value = String(raw).split(',').map((s) => s.trim()).filter(Boolean);
    else if (col.type === 'member') value = raw || null;
    else if (col.type === 'select' && col.nullable) value = raw || null;

    if (JSON.stringify(row[key]) === JSON.stringify(value)) return;

    if (key === 'stage') {
      const chk = canAdvance(row, value, { role, touchCount: row.lastContactAt ? 1 : 0 });
      if (!chk.ok) { flash(chk.reason); return; }
      // Aşama değişimi store.advanceStage üzerinden: stage_changed_at = now()
      // + hub_stage_log aynı işlemde (§9).
      try { await store.advanceStage(id, value); }
      catch (e) { flash('Kaydedilemedi: ' + e.message); }
      return;
    }

    const prev = row[key];
    store.patchCandidate(id, { [key]: value });
    try {
      await store.updateCandidate(id, { ...row, [key]: value });
    } catch (e) {
      store.patchCandidate(id, { [key]: prev });
      flash('Kaydedilemedi: ' + e.message);
    }
  };

  const onCellKey = (e, id, key) => {
    if (e.key === 'Enter') { e.preventDefault(); commit(id, key, draft); }
    else if (e.key === 'Escape') { e.preventDefault(); setEditing(null); }
    else if (e.key === 'Tab') {
      e.preventDefault();
      commit(id, key, draft);
      const ci = columns.indexOf(key);
      const next = columns.slice(ci + 1).find((k) => !['readonly', 'open'].includes(COLS[k].type));
      if (next) setTimeout(() => startEdit(id, next), 0);
    }
  };

  // ── yeni aday satırı ─────────────────────────────────────────────
  const saveNewRow = () => {
    const d = newRow || {};
    if (!String(d.fullName || '').trim()) return flash('Ad zorunlu.');
    if (!(d.email || d.linkedin || d.github)) return flash('En az bir iletişim gir (e-posta / LinkedIn / GitHub).');
    if (!d.source) return flash('Kaynak seç.');
    store.addCandidate({ ...d, dataTrust: DATA_TRUST_MANUAL_DEFAULT })
      .then(() => { setNewRow(null); flash('Aday havuza eklendi.'); })
      .catch((e) => flash('Eklenemedi: ' + e.message));
  };

  // ── seçim ────────────────────────────────────────────────────────
  const toggleRow = (idx, e) => {
    const id = rows[idx].id;
    const next = new Set(selected);
    if (e.shiftKey && anchorRef.current != null) {
      const [a, b] = [anchorRef.current, idx].sort((x, y) => x - y);
      for (let i = a; i <= b; i++) next.add(rows[i].id);
    } else {
      next.has(id) ? next.delete(id) : next.add(id);
      anchorRef.current = idx;
    }
    setSelected(next);
  };
  const allChecked = rows.length > 0 && rows.every((r) => selected.has(r.id));
  const clearSel = () => { setSelected(new Set()); anchorRef.current = null; };

  // ── toplu işlem ─────────────────────────────────────────────────
  const bulkStage = async (toStage) => {
    if (!toStage) return;
    const ids = [...selected];
    let moved = 0; const skipped = [];
    for (const id of ids) {
      const row = candidates.find((c) => c.id === id);
      const chk = canAdvance(row, toStage, { role, touchCount: row.lastContactAt ? 1 : 0 });
      if (!chk.ok) { skipped.push(row.fullName); continue; }
      try { await store.advanceStage(id, toStage); moved++; }
      catch { /* advanceStage kendi rollback'ini yapar */ }
    }
    flash(`${moved} aday “${STAGE_LABEL[toStage]}” aşamasına taşındı` +
      (skipped.length ? ` · ${skipped.length} atlandı (kural)` : ''));
  };

  const bulkSet = async (patch, label) => {
    const ids = [...selected];
    await Promise.all(ids.map((id) => {
      const row = candidates.find((c) => c.id === id);
      store.patchCandidate(id, patch);
      return store.updateCandidate(id, { ...row, ...patch }).catch(() => store.patchCandidate(id, row));
    }));
    flash(`${ids.length} aday güncellendi (${label}).`);
  };

  const bulkArchive = async (reason) => {
    if (!reason) return;
    const ids = [...selected];
    for (const id of ids) {
      // Arşiv de bir aşama değişimi → advanceStage (stage_changed_at + log).
      try { await store.advanceStage(id, 'archived', { reason, extra: { archiveReason: reason } }); }
      catch { /* rollback advanceStage içinde */ }
    }
    flash(`${ids.length} aday arşivlendi.`);
  };
  const bulkTag = (tag) => {
    const t = tag.trim(); if (!t) return;
    const ids = [...selected];
    Promise.all(ids.map((id) => {
      const row = candidates.find((c) => c.id === id);
      if ((row.tags || []).includes(t)) return null;
      const tags = [...(row.tags || []), t];
      store.patchCandidate(id, { tags });
      return store.updateCandidate(id, { ...row, tags }).catch(() => store.patchCandidate(id, row));
    }));
    flash(`“${t}” etiketi eklendi.`);
  };

  // ── sıralama / sütun ────────────────────────────────────────────
  const clickSort = (key, e) => {
    if (COLS[key].type === 'open') return;
    setSort((cur) => {
      const i = cur.findIndex((s) => s.key === key);
      if (e.shiftKey) {
        if (i === -1) return [...cur, { key, dir: 'asc' }];
        if (cur[i].dir === 'asc') return cur.map((s) => (s.key === key ? { ...s, dir: 'desc' } : s));
        return cur.filter((s) => s.key !== key);
      }
      if (i === 0 && cur.length === 1) {
        return cur[0].dir === 'asc' ? [{ key, dir: 'desc' }] : [];
      }
      return [{ key, dir: 'asc' }];
    });
  };
  const sortMark = (key) => {
    const s = sort.find((x) => x.key === key);
    return s ? (s.dir === 'asc' ? ' ▲' : ' ▼') : '';
  };

  const dragKey = useRef(null);
  const onDrop = (key) => {
    const from = dragKey.current;
    if (!from || from === key) return;
    setColumns((cols) => {
      const next = cols.filter((k) => k !== from);
      next.splice(next.indexOf(key), 0, from);
      return next;
    });
    dragKey.current = null;
  };
  const toggleCol = (key) => setColumns((cols) =>
    cols.includes(key) ? cols.filter((k) => k !== key) : [...cols, key]);

  // ── CSV dışa aktarma (görünen sütunlar + aktif filtre) ─────────
  const exportCsv = () => {
    const header = columns.map((k) => COLS[k].label);
    const body = rows.map((r) => columns.map((k) => csvCell(r, k, members)));
    const csv = [header, ...body].map((line) => line.map(csvEscape).join(',')).join('\r\n');
    const blob = new Blob(['﻿' + csv], { type: 'text/csv;charset=utf-8' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `adaylar-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(a.href);
  };

  const loadView = (v) => { setView(v); setFilters({ ...EMPTY_FILTERS, ...(v.filters || {}) }); if (v.columns?.length) setColumns(v.columns); if (v.sort?.length) setSort(v.sort); };
  const clearView = () => setView(null);

  const memberOpts = [{ value: '', label: '—' }, ...members.map((m) => ({ value: m.id, label: m.fullName || m.email }))];
  const frozenLeft = 40; // seçim sütunu genişliği

  return (
    <div>
      <div className="adm-page-head">
        <div>
          <h1 className="adm-page-head__title">Tablo</h1>
          <p className="adm-page-head__desc">{rows.length} / {candidates.length} aday</p>
        </div>
        <div className="adm-page-head__actions">
          <button className="adm-btn adm-btn--ghost adm-btn--sm" onClick={exportCsv}>
            <AIcon name="download" size={14} /> CSV
          </button>
          <details className="hub-filter hub-colbtn">
            <summary>Sütunlar</summary>
            <div className="hub-filter__pop">
              {ALL_KEYS.map((k) => (
                <label key={k} className="hub-filter__opt">
                  <input type="checkbox" checked={columns.includes(k)} onChange={() => toggleCol(k)} />
                  {COLS[k].label}
                </label>
              ))}
            </div>
          </details>
          <button className="adm-btn adm-btn--primary adm-btn--sm" onClick={() => setNewRow(newRow ? null : {})}>
            <AIcon name="edit" size={14} /> Yeni aday
          </button>
        </div>
      </div>

      <FilterBar filters={filters} onChange={setFilters} members={members} />
      <div style={{ marginBottom: 12 }}>
        <SavedViews current={view} state={{ filters, columns, sort }} onLoad={loadView} onClear={clearView} />
      </div>

      {selected.size > 0 && (
        <div className="hub-bulkbar">
          <strong>{selected.size} seçili</strong>
          <label>Aşama:
            <select defaultValue="" onChange={(e) => { bulkStage(e.target.value); e.target.value = ''; }}>
              <option value="">—</option>
              {ALL_STAGES.map((s) => <option key={s.value} value={s.value}>{s.label}</option>)}
            </select>
          </label>
          <label>Sorumlu:
            <select defaultValue="" onChange={(e) => { bulkSet({ ownerId: e.target.value || null }, 'sorumlu'); e.target.value = ''; }}>
              {memberOpts.map((m) => <option key={m.value} value={m.value}>{m.label}</option>)}
            </select>
          </label>
          <label>Arşivle:
            <select defaultValue="" onChange={(e) => { bulkArchive(e.target.value); e.target.value = ''; }}>
              <option value="">— sebep —</option>
              {ARCHIVE_REASONS.map((r) => <option key={r.value} value={r.value}>{r.label}</option>)}
            </select>
          </label>
          <input className="adm-input adm-input--sm" style={{ width: 140 }} placeholder="Etiket ekle + Enter"
            onKeyDown={(e) => { if (e.key === 'Enter') { bulkTag(e.target.value); e.target.value = ''; } }} />
          <button className="adm-btn adm-btn--ghost adm-btn--sm" onClick={clearSel}>Seçimi bırak</button>
        </div>
      )}

      <div className="hub-grid-wrap">
        <table className="hub-grid">
          <thead>
            <tr>
              <th className="hub-col-frozen hub-cell__check" style={{ left: 0, width: frozenLeft }}>
                <input type="checkbox" checked={allChecked}
                  onChange={(e) => setSelected(e.target.checked ? new Set(rows.map((r) => r.id)) : new Set())} />
              </th>
              {columns.map((k) => (
                <th
                  key={k}
                  draggable
                  onDragStart={() => (dragKey.current = k)}
                  onDragOver={(e) => e.preventDefault()}
                  onDrop={() => onDrop(k)}
                  onClick={(e) => clickSort(k, e)}
                  className={`hub-col-sortable ${COLS[k].frozen ? 'hub-col-frozen' : ''}`}
                  style={{ minWidth: COLS[k].w, ...(COLS[k].frozen ? { left: frozenLeft } : {}) }}
                >
                  {COLS[k].label}{sortMark(k)}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {newRow && (
              <tr className="hub-newrow">
                <td className="hub-col-frozen hub-cell__check" style={{ left: 0 }}>
                  <AIcon name="edit" size={13} />
                </td>
                {columns.map((k) => {
                  const col = COLS[k];
                  const common = { style: { minWidth: col.w, ...(col.frozen ? { left: frozenLeft } : {}) }, className: col.frozen ? 'hub-col-frozen' : '' };
                  if (['readonly', 'open'].includes(col.type) && k !== 'fullName') return <td key={k} {...common} />;
                  return (
                    <td key={k} {...common}>
                      {col.type === 'select' || col.type === 'member' ? (
                        <select className="hub-cell__input" value={newRow[k] || ''}
                          onChange={(e) => setNewRow({ ...newRow, [k]: e.target.value })}>
                          <option value="">—</option>
                          {(col.type === 'member' ? members.map((m) => ({ value: m.id, label: m.fullName || m.email })) : col.options)
                            .map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
                        </select>
                      ) : (
                        <input className="hub-cell__input" autoFocus={k === 'fullName'}
                          placeholder={k === 'fullName' ? 'Ad Soyad *' : col.label}
                          value={newRow[k] || ''}
                          onChange={(e) => setNewRow({ ...newRow, [k]: e.target.value })}
                          onKeyDown={(e) => { if (e.key === 'Enter') saveNewRow(); if (e.key === 'Escape') setNewRow(null); }} />
                      )}
                    </td>
                  );
                })}
              </tr>
            )}

            {rows.map((row, idx) => (
              <tr key={row.id} className={selected.has(row.id) ? 'hub-row--sel' : ''}>
                <td className="hub-col-frozen hub-cell__check" style={{ left: 0 }}>
                  <input type="checkbox" checked={selected.has(row.id)} onChange={(e) => toggleRow(idx, e.nativeEvent)} />
                </td>
                {columns.map((k) => {
                  const col = COLS[k];
                  const isEditing = editing && editing.id === row.id && editing.key === k;
                  const tdCls = col.frozen ? 'hub-col-frozen' : '';
                  const tdStyle = { minWidth: col.w, ...(col.frozen ? { left: frozenLeft } : {}) };
                  if (isEditing) {
                    return (
                      <td key={k} className={tdCls} style={tdStyle}>
                        {col.type === 'select' || col.type === 'member' ? (
                          <select className="hub-cell__input" autoFocus value={draft}
                            onChange={(e) => setDraft(e.target.value)}
                            onBlur={() => commit(row.id, k, draft)}
                            onKeyDown={(e) => onCellKey(e, row.id, k)}>
                            {col.nullable || col.type === 'member' ? <option value="">—</option> : null}
                            {(col.type === 'member' ? members.map((m) => ({ value: m.id, label: m.fullName || m.email })) : col.options)
                              .map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
                          </select>
                        ) : (
                          <input className="hub-cell__input" autoFocus
                            type={col.type === 'number' ? 'number' : col.type === 'date' ? 'date' : 'text'}
                            value={draft}
                            onChange={(e) => setDraft(e.target.value)}
                            onBlur={() => commit(row.id, k, draft)}
                            onKeyDown={(e) => onCellKey(e, row.id, k)} />
                        )}
                      </td>
                    );
                  }
                  // salt görüntü
                  if (k === 'fullName') {
                    return (
                      <td key={k} className={tdCls} style={tdStyle}>
                        <div className="hub-cell" style={{ cursor: 'pointer', fontWeight: 600 }}
                          onClick={() => setOpenId(row.id)}>
                          {row.fullName}
                        </div>
                      </td>
                    );
                  }
                  if (k === 'scoreTotal') {
                    const met = thresholdMet(row);
                    return (
                      <td key={k} className={tdCls} style={tdStyle}>
                        <div className="hub-cell hub-cell--readonly">
                          <span className={`hub-pill ${met ? '' : ''}`} style={met ? { background: 'var(--adm-green-light)', color: 'var(--adm-green)' } : {}}>
                            {row.scoreTotal ?? 0}{met ? ' ✓' : ''}
                          </span>
                        </div>
                      </td>
                    );
                  }
                  if (k === 'redFlags') {
                    const n = (row.redFlags || []).length;
                    return (
                      <td key={k} className={tdCls} style={tdStyle}>
                        <div className="hub-cell hub-cell--readonly">
                          {n > 0 ? <span className="hub-pill hub-pill--flag">{n}</span> : ''}
                        </div>
                      </td>
                    );
                  }
                  return (
                    <td key={k} className={tdCls} style={tdStyle} onClick={() => startEdit(row.id, k)}>
                      <div className={`hub-cell ${col.type === 'readonly' ? 'hub-cell--readonly' : ''}`}>
                        {displayValue(row, k, members)}
                      </div>
                    </td>
                  );
                })}
              </tr>
            ))}

            {!loading && rows.length === 0 && !newRow && (
              <tr><td colSpan={columns.length + 1}>
                <div className="adm-empty">Aday yok. “Yeni aday” ile başlayabilirsin.</div>
              </td></tr>
            )}
          </tbody>
        </table>
      </div>

      {openId && <CandidatePanel candidateId={openId} onClose={() => setOpenId(null)} />}
      {toast && <div className="hub-toast">{toast}</div>}
    </div>
  );
}
