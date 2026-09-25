// candidate.jsx — sağdan açılan aday kartı (v2 §3). SEKME YOK.
// Kart, adayın bulunduğu aşamanın alanlarını gösterir; "Detay" ve "Geçmiş"
// akordeonları kapalı. Alanlar optimistic kaydedilir.
import React, { useState, useEffect, useMemo } from 'react';
import { AIcon, Field, ConfirmDialog } from '../../admin/admin-ui';
import { useHubStore } from '../hub-store';
import { useHubMember } from '../hub-member';
import { usePerms } from '../../lib/use-perms';
import {
  RUBRIC_AXES, AI_PRESCORE_FINISHING, ROLE_TYPES, ARCHIVE_REASONS,
  STAGE_LABEL, SOURCE_LABEL, TOUCH_CHANNELS, TOUCH_CHANNEL_LABEL, TOUCH_OUTCOME_LABEL,
  GATE_RESULT_LABEL, TRACKS, TRACK_LABEL, OWNER_DECISION_LABEL,
  GATE, GATE_EXTENSIONS, KVKK_NOTICE_URL, KVKK_NOTICE_LINE, DEFAULT_TRACK,
  INTEREST_LABEL, INTEREST_AREAS,
} from '../hub-constants';
import { thresholdText, canAdvance, presentGate, gateStatus, gateDueAt, canDraftAI, nextAction, undoPlan } from '../hub-rules';
import { fillTemplate } from './templates';
import { generateDraft } from '../hub-ai-draft';
import HubWizard from '../components/wizard';
import { lastChannel, rememberChannel } from '../hub-channel';

const AXIS_FIELD = { finishing: 'scoreFinishing', communication: 'scoreCommunication', capacity: 'scoreCapacity' };
const PRESCORE_LABEL = Object.fromEntries(AI_PRESCORE_FINISHING.map((x) => [x.value, x.when]));

// ── İletişim / form bilgileri — panel açılır açılmaz görünsün diye üstte,
// "Detay" akordeonunun arkasına gizlenmiyor (2026-09-23: e-posta/telefon/ilgi
// alanı önceden yalnızca dolaylı yoldan görünüyordu, HR'ın en çok aradığı
// bilgiler bunlar).
function ContactBlock({ c }) {
  const rows = [
    c.email && { icon: 'mail', label: c.email, href: `mailto:${c.email}` },
    c.phone && { icon: 'phone', label: c.phone, href: `tel:${c.phone.replace(/\s/g, '')}` },
    c.university && { icon: 'building', label: c.university },
    c.interest && { icon: 'target', label: INTEREST_LABEL[c.interest] || c.interest },
  ].filter(Boolean);
  if (!rows.length) return null;
  return (
    <div className="hub-contact">
      {rows.map((r, i) => (
        r.href
          ? <a key={i} className="hub-contact__row hub-contact__row--link" href={r.href}><AIcon name={r.icon} size={14} />{r.label}</a>
          : <span key={i} className="hub-contact__row"><AIcon name={r.icon} size={14} />{r.label}</span>
      ))}
    </div>
  );
}

// ── Aşama şeridi (§Ek) ───────────────────────────────────────────
const STRIPE = [
  { value: 'pool', label: 'Havuz' },
  { value: 'contact', label: 'Temas' },
  { value: 'interview', label: 'Görüşme' },
  { value: 'trial', label: 'Deneme' },
  { value: 'member', label: 'Ekipte' },
];
function StageStripe({ stage }) {
  const idx = STRIPE.findIndex((s) => s.value === stage);   // archived → -1
  return (
    <div className="hub-stripe">
      {STRIPE.map((s, i) => {
        const state = idx < 0 ? 'future' : i < idx ? 'done' : i === idx ? 'now' : 'future';
        return (
          <React.Fragment key={s.value}>
            {i > 0 && <span className={`hub-stripe__line ${idx >= 0 && i <= idx ? 'hub-stripe__line--on' : ''}`} />}
            <div className={`hub-stripe__node hub-stripe__node--${state}`}>
              <span className="hub-stripe__dot">{state === 'done' ? '✓' : i + 1}</span>
              <span className="hub-stripe__lbl">{s.label}</span>
            </div>
          </React.Fragment>
        );
      })}
    </div>
  );
}

// ── Genelleştirilmiş aşama-aksiyon kartı (§1 + §Ek) ──────────────
// Tek soru başlıkta, altta 1-2 büyük seçenek butonu. Seçilince ilgili
// GERÇEK store fonksiyonu / canAdvance() çağrılır.
function StageActionCard({ question, options }) {
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');
  const pick = async (o) => {
    setBusy(true); setErr('');
    try { await o.run(); } catch (e) { setErr(e?.message || 'İşlem başarısız.'); }
    setBusy(false);
  };
  return (
    <div className="hub-stageaction">
      <div className="hub-stageaction__q">{question}</div>
      <div className="hub-wz__opts">
        {options.map((o, i) => (
          <button key={i} type="button" className="hub-wz__opt" disabled={busy || o.disabled}
            title={o.disabled ? (o.disabledHint || '') : ''} onClick={() => pick(o)}>
            <span className="hub-wz__opt-l">{o.label}</span>
            {o.hint != null && <span className="hub-wz__opt-r">{o.hint}</span>}
          </button>
        ))}
      </div>
      {err && <div className="hub-wz__err" style={{ padding: '6px 0 0' }}>{err}</div>}
    </div>
  );
}

// Aşamaya göre "sıradaki adım" kartını kurar — her seçenek GERÇEK bir
// store fn / canAdvance() çağırır (cron / hub-daily bağımlılığı YOK).
// v3: Havuz'da mesaj alanı (MessageArea) kartın gövdesinde — burada kart yok.
// Temas'ta tek aksiyon: "Cevap geldi, görüşmeye geç" (A2).
function NextStepCard({ c, store, openRole, role, afterAdvance, flash }) {
  const stage = c.stage;

  if (stage === 'contact') {
    return (
      <StageActionCard question="Aday cevap verdi mi?" options={[
        { label: 'Cevap geldi, görüşmeye geç', hint: 'son mesaj "cevaplandı" + aşama Görüşme', run: async () => {
          await store.replyAndAdvance(c.id);
          afterAdvance(); flash?.('Cevap işaretlendi · Aşama: Görüşme.');
        } },
      ]} />
    );
  }

  // interview → karar + mail InterviewSection'da (C2).
  return null;   // pool → MessageArea, trial → TrialSection/GateCard, member → bitti.
}

// blur'da işleyen metin/textarea alanı
function LField({ label, value, onCommit, textarea, type = 'text', hint, options }) {
  const [v, setV] = useState(value ?? '');
  useEffect(() => { setV(value ?? ''); }, [value]);
  const commit = () => { if (String(v ?? '') !== String(value ?? '')) onCommit(v); };
  let control;
  if (options) {
    control = (
      <select className="adm-input adm-select" value={v ?? ''} onChange={(e) => { setV(e.target.value); onCommit(e.target.value); }}>
        <option value="">—</option>
        {options.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
      </select>
    );
  } else if (textarea) {
    control = <textarea className="adm-input adm-textarea" value={v ?? ''} rows={3} onChange={(e) => setV(e.target.value)} onBlur={commit} />;
  } else {
    control = <input className="adm-input" type={type} value={v ?? ''} onChange={(e) => setV(e.target.value)} onBlur={commit}
      onKeyDown={(e) => { if (e.key === 'Enter') e.currentTarget.blur(); }} />;
  }
  return <Field label={label} hint={hint}>{control}</Field>;
}

export default function CandidatePanel({ candidateId, onClose }) {
  const store = useHubStore();
  const role = useHubMember();
  const candidate = store.candidates.find((c) => c.id === candidateId);
  const openRole = candidate?.openRoleId ? store.openRoles.find((r) => r.id === candidate.openRoleId) || null : null;
  const [history, setHistory] = useState(null);
  const [showHistory, setShowHistory] = useState(false);
  const [showDetail, setShowDetail] = useState(false);
  const [archiving, setArchiving] = useState(false);
  const [confirmUndo, setConfirmUndo] = useState(false);
  const [toast, setToast] = useState(null);
  const flash = (m) => { setToast(m); setTimeout(() => setToast(null), 3500); };

  // A3 (+ Blok A düzeltmeleri 2-3) — geri alma planı SAF fonksiyondan gelir;
  // extendGate / önceki geri-alma satırları atlanır, hedef daima gerçek bir
  // önceki aşamadır. member → çoklu kayıt etkiler, onay istenir.
  const undo = candidate ? undoPlan(candidate, store.stageLog) : null;
  const runUndo = () => store.undoLastStage(candidateId)
    .then(() => { setHistory(null); setConfirmUndo(false); flash(`Geri alındı → ${undo?.label || 'önceki aşama'}.`); })
    .catch((e) => { setConfirmUndo(false); flash('Geri alınamadı: ' + e.message); });
  const doUndo = () => { if (undo?.affectsMany) setConfirmUndo(true); else runUndo(); };

  useEffect(() => {
    if (showHistory && !history && candidate) {
      store.loadHistory(candidateId).then(setHistory).catch(() => setHistory({ touches: [], interviews: [], gates: [], stageLog: [] }));
    }
  }, [showHistory, history, candidate, candidateId, store]);

  const save = async (patch) => {
    if (!candidate) return;
    const prev = {};
    Object.keys(patch).forEach((k) => { prev[k] = candidate[k]; });
    store.patchCandidate(candidateId, patch);
    try { await store.updateCandidate(candidateId, { ...candidate, ...patch }); }
    catch { store.patchCandidate(candidateId, prev); }
  };

  if (!candidate) return null;
  const c = candidate;
  const stage = c.stage;

  return (
    <div className="hub-panel-overlay" onClick={onClose}>
      <div className="hub-panel" onClick={(e) => e.stopPropagation()}>
        <div className="hub-panel__head">
          <div>
            <div className="hub-panel__title">{c.fullName}</div>
            {/* A5 — rol ve hat üst şeritte ETİKET; form alanı değil, aşamada tekrar sorulmaz */}
            <div style={{ fontSize: 12, color: '#A29D94', marginTop: 6, display: 'flex', gap: 6, alignItems: 'center', flexWrap: 'wrap' }}>
              <span className="hub-pill hub-pill--stage">{STAGE_LABEL[stage]}</span>
              <span className={`hub-pill hub-pill--track-${(c.track || DEFAULT_TRACK) === 'member' ? 'member' : 'founder'}`}>
                {TRACK_LABEL[c.track || DEFAULT_TRACK]} hattı
              </span>
              {openRole && <span className="hub-pill">{openRole.title}</span>}
              <span className="hub-pill hub-pill--source">{SOURCE_LABEL[c.source] || c.source}</span>
              {nextAction(c, store.touches, store.gates) && (
                <span className="hub-pill hub-pill--ok">→ {nextAction(c, store.touches, store.gates).label}</span>
              )}
            </div>
            <ContactBlock c={c} />
          </div>
          <button className="adm-icon-btn" onClick={onClose}><AIcon name="x" size={18} /></button>
        </div>

        <div style={{ display: 'flex', gap: 8, padding: '10px 16px', borderBottom: '1px solid var(--adm-border)', background: 'var(--adm-bg-card)', flexWrap: 'wrap' }}>
          {undo && (
            <button className="adm-btn adm-btn--ghost adm-btn--sm" onClick={doUndo}>
              <AIcon name="refresh" size={13} /> Geri al ({undo.label})
            </button>
          )}
          {stage !== 'member' && stage !== 'archived' && (
            <button className="adm-btn adm-btn--ghost adm-btn--sm" style={{ marginLeft: 'auto' }} onClick={() => setArchiving(true)}>
              <AIcon name="trash" size={13} /> Arşivle
            </button>
          )}
          {stage === 'archived' && (
            <button className="adm-btn adm-btn--ghost adm-btn--sm" style={{ marginLeft: 'auto' }}
              onClick={() => store.advanceStage(candidateId, 'pool', { reason: 'arşivden geri alındı', extra: { archiveReason: null } }).then(() => { setHistory(null); flash('Havuz\'a geri alındı.'); }).catch((e) => flash('Hata: ' + e.message))}>
              <AIcon name="refresh" size={13} /> Havuz'a geri al
            </button>
          )}
        </div>

        <div className="hub-panel__body">
          <StageStripe stage={stage} />

          <TrackRoleSection c={c} openRole={openRole} role={role} store={store} flash={flash} />

          {/* §1 — gerçek aksiyon tetikleyen aşama kartı (Havuz'da MessageArea sürer) */}
          <NextStepCard c={c} store={store} openRole={openRole} role={role}
            afterAdvance={() => setHistory(null)} flash={flash} />

          {stage === 'pool' && <PoolSection c={c} save={save} />}
          {(stage === 'pool' || stage === 'contact') && (
            <MessageArea c={c} save={save} flash={flash} onSent={() => setHistory(null)} />
          )}
          {stage === 'contact' && <ContactSection c={c} history={history} />}
          {stage === 'interview' && <InterviewSection c={c} save={save} role={role} openRole={openRole} flash={flash} onDone={() => setHistory(null)} />}
          {stage === 'trial' && <TrialSection c={c} />}
          {stage === 'member' && <MemberSection c={c} />}

          {/* Detay akordeonu */}
          <button className="adm-btn adm-btn--ghost adm-btn--sm" style={{ marginTop: 16 }} onClick={() => setShowDetail((v) => !v)}>
            <AIcon name={showDetail ? 'chevronDown' : 'chevronRight'} size={13} /> Detay
          </button>
          {showDetail && (
            <div style={{ marginTop: 8 }}>
              <div className="adm-form-grid">
                <LField label="Ad Soyad" value={c.fullName} onCommit={(v) => save({ fullName: v })} />
                <LField label="E-posta" type="email" value={c.email || ''} onCommit={(v) => save({ email: v || null })} />
                <LField label="Telefon" value={c.phone || ''} onCommit={(v) => save({ phone: v || null })} />
                <LField label="İlgi alanı" value={c.interest || ''} onCommit={(v) => save({ interest: v || null })} options={INTEREST_AREAS} />
                <LField label="Link" value={c.github || c.linkedin || ''}
                  onCommit={(v) => save(detectLink(v))} hint="GitHub / LinkedIn" />
                <LField label="Okul / durum" value={c.university} onCommit={(v) => save({ university: v })} hint="Serbest — örn. Boğaziçi, 3. sınıf" />
                <LField label="Rol tipi" value={c.roleType} onCommit={(v) => save({ roleType: v || null })} options={ROLE_TYPES} />
                <LField label="Haftalık saat" type="number" value={c.weeklyHours ?? ''} onCommit={(v) => save({ weeklyHours: v === '' ? null : Number(v) })} />
              </div>
              <h4 className="hub-h4">Kanıt linkleri</h4>
              <EvidenceList evidence={c.evidence || []} onChange={(ev) => save({ evidence: ev })} />
            </div>
          )}

          {/* Geçmiş akordeonu */}
          <button className="adm-btn adm-btn--ghost adm-btn--sm" style={{ marginTop: 10 }} onClick={() => setShowHistory((v) => !v)}>
            <AIcon name={showHistory ? 'chevronDown' : 'chevronRight'} size={13} /> Geçmişi göster
          </button>
          {showHistory && <HistoryList history={history} />}
        </div>
      </div>

      {archiving && (
        <HubWizard title="Arşivle" submitLabel="Arşivle" onCancel={() => setArchiving(false)}
          steps={[{ key: 'reason', type: 'options', q: 'Neden arşivleniyor?',
            options: ARCHIVE_REASONS.map((r) => ({ value: r.value, label: r.label })) }]}
          onComplete={async (a) => {
            await store.advanceStage(candidateId, 'archived', { reason: 'arşivlendi', extra: { archiveReason: a.reason } });
            setHistory(null); flash('Arşivlendi.');
          }} />
      )}
      <ConfirmDialog open={confirmUndo} onClose={() => setConfirmUndo(false)} onConfirm={runUndo}
        title="Ekibe almayı geri al?"
        message="Aday Deneme aşamasına döner; katılım / hak ediş tarihleri silinir ve bağlı rol yeniden açılır. Bu işlem birden fazla kaydı etkiler." />
      {toast && <div className="hub-toast">{toast}</div>}
    </div>
  );
}

function detectLink(v) {
  const s = (v || '').trim();
  if (!s) return { github: null, linkedin: null };
  if (/github\.com/i.test(s)) return { github: s };
  if (/linkedin\.com/i.test(s)) return { linkedin: s };
  if (/@/.test(s) && !/^https?:/i.test(s)) return { email: s };
  return { linkedin: s };
}

// ── Hat & Rol · sunma · karar ──────────────────────────────────────
function TrackRoleSection({ c, openRole, role, store, flash }) {
  const { can } = usePerms();
  const [busy, setBusy] = useState(false);
  const [note, setNote] = useState('');
  const myStartups = store.currentMember?.startupIds || [];

  const linkable = store.openRoles.filter((r) => {
    if (!['sourcing', 'shortlist'].includes(r.status)) return false;
    if (role === 'project_owner') return r.startupId != null && myStartups.includes(r.startupId);
    return true;
  });

  const chk = presentGate(c, openRole);
  const canPresentNow = can('present') && chk.ok && !c.presentedAt && openRole?.status === 'sourcing' && role !== 'project_owner';
  const decidePending = can('decide') && c.presentedAt && (!c.ownerDecision || c.ownerDecision === 'pending');

  const present = async () => {
    setBusy(true);
    try { await store.presentCandidate(c.id, openRole.id); flash?.('Aday proje sahibine sunuldu.'); }
    catch (e) { flash?.('Sunulamadı: ' + e.message); }
    setBusy(false);
  };
  const decide = async (decision) => {
    if (!note.trim()) { flash?.('Karar gerekçesi zorunludur.'); return; }
    setBusy(true);
    try {
      await store.ownerDecide(c.id, decision, note.trim());
      flash?.(decision === 'accepted' ? 'Kabul edildi · Deneme (Kapı A) başladı.' : 'Reddedildi.');
      setNote('');
    } catch (e) { flash?.(e.message); }
    setBusy(false);
  };

  // A5 (+ Blok A düzeltmesi 1): rol ve hat kartın ÜST ŞERİDİNDE etiket (bkz.
  // CandidatePanel başlığı). Hiçbir aşamada form alanı olarak render EDİLMEZ —
  // düzenleme yalnızca kartta KATLANMIŞ küçük bir menüde. Rol bağlama yazma
  // yetkisi olan herkeste (sunma akışı buna bağlı); hat geçersiz kılma yalnızca
  // cofounder'da.
  const isCofounder = can('members.manage');
  const canEditLink = can('candidates.write');

  return (
    <div className="hub-gates" style={{ marginBottom: 16 }}>
      {canEditLink && (
        <details style={{ marginBottom: 10 }}>
          <summary style={{ fontSize: 12, color: 'var(--adm-text-dim)', cursor: 'pointer' }}>
            Rol / hat düzenle
          </summary>
          <div className="adm-form-grid" style={{ marginTop: 8 }}>
            <Field label="Bağlı açık rol" hint="Hat bu rolden miras alınır.">
              <select className="adm-input adm-select" value={c.openRoleId || ''} onChange={(e) => store.linkCandidateRole(c.id, e.target.value || null)}>
                <option value="">—</option>
                {linkable.map((r) => <option key={r.id} value={r.id}>{r.title}{r.track === 'member' ? ' · üye' : ' · kurucu'}</option>)}
                {c.openRoleId && !linkable.some((r) => r.id === c.openRoleId) && openRole && (
                  <option value={openRole.id}>{openRole.title} (mevcut)</option>
                )}
              </select>
            </Field>
            {/* 0045 — klasör taşıma ("dağıtma"): dosya gezgini modelinde bir aday
                tek klasörde durur, buradan başka klasöre taşınır ya da kategorisiz bırakılır. */}
            <Field label="Klasör">
              <select className="adm-input adm-select" value={c.folderId || ''}
                onChange={(e) => store.updateCandidate(c.id, { ...c, folderId: e.target.value || null }).catch((err) => flash?.(err.message))}>
                <option value="">Kategorisiz</option>
                {[...store.folders].sort((a, b) => (a.name || '').localeCompare(b.name || '', 'tr'))
                  .map((f) => <option key={f.id} value={f.id}>{f.name}</option>)}
              </select>
            </Field>
            {isCofounder && (
              <Field label="Hat (geçersiz kıl · kurucu)">
                <select className="adm-input adm-select" value={c.track || DEFAULT_TRACK}
                  onChange={(e) => store.updateCandidate(c.id, { ...c, track: e.target.value }).then(() => flash?.('Hat değişti.')).catch((err) => flash?.(err.message))}>
                  {TRACKS.map((t) => <option key={t.value} value={t.value}>{t.label}</option>)}
                </select>
              </Field>
            )}
          </div>
        </details>
      )}

      {/* 2026-09-25 — bu sunma/karar akışı (görüşme eşiği geçilir geçilmez
          Deneme'ye "davet" kararı) YALNIZCA kurucu hattında kaldı. Üye
          hattında ekibe alım kararı artık burada değil, Kapı A'yı geçtikten
          SONRA TrialSection'daki "Proje sahibine sun" ile Team App'teki
          gerçek Team Lead'e taşınıyor (bkz. hub-store.presentToOwner) — bu
          yüzden bu blok her aşamada çıkıp kafa karıştırmıyor artık. */}
      {(c.track || DEFAULT_TRACK) === 'founder' && (<>
        {decidePending && (
          <div className="hub-threshold hub-threshold--no" style={{ display: 'block', marginTop: 8 }}>
            <strong>Sana sunuldu — kabul veya ret ver (gerekçe zorunlu).</strong>
            <textarea className="adm-input adm-textarea" rows={2} style={{ margin: '6px 0' }} value={note}
              onChange={(e) => setNote(e.target.value)} placeholder="Kararının gerekçesi…" />
            <div style={{ display: 'flex', gap: 8 }}>
              <button className="adm-btn adm-btn--primary adm-btn--sm" disabled={busy || !note.trim()} onClick={() => decide('accepted')}>Kabul</button>
              <button className="adm-btn adm-btn--ghost adm-btn--sm" disabled={busy || !note.trim()} onClick={() => decide('rejected')}>Ret</button>
            </div>
          </div>
        )}

        {c.presentedAt ? (
          <div style={{ fontSize: 13, marginTop: 6 }}>
            <strong>Sunuldu:</strong> {String(c.presentedAt).slice(0, 10)} ·{' '}
            {c.ownerDecision && c.ownerDecision !== 'pending' ? (
              <span className="hub-pill" style={c.ownerDecision === 'accepted' ? { background: 'var(--adm-green-light)', color: 'var(--adm-green)' } : { background: 'var(--adm-red-light)', color: 'var(--adm-red)' }}>
                {OWNER_DECISION_LABEL[c.ownerDecision]}
              </span>
            ) : <span className="hub-pill">proje sahibi kararı bekleniyor</span>}
            {c.ownerDecisionNote && <div style={{ color: 'var(--adm-text-secondary)', marginTop: 2 }}>Gerekçe: {c.ownerDecisionNote}</div>}
          </div>
        ) : (
          <div style={{ marginTop: 6 }}>
            <button className="adm-btn adm-btn--primary adm-btn--sm" disabled={!canPresentNow || busy} onClick={present}
              title={canPresentNow ? '' : (chk.reason || 'Sunulamaz')}>
              Proje sahibine sun
            </button>
            {!chk.ok && openRole && <span style={{ fontSize: 12, color: 'var(--adm-text-dim)', marginLeft: 8 }}>{chk.reason}</span>}
          </div>
        )}
      </>)}
    </div>
  );
}

// ── Havuz — kimlik + "neden bu kişi" (mesaj alanı MessageArea'da) ──
function PoolSection({ c, save }) {
  return (
    <div>
      <div className="adm-form-grid">
        <LField label="Ad Soyad" value={c.fullName} onCommit={(v) => save({ fullName: v })} />
        <LField label="Link" value={c.github || c.linkedin || c.email || ''} onCommit={(v) => save(detectLink(v))} hint="GitHub / LinkedIn / e-posta" />
      </div>
      <LField label="Neden bu kişi?" textarea value={c.whyThisOne} onCommit={(v) => save({ whyThisOne: v })}
        hint="Somut esere atıf (repo / proje / yarışma / yazı). Sıfat değil, ne yaptığı." />
    </div>
  );
}

// ── Mesaj alanı (v3 §9.1) ────────────────────────────────────────
// Şablon seçimi ana akıştan çıktı. Metin doğrudan düzenlenebilir: draft_text
// varsa o, yoksa "Taslak oluştur". Kopyala HİÇBİR ŞEY tetiklemez. Ana aksiyon
// "Mesajı attım" → kanal sorulur (son kullanılan varsayılan) → sendTouch.
function MessageArea({ c, save, flash, onSent }) {
  const store = useHubStore();
  const active = useMemo(() => store.templates.filter((t) => t.active), [store.templates]);
  const [text, setText] = useState(c.draftText || '');
  const [busy, setBusy] = useState(false);
  const [marking, setMarking] = useState(false);
  const [showTpl, setShowTpl] = useState(false);
  useEffect(() => { setText(c.draftText || ''); }, [c.id]); // eslint-disable-line

  const commit = () => { if ((text || '') !== (c.draftText || '')) save({ draftText: text }); };

  const runDraft = async () => {
    if (!canDraftAI(c)) { flash('Veri yetersiz, elle yaz. Kaynak detayı / "neden bu kişi" / kanıt linki gerekli.'); return; }
    setBusy(true);
    try { const { text: t } = await generateDraft(c); setText(t); await save({ draftText: t }); flash('Taslak oluşturuldu.'); }
    catch (e) { flash(e.message); }
    setBusy(false);
  };

  const copy = async () => {
    try { await navigator.clipboard.writeText(text || ''); flash('Panoya kopyalandı.'); }
    catch { flash('Kopyalanamadı — metni elle seç.'); }
  };

  const markSent = async (channel) => {
    setBusy(true);
    try {
      rememberChannel(channel);
      if ((text || '') !== (c.draftText || '')) await save({ draftText: text });
      const res = await store.sendTouch(c, { templateId: null, channel, personalization: (text || '').trim() || null });
      setMarking(false);
      onSent?.();
      flash(res?.advanced ? 'Mesaj kaydedildi · aday "Temas"a geçti.' : 'Mesaj kaydedildi.');
    } catch (e) { flash('Kaydedilemedi: ' + e.message); }
    setBusy(false);
  };

  return (
    <div className="hub-ai" style={{ marginTop: 12 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap', marginBottom: 6 }}>
        <b>Mesaj</b>
        {active.length > 0 && (
          <button className="adm-btn adm-btn--ghost adm-btn--sm" onClick={() => setShowTpl((v) => !v)}>Şablondan başla</button>
        )}
        <span style={{ marginLeft: 'auto', display: 'flex', gap: 6 }}>
          <button className="adm-btn adm-btn--ghost adm-btn--sm" disabled={busy || !canDraftAI(c)}
            title={canDraftAI(c) ? '' : 'Veri yetersiz — elle yaz'} onClick={runDraft}>
            {busy ? '…' : (text ? 'Yeniden yaz (AI)' : 'Taslak oluştur')}
          </button>
          <button className="adm-btn adm-btn--ghost adm-btn--sm" disabled={!text} onClick={copy}>Kopyala</button>
        </span>
      </div>

      {showTpl && (
        <select className="adm-input adm-select" style={{ marginBottom: 6 }} defaultValue=""
          onChange={(e) => {
            const tpl = active.find((t) => t.id === e.target.value);
            if (tpl) { const b = fillTemplate(tpl.body, c); setText(b); save({ draftText: b }); setShowTpl(false); }
          }}>
          <option value="" disabled>Şablon seç…</option>
          {active.map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}
        </select>
      )}

      <textarea className="adm-input adm-textarea" rows={7} value={text}
        onChange={(e) => setText(e.target.value)} onBlur={commit}
        placeholder="Mesaj metni — düzenleyebilirsin. AI taslağı için sağ üstteki düğme." />

      {/* E3 — ilk mesajda KVKK aydınlatma satırı bulunmalı */}
      {c.stage === 'pool' && !text.includes(KVKK_NOTICE_URL) && (
        <div style={{ fontSize: 12, color: 'var(--adm-text-dim)', marginTop: 4 }}>
          İlk mesajda KVKK aydınlatması olmalı.{' '}
          <button className="adm-btn adm-btn--ghost adm-btn--sm" onClick={() => { const t = `${text.trim()}\n\n${KVKK_NOTICE_LINE}`.trim(); setText(t); save({ draftText: t }); }}>
            Satırı ekle
          </button>
        </div>
      )}

      <div style={{ marginTop: 8 }}>
        {marking ? (
          <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
            <span style={{ fontSize: 12, color: 'var(--adm-text-dim)' }}>Hangi kanaldan?</span>
            {TOUCH_CHANNELS.map((ch) => (
              <button key={ch.value} className={`adm-btn adm-btn--sm ${ch.value === lastChannel() ? 'adm-btn--primary' : 'adm-btn--ghost'}`}
                disabled={busy} onClick={() => markSent(ch.value)}>{ch.label}</button>
            ))}
            <button className="adm-btn adm-btn--ghost adm-btn--sm" disabled={busy} onClick={() => setMarking(false)}>Vazgeç</button>
          </div>
        ) : (
          <button className="adm-btn adm-btn--primary adm-btn--sm" disabled={busy} onClick={() => setMarking(true)}>
            <AIcon name="check" size={13} /> Mesajı attım
          </button>
        )}
      </div>
    </div>
  );
}

// ── Temas ─────────────────────────────────────────────────────────
function ContactSection({ c, history }) {
  const store = useHubStore();
  const touches = store.touches.filter((t) => t.candidateId === c.id).sort((a, b) => new Date(b.sentAt) - new Date(a.sentAt));
  const last = touches[0];
  return (
    <div>
      <h4 className="hub-h4">Son mesaj</h4>
      {last ? (
        <div style={{ fontSize: 13 }}>
          <div style={{ color: 'var(--adm-text-dim)' }}>
            {String(last.sentAt).slice(0, 16).replace('T', ' ')} · {TOUCH_CHANNEL_LABEL[last.channel] || last.channel} · {TOUCH_OUTCOME_LABEL[last.outcome] || last.outcome}
          </div>
          {last.note && <div style={{ marginTop: 4, whiteSpace: 'pre-wrap' }}>{last.note}</div>}
          {last.followUpAt && <div style={{ color: 'var(--adm-text-secondary)', marginTop: 4 }}>Takip: {String(last.followUpAt).slice(0, 10)}</div>}
        </div>
      ) : <div style={{ fontSize: 13, color: 'var(--adm-text-dim)' }}>Henüz temas kaydı yok.</div>}
    </div>
  );
}

// ── Görüşme kararı maili (C2) — OTOMATİK DEĞİL, kullanıcı onaylayıp gönderir ──
const DECISION_DEFAULT = {
  invite: {
    subject: 'Start-Hub — denemeye davet',
    body: 'Merhaba {{ad}},\n\nGörüşmemiz için teşekkürler. Seninle sınırlı süreli, küçük bir deneme adımına geçmek istiyoruz. Görev detaylarını ayrıca paylaşacağız.\n\nUygun musun? Kısa bir "evet" yeterli.\n\nStart-Hub',
  },
  reject: {
    subject: 'Start-Hub — görüşme sonucu',
    body: 'Merhaba {{ad}},\n\nAyırdığın zaman ve ilgin için teşekkürler. Bu aşamada birlikte ilerlememe kararı aldık — kararımız yeteneklerinle ilgili değil; şu anki ihtiyaç ve zamanlama örtüşmedi.\n\nYolun açık olsun.\n\nStart-Hub',
  },
};
const REJECT_REASONS = [
  { value: 'we_passed', label: 'Biz geçtik' },
  { value: 'below_bar', label: 'Çıtanın altında' },
];

function DecisionMail({ kind, c, role, openRole, onCancel, onDone, flash }) {
  const store = useHubStore();
  const tpl = useMemo(
    () => store.templates.find((t) => t.active && t.sourceType === kind) || null,
    [store.templates, kind]
  );
  const base = DECISION_DEFAULT[kind];
  const [subject, setSubject] = useState(tpl?.subject || base.subject);
  const [body, setBody] = useState(fillTemplate(tpl?.body || base.body, c));
  const [reason, setReason] = useState('we_passed');
  const [sendMail, setSendMail] = useState(!!c.email);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');

  const trialChk = kind === 'invite' ? canAdvance({ ...c, stage: 'interview' }, 'trial', { role, openRole }) : { ok: true };

  const run = async () => {
    if (kind === 'invite' && !trialChk.ok) { setErr(trialChk.reason || 'Eşik sağlanmıyor.'); return; }
    setBusy(true); setErr('');
    try {
      if (sendMail && c.email) await store.sendCandidateMail(c, { subject: subject.trim(), body: body.trim() });
      if (kind === 'invite') {
        await store.advanceStage(c.id, 'trial', { reason: 'görüşme geçti — denemeye davet' });
      } else {
        await store.advanceStage(c.id, 'archived', { reason: 'görüşme sonrası ret', extra: { archiveReason: reason } });
      }
      onDone?.();
      flash?.(kind === 'invite'
        ? (sendMail && c.email ? 'Denemeye alındı · davet maili gönderildi.' : 'Denemeye alındı.')
        : (sendMail && c.email ? 'Ret · mail gönderildi.' : 'Ret · arşivlendi.'));
      onCancel();
    } catch (e) { setErr(e.message || 'İşlem başarısız.'); }
    setBusy(false);
  };

  return (
    <div className="hub-ai" style={{ marginTop: 12 }}>
      <div style={{ fontWeight: 700, marginBottom: 6 }}>
        {kind === 'invite' ? 'Denemeye davet' : 'Nazik ret'} — mail hazır, gönderen sensin
      </div>

      {!c.email && (
        <div style={{ fontSize: 12, color: 'var(--adm-text-dim)', marginBottom: 8 }}>
          Adayın e-postası yok — mail gönderilemez, karar yine verilebilir.
        </div>
      )}

      {c.email && (
        <label style={{ display: 'flex', gap: 6, alignItems: 'center', fontSize: 13, marginBottom: 8 }}>
          <input type="checkbox" checked={sendMail} onChange={(e) => setSendMail(e.target.checked)} />
          {c.email} adresine mail gönder
        </label>
      )}

      {sendMail && c.email && (
        <>
          <Field label="Konu">
            <input className="adm-input" value={subject} onChange={(e) => setSubject(e.target.value)} />
          </Field>
          <Field label="Metin" hint="Düzenleyebilirsin. Gönder'e basılmadan mail gitmez.">
            <textarea className="adm-input adm-textarea" rows={8} value={body} onChange={(e) => setBody(e.target.value)} />
          </Field>
        </>
      )}

      {kind === 'reject' && (
        <Field label="Arşiv sebebi">
          <select className="adm-input adm-select" value={reason} onChange={(e) => setReason(e.target.value)}>
            {REJECT_REASONS.map((r) => <option key={r.value} value={r.value}>{r.label}</option>)}
          </select>
        </Field>
      )}

      {kind === 'invite' && !trialChk.ok && (
        <div style={{ fontSize: 12, color: 'var(--adm-red)', marginBottom: 8 }}>{trialChk.reason}</div>
      )}
      {err && <div style={{ fontSize: 12, color: 'var(--adm-red)', marginBottom: 8 }}>{err}</div>}

      <div style={{ display: 'flex', gap: 8 }}>
        <button className="adm-btn adm-btn--primary adm-btn--sm" disabled={busy || (kind === 'invite' && !trialChk.ok)} onClick={run}>
          {busy ? '…' : kind === 'invite'
            ? (sendMail && c.email ? 'Gönder ve Deneme\'ye al' : 'Mailsiz Deneme\'ye al')
            : (sendMail && c.email ? 'Gönder ve arşivle' : 'Mailsiz arşivle')}
        </button>
        <button className="adm-btn adm-btn--ghost adm-btn--sm" disabled={busy} onClick={onCancel}>Vazgeç</button>
      </div>
    </div>
  );
}

// ── Görüşme (rubrik + serbest not) — v3: kırmızı bayrak YOK ────────
function InterviewSection({ c, save, role, openRole, flash, onDone }) {
  const track = c.track || DEFAULT_TRACK;
  const trialChk = canAdvance({ ...c, stage: 'interview' }, 'trial', { role, openRole });
  const [decision, setDecision] = useState(null);   // 'invite' | 'reject' | null

  // Puanlar KİLİTLENMEZ — aynı butona tekrar basmak sıfırlar, farklıya basmak değiştirir.
  const setScore = (axisKey, n) => { const f = AXIS_FIELD[axisKey]; save({ [f]: c[f] === n ? null : n }); };

  return (
    <div>
      <h4 className="hub-h4">Rubrik</h4>
      <p style={{ fontSize: 12, color: 'var(--adm-text-dim)', marginBottom: 12 }}>
        {track === 'member' ? 'Üye' : 'Kurucu'} hattı eşiği: {thresholdText(track, openRole)}. Puanları istediğin zaman değiştirebilirsin.
      </p>
      {RUBRIC_AXES.map((ax) => {
        // Üye hattında iletişim ekseni yalnızca rol needsCommunication ise istenir;
        // aksi halde eksen tamamen gizlenir (eşik zaten yoksayar).
        const hidden = track === 'member' && ax.value === 'communication' && !openRole?.needsCommunication;
        if (hidden) return null;
        const cur = c[AXIS_FIELD[ax.value]];
        return (
          <div key={ax.value} style={{ marginBottom: 14 }}>
            <div style={{ fontSize: 13, fontWeight: 600 }}>{ax.label}</div>
            <div style={{ fontSize: 11.5, color: 'var(--adm-text-dim)', marginBottom: 6 }}>{ax.hint}</div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
              {[1, 2, 3, 4, 5].map((n) => (
                <button key={n}
                  className={`adm-btn adm-btn--sm ${cur === n ? 'adm-btn--primary' : 'adm-btn--ghost'}`}
                  style={{ justifyContent: 'flex-start', textAlign: 'left' }}
                  onClick={() => setScore(ax.value, n)}>
                  {ax.value === 'finishing' ? (PRESCORE_LABEL[n] || `Seviye ${n}`) : `Seviye ${n}`}
                </button>
              ))}
            </div>
          </div>
        );
      })}
      {track === 'member' && !openRole?.needsCommunication && (
        <div style={{ fontSize: 12, color: '#A29D94', marginBottom: 8 }}>
          İletişim ekseni bu rolde istenmiyor — bitirmişlik ve kapasite yeterli.
        </div>
      )}

      <div className={`hub-threshold ${trialChk.ok ? 'hub-threshold--ok' : 'hub-threshold--no'}`}>
        <AIcon name={trialChk.ok ? 'check' : 'x'} size={16} />
        {trialChk.ok ? 'Deneme eşiği sağlanıyor.' : (trialChk.reason || 'Deneme eşiği sağlanmıyor.')}
      </div>

      {/* A4 — kırmızı bayrakların yerine tek serbest not. Kararı insan verir. */}
      <LField label="Görüşme notu" textarea value={c.interviewNote}
        onCommit={(v) => save({ interviewNote: v })}
        hint="Endişeler, izlenimler, açık sorular — serbest metin. İlerlemeyi engellemez." />

      {/* C2 — görüşme kararı + hazır mail */}
      <h4 className="hub-h4" style={{ marginTop: 16 }}>Görüşme kararı</h4>
      {decision ? (
        <DecisionMail kind={decision} c={c} role={role} openRole={openRole} flash={flash}
          onDone={onDone} onCancel={() => setDecision(null)} />
      ) : (
        <div className="hub-wz__opts">
          <button type="button" className="hub-wz__opt" disabled={!trialChk.ok}
            title={trialChk.ok ? '' : (trialChk.reason || '')} onClick={() => setDecision('invite')}>
            <span className="hub-wz__opt-l">Olumlu — denemeye davet</span>
            <span className="hub-wz__opt-r">mail hazır gelir</span>
          </button>
          <button type="button" className="hub-wz__opt" onClick={() => setDecision('reject')}>
            <span className="hub-wz__opt-l">Olumsuz — nazik ret</span>
            <span className="hub-wz__opt-r">mail hazır gelir · arşive</span>
          </button>
        </div>
      )}
    </div>
  );
}

// ── Kapı başlatma + "Görevi mail ile gönder" (C3) ────────────────
// Tek akış: görev metni + (opsiyonel) mail. Mail gönderilince süre başlar
// (due_at bu anda hesaplanır); mail atlanırsa kapı yine başlar.
function GateStartForm({ c, gate, onCancel, onStarted, flash }) {
  const store = useHubStore();
  const hours = gate === 'A' ? GATE.aHours : GATE.bDays * 24;
  const durLabel = gate === 'A' ? '72 saat' : '10 gün';
  const [taskText, setTaskText] = useState('');
  const [sendMail, setSendMail] = useState(!!c.email);
  const [subject, setSubject] = useState(`Start-Hub — Kapı ${gate} görevi`);
  const [body, setBody] = useState('');
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');

  const dueLabel = new Date(Date.now() + hours * 3600000).toLocaleString('tr-TR', { dateStyle: 'medium', timeStyle: 'short' });
  // Metni görev + son teslim ile canlı tut (kullanıcı elle değiştirmediyse).
  const autoBody = `Merhaba ${c.fullName || ''},\n\nDeneme adımına geçtik. Kapı ${gate} görevin:\n\n${taskText.trim() || '(görev metni ayrıca paylaşılacak)'}\n\nSon teslim: ${dueLabel}\n\nSorun olursa yaz.\n\nStart-Hub`;
  const effectiveBody = body.trim() ? body : autoBody;

  const start = async () => {
    setBusy(true); setErr('');
    try {
      const dueAt = new Date(Date.now() + hours * 3600000).toISOString();
      if (sendMail && c.email) {
        await store.sendCandidateMail(c, { subject: subject.trim(), body: effectiveBody.trim() });
      }
      await store.startGate(c, gate, {
        taskText: taskText.trim() || null,
        dueAt,
        startupId: c.startupId || null,
      });
      onStarted?.();
      flash?.(sendMail && c.email ? `Kapı ${gate} başladı · görev maili gönderildi.` : `Kapı ${gate} başladı.`);
      onCancel();
    } catch (e) { setErr(e.message || 'Başlatılamadı.'); }
    setBusy(false);
  };

  return (
    <div className="hub-ai" style={{ marginTop: 8 }}>
      <div style={{ fontWeight: 700, marginBottom: 6 }}>Kapı {gate} başlat ({durLabel})</div>
      <Field label="Görev metni" hint="Adaya olduğu gibi gider. Boş bırakılabilir.">
        <textarea className="adm-input adm-textarea" rows={3} value={taskText}
          onChange={(e) => setTaskText(e.target.value)}
          placeholder="Ör. Sektörden 3 kişiyle konuş, kısa notlarını getir." />
      </Field>

      {c.email ? (
        <label style={{ display: 'flex', gap: 6, alignItems: 'center', fontSize: 13, margin: '4px 0 8px' }}>
          <input type="checkbox" checked={sendMail} onChange={(e) => setSendMail(e.target.checked)} />
          Görevi {c.email} adresine mail ile gönder
        </label>
      ) : (
        <div style={{ fontSize: 12, color: 'var(--adm-text-dim)', margin: '4px 0 8px' }}>
          Adayın e-postası yok — görev elden iletilecek.
        </div>
      )}

      {sendMail && c.email && (
        <>
          <Field label="Konu"><input className="adm-input" value={subject} onChange={(e) => setSubject(e.target.value)} /></Field>
          <Field label="Mail metni" hint="Görev + son teslim tarihinden otomatik dolduruldu — üzerinde dilediğin gibi düzenleme yap.">
            <textarea className="adm-input adm-textarea" rows={7} value={effectiveBody}
              onChange={(e) => setBody(e.target.value)} />
          </Field>
        </>
      )}

      {err && <div style={{ fontSize: 12, color: 'var(--adm-red)', marginBottom: 8 }}>{err}</div>}
      <div style={{ display: 'flex', gap: 8 }}>
        <button className="adm-btn adm-btn--primary adm-btn--sm" disabled={busy} onClick={start}>
          {busy ? '…' : (sendMail && c.email ? `Mail gönder ve Kapı ${gate}'yı başlat` : `Kapı ${gate}'yı başlat`)}
        </button>
        <button className="adm-btn adm-btn--ghost adm-btn--sm" disabled={busy} onClick={onCancel}>Vazgeç</button>
      </div>
    </div>
  );
}

// ── "Ekibe al" onayı — projesiz adayda güçlü uyarı + inline rol seçimi (C4 düz. 2)
function TeamMoveConfirm({ c, store, busy, onCancel, onConfirm }) {
  const linkable = store.openRoles.filter(
    (r) => ['sourcing', 'shortlist'].includes(r.status) || r.id === c.openRoleId
  );
  const [roleId, setRoleId] = useState(c.openRoleId || '');
  const roleTitle = store.openRoles.find((r) => r.id === roleId)?.title || null;

  return (
    <div className="hub-ai" style={{ marginTop: 8 }}>
      <div style={{ fontWeight: 700, marginBottom: 6 }}>Ekibe al</div>
      {!roleId ? (
        <div className="hub-threshold hub-threshold--no" style={{ display: 'block', marginBottom: 8 }}>
          <strong>Bu aday bir projeye bağlı değil.</strong> Ekibe alırsan hesabı açılır ve davet maili gider,
          ama <b>hiçbir takımı göremez</b>. Aşağıdan bir açık rol seçersen bağlanır.
        </div>
      ) : (
        <div style={{ fontSize: 12.5, color: 'var(--adm-text-secondary)', marginBottom: 8 }}>
          Aday <b>{roleTitle || '—'}</b> rolüne bağlı olarak ekibe alınacak; hesabı açılır, davet maili gider.
        </div>
      )}
      <Field label="Açık rol">
        <select className="adm-input adm-select" value={roleId} onChange={(e) => setRoleId(e.target.value)}>
          <option value="">— (projesiz) —</option>
          {linkable.map((r) => (
            <option key={r.id} value={r.id}>{r.title}{r.track === 'member' ? ' · üye' : ' · kurucu'}</option>
          ))}
        </select>
      </Field>
      <div style={{ display: 'flex', gap: 8, marginTop: 8 }}>
        <button className="adm-btn adm-btn--primary adm-btn--sm" disabled={busy} onClick={() => onConfirm(roleId || null)}>
          {busy ? '…' : (roleId ? 'Ekibe al' : 'Yine de devam et')}
        </button>
        <button className="adm-btn adm-btn--ghost adm-btn--sm" disabled={busy} onClick={onCancel}>Vazgeç</button>
      </div>
    </div>
  );
}

// ── Üye hattı: "Ekibe al"ın yerini alan Team Lead onayı (2026-09-25) ──
function PresentToOwnerConfirm({ c, store, busy, onCancel, onConfirm }) {
  const linkable = store.openRoles.filter(
    (r) => ['sourcing', 'shortlist'].includes(r.status) || r.id === c.openRoleId
  );
  const [roleId, setRoleId] = useState(c.openRoleId || '');
  const roleTitle = store.openRoles.find((r) => r.id === roleId)?.title || null;

  return (
    <div className="hub-ai" style={{ marginTop: 8 }}>
      <div style={{ fontWeight: 700, marginBottom: 6 }}>Proje sahibine sun</div>
      {!roleId ? (
        <div className="hub-threshold hub-threshold--no" style={{ display: 'block', marginBottom: 8 }}>
          <strong>Sunmak için bir açık role bağlı olmalı.</strong> Aşağıdan bir rol seç.
        </div>
      ) : (
        <div style={{ fontSize: 12.5, color: 'var(--adm-text-secondary)', marginBottom: 8 }}>
          Aday <b>{roleTitle || '—'}</b> rolü için <b>o projenin Team Lead'ine</b> Team App üzerinden sunulacak —
          hesap ancak Team Lead kabul edince açılır.
        </div>
      )}
      <Field label="Açık rol">
        <select className="adm-input adm-select" value={roleId} onChange={(e) => setRoleId(e.target.value)}>
          <option value="">— (seç) —</option>
          {linkable.map((r) => (
            <option key={r.id} value={r.id}>{r.title}</option>
          ))}
        </select>
      </Field>
      <div style={{ display: 'flex', gap: 8, marginTop: 8 }}>
        <button className="adm-btn adm-btn--primary adm-btn--sm" disabled={busy || !roleId} onClick={() => onConfirm(roleId)}>
          {busy ? '…' : 'Proje sahibine sun'}
        </button>
        <button className="adm-btn adm-btn--ghost adm-btn--sm" disabled={busy} onClick={onCancel}>Vazgeç</button>
      </div>
    </div>
  );
}

// ── Deneme (Kapı A / B) ───────────────────────────────────────────
function TrialSection({ c }) {
  const store = useHubStore();
  const gates = store.gates.filter((g) => g.candidateId === c.id);
  const gateA = gates.filter((g) => g.gate === 'A').sort((a, b) => new Date(a.startedAt) - new Date(b.startedAt))[0];
  const gateB = gates.filter((g) => g.gate === 'B').sort((a, b) => new Date(b.startedAt) - new Date(a.startedAt))[0];
  const founder = (c.track || DEFAULT_TRACK) === 'founder';
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState('');
  const [wiz, setWiz] = useState(null);   // 'startA' | 'startB' | { extend: gateId }
  const [teamConfirm, setTeamConfirm] = useState(false);
  const [ownerConfirm, setOwnerConfirm] = useState(false);
  const flash = (m) => { setMsg(m); setTimeout(() => setMsg(''), 4000); };

  const toTeam = async (roleId) => {
    setBusy(true);
    try {
      if (roleId && roleId !== c.openRoleId) await store.linkCandidateRole(c.id, roleId);
      const r = await store.moveToTeam(c.id);
      if (r.warnings?.length) {
        flash('Kısmen aktarıldı — ' + r.warnings.join(' · '));
      } else {
        flash(r.vestingStart
          ? `Ekibe alındı · hesap açıldı, davet gönderildi · hak ediş ${r.vestingStart}.`
          : 'Ekibe alındı · hesap açıldı, davet gönderildi.');
      }
    } catch (e) { flash('Aktarılamadı: ' + e.message); }
    setTeamConfirm(false);
    setBusy(false);
  };

  const toOwner = async (roleId) => {
    setBusy(true);
    try {
      if (roleId && roleId !== c.openRoleId) await store.linkCandidateRole(c.id, roleId);
      const r = await store.presentToOwner(c.id);
      flash(r.alreadyPending ? 'Zaten sunulmuş — Team Lead kararını bekliyor.' : 'Proje sahibine (Team Lead) sunuldu — Team App üzerinden karar bekleniyor.');
    } catch (e) { flash('Sunulamadı: ' + e.message); }
    setOwnerConfirm(false);
    setBusy(false);
  };

  return (
    <div className="hub-gates">
      <h4 className="hub-h4">Deneme · Kapılar</h4>

      {!gateA && (
        <div className="hub-gate">
          <strong>Kapı A</strong>
          <div style={{ fontSize: 11.5, color: 'var(--adm-text-dim)', margin: '2px 0 8px' }}>72 saatlik tek çıktılı görev.</div>
          {wiz === 'startA'
            ? <GateStartForm c={c} gate="A" flash={flash} onStarted={() => {}} onCancel={() => setWiz(null)} />
            : <button className="hub-wz__next" style={{ margin: 0 }} onClick={() => setWiz('startA')}>Kapı A başlat</button>}
        </div>
      )}
      {gateA && <GateCard gate={gateA} onMark={(p) => store.markGate(gateA.id, p)} onExtend={() => setWiz({ extend: gateA.id })} />}

      {founder && gateA?.result === 'passed' && !gateB && (
        <div className="hub-gate">
          <strong>Kapı B</strong>
          <div style={{ fontSize: 11.5, color: 'var(--adm-text-dim)', margin: '2px 0 8px' }}>10 günlük ilk sprint.</div>
          {wiz === 'startB'
            ? <GateStartForm c={c} gate="B" flash={flash} onStarted={() => {}} onCancel={() => setWiz(null)} />
            : <button className="hub-wz__next" style={{ margin: 0 }} onClick={() => setWiz('startB')}>Kapı B başlat</button>}
        </div>
      )}
      {gateB && <GateCard gate={gateB} onMark={(p) => store.markGate(gateB.id, p)} onExtend={() => setWiz({ extend: gateB.id })} />}

      {founder && gateB?.result === 'passed' && (
        teamConfirm
          ? <TeamMoveConfirm c={c} store={store} busy={busy} onCancel={() => setTeamConfirm(false)} onConfirm={toTeam} />
          : <button className="hub-wz__next" style={{ margin: '4px 0 0' }} disabled={busy} onClick={() => setTeamConfirm(true)}>
              Ekibe al
            </button>
      )}

      {/* Üye hattı: Kapı A geçince artık doğrudan "Ekibe al" yok — önce o
          projenin Team Lead'ine (Team App) sunulur, hesap ancak orada kabul
          edilince açılır (2026-09-25). */}
      {!founder && gateA?.result === 'passed' && (
        c.presentedAt ? (
          <div style={{ fontSize: 13, marginTop: 8 }}>
            <strong>Sunuldu:</strong> {String(c.presentedAt).slice(0, 10)} ·{' '}
            {c.ownerDecision && c.ownerDecision !== 'pending' ? (
              <span className="hub-pill" style={c.ownerDecision === 'accepted' ? { background: 'var(--adm-green-light)', color: 'var(--adm-green)' } : { background: 'var(--adm-red-light)', color: 'var(--adm-red)' }}>
                {OWNER_DECISION_LABEL[c.ownerDecision]}
              </span>
            ) : <span className="hub-pill">Team Lead kararı bekleniyor</span>}
          </div>
        ) : (
          ownerConfirm
            ? <PresentToOwnerConfirm c={c} store={store} busy={busy} onCancel={() => setOwnerConfirm(false)} onConfirm={toOwner} />
            : <button className="hub-wz__next" style={{ margin: '4px 0 0' }} disabled={busy} onClick={() => setOwnerConfirm(true)}>
                Proje sahibine sun
              </button>
        )
      )}
      {msg && <div style={{ fontSize: 12.5, color: 'var(--adm-text-secondary)', marginTop: 8 }}>{msg}</div>}

      {wiz && wiz.extend && (
        <HubWizard title="Süre uzat" onCancel={() => setWiz(null)} submitLabel="Uzat"
          steps={[{ key: 'days', type: 'options', q: 'Ne kadar uzatılsın?', sub: 'Sistem otomatik not düşer.',
            options: GATE_EXTENSIONS.map((e) => ({ value: e.value, label: e.label })) }]}
          onComplete={(a) => store.extendGate(wiz.extend, Number(a.days))} />
      )}
    </div>
  );
}

const STATUS_LABEL = { running: 'Sürüyor', due: 'Süre doldu', overdue: 'Gecikti' };
function remaining(gate) {
  const due = gateDueAt(gate);
  if (!due) return '';
  const ms = due - Date.now();
  if (ms <= 0) return 'süre doldu';
  const h = Math.round(ms / 3600000);
  return h < 48 ? `${h} saat kaldı` : `${Math.round(h / 24)} gün kaldı`;
}

function GateCard({ gate, onMark, onExtend }) {
  const st = gateStatus(gate);
  return (
    <div className="hub-gate">
      <div className="hub-gate__head">
        <strong>Kapı {gate.gate}</strong>
        <span className={`hub-pill hub-gate__status hub-gate__status--${st}`}>
          {STATUS_LABEL[st]}{gate.result === 'pending' && st === 'running' ? ` · ${remaining(gate)}` : ''}
        </span>
      </div>
      {gate.taskText && <div className="hub-gate__task">{gate.taskText}</div>}
      <div style={{ fontSize: 11.5, color: 'var(--adm-text-dim)', margin: '4px 0' }}>
        Başlangıç: {String(gate.startedAt).slice(0, 10)}
        {gate.extendedDays > 0 ? ` · +${gate.extendedDays} gün uzatıldı` : ''}
      </div>
      {gate.result === 'pending' ? (
        // 2026-09-24 CRM-lite Round 2 — eskiden 3 eşit ağırlıklı buton (Teslim
        // etti / Teslim etmedi / Süre yetmedi mi?) aynı satırda yan yanaydı; HUB_SPEC
        // §0'ın "ekran başına bir birincil aksiyon" ilkesine göre "Süre yetmedi mi?"
        // (uzatma) gerçek bir SONUÇ değil, nadir kullanılan bir istisna — küçük bir
        // metin bağlantısına indirildi, iki gerçek sonuç (teslim etti/etmedi) öne çıktı.
        <div>
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            <button className="hub-wz__next" style={{ margin: 0, padding: '9px 16px' }} onClick={() => onMark({ delivered: true, result: 'passed' })}>Teslim etti</button>
            <button className="hub-wz__back" onClick={() => onMark({ delivered: false, result: 'failed' })}>Teslim etmedi</button>
          </div>
          <button type="button" onClick={() => onExtend()}
            style={{ background: 'none', border: 'none', padding: '8px 0 0', cursor: 'pointer', fontSize: 12, color: 'var(--adm-text-dim)', textDecoration: 'underline' }}>
            Süre yetmedi mi? Uzat →
          </button>
        </div>
      ) : (
        <div className="hub-pill" style={gate.result === 'passed'
          ? { background: 'var(--adm-green-light)', color: 'var(--adm-green)' }
          : { background: 'var(--adm-red-light)', color: 'var(--adm-red)' }}>
          {gate.result === 'passed' ? 'Geçti' : 'Kaldı'}
        </div>
      )}
    </div>
  );
}

// ── Ekipte ────────────────────────────────────────────────────────
function MemberSection({ c }) {
  return (
    <div className="hub-gate" style={{ background: 'var(--adm-green-light)', borderColor: 'transparent' }}>
      <div style={{ fontSize: 13 }}>
        <strong>Hak ediş başlangıcı:</strong> {c.vestingStartDate || '—'}
        <span style={{ color: 'var(--adm-text-dim)' }}> · Kapı A'nın ilk günü (geriye dönük)</span>
      </div>
      {c.joinedAt && (
        <div style={{ fontSize: 12, color: 'var(--adm-text-secondary)', marginTop: 2 }}>
          Katılım tarihi: {String(c.joinedAt).slice(0, 10)}
        </div>
      )}
    </div>
  );
}

function EvidenceList({ evidence, onChange }) {
  const [url, setUrl] = useState('');
  const [note, setNote] = useState('');
  const add = () => {
    if (!url.trim()) return;
    onChange([...evidence, { type: 'link', url: url.trim(), note: note.trim() }]);
    setUrl(''); setNote('');
  };
  return (
    <div>
      {evidence.length === 0 && <div style={{ fontSize: 13, color: 'var(--adm-text-dim)', marginBottom: 8 }}>Kanıt linki yok.</div>}
      {evidence.map((e, i) => (
        <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6, fontSize: 13 }}>
          <a href={e.url} target="_blank" rel="noreferrer" style={{ color: 'var(--adm-blue)', flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{e.url}</a>
          {e.note && <span style={{ color: 'var(--adm-text-dim)' }}>{e.note}</span>}
          <button className="adm-icon-btn adm-icon-btn--danger" onClick={() => onChange(evidence.filter((_, x) => x !== i))}><AIcon name="trash" size={13} /></button>
        </div>
      ))}
      <div style={{ display: 'flex', gap: 6, marginTop: 6 }}>
        <input className="adm-input adm-input--sm" placeholder="https://…" value={url} onChange={(e) => setUrl(e.target.value)} />
        <input className="adm-input adm-input--sm" style={{ width: 120 }} placeholder="not" value={note} onChange={(e) => setNote(e.target.value)} />
        <button className="adm-btn adm-btn--ghost adm-btn--sm" onClick={add}>Ekle</button>
      </div>
    </div>
  );
}

function HistoryList({ history }) {
  const items = useMemo(() => {
    if (!history) return null;
    const out = [
      ...history.touches.map((t) => ({ when: t.sentAt, what: `Temas · ${TOUCH_CHANNEL_LABEL[t.channel] || t.channel} · ${TOUCH_OUTCOME_LABEL[t.outcome] || t.outcome}${t.note ? ` — ${t.note}` : ''}` })),
      ...history.gates.map((g) => ({ when: g.startedAt, what: `Kapı ${g.gate} · ${GATE_RESULT_LABEL[g.result] || g.result}` })),
      ...history.stageLog.map((l) => ({ when: l.createdAt, what: `Aşama: ${STAGE_LABEL[l.fromStage] || '—'} → ${STAGE_LABEL[l.toStage] || l.toStage}${l.reason ? ` (${l.reason})` : ''}` })),
    ];
    return out.filter((x) => x.when).sort((a, b) => new Date(b.when) - new Date(a.when));
  }, [history]);

  if (!items) return <div style={{ color: 'var(--adm-text-dim)', fontSize: 13, marginTop: 8 }}>Yükleniyor…</div>;
  if (items.length === 0) return <div className="adm-empty" style={{ marginTop: 8 }}>Geçmiş kaydı yok.</div>;
  return (
    <ul className="hub-timeline" style={{ marginTop: 8 }}>
      {items.map((it, i) => (
        <li key={i}>
          <div className="hub-timeline__when">{new Date(it.when).toLocaleString('tr-TR')}</div>
          <div className="hub-timeline__what">{it.what}</div>
        </li>
      ))}
    </ul>
  );
}

