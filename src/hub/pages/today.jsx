// today.jsx — Genel Bakış = Dashboard.
// 2026-09-24: 5-7 ayrı iş bloğu + QueueModal kuyruk-yürüme akışı yerine tek
// birleşik "Bugün Yapılacaklar" listesi + tıklanabilir özet kartları getirildi.
// 2026-09-25: kullanıcının paylaştığı bir "HR CRM" referans görseline göre
// KART/GRAFİK/TABLO diline yeniden döküldü (karşılama başlığı, KPI kartları,
// çizgi + donut grafik, "Son Başvurular" tablosu, ekip dağılımı, "Öncelikli
// İşler" + "Hızlı İşlemler" sağ panel). ALTTAKİ VERİ AYNI — hiçbir sayı/saat
// uydurulmadı: referanstaki "Yaklaşan Görüşmeler" (saatli randevu) için
// Start-Hub'da veri YOK (takvim sistemi yok, HUB_SPEC §15 bilinçli ret) —
// onun yerine zaten gerçek veriden kurulu "Bugün Yapılacaklar" listesi aynı
// panel konumuna, yeni kart görseliyle taşındı.
import React, { useState, useMemo, useEffect } from 'react';
import { AIcon } from '../../admin/admin-ui';
import { supabase } from '../../lib/supabase';
import { useHubStore } from '../hub-store';
import { usePerms } from '../../lib/use-perms';
import { isStale, thresholdMet, rubricCompleteFor, gateStatus } from '../hub-rules';
import { STAGE_LABEL, STAGES, INTEREST_LABEL, SOURCE_LABEL } from '../hub-constants';
import { suggestArchivedFor, MATCH_MIN_POOL } from '../hub-match';
import { intervalToDays } from '../hub-metrics';
import { EMPTY_FILTERS } from '../hub-filter';
import CandidatePanel from './candidate';

const startOfWeek = () => {
  const d = new Date();
  d.setDate(d.getDate() - ((d.getDay() + 6) % 7));
  d.setHours(0, 0, 0, 0);
  return d;
};
const fmt = (v) => (v ? new Date(v).toLocaleString('tr-TR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' }) : '');
const fmtShort = (v) => (v ? new Date(v).toLocaleDateString('tr-TR', { day: '2-digit', month: 'short' }) : '—');
const initials = (n) => (n || '?').trim().split(/\s+/).slice(0, 2).map((w) => w[0]).join('').toUpperCase();
// todos zaten "şimdi bekleyen" işler (gelecekteki bir vade değil) — bu yüzden
// göreli zaman hep GEÇMİŞE dönük ifade edilir ("3 saat önce"), bir geri sayım değil.
const relTime = (v) => {
  if (!v) return '';
  const ms = Date.now() - new Date(v).getTime();
  if (ms < 60000) return 'az önce';
  const h = Math.round(ms / 3600000);
  return h < 1 ? `${Math.round(ms / 60000)} dk önce` : h < 48 ? `${h} saat önce` : `${Math.round(h / 24)} gün önce`;
};

// ── Mentör/Destekçi/Fikir sayıları + Hub Sheet bağlantı durumu — tek seferlik,
// hafif bir sorgu (uygulama/hub_sheet_config). Hem üst şerit hem de alttaki ikincil
// istatistikler bu tek fetch'i paylaşır.
function useSecondaryStats() {
  const [stats, setStats] = useState(null);
  useEffect(() => {
    let alive = true;
    Promise.all([
      supabase.from('applications').select('id', { count: 'exact', head: true }).eq('intent', 'mentor_application'),
      supabase.from('applications').select('id', { count: 'exact', head: true }).eq('intent', 'sponsor_application'),
      supabase.from('applications').select('id', { count: 'exact', head: true }).eq('intent', 'idea_application'),
      supabase.from('hub_sheet_config').select('spreadsheet_id, enabled').eq('id', 1).single(),
    ]).then(([m, s, i, cfg]) => {
      if (!alive) return;
      setStats({
        mentors: m.count ?? 0, sponsors: s.count ?? 0, ideas: i.count ?? 0,
        sheetOk: !!(cfg.data?.spreadsheet_id && cfg.data?.enabled),
      });
    }).catch(() => { if (alive) setStats({ mentors: 0, sponsors: 0, ideas: 0, sheetOk: false }); });
    return () => { alive = false; };
  }, []);
  return stats;
}

// Tıklanabilir kart kabuğu — hem KPI/istatistik kartlarında hem "Sistem özeti" /
// "Diğer göstergeler" şeritlerinde reuse edilir (roles.jsx'teki goToRoleCandidates
// ile aynı "karta tıkla, ilgili yere git" deseni).
function OvCard({ onClick, className = '', children }) {
  if (!onClick) return <div className={`hub-ov-card ${className}`}>{children}</div>;
  return (
    <div className={`hub-ov-card hub-ov-card--clickable ${className}`} role="button" tabIndex={0}
      onClick={onClick} onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onClick(); } }}>
      {children}
    </div>
  );
}

// ── KPI kartı (referans görseldeki ikon-rozetli üst şerit) ─────────────────
function KpiCard({ icon, tone, value, label, onClick }) {
  const body = (
    <>
      <span className={`hub-kpi__icon hub-kpi__icon--${tone}`}><AIcon name={icon} size={19} /></span>
      <span className="hub-kpi__text">
        <span className="hub-kpi__value">{value}</span>
        <span className="hub-kpi__label">{label}</span>
      </span>
    </>
  );
  if (!onClick) return <div className="hub-kpi">{body}</div>;
  return (
    <div className="hub-kpi hub-kpi--clickable" role="button" tabIndex={0} onClick={onClick}
      onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onClick(); } }}>
      {body}
    </div>
  );
}

// ── Çizgi grafik (bağımlılıksız SVG) — son 6 ay: yeni aday vs işe alım ──────
function LineChart({ months }) {
  const W = 320, H = 120, PAD = 6, LBL = 16;
  const maxV = Math.max(1, ...months.map((m) => Math.max(m.applied, m.hired)));
  const stepX = months.length > 1 ? (W - PAD * 2) / (months.length - 1) : 0;
  const y = (v) => H - LBL - (v / maxV) * (H - LBL - PAD);
  const pts = (key) => months.map((m, i) => `${PAD + i * stepX},${y(m[key])}`).join(' ');
  const areaPts = `${PAD},${y(0)} ${pts('applied')} ${PAD + (months.length - 1) * stepX},${y(0)}`;
  return (
    <div>
      <div className="hub-chart-legend">
        <span><i style={{ background: '#2563EB' }} /> Yeni aday</span>
        <span><i style={{ background: '#16A34A' }} /> İşe alım</span>
      </div>
      <svg viewBox={`0 0 ${W} ${H}`} className="hub-linechart" preserveAspectRatio="none">
        <polygon points={areaPts} fill="rgba(37,99,235,0.08)" stroke="none" />
        <polyline points={pts('applied')} fill="none" stroke="#2563EB" strokeWidth="2" strokeLinejoin="round" strokeLinecap="round" />
        <polyline points={pts('hired')} fill="none" stroke="#16A34A" strokeWidth="2" strokeLinejoin="round" strokeLinecap="round" />
        {months.map((m, i) => (
          <text key={m.key} x={PAD + i * stepX} y={H - 3} fontSize="8.5" fill="#A29D94" textAnchor="middle">{m.label}</text>
        ))}
      </svg>
    </div>
  );
}

// ── Donut grafik (bağımlılıksız SVG, stroke-dasharray) — kaynak dağılımı ───
function DonutChart({ segments }) {
  const total = segments.reduce((s, x) => s + x.value, 0);
  const R = 42, CX = 56, CY = 56, STROKE = 15;
  const circumference = 2 * Math.PI * R;
  let acc = 0;
  return (
    <div className="hub-donut-wrap">
      <svg viewBox="0 0 112 112" className="hub-donut">
        <circle cx={CX} cy={CY} r={R} fill="none" stroke="#F4EFE5" strokeWidth={STROKE} />
        {total > 0 && segments.map((s) => {
          const dash = (s.value / total) * circumference;
          const el = (
            <circle key={s.key} cx={CX} cy={CY} r={R} fill="none" stroke={s.color} strokeWidth={STROKE}
              strokeDasharray={`${dash} ${circumference - dash}`} strokeDashoffset={-acc}
              transform={`rotate(-90 ${CX} ${CY})`} />
          );
          acc += dash;
          return el;
        })}
        <text x={CX} y={CY - 3} textAnchor="middle" fontSize="17" fontWeight="800" fontFamily="'Space Grotesk', sans-serif" fill="#1C1917">{total}</text>
        <text x={CX} y={CY + 11} textAnchor="middle" fontSize="8.5" fill="#A29D94">Toplam</text>
      </svg>
      <div className="hub-donut-legend">
        {segments.map((s) => (
          <div key={s.key} className="hub-donut-legend__row">
            <span className="hub-donut-legend__dot" style={{ background: s.color }} />
            <span className="hub-donut-legend__label">{s.label}</span>
            <span className="hub-donut-legend__pct">{total ? Math.round((100 * s.value) / total) : 0}%</span>
          </div>
        ))}
        {segments.length === 0 && <div style={{ fontSize: 12, color: 'var(--adm-text-dim)' }}>Henüz veri yok.</div>}
      </div>
    </div>
  );
}

// ── Son başvurular (küçük tablo) ────────────────────────────────────────────
function RecentTable({ candidates, onOpen }) {
  if (!candidates.length) return <div className="adm-empty" style={{ padding: '24px 0' }}>Henüz aday yok.</div>;
  return (
    <div className="adm-table-wrap">
      <table className="adm-table">
        <thead><tr><th>Aday</th><th>Aşama</th><th>Tarih</th></tr></thead>
        <tbody>
          {candidates.map((c) => (
            <tr key={c.id} style={{ cursor: 'pointer' }} onClick={() => onOpen(c.id)}>
              <td>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <span className="hub-av hub-av--sm">{initials(c.fullName)}</span>{c.fullName}
                </div>
              </td>
              <td><span className="hub-pill hub-pill--stage">{STAGE_LABEL[c.stage] || c.stage}</span></td>
              <td style={{ color: 'var(--adm-text-dim)', fontSize: 12.5 }}>{fmtShort(c.createdAt)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

// ── Dağılım çubukları (aşama / ekip gibi kategorik dağılımlar için reuse) ──
function DistributionBars({ items, empty, onSelect }) {
  if (!items.length) return <div className="adm-empty" style={{ padding: '24px 0' }}>{empty}</div>;
  const Row = onSelect ? 'button' : 'div';
  return (
    <div className="hub-dist-list">
      {items.map((it) => (
        <Row key={it.key} type={onSelect ? 'button' : undefined}
          className={`hub-dist-row ${onSelect ? 'hub-dist-row--clickable' : ''}`}
          onClick={onSelect ? () => onSelect(it.key) : undefined}>
          <span className="hub-dist-row__label">{it.label}</span>
          <div className="hub-bar"><i style={{ width: `${it.pct}%`, background: it.color }} /></div>
          <span className="hub-dist-row__n">{it.value}</span>
          <span className="hub-dist-row__pct">%{it.pct}</span>
        </Row>
      ))}
    </div>
  );
}

// ── Hızlı işlemler — 4 gerçek, tek tıkla çalışan kısayol ────────────────────
function QuickActions({ items }) {
  return (
    <div className="hub-quick-actions">
      {items.map((it) => (
        <button key={it.key} type="button" className="hub-quick-action" onClick={it.onClick}>
          <span className={`hub-quick-action__icon hub-quick-action__icon--${it.tone}`}><AIcon name={it.icon} size={17} /></span>
          <span className="hub-quick-action__text">
            <span className="hub-quick-action__title">{it.title}</span>
            <span className="hub-quick-action__sub">{it.sub}</span>
          </span>
          <AIcon name="chevronRight" size={14} style={{ color: 'var(--adm-text-dim)', marginLeft: 'auto', flexShrink: 0 }} />
        </button>
      ))}
    </div>
  );
}

// ── "Sistem özeti" — Açık Pozisyonlar/Kaynaklar/Şablonlar/Cevap oranı. Hepsi
// zaten store'un client-side yüklediği openRoles/sources/templates/touches'tan
// — yeni sorgu yok. Her kart kendi sayfasına götürür.
function SystemSummary({ openRoles, sources, templates, touches, onGoto, can }) {
  const rolesSourcing = openRoles.filter((r) => r.status === 'sourcing').length;
  const rolesDraft = openRoles.filter((r) => r.status === 'draft').length;

  const sourcesActive = sources.filter((s) => s.status === 'active').length;
  const sourcesDue = sources.filter((s) => s.status === 'active'
    && (!s.lastChecked || Date.now() - Date.parse(s.lastChecked) >= intervalToDays(s.checkEvery) * 86400000)).length;

  const templatesActive = templates.filter((t) => t.active).length;
  const withSends = templates.filter((t) => t.sentCount > 0);
  const avgReplyRate = withSends.length
    ? Math.round(withSends.reduce((sum, t) => sum + (100 * (t.replyCount || 0)) / t.sentCount, 0) / withSends.length)
    : null;

  const sent = touches.length;
  const replied = touches.filter((t) => t.outcome === 'replied').length;
  const replyRate = sent > 0 ? Math.round((100 * replied) / sent) : null;

  return (
    <div className="hub-secondary">
      <div className="hub-secondary__label">Sistem özeti</div>
      <div className="hub-overview__row hub-overview__row--muted">
        {can?.('roles.read') && (
          <OvCard className="hub-ov-card--muted" onClick={onGoto ? () => onGoto('roles') : undefined}>
            <span className="hub-ov-card__n">{rolesSourcing}</span>
            <span className="hub-ov-card__l">Açık pozisyon (yayında){rolesDraft > 0 ? ` · +${rolesDraft} taslak` : ''}</span>
          </OvCard>
        )}
        {can?.('sources.read') && (
          <OvCard className="hub-ov-card--muted" onClick={onGoto ? () => onGoto('sources') : undefined}>
            <span className="hub-ov-card__n">{sourcesActive}</span>
            <span className="hub-ov-card__l">Aktif kaynak{sourcesDue > 0 ? ` · ${sourcesDue} kontrolü gecikmiş` : ''}</span>
          </OvCard>
        )}
        {can?.('templates.read') && (
          <OvCard className="hub-ov-card--muted" onClick={onGoto ? () => onGoto('templates') : undefined}>
            <span className="hub-ov-card__n">{templatesActive}</span>
            <span className="hub-ov-card__l">Aktif şablon{avgReplyRate != null ? ` · ort. cevap %${avgReplyRate}` : ''}</span>
          </OvCard>
        )}
        {can?.('metrics.read') && (
          <OvCard className={`hub-ov-card--pill ${replyRate != null && replyRate >= 20 ? 'hub-ov-card--ok' : ''}`}
            onClick={onGoto ? () => onGoto('metrics') : undefined}>
            <span className="hub-ov-card__n">{replyRate == null ? '—' : `%${replyRate}`}</span>
            <span className="hub-ov-card__l">Cevap oranı (temas → cevap)</span>
          </OvCard>
        )}
      </div>
    </div>
  );
}

// ── Alt, soluk şerit — mentör/destekçi/fikir başvuru sayıları + Hub Sheet durumu +
// ilgi alanı dağılımı.
function SecondaryStats({ candidates, stats, onGoto, setFilters, can }) {
  const active = candidates.filter((c) => c.stage !== 'archived');
  const interestCounts = {};
  active.forEach((c) => { const k = c.interest; if (k) interestCounts[k] = (interestCounts[k] || 0) + 1; });
  const topInterests = Object.entries(interestCounts).sort((a, b) => b[1] - a[1]).slice(0, 4);
  const goInterest = (key) => {
    if (!onGoto || !setFilters) return;
    setFilters({ ...EMPTY_FILTERS, interest: [key] });
    onGoto('candidates');
  };

  return (
    <div className="hub-secondary">
      <div className="hub-secondary__label">Diğer göstergeler</div>
      <div className="hub-overview__row hub-overview__row--muted">
        <OvCard className="hub-ov-card--muted" onClick={onGoto ? () => onGoto('applications') : undefined}>
          <span className="hub-ov-card__n">{stats?.mentors ?? '—'}</span>
          <span className="hub-ov-card__l">Mentör başvurusu</span>
        </OvCard>
        <OvCard className="hub-ov-card--muted" onClick={onGoto ? () => onGoto('applications') : undefined}>
          <span className="hub-ov-card__n">{stats?.sponsors ?? '—'}</span>
          <span className="hub-ov-card__l">Destekçi başvurusu</span>
        </OvCard>
        <OvCard className="hub-ov-card--muted" onClick={onGoto ? () => onGoto('applications') : undefined}>
          <span className="hub-ov-card__n">{stats?.ideas ?? '—'}</span>
          <span className="hub-ov-card__l">Fikir başvurusu</span>
        </OvCard>
        <OvCard className={`hub-ov-card--pill ${stats?.sheetOk ? 'hub-ov-card--ok' : 'hub-ov-card--warn'}`}
          onClick={(onGoto && can?.('settings.write')) ? () => onGoto('settings') : undefined}>
          <span className="hub-ov-card__n" style={{ fontSize: 15 }}>{stats == null ? '—' : stats.sheetOk ? '✓ Bağlı' : 'Kurulmadı'}</span>
          <span className="hub-ov-card__l">Hub Başvuru Tablosu</span>
        </OvCard>
        {topInterests.map(([k, n]) => (
          <OvCard key={k} className="hub-ov-card--muted" onClick={() => goInterest(k)}>
            <span className="hub-ov-card__n">{n}</span>
            <span className="hub-ov-card__l">{INTEREST_LABEL[k] || k}</span>
          </OvCard>
        ))}
      </div>
    </div>
  );
}

// ── Tek satırlık "yapılacak iş" — tıklanınca doğrudan aday panelini açar.
function TodoRow({ onClick, name, kind, kindTone, meta }) {
  return (
    <button type="button" className="hub-todo-row" onClick={onClick}>
      <span className="hub-av hub-av--sm">{initials(name)}</span>
      <span className="hub-todo-row__name">{name}</span>
      <span className={`hub-todo-row__kind hub-todo-row__kind--${kindTone}`}>{kind}</span>
      <span className="hub-todo-row__meta">{meta}</span>
      <AIcon name="chevronRight" size={15} style={{ color: 'var(--adm-text-dim)', flexShrink: 0 }} />
    </button>
  );
}

export default function TodayPage({ onGoto, setFilters }) {
  const store = useHubStore();
  const { candidates, touches, gates, openRoles, currentMember, sources, templates, stageLog } = store;
  const { can } = usePerms();
  const [openId, setOpenId] = useState(null);
  const secondaryStats = useSecondaryStats();
  const byId = useMemo(() => Object.fromEntries(candidates.map((c) => [c.id, c])), [candidates]);
  const now = Date.now();
  const myStartups = currentMember?.startupIds || [];

  const toSend = candidates.filter((c) => c.stage === 'pool' && c.ownerId === currentMember?.id);
  const sentThisWeek = touches.filter((t) => t.senderId === currentMember?.id && new Date(t.sentAt) >= startOfWeek()).length;

  const founderLeads = candidates.filter((c) => c.track === 'founder' && c.stage !== 'archived' && c.stage !== 'member');

  const dueFollowUps = touches
    .filter((t) => t.outcome === 'pending' && t.followUpAt && new Date(t.followUpAt).getTime() <= now)
    .map((t) => ({ t, c: byId[t.candidateId] }))
    .filter((x) => x.c && x.c.stage === 'contact');

  const openRoleOf = (c) => openRoles.find((r) => r.id === c.openRoleId) || null;
  const decisionReady = candidates.filter((c) => {
    if (c.presentedAt && (!c.ownerDecision || c.ownerDecision === 'pending')) {
      return !myStartups.length || (c.startupId != null && myStartups.includes(c.startupId)) || can('present');
    }
    return c.stage === 'interview' && rubricCompleteFor(c, openRoleOf(c)) && thresholdMet(c, openRoleOf(c));
  });

  const dueGates = gates
    .filter((g) => g.result === 'pending' && gateStatus(g) !== 'running')
    .map((g) => ({ g, c: byId[g.candidateId] }))
    .filter((x) => x.c);

  const stale = candidates
    .filter((c) => c.stage !== 'archived' && c.stage !== 'member')
    .map((c) => ({ c, s: isStale(c, now) }))
    .filter((x) => x.s.stale);

  // E4 — havuz 100+ olunca: yeni (sourcing) roller için arşivdeki uygun adaylar.
  const roleReminders = useMemo(() => {
    if (candidates.length < MATCH_MIN_POOL) return [];
    const seen = new Set();
    const out = [];
    for (const r of openRoles.filter((x) => x.status === 'sourcing')) {
      for (const { candidate, score } of suggestArchivedFor(r, candidates)) {
        if (seen.has(candidate.id)) continue;
        seen.add(candidate.id);
        out.push({ c: candidate, role: r, score });
      }
    }
    return out.sort((a, b) => b.score - a.score).slice(0, 8);
  }, [candidates, openRoles]);

  // Yedi ayrı kaynak, TEK aciliyet-sıralı listeye toplanır. urgency küçük = daha acil.
  const todos = useMemo(() => {
    const rows = [];
    dueGates.forEach(({ g, c }) => rows.push({
      id: `gate-${g.id}`, c, kind: 'Kapı', tone: 'red',
      meta: `Kapı ${g.gate} · vade ${fmt(g.dueAt)}`, urgency: 0, sortAt: g.dueAt,
    }));
    dueFollowUps.forEach(({ t, c }) => rows.push({
      id: `fu-${t.id}`, c, kind: 'Takip', tone: 'amber',
      meta: `${(t.stepNo || 1) > 1 ? `#${t.stepNo} · ` : ''}${fmt(t.followUpAt)}${(t.stepNo || 1) > 1 && c.draftText ? ' · taslak hazır' : ''}`,
      urgency: 1, sortAt: t.followUpAt,
    }));
    decisionReady.forEach((c) => rows.push({
      id: `dec-${c.id}`, c, kind: 'Karar', tone: 'purple',
      meta: c.presentedAt ? `sunuldu ${String(c.presentedAt).slice(0, 10)} · karar bekliyor` : 'görüşme eşiği hazır',
      urgency: 1,
    }));
    founderLeads.forEach((c) => rows.push({
      id: `lead-${c.id}`, c, kind: 'Liderlik', tone: 'purple',
      meta: `${STAGE_LABEL[c.stage]} · kurucu hattı`, urgency: 2,
    }));
    toSend.forEach((c) => rows.push({
      id: `send-${c.id}`, c, kind: 'Mesaj', tone: 'blue',
      meta: `${c.university || '—'}${thresholdMet(c) ? ' · eşik ✓' : ''}`, urgency: 2,
    }));
    stale.forEach(({ c, s }) => rows.push({
      id: `stale-${c.id}`, c, kind: 'Bayat', tone: s.level === 'critical' ? 'red' : 'amber',
      meta: `${STAGE_LABEL[c.stage]} · ${s.days} gün hareketsiz`, urgency: 3,
    }));
    roleReminders.forEach(({ c, role, score }) => rows.push({
      id: `role-${c.id}-${role.id}`, c, kind: 'Rol önerisi', tone: 'gray',
      meta: `→ ${role.title} · ${score} puan uyum · arşivde`, urgency: 4,
    }));
    return rows.sort((a, b) => a.urgency - b.urgency
      || (a.sortAt && b.sortAt ? new Date(a.sortAt) - new Date(b.sortAt) : 0));
  }, [dueGates, dueFollowUps, decisionReady, founderLeads, toSend, stale, roleReminders]);

  // ── Referans görsel için yeni türetilmiş veriler — HEPSİ gerçek, uydurma yok ──
  const activeCandidates = useMemo(() => candidates.filter((c) => c.stage !== 'archived'), [candidates]);
  const memberCount = useMemo(() => candidates.filter((c) => c.stage === 'member').length, [candidates]);
  const interviewCount = useMemo(() => candidates.filter((c) => c.stage === 'interview').length, [candidates]);

  // Son 6 ay: "yeni aday" = candidates.createdAt (her adayda kesin var),
  // "işe alım" = stageLog'daki toStage==='member' geçişleri.
  const monthlyTrend = useMemo(() => {
    const base = new Date();
    const months = [];
    for (let i = 5; i >= 0; i--) {
      const d = new Date(base.getFullYear(), base.getMonth() - i, 1);
      months.push({ key: `${d.getFullYear()}-${d.getMonth()}`, label: d.toLocaleDateString('tr-TR', { month: 'short' }), applied: 0, hired: 0 });
    }
    const idx = Object.fromEntries(months.map((m, i) => [m.key, i]));
    candidates.forEach((c) => {
      if (!c.createdAt) return;
      const d = new Date(c.createdAt);
      const key = `${d.getFullYear()}-${d.getMonth()}`;
      if (key in idx) months[idx[key]].applied += 1;
    });
    stageLog.forEach((l) => {
      if (l.toStage !== 'member' || !l.createdAt) return;
      const d = new Date(l.createdAt);
      const key = `${d.getFullYear()}-${d.getMonth()}`;
      if (key in idx) months[idx[key]].hired += 1;
    });
    return months;
  }, [candidates, stageLog]);

  // Başvuru kaynakları — en çok 5 kaynak + "Diğer".
  const sourceBreakdown = useMemo(() => {
    const counts = {};
    activeCandidates.forEach((c) => { const k = c.source || 'other'; counts[k] = (counts[k] || 0) + 1; });
    const palette = ['#2563EB', '#16A34A', '#D97706', '#7C3AED', '#DC2626', '#78716C'];
    const entries = Object.entries(counts).sort((a, b) => b[1] - a[1]);
    const top = entries.slice(0, 5);
    const rest = entries.slice(5).reduce((s, [, n]) => s + n, 0);
    const out = top.map(([k, n], i) => ({ key: k, label: SOURCE_LABEL[k] || k, value: n, color: palette[i % palette.length] }));
    if (rest > 0) out.push({ key: '__rest', label: 'Diğer', value: rest, color: '#D6C9AE' });
    return out;
  }, [activeCandidates]);

  // Aşama dağılımı — aktif adayların pipeline'daki 5 aşamaya göre kırılımı
  // (eskiden ayrı bir "Pipeline şeridi"nde tekrar ediyordu — KPI kartlarıyla
  // çakışmasın diye tek yere, buraya toplandı).
  const stagePalette = { pool: '#A29D94', contact: '#2563EB', interview: '#7C3AED', trial: '#EA580C', member: '#16A34A' };
  const stageBreakdown = useMemo(() => {
    const total = activeCandidates.length;
    const counts = {};
    activeCandidates.forEach((c) => { counts[c.stage] = (counts[c.stage] || 0) + 1; });
    return STAGES.map((s) => ({
      key: s.value, label: s.label, value: counts[s.value] || 0,
      pct: total ? Math.round((100 * (counts[s.value] || 0)) / total) : 0, color: stagePalette[s.value],
    })).filter((s) => s.value > 0);
  }, [activeCandidates]);
  const goStage = (stageValue) => { setFilters?.({ ...EMPTY_FILTERS, stage: [stageValue] }); onGoto?.('candidates'); };

  const recentCandidates = useMemo(
    () => [...candidates].sort((a, b) => (b.createdAt || '').localeCompare(a.createdAt || '')).slice(0, 6),
    [candidates]
  );

  const quickActions = [
    { key: 'add', icon: 'plus', tone: 'red', title: 'Aday Ekle', sub: 'Adaylar sayfasında ekle', onClick: () => onGoto?.('candidates') },
    { key: 'role', icon: 'rocket', tone: 'purple', title: 'Pozisyon Oluştur', sub: 'Açık Pozisyonlar', onClick: () => onGoto?.('roles') },
    { key: 'apps', icon: 'graduationCap', tone: 'blue', title: 'Diğer Başvurular', sub: 'Mentör · Destekçi · Fikir', onClick: () => onGoto?.('applications') },
    { key: 'metrics', icon: 'trendingUp', tone: 'green', title: 'Metrikler', sub: 'Performansa bak', onClick: () => onGoto?.('metrics') },
  ];

  const firstName = (currentMember?.fullName || '').trim().split(/\s+/)[0] || '';

  return (
    <div className="hub-today hub-today--v2">
      <div className="hub-dash-head">
        <h1 className="hub-dash-head__title">{firstName ? `Merhaba ${firstName},` : 'Merhaba,'}</h1>
        <p className="hub-dash-head__sub">
          {todos.length === 0
            ? 'Bekleyen iş yok — her şey güncel.'
            : <>Bugün <b>{todos.length} iş</b> seni bekliyor{sentThisWeek > 0 ? ` · bu hafta ${sentThisWeek} mesaj gönderildi` : ''}.</>}
        </p>
      </div>

      <div className="hub-kpi-row">
        <KpiCard icon="layers" tone="blue" value={activeCandidates.length} label="Aktif Aday"
          onClick={() => { setFilters?.({ ...EMPTY_FILTERS }); onGoto?.('candidates'); }} />
        <KpiCard icon="clock" tone="amber" value={todos.length} label="Bugün Yapılacak"
          onClick={todos.length ? () => setOpenId(todos[0].c.id) : undefined} />
        <KpiCard icon="users" tone="green" value={memberCount} label="Ekipteki"
          onClick={() => { setFilters?.({ ...EMPTY_FILTERS, stage: ['member'] }); onGoto?.('candidates'); }} />
        <KpiCard icon="rocket" tone="purple" value={interviewCount} label="Görüşmede"
          onClick={() => { setFilters?.({ ...EMPTY_FILTERS, stage: ['interview'] }); onGoto?.('candidates'); }} />
      </div>

      <div className="hub-dash-grid">
        <div className="hub-dash-col-main">
          <div className="hub-chart-row">
            <div className="hub-card hub-chart-card">
              <div className="hub-card__title">Başvuru ve İşe Alım Trendleri</div>
              <LineChart months={monthlyTrend} />
            </div>
            <div className="hub-card hub-chart-card hub-chart-card--donut">
              <div className="hub-card__title">Başvuru Kaynakları</div>
              <DonutChart segments={sourceBreakdown} />
            </div>
          </div>

          <div className="hub-chart-row">
            <div className="hub-card">
              <div className="hub-card__title">Son Başvurular</div>
              <RecentTable candidates={recentCandidates} onOpen={setOpenId} />
            </div>
            <div className="hub-card">
              <div className="hub-card__title">Aşama Dağılımı</div>
              <DistributionBars items={stageBreakdown} empty="Henüz aday yok." onSelect={goStage} />
            </div>
          </div>

          <SystemSummary openRoles={openRoles} sources={sources} templates={templates} touches={touches} onGoto={onGoto} can={can} />
          <SecondaryStats candidates={candidates} stats={secondaryStats} onGoto={onGoto} setFilters={setFilters} can={can} />
        </div>

        <div className="hub-dash-col-side">
          <div className="hub-card">
            <div className="hub-card__title">Öncelikli İşler</div>
            {todos.length === 0 ? (
              <div className="adm-empty" style={{ padding: '20px 0' }}>
                Bekleyen iş yok.
                <button className="adm-btn adm-btn--primary adm-btn--sm" style={{ marginTop: 10 }} onClick={() => onGoto?.('candidates')}>
                  <AIcon name="layers" size={14} /> Adaylara git
                </button>
              </div>
            ) : (
              <div className="hub-todo-list hub-todo-list--panel">
                {todos.slice(0, 6).map((row) => (
                  <TodoRow key={row.id} onClick={() => setOpenId(row.c.id)}
                    name={row.c.fullName} kind={row.kind} kindTone={row.tone}
                    meta={row.sortAt ? relTime(row.sortAt) : row.meta} />
                ))}
              </div>
            )}
          </div>
          <div className="hub-card">
            <div className="hub-card__title">Hızlı İşlemler</div>
            <QuickActions items={quickActions} />
          </div>
        </div>
      </div>

      {openId && <CandidatePanel candidateId={openId} onClose={() => setOpenId(null)} />}
    </div>
  );
}
