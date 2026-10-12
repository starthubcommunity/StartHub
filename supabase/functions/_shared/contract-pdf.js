// _shared/contract-pdf.js — kabul belgesi PDF'i (B, 0061).
// Saf: pdf-lib / fontkit dışarıdan verilir (edge'de `npm:` ile, Node testinde
// node_modules'tan) — aynı kod iki yerde de çalışır (test: contract-pdf.test.mjs).
// İçerik YALNIZCA kabul kaydından gelir: yazılan ad soyad, e-posta, zaman, IP,
// parmak izi, kayıt numarası ve text_snapshot'ın BİREBİR kopyası. Satırlar
// yalnızca sayfaya sığsın diye görsel olarak kaydırılır; karakter eklenmez/çıkarılmaz.
import { DM_SANS_REGULAR_B64, DM_SANS_BOLD_B64 } from './fonts/dm-sans.js';

export const b64ToBytes = (b64) => Uint8Array.from(atob(b64), (c) => c.charCodeAt(0));
export const fontBytes = () => ({ fontRegular: b64ToBytes(DM_SANS_REGULAR_B64), fontBold: b64ToBytes(DM_SANS_BOLD_B64) });

export function istanbulDateTimeText(d) {
  const s = new Intl.DateTimeFormat('tr-TR', {
    timeZone: 'Europe/Istanbul', day: 'numeric', month: 'long', year: 'numeric', hour: '2-digit', minute: '2-digit',
  }).format(new Date(d));
  return `${s} (İstanbul saati)`;
}

// contract_acceptances satırı (DB) + şablon başlığı → PDF girdisi
export function pdfInputFromAcceptance(acc, templateTitle) {
  return {
    title: templateTitle || 'Pay Sözü Sözleşmesi',
    version: acc.template_version,
    typedName: acc.typed_name,
    email: acc.holder_email,
    acceptedAtText: istanbulDateTimeText(acc.accepted_at),
    ip: acc.ip || '—',
    sha256: acc.text_sha256,
    acceptanceId: acc.id,
    textSnapshot: acc.text_snapshot,
  };
}

// Dönüş: { bytes, lines } — lines: sayfaya çizilen her metin satırı (test bunları denetler).
export async function buildAcceptancePdf({ PDFDocument, rgb, fontkit, fontRegular, fontBold }, a) {
  const doc = await PDFDocument.create();
  doc.registerFontkit(fontkit);
  doc.setTitle(`${a.title} — Kabul Belgesi`);
  doc.setAuthor('Start-Hub'); doc.setCreator('Start-Hub'); doc.setProducer('Start-Hub');
  const reg = await doc.embedFont(fontRegular, { subset: true });
  const bold = await doc.embedFont(fontBold, { subset: true });

  const W = 595.28, H = 841.89, M = 56, LH = 14.5, SIZE = 10.5;
  const maxW = W - 2 * M;
  const ink = rgb(0.11, 0.098, 0.09), dim = rgb(0.47, 0.44, 0.42), red = rgb(0.86, 0.15, 0.15);
  const pages = [], lines = [];
  let page, y;
  const newPage = () => { page = doc.addPage([W, H]); pages.push(page); y = H - M; };
  newPage();
  const need = (h) => { if (y - h < M + 24) newPage(); };

  // Kelime kaydırma; sığmayan tek kelime karakter karakter bölünür.
  const wrap = (line, font, size) => {
    if (line === '') return [''];
    const out = []; let cur = '';
    for (const word of line.split(/(\s+)/)) {
      const tryLine = cur + word;
      if (font.widthOfTextAtSize(tryLine, size) <= maxW) { cur = tryLine; continue; }
      if (cur.trim()) { out.push(cur.replace(/\s+$/, '')); cur = word.replace(/^\s+/, ''); }
      while (font.widthOfTextAtSize(cur, size) > maxW) {
        let i = cur.length; while (i > 1 && font.widthOfTextAtSize(cur.slice(0, i), size) > maxW) i--;
        out.push(cur.slice(0, i)); cur = cur.slice(i);
      }
    }
    out.push(cur);
    return out;
  };
  const text = (s, { font = reg, size = SIZE, color = ink, lh = LH } = {}) => {
    for (const ln of wrap(String(s), font, size)) {
      need(lh);
      if (ln) page.drawText(ln, { x: M, y: y - size, size, font, color });
      lines.push(ln); y -= lh;
    }
  };

  text('START-HUB', { font: bold, size: 9, color: red, lh: 14 });
  text(`${a.title} — Kabul Belgesi`, { font: bold, size: 16, lh: 22 });
  text(`Sürüm v${a.version}`, { size: 9.5, color: dim, lh: 16 });
  y -= 6;
  const rows = [
    ['Onaylayan (yazılan ad soyad)', a.typedName],
    ['E-posta', a.email],
    ['Onay zamanı', a.acceptedAtText],
    ['Onay', '“Okudum, kabul ediyorum” kutusu işaretlendi'],
    ['IP adresi', a.ip || '—'],
    ['Metnin parmak izi (SHA-256)', a.sha256],
    ['Kayıt numarası', a.acceptanceId],
  ];
  for (const [k, v] of rows) { text(k, { font: bold, size: 9, color: dim, lh: 12 }); text(v, { size: 10, lh: 15 }); y -= 2; }
  y -= 8; need(20);
  page.drawLine({ start: { x: M, y }, end: { x: W - M, y }, thickness: 0.6, color: rgb(0.85, 0.82, 0.77) });
  y -= 16;
  text('Onaylanan metin (kayıttaki kopyanın aynısı)', { font: bold, size: 9, color: dim, lh: 16 });
  for (const line of String(a.textSnapshot).replace(/\r\n/g, '\n').split('\n')) text(line);

  const n = pages.length;
  pages.forEach((p, i) => {
    const foot = `Sayfa ${i + 1}/${n} · SHA-256 ${String(a.sha256).slice(0, 16)}… · Kayıt ${a.acceptanceId}`;
    p.drawText(foot, { x: M, y: M - 22, size: 8, font: reg, color: dim });
    lines.push(foot);
  });
  return { bytes: await doc.save(), lines };
}
