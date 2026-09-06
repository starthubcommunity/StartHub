// hub-rules.test.mjs — kural motoru senaryoları (HUB_SPEC v2).
// Test kütüphanesi yok — düz node. Çalıştır: node src/hub/hub-rules.test.mjs
import assert from 'node:assert/strict';
import {
  canAdvance, thresholdMet, thresholdText, presentGate, roleStatusAfterReject,
  inheritedTrack, isStale, gateStatus, gateDueAt, canDraftAI, rubricComplete,
  candidateVisible, nextAction, undoPlan,
} from './hub-rules.js';
import { stageReachCounts, stageConversion, sourceFunnel, active90, intervalToDays } from './hub-metrics.js';
import { parsePastedText, findDuplicate } from './hub-parse.js';
import { applyFilters, chipPredicate, countActiveFilters } from './hub-filter.js';
import { matchScore, suggestRolesFor } from './hub-match.js';
import { computeEnrichment, prescoreFinishing, whyThisOne } from './hub-enrich.js';

let pass = 0;
const t = (name, fn) => {
  try { fn(); pass++; console.log('  ok  ' + name); }
  catch (e) { console.log('  X   ' + name + '\n      ' + e.message); process.exitCode = 1; }
};

const DAY = 86400000;
const ago = (d) => new Date(Date.now() - d * DAY).toISOString();
const cand = (o = {}) => ({ stage: 'contact', redFlags: [], ...o });

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

// ── canAdvance: SIRA zorunluluğu (v2 §2) ──────────────────────────
// pool → contact → interview → trial → member
const iv = (o = {}) => cand({ stage: 'interview', ...o });   // trial'in bir önceki aşaması

t('KRİTİK: pool\'daki aday, puanlar eşiği geçse bile DOĞRUDAN trial YAPILAMAZ', () => {
  const c = cand({ stage: 'pool', scoreFinishing: 5, scoreCommunication: 5, scoreCapacity: 5 });
  const r = canAdvance(c, 'trial');
  assert.equal(r.ok, false);
  assert.match(r.reason, /atlanamaz/);
});
t('pool→trial: cofounder ama override yoksa yine reddedilir', () => {
  const c = cand({ stage: 'pool', scoreFinishing: 5, scoreCommunication: 5, scoreCapacity: 5 });
  assert.equal(canAdvance(c, 'trial', { role: 'cofounder' }).ok, false);
});
t('pool→trial: cofounder + override → atlama serbest (hedef koşulu da sağlanınca)', () => {
  const c = cand({ stage: 'pool', scoreFinishing: 5, scoreCommunication: 5, scoreCapacity: 5, overrideReason: 'zaman baskısı, kurucu kararı' });
  assert.equal(canAdvance(c, 'trial', { role: 'cofounder' }).ok, true);
});
t('ileri tek adım serbest (contact→interview)', () => {
  assert.equal(canAdvance(cand({ stage: 'contact', scoreFinishing: 3, scoreCommunication: 3, scoreCapacity: 3 }), 'interview').ok, true);
});
t('geri gitmek serbest (trial→pool, interview→contact)', () => {
  assert.equal(canAdvance(cand({ stage: 'trial' }), 'pool').ok, true);
  assert.equal(canAdvance(cand({ stage: 'interview' }), 'contact').ok, true);
});
t('aynı aşamaya "geçiş" → ok', () => {
  assert.equal(canAdvance(cand({ stage: 'contact' }), 'contact').ok, true);
});

// ── canAdvance: trial (bir önceki aşamadan, sıra sağlanmış) ────────
t('5-5-1 aday trial OLAMAZ (eşik)', () => {
  const r = canAdvance(iv({ scoreFinishing: 5, scoreCommunication: 5, scoreCapacity: 1 }), 'trial');
  assert.equal(r.ok, false);
  assert.match(r.reason, /Eşik/);
});
t('5-5-5 aday trial OLABİLİR', () => {
  assert.equal(canAdvance(iv({ scoreFinishing: 5, scoreCommunication: 5, scoreCapacity: 5 }), 'trial').ok, true);
});
t('v3: kırmızı bayrak kilidi YOK — eşiği geçen aday bayrak alanı ne olursa olsun trial OLABİLİR', () => {
  // redFlags kolonu düşmedi ama artık hiçbir kontrol onu okumuyor.
  const c = iv({ scoreFinishing: 5, scoreCommunication: 4, scoreCapacity: 4, redFlags: ['blame', 'no_terms'] });
  assert.equal(canAdvance(c, 'trial', { role: 'recruiter' }).ok, true);
});

// ── İKİ HAT (v2 §2.3, §0) ────────────────────────────────────────
const SC = { scoreFinishing: 4, scoreCommunication: 2, scoreCapacity: 4 };
t('aynı puan tablosu: ÜYE hattında eşik geçer, KURUCU hattında geçmez', () => {
  assert.equal(thresholdMet({ track: 'member', ...SC }), true);
  assert.equal(thresholdMet({ track: 'founder', ...SC }), false);
});
t('üye hattı: iletişim yalnızca rol needs_communication ise zorunlu', () => {
  assert.equal(thresholdMet({ track: 'member', ...SC }, { needsCommunication: true }), false);
  assert.equal(thresholdMet({ track: 'member', ...SC, scoreCommunication: 3 }, { needsCommunication: true }), true);
});
t('üye hattı: TRIAL için bitirmişlik+kapasite yeter; kurucu hattı üç eksen ister', () => {
  const m = cand({ track: 'member', stage: 'interview', scoreFinishing: 3, scoreCapacity: 3 });
  assert.equal(canAdvance(m, 'trial').ok, true);
  const r = canAdvance(cand({ track: 'founder', stage: 'interview', scoreFinishing: 3, scoreCapacity: 3 }), 'trial');
  assert.equal(r.ok, false);
  assert.match(r.reason, /[Rr]ubrik/);
});
t('presentGate: role bağlı + eşik (v3: bayrak kontrolü yok)', () => {
  assert.equal(presentGate({ track: 'member', ...SC }, null).ok, false);
  assert.equal(presentGate({ track: 'member', ...SC }, { needsCommunication: false }).ok, true);
  assert.equal(presentGate({ track: 'founder', ...SC }, { needsCommunication: false }).ok, false);
  // eskiden 2 bayrak sunumu engellerdi — v3'te engellemez
  assert.equal(presentGate({ track: 'member', ...SC, redFlags: ['a', 'b'] }, { needsCommunication: false }).ok, true);
});
t('thresholdText hat bazında okunur', () => {
  assert.match(thresholdText('founder'), /toplam ≥ 10/);
  assert.match(thresholdText('member'), /bitirmişlik ≥ 3 ve kapasite ≥ 3/);
  assert.match(thresholdText('member', { needsCommunication: true }), /iletişim ≥ 3/);
});
t('aday hattı rolden miras: üye rolüne bağlanınca member track', () => {
  const memberRole = { id: 'r1', track: 'member', status: 'sourcing' };
  assert.equal(inheritedTrack(memberRole, 'founder'), 'member');
  assert.equal(inheritedTrack(null, 'member'), 'member');
  assert.equal(inheritedTrack(undefined, 'founder'), 'founder');
  assert.equal(inheritedTrack({ track: 'founder' }, 'member'), 'founder');
});

// ── Ret asılı bırakılmaz ────────────────────────────────────────
t('tek adaylı rolde ret → sourcing\'e döner', () => {
  const role = { id: 'r1', status: 'shortlist' };
  const cands = [{ id: 'c1', openRoleId: 'r1', ownerDecision: 'pending' }];
  assert.equal(roleStatusAfterReject(role, cands, 'c1'), 'sourcing');
});
t('iki adaylı rolde biri reddedilince rol shortlist\'te kalır', () => {
  const role = { id: 'r1', status: 'shortlist' };
  const cands = [
    { id: 'c1', openRoleId: 'r1', ownerDecision: 'pending' },
    { id: 'c2', openRoleId: 'r1', ownerDecision: 'pending' },
  ];
  assert.equal(roleStatusAfterReject(role, cands, 'c1'), 'shortlist');
});
t('roleStatusAfterReject: shortlist dışında dokunmaz', () => {
  assert.equal(roleStatusAfterReject({ id: 'r1', status: 'sourcing' }, [], 'c1'), 'sourcing');
  assert.equal(roleStatusAfterReject({ id: 'r1', status: 'filled' }, [], 'c1'), 'filled');
});

// ── canAdvance: hedef koşulları / archived ───────────────────────
t('§2: rubrik GİRİŞTE aranmaz — puansız aday da contact→interview GEÇER', () => {
  assert.equal(canAdvance(cand({ stage: 'contact', scoreFinishing: 3 }), 'interview').ok, true);
  assert.equal(canAdvance(cand({ stage: 'contact' }), 'interview').ok, true);
});
t('puansız aday interview→trial GEÇEMEZ, mesaj rubriği işaret eder', () => {
  const r = canAdvance(cand({ stage: 'interview' }), 'trial');
  assert.equal(r.ok, false);
  assert.match(r.reason, /Rubrik doldurulmadan/);
});
t('temas kaydı yokken contact OLAMAZ', () => {
  assert.equal(canAdvance(cand({ stage: 'pool' }), 'contact').ok, false);
});
t('lastContactAt varsa contact OLABİLİR', () => {
  assert.equal(canAdvance(cand({ stage: 'pool', lastContactAt: ago(1) }), 'contact').ok, true);
});
t('touchCount:1 ctx ile contact OLABİLİR', () => {
  assert.equal(canAdvance(cand({ stage: 'pool' }), 'contact', { touchCount: 1 }).ok, true);
});
t('sebepsiz arşivleme REDDEDİLİR', () => {
  const r = canAdvance(cand({ stage: 'contact' }), 'archived');
  assert.equal(r.ok, false);
  assert.match(r.reason, /sebebi zorunlu/i);
});
t('archive_reason dolu → arşivleme kabul', () => {
  assert.equal(canAdvance(cand({ stage: 'contact', archiveReason: 'no_reply' }), 'archived').ok, true);
});
t('member gibi kısıtsız hedef her zaman ok (kapı kartı sürer)', () => {
  assert.equal(canAdvance(cand({ stage: 'trial' }), 'member').ok, true);
});

// ── isStale (v2 §12) ────────────────────────────────────────────
t('contact, son temas 3 gün önce → bayat değil', () => {
  assert.deepEqual(isStale(cand({ stage: 'contact', lastContactAt: ago(3) })), { stale: false, level: null, days: 3 });
});
t('contact, son temas 8 gün önce → warn', () => {
  const r = isStale(cand({ stage: 'contact', lastContactAt: ago(8) }));
  assert.equal(r.stale, true); assert.equal(r.level, 'warn');
});
t('contact, son temas 15 gün önce → critical', () => {
  assert.equal(isStale(cand({ stage: 'contact', lastContactAt: ago(15) })).level, 'critical');
});
t('contact: temas 8 gün önce ama updatedAt bugün → yine de BAYAT (updatedAt referans DEĞİL)', () => {
  const c = cand({ stage: 'contact', lastContactAt: ago(8), updatedAt: ago(0), stageChangedAt: ago(8) });
  const r = isStale(c);
  assert.equal(r.stale, true);
  assert.equal(r.level, 'warn');
  assert.equal(r.days, 8);
});
t('interview: sayaç stageChangedAt\'ten (6 gün → warn, eşik 5)', () => {
  assert.equal(isStale(cand({ stage: 'interview', stageChangedAt: ago(6), lastContactAt: ago(1) })).level, 'warn');
});
t('interview: lastContactAt taze olsa da stageChangedAt bayatsa BAYAT', () => {
  assert.equal(isStale(cand({ stage: 'interview', stageChangedAt: ago(12), lastContactAt: ago(0) })).level, 'critical');
});
t('trial: stageChangedAt 11 gün → critical (eşik 5/10)', () => {
  assert.equal(isStale(cand({ stage: 'trial', stageChangedAt: ago(11) })).level, 'critical');
});
t('pool / member / archived → bayatlama uygulanmaz', () => {
  for (const stage of ['pool', 'member', 'archived']) {
    assert.deepEqual(isStale(cand({ stage, stageChangedAt: ago(90), lastContactAt: ago(90) })), { stale: false, level: null, days: 0 });
  }
});

// ── gateStatus + gateDueAt (v2 §2.1–2.2) ────────────────────────
t('vade gelecekte → running', () => {
  assert.equal(gateStatus({ dueAt: new Date(Date.now() + 2 * DAY).toISOString() }), 'running');
});
t('vade 2 saat önce geçti → due', () => {
  assert.equal(gateStatus({ dueAt: new Date(Date.now() - 2 * 3600000).toISOString() }), 'due');
});
t('vade 3 gün önce geçti → overdue', () => {
  assert.equal(gateStatus({ dueAt: ago(3) }), 'overdue');
});
t('gateDueAt: taban vade + extendedDays', () => {
  const base = new Date('2026-01-01T00:00:00Z').getTime();
  assert.equal(gateDueAt({ dueAt: '2026-01-01T00:00:00Z', extendedDays: 3 }), base + 3 * DAY);
  assert.equal(gateDueAt({ dueAt: '2026-01-01T00:00:00Z' }), base);
  assert.equal(gateDueAt({}), null);
});
t('gateStatus: uzatma running\'e çevirir', () => {
  // vade 2 gün önceydi ama +7 gün uzatıldı → hâlâ running
  assert.equal(gateStatus({ dueAt: ago(2), extendedDays: 7 }), 'running');
});

// ── canDraftAI (v2 §7) ──────────────────────────────────────────
t('canDraftAI: somut veri yoksa false', () => {
  assert.equal(canDraftAI({ fullName: 'Ada' }), false);
  assert.equal(canDraftAI({ sourceDetail: '', whyThisOne: '', evidence: [] }), false);
});
t('canDraftAI: kaynak detayı / neden bu kişi / kanıt varsa true', () => {
  assert.equal(canDraftAI({ sourceDetail: 'Teknofest 2025 finalisti' }), true);
  assert.equal(canDraftAI({ whyThisOne: 'tid-ceviri projesini tek başına bitirmiş' }), true);
  assert.equal(canDraftAI({ evidence: [{ type: 'repo', url: 'https://github.com/x/y' }] }), true);
});

// ── nextAction: türetilen sonraki adım (PROMPT_V3 A7) ───────────
t('nextAction: Havuz → mesaj at', () => {
  assert.equal(nextAction({ id: 'c1', stage: 'pool' }).key, 'message');
});
t('nextAction: Temas + cevap yok → takip et', () => {
  const touches = [{ candidateId: 'c1', sentAt: ago(1), outcome: 'pending' }];
  assert.equal(nextAction({ id: 'c1', stage: 'contact' }, touches).key, 'follow_up');
});
t('nextAction: Temas + cevap var → görüşme ayarla', () => {
  const touches = [
    { candidateId: 'c1', sentAt: ago(3), outcome: 'pending' },
    { candidateId: 'c1', sentAt: ago(1), outcome: 'replied' },
  ];
  assert.equal(nextAction({ id: 'c1', stage: 'contact' }, touches).key, 'schedule_interview');
});
t('nextAction: Görüşme + puan eksik → görüş; puan tam → karar ver', () => {
  assert.equal(nextAction({ id: 'c1', stage: 'interview', scoreFinishing: 4 }).key, 'interview');
  assert.equal(nextAction({ id: 'c1', stage: 'interview', scoreFinishing: 4, scoreCommunication: 4, scoreCapacity: 4 }).key, 'decide');
});
t('nextAction: Deneme + kapı yok → kapı başlat; kapı sürüyor → sonucu bekle', () => {
  assert.equal(nextAction({ id: 'c1', stage: 'trial' }, [], []).key, 'start_gate');
  const gates = [{ candidateId: 'c1', result: 'pending' }];
  assert.equal(nextAction({ id: 'c1', stage: 'trial' }, [], gates).key, 'await_result');
});
t('nextAction: Ekipte / arşiv → null', () => {
  assert.equal(nextAction({ id: 'c1', stage: 'member' }), null);
  assert.equal(nextAction({ id: 'c1', stage: 'archived' }), null);
});

// ── undoPlan: geri alma hedefi (Blok A düzeltmeleri 2-3) ────────
const log = (o) => ({ candidateId: 'c1', createdAt: o.at, fromStage: o.f, toStage: o.t, reason: o.r ?? null });

t('undoPlan: Deneme kartı → Görüşme (arşiv DEĞİL)', () => {
  const rows = [
    log({ at: ago(5), f: 'pool', t: 'contact' }),
    log({ at: ago(3), f: 'contact', t: 'interview' }),
    log({ at: ago(1), f: 'interview', t: 'trial', r: 'görüşme geçti' }),
  ];
  const p = undoPlan({ id: 'c1', stage: 'trial' }, rows);
  assert.equal(p.toStage, 'interview');
  assert.equal(p.label, 'Görüşme');
  assert.equal(p.affectsMany, false);
});

t('undoPlan: extendGate\'in trial→trial satırı hedefi bozmaz', () => {
  const rows = [
    log({ at: ago(3), f: 'interview', t: 'trial', r: 'görüşme geçti' }),
    log({ at: ago(1), f: 'trial', t: 'trial', r: 'Kapı A süresi +3 gün uzatıldı' }),
  ];
  assert.equal(undoPlan({ id: 'c1', stage: 'trial' }, rows).toStage, 'interview');
});

t('undoPlan: arşivden geri alınmış Deneme kartında BUTON YOK (yeniden arşivleme değil)', () => {
  const rows = [
    log({ at: ago(3), f: 'trial', t: 'archived', r: 'arşivlendi' }),
    log({ at: ago(1), f: 'archived', t: 'trial', r: 'geri alındı' }),
  ];
  assert.equal(undoPlan({ id: 'c1', stage: 'trial' }, rows), null);
});

t('undoPlan: arşiv kartı → arşivlendiği aşamaya döner', () => {
  const rows = [
    log({ at: ago(3), f: 'interview', t: 'trial', r: 'görüşme geçti' }),
    log({ at: ago(1), f: 'trial', t: 'archived', r: 'arşivlendi' }),
  ];
  const p = undoPlan({ id: 'c1', stage: 'archived' }, rows);
  assert.equal(p.toStage, 'trial');
});

t('undoPlan: Ekipte kartı → Deneme, affectsMany=true', () => {
  const rows = [
    log({ at: ago(3), f: 'interview', t: 'trial', r: 'görüşme geçti' }),
    log({ at: ago(1), f: 'trial', t: 'member', r: 'hak ediş başlangıcı' }),
  ];
  const p = undoPlan({ id: 'c1', stage: 'member' }, rows);
  assert.equal(p.toStage, 'trial');
  assert.equal(p.affectsMany, true);
});

t('undoPlan: son geçiş adayın şu anki aşamasıyla uyuşmuyorsa null', () => {
  const rows = [log({ at: ago(1), f: 'interview', t: 'trial', r: 'görüşme geçti' })];
  assert.equal(undoPlan({ id: 'c1', stage: 'interview' }, rows), null);
});

t('undoPlan: hiç gerçek geçiş yoksa null', () => {
  assert.equal(undoPlan({ id: 'c1', stage: 'pool' }, []), null);
  assert.equal(undoPlan({ id: 'c1', stage: 'pool' }, [log({ at: ago(1), f: null, t: 'pool' })]), null);
});

// ── hub-filter: hazır çipler + applyFilters (PROMPT_V3 B1-B2) ───
const fcands = [
  { id: 'p1', stage: 'pool', ownerId: 'm1', source: 'hackathon' },
  { id: 'p2', stage: 'pool', ownerId: 'm2', source: 'referral' },
  { id: 'k1', stage: 'contact', ownerId: 'm1', source: 'hackathon' },
  { id: 'i1', stage: 'interview', ownerId: 'm2', scoreFinishing: 4, scoreCommunication: 4, scoreCapacity: 4 },
  { id: 'a1', stage: 'archived', ownerId: 'm1', archiveReason: 'no_reply' },
];
const ftouches = {
  k1: [{ candidateId: 'k1', outcome: 'pending', sentAt: ago(2) }],
  p1: [{ candidateId: 'p1', outcome: 'pending', sentAt: ago(1) }],   // pool ama mesaj atılmış
};
const fctx = { currentMemberId: 'm1', touchesByCand: ftouches, now: Date.now() };

t('applyFilters: archived HER ZAMAN elenir (B1)', () => {
  assert.equal(applyFilters(fcands, {}, fctx).some((c) => c.id === 'a1'), false);
  assert.equal(applyFilters(fcands, {}, fctx).length, 4);
});
t('çip "mine": ownerId === currentMember', () => {
  const r = applyFilters(fcands, { chip: 'mine' }, fctx).map((c) => c.id);
  assert.deepEqual(r.sort(), ['k1', 'p1']);
});
t('çip "no_message": Havuz + hiç touch yok', () => {
  const r = applyFilters(fcands, { chip: 'no_message' }, fctx).map((c) => c.id);
  assert.deepEqual(r, ['p2']);   // p1 pool ama mesajı var
});
t('çip "awaiting_reply": Temas + son touch pending', () => {
  assert.deepEqual(applyFilters(fcands, { chip: 'awaiting_reply' }, fctx).map((c) => c.id), ['k1']);
});
t('çip "awaiting_decision": Görüşme + rubrik tam', () => {
  assert.deepEqual(applyFilters(fcands, { chip: 'awaiting_decision' }, fctx).map((c) => c.id), ['i1']);
});
t('applyFilters: stage + source dropdown kesişimi', () => {
  const r = applyFilters(fcands, { stage: ['pool'], source: ['hackathon'] }, fctx).map((c) => c.id);
  assert.deepEqual(r, ['p1']);
});
t('applyFilters: q araması ad/okul/kaynak-detayı', () => {
  const cs = [{ id: 'x', stage: 'pool', fullName: 'Ada Yılmaz', sourceDetail: 'Teknofest 2026' }];
  assert.equal(applyFilters(cs, { q: 'teknofest' }, {}).length, 1);
  assert.equal(applyFilters(cs, { q: 'ODTÜ' }, {}).length, 0);
});
t('countActiveFilters: çip + dropdown + arama sayılır', () => {
  assert.equal(countActiveFilters({ chip: 'mine', stage: ['pool'], q: 'x' }), 3);
  assert.equal(countActiveFilters({}), 0);
});

// ── candidateVisible: §10.2 aday okuma kapsamı ──────────────────
t('project_owner: kendisine SUNULMAMIŞ adayı GÖREMİYOR', () => {
  assert.equal(candidateVisible({ presentedAt: null, startupId: 7 }, { readAll: false, myStartupIds: [7] }), false);
});
t('project_owner: sunulmuş ama BAŞKA projenin adayını göremiyor', () => {
  assert.equal(candidateVisible({ presentedAt: ago(1), startupId: 9 }, { readAll: false, myStartupIds: [7] }), false);
});
t('project_owner: sunulmuş VE kendi projesindeki adayı görüyor', () => {
  assert.equal(candidateVisible({ presentedAt: ago(1), startupId: 7 }, { readAll: false, myStartupIds: [7, 12] }), true);
});
t('cofounder/recruiter (read_all): sunulmamış adayı bile görür', () => {
  assert.equal(candidateVisible({ presentedAt: null, startupId: null }, { readAll: true }), true);
});

// ── Dönüşüm oranı — hub_stage_log'dan, arşiv paydadan çıkmaz ─────
t('3 interview, 2 archived, 1 trial → görüşme→deneme %33', () => {
  const log = [];
  for (const id of ['a', 'b', 'c']) log.push(
    { candidateId: id, toStage: 'contact' }, { candidateId: id, toStage: 'interview' });
  log.push({ candidateId: 'a', toStage: 'archived' }, { candidateId: 'b', toStage: 'archived' });
  log.push({ candidateId: 'c', toStage: 'trial' });
  const counts = stageReachCounts(log);
  assert.equal(counts.interview, 3, 'arşivlenenler paydada kalmalı');
  assert.equal(counts.trial, 1);
  assert.equal(stageConversion(log).trial, 33);
});
t('atlanan aşama da "ulaşılmış" sayılır (pool→interview doğrudan)', () => {
  const c = stageReachCounts([{ candidateId: 'x', toStage: 'interview' }]);
  assert.equal(c.contact, 1);
  assert.equal(c.interview, 1);
  assert.equal(c.trial, 0);
});
t('boş log → tüm sayımlar 0, oranlar null', () => {
  assert.equal(stageReachCounts([]).interview, 0);
  assert.equal(stageConversion([]).trial, null);
});
t('sourceFunnel: kaynak bazında "hiç ulaşmış" sayımı', () => {
  const cands = [{ id: 'a', source: 'github' }, { id: 'b', source: 'github' }, { id: 'c', source: 'hackathon' }];
  const log = [
    { candidateId: 'a', toStage: 'contact' }, { candidateId: 'a', toStage: 'interview' },
    { candidateId: 'b', toStage: 'contact' },
    { candidateId: 'c', toStage: 'contact' }, { candidateId: 'c', toStage: 'interview' },
  ];
  const f = sourceFunnel(cands, log);
  assert.equal(f.github.pool, 2);
  assert.equal(f.github.contact, 2);
  assert.equal(f.github.interview, 1);
  assert.equal(f.hackathon.interview, 1);
});
t('active90: 90 günü dolmamışsa rate null', () => {
  const cands = [{ id: 'x', stage: 'member' }];
  const log = [{ candidateId: 'x', toStage: 'member', createdAt: new Date().toISOString() }];
  assert.equal(active90(cands, log).rate, null);
});
t('active90: 100 gün önce member + 1 hâlâ member → %50', () => {
  const old = new Date(Date.now() - 100 * DAY).toISOString();
  const cands = [{ id: 'x', stage: 'member' }, { id: 'y', stage: 'archived' }];
  const log = [
    { candidateId: 'x', toStage: 'member', createdAt: old },
    { candidateId: 'y', toStage: 'member', createdAt: old },
  ];
  const r = active90(cands, log);
  assert.equal(r.eligible, 2);
  assert.equal(r.active, 1);
  assert.equal(r.rate, 50);
});
t('intervalToDays', () => {
  assert.equal(intervalToDays('7 days'), 7);
  assert.equal(intervalToDays('14 days 00:00:00'), 14);
  assert.equal(intervalToDays('1 mon'), 30);
  assert.equal(intervalToDays(null), 7);
});

// ── Yapıştır-ayrıştır / eşleştirme / zenginleştirme (v2-dışı modüller,
//    hâlâ derleniyor ve testleri geçiyor — Ön koşul: silinmez) ────
t('40 satırlık hackathon metni → 40 satıra ayrılıyor', () => {
  const F = ['Ada', 'Mert', 'Elif', 'Can', 'Zeynep', 'Kaan', 'Naz', 'Efe', 'Deniz', 'Ece'];
  const L = ['Yılmaz', 'Kaya', 'Demir', 'Çelik'];
  const HACK = Array.from({ length: 40 }, (_, i) => {
    const n = i + 1;
    const name = `${F[i % 10]} ${L[Math.floor(i / 10)]}`;
    if (i % 3 === 0) return `${n}. Takim${n} - Proje${n} - ${name}, github.com/kul${n} (İTÜ)`;
    if (i % 3 === 1) return `${n}. ${name} - kul${n}@ornek.com - Boğaziçi Üniversitesi`;
    return `${n}. ${name} - linkedin.com/in/kul${n}`;
  }).join('\n');
  assert.equal(parsePastedText(HACK).rows.length, 40);
});
t('metinde olmayan alan BOŞ kalır (uydurulmuyor)', () => {
  const { rows } = parsePastedText('Ada Yılmaz - Boğaziçi Üniversitesi\nAli Veli - linkedin.com/in/aliveli');
  assert.equal(rows[1].university, '');
  assert.equal(rows[1].email, '');
});
t('D1: adı çıkarılamayan satır _unparsed + _take varsayılan KAPALI', () => {
  const { rows } = parsePastedText('Ada Yılmaz — github.com/ada\n#### başlık satırı ####\n2024 sonuçları');
  const named = rows.find((r) => r.fullName === 'Ada Yılmaz');
  assert.equal(named._take, true);
  const junk = rows.filter((r) => !r.fullName);
  assert.ok(junk.length >= 1);
  assert.ok(junk.every((r) => r._unparsed === true && r._take === false));
});
t('findDuplicate: github / e-posta eşleşmesi', () => {
  const { rows } = parsePastedText('Ada Yılmaz - ada@ornek.com - github.com/ada');
  const existing = [{ id: 'e1', fullName: 'X', github: 'https://github.com/ada', email: null, linkedin: null }];
  assert.equal(findDuplicate(rows[0], existing)?.id, 'e1');
});
t('matchScore: role_type + beceri örtüşmesi', () => {
  const role = { roleType: 'technical', skills: ['React', 'SQL'], track: 'member', status: 'sourcing' };
  const strong = { roleType: 'technical', skills: ['react', 'sql', 'go'], track: 'member' };
  const weak = { roleType: 'business', skills: ['excel'], track: 'founder' };
  assert.ok(matchScore(strong, role) > matchScore(weak, role));
  assert.deepEqual(suggestRolesFor(strong, [role]).map((x) => x.role), [role]);
});
t('prescoreFinishing: yalnızca bitirmişlik', () => {
  const mkRepo = (o = {}) => ({ owner: { login: 'ada' }, fork: false, language: 'TypeScript', stargazers_count: 0, description: '', homepage: '', has_pages: false, pushed_at: ago(10), created_at: ago(300), html_url: `https://github.com/ada/${o.name || 'x'}`, name: o.name || 'x', full_name: `ada/${o.name || 'x'}`, ...o });
  const repos = [mkRepo({ name: 'canli', stargazers_count: 40, homepage: 'https://c.app' }), mkRepo({ name: 'lib', stargazers_count: 9 })];
  const e = computeEnrichment({ user: { login: 'ada', name: 'Ada' }, repos });
  const p = prescoreFinishing(e, repos, {});
  assert.equal(p.score, 5);
  assert.ok(!('communication' in e) && !('capacity' in e));
});
t('"neden bu kişi": somut esere atıf, sıfat yok', () => {
  const mkRepo = (o = {}) => ({ owner: { login: 'ada' }, fork: false, language: 'TS', stargazers_count: 340, description: '', homepage: 'https://demo', has_pages: false, pushed_at: ago(21), created_at: ago(300), html_url: 'https://github.com/ada/tid-ceviri', name: 'tid-ceviri', full_name: 'ada/tid-ceviri', ...o });
  const w = whyThisOne([mkRepo()], {});
  assert.ok(w.includes('tid-ceviri'));
  assert.doesNotMatch(w, /yetenekli|başarılı|harika|etkileyici/i);
});

console.log(`\n${pass} senaryo geçti${process.exitCode ? ' — BAŞARISIZ var' : ''}`);
