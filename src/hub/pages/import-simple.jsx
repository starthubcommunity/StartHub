// import-simple.jsx — CSV içe aktarma (v2 §6). import.jsx'in yerine.
// 3 adım, senkron, arka plan işi yok:
//   1) Yükle  2) Kolon eşle (başlık tahmini)  3) Önizle + onayla
// Onaylanan satırlar tek seferde hub_candidates'a; hepsine aynı importBatchLabel.
//
// .csv yerel ayrıştırılır. .xlsx için: Excel'de "Farklı kaydet → CSV UTF-8".
// (SheetJS bağımlılığı eklenince .xlsx doğrudan okunabilir — bkz. PROMPT_S §7.)
import React, { useMemo, useState } from 'react';
import { AIcon, Modal, Field, Input, Select } from '../../admin/admin-ui';
import { useHubStore } from '../hub-store';
import { usePerms } from '../../lib/use-perms';
import { SOURCES } from '../hub-constants';

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
  const [meta, setMeta] = useState({ source: 'hackathon', importBatchLabel: '' });
  const [take, setTake] = useState([]);         // bool[]
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
    setErr('');
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
          fullName: val('fullName'),
          ...linkFields(val('link')),
          email: val('email') || undefined,
          whyThisOne: val('whyThisOne') || null,
          sourceDetail: val('sourceDetail') || null,
        };
      });
      const { created } = await store.importCandidates(
        { source: meta.source, importBatchLabel: meta.importBatchLabel.trim() || null },
        rows,
      );
      setDone(created.length);
    } catch (e) { setErr(e.message || 'İçe aktarılamadı.'); setBusy(false); }
  };

  if (!can('candidates.write')) return null;

  return (
    <Modal open onClose={onClose} title="CSV / Excel içe aktar" wide>
      <div className="adm-form">
        {done != null ? (
          <div style={{ textAlign: 'center', padding: '10px 0 4px' }}>
            <div style={{ fontSize: 15, fontWeight: 700, marginBottom: 8 }}>{done} aday havuza eklendi.</div>
            <button className="adm-btn adm-btn--primary" onClick={onClose}>Kapat</button>
          </div>
        ) : (<>
          <div style={{ fontSize: 12.5, color: 'var(--adm-text-dim)', marginBottom: 12 }}>Adım {step} / 3</div>

          {step === 1 && (
            <Field label="CSV dosyası seç" hint="Excel için: Farklı kaydet → CSV UTF-8">
              <input type="file" accept=".csv,text/csv" onChange={(e) => e.target.files[0] && onFile(e.target.files[0])} />
              {err && <div className="adm-form__err" style={{ marginTop: 6 }}>{err}</div>}
            </Field>
          )}

          {step === 2 && grid && (
            <>
              <div style={{ fontSize: 13, color: 'var(--adm-text-secondary)', marginBottom: 10 }}>
                {body.length} satır. Sütunları eşle — sistem tahmin etti, düzeltebilirsin.
              </div>
              {TARGETS.map((t) => (
                <div key={t.key} className="adm-form-grid adm-form-grid--2" style={{ marginBottom: 6 }}>
                  <div style={{ fontSize: 13, alignSelf: 'center' }}>{t.label}{t.key === 'fullName' && ' *'}</div>
                  <Select value={map[t.key] ?? ''} onChange={(v) => setMap((m) => ({ ...m, [t.key]: v === '' ? undefined : Number(v) }))}
                    placeholder="— (yok) —"
                    options={headers.map((h, i) => ({ value: String(i), label: h || `Sütun ${i + 1}` }))} />
                </div>
              ))}
              <div className="adm-form-grid" style={{ marginTop: 10 }}>
                <Field label="Kaynak"><Select value={meta.source} onChange={(v) => setMeta((m) => ({ ...m, source: v }))}
                  options={SOURCES.map((s) => ({ value: s.value, label: s.label }))} /></Field>
                <Field label="Parti etiketi" hint="Örn. Ekim hackathon listesi">
                  <Input value={meta.importBatchLabel} onChange={(v) => setMeta((m) => ({ ...m, importBatchLabel: v }))} />
                </Field>
              </div>
              <div className="adm-form__footer">
                {err && <span className="adm-form__err">{err}</span>}
                <button className="adm-btn adm-btn--ghost" onClick={() => setStep(1)}>Geri</button>
                <button className="adm-btn adm-btn--primary" onClick={goPreview}>İleri →</button>
              </div>
            </>
          )}

          {step === 3 && grid && (
            <>
              <div style={{ fontSize: 13, marginBottom: 8 }}>
                {take.filter(Boolean).length} / {body.length} satır alınacak.
              </div>
              <div style={{ maxHeight: 320, overflowY: 'auto', border: '1px solid var(--adm-border-light)', borderRadius: 8 }}>
                <table className="adm-table">
                  <thead><tr><th></th><th>Ad</th><th>Link</th><th>Neden bu kişi</th></tr></thead>
                  <tbody>
                    {body.map((r, i) => {
                      const val = (k) => (map[k] != null ? String(r[map[k]] || '').trim() : '');
                      return (
                        <tr key={i} style={{ opacity: take[i] ? 1 : 0.4 }}>
                          <td><input type="checkbox" checked={!!take[i]} onChange={(e) => setTake((t) => t.map((x, j) => (j === i ? e.target.checked : x)))} /></td>
                          <td>{val('fullName') || <em style={{ color: 'var(--adm-text-dim)' }}>isimsiz</em>}</td>
                          <td style={{ fontSize: 12 }}>{val('link')}</td>
                          <td style={{ fontSize: 12 }}>{val('whyThisOne')}</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
              <div className="adm-form__footer">
                {err && <span className="adm-form__err">{err}</span>}
                <button className="adm-btn adm-btn--ghost" onClick={() => setStep(2)} disabled={busy}>Geri</button>
                <button className="adm-btn adm-btn--primary" onClick={commit} disabled={busy || take.every((x) => !x)}>
                  <AIcon name="save" size={15} /> {busy ? 'Ekleniyor…' : `${take.filter(Boolean).length} adayı ekle`}
                </button>
              </div>
            </>
          )}
        </>)}
      </div>
    </Modal>
  );
}
