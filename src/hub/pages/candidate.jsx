// candidate.jsx — sağdan açılan aday kartı (v2 §3). SEKME YOK.
// Kart, adayın bulunduğu aşamanın alanlarını gösterir; "Detay" ve "Geçmiş"
// akordeonları kapalı. Alanlar optimistic kaydedilir.
import React, { useState, useEffect, useMemo } from 'react';
import { AIcon, Field } from '../../admin/admin-ui';
import { useHubStore } from '../hub-store';
import { useHubMember } from '../hub-member';
import { usePerms } from '../../lib/use-perms';
import {
  RUBRIC_AXES, RED_FLAGS, AI_PRESCORE_FINISHING, ROLE_TYPES, ARCHIVE_REASONS,
  STAGE_LABEL, SOURCE_LABEL, TOUCH_CHANNELS, TOUCH_CHANNEL_LABEL, TOUCH_OUTCOME_LABEL,
  GATE_RESULT_LABEL, THRESHOLD, TRACKS, TRACK_LABEL, OWNER_DECISION_LABEL,
  GATE, GATE_EXTENSIONS,
} from '../hub-constants';
import { thresholdMet, thresholdText, canAdvance, presentGate, gateStatus, gateDueAt, canDraftAI } from '../hub-rules';
import { supabase } from '../../lib/supabase';
import { fillTemplate } from './templates';
import { generateDraft } from '../hub-ai-draft';
import HubWizard from '../components/wizard';

const AXIS_FIELD = { finishing: 'scoreFinishing', communication: 'scoreCommunication', capacity: 'scoreCapacity' };
const PRESCORE_LABEL = Object.fromEntries(AI_PRESCORE_FINISHING.map((x) => [x.value, x.when]));

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
function NextStepCard({ c, store, openRole, role, onComposer, afterAdvance, flash }) {
  const stage = c.stage;

  if (stage === 'pool') {
    return (
      <StageActionCard question="Bu kişiye ulaşalım mı?" options={[
        { label: 'Mesaj taslağı hazırla', hint: 'kopyalayınca Temas\'a geçer', run: async () => { onComposer(); } },
      ]} />
    );
  }

  if (stage === 'contact') {
    return (
      <StageActionCard question="Aday şu an ne durumda?" options={[
        { label: 'Cevap geldi', hint: 'olumlu dönüş', run: async () => { await store.markReplied(c.id); afterAdvance(); flash?.('Cevap işaretlendi.'); } },
        { label: 'Görüştüm — Görüşme\'ye al', run: async () => {
          const chk = canAdvance(c, 'interview', { touchCount: 1 });
          if (!chk.ok) throw new Error(chk.reason);
          await store.advanceStage(c.id, 'interview', { reason: 'görüşüldü' });
          afterAdvance(); flash?.('Aşama: Görüşme.');
        } },
      ]} />
    );
  }

  if (stage === 'interview') {
    return (
      <StageActionCard question="Görüşme sonrası ne olacak?" options={[
        { label: 'Deneme\'ye geçir (Kapı A)', hint: 'eşik + rubrik kontrol edilir', run: async () => {
          const chk = canAdvance(c, 'trial', { role, openRole });
          if (!chk.ok) throw new Error(chk.reason);
          await store.advanceStage(c.id, 'trial', { reason: 'görüşme geçti' });
          afterAdvance(); flash?.('Aşama: Deneme.');
        } },
      ]} />
    );
  }

  return null;   // trial → TrialSection/GateCard, member → bitti. Arşivleme üstteki butonla.
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
  const [composing, setComposing] = useState(false);
  const [archiving, setArchiving] = useState(false);
  const [toast, setToast] = useState(null);
  const flash = (m) => { setToast(m); setTimeout(() => setToast(null), 3500); };

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
            <div className="hub-panel__title" style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
              {c.fullName}
              <span className={`hub-pill hub-pill--track-${(c.track || 'founder') === 'member' ? 'member' : 'founder'}`}>
                {TRACK_LABEL[c.track || 'founder']} hattı
              </span>
            </div>
            <div style={{ fontSize: 12, color: '#A29D94', marginTop: 4, display: 'flex', gap: 6, alignItems: 'center' }}>
              <span className="hub-pill hub-pill--stage">{STAGE_LABEL[stage]}</span>
              <span className="hub-pill hub-pill--source">{SOURCE_LABEL[c.source] || c.source}</span>
            </div>
          </div>
          <button className="adm-icon-btn" onClick={onClose}><AIcon name="x" size={18} /></button>
        </div>

        <div style={{ display: 'flex', gap: 8, padding: '10px 16px', borderBottom: '1px solid var(--adm-border)', background: 'var(--adm-bg-card)', flexWrap: 'wrap' }}>
          <button className="adm-btn adm-btn--primary adm-btn--sm" onClick={() => setComposing(true)}>
            <AIcon name="edit" size={13} /> Mesaj taslağı
          </button>
          {stage === 'contact' && (
            <button className="adm-btn adm-btn--ghost adm-btn--sm"
              onClick={() => store.markReplied(candidateId).then(() => { setHistory(null); flash('Cevap işaretlendi.'); })}>
              <AIcon name="check" size={13} /> Cevap geldi
            </button>
          )}
          {stage !== 'member' && stage !== 'archived' && (
            <button className="adm-btn adm-btn--ghost adm-btn--sm" style={{ marginLeft: 'auto' }} onClick={() => setArchiving(true)}>
              <AIcon name="trash" size={13} /> Arşivle
            </button>
          )}
          {stage === 'archived' && (
            <button className="adm-btn adm-btn--ghost adm-btn--sm" style={{ marginLeft: 'auto' }}
              onClick={() => store.advanceStage(candidateId, 'pool', { reason: 'arşivden geri alındı' }).then(() => { setHistory(null); flash('Havuz\'a geri alındı.'); })}>
              <AIcon name="refresh" size={13} /> Havuz'a geri al
            </button>
          )}
        </div>

        <div className="hub-panel__body">
          <StageStripe stage={stage} />

          <TrackRoleSection c={c} openRole={openRole} role={role} store={store} flash={flash} />

          {/* §1 + §Ek — gerçek aksiyon tetikleyen aşama kartı */}
          <NextStepCard c={c} store={store} openRole={openRole} role={role}
            onComposer={() => setComposing(true)} afterAdvance={() => setHistory(null)} flash={flash} />

          {stage === 'pool' && <PoolSection c={c} save={save} flash={flash} />}
          {stage === 'contact' && <ContactSection c={c} save={save} history={history} />}
          {stage === 'interview' && <InterviewSection c={c} save={save} role={role} openRole={openRole} />}
          {stage === 'trial' && <TrialSection c={c} />}
          {stage === 'member' && <MemberSection c={c} />}

          {/* Planlanan görüşme / takip — bilgi amaçlı */}
          {stage !== 'pool' && stage !== 'member' && (
            <div className="adm-form-grid" style={{ marginTop: 12 }}>
              <LField label="Planlanan tarih" type="date" value={c.nextActionAt ? String(c.nextActionAt).slice(0, 10) : ''}
                onCommit={(v) => save({ nextActionAt: v || null })} />
              <LField label="Bağlantı (takvim)" value={c.nextActionLink} onCommit={(v) => save({ nextActionLink: v })} />
            </div>
          )}

          {/* Detay akordeonu */}
          <button className="adm-btn adm-btn--ghost adm-btn--sm" style={{ marginTop: 16 }} onClick={() => setShowDetail((v) => !v)}>
            <AIcon name={showDetail ? 'chevronDown' : 'chevronRight'} size={13} /> Detay
          </button>
          {showDetail && (
            <div style={{ marginTop: 8 }}>
              <div className="adm-form-grid">
                <LField label="Ad Soyad" value={c.fullName} onCommit={(v) => save({ fullName: v })} />
                <LField label="Link" value={c.github || c.linkedin || c.email || ''}
                  onCommit={(v) => save(detectLink(v))} hint="GitHub / LinkedIn / e-posta" />
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

      {composing && (
        <MessageComposer candidate={c}
          onDone={(msg) => { setComposing(false); setHistory(null); flash(msg); }}
          onCancel={() => setComposing(false)} />
      )}
      {archiving && (
        <HubWizard title="Arşivle" submitLabel="Arşivle" onCancel={() => setArchiving(false)}
          steps={[{ key: 'reason', type: 'options', q: 'Neden arşivleniyor?',
            options: ARCHIVE_REASONS.map((r) => ({ value: r.value, label: r.label })) }]}
          onComplete={async (a) => {
            await store.advanceStage(candidateId, 'archived', { reason: 'arşivlendi', extra: { archiveReason: a.reason } });
            setHistory(null); flash('Arşivlendi.');
          }} />
      )}
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

  return (
    <div className="hub-gates" style={{ marginBottom: 16 }}>
      <h4 className="hub-h4">Hat & Rol</h4>
      <div className="adm-form-grid">
        <Field label="Hat" hint="Rol bağlanınca rolden gelir; elle değiştirebilirsin.">
          <select className="adm-input adm-select" value={c.track || 'founder'} onChange={(e) => store.updateCandidate(c.id, { ...c, track: e.target.value })}>
            {TRACKS.map((t) => <option key={t.value} value={t.value}>{t.label}</option>)}
          </select>
        </Field>
        <Field label="Bağlı açık rol">
          <select className="adm-input adm-select" value={c.openRoleId || ''} onChange={(e) => store.linkCandidateRole(c.id, e.target.value || null)}>
            <option value="">—</option>
            {linkable.map((r) => <option key={r.id} value={r.id}>{r.title}{r.track === 'member' ? ' · üye' : ' · kurucu'}</option>)}
            {c.openRoleId && !linkable.some((r) => r.id === c.openRoleId) && openRole && (
              <option value={openRole.id}>{openRole.title} (mevcut)</option>
            )}
          </select>
        </Field>
      </div>

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
    </div>
  );
}

// ── Havuz ─────────────────────────────────────────────────────────
function PoolSection({ c, save, flash }) {
  const [busy, setBusy] = useState(false);
  const runDraft = async () => {
    // §4 — API'ye gitmeden önce koruma. Geçmiyorsa hiçbir istek çıkmaz.
    if (!canDraftAI(c)) { flash('Veri yetersiz, elle yaz. Kaynak detayı / "neden bu kişi" / kanıt linki gerekli.'); return; }
    setBusy(true);
    try { const { text } = await generateDraft(c); await save({ draftText: text }); flash('Taslak oluşturuldu.'); }
    catch (e) { flash(e.message); }
    setBusy(false);
  };
  return (
    <div>
      <div className="adm-form-grid">
        <LField label="Ad Soyad" value={c.fullName} onCommit={(v) => save({ fullName: v })} />
        <LField label="Link" value={c.github || c.linkedin || c.email || ''} onCommit={(v) => save(detectLink(v))} hint="GitHub / LinkedIn / e-posta" />
      </div>
      <LField label="Neden bu kişi?" textarea value={c.whyThisOne} onCommit={(v) => save({ whyThisOne: v })}
        hint="Somut esere atıf (repo / proje / yarışma / yazı). Sıfat değil, ne yaptığı." />
      <div className="hub-ai" style={{ marginTop: 10 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
          <b>Mesaj taslağı (AI)</b>
          <button className="adm-btn adm-btn--ghost adm-btn--sm" style={{ marginLeft: 'auto' }}
            disabled={busy || !canDraftAI(c)}
            title={canDraftAI(c) ? '' : 'Veri yetersiz — elle yaz'}
            onClick={runDraft}>
            {busy ? 'Üretiliyor…' : (canDraftAI(c) ? 'Taslak oluştur' : 'Veri yetersiz')}
          </button>
        </div>
        {c.draftText && <div style={{ marginTop: 6, fontSize: 13, color: 'var(--adm-text)' }}>{c.draftText}</div>}
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

// ── Görüşme (rubrik + bayraklar) ──────────────────────────────────
function InterviewSection({ c, save, role, openRole }) {
  const track = c.track || 'founder';
  const trialChk = canAdvance({ ...c, stage: 'interview' }, 'trial', { role, openRole });
  const flagCount = (c.redFlags || []).length;

  const setScore = (axisKey, n) => { const f = AXIS_FIELD[axisKey]; save({ [f]: c[f] === n ? null : n }); };
  const toggleFlag = (key) => {
    const cur = c.redFlags || [];
    save({ redFlags: cur.includes(key) ? cur.filter((k) => k !== key) : [...cur, key] });
  };

  return (
    <div>
      <h4 className="hub-h4">Rubrik</h4>
      <p style={{ fontSize: 12, color: 'var(--adm-text-dim)', marginBottom: 12 }}>
        {track === 'member' ? 'Üye' : 'Kurucu'} hattı eşiği: {thresholdText(track, openRole)}.
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

      <h4 className="hub-h4">
        Kırmızı bayraklar {flagCount > 0 && <span className="hub-pill hub-pill--flag">{flagCount}</span>}
      </h4>
      {RED_FLAGS.map((f) => {
        const on = (c.redFlags || []).includes(f.value);
        return (
          <div key={f.value} className="hub-flag">
            <label className="hub-flag__top">
              <input type="checkbox" checked={on} onChange={() => toggleFlag(f.value)} />
              {f.label}
            </label>
            <div className="hub-flag__hint">{f.hint}</div>
            {on && (
              <textarea className="adm-input adm-textarea" rows={2} placeholder="Not…"
                defaultValue={(c.flagNotes || {})[f.value] || ''}
                onBlur={(e) => save({ flagNotes: { ...(c.flagNotes || {}), [f.value]: e.target.value } })} />
            )}
          </div>
        );
      })}

      {flagCount >= THRESHOLD.blockAtRedFlags && (
        <LField label="Override gerekçesi (yalnızca kurucu)" textarea
          hint="2+ bayrakla Deneme'ye geçiş için zorunlu."
          value={c.overrideReason} onCommit={(v) => save({ overrideReason: v })} />
      )}
    </div>
  );
}

// ── Deneme (Kapı A / B) ───────────────────────────────────────────
function TrialSection({ c }) {
  const store = useHubStore();
  const gates = store.gates.filter((g) => g.candidateId === c.id);
  const gateA = gates.filter((g) => g.gate === 'A').sort((a, b) => new Date(a.startedAt) - new Date(b.startedAt))[0];
  const gateB = gates.filter((g) => g.gate === 'B').sort((a, b) => new Date(b.startedAt) - new Date(a.startedAt))[0];
  const founder = (c.track || 'founder') === 'founder';
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState('');
  const [wiz, setWiz] = useState(null);   // 'startA' | 'startB' | { extend: gateId }
  const flash = (m) => { setMsg(m); setTimeout(() => setMsg(''), 4000); };

  const startA = async (a) => {
    await store.startGate(c, 'A', {
      taskText: String(a.taskText || '').trim() || null,
      dueAt: new Date(Date.now() + GATE.aHours * 3600000).toISOString(),
    });
  };
  const startB = async () => {
    await store.startGate(c, 'B', {
      dueAt: new Date(Date.now() + GATE.bDays * 86400000).toISOString(),
      startupId: c.startupId || null,
    });
  };
  const toTeam = async () => {
    setBusy(true);
    try { const v = await store.moveToTeam(c.id); flash(v ? `Ekibe aktarıldı · hak ediş başlangıcı ${v}.` : 'Ekibe aktarıldı.'); }
    catch (e) { flash('Aktarılamadı: ' + e.message); }
    setBusy(false);
  };

  return (
    <div className="hub-gates">
      <h4 className="hub-h4">Deneme · Kapılar</h4>

      {!gateA && (
        <div className="hub-gate">
          <strong>Kapı A</strong>
          <div style={{ fontSize: 11.5, color: 'var(--adm-text-dim)', margin: '2px 0 8px' }}>72 saatlik tek çıktılı görev.</div>
          <button className="hub-wz__next" style={{ margin: 0 }} onClick={() => setWiz('startA')}>Kapı A başlat</button>
        </div>
      )}
      {gateA && <GateCard gate={gateA} onMark={(p) => store.markGate(gateA.id, p)} onExtend={() => setWiz({ extend: gateA.id })} />}

      {founder && gateA?.result === 'passed' && !gateB && (
        <div className="hub-gate">
          <strong>Kapı B</strong>
          <div style={{ fontSize: 11.5, color: 'var(--adm-text-dim)', margin: '2px 0 8px' }}>10 günlük ilk sprint.</div>
          <button className="hub-wz__next" style={{ margin: 0 }} onClick={() => setWiz('startB')}>Kapı B başlat</button>
        </div>
      )}
      {gateB && <GateCard gate={gateB} onMark={(p) => store.markGate(gateB.id, p)} onExtend={() => setWiz({ extend: gateB.id })} />}

      {((founder && gateB?.result === 'passed') || (!founder && gateA?.result === 'passed')) && (
        <button className="hub-wz__next" style={{ margin: '4px 0 0' }} disabled={busy} onClick={toTeam}>
          Ekibe aktar
        </button>
      )}
      {msg && <div style={{ fontSize: 12.5, color: 'var(--adm-text-secondary)', marginTop: 8 }}>{msg}</div>}

      {wiz === 'startA' && (
        <HubWizard title="Kapı A" onCancel={() => setWiz(null)} submitLabel="Başlat (72 saat)"
          steps={[{ key: 'taskText', type: 'textarea', q: 'Kapı A görevi nedir?', ph: 'Ör. Sektörden 3 kişiyle konuş, kısa notlarını getir.', optional: true, sub: 'Metin adaya olduğu gibi gider.' }]}
          onComplete={startA} />
      )}
      {wiz === 'startB' && (
        <HubWizard title="Kapı B" onCancel={() => setWiz(null)} submitLabel="Başlat (10 gün)"
          steps={[{ key: 'ok', type: 'options', q: '10 günlük ilk sprint başlasın mı?', options: [{ value: 'yes', label: 'Evet, Kapı B\'yi başlat' }] }]}
          onComplete={startB} />
      )}
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
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          <button className="hub-wz__next" style={{ margin: 0, padding: '9px 16px' }} onClick={() => onMark({ delivered: true, result: 'passed' })}>Teslim etti</button>
          <button className="hub-wz__back" onClick={() => onMark({ delivered: false, result: 'failed' })}>Teslim etmedi</button>
          <button className="hub-wz__back" onClick={() => onExtend()}>Süre yetmedi mi?</button>
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

// ── Mesaj taslağı ─────────────────────────────────────────────────
// Sistem mesajı GÖNDERMEZ. "Kopyala" tek işlemde: panoya + hub_touches +
// adayı Temas'a taşı + 7 gün takip + şablon sayacı. Kişiselleştirme satırı
// zorunlu (boşken kopyalama devre dışı). draftText doluysa ön-doldurulur.
function MessageComposer({ candidate, onDone, onCancel }) {
  const { templates, sendTouch } = useHubStore();
  const active = useMemo(() => templates.filter((t) => t.active), [templates]);
  const [tplId, setTplId] = useState(() => {
    const match = active.find((t) => t.sourceType === candidate.source);
    return (match || active[0])?.id || '';
  });
  const tpl = active.find((t) => t.id === tplId);
  const [personalization, setPersonalization] = useState(candidate.draftText || candidate.whyThisOne || '');
  const [body, setBody] = useState('');
  const [channel, setChannel] = useState('linkedin');
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');

  useEffect(() => { setBody(tpl ? fillTemplate(tpl.body, candidate) : ''); }, [tplId]); // eslint-disable-line

  const canCopy = personalization.trim().length > 0 && !busy && active.length > 0;
  // §5 — {{kisisellestirme}} / {{kişiselleştirme}} placeholder'ını gerçek metinle
  // değiştir. Şablonda yoksa personalization'ı başa ekle (eski davranış).
  const PH_RE = /\{\{\s*ki[şs]iselle[şs]tirme\s*\}\}/gi;
  const hasPH = PH_RE.test(body);
  const fullText = (hasPH
    ? body.replace(/\{\{\s*ki[şs]iselle[şs]tirme\s*\}\}/gi, personalization.trim())
    : `${personalization.trim()}\n\n${body}`
  ).trim();

  const copy = async () => {
    if (!canCopy) return;
    setBusy(true); setErr('');
    try { await navigator.clipboard.writeText(fullText); } catch { /* pano izni yoksa yine kaydet */ }
    try {
      const res = await sendTouch(candidate, { templateId: tpl?.id || null, channel, personalization: personalization.trim() });
      onDone(res?.advanced
        ? 'Panoya kopyalandı · temas kaydedildi · aday "Temas"a geçti.'
        : 'Panoya kopyalandı · temas kaydedildi.');
    } catch (e) { setBusy(false); setErr('Temas kaydedilemedi: ' + e.message); }
  };

  return (
    <div className="adm-modal-overlay" onClick={(e) => { e.stopPropagation(); onCancel(); }}>
      <div className="adm-modal adm-modal--wide" onClick={(e) => e.stopPropagation()}>
        <div className="adm-modal__header">
          <h3>Mesaj taslağı</h3>
          <button className="adm-icon-btn" onClick={onCancel}><AIcon name="x" size={18} /></button>
        </div>
        <div className="adm-modal__body">
          {active.length === 0 && <div className="hub-ai" style={{ marginBottom: 12 }}>Aktif şablon yok — Şablonlar ekranından ekle.</div>}
          <div className="adm-form-grid">
            <Field label="Şablon">
              <select className="adm-input adm-select" value={tplId} onChange={(e) => setTplId(e.target.value)}>
                {active.map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}
              </select>
            </Field>
            <Field label="Kanal" required>
              <select className="adm-input adm-select" value={channel} onChange={(e) => setChannel(e.target.value)}>
                {TOUCH_CHANNELS.map((c) => <option key={c.value} value={c.value}>{c.label}</option>)}
              </select>
            </Field>
          </div>
          <Field label="Kişiselleştirme satırı" required hint="Somut esere atıf. BOŞKEN 'Kopyala' devre dışıdır.">
            <textarea className="adm-input adm-textarea" rows={2} value={personalization}
              onChange={(e) => setPersonalization(e.target.value)}
              placeholder="Teknofest'te … projesiyle finale kaldı; GitHub'da canlı demo linki var." />
          </Field>
          <Field label="Gövde" hint="Şablondan dolduruldu — düzenleyebilirsin.">
            <textarea className="adm-input adm-textarea" rows={7} value={body} onChange={(e) => setBody(e.target.value)} />
          </Field>
          {err && <div style={{ color: 'var(--adm-red)', fontSize: 13, marginBottom: 8 }}>{err}</div>}
          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
            <button className="adm-btn adm-btn--ghost" onClick={onCancel}>İptal</button>
            <button className="adm-btn adm-btn--primary" disabled={!canCopy} onClick={copy}>
              <AIcon name="save" size={14} /> Kopyala
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
