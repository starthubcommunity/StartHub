// hub-rules.js — Kurucu Hattı kural motoru (HUB_SPEC v2 §2, §13).
//
// Saf, yan etkisiz fonksiyonlar. Arayüz bunları ÇAĞIRIR; eşik / aşama-geçiş /
// bayatlama mantığı BAŞKA HİÇBİR YERDE tekrarlanmaz.
//
// v2: 5 aşama (pool → contact → interview → trial → member) + archived.
// Kapı A/B ayrı aşama DEĞİL — trial içinde hub_gates.gate ile. Üye hattında
// Kapı B yoktur; bu tek fark, ayrı sıra (stageOrderFor) gerektirmez.
import { THRESHOLD, STALE, STAGE_LABEL, STAGE_ORDER } from './hub-constants.js';

const DAY_MS = 86400000;
const daysBetween = (from, to) => Math.floor((to - from) / DAY_MS);
const asTime = (v) => (v ? new Date(v).getTime() : null);
const toMs = (now) => (typeof now === 'number' ? now : new Date(now).getTime());
const filled = (v) => v !== null && v !== undefined && String(v).trim() !== '';

// Rubriğin üç ekseni de girilmiş mi (kurucu hattı).
export function rubricComplete(c) {
  return c?.scoreFinishing != null && c?.scoreCommunication != null && c?.scoreCapacity != null;
}

// Bu HATTIN rubriği dolu mu? Kurucu: üç eksen. Üye: bitirmişlik + kapasite
// (iletişim yalnızca rol needs_communication ise).
export function rubricCompleteFor(c, openRole = null) {
  if ((c?.track || 'founder') === 'member') {
    if (c?.scoreFinishing == null || c?.scoreCapacity == null) return false;
    if (openRole?.needsCommunication && c?.scoreCommunication == null) return false;
    return true;
  }
  return rubricComplete(c);
}

// Puan eşiği — HAT BAZINDA. Kırmızı bayrak kuralı ayrı — bkz. canAdvance('trial').
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

// İnsan-okunur eşik açıklaması — ham formül değil, cümle (v2 §2.3).
export function thresholdText(track = 'founder', openRole = null) {
  if (track === 'member') {
    const t = THRESHOLD.member;
    return `bitirmişlik ≥ ${t.minFinishing} ve kapasite ≥ ${t.minCapacity}` +
      (openRole?.needsCommunication ? ` ve iletişim ≥ ${t.minCommunication}` : '');
  }
  const t = THRESHOLD.founder;
  return `toplam ≥ ${t.minTotal} ve hiçbir eksen ≤ ${t.minAxis - 1}`;
}

// Hedefin kendi çıkış koşulu. Sıra kontrolü ayrı — canAdvance.
function targetGate(c, toStage, ctx = {}) {
  const { touchCount = null, openRole = null } = ctx;
  const track = c.track || 'founder';

  switch (toStage) {
    case 'contact': {
      const hasTouch = touchCount != null ? touchCount > 0 : filled(c.lastContactAt);
      return hasTouch
        ? { ok: true }
        : { ok: false, reason: 'Önce bir temas kaydı olmalı — mesaj gönderilmeli.' };
    }

    case 'interview': {
      // "Bu kişiyle konuştum" demek — rubrik GÖRÜŞMEDEN ÇIKIŞTA (trial'a geçişte)
      // aranır, girişte değil. Kısıt yok.
      return { ok: true };
    }

    case 'trial': {
      // Görüşmenin "geçme kararı": rubrik + eşik. v3 (PROMPT_V3 A4):
      // kırmızı bayrak kilidi kaldırıldı — kararı insan verir.
      if (!rubricCompleteFor(c, openRole))
        return {
          ok: false,
          reason: 'Rubrik doldurulmadan Deneme\'ye geçilemez — üye hattında bitirmişlik ve kapasite, kurucu hattında üç eksen de girilmeli.',
        };
      if (!thresholdMet(c, openRole))
        return {
          ok: false,
          reason: `Eşik sağlanmadı (${track === 'member' ? 'üye' : 'kurucu'} hattı): ${thresholdText(track, openRole)}.`,
        };
      return { ok: true };
    }

    default:
      // pool / member ve tanımsız hedefler: makine kısıtı yok. member'a geçiş
      // Deneme'deki kapı kartı (GateCard) tarafından sürülür.
      return { ok: true };
  }
}

// canAdvance(candidate, toStage, ctx?) -> { ok, reason? }
// Sıra zorunluluğu: ileri yönde yalnızca bir adım serbest. Fazlası reddedilir;
// yalnızca role==='cofounder' ve overrideReason dolu ise geçer. Geri gitmek
// serbest. archived her aşamadan, archive_reason zorunlu.
// ctx: { role, touchCount, openRole }.
export function canAdvance(candidate, toStage, ctx = {}) {
  const c = candidate || {};
  const { role = null } = ctx;

  // archived — her aşamadan, sebep zorunlu
  if (toStage === 'archived') {
    return filled(c.archiveReason)
      ? { ok: true }
      : { ok: false, reason: 'Arşivleme sebebi zorunludur.' };
  }

  const order = STAGE_ORDER;
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
// Aday proje sahibine SUNULABİLİR mi — hat eşiği sağlandı mı, kırmızı bayrak
// < eşik mi, bir açık role bağlı mı.
export function presentGate(candidate, openRole) {
  const c = candidate || {};
  if (!openRole) return { ok: false, reason: 'Aday bir açık role bağlanmalı.' };
  const track = c.track || 'founder';
  if (!thresholdMet(c, openRole)) {
    return { ok: false, reason: `Eşik sağlanmadı (${track === 'member' ? 'üye' : 'kurucu'} hattı): ${thresholdText(track, openRole)}.` };
  }
  return { ok: true };
}

// inheritedTrack(role, currentTrack) -> aday hattı (§10)
// Bir aday açık role bağlandığında track ROLDEN miras alınır. Rol yoksa
// mevcut track korunur — bağlantı kaldırılınca geri alma YOKTUR.
export function inheritedTrack(role, currentTrack = 'founder') {
  return role?.track || currentTrack || 'founder';
}

// roleStatusAfterReject(role, roleCandidates, rejectedId) -> yeni durum
// "Ret asılı bırakılmaz": proje sahibi bir adayı reddettiğinde, o role bağlı
// BAŞKA `pending` sunulmuş aday yoksa rol `sourcing`'e döner; varsa
// `shortlist`'te kalır. Yalnızca `shortlist`'ten geri döndürür.
export function roleStatusAfterReject(role, roleCandidates, rejectedId) {
  if (!role || role.status !== 'shortlist') return role?.status ?? null;
  const othersPending = (roleCandidates || []).some(
    (c) => c.id !== rejectedId && c.openRoleId === role.id && c.ownerDecision === 'pending'
  );
  return othersPending ? 'shortlist' : 'sourcing';
}

// isStale(candidate, now) -> { stale, level: 'warn'|'critical'|null, days }
// v2 §12: bayatlama istemcide. Aşamaya göre sayaç referansı ve eşikler:
//   contact   → lastContactAt   (7 / 14 gün)
//   interview → stageChangedAt  (5 / 10)
//   trial     → stageChangedAt  (5 / 10)
//   diğerleri → bayatlama uygulanmaz
// ⚠️ updatedAt ASLA referans DEĞİLDİR.
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

// gateDueAt(gate) -> efektif vade (ms). Taban vade + uzatma günleri (v2 §2.2).
// Taban vade `baseDueAt` yoksa `dueAt`'tir; `extendedDays` birikimlidir.
export function gateDueAt(gate) {
  const base = asTime(gate?.baseDueAt) ?? asTime(gate?.dueAt);
  if (base == null) return null;
  return base + (Number(gate?.extendedDays) || 0) * DAY_MS;
}

// 'due' penceresi: vade + 24 saat.
const GATE_DUE_GRACE_MS = DAY_MS;

// gateStatus(gate, now) -> 'running' | 'due' | 'overdue' — efektif vadeye göre.
export function gateStatus(gate, now = Date.now()) {
  const due = gateDueAt(gate);
  if (due == null) return 'running';
  const nowT = toMs(now);
  if (nowT < due) return 'running';
  if (nowT - due <= GATE_DUE_GRACE_MS) return 'due';
  return 'overdue';
}

// nextAction(candidate, touches, gates) -> { key, label } | null   (PROMPT_V3 A7)
// v3: elle seçilen `next_action` alanı kaldırıldı. Sıradaki adım aşamadan +
// temas/kapı durumundan TÜRETİLİR. Saf fonksiyon; UI ve liste bunu çağırır.
//   Havuz                        → "mesaj at"
//   Temas + cevap yok            → "takip et"
//   Temas + cevap var            → "görüşme ayarla"
//   Görüşme + puan eksik         → "görüş"
//   Görüşme + puan tam           → "karar ver"
//   Deneme + kapı yok            → "kapı başlat"
//   Deneme + kapı sürüyor        → "sonucu bekle"
//   Ekipte / arşiv               → null
export function nextAction(candidate, touches = [], gates = []) {
  const c = candidate || {};
  const mine = (arr) => (arr || []).filter((x) => x.candidateId === c.id);

  switch (c.stage) {
    case 'pool':
      return { key: 'message', label: 'Mesaj at' };

    case 'contact': {
      const ts = mine(touches).sort((a, b) => new Date(b.sentAt) - new Date(a.sentAt));
      const replied = ts.some((t) => t.outcome === 'replied');
      return replied
        ? { key: 'schedule_interview', label: 'Görüşme ayarla' }
        : { key: 'follow_up', label: 'Takip et' };
    }

    case 'interview':
      return rubricComplete(c)
        ? { key: 'decide', label: 'Karar ver' }
        : { key: 'interview', label: 'Görüş' };

    case 'trial': {
      const gs = mine(gates);
      const running = gs.some((g) => g.result === 'pending');
      if (running) return { key: 'await_result', label: 'Sonucu bekle' };
      return gs.length === 0
        ? { key: 'start_gate', label: 'Kapı başlat' }
        : { key: 'await_result', label: 'Sonucu bekle' };
    }

    default:
      return null;   // member / archived
  }
}

// canDraftAI(candidate) -> boolean (v2 §7)
// AI, adayın somut verisi (kaynak detayı, "neden bu kişi", kanıt linki) boşsa
// taslak üretmez — UI "Veri yetersiz, elle yaz" uyarısı gösterir.
export function canDraftAI(candidate) {
  const c = candidate || {};
  return (
    filled(c.sourceDetail) ||
    filled(c.whyThisOne) ||
    (Array.isArray(c.evidence) && c.evidence.length > 0)
  );
}

// candidateVisible(candidate, ctx) -> bir üye bu adayı görebilir mi? (§10.2)
// ctx.readAll: candidates.read_all (cofounder/recruiter) → her aday.
// yoksa: yalnızca KENDİ projesine SUNULMUŞ aday. SQL hub_sees_candidate() ile aynı.
export function candidateVisible(candidate, { readAll = false, myStartupIds = [] } = {}) {
  if (readAll) return true;
  if (!candidate) return false;
  return (
    candidate.presentedAt != null &&
    candidate.startupId != null &&
    (myStartupIds || []).includes(candidate.startupId)
  );
}
