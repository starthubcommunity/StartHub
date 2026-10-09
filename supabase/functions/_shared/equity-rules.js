// equity-rules.js — pay / vesting hesabı (saf mantık, ağsız, bağımlılıksız).
//
// Kaynak: Start-Hub_Equity_Governance_Framework.md + Vesting_Kurallari.
// DB yalnızca sözü ve tarihleri saklar (0052_equity.sql); "şu an ne kadar
// kazanıldı" HER ZAMAN buradan hesaplanır. Test: equity-rules.test.mjs.
//
// Birimler: tüm yüzdeler PROJE EQUITY'sinin puanı (30 = %30). Tarihler
// 'YYYY-MM-DD' metni ya da Date; hesap UTC gün bazında yapılır.

export const SEAT_KINDS = [
  { value: 'lead',            label: 'Team Lead',             band: [30, 30],     vestMonths: 36, cliff: 6, schedule: 'lead_hybrid' },
  { value: 'member_critical', label: 'Kritik / tek teknik üye', band: [15, 20],   vestMonths: 24, cliff: 6, schedule: 'time' },
  { value: 'member_standard', label: 'Standart üye',          band: [8, 12],      vestMonths: 12, cliff: 6, schedule: 'time' },
  { value: 'member_support',  label: 'Destek / yarı zamanlı', band: [3, 6],       vestMonths: 12, cliff: 6, schedule: 'time' },
  { value: 'mentor',          label: 'Mentor',                band: [0.25, 1],    vestMonths: 24, cliff: 3, schedule: 'time' },
  { value: 'cto',             label: 'CTO (proje katkısı)',   band: [0.25, 1],    vestMonths: 24, cliff: 3, schedule: 'time' },
];
export const SEAT_KIND = Object.fromEntries(SEAT_KINDS.map((k) => [k.value, k]));
export const isMemberSeat = (kind) => String(kind || '').startsWith('member_');

export const MILESTONES = [
  { value: 'mvp',           label: 'MVP tamamlandı' },
  { value: 'first_user',    label: 'İlk kullanıcı / doğrulama' },
  { value: 'first_revenue', label: 'İlk gelir' },
  { value: 'incorporation', label: 'Şirketleşme' },
];
export const MILESTONE_LABEL = Object.fromEntries(MILESTONES.map((m) => [m.value, m.label]));

export const POOLS = { starthub: 20, lead: 30, members: 50 };  // Bölüm III — başlangıç anchor'ı
export const MEMBER_MIN_CLIFF = 6;          // Kural 3: üyede asla 6 aydan kısa değil
export const MAX_RETRO_MONTHS = 3;          // Kural 8
export const REVIEW_WINDOW_DAYS = 30;       // Kural 12

// ── Tarih yardımcıları (UTC, gün hassasiyeti) ──────────────────────────
export function toDate(d) {
  if (d == null || d === '') return null;
  if (d instanceof Date) return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()));
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(String(d));
  if (!m) return null;
  return new Date(Date.UTC(+m[1], +m[2] - 1, +m[3]));
}
export const iso = (d) => (d ? d.toISOString().slice(0, 10) : null);

// Ay ekleme — ayın son gününe kırpar (31 Oca + 1 ay = 28/29 Şub).
export function addMonths(d, n) {
  const y = d.getUTCFullYear(), m = d.getUTCMonth() + n, day = d.getUTCDate();
  const last = new Date(Date.UTC(y, m + 1, 0)).getUTCDate();
  return new Date(Date.UTC(y, m, Math.min(day, last)));
}
const addDays = (d, n) => new Date(d.getTime() + n * 86400000);

// start'tan asOf'a kadar TAMAMLANMIŞ ay sayısı.
export function monthsElapsed(start, asOf) {
  if (asOf < start) return 0;
  let n = (asOf.getUTCFullYear() - start.getUTCFullYear()) * 12 + (asOf.getUTCMonth() - start.getUTCMonth());
  if (addMonths(start, n) > asOf) n -= 1;
  return Math.max(0, n);
}

const round3 = (x) => Math.round(x * 1000) / 1000;

// Kural 8: geriye dönük kredi bekleme süresinin başlangıcını öne çeker.
export function effectiveStart(grant) {
  const s = toDate(grant.startDate);
  const retro = Math.min(MAX_RETRO_MONTHS, Math.max(0, grant.retroCreditMonths || 0));
  return retro ? addMonths(s, -retro) : s;
}

// ── Asıl hesap ─────────────────────────────────────────────────────────
// grant: { grantPct, schedule, vestMonths, cliffMonths, milestoneBonusPct,
//          startDate, retroCreditMonths, status, endedAt, vestedAtEnd,
//          clawedBack, acceleratedAt }
// milestones: [{ kind, achievedAt }] — o projenin kilometre taşları
// Dönüş: { vested, unvested, total, timeVested, bonusVested, monthsIn,
//          cliffDate, cliffPassed, fullyVestedDate, nextVest, frozen, ... }
// 0060 — sözleşme bekleyen söz ("Teyit bekliyor" / "Onay bekliyor") pay İŞLETMEZ;
// hak ediş, sözleşmenin onaylandığı gün (start_date o gün yazılır) başlar.
export const PENDING_STATUSES = ['pending_confirm', 'pending_signature'];
export const isPendingGrant = (g) => PENDING_STATUSES.includes(g?.status);
// Koltuk bütçesinde yer tutan (henüz sonlanmamış) sözler.
export const isOpenGrant = (g) => (g?.status || 'active') === 'active' || isPendingGrant(g);

export function computeVesting(grant, milestones = [], asOfInput = new Date()) {
  const total = Number(grant.grantPct) || 0;
  if (isPendingGrant(grant)) {
    return {
      total: round3(total), vested: 0, unvested: round3(total), timeVested: 0, bonusVested: 0,
      milestonesCounted: [], monthsIn: 0, vestMonths: Math.max(1, grant.vestMonths || 1),
      cliffMonths: Math.max(0, grant.cliffMonths ?? 6), cliffDate: null, cliffPassed: false,
      effectiveStart: null, fullyVestedDate: null, nextVest: null, accelerated: false, frozen: false,
      clawedBack: false, pending: true,
    };
  }
  const start = effectiveStart(grant);
  const asOfRaw = toDate(asOfInput);
  const ended = grant.status && grant.status !== 'active';
  const endDate = ended ? toDate(grant.endedAt) : null;
  // Ayrılmışsa hesap ayrılma tarihinde durur.
  const asOf = endDate && endDate < asOfRaw ? endDate : asOfRaw;
  const cliff = Math.max(0, grant.cliffMonths ?? 6);
  const M = Math.max(1, grant.vestMonths || 1);
  const cliffDate = addMonths(start, cliff);
  const monthsIn = monthsElapsed(start, asOf);
  const cliffPassed = asOf >= cliffDate;

  // Zaman tabanı: bekleme süresi dolana kadar 0, dolunca birikmiş dilim toptan.
  const timeVested = cliffPassed ? total * Math.min(monthsIn, M) / M : 0;

  // Kilometre taşı hızlandırması (yalnızca lead_hybrid): her taş sabit
  // +bonus puan, zaman tabanının ÜZERİNE eklenir, toplam sözü aşamaz.
  // Yalnızca kişinin başlangıcından SONRA gerçekleşen taşlar sayılır;
  // bekleme süresi bitmeden gerçekleşen taş, bekleme süresi sonunda açılır.
  let achieved = [];
  if (grant.schedule === 'lead_hybrid') {
    const bonusStart = toDate(grant.startDate);  // retro kredi taşları geriye çekmez
    achieved = (milestones || [])
      .map((m) => ({ ...m, date: toDate(m.achievedAt) }))
      .filter((m) => m.date && m.date >= bonusStart && m.date <= asOf);
  }
  const bonusPer = Number(grant.milestoneBonusPct ?? 5) || 0;
  const bonusRaw = cliffPassed ? achieved.length * bonusPer : 0;
  const bonusVested = Math.max(0, Math.min(bonusRaw, total - timeVested));

  let vested = timeVested + bonusVested;
  let accelerated = false;
  // Kural 7 — çift şart: acceleratedAt yalnızca iki şart birlikte
  // gerçekleştiğinde girilir (satış + 12 ay içinde haksız çıkarma).
  const accAt = toDate(grant.acceleratedAt);
  if (accAt && accAt <= asOf) { vested = total; accelerated = true; }

  let frozen = false;
  if (ended && grant.vestedAtEnd != null) { vested = Number(grant.vestedAtEnd); frozen = true; }
  if (grant.clawedBack) vested = 0;   // Kural 10: ağır ihlalde geri alındı

  vested = round3(Math.min(total, Math.max(0, vested)));

  // Bir sonraki hak ediş olayı (Kural 12 için de kullanılır).
  let nextVest = null;
  if (!ended && vested < total) {
    if (!cliffPassed) nextVest = cliffDate;
    else if (monthsIn < M) nextVest = addMonths(start, monthsIn + 1);
  }
  const fullyVestedDate = addMonths(start, M);

  return {
    total: round3(total),
    vested,
    unvested: round3(total - vested),
    timeVested: round3(timeVested),
    bonusVested: round3(bonusVested),
    milestonesCounted: achieved.map((m) => m.kind),
    monthsIn: Math.min(monthsIn, M),
    vestMonths: M,
    cliffMonths: cliff,
    cliffDate: iso(cliffDate),
    cliffPassed,
    effectiveStart: iso(start),
    fullyVestedDate: iso(fullyVestedDate),
    nextVest: iso(nextVest),
    accelerated,
    frozen,
    clawedBack: !!grant.clawedBack,
  };
}

// Ayrılma anında donacak kazanılmış pay (vested_at_end'e yazılır).
export function vestedOnExit(grant, milestones, exitDate) {
  if (isPendingGrant(grant)) return 0;   // hiç işlememiş söz
  return computeVesting({ ...grant, status: 'active', endedAt: null, vestedAtEnd: null, clawedBack: false },
    milestones, exitDate).vested;
}

// ── Kural 12: çıkarma, bir sonraki hak edişe ≤30 gün kala mı? ─────────
export function removalNeedsReview(grant, milestones, decisionDate = new Date()) {
  const v = computeVesting(grant, milestones, decisionDate);
  if (!v.nextVest) return { needsReview: false, daysToNext: null, nextVest: null };
  const days = Math.round((toDate(v.nextVest) - toDate(decisionDate)) / 86400000);
  return { needsReview: days >= 0 && days <= REVIEW_WINDOW_DAYS, daysToNext: days, nextVest: v.nextVest };
}

// ── Kural 4b: koltuk bütçesi ───────────────────────────────────────────
// Ayrılanların donan kazanılmış payı bütçeden KALICI düşer (geri alınan
// hariç); aktif kişinin sözü bütçede REZERVE sayılır (tamamı).
export function seatBudget(seat, grants = []) {
  const cap = (Number(seat.budgetPct) || 0) + (Number(seat.reserveTopupPct) || 0);
  let consumed = 0, committed = 0;
  for (const g of grants) {
    if (isOpenGrant(g)) committed += Number(g.grantPct) || 0;   // bekleyen söz de ayrılmış sayılır
    else if (!g.clawedBack) consumed += Number(g.vestedAtEnd) || 0;
  }
  const available = cap - consumed - committed;
  return {
    cap: round3(cap),
    consumed: round3(consumed),
    committed: round3(committed),
    available: round3(Math.max(0, available)),
    overBy: round3(Math.max(0, -available)),
  };
}

// ── Proje dağılımı (Bölüm III / Kural 4) ───────────────────────────────
// Üye koltuklarının bütçe toplamı 50'lik havuzu aşamaz; kalan kısım
// Gelecek Katılımcı Rezervi'dir (kimsenin üzerinde durmaz — Kural 19).
export function projectAllocation(seats = []) {
  const active = seats.filter((s) => s.active !== false);
  const sum = (pred) => round3(active.filter(pred).reduce((a, s) => a + (Number(s.budgetPct) || 0), 0));
  const lead = sum((s) => s.seatKind === 'lead');
  const members = sum((s) => isMemberSeat(s.seatKind));
  const starthub = sum((s) => s.seatKind === 'mentor' || s.seatKind === 'cto');
  return {
    lead, members, starthub,
    reserve: round3(Math.max(0, POOLS.members - members)),
    leadOver: round3(Math.max(0, lead - POOLS.lead)),
    membersOver: round3(Math.max(0, members - POOLS.members)),
    starthubOver: round3(Math.max(0, starthub - POOLS.starthub)),
  };
}

// ── Doğrulama (kaydetmeden önce; hatalar engeller, uyarılar göstermelik) ─
export function validateSeat(seat, otherSeatsOfProject = []) {
  const errors = [], warnings = [];
  const k = SEAT_KIND[seat.seatKind];
  const pct = Number(seat.budgetPct);
  if (!seat.title?.trim()) errors.push('Koltuk adı zorunlu.');
  if (!k) errors.push('Koltuk tipi seçilmeli.');
  if (!(pct > 0)) errors.push('Bütçe yüzdesi 0\'dan büyük olmalı.');
  if (k && pct > 0 && (pct < k.band[0] || pct > k.band[1])) {
    warnings.push(`${k.label} için önerilen aralık %${k.band[0]}–${k.band[1]}; girilen %${pct}.`);
  }
  const alloc = projectAllocation([...otherSeatsOfProject.filter((s) => s.id !== seat.id), seat]);
  if (alloc.membersOver > 0) errors.push(`Üye koltuklarının toplamı %${POOLS.members} havuzu %${alloc.membersOver} aşıyor.`);
  if (alloc.leadOver > 0) errors.push(`Lider koltuğu toplamı %${POOLS.lead}'u aşıyor.`);
  if (alloc.starthubOver > 0) warnings.push(`Mentor/CTO payları Start-Hub'ın %${POOLS.starthub} havuzunu aşıyor.`);
  return { errors, warnings };
}

export function validateGrant(grant, seat, seatGrants = []) {
  const errors = [], warnings = [];
  const pct = Number(grant.grantPct);
  if (!grant.holderName?.trim()) errors.push('Kişi adı zorunlu.');
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(grant.holderEmail || '')) errors.push('Geçerli bir e-posta zorunlu ("Payım" bu adresle eşleşir).');
  if (!toDate(grant.startDate)) errors.push('Başlangıç tarihi zorunlu.');
  if (!(pct > 0)) errors.push('Pay yüzdesi 0\'dan büyük olmalı.');
  if (!(grant.vestMonths >= 1)) errors.push('Hak ediş süresi (ay) zorunlu.');
  if (seat && isMemberSeat(seat.seatKind) && (grant.cliffMonths ?? 0) < MEMBER_MIN_CLIFF) {
    errors.push(`Üyelerde bekleme süresi ${MEMBER_MIN_CLIFF} aydan kısa olamaz (Kural 3).`);
  }
  if ((grant.retroCreditMonths || 0) > MAX_RETRO_MONTHS) errors.push(`Geriye dönük kredi en fazla ${MAX_RETRO_MONTHS} ay (Kural 8).`);
  if ((grant.retroCreditMonths || 0) > 0 && !grant.retroCreditNote?.trim()) {
    errors.push('Geriye dönük kredi için kanıt/onay notu zorunlu (Kural 8).');
  }
  if (grant.schedule === 'lead_hybrid' && seat && seat.seatKind !== 'lead') warnings.push('Hibrit takvim normalde yalnızca Lider içindir.');
  if (seat) {
    const b = seatBudget(seat, seatGrants.filter((g) => g.id !== grant.id));
    if (pct > b.available) {
      errors.push(`Koltuk bütçesinde yalnızca %${b.available} kaldı (tavan %${b.cap}, ayrılanlarca kullanılan %${b.consumed}, aktif sözler %${b.committed}). Gerekirse rezervden takviye ekle (Kural 4b).`);
    }
  }
  return { errors, warnings };
}

// Koltuk tipine göre yeni söz için varsayılanlar.
export function grantDefaultsForSeat(seat, available) {
  const k = SEAT_KIND[seat?.seatKind] || SEAT_KIND.member_standard;
  return {
    schedule: k.schedule,
    vestMonths: k.vestMonths,
    cliffMonths: k.cliff,
    milestoneBonusPct: k.schedule === 'lead_hybrid' ? 5 : 0,
    grantPct: available != null ? Math.min(available, Number(seat?.budgetPct) || 0) : Number(seat?.budgetPct) || 0,
  };
}

// ── DB ↔ JS eşleyiciler (proje kuralı: mapXToDb / mapXFromDb) ──────────
export const mapSeatFromDb = (r) => ({
  id: r.id, startupId: r.startup_id, title: r.title, seatKind: r.seat_kind,
  budgetPct: Number(r.budget_pct), reserveTopupPct: Number(r.reserve_topup_pct || 0),
  openRoleId: r.open_role_id, note: r.note, active: r.active, createdAt: r.created_at,
});
export const mapSeatToDb = (s) => ({
  startup_id: s.startupId, title: s.title?.trim(), seat_kind: s.seatKind,
  budget_pct: Number(s.budgetPct), reserve_topup_pct: Number(s.reserveTopupPct || 0),
  open_role_id: s.openRoleId || null, note: s.note || null, active: s.active !== false,
});
export const mapGrantFromDb = (r) => ({
  id: r.id, seatId: r.seat_id, holderName: r.holder_name, holderEmail: r.holder_email,
  hubCandidateId: r.hub_candidate_id, grantPct: Number(r.grant_pct), schedule: r.schedule,
  vestMonths: r.vest_months, cliffMonths: r.cliff_months, milestoneBonusPct: Number(r.milestone_bonus_pct),
  startDate: r.start_date, retroCreditMonths: r.retro_credit_months, retroCreditNote: r.retro_credit_note,
  status: r.status, endedAt: r.ended_at, vestedAtEnd: r.vested_at_end == null ? null : Number(r.vested_at_end),
  clawedBack: r.clawed_back, acceleratedAt: r.accelerated_at, accelerationNote: r.acceleration_note,
  note: r.note, createdAt: r.created_at,
  contractTemplateId: r.contract_template_id || null, contractSentAt: r.contract_sent_at || null,
  contractSentBy: r.contract_sent_by || null, signedAt: r.signed_at || null, acceptanceId: r.acceptance_id || null,
});
// Sözleşme alanlarını (contract_*, signed_at, acceptance_id) YAZMAZ — onları
// yalnızca sunucu yazar (0060 tetikleyicisi). Yeni söz "Teyit bekliyor" başlar.
export const mapGrantToDb = (g) => ({
  seat_id: g.seatId, holder_name: g.holderName?.trim(), holder_email: g.holderEmail?.trim().toLowerCase(),
  hub_candidate_id: g.hubCandidateId || null, grant_pct: Number(g.grantPct), schedule: g.schedule,
  vest_months: Number(g.vestMonths), cliff_months: Number(g.cliffMonths),
  milestone_bonus_pct: Number(g.milestoneBonusPct || 0), start_date: g.startDate,
  retro_credit_months: Number(g.retroCreditMonths || 0), retro_credit_note: g.retroCreditNote || null,
  status: g.status || 'pending_confirm', ended_at: g.endedAt || null,
  vested_at_end: g.vestedAtEnd == null ? null : Number(g.vestedAtEnd),
  clawed_back: !!g.clawedBack, accelerated_at: g.acceleratedAt || null,
  acceleration_note: g.accelerationNote || null, note: g.note || null,
});
export const mapMilestoneFromDb = (r) => ({ id: r.id, startupId: r.startup_id, kind: r.kind, achievedAt: r.achieved_at, note: r.note });
export const mapEventFromDb = (r) => ({
  id: r.id, grantId: r.grant_id, seatId: r.seat_id, kind: r.kind, taskRef: r.task_ref, taskDue: r.task_due,
  fixDeadline: r.fix_deadline, outcome: r.outcome, note: r.note, payload: r.payload,
  happenedAt: r.happened_at, createdBy: r.created_by,
});

// ── "Payım" görünümü (Adım 5/5) — Team App'e giden, salt okunur özet ─────
// Bölüm M: detay ekranı tam ve eksiksiz — kazanılmış/kazanılmamış, bekleme
// süresi, bir sonraki hak ediş ve (Lider için) sıradaki kilometre taşı.
export const STATUS_TR = {
  pending_confirm: 'Teyit bekliyor', pending_signature: 'Onay bekliyor',
  active: 'Aktif', left_good: 'Ayrıldı (iyi niyetli)', left_bad: 'Çıkarıldı (ağır ihlal)', removed: 'Çıkarıldı',
};
// Aktif + kabul kaydı varsa "İmzalandı" (0060 öncesi sözler "Aktif" kalır).
export function grantStatusLabel(g) {
  const st = g?.status || 'active';
  if (st === 'active' && g?.signedAt) return 'İmzalandı';
  return STATUS_TR[st] || st;
}

export function summarizeGrant(grant, seat, projectName, milestones = [], asOf = new Date()) {
  const v = computeVesting(grant, milestones, asOf);
  const achieved = new Set((milestones || []).filter((m) => toDate(m.achievedAt) && toDate(m.achievedAt) <= toDate(asOf)).map((m) => m.kind));
  const next = grant.schedule === 'lead_hybrid' ? MILESTONES.find((m) => !achieved.has(m.value)) : null;
  return {
    project: projectName || '—',
    seat: seat?.title || '—',
    seatKind: SEAT_KIND[seat?.seatKind]?.label || '',
    status: grant.status || 'active',
    statusLabel: grantStatusLabel(grant),
    signedAt: grant.signedAt || null,
    schedule: grant.schedule,
    total: v.total, vested: v.vested, unvested: v.unvested,
    progress: v.total ? Math.round((v.vested / v.total) * 1000) / 10 : 0,
    bonusVested: v.bonusVested,
    monthsIn: v.monthsIn, vestMonths: v.vestMonths, cliffMonths: v.cliffMonths,
    cliffDate: v.cliffDate, cliffPassed: v.cliffPassed,
    nextVest: v.nextVest, fullyVestedDate: v.fullyVestedDate,
    startDate: grant.startDate, retroCreditMonths: grant.retroCreditMonths || 0,
    milestoneBonusPct: grant.schedule === 'lead_hybrid' ? Number(grant.milestoneBonusPct || 0) : 0,
    milestonesDone: MILESTONES.filter((m) => achieved.has(m.value)).map((m) => m.label),
    nextMilestone: next ? next.label : null,
    accelerated: v.accelerated, frozen: v.frozen, clawedBack: v.clawedBack,
    endedAt: grant.endedAt || null,
  };
}

// ── Ekip ↔ pay sözü karşılaştırması (2026-10-08) ─────────────────────────
// members: Team App ekibinin kullanıcıları [{ name, email, role, isAdmin }]
// grants : o projenin TÜM pay sözleri (mapGrantFromDb)
// • missing: ekipte olup AKTİF sözü olmayanlar (Team App admin'leri hariç —
//   yöneticiler ekiplere üye görünür ama pay sözü konusu değildir)
// • orphan : aktif sözün e-postası ekipte yok → Payım'da görünmez
export function compareRoster(members = [], grants = []) {
  const norm = (e) => String(e || '').trim().toLowerCase();
  const active = grants.filter(isOpenGrant);   // bekleyen söz de "sözü var" sayılır
  const grantEmails = new Set(active.map((g) => norm(g.holderEmail)));
  const memberEmails = new Set(members.map((m) => norm(m.email)).filter(Boolean));
  const missing = members
    .filter((m) => !m.isAdmin && norm(m.email) && !grantEmails.has(norm(m.email)))
    .map((m) => ({ name: m.name, email: norm(m.email), role: m.role }));
  const orphanIds = new Set(active.filter((g) => !memberEmails.has(norm(g.holderEmail))).map((g) => g.id));
  return { missing, orphanIds };
}

// ── "Ekibe Al" → pay sözü taslağı (2026-10-08) ──────────────────────────
// candidates: HR adayları (mapCandidateFromDb) — yalnızca stage='member' sayılır
// grants    : pay sözleri (herhangi bir durumda — ayrılmış söz de "verilmiş" sayılır)
// seats     : projenin koltukları (openRoleId ile role bağlı olabilir)
// 0060'tan sonra "Ekibe Al" role bağlı koltuk varsa taslak sözü KENDİSİ açar;
// burada kalanlar koltuğu/bütçesi olmadığı için taslak açılamayanlardır.
// Hak ediş sözleşme onay gününde başlar — başlangıç tarihi önerilmez.
export function pendingGrantJoins(candidates = [], grants = [], seats = [], { startupId = null, roleStartup = {} } = {}) {
  const norm = (e) => String(e || '').trim().toLowerCase();
  const byCand = new Set(grants.map((g) => g.hubCandidateId).filter(Boolean));
  const byEmail = new Set(grants.map((g) => norm(g.holderEmail)));
  return candidates
    .filter((c) => c.stage === 'member')
    .filter((c) => startupId == null || Number(c.startupId ?? roleStartup[c.openRoleId]) === Number(startupId))
    .filter((c) => !byCand.has(c.id) && !(norm(c.email) && byEmail.has(norm(c.email))))
    .map((c) => {
      const seat = seats.find((s) => s.active !== false && s.openRoleId && s.openRoleId === c.openRoleId) || null;
      return {
        candidateId: c.id, name: c.fullName || '', email: norm(c.email), track: c.track || null,
        joinedAt: c.joinedAt || null,
        seatId: seat ? seat.id : null, seatTitle: seat ? seat.title : null,
      };
    })
    .sort((a, b) => String(b.joinedAt || '').localeCompare(String(a.joinedAt || '')));
}
