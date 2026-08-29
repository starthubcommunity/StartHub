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
  STAGE_LABEL, SOURCE_LABEL, TOUCH_CHANNELS, TOUCH_CHANNEL_LABEL, TOUCH_OUTCOME_LABEL,
  INTERVIEW_DECISION_LABEL, GATE_RESULT_LABEL, THRESHOLD,
} from '../hub-constants';
import { thresholdMet, canAdvance, gateStatus } from '../hub-rules';
import { GATE } from '../hub-constants';
import { supabase } from '../../lib/supabase';
import { fillTemplate } from './templates';
import UnknowablePanel from '../components/unknowable';

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
  const [composing, setComposing] = useState(false);
  const [toast, setToast] = useState(null);
  const flash = (m) => { setToast(m); setTimeout(() => setToast(null), 3500); };

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

        <div style={{ display: 'flex', gap: 8, padding: '10px 16px', borderBottom: '1px solid var(--adm-border)', background: 'var(--adm-bg-card)', flexWrap: 'wrap' }}>
          <button className="adm-btn adm-btn--primary adm-btn--sm" onClick={() => setComposing(true)}>
            <AIcon name="edit" size={13} /> Mesaj taslağı üret
          </button>
          {candidate.stage === 'contacted' && (
            <button className="adm-btn adm-btn--ghost adm-btn--sm"
              onClick={() => store.markReplied(candidateId).then(() => { setHistory(null); flash('Aşama: Cevap.'); })}>
              <AIcon name="check" size={13} /> Cevap geldi
            </button>
          )}
        </div>

        <div className="hub-panel__body">
          {tab === 'summary' && <SummaryTab c={candidate} save={save} />}
          {tab === 'assess' && <AssessTab c={candidate} save={save} role={role} />}
          {tab === 'history' && <HistoryTab history={history} />}
        </div>
      </div>

      {composing && (
        <MessageComposer candidate={candidate}
          onDone={(msg) => { setComposing(false); setHistory(null); flash(msg); }}
          onCancel={() => setComposing(false)} />
      )}
      {toast && <div className="hub-toast">{toast}</div>}
    </div>
  );
}

// ── Özet ────────────────────────────────────────────────────────────
const GATE_STAGES = ['finalist', 'gate_a', 'gate_b', 'joined'];

function SummaryTab({ c, save }) {
  const nextActionRequired = c.stage !== 'pool';
  return (
    <div>
      {GATE_STAGES.includes(c.stage) && <GatesSection c={c} />}

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

// ── Kapılar (§2.5) ────────────────────────────────────────────────
// Team sistemine YALNIZCA referansla bağlanır (startup_id + person_id yazılır);
// app_state JSON bloğu okunmaz/yazılmaz (§4.6.2).
const remaining = (dueAt) => {
  if (!dueAt) return '';
  const ms = new Date(dueAt) - Date.now();
  if (ms <= 0) return 'süre doldu';
  const h = Math.round(ms / 3600000);
  return h < 48 ? `${h} saat kaldı` : `${Math.round(h / 24)} gün kaldı`;
};
const STATUS_LABEL = { running: 'Sürüyor', due: 'Süre doldu', overdue: 'Gecikti' };

function GateCard({ gate, onMark }) {
  const st = gateStatus(gate);
  return (
    <div className="hub-gate">
      <div className="hub-gate__head">
        <strong>Kapı {gate.gate}</strong>
        <span className={`hub-pill hub-gate__status hub-gate__status--${st}`}>
          {STATUS_LABEL[st]}{gate.result === 'pending' && st === 'running' ? ` · ${remaining(gate.dueAt)}` : ''}
        </span>
      </div>
      {gate.taskText && <div className="hub-gate__task">{gate.taskText}</div>}
      <div style={{ fontSize: 11.5, color: 'var(--adm-text-dim)', margin: '4px 0' }}>
        Başlangıç: {String(gate.startedAt).slice(0, 10)} · Vade: {String(gate.dueAt).slice(0, 16).replace('T', ' ')}
      </div>
      {gate.result === 'pending' ? (
        <div style={{ display: 'flex', gap: 6 }}>
          <button className="adm-btn adm-btn--primary adm-btn--sm" onClick={() => onMark({ delivered: true, result: 'passed' })}>Teslim etti</button>
          <button className="adm-btn adm-btn--ghost adm-btn--sm" onClick={() => onMark({ delivered: false, result: 'failed' })}>Teslim etmedi</button>
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

function GatesSection({ c }) {
  const store = useHubStore();
  const gates = store.gates.filter((g) => g.candidateId === c.id);
  const gateA = gates.filter((g) => g.gate === 'A').sort((a, b) => new Date(a.startedAt) - new Date(b.startedAt))[0];
  const gateB = gates.filter((g) => g.gate === 'B').sort((a, b) => new Date(b.startedAt) - new Date(a.startedAt))[0];
  // joined'da kaynak KOLONDUR (vesting_start_date); öncesinde Kapı A'dan tahmin.
  const vestingStart = c.vestingStartDate || (gateA ? String(gateA.startedAt).slice(0, 10) : null);

  const [taskText, setTaskText] = useState('');
  const [startups, setStartups] = useState(null);
  const [projId, setProjId] = useState(String(c.startupId || ''));
  const [personId, setPersonId] = useState('');
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState('');
  const flash = (m) => { setMsg(m); setTimeout(() => setMsg(''), 4000); };

  useEffect(() => {
    supabase.from('startups').select('id, name').order('name')
      .then(({ data }) => setStartups(data || []))
      .catch(() => setStartups([]));
  }, []);

  const startA = async () => {
    setBusy(true);
    try {
      const due = new Date(Date.now() + GATE.aHours * 3600000).toISOString();
      await store.startGate(c, 'A', { taskText: taskText.trim() || null, dueAt: due });
      setTaskText('');
    } catch (e) { flash('Başlatılamadı: ' + e.message); }
    setBusy(false);
  };
  const startB = async () => {
    setBusy(true);
    try {
      const due = new Date(Date.now() + GATE.bDays * 86400000).toISOString();
      await store.startGate(c, 'B', {
        dueAt: due,
        startupId: projId ? Number(projId) : null,
        personId: personId ? Number(personId) : null,
      });
    } catch (e) { flash('Başlatılamadı: ' + e.message); }
    setBusy(false);
  };
  const toTeam = async () => {
    setBusy(true);
    try {
      const v = await store.moveToTeam(c.id);
      flash(v ? `Ekibe aktarıldı · hak ediş başlangıcı ${v} (Kapı A ilk günü).` : 'Ekibe aktarıldı.');
    } catch (e) { flash('Aktarılamadı: ' + e.message); }
    setBusy(false);
  };

  return (
    <div className="hub-gates">
      <h4 className="hub-h4">Süreç · Kapılar</h4>
      {c.stage === 'joined' ? (
        <div className="hub-gate" style={{ background: 'var(--adm-green-light)', borderColor: 'transparent' }}>
          <div style={{ fontSize: 13 }}>
            <strong>Hak ediş başlangıcı:</strong> {c.vestingStartDate || vestingStart || '—'}
            <span style={{ color: 'var(--adm-text-dim)' }}> · Kapı A'nın ilk günü (geriye dönük)</span>
          </div>
          {c.joinedAt && (
            <div style={{ fontSize: 12, color: 'var(--adm-text-secondary)', marginTop: 2 }}>
              Katılım tarihi: {String(c.joinedAt).slice(0, 10)}
            </div>
          )}
        </div>
      ) : vestingStart && (
        <div style={{ fontSize: 12, color: 'var(--adm-text-secondary)', marginBottom: 8 }}>
          Hak ediş başlangıcı (tahmini, geriye dönük): <strong>{vestingStart}</strong>
        </div>
      )}

      {/* Kapı A başlat — finalist aşamasında, henüz A yokken */}
      {c.stage === 'finalist' && !gateA && (
        <div className="hub-gate">
          <strong>Kapı A başlat</strong>
          <div style={{ fontSize: 11.5, color: 'var(--adm-text-dim)', margin: '2px 0 6px' }}>
            72 saatlik tek çıktılı görev. Metin adaya olduğu gibi gider.
          </div>
          <textarea className="adm-input adm-textarea" rows={3} value={taskText}
            onChange={(e) => setTaskText(e.target.value)}
            placeholder="Ör. Sektörden 3 kişiyle konuş, kısa notlarını getir." />
          <button className="adm-btn adm-btn--primary adm-btn--sm" style={{ marginTop: 6 }} disabled={busy} onClick={startA}>
            Kapı A başlat (72 saat)
          </button>
        </div>
      )}

      {gateA && <GateCard gate={gateA} onMark={(p) => store.markGate(gateA.id, p)} />}

      {/* Kapı B başlat — A geçtiyse ve B yoksa */}
      {gateA?.result === 'passed' && !gateB && (
        <div className="hub-gate">
          <strong>Kapı B başlat</strong>
          <div style={{ fontSize: 11.5, color: 'var(--adm-text-dim)', margin: '2px 0 6px' }}>
            10 günlük ilk sprint. Proje referansı yazılır (startup_id + person_id).
          </div>
          <div className="adm-form-grid">
            <Field label="Proje">
              {startups && startups.length ? (
                <select className="adm-input adm-select" value={projId} onChange={(e) => setProjId(e.target.value)}>
                  <option value="">—</option>
                  {startups.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
                </select>
              ) : (
                <input className="adm-input" placeholder="startup_id (people/startups ID'si)" value={projId}
                  onChange={(e) => setProjId(e.target.value.replace(/\D/g, ''))} />
              )}
            </Field>
            <Field label="Ekip kişi ID (people.id, ops.)">
              <input className="adm-input" value={personId} onChange={(e) => setPersonId(e.target.value.replace(/\D/g, ''))} />
            </Field>
          </div>
          <button className="adm-btn adm-btn--primary adm-btn--sm" disabled={busy} onClick={startB}>
            Kapı B başlat (10 gün)
          </button>
        </div>
      )}

      {gateB && <GateCard gate={gateB} onMark={(p) => store.markGate(gateB.id, p)} />}

      {/* Ekibe aktar — B geçtiyse */}
      {gateB?.result === 'passed' && c.stage !== 'joined' && (
        <button className="adm-btn adm-btn--primary adm-btn--sm" style={{ marginTop: 4 }} disabled={busy} onClick={toTeam}>
          Ekibe aktar
        </button>
      )}
      {c.stage === 'joined' && (
        <div className="hub-pill" style={{ background: 'var(--adm-green-light)', color: 'var(--adm-green)' }}>Ekipte</div>
      )}

      {msg && <div style={{ fontSize: 12.5, color: 'var(--adm-text-secondary)', marginTop: 8 }}>{msg}</div>}
    </div>
  );
}

// ── Değerlendirme ──────────────────────────────────────────────────
const AXIS_FIELD = { finishing: 'scoreFinishing', communication: 'scoreCommunication', capacity: 'scoreCapacity' };

function AssessTab({ c, save, role }) {
  const met = thresholdMet(c);
  // Eşik göstergesi puan+bayrak kuralını gösterir — aşama SIRASINDAN bağımsız
  // (sıra ayrı bir kısıt). Bu yüzden sanal olarak "interviewed"dan kontrol.
  const finalistChk = canAdvance({ ...c, stage: 'interviewed' }, 'finalist', { role });
  const flagCount = (c.redFlags || []).length;
  const [enriching, setEnriching] = useState(false);
  const [enrichErr, setEnrichErr] = useState('');

  // §8.6.5 — havuza girmiş adayda GitHub linki varsa zenginleştirme.
  // Yalnızca `ai_score` (bitirmişlik); iletişim/kapasite DOKUNULMAZ.
  const enrich = async () => {
    const login = (c.github || '').match(/github\.com\/([A-Za-z0-9-]+)/i)?.[1];
    if (!login) { setEnrichErr('GitHub linki yok.'); return; }
    setEnriching(true); setEnrichErr('');
    try {
      const { enrichUser } = await import('../hub-github');
      const { computeEnrichment, prescoreFinishing, whyThisOne } = await import('../hub-enrich');
      const { user, repos, top, prsToOthers, orgs, readmes } = await enrichUser(login, {});
      const enrichment = computeEnrichment({ user, repos, prsToOthers, orgs, readmes });
      const prescore = prescoreFinishing(enrichment, top, {});
      await save({
        enrichment,
        enrichedAt: enrichment.fetched_at,
        aiScore: prescore.score,
        aiScoreNote: prescore.note,
        whyThisOne: c.whyThisOne || whyThisOne(top, {}),
      });
    } catch (e) { setEnrichErr(e.message); }
    setEnriching(false);
  };

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
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
          <b>AI ön puanı · öneri</b> (yalnızca bitirmişlik) —{' '}
          {c.aiScore != null ? <>{c.aiScore}/5{c.aiScoreNote ? ` · ${c.aiScoreNote}` : ''}</> : 'henüz yok'}
          <button className="adm-btn adm-btn--ghost adm-btn--sm" style={{ marginLeft: 'auto' }}
            disabled={enriching || !c.github}
            title={c.github ? '' : 'GitHub linki yok'}
            onClick={enrich}>
            {enriching ? 'Analiz ediliyor…' : 'Zenginleştir (GitHub)'}
          </button>
        </div>
        {enrichErr && <div style={{ color: 'var(--adm-red)', marginTop: 4 }}>{enrichErr}</div>}
        <div style={{ marginTop: 4 }}>İletişim ve kapasite eksenleri AI ile tahmin edilmez — görüşmeden çıkar.</div>
      </div>
      <UnknowablePanel compact />
      {c.enrichment && Object.keys(c.enrichment).length > 0 && (
        <div style={{ fontSize: 12, color: 'var(--adm-text-secondary)', margin: '4px 0 12px' }}>
          Sinyaller: bitmiş {c.enrichment.finished_projects ?? '—'} · son aktiflik {c.enrichment.activity_recency ?? '—'} gün ·
          süreklilik {c.enrichment.consistency ?? '—'}/12 · dil {c.enrichment.breadth ?? '—'} ·
          iş birliği {c.enrichment.collaboration ?? '—'}
        </div>
      )}

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

// ── Mesaj taslağı (§8.5b) ─────────────────────────────────────────
// Sistem mesajı GÖNDERMEZ. "Kopyala" tek işlemde: panoya kopyalar +
// hub_touches kaydı + adayı contacted'a taşır + 7 gün follow_up + şablon
// sent_count++. Kişiselleştirme satırı AYRI ve zorunlu — boşken kopyalama
// devre dışı. "Toplu gönder" butonu YOK ve eklenmeyecek.
function MessageComposer({ candidate, onDone, onCancel }) {
  const { templates, sendTouch } = useHubStore();
  const active = useMemo(() => templates.filter((t) => t.active), [templates]);
  const [tplId, setTplId] = useState(() => {
    const match = active.find((t) => t.sourceType === candidate.source);
    return (match || active[0])?.id || '';
  });
  const tpl = active.find((t) => t.id === tplId);
  const [personalization, setPersonalization] = useState(candidate.whyThisOne || '');
  const [body, setBody] = useState('');
  const [channel, setChannel] = useState('linkedin');
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');

  useEffect(() => { setBody(tpl ? fillTemplate(tpl.body, candidate) : ''); }, [tplId]); // eslint-disable-line

  const canCopy = personalization.trim().length > 0 && !busy && active.length > 0;
  const fullText = `${personalization.trim()}\n\n${body}`.trim();

  const copy = async () => {
    if (!canCopy) return;
    setBusy(true); setErr('');
    try { await navigator.clipboard.writeText(fullText); } catch { /* pano izni yoksa yine de kaydet */ }
    try {
      const res = await sendTouch(candidate, {
        templateId: tpl?.id || null, variant: tpl?.variant || null,
        channel, personalization: personalization.trim(),
      });
      onDone(res?.advanced
        ? 'Panoya kopyalandı · temas kaydedildi · aday “Temas” aşamasına geçti.'
        : 'Panoya kopyalandı · temas kaydedildi · son temas tarihi güncellendi (aşama değişmedi).');
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
          {active.length === 0 && (
            <div className="hub-ai" style={{ marginBottom: 12 }}>Aktif şablon yok — Şablonlar ekranından ekle.</div>
          )}
          <div className="adm-form-grid">
            <Field label="Şablon">
              <select className="adm-input adm-select" value={tplId} onChange={(e) => setTplId(e.target.value)}>
                {active.map((t) => <option key={t.id} value={t.id}>{t.name} · {t.variant}</option>)}
              </select>
            </Field>
            <Field label="Kanal" required hint="Cevap oranını kanal bazında ölçmek için.">
              <select className="adm-input adm-select" value={channel} onChange={(e) => setChannel(e.target.value)}>
                {TOUCH_CHANNELS.map((c) => <option key={c.value} value={c.value}>{c.label}</option>)}
              </select>
            </Field>
          </div>
          <Field label="Kişiselleştirme satırı" required
            hint="Somut esere atıf. BOŞKEN “Kopyala” devre dışıdır (§8.5b).">
            <textarea className="adm-input adm-textarea" rows={2} value={personalization}
              onChange={(e) => setPersonalization(e.target.value)}
              placeholder="Teknofest 2026'da … projesiyle finale kaldı; GitHub'daki … deposunda canlı demo linki var." />
          </Field>
          <Field label="Gövde" hint="Şablondan dolduruldu — düzenleyebilirsin.">
            <textarea className="adm-input adm-textarea" rows={7} value={body} onChange={(e) => setBody(e.target.value)} />
          </Field>
          {err && <div style={{ color: 'var(--adm-red)', fontSize: 13, marginBottom: 8 }}>{err}</div>}
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
            <span style={{ fontSize: 12, color: 'var(--adm-text-dim)' }}>
              Kopyala → temas kaydı + “Temas” aşaması + 7 gün takip + şablon sayacı.
            </span>
            <div style={{ display: 'flex', gap: 8 }}>
              <button className="adm-btn adm-btn--ghost" onClick={onCancel}>İptal</button>
              <button className="adm-btn adm-btn--primary" disabled={!canCopy} onClick={copy}>
                <AIcon name="save" size={14} /> Kopyala
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
