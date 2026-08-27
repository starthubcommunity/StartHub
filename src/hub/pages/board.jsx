// board.jsx — Hat görünümü (§8.3). Sekiz sütunlu kanban.
// Sürükle-bırak; canAdvance() false dönerse bırakma REDDEDİLİR ve dönen
// reason toast olur. Kural kontrolü hub-rules.js'te — burada kopyalanmaz.
import React, { useState, useMemo } from 'react';
import { useHubStore } from '../hub-store';
import { useHubMember } from '../hub-member';
import { STAGES, STAGE_ORDER, SOURCE_LABEL } from '../hub-constants';
import { canAdvance, thresholdMet, isStale } from '../hub-rules';
import FilterBar, { applyFilters } from '../components/filter-bar';
import CandidatePanel from './candidate';

const initials = (member) =>
  (member?.fullName || member?.email || '?').trim().slice(0, 2).toUpperCase();

function BoardCard({ c, owner, onOpen, onDragStart, onDragEnd }) {
  const met = thresholdMet(c);
  const flags = (c.redFlags || []).length;
  const stale = isStale(c);
  return (
    <div className="hub-card" draggable
      onDragStart={onDragStart} onDragEnd={onDragEnd} onClick={onOpen}>
      <div className="hub-card__name">
        <span>{c.fullName}</span>
        {stale.stale && (
          <span className={`hub-card__dot hub-card__dot--${stale.level}`}
            title={`Bayat · ${stale.days} gün`} />
        )}
      </div>
      <div className="hub-card__meta">{c.university || '—'}</div>
      <div className="hub-card__row">
        <span className="hub-pill">{SOURCE_LABEL[c.source] || c.source}</span>
        <span className="hub-pill" style={met ? { background: 'var(--adm-green-light)', color: 'var(--adm-green)' } : undefined}>
          {c.scoreTotal ?? 0}{met ? ' ✓' : ''}
        </span>
        {flags > 0 && <span className="hub-pill hub-pill--flag">{flags} ⚑</span>}
        {owner && <span className="hub-card__initials" title={owner.fullName || owner.email}>{initials(owner)}</span>}
      </div>
    </div>
  );
}

export default function BoardPage({ filters, setFilters }) {
  const store = useHubStore();
  const { candidates, members } = store;
  const role = useHubMember();
  const [openId, setOpenId] = useState(null);
  const [dragId, setDragId] = useState(null);
  const [overStage, setOverStage] = useState(null);
  const [toast, setToast] = useState(null);
  const flash = (m) => { setToast(m); setTimeout(() => setToast(null), 3800); };

  const memberById = useMemo(() => Object.fromEntries(members.map((m) => [m.id, m])), [members]);

  // Hat yalnızca aktif adayları gösterir (archived hariç).
  const visible = useMemo(
    () => applyFilters(candidates, filters, members).filter((c) => c.stage !== 'archived'),
    [candidates, filters, members]
  );
  const byStage = useMemo(() => {
    const g = Object.fromEntries(STAGES.map((s) => [s.value, []]));
    visible.forEach((c) => { if (g[c.stage]) g[c.stage].push(c); });
    return g;
  }, [visible]);

  // Sütun başlığı: sayı + bir önceki aşamadan dönüşüm oranı.
  // Yorum: huni oranı — i. aşamaya "ulaşmış" (i ve sonrası) / (i-1 ve sonrası),
  // archived dışı adaylar üzerinden.
  const atOrBeyond = (i) => visible.filter((c) => STAGE_ORDER.indexOf(c.stage) >= i).length;

  const handleDrop = async (toStage) => {
    setOverStage(null);
    const id = dragId;
    setDragId(null);
    if (!id) return;
    const row = candidates.find((c) => c.id === id);
    if (!row || row.stage === toStage) return;
    const chk = canAdvance(row, toStage, { role, touchCount: row.lastContactAt ? 1 : 0 });
    if (!chk.ok) { flash(chk.reason); return; }
    try { await store.advanceStage(id, toStage); }
    catch (e) { flash('Kaydedilemedi: ' + e.message); }
  };

  return (
    <div>
      <div className="adm-page-head">
        <div>
          <h1 className="adm-page-head__title">Hat</h1>
          <p className="adm-page-head__desc">{visible.length} aktif aday</p>
        </div>
      </div>

      <FilterBar filters={filters} onChange={setFilters} members={members} />

      <div className="hub-board">
        {STAGES.map((s, i) => {
          const list = byStage[s.value];
          const rate = i === 0 ? null
            : Math.round((100 * atOrBeyond(i)) / Math.max(1, atOrBeyond(i - 1)));
          return (
            <div key={s.value}
              className={`hub-board__col ${overStage === s.value ? 'hub-board__col--over' : ''}`}
              onDragOver={(e) => { e.preventDefault(); setOverStage(s.value); }}
              onDragLeave={() => setOverStage((cur) => (cur === s.value ? null : cur))}
              onDrop={() => handleDrop(s.value)}>
              <div className="hub-board__colhead">
                <span>{s.label}</span>
                <span className="hub-board__count">
                  {list.length}{rate != null ? ` · ${rate}%` : ''}
                </span>
              </div>
              <div className="hub-board__cards">
                {list.map((c) => (
                  <BoardCard key={c.id} c={c} owner={memberById[c.ownerId]}
                    onOpen={() => setOpenId(c.id)}
                    onDragStart={() => setDragId(c.id)}
                    onDragEnd={() => { setDragId(null); setOverStage(null); }} />
                ))}
              </div>
            </div>
          );
        })}
      </div>

      {openId && <CandidatePanel candidateId={openId} onClose={() => setOpenId(null)} />}
      {toast && <div className="hub-toast">{toast}</div>}
    </div>
  );
}
