// candidates-list.jsx — Adaylar listesi (HUB_SPEC v3 §5). table.jsx'in yerine.
// Kart satırları (team app dili). Satıra tıklama → aday kartı. archived burada
// GÖSTERİLMEZ — ayrı Arşiv sayfası (B1). Sağ sütun aşamaya göre değişir (B3).
import React, { useMemo, useState } from 'react';
import { AIcon, PageHead, Modal, Field, Input, ConfirmDialog } from '../../admin/admin-ui';
import { useHubStore } from '../hub-store';
import { usePerms } from '../../lib/use-perms';
import { STAGE_LABEL, SOURCE_LABEL, ARCHIVE_REASONS, DEFAULT_TRACK, INTEREST_LABEL } from '../hub-constants';
import { thresholdMet, rubricComplete, nextAction, gateDueAt } from '../hub-rules';
import FilterBar, { applyFilters, EMPTY_FILTERS } from '../components/filter-bar';
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
// Sürükle-bırak payload'ı basit bir metin (aday id) — dataTransfer.getData
// bazı tarayıcılarda dragover sırasında okunamadığı için hem event'ten hem
// (yedek olarak) React state'inden okunuyor.
const DRAG_MIME = 'text/x-hub-candidate-id';

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
    if (!rubricComplete(c) && (c.track || DEFAULT_TRACK) === 'founder') {
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

// ── Klasör paneli (dosya gezgini modeli, 2026-09-24) — TEK klasör: bir aday
// tek klasörde durur. "Tüm Adaylar" (null) ve "Kategorisiz" ('none') sabit
// satırlar; altında store.folders (kullanıcı klasörleri, ilk 10'u ilgi
// alanından varsayılan olarak gelir, bkz. 0045 migration). Silme adayları
// SİLMEZ — DB'de folder_id `on delete set null`, kategorisiz olurlar.
// 2026-09-25 — "Kategorisiz" ve her klasör artık bir aday satırı sürükleyip
// bırakınca (dosya gezgini "sürükle bırak" mantığı) o adayı içine alan bir
// hedef (dropzone) da oluyor.
function FolderRail({ folders, candidates, selected, onSelect, onSelectAll, onCreate, onDeleteRequest, onDropCandidate, canWrite }) {
  const [dragOver, setDragOver] = useState(null); // 'none' | folder id | null
  const active = candidates.filter((c) => c.stage !== 'archived');
  const totalCount = active.length;
  const noneCount = active.filter((c) => !c.folderId).length;
  const countFor = (folderId) => active.filter((c) => c.folderId === folderId).length;
  const sorted = [...folders].sort((a, b) => (a.name || '').localeCompare(b.name || '', 'tr'));

  const dropProps = (target) => canWrite ? {
    onDragOver: (e) => { e.preventDefault(); if (dragOver !== target) setDragOver(target); },
    onDragLeave: () => setDragOver((v) => (v === target ? null : v)),
    onDrop: (e) => {
      e.preventDefault();
      const id = e.dataTransfer.getData(DRAG_MIME);
      setDragOver(null);
      if (id) onDropCandidate(id, target === 'none' ? null : target);
    },
  } : {};

  return (
    <aside className="hub-folder-rail">
      <div className="hub-folder-rail__head">
        <span>Klasörler</span>
        {canWrite && (
          <button type="button" className="hub-folder-rail__add" onClick={onCreate} title="Yeni klasör">
            <AIcon name="plus" size={14} />
          </button>
        )}
      </div>
      <button type="button" className={`hub-folder-item ${selected === null ? 'hub-folder-item--on' : ''}`} onClick={onSelectAll}
        title="Klasör dahil TÜM filtreleri temizler">
        <AIcon name="layers" size={15} />
        <span className="hub-folder-item__name">Tüm Adaylar</span>
        <span className="hub-folder-item__n">{totalCount}</span>
      </button>
      <button type="button" className={`hub-folder-item ${selected === 'none' ? 'hub-folder-item--on' : ''} ${dragOver === 'none' ? 'hub-folder-item--dragover' : ''}`}
        onClick={() => onSelect('none')} {...dropProps('none')}>
        <AIcon name="folder" size={15} />
        <span className="hub-folder-item__name">Kategorisiz</span>
        <span className="hub-folder-item__n">{noneCount}</span>
      </button>
      <div className="hub-folder-rail__list">
        {sorted.map((f) => (
          <div key={f.id} className={`hub-folder-item hub-folder-item--row ${selected === f.id ? 'hub-folder-item--on' : ''} ${dragOver === f.id ? 'hub-folder-item--dragover' : ''}`}
            {...dropProps(f.id)}>
            <button type="button" className="hub-folder-item__main" onClick={() => onSelect(f.id)}>
              <AIcon name="folder" size={15} />
              <span className="hub-folder-item__name">{f.name}</span>
              <span className="hub-folder-item__n">{countFor(f.id)}</span>
            </button>
            {canWrite && (
              <button type="button" className="hub-folder-item__del" title="Klasörü sil" onClick={() => onDeleteRequest(f)}>
                <AIcon name="trash" size={12} />
              </button>
            )}
          </div>
        ))}
      </div>
      {canWrite && folders.length > 0 && (
        <div className="hub-folder-rail__hint">Bir adayı sürükleyip buraya bırakarak klasörünü değiştirebilirsin.</div>
      )}
    </aside>
  );
}

export default function CandidatesListPage({ filters, setFilters }) {
  const store = useHubStore();
  const { candidates, members, openRoles, touches, gates, currentMember, loading, folders } = store;
  const { can } = usePerms();
  const canWrite = can('candidates.write');
  const [openId, setOpenId] = useState(null);
  const [adding, setAdding] = useState(null);   // 'one' | 'import' | 'paste' | null
  const [addMenuOpen, setAddMenuOpen] = useState(false);
  const [triageIds, setTriageIds] = useState(null);   // D3
  const [actOn, setActOn] = useState(null);     // satırdan arşivle/sil için aday
  const [toast, setToast] = useState('');
  // Klasör paneli — varsayılan "Tüm Adaylar" (null): sayfaya girince (F5 dahil)
  // herkes görünür, istersen soldan bir klasöre daralt (2026-09-25 düzeltmesi
  // — eskiden hiçbir klasör seçili değilken liste kapalı duruyordu, kafa
  // karıştırıyordu).
  const [selectedFolderId, setSelectedFolderId] = useState(null);
  const [creatingFolder, setCreatingFolder] = useState(false);
  const [newFolderName, setNewFolderName] = useState('');
  const [deletingFolder, setDeletingFolder] = useState(null);
  // Satır sürükle-bırak (elle sıralama, 0047 migration: hub_candidates.sort_order).
  const [draggedId, setDraggedId] = useState(null);
  const [dragOverRowId, setDragOverRowId] = useState(null);
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
    () => ({ currentMemberId: currentMember?.id ?? null, touchesByCand, now: Date.now(), openRoles }),
    [currentMember, touchesByCand, openRoles]
  );

  const activeCount = useMemo(() => candidates.filter((c) => c.stage !== 'archived').length, [candidates]);

  // 2026-09-23 — inbound (formdan gelen) adaylar en üstte + sarı çerçeveyle ayırt
  // edilsin diye önce kaynak (inbound önce), sonra en yeni — bu, HİÇBİR adayın
  // elle sort_order'ı yokken geçerli varsayılan sıra.
  const rowsUnfiltered = useMemo(
    () => applyFilters(candidates, filters, ctx).sort((a, b) => {
      const ai = a.source === 'inbound' ? 0 : 1;
      const bi = b.source === 'inbound' ? 0 : 1;
      if (ai !== bi) return ai - bi;
      return (b.createdAt || '').localeCompare(a.createdAt || '');
    }),
    [candidates, filters, ctx]
  );
  // Klasör seçimi mevcut filtrelerin ÜSTÜNE, ayrı bir boyut olarak uygulanır;
  // sonra elle sürüklenmiş (sort_order dolu) adaylar öne, aralarında kendi
  // sırasıyla — geri kalanı yukarıdaki varsayılan sırada (stabil sort).
  const rows = useMemo(() => {
    let base = rowsUnfiltered;
    if (selectedFolderId === 'none') base = base.filter((c) => !c.folderId);
    else if (selectedFolderId) base = base.filter((c) => c.folderId === selectedFolderId);
    return [...base].sort((a, b) => {
      if (a.sortOrder != null && b.sortOrder != null) return a.sortOrder - b.sortOrder;
      if (a.sortOrder != null) return -1;
      if (b.sortOrder != null) return 1;
      return 0;
    });
  }, [rowsUnfiltered, selectedFolderId]);

  const noFilterActive = !filters.chip && !filters.stage.length && !filters.source.length
    && !filters.openRoleId.length && !(filters.interest || []).length && !filters.q.trim() && selectedFolderId === null;

  // D3 — hızlı eleme: filtre yoksa varsayılan "hiç mesaj atılmamış".
  const startTriage = () => {
    const empty = noFilterActive;
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

  const createFolder = async () => {
    if (!newFolderName.trim()) return;
    try {
      await store.addItem('folders', { name: newFolderName.trim(), createdBy: currentMember?.id || null });
      setNewFolderName('');
      setCreatingFolder(false);
    } catch (e) { flash('Klasör oluşturulamadı: ' + e.message); }
  };
  const deleteFolder = async () => {
    const f = deletingFolder;
    setDeletingFolder(null);
    try {
      await store.deleteItem('folders', f.id);
      if (selectedFolderId === f.id) setSelectedFolderId(null);
      flash(`"${f.name}" silindi — içindeki adaylar kategorisiz oldu.`);
    } catch (e) { flash('Silinemedi: ' + e.message); }
  };
  // Bir klasörün İÇİNDEYKEN "Aday Ekle" ile eklenen aday otomatik o klasöre düşer.
  const presetFolderId = (selectedFolderId && selectedFolderId !== 'none') ? selectedFolderId : null;

  // "Tüm Adaylar" — gerçekten HERKESİ göstersin diye klasörle BİRLİKTE diğer
  // tüm filtreleri de (aşama/kaynak/arama/ilgi alanı/çip — sessionStorage'da
  // kalıcı olduğu için sayfalar arası taşınmış olabilirler) temizler. Sadece
  // bir klasöre/"Kategorisiz"e tıklamak bunu yapmaz — o zaman mevcut
  // filtrelerin ÜSTÜNE eklenir (ör. "Frontend klasöründeki, Görüşme
  // aşamasındaki adaylar" gibi bir kombinasyon kasıtlı olabilir).
  const showAllCandidates = () => { setFilters({ ...EMPTY_FILTERS }); setSelectedFolderId(null); };

  // Sürükle-bırak: satırı bir klasöre bırak → o klasöre taşınır (updateItem
  // zaten mevcut kaydı `updates` ile birleştirip yazıyor, tüm nesneyi
  // göndermeye gerek yok — bkz. hub-store.jsx updateItem).
  const dropOnFolder = async (candidateId, folderId) => {
    try {
      await store.updateCandidate(candidateId, { folderId });
      flash(folderId ? 'Aday klasöre taşındı.' : 'Aday kategorisiz yapıldı.');
    } catch (e) { flash('Taşınamadı: ' + e.message); }
  };
  // Sürükle-bırak: satırı başka bir satırın üstüne bırak → o sırada araya
  // girer. Yalnızca ŞU AN GÖRÜNEN satırlar 10'ar adım yeniden numaralanır —
  // liste büyük olmadığından tam yeniden indeksleme basit ve güvenli.
  const reorderRows = async (fromId, toId) => {
    if (!fromId || fromId === toId) return;
    const list = [...rows];
    const fromIdx = list.findIndex((c) => c.id === fromId);
    const toIdx = list.findIndex((c) => c.id === toId);
    if (fromIdx === -1 || toIdx === -1) return;
    const [moved] = list.splice(fromIdx, 1);
    list.splice(toIdx, 0, moved);
    try {
      await Promise.all(list.map((c, i) => store.updateCandidate(c.id, { sortOrder: (i + 1) * 10 })));
    } catch (e) { flash('Sıralanamadı: ' + e.message); }
  };

  return (
    <div style={{ display: 'flex', gap: 20, alignItems: 'flex-start' }}>
      <FolderRail folders={folders} candidates={candidates} selected={selectedFolderId}
        onSelect={setSelectedFolderId} onSelectAll={showAllCandidates} onCreate={() => setCreatingFolder(true)}
        onDeleteRequest={setDeletingFolder} onDropCandidate={dropOnFolder} canWrite={canWrite} />

      <div style={{ flex: 1, minWidth: 0 }}>
      <PageHead title="Adaylar" desc={`${rows.length} / ${activeCount} aktif aday`} actions={
        canWrite ? (
          <div style={{ position: 'relative' }}>
            <button className="adm-btn adm-btn--primary adm-btn--sm adm-btn--cta" onClick={() => setAddMenuOpen((v) => !v)}>
              <AIcon name="plus" size={14} /> Aday Ekle
            </button>
            {addMenuOpen && (
              <>
                <div style={{ position: 'fixed', inset: 0, zIndex: 10 }} onClick={() => setAddMenuOpen(false)} />
                <div style={{
                  position: 'absolute', top: '110%', right: 0, zIndex: 11, minWidth: 210,
                  background: 'var(--adm-bg-card)', border: '1px solid var(--adm-border-light)', borderRadius: 10,
                  boxShadow: '0 8px 24px rgba(0,0,0,.14)', padding: 6, display: 'flex', flexDirection: 'column', gap: 2,
                }}>
                  {[
                    { key: 'paste', icon: 'edit', label: 'Yapıştır ve ekle', hint: 'ana yöntem' },
                    { key: 'one', icon: 'plus', label: 'Tek aday' },
                    { key: 'import', icon: 'upload', label: 'CSV' },
                    ...(can('scan.run') ? [{ key: 'github', icon: 'rocket', label: 'GitHub' }] : []),
                  ].map((opt) => (
                    <button key={opt.key} onClick={() => { setAdding(opt.key); setAddMenuOpen(false); }}
                      className="adm-btn adm-btn--ghost adm-btn--sm"
                      style={{ display: 'flex', alignItems: 'center', gap: 8, justifyContent: 'flex-start', border: 'none', width: '100%' }}>
                      <AIcon name={opt.icon} size={14} />
                      <span style={{ flex: 1, textAlign: 'left' }}>{opt.label}</span>
                      {opt.hint && <span style={{ fontSize: 10.5, color: 'var(--adm-text-dim)' }}>{opt.hint}</span>}
                    </button>
                  ))}
                </div>
              </>
            )}
          </div>
        ) : null
      } />

      <FilterBar filters={filters} onChange={setFilters} candidates={candidates} openRoles={openRoles} ctx={ctx} />

      {canWrite && rows.length > 0 && (
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
            <div key={c.id}
              className={`hub-c hub-c--tight hub-c--lead${c.source === 'inbound' ? ' hub-c--inbound' : ''}${dragOverRowId === c.id ? ' hub-c--dragover' : ''}${draggedId === c.id ? ' hub-c--dragging' : ''}`}
              style={{ '--hub-lead': STAGE_COLOR[c.stage] || '#E7E0D2', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 12 }}
              onClick={() => setOpenId(c.id)}
              draggable={canWrite}
              onDragStart={canWrite ? (e) => { setDraggedId(c.id); e.dataTransfer.effectAllowed = 'move'; e.dataTransfer.setData(DRAG_MIME, c.id); } : undefined}
              onDragEnd={canWrite ? () => { setDraggedId(null); setDragOverRowId(null); } : undefined}
              onDragOver={canWrite ? (e) => { e.preventDefault(); if (dragOverRowId !== c.id) setDragOverRowId(c.id); } : undefined}
              onDragLeave={canWrite ? () => setDragOverRowId((v) => (v === c.id ? null : v)) : undefined}
              onDrop={canWrite ? (e) => {
                e.preventDefault(); e.stopPropagation();
                const id = e.dataTransfer.getData(DRAG_MIME) || draggedId;
                setDragOverRowId(null); setDraggedId(null);
                if (id) reorderRows(id, c.id);
              } : undefined}>
              {canWrite && (
                <span className="hub-c__handle" title="Sürükleyip sıralamayı değiştir">
                  <AIcon name="gripVertical" size={15} />
                </span>
              )}
              <div className="hub-av">{initials(c.fullName)}</div>
              <div style={{ minWidth: 0, flex: 1 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                  <strong style={{ fontSize: 14, color: '#1C1917' }}>{c.fullName}</strong>
                  <span className="hub-pill hub-pill--stage">{STAGE_LABEL[c.stage] || c.stage}</span>
                  {c.source === 'inbound' && <span className="hub-pill hub-pill--inbound">Site başvurusu</span>}
                  {c.interest && <span className="hub-pill hub-pill--source">{INTEREST_LABEL[c.interest] || c.interest}</span>}
                  {selectedFolderId == null && c.folderId && (
                    <span className="hub-pill">
                      <AIcon name="folder" size={11} /> {folders.find((f) => f.id === c.folderId)?.name || '—'}
                    </span>
                  )}
                </div>
                <div style={{ fontSize: 12, color: '#A29D94', marginTop: 3 }}>
                  {SOURCE_LABEL[c.source] || c.source} · {memberName(c.ownerId)}
                  {(() => { const na = nextAction(c, touches, gates); return na ? ` · ${na.label}` : ''; })()}
                </div>
              </div>
              <RowRight c={c} touchesByCand={touchesByCand} gatesByCand={gatesByCand} />
              {canWrite && (
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
      {adding === 'one' && <NewCandidateModal presetFolderId={presetFolderId} onClose={() => setAdding(null)} />}
      {adding === 'import' && <ImportSimple presetFolderId={presetFolderId} onClose={() => setAdding(null)} />}
      {adding === 'paste' && <PasteImport presetFolderId={presetFolderId} onClose={() => setAdding(null)} />}
      {adding === 'github' && <GithubImport presetFolderId={presetFolderId} onClose={() => setAdding(null)} />}
      {triageIds && <Triage ids={triageIds} onClose={() => setTriageIds(null)} />}
      {actOn && (
        <HubWizard title={actOn.fullName} submitLabel="Uygula" onCancel={() => setActOn(null)}
          steps={rowActionSteps} onComplete={runRowAction} />
      )}
      {toast && <div className="hub-toast">{toast}</div>}
      </div>

      <Modal open={creatingFolder} onClose={() => setCreatingFolder(false)} title="Yeni klasör">
        <Field label="Klasör adı" required hint='Örn. "LLM için adaylar", "Mobil Flutter"'>
          <Input value={newFolderName} onChange={setNewFolderName} placeholder="Klasör adı" />
        </Field>
        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10, marginTop: 12 }}>
          <button className="adm-btn adm-btn--ghost" onClick={() => setCreatingFolder(false)}>İptal</button>
          <button className="adm-btn adm-btn--primary" disabled={!newFolderName.trim()} onClick={createFolder}>Oluştur</button>
        </div>
      </Modal>
      <ConfirmDialog open={!!deletingFolder} onClose={() => setDeletingFolder(null)} onConfirm={deleteFolder}
        title="Klasörü sil?" message={`"${deletingFolder?.name || ''}" silinecek — içindeki adaylar SİLİNMEZ, kategorisiz olur.`} />
    </div>
  );
}
