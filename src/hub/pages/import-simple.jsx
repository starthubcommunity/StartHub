// import-simple.jsx — CSV içe aktarma (v2 §6). import.jsx'in yerine.
// 3 adım, senkron, arka plan işi yok:
//   1) Yükle  2) Kolon eşle (başlık tahmini)  3) Önizle + onayla
// Onaylanan satırlar tek seferde hub_candidates'a; hepsine aynı importBatchLabel.
//
// .csv yerel ayrıştırılır. .xlsx için: Excel'de "Farklı kaydet → CSV UTF-8".
// (SheetJS bağımlılığı eklenince .xlsx doğrudan okunabilir — bkz. PROMPT_S §7.)
import React, { useMemo, useState } from 'react';
import { Field, Input, Select } from '../../admin/admin-ui';
import { useHubStore } from '../hub-store';
import { usePerms } from '../../lib/use-perms';
import { SOURCES } from '../hub-constants';
import { findDuplicate } from '../hub-parse';

// ── CSV ayrıştırma (tırnak-farkında, minimal) ────────────────────────
function parseCsv(text) {
  const rows = [];
  let row = [], cell = '', q = false;
  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (q) {
      if (ch === '"' && text[i + 1] === '"') { cell += '"'; i++; }
      else if (ch === '"') q = false;
      else cell += ch;
    } else if (ch === '"') q = true;
    else if (ch === ',') { row.push(cell); cell = ''; }
    else if (ch === '\n' || ch === '\r') {
      if (ch === '\r' && text[i + 1] === '\n') i++;
      row.push(cell); rows.push(row); row = []; cell = '';
    } else cell += ch;
  }
  if (cell !== '' || row.length) { row.push(cell); rows.push(row); }
  return rows.filter((r) => r.some((c) => String(c).trim() !== ''));
}

// ── Hedef alanlar + başlık tahmini (basit string benzerliği) ─────────
const TARGETS = [
  { key: 'fullName',     label: 'Ad Soyad',       hints: ['ad soyad', 'ad', 'isim', 'name', 'full name', 'adı'] },
  { key: 'link',         label: 'Link',           hints: ['link', 'github', 'linkedin', 'url', 'profil'] },
  { key: 'email',        label: 'E-posta',        hints: ['e-posta', 'eposta', 'email', 'mail', 'e posta'] },
  { key: 'whyThisOne',   label: 'Neden bu kişi',  hints: ['neden', 'why', 'gerekçe', 'not', 'açıklama'] },
  { key: 'sourceDetail', label: 'Kaynak detayı',  hints: ['kaynak', 'source', 'detay', 'etkinlik', 'nereden'] },
];
const norm = (s) => String(s || '').toLowerCase().replace(/[_\-.]/g, ' ').trim();
function guessMap(headers) {
  const map = {};
  TARGETS.forEach((t) => {
    let best = -1, bestScore = 0;
    headers.forEach((h, i) => {
      const n = norm(h);
      const score = t.hints.reduce((s, hint) => {
        if (n === hint) return Math.max(s, 3);
        if (n.includes(hint) || hint.includes(n)) return Math.max(s, 2);
        return s;
      }, 0);
      if (score > bestScore) { bestScore = score; best = i; }
    });
    if (best >= 0) map[t.key] = best;
  });
  return map;
}

function linkFields(v) {
  const s = (v || '').trim();
  if (!s) return {};
  if (/github\.com/i.test(s)) return { github: s };
  if (/linkedin\.com/i.test(s)) return { linkedin: s };
  if (/@/.test(s) && !/^https?:/i.test(s)) return { email: s };
  return { linkedin: s };
}

export default function ImportSimple({ onClose }) {
  const store = useHubStore();
  const { can } = usePerms();
  const [step, setStep] = useState(1);
  const [grid, setGrid] = useState(null);       // string[][]
  const [map, setMap] = useState({});           // targetKey -> columnIndex
  const [meta, setMeta] = useState({ source: 'hackathon', importBatchLabel: '', commonWhy: '' });
  const [take, setTake] = useState([]);         // bool[]
  const [dups, setDups] = useState([]);         // (findDuplicate | null)[]  — D2
  const [modes, setModes] = useState([]);       // ('new'|'update'|'skip')[]
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');
  const [done, setDone] = useState(null);

  const headers = grid?.[0] || [];
  const body = useMemo(() => (grid ? grid.slice(1) : []), [grid]);

  const onFile = async (file) => {
    setErr('');
    if (/\.xlsx?$/i.test(file.name)) {
      setErr('Şimdilik yalnızca CSV. Excel\'de "Farklı kaydet → CSV UTF-8" ile kaydedip tekrar dene.');
      return;
    }
    try {
      const text = await file.text();
      const rows = parseCsv(text);
      if (rows.length < 2) { setErr('Dosyada başlık + en az bir veri satırı olmalı.'); return; }
      setGrid(rows);
      setMap(guessMap(rows[0] || []));
      setStep(2);
    } catch (e) { setErr(e.message || 'Dosya okunamadı.'); }
  };

  const goPreview = () => {
    if (map.fullName == null) { setErr('"Ad Soyad" sütunu eşlenmeli.'); return; }
    // A6 — "Neden bu kişi" sütunu eşlenmediyse tüm partiye tek ortak cümle zorunlu.
    if (map.whyThisOne == null && !meta.commonWhy.trim()) {
      setErr('"Neden bu kişi" sütunu yok — tüm partiye uygulanacak ortak bir cümle yaz.');
      return;
    }
    setErr('');
    // D2 — mükerrer tespiti (e-posta / link; CSV'de okul kolonu genelde yok).
    const d = body.map((r) => {
      const val = (k) => (map[k] != null ? String(r[map[k]] || '').trim() : '');
      return findDuplicate({
        fullName: val('fullName'), email: val('email'),
        ...linkFields(val('link')), university: '',
      }, store.candidates);
    });
    setDups(d);
    setModes(d.map((x) => (x?.certain ? 'update' : 'new')));
    setTake(body.map((r) => String(r[map.fullName] || '').trim() !== ''));
    setStep(3);
  };

  const commit = async () => {
    setBusy(true); setErr('');
    try {
      const rows = body.map((r, i) => {
        const val = (k) => (map[k] != null ? String(r[map[k]] || '').trim() : '');
        return {
          _take: !!take[i],
          _mode: modes[i] || 'new',
          _dupId: dups[i]?.id ?? null,
          fullName: val('fullName'),
          ...linkFields(val('link')),
          email: val('email') || undefined,
          whyThisOne: val('whyThisOne') || meta.commonWhy.trim() || null,
          sourceDetail: val('sourceDetail') || null,
        };
      });
      const { created, updated } = await store.importCandidates(
        { source: meta.source, importBatchLabel: meta.importBatchLabel.trim() || null },
        rows,
      );
      setDone({ created: created.length, updated: updated.length });
    } catch (e) { setErr(e.message || 'İçe aktarılamadı.'); setBusy(false); }
  };

  if (!can('candidates.write')) return null;

  return (
    <div className="hub-wz-overlay" onClick={busy ? undefined : onClose}>
      <div className="hub-wz hub-wz--wide" onClick={(e) => e.stopPropagation()}>
        {done != null ? (
          <div className="hub-wz__done">
            <h3>
              {done.created} aday havuza eklendi
              {done.updated > 0 ? ` · ${done.updated} mevcut kart güncellendi` : ''}.
            </h3>
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
                <div className="hub-wz__q hub-wz__q--tight">CSV dosyası seç</div>
                <div className="hub-wz__sub">Excel için: Farklı kaydet → CSV UTF-8</div>
                <input type="file" accept=".csv,text/csv" onChange={(e) => e.target.files[0] && onFile(e.target.files[0])} />
              </div>
            )}

            {step === 2 && grid && (
              <div className="hub-wz__step">
                <div className="hub-wz__kicker">ADIM 2/3</div>
                <div className="hub-wz__q hub-wz__q--tight">Sütunları eşle</div>
                <div className="hub-wz__sub">{body.length} satır. Sistem tahmin etti — düzeltebilirsin.</div>
                {TARGETS.map((t) => (
                  <div key={t.key} style={{ display: 'grid', gridTemplateColumns: '120px 1fr', gap: 10, alignItems: 'center', marginBottom: 8 }}>
                    <div style={{ fontSize: 13, fontWeight: 600 }}>{t.label}{t.key === 'fullName' && ' *'}</div>
                    {/* §3 — 0. kolonun da eşlenebilmesi için ham <select>; String(idx)
                        ile karşılaştırılır, admin-ui Select'in `value || ''` falsy hatası yok. */}
                    <select className="adm-input adm-select"
                      value={map[t.key] == null ? '' : String(map[t.key])}
                      onChange={(e) => { const v = e.target.value; setMap((m) => ({ ...m, [t.key]: v === '' ? undefined : Number(v) })); }}>
                      <option value="">— (yok) —</option>
                      {headers.map((h, i) => <option key={i} value={String(i)}>{h || `Sütun ${i + 1}`}</option>)}
                    </select>
                  </div>
                ))}
                <div className="adm-form-grid" style={{ marginTop: 12 }}>
                  <Field label="Kaynak"><Select value={meta.source} onChange={(v) => setMeta((m) => ({ ...m, source: v }))}
                    options={SOURCES.map((s) => ({ value: s.value, label: s.label }))} /></Field>
                  <Field label="Parti etiketi" hint="Örn. Ekim hackathon listesi">
                    <Input value={meta.importBatchLabel} onChange={(v) => setMeta((m) => ({ ...m, importBatchLabel: v }))} />
                  </Field>
                </div>
                {map.whyThisOne == null && (
                  <Field label="Ortak “Neden bu kişi” *" hint="Sütun eşlenmedi — tüm partiye bu cümle yazılır. Örn. Teknofest 2026 ulaşım kategorisi finalisti.">
                    <Input value={meta.commonWhy} onChange={(v) => setMeta((m) => ({ ...m, commonWhy: v }))} />
                  </Field>
                )}
              </div>
            )}

            {step === 3 && grid && (
              <div className="hub-wz__step">
                <div className="hub-wz__kicker">ADIM 3/3</div>
                <div className="hub-wz__q hub-wz__q--tight">Önizle ve onayla</div>
                <div className="hub-wz__sub">
                  {take.filter(Boolean).length} / {body.length} satır alınacak
                  {dups.filter(Boolean).length > 0 ? ` · ${dups.filter(Boolean).length} olası tekrar` : ''}.
                </div>
                <div style={{ maxHeight: 300, overflowY: 'auto', border: '1px solid #F0EADE', borderRadius: 10 }}>
                  <table className="adm-table">
                    <thead><tr><th></th><th>Ad</th><th>Link</th><th>Neden bu kişi</th><th>Tekrar</th></tr></thead>
                    <tbody>
                      {body.map((r, i) => {
                        const val = (k) => (map[k] != null ? String(r[map[k]] || '').trim() : '');
                        const dup = dups[i];
                        return (
                          <tr key={i} style={{ opacity: take[i] ? 1 : 0.4 }}>
                            <td><input type="checkbox" checked={!!take[i]} onChange={(e) => setTake((t) => t.map((x, j) => (j === i ? e.target.checked : x)))} /></td>
                            <td>{val('fullName') || <em style={{ color: '#A29D94' }}>isimsiz</em>}</td>
                            <td style={{ fontSize: 12 }}>{val('link')}</td>
                            <td style={{ fontSize: 12 }}>{val('whyThisOne')}</td>
                            <td style={{ fontSize: 12 }}>
                              {dup ? (
                                <div title={dup.reason}>
                                  <span className="hub-pill hub-pill--flag" style={{ marginRight: 4 }}>
                                    {dup.certain ? 'tekrar' : 'olası'}
                                  </span>
                                  <select className="adm-input adm-select adm-input--sm" value={modes[i] || 'new'}
                                    onChange={(e) => setModes((m) => m.map((x, j) => (j === i ? e.target.value : x)))}>
                                    <option value="update">mevcudu güncelle</option>
                                    <option value="new">yeni kayıt</option>
                                    <option value="skip">atla</option>
                                  </select>
                                </div>
                              ) : <span style={{ color: '#A29D94' }}>—</span>}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </div>

          {err && <div className="hub-wz__err">{err}</div>}

          <div className="hub-wz__foot">
            {step > 1 && <button className="hub-wz__back" onClick={() => setStep(step - 1)} disabled={busy}>← Geri</button>}
            {step === 1 && <button className="hub-wz__next" disabled>İleri →</button>}
            {step === 2 && <button className="hub-wz__next" onClick={goPreview}>İleri →</button>}
            {step === 3 && (
              <button className="hub-wz__next" onClick={commit} disabled={busy || take.every((x) => !x)}>
                {busy ? 'Ekleniyor…' : `${take.filter(Boolean).length} adayı ekle`}
              </button>
            )}
          </div>
        </>)}
      </div>
    </div>
  );
}
