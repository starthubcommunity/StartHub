// candidates-list.jsx — Adaylar listesi (v2 §5). table.jsx'in yerine.
// Kart satırları (team app dili). Satıra tıklama → aday kartı.
import React, { useMemo, useState } from 'react';
import { AIcon, PageHead } from '../../admin/admin-ui';
import { useHubStore } from '../hub-store';
import { usePerms } from '../../lib/use-perms';
import { STAGE_LABEL, SOURCE_LABEL, NEXT_ACTION_LABEL, RED_FLAG_LABEL, ARCHIVE_REASONS } from '../hub-constants';
import { thresholdMet, rubricComplete } from '../hub-rules';
import FilterBar, { applyFilters } from '../components/filter-bar';
import CandidatePanel from './candidate';
import ImportSimple from './import-simple';
import NewCandidateModal from './new-candidate';
import HubWizard from '../components/wizard';

const STAGE_COLOR = { pool: '#A29D94', contact: '#2563EB', interview: '#7C3AED', trial: '#EA580C', member: '#16A34A', archived: '#E7E0D2' };
const initials = (name) => (name || '?').trim().split(/\s+/).slice(0, 2).map((w) => w[0]).join('').toUpperCase();

function ScorePill({ c }) {
  if (!rubricComplete(c) && (c.track || 'founder') === 'founder') return null;
  const met = thresholdMet(c);
  const total = (c.scoreFinishing ?? 0) + (c.scoreCommunication ?? 0) + (c.scoreCapacity ?? 0);
  return <span className={`hub-pill ${met ? 'hub-pill--ok' : ''}`}>puan {total || '—'}{met ? ' ✓' : ''}</span>;
}

export default function CandidatesListPage({ filters, setFilters }) {
  const store = useHubStore();
  const { candidates, members, loading } = store;
  const { can } = usePerms();
  const [openId, setOpenId] = useState(null);
  const [adding, setAdding] = useState(null);   // 'one' | 'import' | null
  const [actOn, setActOn] = useState(null);     // satırdan arşivle/sil için aday
  const [toast, setToast] = useState('');
  const flash = (m) => { setToast(m); setTimeout(() => setToast(''), 3500); };

  const memberName = (id) => members.find((m) => m.id === id)?.fullName || members.find((m) => m.id === id)?.email || '—';

  const rowActionSteps = [{
    key: 'op', type: 'options', q: 'Bu adaya ne yapılsın?',
    options: [
      ...(actOn && actOn.stage === 'archived'
        ? [{ value: 'unarch', label: 'Havuz\'a geri al' }]
        : actOn && actOn.stage !== 'member'
          ? ARCHIVE_REASONS.map((r) => ({ value: `arch:${r.value}`, label: `Arşivle — ${r.label}` }))
          : []),
      ...(can('candidates.purge') ? [{ value: 'purge', label: 'Kalıcı sil (geri alınamaz)', hint: 'KVKK' }] : []),
    ],
  }];
  const runRowAction = async (a) => {
    const c = actOn;
    if (a.op === 'purge') {
      await store.purgeCandidate(c.id);
      flash('Aday ve tüm kayıtları silindi.');
    } else if (a.op === 'unarch') {
      await store.advanceStage(c.id, 'pool', { reason: 'arşivden geri alındı', extra: { archiveReason: null } });
      flash('Havuz\'a geri alındı.');
    } else if (String(a.op).startsWith('arch:')) {
      await store.advanceStage(c.id, 'archived', { reason: 'listeden arşivlendi', extra: { archiveReason: a.op.slice(5) } });
      flash('Arşivlendi.');
    }
  };

  const rows = useMemo(
    () => applyFilters(candidates, filters, members).sort((a, b) => (b.createdAt || '').localeCompare(a.createdAt || '')),
    [candidates, filters, members]
  );

  return (
    <div>
      <PageHead title="Adaylar" desc={`${rows.length} / ${candidates.length} aday`} actions={
        can('candidates.write') ? (
          <div style={{ display: 'flex', gap: 8 }}>
            <button className="adm-btn adm-btn--soft adm-btn--sm" onClick={() => setAdding('import')}>
              <AIcon name="upload" size={14} /> CSV
            </button>
            <button className="adm-btn adm-btn--primary adm-btn--sm adm-btn--cta" onClick={() => setAdding('one')}>
              <AIcon name="plus" size={14} /> Aday ekle
            </button>
          </div>
        ) : null
      } />

      <FilterBar filters={filters} onChange={setFilters} members={members} />

      {loading ? (
        <div className="adm-empty">Yükleniyor…</div>
      ) : rows.length === 0 ? (
        <div className="adm-empty">İlk adayını ekle — sağ üstteki “Aday ekle”.</div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginTop: 4 }}>
          {rows.map((c) => (
            <div key={c.id} className="hub-c hub-c--tight hub-c--lead"
              style={{ '--hub-lead': STAGE_COLOR[c.stage] || '#E7E0D2', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 12 }}
              onClick={() => setOpenId(c.id)}>
              <div className="hub-av">{initials(c.fullName)}</div>
              <div style={{ minWidth: 0, flex: 1 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                  <strong style={{ fontSize: 14, color: '#1C1917' }}>{c.fullName}</strong>
                  <span className="hub-pill hub-pill--stage">{STAGE_LABEL[c.stage] || c.stage}</span>
                  {(c.redFlags || []).length > 0 && (
                    <span className="hub-pill hub-pill--flag" title={(c.redFlags || []).map((k) => RED_FLAG_LABEL[k] || k).join(', ')}>
                      ⚑ {(c.redFlags || []).length}
                    </span>
                  )}
                </div>
                <div style={{ fontSize: 12, color: '#A29D94', marginTop: 3 }}>
                  {SOURCE_LABEL[c.source] || c.source} · {memberName(c.ownerId)}
                  {c.nextAction ? ` · ${NEXT_ACTION_LABEL[c.nextAction] || c.nextAction}` : ''}
                </div>
              </div>
              <ScorePill c={c} />
              {can('candidates.write') && (
                <button className="adm-icon-btn adm-icon-btn--danger" title="Arşivle / sil"
                  onClick={(e) => {
                    e.stopPropagation();
                    if (c.stage === 'member' && !can('candidates.purge')) { flash('Ekipteki aday arşivlenmez; kalıcı silme yetkin yok.'); return; }
                    setActOn(c);
                  }}>
                  <AIcon name="trash" size={15} />
                </button>
              )}
            </div>
          ))}
        </div>
      )}

      {openId && <CandidatePanel candidateId={openId} onClose={() => setOpenId(null)} />}
      {adding === 'one' && <NewCandidateModal onClose={() => setAdding(null)} />}
      {adding === 'import' && <ImportSimple onClose={() => setAdding(null)} />}
      {actOn && (
        <HubWizard title={actOn.fullName} submitLabel="Uygula" onCancel={() => setActOn(null)}
          steps={rowActionSteps} onComplete={runRowAction} />
      )}
      {toast && <div className="hub-toast">{toast}</div>}
    </div>
  );
}
