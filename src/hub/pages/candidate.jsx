// candidate.jsx — sağdan açılan aday kartı (§8.4). Üç sekme:
// Özet · Değerlendirme · Geçmiş. Alanlar optimistic kaydedilir
// (patchCandidate → updateCandidate, hata olursa geri alınır).
import React, { useState, useEffect, useMemo } from 'react';
import { AIcon, Field } from '../../admin/admin-ui';
import { useHubStore } from '../hub-store';
import { useHubMember } from '../hub-member';
import {
  RUBRIC_AXES, RED_FLAGS, SCORE_MIN, SCORE_MAX, AI_PRESCORE_FINISHING,
  EDU_STATUSES, CLASS_YEARS, ROLE_TYPES, DATA_TRUST_LABEL,
  STAGE_LABEL, SOURCE_LABEL, TOUCH_CHANNEL_LABEL, TOUCH_OUTCOME_LABEL,
  INTERVIEW_DECISION_LABEL, GATE_RESULT_LABEL, THRESHOLD,
} from '../hub-constants';
import { thresholdMet, canAdvance } from '../hub-rules';

// Metin/textarea/select alanı — metin ve textarea blur'da, select anında işler.
function LField({ label, value, onCommit, textarea, type = 'text', required, hint, options }) {
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
    control = (
      <textarea className="adm-input adm-textarea" value={v ?? ''} rows={3}
        onChange={(e) => setV(e.target.value)} onBlur={commit} />
    );
  } else {
    control = (
      <input className="adm-input" type={type} value={v ?? ''}
        onChange={(e) => setV(e.target.value)} onBlur={commit}
        onKeyDown={(e) => { if (e.key === 'Enter') e.currentTarget.blur(); }} />
    );
  }
  return <Field label={label} required={required} hint={hint}>{control}</Field>;
}

export default function CandidatePanel({ candidateId, onClose }) {
  const store = useHubStore();
  const role = useHubMember();
  const candidate = store.candidates.find((c) => c.id === candidateId);
  const [tab, setTab] = useState('summary');
  const [history, setHistory] = useState(null);

  useEffect(() => {
    if (tab === 'history' && !history && candidate) {
      store.loadHistory(candidateId)
        .then(setHistory)
        .catch(() => setHistory({ touches: [], interviews: [], gates: [], stageLog: [] }));
    }
  }, [tab, history, candidate, candidateId, store]);

  const save = async (patch) => {
    if (!candidate) return;
    const prev = {};
    Object.keys(patch).forEach((k) => { prev[k] = candidate[k]; });
    store.patchCandidate(candidateId, patch);
    try {
      await store.updateCandidate(candidateId, { ...candidate, ...patch });
    } catch {
      store.patchCandidate(candidateId, prev);
    }
  };

  if (!candidate) return null;

  return (
    <div className="hub-panel-overlay" onClick={onClose}>
      <div className="hub-panel" onClick={(e) => e.stopPropagation()}>
        <div className="hub-panel__head">
          <div>
            <div className="hub-panel__title">{candidate.fullName}</div>
            <div style={{ fontSize: 12, color: 'var(--adm-text-dim)', marginTop: 2 }}>
              {STAGE_LABEL[candidate.stage]} · {SOURCE_LABEL[candidate.source]}
            </div>
          </div>
          <button className="adm-icon-btn" onClick={onClose}><AIcon name="x" size={18} /></button>
        </div>

        <div className="hub-panel__tabs">
          {[['summary', 'Özet'], ['assess', 'Değerlendirme'], ['history', 'Geçmiş']].map(([k, l]) => (
            <button key={k} className={`hub-panel__tab ${tab === k ? 'hub-panel__tab--active' : ''}`} onClick={() => setTab(k)}>{l}</button>
          ))}
        </div>

        <div className="hub-panel__body">
          {tab === 'summary' && <SummaryTab c={candidate} save={save} />}
          {tab === 'assess' && <AssessTab c={candidate} save={save} role={role} />}
          {tab === 'history' && <HistoryTab history={history} />}
        </div>
      </div>
    </div>
  );
}

// ── Özet ────────────────────────────────────────────────────────────
function SummaryTab({ c, save }) {
  const nextActionRequired = c.stage !== 'pool';
  return (
    <div>
      <h4 className="hub-h4">Kimlik</h4>
      <div className="adm-form-grid">
        <LField label="Ad Soyad" value={c.fullName} onCommit={(v) => save({ fullName: v })} required />
        <LField label="Şehir" value={c.city} onCommit={(v) => save({ city: v })} />
        <LField label="E-posta" value={c.email} onCommit={(v) => save({ email: v })} />
        <LField label="Telefon" value={c.phone} onCommit={(v) => save({ phone: v })} />
        <LField label="LinkedIn" value={c.linkedin} onCommit={(v) => save({ linkedin: v })} />
        <LField label="GitHub" value={c.github} onCommit={(v) => save({ github: v })} />
      </div>

      <h4 className="hub-h4">
        Eğitim <span className={`hub-trust hub-trust--${c.dataTrust}`}>{DATA_TRUST_LABEL[c.dataTrust]}</span>
      </h4>
      <div className="adm-form-grid">
        <LField label="Üniversite" value={c.university} onCommit={(v) => save({ university: v })} />
        <LField label="Bölüm" value={c.department} onCommit={(v) => save({ department: v })} />
        <LField label="Sınıf" value={c.classYear} onCommit={(v) => save({ classYear: v || null })} options={CLASS_YEARS} />
        <LField label="Mezuniyet yılı" type="number" value={c.gradYear ?? ''} onCommit={(v) => save({ gradYear: v === '' ? null : Number(v) })} />
        <LField label="Durum" value={c.eduStatus} onCommit={(v) => save({ eduStatus: v || 'unknown' })} options={EDU_STATUSES} />
        <LField label="Rol tipi" value={c.roleType} onCommit={(v) => save({ roleType: v || null })} options={ROLE_TYPES} />
      </div>

      <h4 className="hub-h4">Kanıt linkleri</h4>
      <EvidenceList evidence={c.evidence || []} onChange={(ev) => save({ evidence: ev })} />

      <div style={{ marginTop: 16 }}>
        <LField label="Neden bu kişi?" textarea value={c.whyThisOne} onCommit={(v) => save({ whyThisOne: v })}
          hint="Somut esere atıf (repo / proje / yarışma / yazı). Sıfat değil, ne yaptığı." />
      </div>

      <h4 className="hub-h4">
        Sonraki aksiyon {nextActionRequired && <span style={{ color: 'var(--adm-red)' }}>*</span>}
      </h4>
      {nextActionRequired && !c.nextAction && (
        <div className="hub-threshold hub-threshold--no" style={{ marginBottom: 8 }}>
          Havuz dışı adayda sonraki aksiyon zorunludur (§12).
        </div>
      )}
      <LField label="Aksiyon" textarea value={c.nextAction} onCommit={(v) => save({ nextAction: v })} />
      <div className="adm-form-grid">
        <LField label="Tarih" type="date" value={c.nextActionAt ? String(c.nextActionAt).slice(0, 10) : ''}
          onCommit={(v) => save({ nextActionAt: v || null })} />
        <LField label="Bağlantı (takvim vb.)" value={c.nextActionLink} onCommit={(v) => save({ nextActionLink: v })} />
      </div>
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
      {evidence.length === 0 && <div style={{ fontSize: 13, color: 'var(--adm-text-dim)', marginBottom: 8 }}>Henüz kanıt linki yok.</div>}
      {evidence.map((e, i) => (
        <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6, fontSize: 13 }}>
          <a href={e.url} target="_blank" rel="noreferrer" style={{ color: 'var(--adm-blue)', flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{e.url}</a>
          {e.note && <span style={{ color: 'var(--adm-text-dim)' }}>{e.note}</span>}
          <button className="adm-icon-btn adm-icon-btn--danger" onClick={() => onChange(evidence.filter((_, x) => x !== i))}>
            <AIcon name="trash" size={13} />
          </button>
        </div>
      ))}
      <div style={{ display: 'flex', gap: 6, marginTop: 6 }}>
        <input className="adm-input adm-input--sm" placeholder="https://…" value={url} onChange={(e) => setUrl(e.target.value)} />
        <input className="adm-input adm-input--sm" style={{ width: 140 }} placeholder="not" value={note} onChange={(e) => setNote(e.target.value)} />
        <button className="adm-btn adm-btn--ghost adm-btn--sm" onClick={add}>Ekle</button>
      </div>
    </div>
  );
}

// ── Değerlendirme ──────────────────────────────────────────────────
const AXIS_FIELD = { finishing: 'scoreFinishing', communication: 'scoreCommunication', capacity: 'scoreCapacity' };

function AssessTab({ c, save, role }) {
  const met = thresholdMet(c);
  const finalistChk = canAdvance(c, 'finalist', { role });
  const flagCount = (c.redFlags || []).length;

  const setScore = (axisKey, n) => {
    const field = AXIS_FIELD[axisKey];
    save({ [field]: c[field] === n ? null : n });
  };
  const toggleFlag = (key) => {
    const cur = c.redFlags || [];
    save({ redFlags: cur.includes(key) ? cur.filter((k) => k !== key) : [...cur, key] });
  };

  return (
    <div>
      <h4 className="hub-h4">Rubrik</h4>
      <p style={{ fontSize: 12, color: 'var(--adm-text-dim)', marginBottom: 12 }}>
        Üç eksen, {SCORE_MIN}–{SCORE_MAX}. Eşik: toplam ≥ {THRESHOLD.minTotal} ve hiçbir eksen ≤ {THRESHOLD.minAxis - 1}.
      </p>
      {RUBRIC_AXES.map((ax) => (
        <div key={ax.value} style={{ marginBottom: 12 }}>
          <div style={{ fontSize: 13, fontWeight: 600 }}>{ax.label}</div>
          <div style={{ fontSize: 11.5, color: 'var(--adm-text-dim)', marginBottom: 6 }}>{ax.hint}</div>
          <div className="hub-score-row">
            {[1, 2, 3, 4, 5].map((n) => (
              <button key={n}
                className={`hub-score-btn ${c[AXIS_FIELD[ax.value]] === n ? 'hub-score-btn--on' : ''}`}
                onClick={() => setScore(ax.value, n)}>{n}</button>
            ))}
          </div>
        </div>
      ))}

      <div className="hub-ai" style={{ margin: '8px 0 16px' }}>
        <b>AI ön puanı · öneri</b> (yalnızca bitirmişlik) —{' '}
        {c.aiScore != null ? <>{c.aiScore}/5{c.aiScoreNote ? ` · ${c.aiScoreNote}` : ''}</> : 'henüz yok'}
      </div>

      <div className={`hub-threshold ${met && finalistChk.ok ? 'hub-threshold--ok' : 'hub-threshold--no'}`}>
        <AIcon name={met && finalistChk.ok ? 'check' : 'x'} size={16} />
        {finalistChk.ok
          ? `Finalist eşiği sağlanıyor (toplam ${c.scoreTotal ?? 0}).`
          : finalistChk.reason || 'Finalist eşiği sağlanmıyor.'}
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
          hint="2+ bayrakla finalist'e geçiş için zorunlu (§2.4)."
          value={c.overrideReason} onCommit={(v) => save({ overrideReason: v })} />
      )}
    </div>
  );
}

// ── Geçmiş ────────────────────────────────────────────────────────
function HistoryTab({ history }) {
  const items = useMemo(() => {
    if (!history) return null;
    const out = [
      ...history.touches.map((t) => ({ when: t.sentAt, what: `Temas · ${TOUCH_CHANNEL_LABEL[t.channel] || t.channel} · ${TOUCH_OUTCOME_LABEL[t.outcome] || t.outcome}${t.note ? ` — ${t.note}` : ''}` })),
      ...history.interviews.map((i) => ({ when: i.heldAt, what: `Görüşme · ${i.decision ? INTERVIEW_DECISION_LABEL[i.decision] : 'karar yok'}${i.note ? ` — ${i.note}` : ''}` })),
      ...history.gates.map((g) => ({ when: g.startedAt, what: `Kapı ${g.gate} · ${GATE_RESULT_LABEL[g.result] || g.result}` })),
      ...history.stageLog.map((l) => ({ when: l.createdAt, what: `Aşama: ${STAGE_LABEL[l.fromStage] || '—'} → ${STAGE_LABEL[l.toStage] || l.toStage}${l.reason ? ` (${l.reason})` : ''}` })),
    ];
    return out.filter((x) => x.when).sort((a, b) => new Date(b.when) - new Date(a.when));
  }, [history]);

  if (!items) return <div style={{ color: 'var(--adm-text-dim)', fontSize: 13 }}>Yükleniyor…</div>;
  if (items.length === 0) return <div className="adm-empty">Bu aday için geçmiş kaydı yok.</div>;

  return (
    <ul className="hub-timeline">
      {items.map((it, i) => (
        <li key={i}>
          <div className="hub-timeline__when">{new Date(it.when).toLocaleString('tr-TR')}</div>
          <div className="hub-timeline__what">{it.what}</div>
        </li>
      ))}
    </ul>
  );
}
