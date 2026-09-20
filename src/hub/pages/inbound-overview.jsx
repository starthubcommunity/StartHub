// inbound-overview.jsx — HR › Inbound › Genel Bakış: yanıt bekleyenler, haftalık akış, tür dağılımı.
import React, { useMemo } from 'react';
import { AIcon } from '../../admin/admin-ui';
import { useInbound } from '../use-inbound';
import {
  INBOUND_STAGES, INBOUND_TYPES, SIDES, computeStats, detailOf, timeAgo,
} from '../inbound-model';
import { Avatar, TypeTag, SlaDot } from '../inbound-ui';
import '../../styles/inbound.css';

const OPEN_KEY = 'sh_inbound_open';

function Delta({ cur, prev }) {
  if (cur === prev) return <span className="ib-delta ib-delta--flat">= geçen hafta</span>;
  const up = cur > prev;
  return <span className={`ib-delta ib-delta--${up ? 'up' : 'down'}`}>{up ? '▲' : '▼'} {Math.abs(cur - prev)} geçen haftaya göre</span>;
}

const weekLabel = (t) => new Date(t).toLocaleDateString('tr-TR', { day: 'numeric', month: 'short' });

export default function InboundOverviewPage({ onGoto }) {
  const { apps, loading, error } = useInbound();
  const stats = useMemo(() => computeStats(apps), [apps]);

  const waiting = useMemo(
    () => apps.filter((a) => a.stage === 'new').sort((a, b) => new Date(a.createdAt || 0) - new Date(b.createdAt || 0)).slice(0, 8),
    [apps]
  );
  const open = (id) => {
    try { sessionStorage.setItem(OPEN_KEY, String(id)); } catch { /* yok say */ }
    onGoto('inbound');
  };

  const types = INBOUND_TYPES.map((t) => ({ ...t, n: stats.byType[t.value] || 0 })).filter((t) => t.n > 0).sort((a, b) => b.n - a.n);
  const maxType = Math.max(1, ...types.map((t) => t.n));
  const maxWeek = Math.max(1, ...stats.weeks.map((w) => w.hub + w.lab + w.other));
  const teamAreas = useMemo(() => {
    const m = {};
    for (const a of apps) if (a.intent === 'club_team' && a.role) m[a.role] = (m[a.role] || 0) + 1;
    return Object.entries(m).sort((a, b) => b[1] - a[1]);
  }, [apps]);
  const stageBars = INBOUND_STAGES.map((s) => ({ ...s, n: stats.byStage[s.value] }));
  const maxStage = Math.max(1, ...stageBars.map((s) => s.n));

  if (error) return <div className="ib-empty"><b>Başvurular yüklenemedi</b>{error}</div>;

  return (
    <div className="ib">
      <div className="ib-page-head">
        <div>
          <div className="ib-title">Inbound — Genel Bakış</div>
          <div className="ib-sub">Katıl formundan gelen başvurular. Her başvuru kendi hattında, Outbound aday havuzundan bağımsız değerlendirilir.</div>
        </div>
        <div className="ib-tools">
          <button className="adm-btn adm-btn--primary adm-btn--sm" onClick={() => onGoto('inbound')}>Başvuruları aç <AIcon name="arrowRight" size={14} /></button>
        </div>
      </div>

      {loading ? (
        <div className="ib-kpis">{[0, 1, 2, 3].map((i) => <div key={i} className="ib-skel" />)}</div>
      ) : (
        <>
          <div className="ib-kpis">
            <div className="ib-kpi" style={{ '--k': '#2563EB' }}>
              <div className="ib-kpi__label">Yanıt bekleyen</div>
              <div className="ib-kpi__val">{stats.byStage.new}</div>
              <div className="ib-kpi__note">{stats.overdue > 0
                ? <span className="ib-delta ib-delta--down">{stats.overdue} tanesi 48 saati geçti</span>
                : <span className="ib-delta ib-delta--up">SLA içinde</span>}</div>
            </div>
            <div className="ib-kpi" style={{ '--k': '#DC2626' }}>
              <div className="ib-kpi__label">Bu hafta gelen</div>
              <div className="ib-kpi__val">{stats.thisWeek}</div>
              <div className="ib-kpi__note"><Delta cur={stats.thisWeek} prev={stats.lastWeek} /></div>
            </div>
            <div className="ib-kpi" style={{ '--k': '#7C3AED' }}>
              <div className="ib-kpi__label">Aktif süreç</div>
              <div className="ib-kpi__val">{stats.active}</div>
              <div className="ib-kpi__note">{stats.byStage.reviewed} inceleme · {stats.byStage.interview} görüşme</div>
            </div>
            <div className="ib-kpi" style={{ '--k': '#16A34A' }}>
              <div className="ib-kpi__label">Kabul oranı</div>
              <div className="ib-kpi__val">{stats.acceptRate == null ? '—' : `%${stats.acceptRate}`}</div>
              <div className="ib-kpi__note">{stats.byStage.accepted} kabul · {stats.byStage.rejected} red · {stats.byStage.waitlist} havuzda</div>
            </div>
          </div>

          <div className="ib-grid">
            <div className="ib-card">
              <h3>Yanıt bekleyenler <small>en eski önce</small></h3>
              {waiting.length === 0 ? (
                <div className="ib-empty" style={{ padding: '28px 12px' }}><b>Bekleyen başvuru yok</b>Tüm başvurulara bakılmış.</div>
              ) : waiting.map((a) => (
                <button key={a.id} className="ib-wait" onClick={() => open(a.id)}>
                  <Avatar app={a} />
                  <span className="ib-wait__main">
                    <span className="ib-wait__name" style={{ display: 'block' }}>{a.name}</span>
                    <span className="ib-wait__sub" style={{ display: 'block' }}>{detailOf(a) || a.email}</span>
                  </span>
                  <TypeTag app={a} />
                  <span style={{ fontSize: 12, color: 'var(--adm-text-dim)', display: 'inline-flex', alignItems: 'center', gap: 6, whiteSpace: 'nowrap' }}>
                    <SlaDot app={a} />{timeAgo(a.createdAt)}
                  </span>
                </button>
              ))}
              {stats.byStage.new > waiting.length && (
                <div style={{ fontSize: 12.5, color: 'var(--adm-text-dim)', paddingTop: 10 }}>+{stats.byStage.new - waiting.length} başvuru daha — Başvurular ekranında.</div>
              )}
            </div>

            <div className="ib-stack">
              <div className="ib-card">
                <h3>Haftalık akış <small>son 8 hafta</small></h3>
                <div className="ib-weeks">
                  {stats.weeks.map((w) => {
                    const total = w.hub + w.lab + w.other;
                    return (
                      <div key={w.start} className="ib-week" title={`${weekLabel(w.start)} haftası — Hub ${w.hub}, Lab ${w.lab}, Diğer ${w.other}`}>
                        <span className="ib-week__n">{total || ''}</span>
                        <div className="ib-week__col" style={{ height: `${Math.max(3, (total / maxWeek) * 100)}%` }}>
                          {['hub', 'lab', 'other'].map((k) => w[k] > 0 && <i key={k} style={{ background: SIDES[k].color, height: `${(w[k] / total) * 100}%` }} />)}
                        </div>
                        <span className="ib-week__l">{weekLabel(w.start)}</span>
                      </div>
                    );
                  })}
                </div>
                <div className="ib-legend">
                  {['hub', 'lab', 'other'].map((k) => <span key={k}><i style={{ background: SIDES[k].color }} />{SIDES[k].label}</span>)}
                </div>
              </div>

              <div className="ib-card">
                <h3>Aşama dağılımı <small>{stats.total} başvuru</small></h3>
                <div className="ib-bars">
                  {stageBars.map((s) => (
                    <div key={s.value} className="ib-bar">
                      <span className="ib-bar__label">{s.label}</span>
                      <span className="ib-bar__track"><span className="ib-bar__fill" style={{ width: `${(s.n / maxStage) * 100}%`, background: s.color }} /></span>
                      <span className="ib-bar__n">{s.n}</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            <div className="ib-card">
              <h3>Türe göre <small>tüm zamanlar</small></h3>
              {types.length === 0 ? <div className="ib-empty" style={{ padding: 20 }}>Veri yok</div> : (
                <div className="ib-bars">
                  {types.map((t) => (
                    <div key={t.value} className="ib-bar">
                      <span className="ib-bar__label">{t.label}</span>
                      <span className="ib-bar__track"><span className="ib-bar__fill" style={{ width: `${(t.n / maxType) * 100}%`, background: SIDES[t.side].color }} /></span>
                      <span className="ib-bar__n">{t.n}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div className="ib-card">
              <h3>Kulüp ekip alanları <small>Hub › Ekip Üyesi</small></h3>
              {teamAreas.length === 0 ? <div className="ib-empty" style={{ padding: 20 }}>Henüz ekip başvurusu yok</div> : (
                <div className="ib-bars">
                  {teamAreas.map(([name, n]) => (
                    <div key={name} className="ib-bar">
                      <span className="ib-bar__label">{name}</span>
                      <span className="ib-bar__track"><span className="ib-bar__fill" style={{ width: `${(n / teamAreas[0][1]) * 100}%`, background: SIDES.hub.color }} /></span>
                      <span className="ib-bar__n">{n}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </>
      )}
    </div>
  );
}
