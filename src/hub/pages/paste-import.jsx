// paste-import.jsx — Yapıştır ve ekle (HUB_SPEC v3 §6.2, PROMPT_V3 D1).
// Outbound'da veri liste halinde gelir (hackathon sonuç sayfası, etkinlik
// listesi). Ham metin -> hub-parse.parsePastedText (LLM YOK, regex + TR üni
// listesi; bulamadığı alanı BOŞ bırakır) -> satır bazlı al/atla -> kaynak +
// parti etiketi + ortak "neden bu kişi" -> Havuz.
//
// CSV (import-simple.jsx) ikincil kalır; yapıştırma birincil yöntem.
import React, { useMemo, useState } from 'react';
import { Field, Input, Select } from '../../admin/admin-ui';
import { useHubStore } from '../hub-store';
import { usePerms } from '../../lib/use-perms';
import { SOURCES } from '../hub-constants';
import { parsePastedText } from '../hub-parse';

const SAMPLE = `1. Ada Yılmaz — github.com/adayilmaz — İTÜ Bilgisayar Müh.
2. Mert Kaya - mert@ornek.com - Boğaziçi Üniversitesi
3. Elif Demir · linkedin.com/in/elifdemir · projesi: elifdemir.dev`;

export default function PasteImport({ onClose }) {
  const store = useHubStore();
  const { can } = usePerms();
  const { openRoles } = store;
  const [step, setStep] = useState(1);
  const [raw, setRaw] = useState('');
  const [rows, setRows] = useState([]);            // parsePastedText().rows
  const [meta, setMeta] = useState({ source: 'hackathon', importBatchLabel: '', commonWhy: '', roleId: '' });
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');
  const [done, setDone] = useState(null);

  const parse = () => {
    const { rows: r } = parsePastedText(raw);
    if (!r.length) { setErr('Ayrıştırılacak bir şey bulunamadı.'); return; }
    setErr('');
    setRows(r);
    setStep(2);
  };

  const takenCount = rows.filter((r) => r._take).length;
  const linkOf = (r) => r.github || r.linkedin || r.email || '';

  const toPreview = () => {
    if (takenCount === 0) { setErr('En az bir satır seçili olmalı.'); return; }
    setErr('');
    setStep(3);
  };

  const commit = async () => {
    if (!meta.commonWhy.trim()) { setErr('Ortak "Neden bu kişi" cümlesi zorunlu.'); return; }
    setBusy(true); setErr('');
    try {
      const payload = rows.map((r) => ({
        _take: r._take,
        fullName: r.fullName || '(isimsiz)',
        email: r.email || undefined,
        linkedin: r.linkedin || null,
        github: r.github || null,
        university: r.university || null,
        evidence: r.evidence || [],
        whyThisOne: meta.commonWhy.trim(),
      }));
      const { created } = await store.importCandidates(
        {
          source: meta.source,
          importBatchLabel: meta.importBatchLabel.trim() || null,
          roleId: meta.roleId || null,
        },
        payload,
      );
      setDone(created.length);
    } catch (e) { setErr(e.message || 'Eklenemedi.'); setBusy(false); }
  };

  if (!can('candidates.write')) return null;

  return (
    <div className="hub-wz-overlay" onClick={busy ? undefined : onClose}>
      <div className="hub-wz hub-wz--wide" onClick={(e) => e.stopPropagation()}>
        {done != null ? (
          <div className="hub-wz__done">
            <h3>{done} aday havuza eklendi.</h3>
            <button className="hub-wz__next" style={{ margin: '0 auto' }} onClick={onClose}>Kapat</button>
          </div>
        ) : (<>
          <div className="hub-wz__head">
            <div className="hub-wz__headrow">
              <div className="hub-wz__dots">
                {[1, 2, 3].map((s) => <span key={s} className={`hub-wz__dot ${s === step ? 'hub-wz__dot--on' : ''}`} />)}
              </div>
              <button className="hub-wz__x" onClick={onClose} disabled={busy}>✕</button>
            </div>
          </div>

          <div className="hub-wz__body">
            {step === 1 && (
              <div className="hub-wz__step">
                <div className="hub-wz__kicker">ADIM 1/3</div>
                <div className="hub-wz__q hub-wz__q--tight">Listeyi yapıştır</div>
                <div className="hub-wz__sub">
                  Hackathon sonuç sayfası, etkinlik listesi, tablo — ham metin yeterli.
                  Sistem satırlara böler; bulamadığı alanı <b>boş bırakır</b> (uydurmaz).
                </div>
                <textarea className="adm-input adm-textarea" rows={12} value={raw}
                  onChange={(e) => setRaw(e.target.value)} placeholder={SAMPLE} />
              </div>
            )}

            {step === 2 && (
              <div className="hub-wz__step">
                <div className="hub-wz__kicker">ADIM 2/3</div>
                <div className="hub-wz__q hub-wz__q--tight">Satırları gözden geçir</div>
                <div className="hub-wz__sub">
                  {rows.length} satır · {takenCount} seçili. Adı çıkarılamayan satırlar
                  varsayılan olarak <b>kapalı</b>.
                </div>
                <div style={{ maxHeight: 320, overflowY: 'auto', border: '1px solid #F0EADE', borderRadius: 10 }}>
                  <table className="adm-table">
                    <thead><tr><th></th><th>Ad</th><th>Link</th><th>Okul</th><th>Bağlantı</th></tr></thead>
                    <tbody>
                      {rows.map((r) => (
                        <tr key={r._id} style={{ opacity: r._take ? 1 : 0.4, background: r._unparsed ? 'var(--adm-red-light, #FEF2F2)' : undefined }}>
                          <td>
                            <input type="checkbox" checked={!!r._take}
                              onChange={(e) => setRows((xs) => xs.map((x) => x._id === r._id ? { ...x, _take: e.target.checked } : x))} />
                          </td>
                          <td>{r.fullName || <em style={{ color: '#A29D94' }}>ad yok</em>}</td>
                          <td style={{ fontSize: 12 }}>{linkOf(r) || <span style={{ color: '#A29D94' }}>—</span>}</td>
                          <td style={{ fontSize: 12 }}>{r.university || <span style={{ color: '#A29D94' }}>—</span>}</td>
                          <td style={{ fontSize: 12 }}>{r.evidence?.length ? `${r.evidence.length} link` : <span style={{ color: '#A29D94' }}>—</span>}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {step === 3 && (
              <div className="hub-wz__step">
                <div className="hub-wz__kicker">ADIM 3/3</div>
                <div className="hub-wz__q hub-wz__q--tight">Parti bilgisi</div>
                <div className="hub-wz__sub">{takenCount} aday Havuz'a eklenecek.</div>
                <div className="adm-form-grid">
                  <Field label="Kaynak">
                    <Select value={meta.source} onChange={(v) => setMeta((m) => ({ ...m, source: v }))}
                      options={SOURCES.map((s) => ({ value: s.value, label: s.label }))} />
                  </Field>
                  <Field label="Parti etiketi" hint="Örn. Teknofest 2026 ulaşım finalistleri">
                    <Input value={meta.importBatchLabel} onChange={(v) => setMeta((m) => ({ ...m, importBatchLabel: v }))} />
                  </Field>
                </div>
                <Field label="Ortak “Neden bu kişi” *" hint="Tüm partiye yazılır. Somut: ne yapmışlar? Örn. Teknofest 2026 ulaşım kategorisi finalisti.">
                  <Input value={meta.commonWhy} onChange={(v) => setMeta((m) => ({ ...m, commonWhy: v }))} />
                </Field>
                <Field label="Açık rol (opsiyonel)">
                  <select className="adm-input adm-select" value={meta.roleId}
                    onChange={(e) => setMeta((m) => ({ ...m, roleId: e.target.value }))}>
                    <option value="">—</option>
                    {openRoles.filter((r) => ['sourcing', 'shortlist'].includes(r.status))
                      .map((r) => <option key={r.id} value={r.id}>{r.title}</option>)}
                  </select>
                </Field>
              </div>
            )}
          </div>

          {err && <div className="hub-wz__err">{err}</div>}

          <div className="hub-wz__foot">
            {step > 1 && <button className="hub-wz__back" onClick={() => setStep(step - 1)} disabled={busy}>← Geri</button>}
            {step === 1 && <button className="hub-wz__next" onClick={parse} disabled={!raw.trim()}>Ayrıştır →</button>}
            {step === 2 && <button className="hub-wz__next" onClick={toPreview}>İleri →</button>}
            {step === 3 && (
              <button className="hub-wz__next" onClick={commit} disabled={busy || !meta.commonWhy.trim()}>
                {busy ? 'Ekleniyor…' : `${takenCount} adayı ekle`}
              </button>
            )}
          </div>
        </>)}
      </div>
    </div>
  );
}
