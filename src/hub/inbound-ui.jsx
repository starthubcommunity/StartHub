// inbound-ui.jsx — Inbound sayfalarının ortak parçaları: rozetler, yıldız puan, detay çekmecesi.
import React, { useState } from 'react';
import { AIcon } from '../admin/admin-ui';
import {
  SIDES, INBOUND_STAGES, INBOUND_STAGE_MAP, REJECT_REASONS,
  initials, detailOf, answersOf, timeAgo, slaState, mailtoFor, onboardingItems, onboardingDone,
} from './inbound-model';

const PIPELINE = ['new', 'reviewed', 'interview', 'waitlist', 'accepted'];

export function Avatar({ app, large }) {
  const s = SIDES[app.side] || SIDES.other;
  return <span className={`ib-av${large ? ' ib-av--lg' : ''}`} style={{ '--c': s.color, '--bg': s.bg }}>{initials(app.name)}</span>;
}

export function TypeTag({ app }) {
  const s = SIDES[app.side] || SIDES.other;
  return (
    <span className="ib-tag" style={{ '--c': s.color, '--bg': s.bg }}>
      <AIcon name={app.type.icon} size={11} />{s.label} · {app.type.label}
    </span>
  );
}

export function StageTag({ stage }) {
  const s = INBOUND_STAGE_MAP[stage];
  return <span className="ib-tag" style={{ '--c': s.color, '--bg': s.bg }}>{s.label}</span>;
}

export function Stars({ value }) {
  if (!value) return null;
  return <span className="ib-stars" title={`${value}/5`}>{'★'.repeat(value)}</span>;
}

export function SlaDot({ app }) {
  const sla = slaState(app);
  if (!sla) return null;
  return <span className={`ib-sla ib-sla--${sla}`} title={sla === 'critical' ? '96 saati geçti — yanıt bekliyor' : '48 saati geçti — yanıt bekliyor'} />;
}

export const OwnerBadge = ({ email }) =>
  email ? <span className="ib-owner" title={email}>{email[0].toUpperCase()}</span> : null;

const href = (u) => (/^https?:\/\//i.test(u) ? u : `https://${u}`);
const fmtDate = (iso) => new Date(iso).toLocaleString('tr-TR', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' });
const who = (email) => (email ? email.split('@')[0] : 'sistem');

function timelineOf(app) {
  const items = [{ at: app.createdAt, text: 'Başvuru alındı (web formu)', color: '#2563EB' }];
  for (const e of app.activity) {
    if (e.type === 'stage') {
      const from = INBOUND_STAGE_MAP[e.from]?.label || e.from;
      const to = INBOUND_STAGE_MAP[e.to]?.label || e.to;
      items.push({ at: e.at, by: e.by, color: INBOUND_STAGE_MAP[e.to]?.color, text: `Aşama: ${from} → ${to}${e.text ? ` — ${e.text}` : ''}` });
    } else if (e.type === 'note') items.push({ at: e.at, by: e.by, color: '#D97706', text: e.text });
    else if (e.type === 'contact') items.push({ at: e.at, by: e.by, color: '#7C3AED', text: e.text });
    else items.push({ at: e.at, by: e.by, color: '#A29D94', text: e.text });
  }
  return items.filter((i) => i.at).sort((a, b) => new Date(b.at) - new Date(a.at));
}

export function AppDrawer({ app, api, canWrite, onClose, onToast, startReject }) {
  const [note, setNote] = useState('');
  const [rejecting, setRejecting] = useState(!!startReject);
  const [busy, setBusy] = useState(false);
  const cur = INBOUND_STAGE_MAP[app.stage];
  const curIdx = PIPELINE.indexOf(app.stage);
  const answers = answersOf(app);
  const mine = api.me && app.ownerEmail === api.me;

  const run = async (fn, okMsg) => {
    setBusy(true);
    const err = await fn();
    setBusy(false);
    if (err) onToast(`Kaydedilemedi: ${err}`, true);
    else if (okMsg) onToast(okMsg);
    return !err;
  };

  const move = (to, reason) => run(() => api.changeStage(app.id, to, reason), `Aşama: ${INBOUND_STAGE_MAP[to].label}`);

  return (
    <div className="ib-overlay" onClick={onClose}>
      <aside className="ib-drawer" onClick={(e) => e.stopPropagation()} role="dialog" aria-label={app.name}>
        <div className="ib-drawer__head">
          <div className="ib-drawer__row">
            <Avatar app={app} large />
            <div style={{ flex: 1, minWidth: 0 }}>
              <div className="ib-drawer__name">{app.name}</div>
              <div className="ib-drawer__meta">
                <TypeTag app={app} />
                <StageTag stage={app.stage} />
                <span>{timeAgo(app.createdAt)}</span>
                {app.email && <a href={`mailto:${app.email}`} style={{ color: 'inherit' }}>{app.email}</a>}
              </div>
            </div>
            <button className="adm-icon-btn" onClick={onClose} aria-label="Kapat"><AIcon name="x" size={18} /></button>
          </div>
        </div>

        <div className="ib-drawer__body">
          <section className="ib-sec">
            <h4>Aşama <span style={{ textTransform: 'none', letterSpacing: 0, fontWeight: 500 }}>{cur.hint}</span></h4>
            {app.stage === 'rejected' ? (
              <div className="ib-actions">
                <span className="ib-tag" style={{ '--c': cur.color, '--bg': cur.bg }}>Reddedildi</span>
                {canWrite && <button className="adm-btn adm-btn--ghost adm-btn--sm" disabled={busy} onClick={() => move('reviewed')}>Yeniden aç</button>}
              </div>
            ) : (
              <>
                <div className="ib-stepper">
                  {PIPELINE.map((st, i) => {
                    const s = INBOUND_STAGE_MAP[st];
                    return (
                      <button key={st} disabled={!canWrite || busy}
                        className={`ib-step${app.stage === st ? ' on' : i < curIdx ? ' past' : ''}`}
                        style={{ '--c': s.color, '--bg': s.bg }} onClick={() => move(st)}>{s.label}</button>
                    );
                  })}
                </div>
                {canWrite && (
                  <div className="ib-decide">
                    <button className="adm-btn adm-btn--ghost adm-btn--sm" onClick={() => setRejecting((v) => !v)}>Reddet…</button>
                  </div>
                )}
                {rejecting && (
                  <div className="ib-reasons">
                    <span style={{ fontSize: 12, color: 'var(--adm-text-dim)', width: '100%' }}>Red sebebi</span>
                    {REJECT_REASONS.map((r) => (
                      <button key={r} className="ib-chip" disabled={busy}
                        onClick={async () => { if (await move('rejected', r)) setRejecting(false); }}>{r}</button>
                    ))}
                  </div>
                )}
              </>
            )}
          </section>

          {app.stage === 'accepted' && (() => {
            const items = onboardingItems(app);
            const state = onboardingDone(app);
            const done = items.filter((i) => state[i.key]).length;
            return (
              <section className="ib-sec">
                <h4>Alım adımları <span style={{ textTransform: 'none', letterSpacing: 0, fontWeight: 700, color: done === items.length ? '#16A34A' : 'var(--adm-text-dim)' }}>{done}/{items.length}</span></h4>
                <div className="hub-bar" style={{ marginBottom: 10 }}><i style={{ width: `${(done / items.length) * 100}%`, background: '#16A34A' }} /></div>
                {items.map((it) => (
                  <label key={it.key} className="ib-onb">
                    <input type="checkbox" checked={!!state[it.key]} disabled={!canWrite || busy}
                      onChange={(e) => run(() => api.toggleOnboard(app.id, it.key, it.label, e.target.checked))} />
                    <span style={{ textDecoration: state[it.key] ? 'line-through' : 'none', color: state[it.key] ? 'var(--adm-text-dim)' : 'inherit' }}>{it.label}</span>
                  </label>
                ))}
              </section>
            );
          })()}

          <section className="ib-sec">
            <h4>İşlemler</h4>
            <div className="ib-actions">
              {app.email && (
                <a className="adm-btn adm-btn--primary adm-btn--sm" href={mailtoFor(app)}
                  onClick={() => { if (canWrite) api.logContact(app.id, 'E-posta taslağı açıldı'); }}>
                  <AIcon name="mail" size={14} /> E-posta yaz
                </a>
              )}
              {app.linkedin && <a className="adm-btn adm-btn--ghost adm-btn--sm" href={href(app.linkedin)} target="_blank" rel="noreferrer"><AIcon name="linkedin" size={14} /> LinkedIn</a>}
              {app.portfolio && <a className="adm-btn adm-btn--ghost adm-btn--sm" href={href(app.portfolio)} target="_blank" rel="noreferrer"><AIcon name="externalLink" size={14} /> Portfolyo</a>}
              {app.website && <a className="adm-btn adm-btn--ghost adm-btn--sm" href={href(app.website)} target="_blank" rel="noreferrer"><AIcon name="globe" size={14} /> Web sitesi</a>}
              {canWrite && (
                <button className="adm-btn adm-btn--soft adm-btn--sm" disabled={busy}
                  onClick={() => run(() => api.setOwner(app.id, mine ? null : api.me), mine ? 'Sahiplik bırakıldı' : 'Üstlendin')}>
                  <AIcon name="users" size={14} /> {mine ? 'Sahipliği bırak' : app.ownerEmail ? `Üstlen (şu an: ${who(app.ownerEmail)})` : 'Üstlen'}
                </button>
              )}
            </div>
            <div style={{ marginTop: 12, display: 'flex', alignItems: 'center', gap: 10, fontSize: 12.5, color: 'var(--adm-text-dim)' }}>
              İlk izlenim
              <span className="ib-rate">
                {[1, 2, 3, 4, 5].map((n) => (
                  <button key={n} className={app.rating >= n ? 'on' : ''} disabled={!canWrite}
                    onClick={() => run(() => api.setRating(app.id, app.rating === n ? null : n))} aria-label={`${n} yıldız`}>★</button>
                ))}
              </span>
              {app.lastContactAt && <span style={{ marginLeft: 'auto' }}>Son temas: {timeAgo(app.lastContactAt)}</span>}
            </div>
          </section>

          <section className="ib-sec">
            <h4>Başvuru yanıtları</h4>
            {answers.length === 0 ? <div style={{ fontSize: 13, color: 'var(--adm-text-dim)' }}>Ek bilgi girilmemiş.</div> : (
              <dl className="ib-qa">
                {answers.map(([k, v]) => (<React.Fragment key={k}><dt>{k}</dt><dd>{v}</dd></React.Fragment>))}
                {app.linkedin && (<><dt>LinkedIn</dt><dd><a href={href(app.linkedin)} target="_blank" rel="noreferrer">{app.linkedin}</a></dd></>)}
                {app.portfolio && (<><dt>Portfolyo / GitHub</dt><dd><a href={href(app.portfolio)} target="_blank" rel="noreferrer">{app.portfolio}</a></dd></>)}
              </dl>
            )}
          </section>

          <section className="ib-sec">
            <h4>Notlar ve geçmiş</h4>
            {canWrite && (
              <>
                <textarea className="ib-note-in" placeholder="Not ekle — görüşme özeti, karar gerekçesi…" value={note} onChange={(e) => setNote(e.target.value)} />
                <div style={{ marginTop: 8, textAlign: 'right' }}>
                  <button className="adm-btn adm-btn--primary adm-btn--sm" disabled={busy || !note.trim()}
                    onClick={async () => { if (await run(() => api.addNote(app.id, note), 'Not eklendi')) setNote(''); }}>Notu ekle</button>
                </div>
              </>
            )}
            <ul className="ib-tl">
              {timelineOf(app).map((e, i) => (
                <li key={i} style={{ '--c': e.color }}>
                  <div className="ib-tl__what">{e.text}</div>
                  <div className="ib-tl__when">{fmtDate(e.at)} · {who(e.by)}</div>
                </li>
              ))}
            </ul>
          </section>

          {canWrite && (
            <div style={{ textAlign: 'right' }}>
              <button className="adm-btn adm-btn--ghost adm-btn--sm" style={{ color: '#DC2626' }} disabled={busy}
                onClick={async () => {
                  if (!window.confirm(`${app.name} başvurusu kalıcı olarak silinsin mi? (KVKK silme talebi için)`)) return;
                  const err = await api.remove(app.id);
                  if (err) onToast(`Silinemedi: ${err}`, true); else { onToast('Başvuru silindi'); onClose(); }
                }}>
                <AIcon name="trash" size={14} /> Başvuruyu sil
              </button>
            </div>
          )}
        </div>
      </aside>
    </div>
  );
}

export function Toast({ toast }) {
  if (!toast) return null;
  return <div className={`ib-toast${toast.err ? ' ib-toast--err' : ''}`}>{toast.msg}</div>;
}

export { detailOf };
