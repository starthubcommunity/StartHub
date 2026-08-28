// hub-rules.test.mjs — kural motoru senaryoları.
// Test kütüphanesi yok — düz node. Çalıştır: node src/hub/hub-rules.test.mjs
import assert from 'node:assert/strict';
import { canAdvance, thresholdMet, isStale, gateStatus, rubricComplete } from './hub-rules.js';
import { stageReachCounts, stageConversion } from './hub-metrics.js';
import { parsePastedText, findDuplicate } from './hub-parse.js';
import { computeEnrichment, prescoreFinishing, whyThisOne } from './hub-enrich.js';

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

// ── isStale (§9 tablosu) ──────────────────────────────────────────
t('contacted, son temas 3 gün önce → bayat değil', () => {
  assert.deepEqual(isStale(cand({ stage: 'contacted', lastContactAt: ago(3) })), { stale: false, level: null, days: 3 });
});
t('contacted, son temas 8 gün önce → warn', () => {
  const r = isStale(cand({ stage: 'contacted', lastContactAt: ago(8) }));
  assert.equal(r.stale, true); assert.equal(r.level, 'warn');
});
t('contacted, son temas 15 gün önce → critical', () => {
  assert.equal(isStale(cand({ stage: 'contacted', lastContactAt: ago(15) })).level, 'critical');
});

// GERÇEK HATA SENARYOSU: updated_at bugün olsa bile sayaç last_contact_at'ten
// işler — 6. günde etiket düzenlemek 7 günlük takibi öteleyemez.
t('contacted: temas 8 gün önce ama updatedAt bugün → yine de BAYAT', () => {
  const c = cand({ stage: 'contacted', lastContactAt: ago(8), updatedAt: ago(0), stageChangedAt: ago(8) });
  const r = isStale(c);
  assert.equal(r.stale, true, 'updated_at referans alınmamalı');
  assert.equal(r.level, 'warn');
  assert.equal(r.days, 8);
});

t('interviewed: sayaç stage_changed_at\'ten (6 gün → warn, eşik 5)', () => {
  const r = isStale(cand({ stage: 'interviewed', stageChangedAt: ago(6), lastContactAt: ago(1), updatedAt: ago(0) }));
  assert.equal(r.level, 'warn');
});
t('interviewed: last_contact_at TAZE olsa da stage_changed_at bayatsa BAYAT', () => {
  assert.equal(isStale(cand({ stage: 'interviewed', stageChangedAt: ago(12), lastContactAt: ago(0) })).level, 'critical');
});
t('replied: stage_changed_at 4 gün → warn (eşik 3)', () => {
  assert.equal(isStale(cand({ stage: 'replied', stageChangedAt: ago(4) })).level, 'warn');
});
t('finalist: stage_changed_at 11 gün → critical (eşik 5/10)', () => {
  assert.equal(isStale(cand({ stage: 'finalist', stageChangedAt: ago(11) })).level, 'critical');
});
t('pool / gate_a / joined → bayatlama uygulanmaz', () => {
  for (const stage of ['pool', 'gate_a', 'gate_b', 'joined', 'archived']) {
    assert.deepEqual(isStale(cand({ stage, stageChangedAt: ago(90), lastContactAt: ago(90) })), { stale: false, level: null, days: 0 });
  }
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

// ── Dönüşüm oranı (§8.7) — hub_stage_log'dan, arşiv paydadan çıkmaz ──
t('10 interviewed, 8 archived, 2 finalist → görüşme→finalist %20', () => {
  const log = [];
  for (let i = 1; i <= 10; i++) {
    const id = `c${i}`;
    log.push(
      { candidateId: id, toStage: 'contacted' },
      { candidateId: id, toStage: 'replied' },
      { candidateId: id, toStage: 'interviewed' },
    );
  }
  for (let i = 1; i <= 8; i++) log.push({ candidateId: `c${i}`, toStage: 'archived' });
  for (let i = 9; i <= 10; i++) log.push({ candidateId: `c${i}`, toStage: 'finalist' });

  const counts = stageReachCounts(log);
  assert.equal(counts.interviewed, 10, 'arşivlenenler paydadan çıkarılmamalı');
  assert.equal(counts.finalist, 2);

  const conv = stageConversion(log);
  assert.equal(conv.finalist, 20);        // 2 / 10
  assert.equal(conv.interviewed, 100);    // 10 / 10 (replied→interviewed hepsi)
  assert.equal(conv.pool, null);          // ilk aşamada oran yok
});
t('atlanan aşama da "ulaşılmış" sayılır (pool→interviewed doğrudan)', () => {
  const log = [{ candidateId: 'x', toStage: 'interviewed' }];
  const c = stageReachCounts(log);
  assert.equal(c.contacted, 1);
  assert.equal(c.replied, 1);
  assert.equal(c.interviewed, 1);
  assert.equal(c.finalist, 0);
});
t('boş log → tüm sayımlar 0, oranlar null', () => {
  assert.equal(stageReachCounts([]).interviewed, 0);
  assert.equal(stageConversion([]).finalist, null);
});

// ── Yapıştır-ayrıştır (§8.6.3) — alan uydurma yok ─────────────────
const F = ['Ada', 'Mert', 'Elif', 'Can', 'Zeynep', 'Kaan', 'Naz', 'Efe', 'Deniz', 'Ece'];
const L = ['Yılmaz', 'Kaya', 'Demir', 'Çelik'];
const HACK_TEXT = Array.from({ length: 40 }, (_, i) => {
  const n = i + 1;
  const name = `${F[i % 10]} ${L[Math.floor(i / 10)]}`;
  if (i % 3 === 0) return `${n}. Takim${n} - Proje${n} - ${name}, github.com/kul${n} (İTÜ)`;
  if (i % 3 === 1) return `${n}. ${name} - kul${n}@ornek.com - Boğaziçi Üniversitesi`;
  return `${n}. ${name} - linkedin.com/in/kul${n}`; // üni/e-posta YOK
}).join('\n');

t('40 satırlık hackathon metni → 40 satıra ayrılıyor', () => {
  const { rows } = parsePastedText(HACK_TEXT);
  assert.equal(rows.length, 40);
});
t('metinde olmayan üniversite/e-posta BOŞ kalıyor (uydurulmuyor)', () => {
  const { rows } = parsePastedText(HACK_TEXT);
  const noUni = rows.filter((r) => !r.university);
  assert.ok(noUni.length >= 13, `en az 13 satırda üni boş bekleniyordu, ${noUni.length} bulundu`);
  // 3. tip satırlarda ne üni ne e-posta var:
  const r3 = rows[2];
  assert.equal(r3.university, '');
  assert.equal(r3.email, '');
  assert.ok(r3.linkedin.includes('linkedin.com/in/'));
});
t('açık üni "declared", kısaltmadan çıkarım "guess"', () => {
  const { rows } = parsePastedText('Ada Yılmaz - Boğaziçi Üniversitesi\nAli Veli — (İTÜ)');
  assert.equal(rows[0].dataTrust, 'declared');
  assert.equal(rows[1].university, 'İstanbul Teknik Üniversitesi');
  assert.equal(rows[1].dataTrust, 'guess');
});
t('tekrar tespiti: aynı github + aynı e-posta + benzer ad', () => {
  const { rows } = parsePastedText(HACK_TEXT);
  assert.equal(rows[0].github, 'https://github.com/kul1');
  const existing = [
    { id: 'e1', fullName: 'Bambaşka Biri', github: 'https://github.com/kul1', email: null, linkedin: null },
    { id: 'e2', fullName: 'Yok Kimse', github: null, email: 'kul2@ornek.com', linkedin: null },
    { id: 'e3', fullName: 'Ece Çelik', github: null, email: null, linkedin: null },
  ];
  assert.equal(findDuplicate(rows[0], existing)?.id, 'e1');       // github
  assert.equal(findDuplicate(rows[1], existing)?.id, 'e2');       // e-posta
  assert.equal(findDuplicate(rows[39], existing)?.id, 'e3');      // benzer ad (Ece Çelik)
  assert.equal(findDuplicate(rows[5], existing), null);           // yeni
});
t('boş metin → boş sonuç', () => {
  assert.deepEqual(parsePastedText('   ').rows, []);
});

// ── Zenginleştirme + AI ön puanı (§8.6.5–8.6.7) ──────────────────
const daysAgo = (d) => new Date(Date.now() - d * DAY).toISOString();
const mkRepo = (o = {}) => {
  const name = o.name || 'x';
  return { owner: { login: 'ada' }, fork: false, language: 'TypeScript', stargazers_count: 0, description: '', homepage: '', has_pages: false, pushed_at: daysAgo(10), created_at: daysAgo(300), html_url: `https://github.com/ada/${name}`, name, full_name: `ada/${name}`, ...o };
};
const USER = { login: 'ada', name: 'Ada Yılmaz' };

t('6 sinyal doluyor; iki bitmiş proje → finished_projects=2', () => {
  const repos = [
    mkRepo({ name: 'canli-app', stargazers_count: 40, homepage: 'https://canli.app', language: 'TypeScript' }),
    mkRepo({ name: 'kutuphane', stargazers_count: 12, language: 'Python' }),
    mkRepo({ name: 'deneme', stargazers_count: 0, description: 'edu', language: 'JavaScript' }),
  ];
  const e = computeEnrichment({ user: USER, repos, prsToOthers: 3, orgs: [{ login: 'x' }] });
  assert.equal(e.finished_projects, 2);
  assert.equal(e.breadth, 3);
  assert.equal(e.collaboration, 4);
  assert.equal(e.solo_finisher, true);
  assert.ok(typeof e.activity_recency === 'number');
  assert.ok(typeof e.consistency === 'number');
  assert.ok(e.fetched_at);
});

t('AI ön puanı yalnızca bitirmişlik; iletişim/kapasite dokunulmaz', () => {
  const repos = [
    mkRepo({ name: 'canli-app', stargazers_count: 40, homepage: 'https://c.app' }),
    mkRepo({ name: 'lib', stargazers_count: 9 }),
  ];
  const e = computeEnrichment({ user: USER, repos });
  const p = prescoreFinishing(e, repos, {});
  assert.equal(p.score, 5);                       // ≥2 bitmiş + canlı
  assert.match(p.note, /Ön puan 5/);
  assert.ok(p.evidence.includes('canli-app'));    // dayandığı kanıt
  // enrichment/prescore iletişim veya kapasite alanı ÜRETMEZ:
  assert.ok(!('communication' in e) && !('capacity' in e));
  assert.deepEqual(Object.keys(p).sort(), ['confidence', 'evidence', 'note', 'score']);
});

t('boş / yalnızca fork → ön puan 1', () => {
  assert.equal(prescoreFinishing(computeEnrichment({ user: USER, repos: [] }), [], {}).score, 1);
  const forks = [mkRepo({ fork: true, stargazers_count: 100 })];
  assert.equal(prescoreFinishing(computeEnrichment({ user: USER, repos: forks }), forks, {}).score, 2);
});

t('"neden bu kişi": somut esere atıf, en fazla iki cümle', () => {
  const repos = [mkRepo({ name: 'tid-ceviri', stargazers_count: 340, homepage: 'https://demo', pushed_at: daysAgo(21) })];
  const w = whyThisOne(repos, {});
  assert.ok(w.includes('tid-ceviri'), 'repo adına atıf olmalı');
  assert.ok((w.match(/\./g) || []).length <= 2, 'en fazla iki cümle');
  assert.doesNotMatch(w, /yetenekli|başarılı|harika|etkileyici/i, 'sıfat kullanılmamalı');
});

console.log(`\n${pass} senaryo geçti${process.exitCode ? ' — BAŞARISIZ var' : ''}`);
