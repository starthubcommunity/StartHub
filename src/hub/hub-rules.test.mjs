// hub-rules.test.mjs — kural motoru senaryoları.
// Test kütüphanesi yok — düz node. Çalıştır: node src/hub/hub-rules.test.mjs
import assert from 'node:assert/strict';
import { canAdvance, thresholdMet, isStale, gateStatus, rubricComplete } from './hub-rules.js';

let pass = 0;
const t = (name, fn) => {
  try { fn(); pass++; console.log('  ok  ' + name); }
  catch (e) { console.log('  X   ' + name + '\n      ' + e.message); process.exitCode = 1; }
};

const DAY = 86400000;
const ago = (d) => new Date(Date.now() - d * DAY).toISOString();
const cand = (o = {}) => ({ stage: 'replied', redFlags: [], ...o });

// ── thresholdMet ────────────────────────────────────────────────────
t('5-5-1: eşik sağlanmıyor (bir eksen ≤ 2)', () => {
  assert.equal(thresholdMet(cand({ scoreFinishing: 5, scoreCommunication: 5, scoreCapacity: 1 })), false);
});
t('5-5-5: eşik sağlanıyor', () => {
  assert.equal(thresholdMet(cand({ scoreFinishing: 5, scoreCommunication: 5, scoreCapacity: 5 })), true);
});
t('4-3-3: toplam tam 10, min eksen 3 → sağlanıyor', () => {
  assert.equal(thresholdMet(cand({ scoreFinishing: 4, scoreCommunication: 3, scoreCapacity: 3 })), true);
});
t('4-4-2: toplam 10 ama bir eksen 2 → sağlanmıyor', () => {
  assert.equal(thresholdMet(cand({ scoreFinishing: 4, scoreCommunication: 4, scoreCapacity: 2 })), false);
});
t('rubrik eksik → sağlanmıyor', () => {
  assert.equal(thresholdMet(cand({ scoreFinishing: 5, scoreCommunication: 5 })), false);
  assert.equal(rubricComplete(cand({ scoreFinishing: 5, scoreCommunication: 5 })), false);
});

// ── canAdvance: finalist ────────────────────────────────────────────
t('5-5-1 aday finalist OLAMAZ', () => {
  const r = canAdvance(cand({ scoreFinishing: 5, scoreCommunication: 5, scoreCapacity: 1 }), 'finalist');
  assert.equal(r.ok, false);
  assert.match(r.reason, /Eşik/);
});
t('5-5-5, bayraksız aday finalist OLABİLİR', () => {
  assert.equal(canAdvance(cand({ scoreFinishing: 5, scoreCommunication: 5, scoreCapacity: 5 }), 'finalist').ok, true);
});
t('2 bayraklı aday, eşik tamam, recruiter → finalist OLAMAZ', () => {
  const c = cand({ scoreFinishing: 5, scoreCommunication: 4, scoreCapacity: 4, redFlags: ['blame', 'no_i'] });
  const r = canAdvance(c, 'finalist', { role: 'recruiter' });
  assert.equal(r.ok, false);
  assert.match(r.reason, /kırmızı bayrak/);
});
t('2 bayraklı aday, cofounder + override_reason → finalist OLABİLİR', () => {
  const c = cand({ scoreFinishing: 5, scoreCommunication: 4, scoreCapacity: 4, redFlags: ['blame', 'no_i'], overrideReason: 'Kurucu ekibinde ikinci kişi zaten bu riski dengeliyor.' });
  assert.equal(canAdvance(c, 'finalist', { role: 'cofounder' }).ok, true);
});
t('2 bayraklı aday, cofounder ama override_reason BOŞ → finalist OLAMAZ', () => {
  const c = cand({ scoreFinishing: 5, scoreCommunication: 4, scoreCapacity: 4, redFlags: ['blame', 'no_i'], overrideReason: '   ' });
  assert.equal(canAdvance(c, 'finalist', { role: 'cofounder' }).ok, false);
});
t('1 bayrak eşiği bozmaz', () => {
  const c = cand({ scoreFinishing: 5, scoreCommunication: 4, scoreCapacity: 4, redFlags: ['blame'] });
  assert.equal(canAdvance(c, 'finalist', { role: 'recruiter' }).ok, true);
});

// ── canAdvance: interviewed / contacted / gates / archived ─────────
t('rubrik dolmadan görüşme aşamasına geçilemez', () => {
  const r = canAdvance(cand({ scoreFinishing: 3 }), 'interviewed');
  assert.equal(r.ok, false);
  assert.match(r.reason, /[Rr]ubrik/);
});
t('rubrik dolunca görüşme aşamasına geçilebilir', () => {
  assert.equal(canAdvance(cand({ scoreFinishing: 3, scoreCommunication: 3, scoreCapacity: 3 }), 'interviewed').ok, true);
});
t('temas kaydı yokken contacted OLAMAZ', () => {
  assert.equal(canAdvance(cand({ stage: 'pool' }), 'contacted').ok, false);
});
t('lastContactAt varsa contacted OLABİLİR', () => {
  assert.equal(canAdvance(cand({ stage: 'pool', lastContactAt: ago(1) }), 'contacted').ok, true);
});
t('touchCount:1 ctx ile contacted OLABİLİR', () => {
  assert.equal(canAdvance(cand({ stage: 'pool' }), 'contacted', { touchCount: 1 }).ok, true);
});
t('Kapı A kaydı yokken gate_a OLAMAZ', () => {
  assert.equal(canAdvance(cand({ stage: 'finalist' }), 'gate_a', { gates: [] }).ok, false);
});
t('Kapı A kaydı varsa gate_a OLABİLİR', () => {
  assert.equal(canAdvance(cand({ stage: 'finalist' }), 'gate_a', { gates: [{ gate: 'A' }] }).ok, true);
});
t('sebepsiz arşivleme REDDEDİLİR', () => {
  const r = canAdvance(cand({ stage: 'contacted' }), 'archived');
  assert.equal(r.ok, false);
  assert.match(r.reason, /sebebi zorunlu/i);
});
t('archive_reason dolu → arşivleme kabul', () => {
  assert.equal(canAdvance(cand({ stage: 'contacted', archiveReason: 'no_reply' }), 'archived').ok, true);
});
t('replied gibi kısıtsız hedef her zaman ok', () => {
  assert.equal(canAdvance(cand({ stage: 'contacted' }), 'replied').ok, true);
});

// ── isStale ────────────────────────────────────────────────────────
t('contacted, 3 gün → bayat değil', () => {
  assert.deepEqual(isStale(cand({ stage: 'contacted', lastContactAt: ago(3) })), { stale: false, level: null, days: 3 });
});
t('contacted, 8 gün → warn', () => {
  const r = isStale(cand({ stage: 'contacted', lastContactAt: ago(8) }));
  assert.equal(r.stale, true); assert.equal(r.level, 'warn');
});
t('contacted, 15 gün → critical', () => {
  assert.equal(isStale(cand({ stage: 'contacted', lastContactAt: ago(15) })).level, 'critical');
});
t('interviewed, 6 gün → warn (eşik 5)', () => {
  assert.equal(isStale(cand({ stage: 'interviewed', lastContactAt: ago(6) })).level, 'warn');
});
t('pool aşaması → bayatlama tanımsız', () => {
  assert.deepEqual(isStale(cand({ stage: 'pool', lastContactAt: ago(90) })), { stale: false, level: null, days: 0 });
});

// ── gateStatus ─────────────────────────────────────────────────────
t('vade gelecekte → running', () => {
  assert.equal(gateStatus({ dueAt: new Date(Date.now() + 2 * DAY).toISOString() }), 'running');
});
t('vade 2 saat önce geçti → due', () => {
  assert.equal(gateStatus({ dueAt: new Date(Date.now() - 2 * 3600000).toISOString() }), 'due');
});
t('vade 3 gün önce geçti → overdue', () => {
  assert.equal(gateStatus({ dueAt: ago(3) }), 'overdue');
});

console.log(`\n${pass} senaryo geçti${process.exitCode ? ' — BAŞARISIZ var' : ''}`);
