// hub-rules.test.mjs — kural motoru senaryoları.
// Test kütüphanesi yok — düz node. Çalıştır: node src/hub/hub-rules.test.mjs
import assert from 'node:assert/strict';
import { canAdvance, thresholdMet, thresholdText, presentGate, roleStatusAfterReject, inheritedTrack, isStale, gateStatus, rubricComplete } from './hub-rules.js';
import { stageReachCounts, stageConversion, sourceFunnel, active90, intervalToDays } from './hub-metrics.js';
import { parsePastedText, findDuplicate } from './hub-parse.js';
import { matchScore, suggestRolesFor } from './hub-match.js';
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

// ── canAdvance: SIRA zorunluluğu (§9) ──────────────────────────────
const iv = (o = {}) => cand({ stage: 'interviewed', ...o });   // finalist'in bir önceki aşaması

t('KRİTİK: pool\'daki aday, puanlar eşiği geçse bile DOĞRUDAN finalist YAPILAMAZ', () => {
  const c = cand({ stage: 'pool', scoreFinishing: 5, scoreCommunication: 5, scoreCapacity: 5 });
  const r = canAdvance(c, 'finalist');
  assert.equal(r.ok, false);
  assert.match(r.reason, /atlanamaz/);
});
t('pool→finalist: cofounder ama override yoksa yine reddedilir', () => {
  const c = cand({ stage: 'pool', scoreFinishing: 5, scoreCommunication: 5, scoreCapacity: 5 });
  assert.equal(canAdvance(c, 'finalist', { role: 'cofounder' }).ok, false);
});
t('pool→finalist: cofounder + override → atlama serbest (hedef koşulu da sağlanınca)', () => {
  const c = cand({ stage: 'pool', scoreFinishing: 5, scoreCommunication: 5, scoreCapacity: 5, overrideReason: 'zaman baskısı, kurucu kararı' });
  assert.equal(canAdvance(c, 'finalist', { role: 'cofounder' }).ok, true);
});
t('ileri tek adım serbest (replied→interviewed, rubrik dolu)', () => {
  assert.equal(canAdvance(cand({ stage: 'replied', scoreFinishing: 3, scoreCommunication: 3, scoreCapacity: 3 }), 'interviewed').ok, true);
});
t('geri gitmek serbest (finalist→pool, interviewed→contacted)', () => {
  assert.equal(canAdvance(cand({ stage: 'finalist' }), 'pool').ok, true);
  assert.equal(canAdvance(cand({ stage: 'interviewed' }), 'contacted').ok, true);
});
t('aynı aşamaya "geçiş" → ok', () => {
  assert.equal(canAdvance(cand({ stage: 'replied' }), 'replied').ok, true);
});

// ── canAdvance: finalist (bir önceki aşamadan, sıra sağlanmış) ──────
t('5-5-1 aday finalist OLAMAZ (eşik)', () => {
  const r = canAdvance(iv({ scoreFinishing: 5, scoreCommunication: 5, scoreCapacity: 1 }), 'finalist');
  assert.equal(r.ok, false);
  assert.match(r.reason, /Eşik/);
});
t('5-5-5, bayraksız aday finalist OLABİLİR', () => {
  assert.equal(canAdvance(iv({ scoreFinishing: 5, scoreCommunication: 5, scoreCapacity: 5 }), 'finalist').ok, true);
});
t('2 bayraklı aday, eşik tamam, recruiter → finalist OLAMAZ', () => {
  const c = iv({ scoreFinishing: 5, scoreCommunication: 4, scoreCapacity: 4, redFlags: ['blame', 'no_i'] });
  const r = canAdvance(c, 'finalist', { role: 'recruiter' });
  assert.equal(r.ok, false);
  assert.match(r.reason, /kırmızı bayrak/);
});
t('2 bayraklı aday, cofounder + override_reason → finalist OLABİLİR', () => {
  const c = iv({ scoreFinishing: 5, scoreCommunication: 4, scoreCapacity: 4, redFlags: ['blame', 'no_i'], overrideReason: 'Kurucu ekibinde ikinci kişi zaten bu riski dengeliyor.' });
  assert.equal(canAdvance(c, 'finalist', { role: 'cofounder' }).ok, true);
});
t('2 bayraklı aday, cofounder ama override_reason BOŞ → finalist OLAMAZ', () => {
  const c = iv({ scoreFinishing: 5, scoreCommunication: 4, scoreCapacity: 4, redFlags: ['blame', 'no_i'], overrideReason: '   ' });
  assert.equal(canAdvance(c, 'finalist', { role: 'cofounder' }).ok, false);
});
t('1 bayrak eşiği bozmaz', () => {
  const c = iv({ scoreFinishing: 5, scoreCommunication: 4, scoreCapacity: 4, redFlags: ['blame'] });
  assert.equal(canAdvance(c, 'finalist', { role: 'recruiter' }).ok, true);
});

// ── İKİ HAT (§12.1) ───────────────────────────────────────────────
// 4-2-4: kurucu hattında min eksen 2 → geçmez; üye hattında bitirmişlik 4
// ve kapasite 4 → geçer (iletişim serbest).
const SC = { scoreFinishing: 4, scoreCommunication: 2, scoreCapacity: 4 };
t('aynı puan tablosu: ÜYE hattında eşik geçer, KURUCU hattında geçmez', () => {
  assert.equal(thresholdMet({ track: 'member', ...SC }), true);
  assert.equal(thresholdMet({ track: 'founder', ...SC }), false);
});
t('üye hattı: iletişim yalnızca rol needs_communication ise zorunlu', () => {
  assert.equal(thresholdMet({ track: 'member', ...SC }, { needsCommunication: true }), false);   // comm 2 < 3
  assert.equal(thresholdMet({ track: 'member', ...SC, scoreCommunication: 3 }, { needsCommunication: true }), true);
});
t('üye hattı: FİNALİST için bitirmişlik+kapasite yeter; kurucu hattı üç eksen ister', () => {
  const m = cand({ track: 'member', stage: 'interviewed', scoreFinishing: 3, scoreCapacity: 3 });
  assert.equal(canAdvance(m, 'finalist').ok, true);   // iletişim boş — üye hattında sorun değil
  const r = canAdvance(cand({ track: 'founder', stage: 'interviewed', scoreFinishing: 3, scoreCapacity: 3 }), 'finalist');
  assert.equal(r.ok, false);
  assert.match(r.reason, /[Rr]ubrik/);               // "eşik" değil, "rubrik" der
});
t('üye hattında Kapı B İSTENMEZ (gate_a → joined tek adım)', () => {
  const r = canAdvance(cand({ track: 'member', stage: 'gate_a' }), 'gate_b');
  assert.equal(r.ok, false);
  assert.match(r.reason, /Kapı B yok/);
  // gate_a → joined üye hattında bitişik, "atlama" değil:
  assert.equal(canAdvance(cand({ track: 'member', stage: 'gate_a' }), 'joined').ok, true);
  // kurucu hattında gate_a → joined 2 adım → reddedilir:
  const rf = canAdvance(cand({ track: 'founder', stage: 'gate_a' }), 'joined');
  assert.equal(rf.ok, false);
  assert.match(rf.reason, /atlanamaz/);
});
t('presentGate: role bağlı + eşik + bayrak<2', () => {
  assert.equal(presentGate({ track: 'member', ...SC, redFlags: [] }, null).ok, false);                    // role yok
  assert.equal(presentGate({ track: 'member', ...SC, redFlags: [] }, { needsCommunication: false }).ok, true);
  assert.equal(presentGate({ track: 'founder', ...SC, redFlags: [] }, { needsCommunication: false }).ok, false); // kurucu eşiği
  assert.equal(presentGate({ track: 'member', ...SC, redFlags: ['a', 'b'] }, { needsCommunication: false }).ok, false);
});
t('thresholdText hat bazında okunur', () => {
  assert.match(thresholdText('founder'), /toplam ≥ 10/);
  assert.match(thresholdText('member'), /bitirmişlik ≥ 3 ve kapasite ≥ 3/);
  assert.match(thresholdText('member', { needsCommunication: true }), /iletişim ≥ 3/);
});
t('§12.1 aday hattı rolden miras: üye rolüne bağlanınca member track + gate_b istenmez', () => {
  const memberRole = { id: 'r1', track: 'member', status: 'sourcing' };
  const track = inheritedTrack(memberRole, 'founder');   // varsayılan founder'dan gelir
  assert.equal(track, 'member');
  const c = cand({ track, openRoleId: 'r1', stage: 'gate_a' });
  assert.equal(canAdvance(c, 'gate_b').ok, false);        // üye hattında Kapı B yok
  assert.match(canAdvance(c, 'gate_b').reason, /Kapı B yok/);
  assert.equal(canAdvance(c, 'joined').ok, true);          // gate_a → joined bitişik
  assert.equal(thresholdMet({ track, scoreFinishing: 3, scoreCapacity: 3 }), true);  // iki eksen yeter
});
t('§12.1 rol bağı kaldırılınca track korunur (geri alma yok)', () => {
  assert.equal(inheritedTrack(null, 'member'), 'member');
  assert.equal(inheritedTrack(undefined, 'founder'), 'founder');
  assert.equal(inheritedTrack({ track: 'founder' }, 'member'), 'founder');  // rol varsa rolden
});

t('§12.3 ret asılı bırakılmaz: tek adaylı rolde ret → sourcing\'e döner', () => {
  const role = { id: 'r1', status: 'shortlist' };
  const cands = [{ id: 'c1', openRoleId: 'r1', ownerDecision: 'pending' }];
  assert.equal(roleStatusAfterReject(role, cands, 'c1'), 'sourcing');
});
t('§12.3: iki adaylı rolde biri reddedilince rol shortlist\'te kalır', () => {
  const role = { id: 'r1', status: 'shortlist' };
  const cands = [
    { id: 'c1', openRoleId: 'r1', ownerDecision: 'pending' },
    { id: 'c2', openRoleId: 'r1', ownerDecision: 'pending' },
  ];
  assert.equal(roleStatusAfterReject(role, cands, 'c1'), 'shortlist');   // c2 hâlâ pending
});
t('roleStatusAfterReject: shortlist dışında dokunmaz', () => {
  assert.equal(roleStatusAfterReject({ id: 'r1', status: 'sourcing' }, [], 'c1'), 'sourcing');
  assert.equal(roleStatusAfterReject({ id: 'r1', status: 'filled' }, [], 'c1'), 'filled');
});

t('matchScore: role_type + beceri örtüşmesi + hat uyumu (§12.4)', () => {
  const role = { roleType: 'technical', skills: ['React', 'SQL'], track: 'member', status: 'sourcing' };
  const strong = { roleType: 'technical', skills: ['react', 'sql', 'go'], track: 'member' };
  const weak = { roleType: 'business', skills: ['excel'], track: 'founder' };
  assert.ok(matchScore(strong, role) > matchScore(weak, role));
  assert.equal(matchScore(weak, role), 0);
  assert.deepEqual(suggestRolesFor(strong, [role]).map((x) => x.role), [role]);
});

// ── canAdvance: interviewed / contacted / gates / archived ─────────
t('§2.2: rubrik GİRİŞTE aranmaz — puansız aday da replied→interviewed GEÇER', () => {
  assert.equal(canAdvance(cand({ stage: 'replied', scoreFinishing: 3 }), 'interviewed').ok, true);
  assert.equal(canAdvance(cand({ stage: 'replied' }), 'interviewed').ok, true);   // hiç puan yok
});
t('KABUL: puansız aday interviewed→finalist GEÇEMEZ, mesaj rubriği işaret eder', () => {
  const r = canAdvance(cand({ stage: 'interviewed' }), 'finalist');
  assert.equal(r.ok, false);
  assert.match(r.reason, /Rubrik doldurulmadan finalist/);
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
t('KABUL TESTİ: 3 interviewed, 2 archived, 1 meşru finalist → görüşme→finalist %33', () => {
  const log = [];
  for (const id of ['a', 'b', 'c']) log.push(
    { candidateId: id, toStage: 'contacted' }, { candidateId: id, toStage: 'replied' }, { candidateId: id, toStage: 'interviewed' });
  log.push({ candidateId: 'a', toStage: 'archived' }, { candidateId: 'b', toStage: 'archived' });
  log.push({ candidateId: 'c', toStage: 'finalist' });
  const counts = stageReachCounts(log);
  assert.equal(counts.interviewed, 3, 'arşivlenenler paydada kalmalı');
  assert.equal(counts.finalist, 1);
  assert.equal(stageConversion(log).finalist, 33);      // 1/3
});
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
t('isimsiz satır → _unparsed:true ve "AL" varsayılan KAPALI (§8.6.3)', () => {
  const { rows } = parsePastedText('github.com/coolhacker - awesome project\nAda Yılmaz - ada@ornek.com');
  assert.equal(rows[0]._unparsed, true);
  assert.equal(rows[0]._take, false);           // sessizce havuza girmez
  assert.equal(rows[1]._unparsed, false);
  assert.equal(rows[1]._take, true);
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

// ── Kaynak kırılımı + 90 gün (§8.6.9, §8.7) ─────────────────────
t('sourceFunnel: kaynak bazında "hiç ulaşmış" sayımı', () => {
  const cands = [
    { id: 'a', source: 'github' }, { id: 'b', source: 'github' }, { id: 'c', source: 'hackathon' },
  ];
  const log = [
    { candidateId: 'a', toStage: 'contacted' }, { candidateId: 'a', toStage: 'replied' },
    { candidateId: 'b', toStage: 'contacted' },
    { candidateId: 'c', toStage: 'contacted' }, { candidateId: 'c', toStage: 'interviewed' },
  ];
  const f = sourceFunnel(cands, log);
  assert.equal(f.github.pool, 2);
  assert.equal(f.github.contacted, 2);
  assert.equal(f.github.replied, 1);
  assert.equal(f.hackathon.interviewed, 1);
});
t('active90: 90 günü dolmamışsa rate null (uydurma yok)', () => {
  const cands = [{ id: 'x', stage: 'joined' }];
  const log = [{ candidateId: 'x', toStage: 'joined', createdAt: new Date().toISOString() }];
  assert.equal(active90(cands, log).rate, null);
  assert.equal(active90(cands, log).eligible, 0);
});
t('active90: 100 gün önce joined + hâlâ joined → %100', () => {
  const old = new Date(Date.now() - 100 * DAY).toISOString();
  const cands = [{ id: 'x', stage: 'joined' }, { id: 'y', stage: 'archived' }];
  const log = [
    { candidateId: 'x', toStage: 'joined', createdAt: old },
    { candidateId: 'y', toStage: 'joined', createdAt: old },
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

t('"neden bu kişi": somut esere atıf, en fazla iki cümle', () => {
  const repos = [mkRepo({ name: 'tid-ceviri', stargazers_count: 340, homepage: 'https://demo', pushed_at: daysAgo(21) })];
  const w = whyThisOne(repos, {});
  assert.ok(w.includes('tid-ceviri'), 'repo adına atıf olmalı');
  assert.ok((w.match(/\./g) || []).length <= 2, 'en fazla iki cümle');
  assert.doesNotMatch(w, /yetenekli|başarılı|harika|etkileyici/i, 'sıfat kullanılmamalı');
});

console.log(`\n${pass} senaryo geçti${process.exitCode ? ' — BAŞARISIZ var' : ''}`);
