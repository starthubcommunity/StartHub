// archive.jsx — Arşiv (HUB_SPEC v3 §5, PROMPT_V3 B1).
// Adaylar listesinden ayrı: yalnızca stage === 'archived'. Aynı satır dili,
// arşiv sebebine göre filtre, satır-içi "Geri al" (A3 undo mantığı →
// undoLastStage: aday arşivlendiği aşamaya döner).
import React, { useMemo, useState } from 'react';
import { PageHead } from '../../admin/admin-ui';
import { useHubStore } from '../hub-store';
import { SOURCE_LABEL, ARCHIVE_REASONS, ARCHIVE_REASON_LABEL } from '../hub-constants';
import { undoPlan } from '../hub-rules';
import CandidatePanel from './candidate';

const initials = (n) => (n || '?').trim().split(/\s+/).slice(0, 2).map((w) => w[0]).join('').toUpperCase();
const fmtDate = (v) => (v ? new Date(v).toLocaleDateString('tr-TR') : '—');

export default function ArchivePage() {
  const store = useHubStore();
  const { candidates, stageLog, loading } = store;
  const [reason, setReason] = useState('');   // '' = hepsi
  const [openId, setOpenId] = useState(null);
  const [busyId, setBusyId] = useState(null);
  const [toast, setToast] = useState('');
  const flash = (m) => { setToast(m); setTimeout(() => setToast(''), 3500); };

  const all = useMemo(
    () => candidates.filter((c) => c.stage === 'archived')
      .sort((a, b) => (b.stageChangedAt || '').localeCompare(a.stageChangedAt || '')),
    [candidates]
  );
  const rows = reason ? all.filter((c) => c.archiveReason === reason) : all;

  const counts = useMemo(() => {
    const m = {};
    all.forEach((c) => { m[c.archiveReason || '—'] = (m[c.archiveReason || '—'] || 0) + 1; });
    return m;
  }, [all]);

  const restore = async (c) => {
    setBusyId(c.id);
    try {
      const plan = undoPlan(c, stageLog);
      await store.undoLastStage(c.id);
      flash(`Geri alındı → ${plan?.label || 'önceki aşama'}.`);
    } catch (e) { flash('Geri alınamadı: ' + e.message); }
    setBusyId(null);
  };

  return (
    <div>
      <PageHead title="Arşiv" desc={`${rows.length} / ${all.length} arşivlenmiş aday`} />

      <div className="hub-filterbar" style={{ gap: 6, flexWrap: 'wrap' }}>
        <button type="button" className={`adm-chip ${reason === '' ? 'adm-chip--on' : ''}`} onClick={() => setReason('')}>
          Hepsi <span className="hub-filter__count">{all.length}</span>
        </button>
        {ARCHIVE_REASONS.map((r) => (
          <button key={r.value} type="button" className={`adm-chip ${reason === r.value ? 'adm-chip--on' : ''}`}
            onClick={() => setReason(reason === r.value ? '' : r.value)}>
            {r.label} <span className="hub-filter__count">{counts[r.value] || 0}</span>
          </button>
        ))}
      </div>

      {loading ? (
        <div className="adm-empty">Yükleniyor…</div>
      ) : rows.length === 0 ? (
        <div className="adm-empty">{all.length === 0 ? 'Arşiv boş.' : 'Bu sebeple arşivlenmiş aday yok.'}</div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginTop: 4 }}>
          {rows.map((c) => {
            const plan = undoPlan(c, stageLog);
            return (
              <div key={c.id} className="hub-c hub-c--tight hub-c--lead"
                style={{ '--hub-lead': '#E7E0D2', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 12 }}
                onClick={() => setOpenId(c.id)}>
                <div className="hub-av">{initials(c.fullName)}</div>
                <div style={{ minWidth: 0, flex: 1 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                    <strong style={{ fontSize: 14, color: '#1C1917' }}>{c.fullName}</strong>
                    <span className="hub-pill hub-pill--flag">{ARCHIVE_REASON_LABEL[c.archiveReason] || c.archiveReason || 'sebep yok'}</span>
                  </div>
                  <div style={{ fontSize: 12, color: '#A29D94', marginTop: 3 }}>
                    {SOURCE_LABEL[c.source] || c.source} · arşiv {fmtDate(c.stageChangedAt)}
                  </div>
                </div>
                <button className="adm-btn adm-btn--ghost adm-btn--sm" disabled={busyId === c.id || !plan}
                  title={plan ? '' : 'Bu kayıt için geri alınacak aşama bulunamadı'}
                  onClick={(e) => { e.stopPropagation(); restore(c); }}>
                  Geri al{plan ? ` (${plan.label})` : ''}
                </button>
              </div>
            );
          })}
        </div>
      )}

      {openId && <CandidatePanel candidateId={openId} onClose={() => setOpenId(null)} />}
      {toast && <div className="hub-toast">{toast}</div>}
    </div>
  );
}
