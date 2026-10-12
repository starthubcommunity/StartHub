// contract-pdf.test.mjs — kabul belgesi PDF'i + teslim kuralları (B, 0061).
// Düz node. Çalıştır: node src/lib/contract-pdf.test.mjs
// İsteğe bağlı: TEST_PDF_OUT=yol → üretilen örnek PDF'i diske yazar (göz kontrolü için).
import assert from 'node:assert/strict';
import fs from 'node:fs';
import crypto from 'node:crypto';
import { PDFDocument, rgb } from 'pdf-lib';
import fontkit from '@pdf-lib/fontkit';
import { buildAcceptancePdf, fontBytes, pdfInputFromAcceptance, istanbulDateTimeText } from '../../supabase/functions/_shared/contract-pdf.js';
import {
  contractTerms, contractVars, renderContract, forbiddenWordsIn, cofounderMailRecipients,
  acceptedHolderMail, acceptedCofounderMail, pdfDownloadDecision, pdfFileName,
} from './contract-render.js';

let pass = 0;
const tests = [];
const t = (name, fn) => tests.push([name, fn]);
const sha = (b) => crypto.createHash('sha256').update(b).digest('hex');
const deps = { PDFDocument, rgb, fontkit, ...fontBytes() };

// Canlıdaki v1 metinleri: 0060 migration'ındaki $t$…$t$ gövdeleri (kopyası değil, dosyanın kendisi).
const mig = fs.readFileSync(new URL('../../supabase/migrations/0060_equity_contracts.sql', import.meta.url), 'utf8');
const V1 = [...mig.matchAll(/\$t\$([\s\S]*?)\$t\$/g)].map((m) => m[1]);
const TR = 'ğĞşŞıIiİöÖüÜçÇ';

const termsLead = contractTerms({ grant: { holderName: 'Ğülşen Işıl Çağlayan-Öztürk', holderEmail: 'ornek@ornek.com', grantPct: 23.333, schedule: 'lead_hybrid', vestMonths: 36, cliffMonths: 6, milestoneBonusPct: 5 }, seat: { title: 'Team Lead (TEST)' }, projectName: 'EventHub', weeklyHours: 10 });
const acc = (text) => ({
  id: '7c9e6679-7425-40de-944b-e07fc1f90ae7', template_version: 1, typed_name: 'Ğülşen Işıl Çağlayan-Öztürk',
  holder_email: 'ornek@ornek.com', accepted_at: '2026-10-12T11:05:00Z', ip: '88.230.12.4',
  text_sha256: sha(text), text_snapshot: text,
});

t('font: tüm Türkçe harflerin glifi var (normal + kalın)', () => {
  for (const bytes of [deps.fontRegular, deps.fontBold]) {
    const f = fontkit.create(bytes);
    for (const ch of TR) assert.ok(f.hasGlyphForCodePoint(ch.codePointAt(0)), `glif yok: ${ch}`);
  }
});

t('migration 0060 iki v1 metni içeriyor (kurucu + üye)', () => { assert.equal(V1.length, 2); });

for (const [i, body] of V1.entries()) {
  t(`PDF (v1 ${i ? 'üye' : 'kurucu'}): "taslak"/"avukat" geçmiyor; %PDF; metin birebir`, async () => {
    const text = renderContract(body, contractVars(termsLead, ['Kadir Kuş', 'Talha']));
    const { bytes, lines } = await buildAcceptancePdf(deps, pdfInputFromAcceptance(acc(text), 'Pay Sözü Sözleşmesi'));
    assert.equal(Buffer.from(bytes.slice(0, 5)).toString(), '%PDF-');
    assert.ok(bytes.length < 2 * 1024 * 1024, 'bucket sınırı 2 MB');
    assert.deepEqual(forbiddenWordsIn(lines.join('\n')), [], 'PDF metninde yasak kelime');
    // Kaydırma karakter eklemez/çıkarmaz: boşluklar dışında metin aynen çizildi.
    const start = lines.indexOf('Onaylanan metin (kayıttaki kopyanın aynısı)') + 1;
    const drawn = lines.slice(start, lines.findIndex((l) => l.startsWith('Sayfa 1/'))).join('');
    assert.equal(drawn.replace(/\s+/g, ''), text.replace(/\s+/g, ''));
    // Türkçe harfler çizilen satırlarda olduğu gibi duruyor.
    assert.ok(lines.some((l) => l.includes('Ğülşen Işıl Çağlayan-Öztürk')));
    assert.ok(lines.some((l) => l.includes(acc(text).text_sha256)));
    if (process.env.TEST_PDF_OUT && i === 0) fs.writeFileSync(process.env.TEST_PDF_OUT, bytes);
  });
}

t('PDF: sabit etiketlerde (metin boşken bile) "taslak"/"avukat" yok', async () => {
  const { lines } = await buildAcceptancePdf(deps, pdfInputFromAcceptance(acc('x'), 'Kurucu (Team Lead) Pay Sözü Sözleşmesi'));
  assert.deepEqual(forbiddenWordsIn(lines.join('\n')), []);
});

t('yasak kelime denetimi Türkçe büyük harfi de yakalar', () => {
  assert.deepEqual(forbiddenWordsIn('BU BİR TASLAKTIR'), ['taslak']);
  assert.deepEqual(forbiddenWordsIn('Avukat incelemesi'), ['avukat']);
  assert.deepEqual(forbiddenWordsIn('Sözleşme metni'), []);
});

t('uzun metin birden çok sayfaya bölünür, her sayfada altbilgi', async () => {
  const text = 'çağdaş güçlü işçi ölçü üzüm '.repeat(600);
  const { bytes, lines } = await buildAcceptancePdf(deps, pdfInputFromAcceptance(acc(text), 'T'));
  const pdf = await PDFDocument.load(bytes);
  const n = pdf.getPageCount();
  assert.ok(n >= 2);
  assert.equal(lines.filter((l) => /^Sayfa \d+\/\d+ · SHA-256/.test(l)).length, n);
});

t('onay zamanı İstanbul saatiyle', () => {
  assert.equal(istanbulDateTimeText('2026-10-12T11:05:00Z'), '12 Ekim 2026 14:05 (İstanbul saati)');
});

t('mailler: kişiye ekli bilgi maili, cofounder maili; yasak kelime yok', () => {
  const ctx = { typedName: 'Ğülşen Işıl', acceptedAtText: '12 Ekim 2026 14:05 (İstanbul saati)', startDate: '2026-10-12', version: 1 };
  const h = acceptedHolderMail(termsLead, ctx);
  const c = acceptedCofounderMail(termsLead, ctx);
  assert.ok(h.subject.includes('EventHub') && h.body.includes('ekinde'));
  assert.ok(c.body.includes('Pay Sözleri') && c.body.includes('%23,333'));
  assert.deepEqual(forbiddenWordsIn(h.subject + h.body + c.subject + c.body), []);
  assert.equal(pdfFileName('TİD Çevirici', 2), 'StartHub-Pay-Sozu-tid-cevirici-v2.pdf');
});

t('cofounder alıcıları: test modunda YALNIZCA test adresleri', () => {
  const s = { testMode: true, testEmails: ['starthub.community@gmail.com', 'ka2003em@gmail.com'] };
  assert.deepEqual(cofounderMailRecipients(s, ['kadirks2003@gmail.com', 'talha@starthub-community.com']), ['starthub.community@gmail.com', 'ka2003em@gmail.com']);
});
t('cofounder alıcıları: canlıda HR kayıtlarından (sabit adres yok), tekrar/boş elenir', () => {
  const s = { testMode: false, testEmails: ['starthub.community@gmail.com'] };
  assert.deepEqual(cofounderMailRecipients(s, ['Kadirks2003@gmail.com', 'talha@starthub-community.com', 'kadirks2003@gmail.com', '', null]), ['kadirks2003@gmail.com', 'talha@starthub-community.com']);
  assert.deepEqual(cofounderMailRecipients(s, []), []);
});

t('PDF indirme: parmak izi aynıysa izin, dosya değiştiyse "değiştirilmiş olabilir" + olay', async () => {
  const { bytes } = await buildAcceptancePdf(deps, pdfInputFromAcceptance(acc('metin'), 'T'));
  const doc = { pdf_sha256: sha(bytes), storage_path: 'a/b.pdf' };
  assert.deepEqual(pdfDownloadDecision(doc, sha(bytes)), { ok: true });
  const changed = Buffer.from(bytes); changed[changed.length - 10] ^= 1;   // tek bit değişti
  const d = pdfDownloadDecision(doc, sha(changed));
  assert.equal(d.ok, false); assert.equal(d.reason, 'tampered'); assert.equal(d.logEvent, true);
  assert.ok(d.message.includes('değiştirilmiş olabilir'));
});
t('PDF indirme: kayıt yok / dosya yok', () => {
  assert.equal(pdfDownloadDecision(null, null).reason, 'missing');
  const f = pdfDownloadDecision({ pdf_sha256: 'a'.repeat(64) }, null);
  assert.equal(f.reason, 'file_missing'); assert.equal(f.logEvent, true);
});

for (const [name, fn] of tests) {
  try { await fn(); pass++; console.log('  ok  ' + name); }
  catch (e) { console.log('  X   ' + name + '\n      ' + e.message); process.exitCode = 1; }
}
console.log(`\n${pass} senaryo geçti${process.exitCode ? ' — BAŞARISIZ var' : ''}`);
