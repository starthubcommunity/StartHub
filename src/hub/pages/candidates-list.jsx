// candidates-list.jsx — Adaylar listesi (HUB_SPEC v3 §5). table.jsx'in yerine.
// Kart satırları (team app dili). Satıra tıklama → aday kartı. archived burada
// GÖSTERİLMEZ — ayrı Arşiv sayfası (B1). Sağ sütun aşamaya göre değişir (B3).
import React, { useMemo, useState } from 'react';
import { AIcon, PageHead } from '../../admin/admin-ui';
import { useHubStore } from '../hub-store';
import { usePerms } from '../../lib/use-perms';
import { STAGE_LABEL, SOURCE_LABEL, ARCHIVE_REASONS } from '../hub-constants';
import { thresholdMet, rubricComplete, nextAction, gateDueAt } from '../hub-rules';
import FilterBar, { applyFilters } from '../components/filter-bar';
import CandidatePanel from './candidate';
import ImportSimple from './import-simple';
import PasteImport from './paste-import';
import GithubImport from './github-import';
import NewCandidateModal from './new-candidate';
import Triage from './triage';
import HubWizard from '../components/wizard';

const STAGE_COLOR = { pool: '#A29D94', contact: '#2563EB', interview: '#7C3AED', trial: '#EA580C', member: '#16A34A' };
const initials = (name) => (name || '?').trim().split(/\s+/).slice(0, 2).map((w) => w[0]).join('').toUpperCase();
const fmtDate = (v) => (v ? new Date(v).toLocaleDateString('tr-TR', { day: '2-digit', month: '2-digit' }) : '—');

// B3 — satırın sağında aşamaya göre TEK anlamlı bilgi.
function RowRight({ c, touchesByCand, gatesByCand }) {
  if (c.stage === 'pool') {
    const has = (touchesByCand[c.id] || []).length > 0;
    return <span className="hub-pill" style={{ color: 'var(--adm-text-dim)' }}>{has ? 'mesaj var' : 'mesaj yok'}</span>;
  }
  if (c.stage === 'contact') {
    const last = (touchesByCand[c.id] || [])[0];
    return <span className="hub-pill">takip {fmtDate(last?.followUpAt)}</span>;
  }
  if (c.stage === 'interview') {
    if (!rubricComplete(c) && (c.track || 'founder') === 'founder') {
      return <span className="hub-pill" style={{ color: 'var(--adm-text-dim)' }}>puan bekliyor</span>;
    }
    const met = thresholdMet(c);
    const total = (c.scoreFinishing ?? 0) + (c.scoreCommunication ?? 0) + (c.scoreCapacity ?? 0);
    return <span className={`hub-pill ${met ? 'hub-pill--ok' : ''}`}>puan {total || '—'}{met ? ' ✓' : ''}</span>;
  }
  if (c.stage === 'trial') {
    const g = (gatesByCand[c.id] || []).filter((x) => x.result === 'pending')
      .sort((a, b) => (gateDueAt(a) || 0) - (gateDueAt(b) || 0))[0];
    if (!g) return <span className="hub-pill" style={{ color: 'var(--adm-text-dim)' }}>kapı yok</span>;
    const due = gateDueAt(g);
    const ms = due ? due - Date.now() : null;
    if (ms == null) return <span className="hub-pill">Kapı {g.gate}</span>;
    if (ms <= 0) return <span className="hub-pill" style={{ background: 'var(--adm-red-light)', color: 'var(--adm-red)' }}>Kapı {g.gate} · süre doldu</span>;
    const h = Math.round(ms / 3600000);
    return <span className="hub-pill">Kapı {g.gate} · {h < 48 ? `${h}s` : `${Math.round(h / 24)}g`} kaldı</span>;
  }
  if (c.stage === 'member') {
    return <span className="hub-pill hub-pill--ok">katıldı {fmtDate(c.joinedAt)}</span>;
  }
  return null;
}

export default function CandidatesListPage({ filters, setFilters }) {
  const store = useHubStore();
  const { candidates, members, openRoles, touches, gates, currentMember, loading } = store;
  const { can } = usePerms();
  const [openId, setOpenId] = useState(null);
  const [adding, setAdding] = useState(null);   // 'one' | 'import' | 'paste' | null
  const [triageIds, setTriageIds] = useState(null);   // D3
  const [actOn, setActOn] = useState(null);     // satırdan arşivle/sil için aday
  const [toast, setToast] = useState('');
  const flash = (m) => { setToast(m); setTimeout(() => setToast(''), 3500); };

  const memberName = (id) => members.find((m) => m.id === id)?.fullName || members.find((m) => m.id === id)?.email || '—';

  // candidateId -> touches (sent_at desc) / gates — çip sayımı + sağ sütun için.
  const touchesByCand = useMemo(() => {
    const m = {};
    [...touches].sort((a, b) => new Date(b.sentAt) - new Date(a.sentAt))
      .forEach((t) => { (m[t.candidateId] = m[t.candidateId] || []).push(t); });
    return m;
  }, [touches]);
  const gatesByCand = useMemo(() => {
    const m = {};
    gates.forEach((g) => { (m[g.candidateId] = m[g.candidateId] || []).push(g); });
    return m;
  }, [gates]);

  const ctx = useMemo(
    () => ({ currentMemberId: currentMember?.id ?? null, touchesByCand, now: Date.now() }),
    [currentMember, touchesByCand]
  );

  const activeCount = useMemo(() => candidates.filter((c) => c.stage !== 'archived').length, [candidates]);

  const rows = useMemo(
    () => applyFilters(candidates, filters, ctx).sort((a, b) => (b.createdAt || '').localeCompare(a.createdAt || '')),
    [candidates, filters, ctx]
  );

  // D3 — hızlı eleme: filtre yoksa varsayılan "hiç mesaj atılmamış".
  const startTriage = () => {
    const empty = !filters.chip && !filters.stage.length && !filters.source.length
      && !filters.openRoleId.length && !filters.q.trim();
    const f = empty ? { ...filters, chip: 'no_message' } : filters;
    if (empty) setFilters(f);
    const list = applyFilters(candidates, f, ctx).sort((a, b) => (b.createdAt || '').localeCompare(a.createdAt || ''));
    setTriageIds(list.map((r) => r.id));
  };

  const rowActionSteps = [{
    key: 'op', type: 'options', q: 'Bu adaya ne yapılsın?',
    options: [
      ...(actOn && actOn.stage !== 'member'
        ? ARCHIVE_REASONS.map((r) => ({ value: `arch:${r.value}`, label: `Arşivle — ${r.label}` }))
        : []),
      ...(can('candidates.purge') ? [{ value: 'purge', label: 'Kalıcı sil (geri alınamaz)', hint: 'KVKK' }] : []),
    ],
  }];
  const runRowAction = async (a) => {
    const c = actOn;
    if (a.op === 'purge') {
      if (!can('candidates.purge')) { flash('KVKK silme yetkin yok.'); return; }  // E3
      await store.purgeCandidate(c.id);
      flash('Aday ve tüm kayıtları silindi.');
    } else if (String(a.op).startsWith('arch:')) {
      await store.advanceStage(c.id, 'archived', { reason: 'listeden arşivlendi', extra: { archiveReason: a.op.slice(5) } });
      flash('Arşivlendi — Arşiv sayfasında.');
    }
  };

  return (
    <div>
      <PageHead title="Adaylar" desc={`${rows.length} / ${activeCount} aktif aday`} actions={
        can('candidates.write') ? (
          <div style={{ display: 'flex', gap: 8 }}>
            <button className="adm-btn adm-btn--ghost adm-btn--sm" onClick={() => setAdding('one')}>
              <AIcon name="plus" size={14} /> Tek aday
            </button>
            <button className="adm-btn adm-btn--soft adm-btn--sm" onClick={() => setAdding('import')}>
              <AIcon name="upload" size={14} /> CSV
            </button>
            {can('scan.run') && (
              <button className="adm-btn adm-btn--soft adm-btn--sm" onClick={() => setAdding('github')}>
                <AIcon name="rocket" size={14} /> GitHub
              </button>
            )}
            <button className="adm-btn adm-btn--primary adm-btn--sm adm-btn--cta" onClick={() => setAdding('paste')}>
              <AIcon name="edit" size={14} /> Yapıştır ve ekle
            </button>
          </div>
        ) : null
      } />

      <FilterBar filters={filters} onChange={setFilters} candidates={candidates} openRoles={openRoles} ctx={ctx} />

      {can('candidates.write') && rows.length > 0 && (
        <div style={{ margin: '2px 0 6px' }}>
          <button className="adm-btn adm-btn--soft adm-btn--sm" onClick={startTriage}>
            <AIcon name="layers" size={13} /> Hızlı eleme{filters.chip || filters.stage.length || filters.q.trim() ? ` (${rows.length})` : ' (hiç mesaj atılmamış)'}
          </button>
        </div>
      )}

      {loading ? (
        <div className="adm-empty">Yükleniyor…</div>
      ) : rows.length === 0 ? (
        <div className="adm-empty">{activeCount === 0 ? 'İlk adayını ekle — sağ üstteki “Aday ekle”.' : 'Bu filtreyle eşleşen aktif aday yok.'}</div>
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
                </div>
                <div style={{ fontSize: 12, color: '#A29D94', marginTop: 3 }}>
                  {SOURCE_LABEL[c.source] || c.source} · {memberName(c.ownerId)}
                  {(() => { const na = nextAction(c, touches, gates); return na ? ` · ${na.label}` : ''; })()}
                </div>
              </div>
              <RowRight c={c} touchesByCand={touchesByCand} gatesByCand={gatesByCand} />
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
      {adding === 'paste' && <PasteImport onClose={() => setAdding(null)} />}
      {adding === 'github' && <GithubImport onClose={() => setAdding(null)} />}
      {triageIds && <Triage ids={triageIds} onClose={() => setTriageIds(null)} />}
      {actOn && (
        <HubWizard title={actOn.fullName} submitLabel="Uygula" onCancel={() => setActOn(null)}
          steps={rowActionSteps} onComplete={runRowAction} />
      )}
      {toast && <div className="hub-toast">{toast}</div>}
    </div>
  );
}
