// contract-render.test.mjs — sözleşme metni doldurma + gönderim kilidi (0060).
// Test kütüphanesi yok — düz node. Çalıştır: node src/lib/contract-render.test.mjs
import assert from 'node:assert/strict';
import {
  contractKindFor, contractTerms, contractVars, renderContract, unknownFields,
  recipientLock, contractInviteMail, istanbulDate,
} from './contract-render.js';

let pass = 0;
const t = (name, fn) => {
  try { fn(); pass++; console.log('  ok  ' + name); }
  catch (e) { console.log('  X   ' + name + '\n      ' + e.message); process.exitCode = 1; }
};

const seatLead = { title: 'Team Lead', seatKind: 'lead' };
const seatMem = { title: 'Mobil geliştirici', seatKind: 'member_standard' };
const gLead = { holderName: 'Ayşe Demir', holderEmail: 'Ayse@X.com', grantPct: 23.333, schedule: 'lead_hybrid', vestMonths: 36, cliffMonths: 6, milestoneBonusPct: 5 };
const gMem = { holderName: 'Mert Kaya', holderEmail: 'mert@x.com', grantPct: 10, schedule: 'time', vestMonths: 12, cliffMonths: 6, milestoneBonusPct: 0 };
const TEST = { testMode: true, testEmails: ['starthub.community@gmail.com', 'ka2003em@gmail.com'] };

t('metin türü: lider koltuğu → kurucu, diğerleri → üye', () => {
  assert.equal(contractKindFor(seatLead, gLead), 'founder');
  assert.equal(contractKindFor(seatMem, gMem), 'member');
  assert.equal(contractKindFor({ seatKind: 'mentor' }, { schedule: 'time' }), 'member');
});

t('özet ve doldurma: yüzde virgüllü, lider için 4 kilometre taşı, taraflar adlarla', () => {
  const terms = contractTerms({ grant: gLead, seat: seatLead, projectName: 'EventHub', weeklyHours: 8 });
  assert.equal(terms.holderEmail, 'ayse@x.com');
  assert.equal(terms.milestones.length, 4);
  const txt = renderContract('{ad} · %{pay} · {sure}/{bekleme} · {saat} · {kilometre_taslari} · {taraflar}', contractVars(terms, ['Kadir Kuş', 'Talha']));
  assert.ok(txt.startsWith('Ayşe Demir · %23,333 · 36/6 · haftada ~8 saat'));
  assert.ok(txt.includes('+5 puan'));
  assert.ok(txt.endsWith('Kadir Kuş ve Talha'));
});

t('üye metninde kilometre taşı yok, saat yoksa "belirtilmedi"', () => {
  const terms = contractTerms({ grant: gMem, seat: seatMem, projectName: 'TİD', weeklyHours: null });
  const v = contractVars(terms, []);
  assert.equal(v.kilometre_taslari, '—'); assert.equal(v.saat, 'belirtilmedi'); assert.equal(v.taraflar, 'Start-Hub kurucuları');
});

t('doldurma aynı girdide hep aynı metni üretir (parmak izi kararlı), CRLF normalize edilir', () => {
  const terms = contractTerms({ grant: gMem, seat: seatMem, projectName: 'TİD', weeklyHours: 6 });
  const a = renderContract('Satır 1\r\n{ad}', contractVars(terms));
  const b = renderContract('Satır 1\n{ad}', contractVars(terms));
  assert.equal(a, b);
});

t('bilinmeyen alan olduğu gibi kalır ve listelenir', () => {
  assert.equal(renderContract('{ad} {bilinmeyen}', { ad: 'A' }), 'A {bilinmeyen}');
  assert.deepEqual(unknownFields('{ad} {bilinmeyen} {pay}'), ['bilinmeyen']);
});

t('kilit: test modunda yalnızca test adresleri', () => {
  assert.equal(recipientLock(TEST, { isPlaceholder: false }, 'Ka2003em@gmail.com').ok, true);
  assert.equal(recipientLock(TEST, { isPlaceholder: false }, 'gercek@ornek.com').ok, false);
});
t('kilit: yer tutucu metin canlı modda bile gerçek adrese gitmez', () => {
  const live = { ...TEST, testMode: false };
  const r = recipientLock(live, { isPlaceholder: true }, 'gercek@ornek.com');
  assert.equal(r.ok, false); assert.ok(r.reason.includes('yer tutucu'));
  assert.equal(recipientLock(live, { isPlaceholder: true }, 'starthub.community@gmail.com').ok, true);
});
t('kilit: canlı mod + gerçek metin → herkese açık', () => {
  assert.equal(recipientLock({ ...TEST, testMode: false }, { isPlaceholder: false }, 'gercek@ornek.com').ok, true);
});
t('kilit: ayar okunamazsa test modu varsayılır', () => {
  assert.equal(recipientLock(null, { isPlaceholder: false }, 'gercek@ornek.com').ok, false);
});

t('mail: herkese açık bağlantı yok, Payım’a yönlendirir, "taslak"/"avukat" geçmez', () => {
  const m = contractInviteMail(contractTerms({ grant: gLead, seat: seatLead, projectName: 'EventHub', weeklyHours: 8 }));
  assert.ok(m.subject.includes('EventHub'));
  assert.ok(m.body.includes('Payım')); assert.ok(m.body.includes('onayladığın gün başlar'));
  assert.ok(!/token|\?id=|taslak|avukat/i.test(m.body));
});

t('İstanbul takvim günü (UTC 22:30 → ertesi gün)', () => {
  assert.equal(istanbulDate(new Date('2026-10-09T22:30:00Z')), '2026-10-10');
  assert.equal(istanbulDate(new Date('2026-10-09T10:00:00Z')), '2026-10-09');
});

console.log(`\n${pass} senaryo geçti${process.exitCode ? ' — BAŞARISIZ var' : ''}`);
