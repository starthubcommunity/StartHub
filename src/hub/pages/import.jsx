// import.jsx — Yetenek avı: yapıştır-ayrıştır + CSV + inbound (§8.6.2–8.6.3).
//
// EN KRİTİK KURAL: alan uydurma yok. Metinde geçmeyen alan BOŞ kalır
// (parser yapısal olarak garanti eder — hub-parse.js). Ön izleme adımı
// ATLANAMAZ; onaydan önce hiçbir şey kaydedilmez. Ham metin
// hub_import_batches.raw_text'e saklanır.
import React, { useState, useMemo, useEffect } from 'react';
import { AIcon, Field, Input, Select } from '../../admin/admin-ui';
import { supabase } from '../../lib/supabase';
import { useHubStore } from '../hub-store';
import { SOURCES, ROLE_TYPES, DATA_TRUST } from '../hub-constants';
import { parsePastedText, findDuplicate, similar, parseCsv } from '../hub-parse';

const BLANK_PARTY = { source: 'hackathon', sourceDetail: '', eventDate: '', roleType: '' };
const CELLS = [
  ['fullName', 'Ad'], ['email', 'E-posta'], ['linkedin', 'LinkedIn'],
  ['github', 'GitHub'], ['university', 'Üniversite'], ['department', 'Bölüm'],
];

// Parti içi tekrarlar + havuzla tekrar tespiti.
function annotate(rows, candidates) {
  return rows.map((r, i) => {
    // İsmi olmayan satır = ayrıştırılamadı (parser vermediyse burada da yakala,
    // ör. CSV modu). "AL" varsayılan kapalı.
    const unparsed = r._unparsed ?? !String(r.fullName || '').trim();
    let dup = findDuplicate(r, candidates);
    if (!dup) {
      for (let j = 0; j < i; j++) {
        const o = rows[j];
        if ((r.email && o.email && r.email.toLowerCase() === o.email.toLowerCase()) ||
            (r.github && o.github && r.github.toLowerCase() === o.github.toLowerCase()) ||
            (r.linkedin && o.linkedin && r.linkedin.toLowerCase() === o.linkedin.toLowerCase()) ||
            (r.fullName && o.fullName && similar(r.fullName, o.fullName) >= 0.85)) {
          dup = { reason: 'parti içinde tekrar' };
          break;
        }
      }
    }
    return { ...r, _dup: dup, _unparsed: unparsed, _take: r._take && !dup && !unparsed };
  });
}

function PreviewTable({ rows, onChange, onConfirm, confirming, note }) {
  const take = rows.filter((r) => r._take).length;
  const blanks = rows.reduce((n, r) => n + CELLS.filter(([k]) => !r[k]).length, 0);
  const set = (i, k, v) => onChange(rows.map((r, x) => (x === i ? { ...r, [k]: v } : r)));

  return (
    <div>
      <div style={{ fontSize: 13, color: 'var(--adm-text-secondary)', margin: '4px 0 10px' }}>
        {rows.length} satır · {take} alınacak · {rows.filter((r) => r._dup).length} tekrar ·{' '}
        {rows.filter((r) => r._unparsed).length} ayrıştırılamadı · {blanks} boş alan (uydurulmadı). {note}
      </div>
      <div className="hub-grid-wrap" style={{ maxHeight: '46vh' }}>
        <table className="hub-grid">
          <thead>
            <tr>
              <th className="hub-col-frozen" style={{ left: 0, width: 34 }}>al</th>
              {CELLS.map(([, label]) => <th key={label} style={{ minWidth: 150 }}>{label}</th>)}
              <th style={{ minWidth: 110 }}>Veri güveni</th>
              <th style={{ minWidth: 160 }}>Durum</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r, i) => (
              <tr key={r._id ?? i} className={r._unparsed ? 'hub-row--unparsed' : ''}>
                <td className="hub-col-frozen hub-cell__check" style={{ left: 0 }}>
                  <input type="checkbox" checked={r._take} onChange={(e) => set(i, '_take', e.target.checked)} />
                </td>
                {CELLS.map(([k]) => (
                  <td key={k}>
                    <input className="hub-cell__input" value={r[k] || ''}
                      placeholder={r[k] ? '' : '(boş)'}
                      onChange={(e) => set(i, k, e.target.value)} />
                  </td>
                ))}
                <td>
                  <select className="hub-cell__input" value={r.dataTrust || 'guess'} onChange={(e) => set(i, 'dataTrust', e.target.value)}>
                    {DATA_TRUST.map((d) => <option key={d.value} value={d.value}>{d.label}</option>)}
                  </select>
                </td>
                <td style={{ padding: '0 8px' }}>
                  {r._unparsed
                    ? <span className="hub-pill hub-pill--flag">ayrıştırılamadı</span>
                    : r._dup
                      ? <span className="hub-pill hub-pill--flag">{r._dup.reason}</span>
                      : <span style={{ color: 'var(--adm-text-dim)', fontSize: 12 }}>—</span>}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10, marginTop: 14 }}>
        <button className="adm-btn adm-btn--primary" disabled={confirming || take === 0} onClick={onConfirm}>
          {confirming ? 'Aktarılıyor…' : `Onayla — ${take} adayı havuza ekle`}
        </button>
      </div>
    </div>
  );
}

// ── Yapıştır ve ayrıştır ─────────────────────────────────────────
function PasteMode({ candidates, run }) {
  const [raw, setRaw] = useState('');
  const [party, setParty] = useState(BLANK_PARTY);
  const [rows, setRows] = useState(null);
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState(null);

  const parse = () => {
    const { rows: parsed } = parsePastedText(raw);
    setRows(annotate(parsed, candidates));
    setDone(null);
  };
  const confirm = async () => {
    setBusy(true);
    try {
      const res = await run({ method: 'paste', ...party, rawText: raw }, rows);
      setDone(`${res.created.length} aday havuza eklendi.`);
      setRows(null); setRaw('');
    } catch (e) { setDone('Hata: ' + e.message); }
    setBusy(false);
  };

  return (
    <div>
      <p style={{ fontSize: 13, color: 'var(--adm-text-dim)', marginBottom: 10 }}>
        Hackathon sonuç sayfası, demo day listesi, kulüp yönetim kurulu, ekran görüntüsünden çıkarılmış metin — fark etmez.
        Metinde <strong>olmayan</strong> alan boş kalır, uydurulmaz.
      </p>
      <textarea className="adm-input adm-textarea" rows={8} value={raw} onChange={(e) => setRaw(e.target.value)}
        placeholder={'1. Takım Adı — Proje — Ada Yılmaz, github.com/aday (İTÜ)\n2. ...'} />

      <h4 className="hub-h4">Parti bilgisi — tüm gruba uygulanır</h4>
      <div className="adm-form-grid">
        <Field label="Kaynak" required><Select value={party.source} onChange={(v) => setParty({ ...party, source: v })} options={SOURCES} /></Field>
        <Field label="Detay"><Input value={party.sourceDetail} onChange={(v) => setParty({ ...party, sourceDetail: v })} placeholder="Teknofest 2026 … finalistleri" /></Field>
        <Field label="Etkinlik tarihi"><input className="adm-input" type="date" value={party.eventDate} onChange={(e) => setParty({ ...party, eventDate: e.target.value })} /></Field>
        <Field label="Varsayılan rol tipi"><Select value={party.roleType} onChange={(v) => setParty({ ...party, roleType: v })} options={ROLE_TYPES} placeholder="—" /></Field>
      </div>

      <button className="adm-btn adm-btn--ghost" onClick={parse} disabled={!raw.trim()}>
        <AIcon name="refresh" size={14} /> Ayrıştır
      </button>

      {rows && (
        <div style={{ marginTop: 16 }}>
          <PreviewTable rows={rows} onChange={setRows} onConfirm={confirm} confirming={busy}
            note="Ön izleme atlanamaz — “Onayla”ya basana kadar hiçbir şey kaydedilmez." />
        </div>
      )}
      {done && <div className="hub-toast">{done}</div>}
    </div>
  );
}

// ── CSV içe aktar ────────────────────────────────────────────────
const CSV_FIELDS = [
  { value: '', label: '— atla —' },
  ...CELLS.map(([k, l]) => ({ value: k, label: l })),
];
const guessField = (h) => {
  const s = h.toLowerCase();
  if (/ad|isim|name/.test(s)) return 'fullName';
  if (/mail|e-posta|eposta/.test(s)) return 'email';
  if (/linkedin/.test(s)) return 'linkedin';
  if (/github/.test(s)) return 'github';
  if (/üni|univ|okul|school/.test(s)) return 'university';
  if (/böl|bölüm|department|program/.test(s)) return 'department';
  return '';
};

function CsvMode({ candidates, run }) {
  const [text, setText] = useState('');
  const [parsed, setParsed] = useState(null);
  const [map, setMap] = useState({});
  const [party, setParty] = useState(BLANK_PARTY);
  const [rows, setRows] = useState(null);
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState(null);

  const onFile = async (f) => {
    if (!f) return;
    const t = await f.text();
    setText(t);
    const p = parseCsv(t);
    setParsed(p);
    const m = {};
    p.headers.forEach((h, i) => { const g = guessField(h); if (g) m[i] = g; });
    setMap(m);
    setRows(null);
  };
  const build = () => {
    const out = parsed.rows.map((cols, i) => {
      const r = { _id: i, _take: true, fullName: '', email: '', linkedin: '', github: '', university: '', department: '', evidence: [], note: cols.join(' | '), dataTrust: 'declared' };
      Object.entries(map).forEach(([idx, field]) => { if (field) r[field] = (cols[idx] || '').trim(); });
      return r;
    }).filter((r) => r.fullName || r.email || r.linkedin || r.github);
    setRows(annotate(out, candidates));
  };
  const confirm = async () => {
    setBusy(true);
    try {
      const res = await run({ method: 'csv', ...party, rawText: text }, rows);
      setDone(`${res.created.length} aday havuza eklendi.`);
      setRows(null); setParsed(null); setText('');
    } catch (e) { setDone('Hata: ' + e.message); }
    setBusy(false);
  };

  return (
    <div>
      <input type="file" accept=".csv,text/csv" onChange={(e) => onFile(e.target.files[0])} />
      {parsed && (
        <>
          <h4 className="hub-h4">Sütun eşleme</h4>
          <div className="adm-form-grid">
            {parsed.headers.map((h, i) => (
              <Field key={i} label={h || `Sütun ${i + 1}`}>
                <select className="adm-input adm-select" value={map[i] || ''} onChange={(e) => setMap({ ...map, [i]: e.target.value })}>
                  {CSV_FIELDS.map((f) => <option key={f.value} value={f.value}>{f.label}</option>)}
                </select>
              </Field>
            ))}
          </div>
          <h4 className="hub-h4">Parti bilgisi</h4>
          <div className="adm-form-grid">
            <Field label="Kaynak" required><Select value={party.source} onChange={(v) => setParty({ ...party, source: v })} options={SOURCES} /></Field>
            <Field label="Detay"><Input value={party.sourceDetail} onChange={(v) => setParty({ ...party, sourceDetail: v })} /></Field>
            <Field label="Etkinlik tarihi"><input className="adm-input" type="date" value={party.eventDate} onChange={(e) => setParty({ ...party, eventDate: e.target.value })} /></Field>
            <Field label="Varsayılan rol tipi"><Select value={party.roleType} onChange={(v) => setParty({ ...party, roleType: v })} options={ROLE_TYPES} placeholder="—" /></Field>
          </div>
          <button className="adm-btn adm-btn--ghost" onClick={build}>Ön izleme oluştur</button>
        </>
      )}
      {rows && (
        <div style={{ marginTop: 16 }}>
          <PreviewTable rows={rows} onChange={setRows} onConfirm={confirm} confirming={busy} />
        </div>
      )}
      {done && <div className="hub-toast">{done}</div>}
    </div>
  );
}

// ── Inbound (applications) ──────────────────────────────────────
function InboundMode({ candidates, run }) {
  const [apps, setApps] = useState(null);
  const [rows, setRows] = useState(null);
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState(null);

  const importedRefs = useMemo(
    () => new Set(candidates.filter((c) => c.source === 'inbound' && c.sourceRef).map((c) => String(c.sourceRef))),
    [candidates]
  );

  useEffect(() => {
    supabase.from('applications').select('*').order('created_at', { ascending: false })
      .then(({ data }) => setApps(data || []))
      .catch(() => setApps([]));
  }, []);

  const build = () => {
    // applications SALT OKUNUR — kopyalanır, source_ref'e id yazılır.
    const out = (apps || [])
      .filter((a) => !importedRefs.has(String(a.id)))
      .map((a, i) => ({
        _id: i, _take: true,
        fullName: a.name || '', email: a.email || '', linkedin: a.linkedin || '',
        github: '', university: a.university || '', department: a.department || '',
        roleType: '', evidence: a.portfolio ? [{ type: 'link', url: a.portfolio, note: 'portfolyo' }] : [],
        note: [a.role, a.intent, a.skills].filter(Boolean).join(' · '),
        dataTrust: 'declared',        // aday kendi beyan etti
        sourceRef: String(a.id),
      }));
    setRows(annotate(out, candidates));
  };
  const confirm = async () => {
    setBusy(true);
    try {
      const res = await run({ method: 'inbound', source: 'inbound', sourceDetail: 'Site başvurusu', rawText: null }, rows);
      setDone(`${res.created.length} başvuru havuza kopyalandı.`);
      setRows(null);
    } catch (e) { setDone('Hata: ' + e.message); }
    setBusy(false);
  };

  if (apps === null) return <div style={{ color: 'var(--adm-text-dim)' }}>Başvurular yükleniyor…</div>;

  return (
    <div>
      <p style={{ fontSize: 13, color: 'var(--adm-text-dim)', marginBottom: 10 }}>
        {apps.length} başvuru · {importedRefs.size} zaten aktarılmış. <strong>applications tablosu değiştirilmez</strong> —
        kayıt kopyalanır, orijinal id <code>source_ref</code>'e yazılır.
      </p>
      <button className="adm-btn adm-btn--ghost" onClick={build}>Aktarılabilir başvuruları getir</button>
      {rows && (
        <div style={{ marginTop: 16 }}>
          {rows.length === 0
            ? <div className="adm-empty">Aktarılacak yeni başvuru yok.</div>
            : <PreviewTable rows={rows} onChange={setRows} onConfirm={confirm} confirming={busy} />}
        </div>
      )}
      {done && <div className="hub-toast">{done}</div>}
    </div>
  );
}

export default function ImportPage() {
  const { candidates, importCandidates } = useHubStore();
  const [mode, setMode] = useState('paste');

  return (
    <div>
      <div className="adm-page-head">
        <div>
          <h1 className="adm-page-head__title">Yetenek avı</h1>
          <p className="adm-page-head__desc">İnsan bulur, sistem satıra çevirir. Ön izleme adımı atlanamaz.</p>
        </div>
      </div>

      <div className="hub-filterbar" style={{ marginBottom: 16 }}>
        {[['paste', 'Yapıştır ve ayrıştır'], ['csv', 'CSV içe aktar'], ['inbound', 'Inbound (başvurular)']].map(([k, l]) => (
          <button key={k} className={`adm-chip ${mode === k ? 'adm-chip--active' : ''}`} onClick={() => setMode(k)}>{l}</button>
        ))}
      </div>

      {mode === 'paste' && <PasteMode candidates={candidates} run={importCandidates} />}
      {mode === 'csv' && <CsvMode candidates={candidates} run={importCandidates} />}
      {mode === 'inbound' && <InboundMode candidates={candidates} run={importCandidates} />}
    </div>
  );
}
