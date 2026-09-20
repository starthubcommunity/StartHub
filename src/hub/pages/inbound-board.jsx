// inbound-board.jsx — HR › Inbound › Başvurular: pano (sürükle-bırak) + liste + detay çekmecesi.
// Veri: applications tablosu (web formu). Outbound aday hattından bağımsızdır.
import React, { useState, useMemo, useEffect, useRef, useCallback } from 'react';
import { AIcon } from '../../admin/admin-ui';
import { usePerms } from '../../lib/use-perms';
import { useInbound } from '../use-inbound';
import {
  INBOUND_STAGES, INBOUND_STAGE_MAP, INBOUND_TYPES, SIDES, detailOf, timeAgo,
} from '../inbound-model';
import { Avatar, TypeTag, StageTag, Stars, SlaDot, OwnerBadge, AppDrawer, Toast } from '../inbound-ui';
import '../../styles/inbound.css';

const BOARD_STAGES = INBOUND_STAGES.map((s) => s.value);
const COL_CAP = 40;
const OPEN_KEY = 'sh_inbound_open';
const VIEW_KEY = 'sh_ib_view';

const sortFor = (stage) => (a, b) => {
  if (stage === 'new') return new Date(a.createdAt || 0) - new Date(b.createdAt || 0); // en eski üstte (SLA)
  return new Date(b.stageChangedAt || b.createdAt || 0) - new Date(a.stageChangedAt || a.createdAt || 0);
};

function AppCard({ app, dragging, canWrite, onOpen, onDragStart, onDragEnd }) {
  return (
    <div className={`ib-card-app${dragging ? ' ib-card-app--drag' : ''}`} draggable={canWrite}
      onClick={() => onOpen(app.id)} onDragStart={(e) => onDragStart(e, app.id)} onDragEnd={onDragEnd}>
      <div className="ib-card-app__top">
        <Avatar app={app} />
        <div style={{ minWidth: 0, flex: 1 }}>
          <div className="ib-card-app__name">{app.name}</div>
        </div>
        <OwnerBadge email={app.ownerEmail} />
      </div>
      <div className="ib-card-app__detail">{detailOf(app) || '—'}</div>
      <div className="ib-card-app__foot">
        <TypeTag app={app} />
        <Stars value={app.rating} />
        <span className="ib-card-app__time"><SlaDot app={app} />{timeAgo(app.stage === 'new' ? app.createdAt : (app.stageChangedAt || app.createdAt))}</span>
      </div>
    </div>
  );
}

export default function InboundBoardPage() {
  const { can } = usePerms();
  const canWrite = can('applications.write');
  const api = useInbound();
  const { apps, loading, error, me } = api;

  const [view, setView] = useState(() => { try { return sessionStorage.getItem(VIEW_KEY) || 'board'; } catch { return 'board'; } });
  const [side, setSide] = useState('all');
  const [type, setType] = useState('all');
  const [mineOnly, setMineOnly] = useState(false);
  const [q, setQ] = useState('');
  const [selectedId, setSelectedId] = useState(null);
  const [startReject, setStartReject] = useState(false);
  const [dragId, setDragId] = useState(null);
  const [overCol, setOverCol] = useState(null);
  const [toast, setToast] = useState(null);
  const toastTimer = useRef(null);

  const flash = useCallback((msg, err) => {
    setToast({ msg, err });
    clearTimeout(toastTimer.current);
    toastTimer.current = setTimeout(() => setToast(null), 2600);
  }, []);

  useEffect(() => { try { sessionStorage.setItem(VIEW_KEY, view); } catch { /* yok say */ } }, [view]);

  // Genel Bakış'tan "aç" ile gelinmişse ilgili kaydı çekmecede aç.
  useEffect(() => {
    if (loading) return;
    let id = null;
    try { id = sessionStorage.getItem(OPEN_KEY); sessionStorage.removeItem(OPEN_KEY); } catch { /* yok say */ }
    if (id && apps.some((a) => String(a.id) === id)) setSelectedId(apps.find((a) => String(a.id) === id).id);
  }, [loading]); // eslint-disable-line react-hooks/exhaustive-deps

  // ── filtreleme ──
  const base = useMemo(() => {
    const needle = q.trim().toLocaleLowerCase('tr');
    return apps.filter((a) => {
      if (side !== 'all' && a.side !== side) return false;
      if (mineOnly && a.ownerEmail !== me) return false;
      if (needle && !`${a.name} ${a.email} ${detailOf(a)} ${a.university} ${a.skills}`.toLocaleLowerCase('tr').includes(needle)) return false;
      return true;
    });
  }, [apps, side, mineOnly, me, q]);
  const filtered = useMemo(() => (type === 'all' ? base : base.filter((a) => a.intent === type)), [base, type]);

  const typeCounts = useMemo(() => {
    const m = {};
    for (const a of base) m[a.intent] = (m[a.intent] || 0) + 1;
    return m;
  }, [base]);
  const sideCounts = useMemo(() => {
    const m = { all: apps.length, hub: 0, lab: 0, other: 0 };
    for (const a of apps) m[a.side] += 1;
    return m;
  }, [apps]);

  const visibleTypes = INBOUND_TYPES.filter((t) => (side === 'all' || t.side === side) && (typeCounts[t.value] || type === t.value));

  const byStage = useMemo(() => {
    const m = Object.fromEntries(BOARD_STAGES.map((s) => [s, []]));
    for (const a of filtered) m[a.stage].push(a);
    for (const s of BOARD_STAGES) m[s].sort(sortFor(s));
    return m;
  }, [filtered]);

  const selected = apps.find((a) => a.id === selectedId) || null;

  // ── sürükle-bırak ──
  const onDragStart = (e, id) => { setDragId(id); e.dataTransfer.effectAllowed = 'move'; try { e.dataTransfer.setData('text/plain', String(id)); } catch { /* yok say */ } };
  const onDragEnd = () => { setDragId(null); setOverCol(null); };
  const onDrop = async (stage) => {
    const id = dragId;
    onDragEnd();
    const a = apps.find((x) => x.id === id);
    if (!a || a.stage === stage || !canWrite) return;
    if (stage === 'rejected') { setStartReject(true); setSelectedId(id); return; } // sebep sorulsun
    const err = await api.changeStage(id, stage);
    if (err) flash(`Kaydedilemedi: ${err}`, true); else flash(`${a.name} → ${INBOUND_STAGE_MAP[stage].label}`);
  };
  const openApp = (id) => { setStartReject(false); setSelectedId(id); };

  if (!can('applications.read')) return <div className="adm-empty">Bu ekran için yetkin yok.</div>;

  return (
    <div className="ib">
      <div className="ib-page-head">
        <div>
          <div className="ib-title">Başvurular</div>
          <div className="ib-sub">Web formundan gelen her başvuru burada, Outbound aday hattından ayrı olarak değerlendirilir.</div>
        </div>
        <div className="ib-tools">
          <div className="ib-seg">
            <button className={view === 'board' ? 'on' : ''} onClick={() => setView('board')}><AIcon name="layers" size={14} /> Pano</button>
            <button className={view === 'list' ? 'on' : ''} onClick={() => setView('list')}><AIcon name="menu" size={14} /> Liste</button>
          </div>
          <button className="adm-btn adm-btn--ghost adm-btn--sm" onClick={api.reload} title="Yenile"><AIcon name="refresh" size={14} /> Yenile</button>
        </div>
      </div>

      <div className="ib-filters">
        <div className="ib-frow">
          {[['all', 'Tümü'], ['hub', 'Hub'], ['lab', 'Lab'], ['other', 'Mentör / Destekçi']].map(([k, label]) => (
            <button key={k} className={`ib-chip${side === k ? ' on' : ''}`} onClick={() => { setSide(k); setType('all'); }}>
              {k !== 'all' && <span className="ib-dot" style={{ background: SIDES[k].color }} />}{label}<span className="n">{sideCounts[k]}</span>
            </button>
          ))}
          <span style={{ flex: 1 }} />
          <label className="ib-chip" style={{ cursor: 'pointer' }}>
            <input type="checkbox" checked={mineOnly} onChange={(e) => setMineOnly(e.target.checked)} style={{ accentColor: '#DC2626' }} /> Benim
          </label>
          <div className="ib-search">
            <AIcon name="search" size={15} />
            <input placeholder="İsim, e-posta, ekip, beceri…" value={q} onChange={(e) => setQ(e.target.value)} />
          </div>
        </div>
        {visibleTypes.length > 1 && (
          <div className="ib-frow">
            <button className={`ib-chip${type === 'all' ? ' on' : ''}`} onClick={() => setType('all')}>Tüm türler</button>
            {visibleTypes.map((t) => (
              <button key={t.value} className={`ib-chip${type === t.value ? ' on' : ''}`} onClick={() => setType(type === t.value ? 'all' : t.value)}>
                <AIcon name={t.icon} size={13} />{t.label}<span className="n">{typeCounts[t.value] || 0}</span>
              </button>
            ))}
          </div>
        )}
      </div>

      {error && <div className="ib-empty"><b>Başvurular yüklenemedi</b>{error}</div>}

      {loading ? (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 12 }}>
          {[0, 1, 2, 3].map((i) => <div key={i} className="ib-skel" style={{ height: 220 }} />)}
        </div>
      ) : !error && apps.length === 0 ? (
        <div className="ib-empty"><b>Henüz başvuru yok</b>Katıl sayfasından gelen ilk başvuru burada görünecek.</div>
      ) : view === 'board' ? (
        <div className="ib-board">
          {BOARD_STAGES.map((st) => {
            const s = INBOUND_STAGE_MAP[st];
            const list = byStage[st];
            return (
              <div key={st} className={`ib-col${overCol === st ? ' ib-col--over' : ''}${st === 'rejected' ? ' ib-col--slim' : ''}`} style={{ '--c': s.color }}
                onDragOver={(e) => { if (canWrite && dragId) { e.preventDefault(); setOverCol(st); } }}
                onDragLeave={() => setOverCol((c) => (c === st ? null : c))}
                onDrop={(e) => { e.preventDefault(); onDrop(st); }}>
                <div className="ib-col__head" title={s.hint}><b />{s.label}<span className="ib-col__count">{list.length}</span></div>
                {list.length === 0 ? (
                  <div className="ib-col__empty">{st === 'new' ? 'Yeni başvuru yok 🎉' : 'Boş'}</div>
                ) : (
                  <div className="ib-col__cards">
                    {list.slice(0, COL_CAP).map((a) => (
                      <AppCard key={a.id} app={a} dragging={dragId === a.id} canWrite={canWrite}
                        onOpen={openApp} onDragStart={onDragStart} onDragEnd={onDragEnd} />
                    ))}
                    {list.length > COL_CAP && <div style={{ fontSize: 12, textAlign: 'center', color: 'var(--adm-text-dim)', padding: 6 }}>+{list.length - COL_CAP} kayıt daha — Liste görünümünde</div>}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      ) : (
        <div className="ib-tablewrap">
          {filtered.length === 0 ? <div className="ib-empty"><b>Sonuç yok</b>Filtreleri değiştirip tekrar dene.</div> : (
            <table className="ib-table">
              <thead><tr><th>Başvuran</th><th>Tür</th><th>Detay</th><th>Aşama</th><th>Puan</th><th>Sahip</th><th>Tarih</th></tr></thead>
              <tbody>
                {[...filtered].sort((a, b) => new Date(b.createdAt || 0) - new Date(a.createdAt || 0)).map((a) => (
                  <tr key={a.id} onClick={() => openApp(a.id)}>
                    <td><div className="ib-cell-name"><Avatar app={a} /><div><b>{a.name}</b><span>{a.email}</span></div></div></td>
                    <td><TypeTag app={a} /></td>
                    <td className="ib-muted" style={{ maxWidth: 260 }}>{detailOf(a)}</td>
                    <td onClick={(e) => e.stopPropagation()}>
                      {canWrite ? (
                        <select className="ib-select" value={a.stage}
                          onChange={async (e) => {
                            if (e.target.value === 'rejected') { setStartReject(true); setSelectedId(a.id); return; }
                            const err = await api.changeStage(a.id, e.target.value);
                            if (err) flash(`Kaydedilemedi: ${err}`, true);
                          }}>
                          {INBOUND_STAGES.map((s) => <option key={s.value} value={s.value}>{s.label}</option>)}
                        </select>
                      ) : <StageTag stage={a.stage} />}
                    </td>
                    <td><Stars value={a.rating} /></td>
                    <td><OwnerBadge email={a.ownerEmail} /></td>
                    <td className="ib-muted" style={{ whiteSpace: 'nowrap' }}><SlaDot app={a} /> {timeAgo(a.createdAt)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      )}

      {selected && (
        <AppDrawer key={selected.id + String(startReject)} app={selected} api={api} canWrite={canWrite}
          startReject={startReject} onClose={() => { setSelectedId(null); setStartReject(false); }} onToast={flash} />
      )}
      <Toast toast={toast} />
    </div>
  );
}
