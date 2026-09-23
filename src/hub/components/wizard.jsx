// wizard.jsx — tek-soru-tek-ekran sihirbaz (public/team/index.html deseni).
// FLOW_DEFS: [{ key, type, q, ph?, sub?, optional?, options? }]
//   type: 'text' | 'textarea' | 'date' | 'options'
// options: [{ value, label, hint? }]
//   - ARA adımlarda seçince otomatik ilerler
//   - SON adımda seçmek yalnızca işaretler; işlem için "Uygula"ya basılır
//     (yıkıcı aksiyonlarda yanlışlıkla tetiklenmesin diye).
//
// SADECE görsel/markup katmanı. onComplete(answers) çağıranın store işini yapar;
// bu bileşen hiçbir store/kural çağrısı bilmez.
import React, { useMemo, useState } from 'react';

function StepBody({ def, value, onChange, onPick }) {
  if (def.type === 'options') {
    return (
      <div className="hub-wz__opts">
        {(def.options || []).map((o) => (
          <button key={String(o.value)} type="button"
            className={`hub-wz__opt ${value === o.value ? 'hub-wz__opt--on' : ''}`}
            onClick={() => onPick(o.value)}>
            <span className="hub-wz__opt-l">{o.label}</span>
            {o.hint != null && <span className="hub-wz__opt-r">{o.hint}</span>}
          </button>
        ))}
      </div>
    );
  }
  if (def.type === 'textarea') {
    return (
      <textarea className="hub-wz__input" value={value ?? ''} placeholder={def.ph || ''}
        autoFocus onChange={(e) => onChange(e.target.value)} />
    );
  }
  if (def.type === 'date') {
    return (
      <input type="date" className="hub-wz__input" value={value ?? ''}
        autoFocus onChange={(e) => onChange(e.target.value)} />
    );
  }
  return (
    <input className="hub-wz__input" value={value ?? ''} placeholder={def.ph || ''}
      autoFocus onChange={(e) => onChange(e.target.value)}
      onKeyDown={(e) => { if (e.key === 'Enter') e.currentTarget.blur(); }} />
  );
}

export default function HubWizard({
  title, steps = [], initial = {}, submitLabel = 'Kaydet', doneMessage,
  onComplete, onCancel, wide,
}) {
  const [i, setI] = useState(0);
  const [answers, setAnswers] = useState(() => ({ ...initial }));
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');
  const [done, setDone] = useState(false);

  const def = steps[i];
  const total = steps.length;
  const isLast = i === total - 1;
  const val = answers[def?.key];
  const filled = val != null && String(val).trim() !== '';
  // "İleri/Uygula" ancak bir değer seçili/girilmişse ya da adım opsiyonelse aktif —
  // 'options' adımlarında da öyle (2026-09-23 düzeltmesi: önceden ARA adımdaki
  // 'options' soruları hiç seçim yapılmadan "İleri" ile atlanabiliyordu, zorunlu
  // sorular — Kaynak, İlgi alanı, Rol tipi vb. — sessizce boş geçilebiliyordu).
  const canNext = def?.optional || filled;

  const set = (v) => setAnswers((a) => ({ ...a, [def.key]: v }));

  const finish = async (finalAnswers) => {
    setBusy(true); setErr('');
    try {
      await onComplete(finalAnswers);
      if (doneMessage) setDone(true);
      else onCancel();
    } catch (e) {
      setErr(e?.message || 'İşlem başarısız.');
      setBusy(false);
    }
  };

  const next = (overrideVal) => {
    const a = overrideVal === undefined ? answers : { ...answers, [def.key]: overrideVal };
    // overrideVal TANIMLIYSA bir seçenek butonuna deliberate tıklanmış demektir (bkz.
    // StepBody onPick) — değeri boş string olsa bile (ör. "— henüz belli değil" gibi
    // kasıtlı "boş" seçenekler) bu her zaman geçerli bir cevaptır, zorunlu kontrolü
    // yalnızca genel "İleri" düğmesine (overrideVal === undefined) hiç seçim
    // yapılmadan basılırsa uygulanır.
    if (overrideVal === undefined && !def.optional && !filled) {
      setErr('Bu alan zorunlu.'); return;
    }
    setErr('');
    if (isLast) finish(a);
    else { setAnswers(a); setI(i + 1); }
  };
  const back = () => { setErr(''); setI(Math.max(0, i - 1)); };

  const dots = useMemo(() => steps.map((_, x) => x), [steps]);

  return (
    <div className="hub-wz-overlay" onClick={busy ? undefined : onCancel}>
      <div className={`hub-wz ${wide ? 'hub-wz--wide' : ''}`} onClick={(e) => e.stopPropagation()}>
        {done ? (
          <div className="hub-wz__done">
            <h3>{doneMessage}</h3>
            <button className="hub-wz__next" style={{ margin: '0 auto' }} onClick={onCancel}>Kapat</button>
          </div>
        ) : (
          <>
            <div className="hub-wz__head">
              <div className="hub-wz__headrow">
                <div className="hub-wz__dots">
                  {dots.map((x) => <span key={x} className={`hub-wz__dot ${x === i ? 'hub-wz__dot--on' : ''}`} />)}
                </div>
                <button className="hub-wz__x" onClick={onCancel} disabled={busy}>✕</button>
              </div>
            </div>

            <div className="hub-wz__body">
              <div className="hub-wz__step" key={i}>
                <div className="hub-wz__kicker">{title ? `${title.toUpperCase()} · ` : ''}ADIM {i + 1}/{total}</div>
                <div className={`hub-wz__q ${def.sub ? 'hub-wz__q--tight' : ''}`}>{def.q}</div>
                {def.sub && <div className="hub-wz__sub">{def.sub}</div>}
                <StepBody def={def} value={val}
                  onChange={set}
                  onPick={(v) => { set(v); if (!isLast) next(v); }} />
              </div>
            </div>

            {err && <div className="hub-wz__err">{err}</div>}

            <div className="hub-wz__foot">
              {i > 0 && <button className="hub-wz__back" onClick={back} disabled={busy}>← Geri</button>}
              <button className="hub-wz__next" onClick={() => next()} disabled={busy || !canNext}>
                {busy ? '…' : isLast ? submitLabel : 'İleri →'}
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
