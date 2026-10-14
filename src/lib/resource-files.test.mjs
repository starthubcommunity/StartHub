// resource-files.test.mjs — Ekip Paneli "Kaynaklar" PDF kuralları (C, 0062).
// Düz node. Çalıştır: node src/lib/resource-files.test.mjs
import assert from 'node:assert/strict';
import {
  cleanFileName, validateUpload, isPdfHeader, canManageResFiles, canReadResFiles, GENERAL_RES, MAX_PDF_BYTES,
} from '../../supabase/functions/_shared/resource-files.js';

let pass = 0;
const t = (name, fn) => {
  try { fn(); pass++; console.log('  ok  ' + name); }
  catch (e) { console.log('  X   ' + name + '\n      ' + e.message); process.exitCode = 1; }
};

t('dosya adı: Türkçe harfler, boşluk, tehlikeli karakter temizlenir; .pdf ile biter', () => {
  assert.equal(cleanFileName('Ürün Gereksinim Şartnamesi (v2).PDF'), 'Urun-Gereksinim-Sartnamesi-v2.pdf');
  assert.equal(cleanFileName('../../etc/passwd.pdf'), 'etcpasswd.pdf');
  assert.equal(cleanFileName('İş planı ığdır çğü.pdf'), 'Is-plani-igdir-cgu.pdf');
  assert.equal(cleanFileName('***.pdf'), 'belge.pdf');
  assert.ok(cleanFileName('a'.repeat(300) + '.pdf').length <= 80);
});
t('yükleme sınırları: yalnızca .pdf, 10 MB, ekip başına 25', () => {
  assert.equal(validateUpload({ fileName: 'a.pdf', size: 1000, readyCount: 0 }), null);
  assert.match(validateUpload({ fileName: 'a.docx', size: 1000, readyCount: 0 }), /PDF/);
  assert.match(validateUpload({ fileName: 'a.pdf', size: MAX_PDF_BYTES + 1, readyCount: 0 }), /10 MB/);
  assert.match(validateUpload({ fileName: 'a.pdf', size: 0, readyCount: 0 }), /boş/);
  assert.match(validateUpload({ fileName: 'a.pdf', size: 10, readyCount: 25 }), /25/);
  assert.equal(validateUpload({ fileName: 'a.pdf', size: 10, readyCount: 24 }), null);
});
t('PDF başlığı: "%PDF-" değilse reddedilir (uzantı/MIME yalan söyleyebilir)', () => {
  assert.equal(isPdfHeader(new TextEncoder().encode('%PDF-1.7')), true);
  assert.equal(isPdfHeader(new TextEncoder().encode('PK\u0003\u0004')), false);
  assert.equal(isPdfHeader(new TextEncoder().encode('<html>')), false);
  assert.equal(isPdfHeader(new Uint8Array(0)), false);
});
const admin = { email: 'a@x.com', role: 'admin' };
const lead = { email: 'l@x.com', role: 'member', teams: ['A'], teamRoles: { A: 'lead' } };
const member = { email: 'm@x.com', role: 'member', team: 'A' };
const other = { email: 'o@x.com', role: 'member', teams: ['B'] };
const mentor = { email: 'mt@x.com', role: 'mentor', mentorTeams: ['A'] };
const cto = { email: 'c@x.com', role: 'cto' };
t('yükleme/silme: admin her yerde, lead yalnızca kendi ekibinde, Genel yalnızca admin', () => {
  assert.equal(canManageResFiles(admin, 'A'), true);
  assert.equal(canManageResFiles(admin, GENERAL_RES), true);
  assert.equal(canManageResFiles(lead, 'A'), true);
  assert.equal(canManageResFiles(lead, 'B'), false);
  assert.equal(canManageResFiles(lead, GENERAL_RES), false);
  assert.equal(canManageResFiles(member, 'A'), false);
  assert.equal(canManageResFiles(null, 'A'), false);
});
t('indirme: ekip üyesi/mentörü kendi ekibinde, admin/cto her yerde, Genel herkes', () => {
  assert.equal(canReadResFiles(member, 'A'), true);
  assert.equal(canReadResFiles(other, 'A'), false);
  assert.equal(canReadResFiles(mentor, 'A'), true);
  assert.equal(canReadResFiles(cto, 'A'), true);
  assert.equal(canReadResFiles(other, GENERAL_RES), true);
  assert.equal(canReadResFiles(null, GENERAL_RES), false);
});

console.log(`\n${pass} senaryo geçti${process.exitCode ? ' — BAŞARISIZ var' : ''}`);
