// today.jsx — Genel Bakış = Dashboard (2026-09-24 CRM-lite sadeleştirme).
// Önceki sürüm: OverviewStats (2 satır) + 5-7 ayrı iş bloğu + her blokta ayrı bir
// QueueModal "Başlat" kuyruk-yürüme akışı. Kullanıcı bunu tek bakışta anlaşılır bir
// dashboard'a indirmek istedi: tek cümlelik özet + TEK birleşik "Bugün Yapılacaklar"
// listesi (aciliyete göre sıralı, tip etiketiyle "ne" belli) + satıra tıkla → aday
// paneli (uygulamanın her yerinde zaten aynı desen: Adaylar, Arşiv). QueueModal
// bilinçli olarak kaldırıldı — iki ayrı etkileşim deseni yerine tek desen kalsın diye.
// Altta çekilen istatistikler (aşama dağılımı, mentör/destekçi/fikir sayıları, Hub
// Sheet durumu, ilgi alanı dağılımı) SİLİNMEDİ, yalnızca ikincil/soluk bir şeride indi.
import React, { useState, useMemo, useEffect } from 'react';
import { AIcon } from '../../admin/admin-ui';
import { supabase } from '../../lib/supabase';
import { useHubStore } from '../hub-store';
import { usePerms } from '../../lib/use-perms';
import { isStale, thresholdMet, rubricCompleteFor, gateStatus } from '../hub-rules';
import { STAGE_LABEL, STAGES, INTEREST_LABEL } from '../hub-constants';
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

// ── Üst şerit — aktif aday + aşama dağılımı. "Durum ne" sorusunun tek bakışta yanıtı.
// 2026-09-24 — kartlar artık tıklanabilir: her biri Adaylar'a, o aşamayla filtrelenmiş
// olarak götürür (roles.jsx'teki goToRoleCandidates ile aynı desen).
function OvCard({ onClick, className = '', children }) {
  if (!onClick) return <div className={`hub-ov-card ${className}`}>{children}</div>;
  return (
    <div className={`hub-ov-card hub-ov-card--clickable ${className}`} role="button" tabIndex={0}
      onClick={onClick} onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onClick(); } }}>
      {children}
    </div>
  );
}

function PipelineStrip({ candidates, onGoto, setFilters }) {
  const active = candidates.filter((c) => c.stage !== 'archived');
  const byStage = Object.fromEntries(STAGES.map((s) => [s.value, active.filter((c) => c.stage === s.value).length]));
  const goStage = (stageValue) => {
    if (!onGoto || !setFilters) return;
    setFilters({ ...EMPTY_FILTERS, stage: stageValue ? [stageValue] : [] });
    onGoto('candidates');
  };
  return (
    <div className="hub-overview__row hub-pipeline-strip">
      <OvCard className="hub-ov-card--big" onClick={() => goStage(null)}>
        <span className="hub-ov-card__n">{active.length}</span>
        <span className="hub-ov-card__l">Aktif aday (LAB)</span>
      </OvCard>
      {STAGES.map((s) => (
        <OvCard key={s.value} onClick={() => goStage(s.value)}>
          <span className="hub-ov-card__n">{byStage[s.value] || 0}</span>
          <span className="hub-ov-card__l">{s.label}</span>
        </OvCard>
      ))}
    </div>
  );
}

// ── "Sistem özeti" — Açık Pozisyonlar/Kaynaklar/Şablonlar/Cevap oranı şu ana kadar
// dashboard'da HİÇ görünmüyordu (yalnızca sidebar'ın "Yönetim" alt-grubundan
// erişilebiliyordu). Hepsi zaten store'un client-side yüklediği openRoles/sources/
// templates/touches'tan — yeni sorgu yok. Her kart kendi sayfasına götürür.
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
// ilgi alanı dağılımı. Günlük iş listesinin önüne geçmesin diye en altta, küçük.
// 2026-09-24 — bu kartlar da tıklanabilir: başvuru sayıları "Diğer Başvurular"a,
// ilgi alanları Adaylar'a (o ilgi alanıyla filtrelenmiş), Hub Sheet kartı Ayarlar'a götürür.
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

// ── Tek satırlık "yapılacak iş" — tıklanınca doğrudan aday panelini açar. Uygulamanın
// her yerindeki (Adaylar, Arşiv) "satıra tıkla, panel açılır" deseniyle aynı.
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
  const { candidates, touches, gates, openRoles, currentMember, sources, templates } = store;
  const { can } = usePerms();
  const [openId, setOpenId] = useState(null);
  const secondaryStats = useSecondaryStats();
  const byId = useMemo(() => Object.fromEntries(candidates.map((c) => [c.id, c])), [candidates]);
  const now = Date.now();
  const myStartups = currentMember?.startupIds || [];

  const toSend = candidates.filter((c) => c.stage === 'pool' && c.ownerId === currentMember?.id);
  const sentThisWeek = touches.filter((t) => t.senderId === currentMember?.id && new Date(t.sentAt) >= startOfWeek()).length;

  // v3.1 (§16) — kurucu hattı (liderlik/ortaklık) başvuruları, normal aday
  // kararıyla karışmasın diye ayrı bir etiketle işaretlenir. Arşiv/Ekipte hariç
  // her aşamada görünür (nadir/yüksek-önem, süreç boyunca takip edilir).
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

  return (
    <div className="hub-today">
      <div className="adm-page-head">
        <div>
          <h1 className="adm-page-head__title">Genel Bakış</h1>
          <p className="adm-page-head__desc">Şu an durum ne + bugün bekleyen işler.</p>
        </div>
      </div>

      <div className="hub-brief">
        <div className="hub-brief__kick">BUGÜNÜN ÖZETİ</div>
        <div className="hub-brief__h">
          {todos.length === 0
            ? 'Bekleyen iş yok — her şey güncel.'
            : <>Bugün <b>{todos.length} iş</b> seni bekliyor{sentThisWeek > 0 ? ` · bu hafta ${sentThisWeek} mesaj gönderildi` : ''}.</>}
        </div>
        {/* 2026-09-24 — en acil olan (todos zaten aciliyete göre sıralı, ilk satır)
            listeyi taramadan önce tek satırda öne çıkar. */}
        {todos.length > 0 && (
          <button type="button" className="hub-brief__urgent" onClick={() => setOpenId(todos[0].c.id)}>
            <span className={`hub-todo-row__kind hub-todo-row__kind--${todos[0].tone}`}>{todos[0].kind}</span>
            <span className="hub-brief__urgent-name">{todos[0].c.fullName}</span>
            {todos[0].sortAt && <span className="hub-brief__urgent-meta">{relTime(todos[0].sortAt)}</span>}
            <AIcon name="chevronRight" size={14} style={{ color: 'var(--adm-text-dim)', flexShrink: 0 }} />
          </button>
        )}
      </div>

      {todos.length === 0 ? (
        <div className="adm-empty">
          Bekleyen iş yok.
          <button className="adm-btn adm-btn--primary adm-btn--sm" style={{ marginTop: 10 }} onClick={() => onGoto?.('candidates')}>
            <AIcon name="layers" size={14} /> Adaylara git
          </button>
        </div>
      ) : (
        <div className="hub-todo-list">
          {todos.map((row) => (
            <TodoRow key={row.id} onClick={() => setOpenId(row.c.id)}
              name={row.c.fullName} kind={row.kind} kindTone={row.tone} meta={row.meta} />
          ))}
        </div>
      )}

      <PipelineStrip candidates={candidates} onGoto={onGoto} setFilters={setFilters} />
      <SystemSummary openRoles={openRoles} sources={sources} templates={templates} touches={touches} onGoto={onGoto} can={can} />
      <SecondaryStats candidates={candidates} stats={secondaryStats} onGoto={onGoto} setFilters={setFilters} can={can} />

      {openId && <CandidatePanel candidateId={openId} onClose={() => setOpenId(null)} />}
    </div>
  );
}
