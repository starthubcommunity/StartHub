// gate-templates.test.mjs — Kapı A şablon yardımcıları (0053).
// Çalıştır: node src/hub/gate-templates.test.mjs
import assert from 'node:assert/strict';
import { gateCategoryFor, templatesFor, composeGateTask, validateGateTemplate } from './gate-templates.js';

let pass = 0;
const t = (name, fn) => {
  try { fn(); pass++; console.log('  ok  ' + name); }
  catch (e) { console.log('  X   ' + name + '\n      ' + e.message); process.exitCode = 1; }
};

const T = [
  { id: 'm2', category: 'mobile', title: 'B görevi', description: 'b', durationHours: 72, deliveryType: 'link', sortOrder: 2, active: true },
  { id: 'm1', category: 'mobile', title: 'A görevi', description: 'a', durationHours: 72, deliveryType: 'link', sortOrder: 1, active: true },
  { id: 'mx', category: 'mobile', title: 'Pasif', description: 'x', durationHours: 72, deliveryType: 'link', sortOrder: 0, active: false },
  { id: 'o1', category: 'other', title: 'Genel', description: 'g', durationHours: 72, deliveryType: 'file', sortOrder: 1, active: true },
  { id: 'f1', category: 'founder', title: 'Plan', description: 'p', durationHours: 72, deliveryType: 'file', sortOrder: 1, active: true },
];

t('kurucu hattı → founder kategorisi', () => assert.equal(gateCategoryFor({ track: 'founder', interest: 'mobile' }), 'founder'));
t('üye → ilgi alanı; bilinmeyen/boş → other', () => {
  assert.equal(gateCategoryFor({ track: 'member', interest: 'mobile' }), 'mobile');
  assert.equal(gateCategoryFor({ track: 'member', interest: 'dev' }), 'other');
  assert.equal(gateCategoryFor({}), 'other');
});
t('kategori listesi: pasif gizli, sıraya göre (önerilen = ilk)', () => {
  assert.deepEqual(templatesFor(T, 'mobile').map((x) => x.id), ['m1', 'm2']);
});
t('kategoride şablon yoksa Diğer\'e düşer', () => assert.deepEqual(templatesFor(T, 'design').map((x) => x.id), ['o1']));
t('görev metni: başlık + (override edilmiş) açıklama + teslim türü', () => {
  assert.equal(composeGateTask(T[1]), 'A görevi\n\na\n\nTeslim türü: Bağlantı');
  assert.equal(composeGateTask(T[1], 'özel'), 'A görevi\n\nözel\n\nTeslim türü: Bağlantı');
});
t('doğrulama: süre 1-14 gün, alanlar zorunlu', () => {
  assert.equal(validateGateTemplate(T[1]).length, 0);
  assert.ok(validateGateTemplate({ ...T[1], durationHours: 12 }).length > 0);
  assert.ok(validateGateTemplate({ ...T[1], title: ' ' }).length > 0);
});

console.log(`\n${pass} senaryo geçti${process.exitCode ? ' — BAŞARISIZ var' : ''}`);
