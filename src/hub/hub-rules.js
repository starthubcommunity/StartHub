// hub-rules.js — Kurucu Hattı kural motoru (HUB_SPEC §9).
//
// Saf, yan etkisiz fonksiyonlar. Arayüz bunları ÇAĞIRIR; eşik / aşama-geçiş /
// bayatlama mantığı BAŞKA HİÇBİR YERDE tekrarlanmaz. Hiçbir bileşen kendi
// eşik kontrolünü yazmaz.
import { THRESHOLD, STALE, STAGE_LABEL, stageOrderFor } from './hub-constants.js';

const DAY_MS = 86400000;
const daysBetween = (from, to) => Math.floor((to - from) / DAY_MS);
const asTime = (v) => (v ? new Date(v).getTime() : null);
const toMs = (now) => (typeof now === 'number' ? now : new Date(now).getTime());
const filled = (v) => v !== null && v !== undefined && String(v).trim() !== '';

// Rubriğin üç ekseni de girilmiş mi (§2.3).
export function rubricComplete(c) {
  return c?.scoreFinishing != null && c?.scoreCommunication != null && c?.scoreCapacity != null;
}

// Puan eşiği — HAT BAZINDA (§12.1). İkinci parametre bağlı açık rol
// (member hattında needs_communication için). Kırmızı bayrak kuralı ayrı —
// bkz. canAdvance('finalist'). Eşik sayıları yalnızca hub-constants'tan.
export function thresholdMet(c, openRole = null) {
  if (!c) return false;
  if ((c.track || 'founder') === 'member') {
    const t = THRESHOLD.member;
    if (c.scoreFinishing == null || c.scoreCapacity == null) return false;
    if (c.scoreFinishing < t.minFinishing || c.scoreCapacity < t.minCapacity) return false;
    if (openRole?.needsCommunication) {
      if (c.scoreCommunication == null || c.scoreCommunication < t.minCommunication) return false;
    }
    return true;
  }
  // founder
  if (!rubricComplete(c)) return false;
  const axes = [c.scoreFinishing, c.scoreCommunication, c.scoreCapacity];
  const total = axes.reduce((s, n) => s + n, 0);
  return total >= THRESHOLD.founder.minTotal && Math.min(...axes) >= THRESHOLD.founder.minAxis;
}

// İnsan-okunur eşik açıklaması (reason metinleri + arayüz için).
export function thresholdText(track = 'founder', openRole = null) {
  if (track === 'member') {
    const t = THRESHOLD.member;
    return `bitirmişlik ≥ ${t.minFinishing} ve kapasite ≥ ${t.minCapacity}` +
      (openRole?.needsCommunication ? ` ve iletişim ≥ ${t.minCommunication}` : '');
  }
  const t = THRESHOLD.founder;
  return `toplam ≥ ${t.minTotal} ve hiçbir eksen ≤ ${t.minAxis - 1}`;
}

// Hedefin kendi çıkış koşulu (§9 "Kontroller"). Sıra kontrolü ayrı — canAdvance.
function targetGate(c, toStage, ctx = {}) {
  const { role = null, touchCount = null, interviewCount = null, gates = null, openRole = null } = ctx;
  const track = c.track || 'founder';

  switch (toStage) {
    case 'contacted': {
      const hasTouch = touchCount != null ? touchCount > 0 : filled(c.lastContactAt);
      return hasTouch
        ? { ok: true }
        : { ok: false, reason: 'Önce bir temas kaydı olmalı — mesaj gönderilmeli.' };
    }

    case 'interviewed': {
      if (interviewCount != null && interviewCount < 1)
        return { ok: false, reason: 'Görüşme kaydı yok.' };
      // Üye hattında iletişim ekseni boş olabilir (§12.1) — rubrik "dolu"
      // sayılması için bitirmişlik + kapasite yeter.
      const complete = track === 'member'
        ? (c.scoreFinishing != null && c.scoreCapacity != null)
        : rubricComplete(c);
      return complete
        ? { ok: true }
        : { ok: false, reason: track === 'member'
            ? 'Bitirmişlik ve kapasite girilmeden görüşme aşamasına geçilemez.'
            : 'Rubrik doldurulmadan görüşme aşamasına geçilemez — üç eksen de girilmeli.' };
    }

    case 'finalist': {
      if (!thresholdMet(c, openRole))
        return {
          ok: false,
          reason: `Eşik sağlanmadı (${track === 'member' ? 'üye' : 'kurucu'} hattı): ${thresholdText(track, openRole)}.`,
        };
      const flags = (c.redFlags || []).length;
      if (flags >= THRESHOLD.blockAtRedFlags) {
        const overridden = role === 'cofounder' && filled(c.overrideReason);
        return overridden
          ? { ok: true }
          : {
              ok: false,
              reason: `${flags} kırmızı bayrak işaretli — yalnızca kurucu, gerekçe yazarak (override_reason) geçirebilir.`,
            };
      }
      return { ok: true };
    }

    case 'gate_a':
    case 'gate_b': {
      const g = toStage === 'gate_a' ? 'A' : 'B';
      const open = Array.isArray(gates)
        ? gates.some((x) => x.gate === g)
        : ctx[g === 'A' ? 'hasGateA' : 'hasGateB'] === true;
      return open
        ? { ok: true }
        : { ok: false, reason: `Kapı ${g} başlatılmadan bu aşamaya geçilemez.` };
    }

    default:
      // pool / replied / joined ve tanımsız hedefler: §9'da makine kısıtı yok.
      return { ok: true };
  }
}

// canAdvance(candidate, toStage, ctx?) -> { ok, reason? }
// §9 "Sıra zorunluluğu" + §12.1 iki hat: ileri yönde yalnızca (hattın kendi
// sırasında) bir adım serbest. Fazlası reddedilir; yalnızca role==='cofounder'
// ve overrideReason dolu ise geçer. Geri gitmek serbest (stage_log'a yazılır).
// Üye hattında Kapı B YOKTUR — gate_a → joined tek adımdır, atlama sayılmaz.
// archived her aşamadan, archive_reason zorunlu.
// ctx: { role, touchCount, interviewCount, gates, openRole }.
export function canAdvance(candidate, toStage, ctx = {}) {
  const c = candidate || {};
  const { role = null } = ctx;
  const track = c.track || 'founder';

  // archived — her aşamadan, sebep zorunlu
  if (toStage === 'archived') {
    return filled(c.archiveReason)
      ? { ok: true }
      : { ok: false, reason: 'Arşivleme sebebi zorunludur.' };
  }

  // Üye hattında Kapı B yok (§12.1)
  if (toStage === 'gate_b' && track === 'member') {
    return { ok: false, reason: 'Üye hattında Kapı B yoktur (finalist → Kapı A → Ekipte).' };
  }

  const order = stageOrderFor(track);
  const fromIdx = order.indexOf(c.stage);
  const toIdx = order.indexOf(toStage);

  // Pipeline dışı (arşivden çıkış, tanımsız hedef): yalnızca hedef koşulu
  if (fromIdx < 0 || toIdx < 0) return targetGate(c, toStage, ctx);

  if (toIdx === fromIdx) return { ok: true };
  if (toIdx < fromIdx) return { ok: true };   // geri gitmek serbest

  // ileri
  if (toIdx - fromIdx >= 2) {
    const canSkip = role === 'cofounder' && filled(c.overrideReason);
    if (!canSkip) {
      return {
        ok: false,
        reason: `Aşama atlanamaz: ${STAGE_LABEL[c.stage] || c.stage} → ${STAGE_LABEL[toStage] || toStage} ` +
          `(${toIdx - fromIdx} adım). Aralıktaki aşamalardan geçilmeli; yalnızca kurucu, override gerekçesiyle atlayabilir.`,
      };
    }
  }
  return targetGate(c, toStage, ctx);
}

// presentGate(candidate, openRole) -> { ok, reason? }
// §12.3 adım 5: aday proje sahibine SUNULABİLİR mi — hat eşiği sağlandı mı,
// kırmızı bayrak < eşik mi, bir açık role bağlı mı.
export function presentGate(candidate, openRole) {
  const c = candidate || {};
  if (!openRole) return { ok: false, reason: 'Aday bir açık role bağlanmalı.' };
  const track = c.track || 'founder';
  if (!thresholdMet(c, openRole)) {
    return { ok: false, reason: `Eşik sağlanmadı (${track === 'member' ? 'üye' : 'kurucu'} hattı): ${thresholdText(track, openRole)}.` };
  }
  const flags = (c.redFlags || []).length;
  if (flags >= THRESHOLD.blockAtRedFlags) {
    return { ok: false, reason: `${flags} kırmızı bayrak işaretli — sunulamaz.` };
  }
  return { ok: true };
}

// inheritedTrack(role, currentTrack) -> aday hattı (§12.1)
// Bir aday açık role bağlandığında track ROLDEN miras alınır. Rol yoksa
// mevcut track korunur — bağlantı kaldırılınca geri alma YOKTUR.
export function inheritedTrack(role, currentTrack = 'founder') {
  return role?.track || currentTrack || 'founder';
}

// roleStatusAfterReject(role, roleCandidates, rejectedId) -> yeni durum
// §12.3 "Ret asılı bırakılmaz": proje sahibi bir adayı reddettiğinde, o role
// bağlı BAŞKA `pending` sunulmuş aday yoksa rol `sourcing`'e döner; varsa
// `shortlist`'te kalır. Yalnızca `shortlist`'ten geri döndürür.
export function roleStatusAfterReject(role, roleCandidates, rejectedId) {
  if (!role || role.status !== 'shortlist') return role?.status ?? null;
  const othersPending = (roleCandidates || []).some(
    (c) => c.id !== rejectedId && c.openRoleId === role.id && c.ownerDecision === 'pending'
  );
  return othersPending ? 'shortlist' : 'sourcing';
}

// isStale(candidate, now) -> { stale, level: 'warn'|'critical'|null, days }
// §9 tablosu: aşamaya göre sayaç referansı ve eşikler.
//   contacted   → last_contact_at   (7 / 14 gün)
//   interviewed → stage_changed_at  (5 / 10)
//   replied     → stage_changed_at  (3 / 7)
//   finalist    → stage_changed_at  (5 / 10)
//   diğerleri   → bayatlama uygulanmaz
// ⚠️ updated_at ASLA referans DEĞİLDİR — herhangi bir alan düzenlenince
// sıfırlanır ve takip görevi hiç doğmaz.
export function isStale(candidate, now = Date.now()) {
  const c = candidate || {};
  const rule = STALE[c.stage];
  if (!rule) return { stale: false, level: null, days: 0 };

  const ref = asTime(c[rule.ref]);
  if (!ref) return { stale: false, level: null, days: 0 };

  const days = daysBetween(ref, toMs(now));
  if (days >= rule.critical) return { stale: true, level: 'critical', days };
  if (days >= rule.warn) return { stale: true, level: 'warn', days };
  return { stale: false, level: null, days };
}

// 'due' penceresi: vade + 24 saat. §9 bu aralığı sabitlemiyor — hub varsayılanı.
const GATE_DUE_GRACE_MS = DAY_MS;

// gateStatus(gate, now) -> 'running' | 'due' | 'overdue'
export function gateStatus(gate, now = Date.now()) {
  const due = asTime(gate?.dueAt);
  if (due == null) return 'running';
  const nowT = toMs(now);
  if (nowT < due) return 'running';
  if (nowT - due <= GATE_DUE_GRACE_MS) return 'due';
  return 'overdue';
}
