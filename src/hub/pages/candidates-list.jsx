// candidates-list.jsx — Adaylar listesi (v2 §5). table.jsx'in yerine.
// Tek liste, konfigürasyonsuz. 7 sabit sütun. Kayıtlı görünüm / sütun
// sürükleme / hücre içi düzenleme / CSV export / çoklu seçim YOK.
// Satıra tıklama → aday kartı.
import React, { useMemo, useState } from 'react';
import { AIcon, PageHead } from '../../admin/admin-ui';
import { useHubStore } from '../hub-store';
import { usePerms } from '../../lib/use-perms';
import { STAGE_LABEL, SOURCE_LABEL, NEXT_ACTION_LABEL, RED_FLAG_LABEL } from '../hub-constants';
import { thresholdMet, rubricComplete } from '../hub-rules';
import FilterBar, { applyFilters } from '../components/filter-bar';
import CandidatePanel from './candidate';
import ImportSimple from './import-simple';
import NewCandidateModal from './new-candidate';

function ScoreCell({ c }) {
  if (!rubricComplete(c) && (c.track || 'founder') === 'founder') {
    return <span style={{ color: 'var(--adm-text-dim)', fontSize: 12 }}>—</span>;
  }
  const met = thresholdMet(c);
  const total = (c.scoreFinishing ?? 0) + (c.scoreCommunication ?? 0) + (c.scoreCapacity ?? 0);
  return (
    <span className="hub-pill" style={met
      ? { background: 'var(--adm-green-light)', color: 'var(--adm-green)' }
      : { background: 'var(--adm-border-light)', color: 'var(--adm-text-dim)' }}>
      {total || '—'}{met ? ' ✓' : ''}
    </span>
  );
}

export default function CandidatesListPage({ filters, setFilters }) {
  const store = useHubStore();
  const { candidates, members, loading } = store;
  const { can } = usePerms();
  const [openId, setOpenId] = useState(null);
  const [adding, setAdding] = useState(null);   // 'one' | 'import' | null

  const memberName = (id) => members.find((m) => m.id === id)?.fullName || members.find((m) => m.id === id)?.email || '—';

  const rows = useMemo(
    () => applyFilters(candidates, filters, members).sort((a, b) => (b.createdAt || '').localeCompare(a.createdAt || '')),
    [candidates, filters, members]
  );

  return (
    <div>
      <PageHead title="Adaylar" desc={`${rows.length} / ${candidates.length} aday`} actions={
        can('candidates.write') ? (
          <div style={{ display: 'flex', gap: 8 }}>
            <button className="adm-btn adm-btn--ghost adm-btn--sm" onClick={() => setAdding('import')}>
              <AIcon name="upload" size={14} /> CSV / Excel
            </button>
            <button className="adm-btn adm-btn--primary adm-btn--sm" onClick={() => setAdding('one')}>
              <AIcon name="plus" size={14} /> Aday ekle
            </button>
          </div>
        ) : null
      } />

      <FilterBar filters={filters} onChange={setFilters} members={members} />

      <div className="adm-card" style={{ marginTop: 12 }}>
        <div className="adm-card__body" style={{ padding: 0, overflowX: 'auto' }}>
          <table className="adm-table">
            <thead>
              <tr>
                <th>Ad</th><th>Aşama</th><th>Kaynak</th><th>Sorumlu</th>
                <th>Puan</th><th>Bayrak</th><th>Sonraki aksiyon</th>
              </tr>
            </thead>
            <tbody>
              {loading && <tr><td colSpan={7} style={{ padding: 20, color: 'var(--adm-text-dim)' }}>Yükleniyor…</td></tr>}
              {!loading && rows.length === 0 && (
                <tr><td colSpan={7} style={{ padding: 20, color: 'var(--adm-text-dim)' }}>Aday yok.</td></tr>
              )}
              {rows.map((c) => (
                <tr key={c.id} style={{ cursor: 'pointer' }} onClick={() => setOpenId(c.id)}>
                  <td style={{ fontWeight: 600 }}>{c.fullName}</td>
                  <td><span className="hub-pill">{STAGE_LABEL[c.stage] || c.stage}</span></td>
                  <td>{SOURCE_LABEL[c.source] || c.source}</td>
                  <td>{memberName(c.ownerId)}</td>
                  <td><ScoreCell c={c} /></td>
                  <td>
                    {(c.redFlags || []).length === 0
                      ? <span style={{ color: 'var(--adm-text-dim)' }}>—</span>
                      : <span title={(c.redFlags || []).map((k) => RED_FLAG_LABEL[k] || k).join(', ')}
                          style={{ color: 'var(--adm-red)', fontWeight: 700 }}>⚑ {(c.redFlags || []).length}</span>}
                  </td>
                  <td>{c.nextAction ? (NEXT_ACTION_LABEL[c.nextAction] || c.nextAction) : <span style={{ color: 'var(--adm-text-dim)' }}>—</span>}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {openId && <CandidatePanel candidateId={openId} onClose={() => setOpenId(null)} />}
      {adding === 'one' && <NewCandidateModal onClose={() => setAdding(null)} />}
      {adding === 'import' && <ImportSimple onClose={() => setAdding(null)} />}
    </div>
  );
}
