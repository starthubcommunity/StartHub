// today.jsx — Bugün ekranı (§8.1). Varsayılan açılış sayfası.
// Altı blok, tek sütun, her satırda tek tıkla aksiyon.
// Boş blok gizlenir; hepsi boşsa tek satırlık davet.
import React, { useState, useMemo } from 'react';
import { AIcon } from '../../admin/admin-ui';
import { useHubStore } from '../hub-store';
import { isStale } from '../hub-rules';
import { thresholdMet } from '../hub-rules';
import { intervalToDays } from '../hub-metrics';
import { WEEKLY_TARGET, STAGE_LABEL, ROLE_STATUS_LABEL } from '../hub-constants';
import { useHubMember } from '../hub-member';
import CandidatePanel from './candidate';

const startOfWeek = () => {
  const d = new Date();
  const back = (d.getDay() + 6) % 7; // Pazartesi = 0
  d.setDate(d.getDate() - back);
  d.setHours(0, 0, 0, 0);
  return d;
};
const isToday = (v) => {
  if (!v) return false;
  const d = new Date(v);
  const n = new Date();
  return d.getFullYear() === n.getFullYear() && d.getMonth() === n.getMonth() && d.getDate() === n.getDate();
};
const fmt = (v) => (v ? new Date(v).toLocaleString('tr-TR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' }) : '');

function Block({ title, extra, children }) {
  if (!children || (Array.isArray(children) && children.length === 0)) return null;
  return (
    <section className="hub-today__block">
      <div className="hub-today__blockhead">
        <h3>{title}</h3>
        {extra}
      </div>
      <div className="hub-today__rows">{children}</div>
    </section>
  );
}

function Row({ onClick, main, meta, action }) {
  return (
    <div className="hub-today__row" role="button" tabIndex={0}
      onClick={onClick}
      onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onClick(); } }}>
      <span className="hub-today__main">{main}</span>
      <span className="hub-today__meta">{meta}</span>
      {action}
    </div>
  );
}

export default function TodayPage({ onGoto }) {
  const store = useHubStore();
  const { candidates, touches, gates, sources, openRoles, currentMember } = store;
  const role = useHubMember();
  const [openId, setOpenId] = useState(null);
  const byId = useMemo(() => Object.fromEntries(candidates.map((c) => [c.id, c])), [candidates]);
  const now = Date.now();
  const myStartups = currentMember?.startupIds || [];

  // 1) Gönderilecek mesajlar — pool, sorumlusu ben, eşiği geçen
  const toSend = candidates.filter(
    (c) => c.stage === 'pool' && c.ownerId === currentMember?.id && thresholdMet(c)
  );
  const sentThisWeek = touches.filter(
    (t) => t.senderId === currentMember?.id && new Date(t.sentAt) >= startOfWeek()
  ).length;

  // 2) Süresi gelen takipler
  const dueFollowUps = touches
    .filter((t) => t.outcome === 'pending' && t.followUpAt && new Date(t.followUpAt).getTime() <= now)
    .map((t) => ({ t, c: byId[t.candidateId] }))
    .filter((x) => x.c)
    .sort((a, b) => new Date(a.t.followUpAt) - new Date(b.t.followUpAt));

  // 3) Bugünkü görüşmeler
  const interviewsToday = candidates.filter((c) => isToday(c.nextActionAt));

  // 4) Bayatlamış kartlar (kural motoru)
  const stale = candidates
    .filter((c) => c.stage !== 'archived')
    .map((c) => ({ c, s: isStale(c, now) }))
    .filter((x) => x.s.stale)
    .sort((a, b) => b.s.days - a.s.days);

  // 5) Süresi dolan kapılar
  const dueGates = gates
    .filter((g) => g.result === 'pending' && g.dueAt && new Date(g.dueAt).getTime() <= now)
    .map((g) => ({ g, c: byId[g.candidateId] }))
    .filter((x) => x.c);

  // 6) Kontrol zamanı gelen kaynaklar (§8.6.8)
  const dueSources = (sources || []).filter(
    (s) => s.status === 'active' &&
      (!s.lastChecked || now - new Date(s.lastChecked).getTime() >= intervalToDays(s.checkEvery) * 86400000)
  );

  // ── Role göre bloklar (§12.5) ────────────────────────────────
  const roleRequests = (openRoles || []).filter((r) => r.status === 'requested');   // recruiter
  // "Aday bekleyen roller": aranıyor ama üzerinde reddedilmemiş/arşivlenmemiş
  // aday yok. Ret sonrası sourcing'e dönen rol de buraya düşer (§12.3).
  const rolesWaitingCands = (openRoles || []).filter(
    (r) => r.status === 'sourcing' &&
      !candidates.some((c) => c.openRoleId === r.id && c.ownerDecision !== 'rejected' && c.stage !== 'archived')
  );
  const presentedToMe = candidates.filter(                                          // project_owner
    (c) => c.presentedAt && (!c.ownerDecision || c.ownerDecision === 'pending') &&
      c.startupId != null && myStartups.includes(c.startupId)
  );
  const myOpenRoles = (openRoles || []).filter(                                     // project_owner
    (r) => r.startupId != null && myStartups.includes(r.startupId) && !['filled', 'cancelled'].includes(r.status)
  );

  const allEmpty = !toSend.length && !dueFollowUps.length && !interviewsToday.length && !stale.length &&
    !dueGates.length && !dueSources.length && !roleRequests.length && !rolesWaitingCands.length &&
    !presentedToMe.length && !myOpenRoles.length;

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
          Bugün temiz. Havuza yeni aday eklemek ister misin?
          <button className="adm-btn adm-btn--primary adm-btn--sm" style={{ marginTop: 10 }} onClick={() => onGoto?.('table')}>
            <AIcon name="edit" size={14} /> Tabloya git
          </button>
        </div>
      ) : (
        <>
          <Block
            title="Gönderilecek mesajlar"
            extra={<span className="hub-today__target">bu hafta {sentThisWeek}/{WEEKLY_TARGET.contacts}</span>}
          >
            {toSend.map((c) => (
              <Row key={c.id} onClick={() => setOpenId(c.id)}
                main={c.fullName} meta={`${c.university || '—'} · puan ${c.scoreTotal ?? 0}`} />
            ))}
          </Block>

          <Block title="Süresi gelen takipler">
            {dueFollowUps.map(({ t, c }) => (
              <Row key={t.id} onClick={() => setOpenId(c.id)}
                main={c.fullName} meta={`takip: ${fmt(t.followUpAt)}`} />
            ))}
          </Block>

          <Block title="Bugünkü görüşmeler">
            {interviewsToday.map((c) => (
              <Row key={c.id} onClick={() => setOpenId(c.id)}
                main={c.fullName} meta={c.nextAction || 'görüşme'}
                action={c.nextActionLink
                  ? <a className="adm-btn adm-btn--ghost adm-btn--sm" href={c.nextActionLink} target="_blank" rel="noreferrer" onClick={(e) => e.stopPropagation()}>Takvim</a>
                  : null} />
            ))}
          </Block>

          <Block title="Bayatlamış kartlar">
            {stale.map(({ c, s }) => (
              <Row key={c.id} onClick={() => setOpenId(c.id)}
                main={c.fullName}
                meta={`${STAGE_LABEL[c.stage]} · ${s.days} gün`}
                action={<span className={`hub-card__dot hub-card__dot--${s.level}`} />} />
            ))}
          </Block>

          <Block title="Süresi dolan kapılar">
            {dueGates.map(({ g, c }) => (
              <Row key={g.id} onClick={() => setOpenId(c.id)}
                main={c.fullName} meta={`Kapı ${g.gate} · vade ${fmt(g.dueAt)}`} />
            ))}
          </Block>

          <Block title="Kontrol zamanı gelen kaynaklar">
            {dueSources.map((s) => (
              <Row key={s.id} onClick={() => onGoto?.('sources')}
                main={s.name}
                meta={s.lastChecked ? `son kontrol ${String(s.lastChecked).slice(0, 10)}` : 'hiç kontrol edilmedi'} />
            ))}
          </Block>

          {/* §12.5 — recruiter blokları */}
          <Block title="Yeni rol talepleri">
            {roleRequests.map((r) => (
              <Row key={r.id} onClick={() => onGoto?.('roles')} main={r.title}
                meta={`${r.track === 'founder' ? 'kurucu' : 'üye'} hattı · üstlenilmeyi bekliyor`} />
            ))}
          </Block>
          <Block title="Aday bekleyen roller">
            {rolesWaitingCands.map((r) => (
              <Row key={r.id} onClick={() => onGoto?.('roles')} main={r.title}
                meta={`aranıyor · henüz aday yok`} />
            ))}
          </Block>

          {/* §12.5 — proje sahibi blokları */}
          <Block title="Sana sunulan adaylar">
            {presentedToMe.map((c) => (
              <Row key={c.id} onClick={() => setOpenId(c.id)} main={c.fullName}
                meta={`sunuldu ${String(c.presentedAt).slice(0, 10)} · karar bekliyor`} />
            ))}
          </Block>
          <Block title="Açık rollerin">
            {myOpenRoles.map((r) => (
              <Row key={r.id} onClick={() => onGoto?.('roles')} main={r.title}
                meta={ROLE_STATUS_LABEL[r.status]} />
            ))}
          </Block>
        </>
      )}

      {openId && <CandidatePanel candidateId={openId} onClose={() => setOpenId(null)} />}
    </div>
  );
}
