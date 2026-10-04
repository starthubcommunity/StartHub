// equity-rules.test.mjs — pay/vesting kuralları (Vesting_Kurallari + Framework).
// Test kütüphanesi yok — düz node. Çalıştır: node src/lib/equity-rules.test.mjs
import assert from 'node:assert/strict';
import {
  computeVesting, vestedOnExit, removalNeedsReview, seatBudget, projectAllocation,
  validateSeat, validateGrant, monthsElapsed, addMonths, toDate, effectiveStart, summarizeGrant,
} from './equity-rules.js';

let pass = 0;
const t = (name, fn) => {
  try { fn(); pass++; console.log('  ok  ' + name); }
  catch (e) { console.log('  X   ' + name + '\n      ' + e.message); process.exitCode = 1; }
};

const lead = (o = {}) => ({ grantPct: 30, schedule: 'lead_hybrid', vestMonths: 36, cliffMonths: 6, milestoneBonusPct: 5, startDate: '2026-01-01', status: 'active', ...o });
const member = (o = {}) => ({ grantPct: 12, schedule: 'time', vestMonths: 12, cliffMonths: 6, milestoneBonusPct: 0, startDate: '2026-01-01', status: 'active', ...o });

// ── Tarih yardımcıları ───────────────────────────────────────────────
t('ay ekleme ay sonuna kırpar (31 Oca + 1 = 28 Şub)', () => {
  assert.equal(addMonths(toDate('2026-01-31'), 1).toISOString().slice(0, 10), '2026-02-28');
});
t('tamamlanmış ay sayısı: gün dolmadan ay sayılmaz', () => {
  assert.equal(monthsElapsed(toDate('2026-01-15'), toDate('2026-03-14')), 1);
  assert.equal(monthsElapsed(toDate('2026-01-15'), toDate('2026-03-15')), 2);
});

// ── Kural 1-3: bekleme süresi ───────────────────────────────────────
t('Kural 1: ilk gün hiçbir pay kazanılmamış', () => {
  assert.equal(computeVesting(lead(), [], '2026-01-01').vested, 0);
});
t('Kural 2: Lider 5. ayda hâlâ 0 (bekleme süresi)', () => {
  assert.equal(computeVesting(lead(), [], '2026-06-30').vested, 0);
});
t('Kural 2: Lider 6. ay sonunda birikmiş dilim toptan: 6/36 × 30 = 5', () => {
  const v = computeVesting(lead(), [], '2026-07-01');
  assert.equal(v.vested, 5); assert.equal(v.cliffPassed, true);
});
t('Kural 2: Lider 36 ayda tamamı (30)', () => {
  assert.equal(computeVesting(lead(), [], '2029-01-01').vested, 30);
  assert.equal(computeVesting(lead(), [], '2035-01-01').vested, 30);
});
t('Kural 3: standart üye 12 ay, 6. ayda yarısı, 7. ayda 7/12', () => {
  assert.equal(computeVesting(member(), [], '2026-07-01').vested, 6);
  assert.equal(computeVesting(member(), [], '2026-08-01').vested, 7);
  assert.equal(computeVesting(member(), [], '2027-01-01').vested, 12);
});

// ── Kural 2: kilometre taşı hızlandırması (karar: sabit +5, bekleme sonrası) ─
t('kilometre taşı: bekleme sonrası her taş +5 puan, zamanın üzerine', () => {
  const ms = [{ kind: 'mvp', achievedAt: '2026-08-15' }];
  const v = computeVesting(lead(), ms, '2026-09-01');   // 8 ay: 8/36×30 = 6.667 + 5
  assert.equal(v.timeVested, 6.667); assert.equal(v.bonusVested, 5); assert.equal(v.vested, 11.667);
});
t('kilometre taşı bekleme süresi içinde gerçekleşirse bekleme sonunda açılır', () => {
  const ms = [{ kind: 'mvp', achievedAt: '2026-03-01' }];
  assert.equal(computeVesting(lead(), ms, '2026-05-01').vested, 0);
  assert.equal(computeVesting(lead(), ms, '2026-07-01').vested, 10);   // 5 + 5
});
t('kilometre taşı: toplam söz (30) aşılmaz', () => {
  const ms = ['mvp', 'first_user', 'first_revenue', 'incorporation'].map((k) => ({ kind: k, achievedAt: '2026-02-01' }));
  const v = computeVesting(lead(), ms, '2028-07-01');   // 30 ay: 25 zaman + 20 bonus → 30'da kırpılır
  assert.equal(v.vested, 30);
});
t('kilometre taşı: kişi gelmeden ÖNCE gerçekleşen taş sayılmaz', () => {
  const ms = [{ kind: 'mvp', achievedAt: '2025-12-01' }];
  assert.equal(computeVesting(lead(), ms, '2026-07-01').vested, 5);
});
t('kilometre taşı: üye (time takvimi) bonustan yararlanmaz', () => {
  const ms = [{ kind: 'mvp', achievedAt: '2026-02-01' }];
  assert.equal(computeVesting(member({ milestoneBonusPct: 5 }), ms, '2026-07-01').vested, 6);
});

// ── Kural 8 / Senaryo 8: geriye dönük kredi ─────────────────────────
t('Senaryo 8: 6 hafta önceden çalışan üyeye en fazla 3 ay kredi', () => {
  const g = member({ startDate: '2026-04-01', retroCreditMonths: 3, retroCreditNote: 'görev kayıtları' });
  assert.equal(effectiveStart(g).toISOString().slice(0, 10), '2026-01-01');
  assert.equal(computeVesting(g, [], '2026-07-01').vested, 6);   // imzadan 3 ay sonra bekleme dolar
  const big = member({ startDate: '2026-04-01', retroCreditMonths: 9 });
  assert.equal(effectiveStart(big).toISOString().slice(0, 10), '2026-01-01');   // 3'e kırpılır
});
t('Kural 8: kredi için not zorunlu, 3 aydan fazlası hata', () => {
  const seat = { id: 's', seatKind: 'member_standard', budgetPct: 10 };
  const base = { holderName: 'B', holderEmail: 'b@x.com', grantPct: 10, vestMonths: 12, cliffMonths: 6, startDate: '2026-01-01' };
  assert.ok(validateGrant({ ...base, retroCreditMonths: 2 }, seat).errors.some((e) => e.includes('not')));
  assert.ok(validateGrant({ ...base, retroCreditMonths: 4, retroCreditNote: 'x' }, seat).errors.some((e) => e.includes('3 ay')));
});

// ── Kural 3: üyede bekleme ≥ 6 ay ───────────────────────────────────
t('Kural 3: üyede 3 aylık bekleme süresi reddedilir, mentorda kabul', () => {
  const base = { holderName: 'B', holderEmail: 'b@x.com', grantPct: 0.5, vestMonths: 24, cliffMonths: 3, startDate: '2026-01-01' };
  assert.ok(validateGrant(base, { seatKind: 'member_support', budgetPct: 5 }).errors.some((e) => e.includes('Kural 3')));
  assert.equal(validateGrant(base, { seatKind: 'mentor', budgetPct: 1 }).errors.length, 0);
});

// ── Kural 9-10: ayrılma ─────────────────────────────────────────────
t('Kural 9/10: iyi niyetli ayrılan — kazanılmış donar, kazanılmamış döner', () => {
  const exitV = vestedOnExit(member(), [], '2026-09-10');   // 8 tam ay → 8
  assert.equal(exitV, 8);
  const g = member({ status: 'left_good', endedAt: '2026-09-10', vestedAtEnd: exitV });
  const v = computeVesting(g, [], '2030-01-01');
  assert.equal(v.vested, 8); assert.equal(v.unvested, 4); assert.equal(v.nextVest, null);
});
t('Senaryo 1: bekleme dolmadan çıkarılan üye hiçbir şey kazanmaz', () => {
  assert.equal(vestedOnExit(member(), [], '2026-05-20'), 0);
});
t('Kural 10: ağır ihlalde geri alım → kazanılmış 0', () => {
  const g = member({ status: 'left_bad', endedAt: '2026-10-01', vestedAtEnd: 9, clawedBack: true });
  assert.equal(computeVesting(g, [], '2027-01-01').vested, 0);
});

// ── Kural 7: çift şart ──────────────────────────────────────────────
t('Kural 7: satış tek başına hiçbir şey açmaz; çift şart girilince tamamı açılır', () => {
  assert.equal(computeVesting(lead(), [], '2026-10-01').vested, 7.5);
  assert.equal(computeVesting(lead({ acceleratedAt: '2026-09-15' }), [], '2026-10-01').vested, 30);
});

// ── Kural 12: 30 gün kontrolü ───────────────────────────────────────
t('Kural 12: bekleme bitimine 10 gün kala çıkarma → Start-Hub kontrolü', () => {
  const r = removalNeedsReview(member(), [], '2026-06-21');
  assert.equal(r.needsReview, true); assert.equal(r.nextVest, '2026-07-01'); assert.equal(r.daysToNext, 10);
});
t('Kural 12: bekleme sonrası her aylık dilim de 30 gün içinde → kontrol', () => {
  assert.equal(removalNeedsReview(member(), [], '2026-08-15').needsReview, true);
});
t('Kural 12: 3. ayda (bekleme sonuna 90+ gün) kontrol gerekmez', () => {
  assert.equal(removalNeedsReview(member(), [], '2026-03-15').needsReview, false);
});
t('Kural 12: tamamen hak edilmişse kontrol gerekmez', () => {
  assert.equal(removalNeedsReview(member(), [], '2027-03-01').needsReview, false);
});

// ── Kural 4b / Senaryo 9: koltuk bütçesi ────────────────────────────
t('Kural 4b: 1. kişi %4,2 kazanıp ayrıldı → 2. kişiye en fazla %5,8', () => {
  const seat = { id: 's', seatKind: 'member_standard', budgetPct: 10 };
  const grants = [{ id: 'a', status: 'left_good', grantPct: 10, vestedAtEnd: 4.2 }];
  assert.equal(seatBudget(seat, grants).available, 5.8);
  const g2 = { holderName: 'İki', holderEmail: 'i@x.com', grantPct: 10, vestMonths: 12, cliffMonths: 6, startDate: '2027-01-01' };
  assert.ok(validateGrant(g2, seat, grants).errors.some((e) => e.includes('5.8')));
  assert.equal(validateGrant({ ...g2, grantPct: 5.8 }, seat, grants).errors.length, 0);
});
t('Senaryo 9: 6 kişi bütçeyi bitirdi → 7. kişiye 0; rezerv takviyesi açar', () => {
  const grants = Array.from({ length: 6 }, (_, i) => ({ id: 'g' + i, status: 'left_good', grantPct: 10, vestedAtEnd: 10 / 6 }));
  assert.equal(seatBudget({ budgetPct: 10 }, grants).available, 0);
  assert.equal(seatBudget({ budgetPct: 10, reserveTopupPct: 5 }, grants).available, 5);
});
t('Kural 4b: geri alınan (clawed back) pay bütçeye döner', () => {
  const grants = [{ status: 'left_bad', vestedAtEnd: 6, clawedBack: true }];
  assert.equal(seatBudget({ budgetPct: 10 }, grants).available, 10);
});
t('Kural 4b: aktif kişinin sözü bütçede rezerve sayılır', () => {
  const b = seatBudget({ budgetPct: 10 }, [{ status: 'active', grantPct: 10 }]);
  assert.equal(b.available, 0); assert.equal(b.committed, 10);
});

// ── Kural 4 / Senaryo 6: havuz kişi sayısına bölünmez ───────────────
t('Senaryo 6: lider + 1 kritik üye (%18) → rezerv %32, lider > üye', () => {
  const seats = [{ seatKind: 'lead', budgetPct: 30 }, { seatKind: 'member_critical', budgetPct: 18 }];
  const a = projectAllocation(seats);
  assert.equal(a.reserve, 32); assert.ok(a.lead > 18);
});
t('Kural 4: kritik üyeye %50 verilmeye çalışılırsa aralık uyarısı', () => {
  const r = validateSeat({ title: 'Tek üye', seatKind: 'member_critical', budgetPct: 50 }, []);
  assert.ok(r.warnings.some((w) => w.includes('15–20')));
});
t('Kural 4: üye koltukları toplamı 50\'yi aşamaz', () => {
  const others = [{ id: 'x', seatKind: 'member_critical', budgetPct: 20 }, { id: 'y', seatKind: 'member_critical', budgetPct: 20 }];
  const r = validateSeat({ id: 'z', title: 'Üçüncü', seatKind: 'member_standard', budgetPct: 12 }, others);
  assert.ok(r.errors.some((e) => e.includes('aşıyor')));
});
t('kapalı koltuk proje dağılımına sayılmaz', () => {
  assert.equal(projectAllocation([{ seatKind: 'member_critical', budgetPct: 20, active: false }]).reserve, 50);
});

// ── Adım 5: "Payım" özeti ───────────────────────────────────────────
t('Payım: lider — MVP sonrası sıradaki taş "İlk kullanıcı", ilerleme yüzdesi', () => {
  const s = summarizeGrant(lead(), { title: 'Team Lead', seatKind: 'lead' }, 'TİD Çevirici', [{ kind: 'mvp', achievedAt: '2026-05-10' }], '2026-09-01');
  assert.equal(s.project, 'TİD Çevirici'); assert.equal(s.vested, 11.667); assert.equal(s.progress, 38.9);
  assert.equal(s.nextMilestone, 'İlk kullanıcı / doğrulama'); assert.deepEqual(s.milestonesDone, ['MVP tamamlandı']);
  assert.equal(s.cliffPassed, true); assert.equal(s.nextVest, '2026-10-01');
});
t('Payım: üyede kilometre taşı satırı yok; bekleme süresindeyken tarih görünür', () => {
  const s = summarizeGrant(member(), { title: 'Mobil', seatKind: 'member_standard' }, 'P', [], '2026-03-01');
  assert.equal(s.nextMilestone, null); assert.equal(s.cliffPassed, false); assert.equal(s.cliffDate, '2026-07-01'); assert.equal(s.vested, 0);
});
t('Payım: ayrılmış söz donmuş değeri gösterir', () => {
  const s = summarizeGrant(member({ status: 'left_good', endedAt: '2026-09-10', vestedAtEnd: 8 }), { title: 'Mobil', seatKind: 'member_standard' }, 'P', [], '2027-06-01');
  assert.equal(s.statusLabel, 'Ayrıldı (iyi niyetli)'); assert.equal(s.vested, 8); assert.equal(s.nextVest, null);
});

console.log(`\n${pass} senaryo geçti${process.exitCode ? ' — BAŞARISIZ var' : ''}`);
