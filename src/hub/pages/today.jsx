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
import CandidatePanel from './candidate';

const startOfWeek = () => {
  const d = new Date();
  d.setDate(d.getDate() - ((d.getDay() + 6) % 7));
  d.setHours(0, 0, 0, 0);
  return d;
};
const fmt = (v) => (v ? new Date(v).toLocaleString('tr-TR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' }) : '');

function Block({ title, extra, children }) {
  if (!children || (Array.isArray(children) && children.filter(Boolean).length === 0)) return null;
  return (
    <section className="hub-today__block">
      <div className="hub-today__blockhead"><h3>{title}</h3>{extra}</div>
      <div className="hub-today__rows">{children}</div>
    </section>
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
  const byId = useMemo(() => Object.fromEntries(candidates.map((c) => [c.id, c])), [candidates]);
  const now = Date.now();
  const myStartups = currentMember?.startupIds || [];

  const toSend = candidates.filter((c) => c.stage === 'pool' && c.ownerId === currentMember?.id);
  const sentThisWeek = touches.filter((t) => t.senderId === currentMember?.id && new Date(t.sentAt) >= startOfWeek()).length;

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

  const allEmpty = !toSend.length && !dueFollowUps.length && !decisionReady.length && !dueGates.length && !stale.length;

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
          <Block title="Mesaj atılacaklar" extra={<span className="hub-today__target">bu hafta {sentThisWeek}/{WEEKLY_TARGET.contacts}</span>}>
            {toSend.map((c) => (
              <Row key={c.id} onClick={() => setOpenId(c.id)} av={c.fullName} main={c.fullName}
                meta={`${c.university || '—'}${thresholdMet(c) ? ' · eşik ✓' : ''}`} />
            ))}
          </Block>

          <Block title="Süresi gelen takipler">
            {dueFollowUps.map(({ t, c }) => (
              <Row key={t.id} onClick={() => setOpenId(c.id)} av={c.fullName} main={c.fullName} meta={`takip: ${fmt(t.followUpAt)}`} />
            ))}
          </Block>

          <Block title="Karar bekleyenler">
            {decisionReady.map((c) => (
              <Row key={c.id} onClick={() => setOpenId(c.id)} av={c.fullName} main={c.fullName}
                meta={c.presentedAt ? `sunuldu ${String(c.presentedAt).slice(0, 10)} · karar bekliyor` : 'görüşme eşiği hazır'} />
            ))}
          </Block>

          <Block title="Süresi dolan kapılar">
            {dueGates.map(({ g, c }) => (
              <Row key={g.id} onClick={() => setOpenId(c.id)} av={c.fullName} main={c.fullName} meta={`Kapı ${g.gate} · vade ${fmt(g.dueAt)}`} />
            ))}
          </Block>

          <Block title="Bayatlamış kartlar">
            {stale.map(({ c, s }) => (
              <Row key={c.id} onClick={() => setOpenId(c.id)} av={c.fullName} main={c.fullName}
                meta={`${STAGE_LABEL[c.stage]} · ${s.days} gün`}
                action={<span className={`hub-card__dot hub-card__dot--${s.level}`} />} />
            ))}
          </Block>
        </>
      )}

      {openId && <CandidatePanel candidateId={openId} onClose={() => setOpenId(null)} />}
    </div>
  );
}
