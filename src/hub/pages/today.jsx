// today.jsx — Bugün ekranı (v2 §1). Varsayılan açılış. Dört blok:
//   1) Mesaj atılacaklar (Havuz'da, henüz temas yok)
//   2) Süresi gelen takipler (Temas'ta, cevap bekleyen)
//   3) Karar bekleyenler (Görüşme'de eşik/rubrik hazır + sunulmuş bekleyen)
//   4) Süresi dolan kapılar (Deneme'de)
// Boş blok gizlenir; hepsi boşsa tek satırlık davet.
import React, { useState, useMemo } from 'react';
import { AIcon } from '../../admin/admin-ui';
import { useHubStore } from '../hub-store';
import { usePerms } from '../../lib/use-perms';
import { isStale, thresholdMet, rubricCompleteFor, gateStatus } from '../hub-rules';
import { WEEKLY_TARGET, STAGE_LABEL } from '../hub-constants';
import { suggestArchivedFor, MATCH_MIN_POOL } from '../hub-match';
import CandidatePanel from './candidate';

const startOfWeek = () => {
  const d = new Date();
  d.setDate(d.getDate() - ((d.getDay() + 6) % 7));
  d.setHours(0, 0, 0, 0);
  return d;
};
const fmt = (v) => (v ? new Date(v).toLocaleString('tr-TR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' }) : '');

// ids verilirse (ve boş değilse) blok başlığına bir "Başlat" düğmesi eklenir
// — tek tek satır tıklamak yerine, bu bloğun tamamını sırayla (tek kart, tek
// aksiyon, otomatik sıradaki) işlemek için (bkz. QueueModal altta, 2026-09-20
// sadeleştirmesi). Liste hâlâ altında durur — kim isterse tek tek de seçebilir.
function Block({ title, extra, ids, onStartQueue, children }) {
  if (!children || (Array.isArray(children) && children.filter(Boolean).length === 0)) return null;
  return (
    <section className="hub-today__block">
      <div className="hub-today__blockhead">
        <h3>{title}</h3>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          {extra}
          {ids && ids.length > 0 && (
            <button className="adm-btn adm-btn--primary adm-btn--sm" onClick={() => onStartQueue(ids, title)}>
              Başlat <AIcon name="arrowRight" size={12} />
            </button>
          )}
        </div>
      </div>
      <div className="hub-today__rows">{children}</div>
    </section>
  );
}

// Bir liste bloğunu tek kart / tek aksiyon / otomatik sıradaki akışına
// çevirir. Aksiyonun kendisini İCAT ETMEZ — her aşamanın zaten kendi doğru
// tek sorusunu gösteren CandidatePanel'i (aday kartı) olduğu gibi kullanır;
// bu bileşen yalnızca ince bir ilerleme çubuğu + "Sonraki" ekler.
function QueueModal({ title, ids, onClose }) {
  const [queue] = useState(() => (ids || []).slice());
  const [idx, setIdx] = useState(0);
  const total = queue.length;
  const curId = idx < total ? queue[idx] : null;

  if (!curId) {
    return (
      <div className="hub-panel-overlay" onClick={onClose}>
        <div className="hub-panel" onClick={(e) => e.stopPropagation()} style={{ maxWidth: 420 }}>
          <div style={{ textAlign: 'center', padding: 32 }}>
            <div style={{ fontSize: 15, fontWeight: 700, marginBottom: 14 }}>Kuyruk bitti 🎉</div>
            <button className="adm-btn adm-btn--primary adm-btn--sm" onClick={onClose}>Kapat</button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <>
      <CandidatePanel candidateId={curId} onClose={onClose} />
      <div style={{
        position: 'fixed', top: 18, left: '50%', transform: 'translateX(-50%)', zIndex: 1001,
        display: 'flex', alignItems: 'center', gap: 10, background: 'var(--adm-text)', color: 'var(--adm-bg)',
        padding: '7px 8px 7px 16px', borderRadius: 999, boxShadow: '0 4px 16px rgba(0,0,0,.22)',
        fontSize: 13, fontWeight: 600, fontFamily: 'var(--font-body)',
      }}>
        <span>{title} · {idx + 1}/{total}</span>
        <button onClick={() => setIdx((i) => Math.max(0, i - 1))} disabled={idx === 0}
          style={{ background: 'rgba(255,255,255,.15)', border: 'none', color: 'inherit', borderRadius: 999, width: 26, height: 26, cursor: idx === 0 ? 'default' : 'pointer', opacity: idx === 0 ? 0.4 : 1, fontSize: 13 }}>←</button>
        <button onClick={() => setIdx((i) => i + 1)}
          style={{ background: 'rgba(255,255,255,.22)', border: 'none', color: 'inherit', borderRadius: 999, padding: '5px 12px', cursor: 'pointer', fontSize: 12, fontWeight: 700 }}>Sonraki →</button>
      </div>
    </>
  );
}

const initials = (n) => (n || '?').trim().split(/\s+/).slice(0, 2).map((w) => w[0]).join('').toUpperCase();

function Row({ onClick, main, meta, action, av }) {
  return (
    <div className="hub-today__row" role="button" tabIndex={0} onClick={onClick}
      onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onClick(); } }}>
      {av && <span className="hub-av hub-av--sm">{initials(av)}</span>}
      <span className="hub-today__main">{main}</span>
      <span className="hub-today__meta">{meta}</span>
      {action}
    </div>
  );
}

export default function TodayPage({ onGoto }) {
  const store = useHubStore();
  const { candidates, touches, gates, openRoles, currentMember } = store;
  const { can } = usePerms();
  const [openId, setOpenId] = useState(null);
  const [queue, setQueue] = useState(null);   // { title, ids } | null
  const startQueue = (ids, title) => setQueue({ ids, title });
  const byId = useMemo(() => Object.fromEntries(candidates.map((c) => [c.id, c])), [candidates]);
  const now = Date.now();
  const myStartups = currentMember?.startupIds || [];

  const toSend = candidates.filter((c) => c.stage === 'pool' && c.ownerId === currentMember?.id);
  const sentThisWeek = touches.filter((t) => t.senderId === currentMember?.id && new Date(t.sentAt) >= startOfWeek()).length;

  // v3.1 (§16) — kurucu hattı (liderlik/ortaklık) başvuruları, normal aday
  // kararıyla karışmasın diye ayrı küçük bir blokta. Arşiv/Ekipte hariç
  // her aşamada görünür (nadir/yüksek-önem, süreç boyunca takip edilir).
  const founderLeads = candidates.filter((c) => c.track === 'founder' && c.stage !== 'archived' && c.stage !== 'member');

  const dueFollowUps = touches
    .filter((t) => t.outcome === 'pending' && t.followUpAt && new Date(t.followUpAt).getTime() <= now)
    .map((t) => ({ t, c: byId[t.candidateId] }))
    .filter((x) => x.c && x.c.stage === 'contact')
    .sort((a, b) => new Date(a.t.followUpAt) - new Date(b.t.followUpAt));

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
    .filter((x) => x.s.stale)
    .sort((a, b) => b.s.days - a.s.days);

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

  const allEmpty = !toSend.length && !founderLeads.length && !dueFollowUps.length && !decisionReady.length
    && !dueGates.length && !stale.length && !roleReminders.length;

  return (
    <div className="hub-today">
      <div className="adm-page-head">
        <div>
          <h1 className="adm-page-head__title">Bugün</h1>
          <p className="adm-page-head__desc">Sistemin her sabah açıldığı yer.</p>
        </div>
      </div>

      {allEmpty ? (
        <div className="adm-empty">
          Bugün temiz.
          <button className="adm-btn adm-btn--primary adm-btn--sm" style={{ marginTop: 10 }} onClick={() => onGoto?.('candidates')}>
            <AIcon name="layers" size={14} /> Adaylara git
          </button>
        </div>
      ) : (
        <>
          <Block title="Mesaj atılacaklar" ids={toSend.map((c) => c.id)} onStartQueue={startQueue}
            extra={<span className="hub-today__target">bu hafta {sentThisWeek}/{WEEKLY_TARGET.contacts}</span>}>
            {toSend.map((c) => (
              <Row key={c.id} onClick={() => setOpenId(c.id)} av={c.fullName} main={c.fullName}
                meta={`${c.university || '—'}${thresholdMet(c) ? ' · eşik ✓' : ''}`} />
            ))}
          </Block>

          <Block title="Liderlik başvuruları" ids={founderLeads.map((c) => c.id)} onStartQueue={startQueue}>
            {founderLeads.map((c) => (
              <Row key={c.id} onClick={() => setOpenId(c.id)} av={c.fullName} main={c.fullName}
                meta={`${STAGE_LABEL[c.stage]} · kurucu hattı`} />
            ))}
          </Block>

          <Block title="Süresi gelen takipler" ids={dueFollowUps.map(({ c }) => c.id)} onStartQueue={startQueue}>
            {dueFollowUps.map(({ t, c }) => (
              <Row key={t.id} onClick={() => setOpenId(c.id)} av={c.fullName} main={c.fullName}
                meta={`takip ${(t.stepNo || 1) > 1 ? `#${t.stepNo} · ` : ''}${fmt(t.followUpAt)}${(t.stepNo || 1) > 1 && c.draftText ? ' · taslak hazır' : ''}`} />
            ))}
          </Block>

          <Block title="Karar bekleyenler" ids={decisionReady.map((c) => c.id)} onStartQueue={startQueue}>
            {decisionReady.map((c) => (
              <Row key={c.id} onClick={() => setOpenId(c.id)} av={c.fullName} main={c.fullName}
                meta={c.presentedAt ? `sunuldu ${String(c.presentedAt).slice(0, 10)} · karar bekliyor` : 'görüşme eşiği hazır'} />
            ))}
          </Block>

          <Block title="Süresi dolan kapılar" ids={dueGates.map(({ c }) => c.id)} onStartQueue={startQueue}>
            {dueGates.map(({ g, c }) => (
              <Row key={g.id} onClick={() => setOpenId(c.id)} av={c.fullName} main={c.fullName} meta={`Kapı ${g.gate} · vade ${fmt(g.dueAt)}`} />
            ))}
          </Block>

          <Block title="Bayatlamış kartlar" ids={stale.map(({ c }) => c.id)} onStartQueue={startQueue}>
            {stale.map(({ c, s }) => (
              <Row key={c.id} onClick={() => setOpenId(c.id)} av={c.fullName} main={c.fullName}
                meta={`${STAGE_LABEL[c.stage]} · ${s.days} gün`}
                action={<span className={`hub-card__dot hub-card__dot--${s.level}`} />} />
            ))}
          </Block>

          <Block title="Yeni rol için arşivden aday" ids={roleReminders.map(({ c }) => c.id)} onStartQueue={startQueue}>
            {roleReminders.map(({ c, role, score }) => (
              <Row key={c.id} onClick={() => setOpenId(c.id)} av={c.fullName} main={c.fullName}
                meta={`→ ${role.title} · ${score} puan uyum · arşivde (${c.archiveReason === 'no_time' ? 'vakti yoktu' : 'çıtanın altında'})`} />
            ))}
          </Block>
        </>
      )}

      {openId && <CandidatePanel candidateId={openId} onClose={() => setOpenId(null)} />}
      {queue && <QueueModal title={queue.title} ids={queue.ids} onClose={() => setQueue(null)} />}
    </div>
  );
}
