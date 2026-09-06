// hub-parse.js — yapıştırılan metni deterministik olarak aday satırlarına
// çevirir (HUB_SPEC §8.6.3).
//
// LLM YOK: yalnızca regex + bilinen üniversite listesi. Bulunamayan alan
// YAPISAL olarak boş kalır — "AI asla alan uydurmaz" kuralı burada kod
// düzeyinde garanti. Gerçek bir LLM ayrıştırıcı sonradan parsePastedText
// yerine geçebilir; dönüş sözleşmesi (rows[]) aynı kalır.

const EMAIL_RE = /[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}/;
// http(s)://, www. VEYA çıplak "alan.uzantı/yol" (yapıştırılan listelerde yaygın)
const URL_RE = /(?:https?:\/\/|www\.)[^\s<>()]+|\b[A-Za-z0-9-]+(?:\.[A-Za-z0-9-]+)+\/[^\s<>(),]+/gi;
const GH_RE = /github\.com\/([A-Za-z0-9-]{1,39})(?:\/([A-Za-z0-9._-]+))?/i;
const LI_RE = /linkedin\.com\/(?:in|pub)\/([A-Za-z0-9%\-_.]+)/i;

// Türkçe harfleri sadeleştir (karşılaştırma için).
const strip = (s) => (s || '')
  .replace(/[İIı]/g, 'i').replace(/[Şş]/g, 's').replace(/[Ğğ]/g, 'g')
  .replace(/[Üü]/g, 'u').replace(/[Öö]/g, 'o').replace(/[Çç]/g, 'c')
  .toLowerCase().trim();

export const nameKey = (s) => strip(s).replace(/[^a-z\s]/g, ' ').replace(/\s+/g, ' ').trim();

// Kelime kümesi Jaccard benzerliği (0–1).
export function similar(a, b) {
  const A = new Set(nameKey(a).split(' ').filter(Boolean));
  const B = new Set(nameKey(b).split(' ').filter(Boolean));
  if (!A.size || !B.size) return 0;
  let inter = 0;
  for (const w of A) if (B.has(w)) inter++;
  return inter / (A.size + B.size - inter);
}

const normUrl = (u) => {
  let x = (u || '').trim().replace(/[),.;]+$/, '');
  if (/^www\./i.test(x)) x = 'https://' + x;
  return x;
};
export const ghKey = (u) => { const m = GH_RE.exec(u || ''); return m ? m[1].toLowerCase() : ''; };
export const liKey = (u) => { const m = LI_RE.exec(u || ''); return m ? m[1].toLowerCase().replace(/\/$/, '') : ''; };

// Bilinen TR üniversiteleri. Tam ad geçiyorsa 'declared'; yalnızca kısaltma
// eşleşirse 'guess' (çıkarım). Listede yoksa "… Üniversitesi" serbest kalıbı.
const UNIS = [
  { full: 'istanbul teknik', abbr: 'itu', name: 'İstanbul Teknik Üniversitesi' },
  { full: 'bogazici', abbr: 'boun', name: 'Boğaziçi Üniversitesi' },
  { full: 'orta dogu teknik', abbr: 'odtu', name: 'Orta Doğu Teknik Üniversitesi' },
  { full: 'bilkent', abbr: 'bilkent', name: 'Bilkent Üniversitesi' },
  { full: 'hacettepe', abbr: 'hacettepe', name: 'Hacettepe Üniversitesi' },
  { full: 'yildiz teknik', abbr: 'ytu', name: 'Yıldız Teknik Üniversitesi' },
  { full: 'koc universitesi', abbr: 'koc', name: 'Koç Üniversitesi' },
  { full: 'sabanci', abbr: 'sabanci', name: 'Sabancı Üniversitesi' },
  { full: 'gazi universitesi', abbr: 'gazi', name: 'Gazi Üniversitesi' },
  { full: 'ege universitesi', abbr: 'ege', name: 'Ege Üniversitesi' },
  { full: 'dokuz eylul', abbr: 'deu', name: 'Dokuz Eylül Üniversitesi' },
  { full: 'marmara universitesi', abbr: null, name: 'Marmara Üniversitesi' },
  { full: 'ankara universitesi', abbr: null, name: 'Ankara Üniversitesi' },
  { full: 'ozyegin', abbr: 'ozu', name: 'Özyeğin Üniversitesi' },
  { full: 'tobb', abbr: 'tobb', name: 'TOBB Ekonomi ve Teknoloji Üniversitesi' },
  { full: 'gebze teknik', abbr: 'gtu', name: 'Gebze Teknik Üniversitesi' },
];

function matchUniversity(recordText) {
  const s = strip(recordText).replace(/[^a-z0-9\s]/g, ' ').replace(/\s+/g, ' ');
  for (const u of UNIS) if (s.includes(u.full)) return { university: u.name, trust: 'declared' };
  for (const u of UNIS) {
    if (u.abbr && new RegExp(`(^|\\s)${u.abbr}(\\s|$)`).test(s)) return { university: u.name, trust: 'guess' };
  }
  const m = recordText.match(/([A-ZÇĞİÖŞÜ][\wÇĞİÖŞÜçğıöşü.]*(?:\s+[A-ZÇĞİÖŞÜ][\wÇĞİÖŞÜçğıöşü.]*){0,3}\s+[Üü]niversitesi)/);
  if (m) return { university: m[1].trim(), trust: 'declared' };
  return { university: null, trust: null };
}

const NAME_TOKEN = /^(?:[A-ZÇĞİÖŞÜ][a-zçğıöşü'’.]+|[A-ZÇĞİÖŞÜ]{2,})$/;

function extractName(recordText) {
  let t = recordText
    .replace(URL_RE, ' ')
    .replace(/\b[A-Za-z0-9-]+(?:\.[A-Za-z0-9-]+)+\/?\S*/g, ' ')   // çıplak alan kalıntısı
    .replace(EMAIL_RE, ' ')
    .replace(/^\s*(\d+[.)\-]|[•*\-])\s*/, '');
  const chunks = t.split(/[\n\r|·,–—\-()[\]{}:;/]+/).map((x) => x.trim()).filter(Boolean);
  for (const ch of chunks) {
    const w = ch.split(/\s+/).filter(Boolean);
    if (w.length >= 2 && w.length <= 4 && w.every((x) => NAME_TOKEN.test(x))) {
      return { fullName: w.join(' '), trust: 'declared' };
    }
  }
  for (const ch of chunks) {
    const w = ch.split(/\s+/).filter(Boolean);
    if (w.length >= 2 && w.length <= 4 &&
        w.every((x) => /^[A-Za-zÇĞİÖŞÜçğıöşü'’.]+$/.test(x)) && /[A-ZÇĞİÖŞÜ]/.test(ch[0])) {
      return { fullName: w.join(' '), trust: 'guess' };
    }
  }
  return { fullName: null, trust: null };
}

// Ham metin → aday satırları. Boş bloklarla ayrılmış 2+ blok varsa her blok
// bir kayıt; yoksa her satır bir kayıt.
export function parsePastedText(raw) {
  const text = (raw || '').replace(/\r\n/g, '\n').trim();
  if (!text) return { rows: [] };
  const blocks = text.split(/\n\s*\n+/).map((b) => b.trim()).filter(Boolean);
  const records = blocks.length >= 2 ? blocks
    : text.split(/\n+/).map((l) => l.trim()).filter(Boolean);

  const rows = records.map((rec, i) => {
    const email = (rec.match(EMAIL_RE) || [null])[0];
    const ghm = GH_RE.exec(rec);
    const lim = LI_RE.exec(rec);
    const github = ghm ? 'https://github.com/' + ghm[1].toLowerCase() : null;
    const linkedin = lim ? 'https://linkedin.com/in/' + lim[1].toLowerCase().replace(/\/$/, '') : null;
    const evidence = (rec.match(URL_RE) || [])
      .map(normUrl)
      .filter((u) => !GH_RE.test(u) && !LI_RE.test(u) && !EMAIL_RE.test(u))
      .map((u) => ({ type: 'link', url: /^https?:\/\//i.test(u) ? u : 'https://' + u, note: '' }));
    const nm = extractName(rec);
    const uni = matchUniversity(rec);
    const inferred = nm.trust === 'guess' || uni.trust === 'guess';
    const hasVerbatim = !!(email || github || linkedin || nm.trust === 'declared' || uni.trust === 'declared');
    // İsmi çıkarılamayan satır → açık 'unparsed' durumu. Ön izlemede
    // görsel olarak ayrışır ve "AL" kutusu VARSAYILAN OLARAK KAPALI olur
    // (§8.6.3 — boş satır sessizce havuza girmesin).
    const unparsed = !String(nm.fullName || '').trim();
    return {
      _id: i,
      _unparsed: unparsed,
      _take: !unparsed,
      fullName: nm.fullName || '',
      email: email || '',
      linkedin: linkedin || '',
      github: github || '',
      university: uni.university || '',
      department: '',
      evidence,
      note: rec,                       // ham kayıt — hiçbir şey kaybolmasın
      dataTrust: inferred || !hasVerbatim ? 'guess' : 'declared',
    };
  });
  return { rows };
}

// Havuzdaki mevcut adaylarla tekrar tespiti (HUB_SPEC v3 §6.2):
//   KESİN  (certain:true)  — e-posta tam eşleşme / GitHub kullanıcı adı /
//                            LinkedIn slug eşleşme
//   OLASI  (certain:false) — ad benzerliği (similar ≥ 0.8) VE aynı okul
//                            (iki tarafta da okul dolu ve normalize eşit)
// Dönüş: { id, reason, certain } | null.
export function findDuplicate(row, candidates) {
  const email = strip(row.email);
  const gh = ghKey(row.github);
  const li = liKey(row.linkedin);
  for (const c of candidates) {
    if (email && strip(c.email) === email) return { id: c.id, reason: 'aynı e-posta', certain: true };
    if (gh && ghKey(c.github) === gh) return { id: c.id, reason: 'aynı GitHub', certain: true };
    if (li && liKey(c.linkedin) === li) return { id: c.id, reason: 'aynı LinkedIn', certain: true };
  }
  const school = strip(row.university);
  if (row.fullName && school) {
    for (const c of candidates) {
      if (c.fullName && strip(c.university) === school && similar(row.fullName, c.fullName) >= 0.8) {
        return { id: c.id, reason: 'benzer ad + aynı okul', certain: false };
      }
    }
  }
  return null;
}

// Basit CSV ayrıştırıcı (tırnaklı alanları destekler).
export function parseCsv(text) {
  const rows = [];
  let row = [], field = '', q = false;
  const s = (text || '').replace(/\r\n/g, '\n');
  for (let i = 0; i < s.length; i++) {
    const ch = s[i];
    if (q) {
      if (ch === '"' && s[i + 1] === '"') { field += '"'; i++; }
      else if (ch === '"') q = false;
      else field += ch;
    } else if (ch === '"') q = true;
    else if (ch === ',') { row.push(field); field = ''; }
    else if (ch === '\n') { row.push(field); rows.push(row); row = []; field = ''; }
    else field += ch;
  }
  if (field.length || row.length) { row.push(field); rows.push(row); }
  const nonEmpty = rows.filter((r) => r.some((c) => c.trim() !== ''));
  if (!nonEmpty.length) return { headers: [], rows: [] };
  return { headers: nonEmpty[0].map((h) => h.trim()), rows: nonEmpty.slice(1) };
}
