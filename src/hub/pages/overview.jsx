// overview.jsx — HR › Genel Bakış: Outbound (aday avı) ve Inbound (form başvuruları) tek ekranda.
// Komuta merkezi: iki hattın özeti, "dikkat gerektirenler" ortak akışı, huni, haftalık akış,
// son katılanlar, açık pozisyonlar. Yalnızca OKUR — aksiyonlar ilgili hat ekranlarında.
import React, { useMemo } from 'react';
import { AIcon } from '../../admin/admin-ui';
import { usePerms } from '../../lib/use-perms';
import { useHubStore } from '../hub-store';
import { useInbound } from '../use-inbound';
import { isStale, gateStatus, thresholdMet, rubricCompleteFor } from '../hub-rules';
import { STAGES, STAGE_LABEL } from '../hub-constants';
import {
  INBOUND_STAGES, computeStats, detailOf, timeAgo, slaState, initials,
} from '../inbound-model';
import '../../styles/inbound.css';

const OPEN_KEY = 'sh_inbound_open';
const C_IN = '#0D9488';   // Inbound
const C_OUT = '#4F46E5';  // Outbound
const H = 3600 * 1000;

const weekStart = (t) => {
  const d = new Date(t); d.setHours(0, 0, 0, 0);
  d.setDate(d.getDate() - ((d.getDay() + 6) % 7));
  return d.getTime();
};
const today = () => new Date().toLocaleDateString('tr-TR', { weekday: 'long', day: 'numeric', month: 'long' });

function Mini({ label, value, note, color }) {
  return (
    <div className="ov-mini" style={{ '--k': color }}>
      <div className="ov-mini__label">{label}</div>
      <div className="ov-mini__val">{value}</div>
      {note && <div className="ov-mini__note">{note}</div>}
    </div>
  );
}

function Funnel({ rows, color }) {
  const max = Math.max(1, ...rows.map((r) => r.n));
  return (
    <div className="ib-bars" style={{ marginTop: 14 }}>
      {rows.map((r) => (
        <div key={r.key} className="ib-bar" style={{ gridTemplateColumns: '92px 1fr 30px' }}>
          <span className="ib-bar__label">{r.label}</span>
          <span className="ib-bar__track"><span className="ib-bar__fill" style={{ width: `${(r.n / max) * 100}%`, background: r.color || color }} /></span>
          <span className="ib-bar__n">{r.n}</span>
        </div>
      ))}
    </div>
  );
}

export default function OverviewPage({ onGoto }) {
  const { can } = usePerms();
  const showOut = can('candidates.read');
  const showIn = can('applications.read');
  const store = useHubStore();
  const inbound = useInbound();
  const { candidates, touches, gates, openRoles } = store;
  const now = Date.now();
  const wk = weekStart(now);

  // ── Outbound ──
  const out = useMemo(() => {
    const byId = Object.fromEntries(candidates.map((c) => [c.id, c]));
    const active = candidates.filter((c) => c.stage !== 'archived');
    const roleOf = (c) => openRoles.find((r) => r.id === c.openRoleId) || null;
    const attention = [];
    const seen = new Set();
    const push = (c, key, sev, tag, sub) => {
      if (seen.has(`${c.id}:${key}`)) return; seen.add(`${c.id}:${key}`);
      attention.push({ kind: 'out', id: `${c.id}:${key}`, sev, name: c.fullName, tag, sub, at: now });
    };
    for (const c of active) {
      if (c.stage === 'member') continue;
      const s = isStale(c, now);
      if (s.stale) push(c, 'stale', s.level === 'critical' ? 2 : 1, 'Hareketsiz', `${STAGE_LABEL[c.stage]} · ${s.days} gündür değişiklik yok`);
      if (c.stage === 'interview' && rubricCompleteFor(c, roleOf(c)) && thresholdMet(c, roleOf(c))) push(c, 'decide', 1, 'Karar bekliyor', 'Rubrik tamam, eşik geçildi');
      if (c.presentedAt && (!c.ownerDecision || c.ownerDecision === 'pending')) push(c, 'present', 1, 'Karar bekliyor', 'Proje sahibine sunuldu');
    }
    for (const g of gates) {
      const c = byId[g.candidateId];
      if (!c || g.result !== 'pending') continue;
      const st = gateStatus(g, now);
      if (st === 'overdue') push(c, 'gate', 2, 'Kapı süresi doldu', 'Deneme görevi teslim edilmedi');
      else if (st === 'due') push(c, 'gate', 1, 'Kapı vadesi geldi', 'Deneme görevi bugün bitiyor');
    }
    for (const t of touches) {
      const c = byId[t.candidateId];
      if (c && c.stage === 'contact' && t.outcome === 'pending' && t.followUpAt && new Date(t.followUpAt).getTime() <= now) push(c, 'follow', 1, 'Takip zamanı', 'Cevap bekleniyor');
    }
    const funnel = STAGES.map((s) => ({ key: s.value, label: s.label, n: candidates.filter((c) => c.stage === s.value).length }));
    return {
      total: active.length,
      member: candidates.filter((c) => c.stage === 'member').length,
      touchesWeek: touches.filter((t) => t.sentAt && new Date(t.sentAt).getTime() >= wk).length,
      addedWeek: candidates.filter((c) => c.createdAt && new Date(c.createdAt).getTime() >= wk).length,
      attention, funnel,
    };
  }, [candidates, touches, gates, openRoles]); // eslint-disable-line react-hooks/exhaustive-deps

  // ── Inbound ──
  const stats = useMemo(() => computeStats(inbound.apps, now), [inbound.apps]); // eslint-disable-line react-hooks/exhaustive-deps
  const inAttention = useMemo(() => inbound.apps.filter((a) => slaState(a, now)).map((a) => ({
    kind: 'in', id: `in:${a.id}`, appId: a.id, sev: slaState(a, now) === 'critical' ? 2 : 1, name: a.name,
    tag: 'Yanıt bekliyor', sub: `${a.type.label} · ${timeAgo(a.createdAt, now)} geldi`, at: new Date(a.createdAt || 0).getTime(),
  })), [inbound.apps]); // eslint-disable-line react-hooks/exhaustive-deps

  const attention = useMemo(() => [...(showIn ? inAttention : []), ...(showOut ? out.attention : [])]
    .sort((a, b) => b.sev - a.sev || (a.at || 0) - (b.at || 0)), [inAttention, out.attention, showIn, showOut]);

  // ── Haftalık akış (8 hafta): Outbound'a eklenen aday vs Inbound'a gelen başvuru ──
  const weeks = useMemo(() => {
    const arr = [];
    for (let i = 7; i >= 0; i--) arr.push({ start: wk - i * 7 * 24 * H, out: 0, inb: 0 });
    const put = (iso, k) => {
      const t = iso ? new Date(iso).getTime() : 0;
      const w = arr.find((x) => t >= x.start && t < x.start + 7 * 24 * H);
      if (w) w[k] += 1;
    };
    if (showOut) candidates.forEach((c) => put(c.createdAt, 'out'));
    if (showIn) inbound.apps.forEach((a) => put(a.createdAt, 'inb'));
    return arr;
  }, [candidates, inbound.apps, showOut, showIn]); // eslint-disable-line react-hooks/exhaustive-deps
  const maxWeek = Math.max(1, ...weeks.map((w) => Math.max(w.out, w.inb)));

  // ── Son katılanlar ──
  const joined = useMemo(() => {
    const a = showIn ? inbound.apps.filter((x) => x.stage === 'accepted').map((x) => ({
      key: `in${x.id}`, name: x.name, hat: 'Inbound', sub: `${x.type.label} · ${detailOf(x)}`.replace(/ · $/, ''), at: x.stageChangedAt || x.createdAt,
    })) : [];
    const b = showOut ? candidates.filter((x) => x.stage === 'member').map((x) => ({
      key: `out${x.id}`, name: x.fullName, hat: 'Outbound', sub: 'Ekipte', at: x.joinedAt || x.stageChangedAt,
    })) : [];
    return [...a, ...b].sort((p, q) => new Date(q.at || 0) - new Date(p.at || 0)).slice(0, 6);
  }, [inbound.apps, candidates, showIn, showOut]);

  const roles = useMemo(() => openRoles.filter((r) => r.status === 'sourcing').slice(0, 5).map((r) => ({
    id: r.id, title: r.title, n: candidates.filter((c) => c.openRoleId === r.id && c.stage !== 'archived').length,
  })), [openRoles, candidates]);

  const openItem = (it) => {
    if (it.kind === 'in') { try { sessionStorage.setItem(OPEN_KEY, String(it.appId)); } catch { /* yok say */ } onGoto('inbound'); }
    else onGoto('today');
  };

  const loading = store.loading || (showIn && inbound.loading);

  return (
    <div className="ib">
      <div className="ib-page-head">
        <div>
          <div className="ib-title">Genel Bakış</div>
          <div className="ib-sub" style={{ textTransform: 'capitalize' }}>{today()}</div>
        </div>
        <div className="ib-tools">
          {showIn && <button className="adm-btn adm-btn--ghost adm-btn--sm" onClick={() => onGoto('inbound')}><span className="ib-dot" style={{ background: C_IN }} /> Inbound</button>}
          {showOut && <button className="adm-btn adm-btn--ghost adm-btn--sm" onClick={() => onGoto('today')}><span className="ib-dot" style={{ background: C_OUT }} /> Outbound</button>}
        </div>
      </div>

      {loading ? (
        <div className="ov-hats">{[0, 1].map((i) => <div key={i} className="ib-skel" style={{ height: 300 }} />)}</div>
      ) : (
        <>
          <div className="ov-hats">
            {showIn && (
              <section className="ov-hat" style={{ '--h': C_IN }}>
                <header>
                  <span className="ov-hat__name"><i />Inbound <small>Form başvuruları</small></span>
                  <button className="ov-link" onClick={() => onGoto('inbound-overview')}>Ayrıntı <AIcon name="arrowRight" size={13} /></button>
                </header>
                <div className="ov-minis">
                  <Mini label="Yanıt bekleyen" value={stats.byStage.new} color={C_IN}
                    note={stats.overdue ? <b style={{ color: '#DC2626' }}>{stats.overdue} SLA aşımı</b> : 'SLA içinde'} />
                  <Mini label="Bu hafta gelen" value={stats.thisWeek} color={C_IN} note={`geçen hafta ${stats.lastWeek}`} />
                  <Mini label="Aktif süreç" value={stats.active} color={C_IN} note={`${stats.byStage.waitlist} havuzda`} />
                  <Mini label="Kabul oranı" value={stats.acceptRate == null ? '—' : `%${stats.acceptRate}`} color={C_IN} note={`${stats.byStage.accepted} kabul`} />
                </div>
                <Funnel color={C_IN} rows={INBOUND_STAGES.map((s) => ({ key: s.value, label: s.label, n: stats.byStage[s.value], color: s.color }))} />
              </section>
            )}
            {showOut && (
              <section className="ov-hat" style={{ '--h': C_OUT }}>
                <header>
                  <span className="ov-hat__name"><i />Outbound <small>Aday avı</small></span>
                  <button className="ov-link" onClick={() => onGoto('candidates')}>Ayrıntı <AIcon name="arrowRight" size={13} /></button>
                </header>
                <div className="ov-minis">
                  <Mini label="Aktif aday" value={out.total} color={C_OUT} note={`bu hafta +${out.addedWeek}`} />
                  <Mini label="Dikkat bekleyen" value={out.attention.length} color={C_OUT} note={out.attention.some((a) => a.sev === 2) ? <b style={{ color: '#DC2626' }}>acil olan var</b> : 'acil yok'} />
                  <Mini label="Bu hafta temas" value={out.touchesWeek} color={C_OUT} note="gönderilen mesaj" />
                  <Mini label="Ekipte" value={out.member} color={C_OUT} note="hak ediş başlamış" />
                </div>
                <Funnel color={C_OUT} rows={out.funnel} />
              </section>
            )}
          </div>

          <div className="ib-grid" style={{ marginTop: 14 }}>
            <div className="ib-card">
              <h3>Dikkat gerektirenler <small>{attention.length} kayıt · acil olan üstte</small></h3>
              {attention.length === 0 ? (
                <div className="ib-empty" style={{ padding: '28px 12px' }}><b>Her şey yolunda</b>Bekleyen ya da geciken bir iş yok.</div>
              ) : attention.slice(0, 9).map((it) => (
                <button key={it.id} className="ib-wait" onClick={() => openItem(it)}>
                  <span className="ov-kind" style={{ background: it.kind === 'in' ? C_IN : C_OUT }} title={it.kind === 'in' ? 'Inbound' : 'Outbound'} />
                  <span className="ib-wait__main">
                    <span className="ib-wait__name" style={{ display: 'block' }}>{it.name}</span>
                    <span className="ib-wait__sub" style={{ display: 'block' }}>{it.sub}</span>
                  </span>
                  <span className={`ov-sev ov-sev--${it.sev}`}>{it.tag}</span>
                </button>
              ))}
              {attention.length > 9 && <div style={{ fontSize: 12.5, color: 'var(--adm-text-dim)', paddingTop: 10 }}>+{attention.length - 9} kayıt daha — ilgili hat ekranlarında.</div>}
            </div>

            <div className="ib-card">
              <h3>Haftalık akış <small>son 8 hafta</small></h3>
              <div className="ov-weeks">
                {weeks.map((w) => (
                  <div key={w.start} className="ov-week" title={`${new Date(w.start).toLocaleDateString('tr-TR', { day: 'numeric', month: 'short' })} — Inbound ${w.inb}, Outbound ${w.out}`}>
                    <div className="ov-week__cols">
                      {showIn && <i style={{ height: `${Math.max(3, (w.inb / maxWeek) * 100)}%`, background: C_IN }} />}
                      {showOut && <i style={{ height: `${Math.max(3, (w.out / maxWeek) * 100)}%`, background: C_OUT }} />}
                    </div>
                    <span className="ib-week__l">{new Date(w.start).toLocaleDateString('tr-TR', { day: 'numeric', month: 'short' })}</span>
                  </div>
                ))}
              </div>
              <div className="ib-legend">
                {showIn && <span><i style={{ background: C_IN }} />Inbound başvuru</span>}
                {showOut && <span><i style={{ background: C_OUT }} />Outbound aday</span>}
              </div>
            </div>

            <div className="ib-card">
              <h3>Son katılanlar <small>iki hat birlikte</small></h3>
              {joined.length === 0 ? <div className="ib-empty" style={{ padding: 20 }}>Henüz kimse katılmadı</div> : joined.map((j) => (
                <div key={j.key} className="ib-wait" style={{ cursor: 'default' }}>
                  <span className="ib-av" style={{ '--c': j.hat === 'Inbound' ? C_IN : C_OUT, '--bg': j.hat === 'Inbound' ? '#F0FDFA' : '#EEF2FF' }}>{initials(j.name)}</span>
                  <span className="ib-wait__main">
                    <span className="ib-wait__name" style={{ display: 'block' }}>{j.name}</span>
                    <span className="ib-wait__sub" style={{ display: 'block' }}>{j.sub}</span>
                  </span>
                  <span className="ov-sev" style={{ background: j.hat === 'Inbound' ? '#F0FDFA' : '#EEF2FF', color: j.hat === 'Inbound' ? C_IN : C_OUT }}>{j.hat}</span>
                  <span style={{ fontSize: 12, color: 'var(--adm-text-dim)', whiteSpace: 'nowrap' }}>{timeAgo(j.at, now)}</span>
                </div>
              ))}
            </div>

            {showOut && (
              <div className="ib-card">
                <h3>Açık pozisyonlar <small>yayında olanlar</small></h3>
                {roles.length === 0 ? <div className="ib-empty" style={{ padding: 20 }}>Yayında pozisyon yok</div> : (
                  <div className="ib-bars">
                    {roles.map((r) => (
                      <div key={r.id} className="ib-bar" style={{ gridTemplateColumns: '1fr 90px' }}>
                        <span className="ib-bar__label">{r.title}</span>
                        <span style={{ textAlign: 'right', fontWeight: 700, fontSize: 12.5 }}>{r.n} aday</span>
                      </div>
                    ))}
                  </div>
                )}
                <button className="ov-link" style={{ marginTop: 12 }} onClick={() => onGoto('roles')}>Tüm pozisyonlar <AIcon name="arrowRight" size={13} /></button>
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );
}
