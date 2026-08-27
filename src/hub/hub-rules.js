// hub-rules.js — Kurucu Hattı kural motoru (HUB_SPEC §9).
//
// Saf, yan etkisiz fonksiyonlar. Arayüz bunları ÇAĞIRIR; eşik / aşama-geçiş /
// bayatlama mantığı BAŞKA HİÇBİR YERDE tekrarlanmaz. Hiçbir bileşen kendi
// eşik kontrolünü yazmaz.
import { THRESHOLD, STALE } from './hub-constants.js';

const DAY_MS = 86400000;
const daysBetween = (from, to) => Math.floor((to - from) / DAY_MS);
const asTime = (v) => (v ? new Date(v).getTime() : null);
const toMs = (now) => (typeof now === 'number' ? now : new Date(now).getTime());
const filled = (v) => v !== null && v !== undefined && String(v).trim() !== '';

// Rubriğin üç ekseni de girilmiş mi (§2.3).
export function rubricComplete(c) {
  return c?.scoreFinishing != null && c?.scoreCommunication != null && c?.scoreCapacity != null;
}

// Finalist puan eşiği: toplam ≥ 10 VE hiçbir eksen ≤ 2 (§2.3 / §9).
// Kırmızı bayrak kuralı ayrı — bkz. canAdvance('finalist').
export function thresholdMet(c) {
  if (!rubricComplete(c)) return false;
  const axes = [c.scoreFinishing, c.scoreCommunication, c.scoreCapacity];
  const total = axes.reduce((s, n) => s + n, 0);
  return total >= THRESHOLD.minTotal && Math.min(...axes) >= THRESHOLD.minAxis;
}

// canAdvance(candidate, toStage, ctx?) -> { ok, reason? }
// ctx: { role, touchCount, interviewCount, gates } — verilmezse candidate
// alanlarından türetilir.
export function canAdvance(candidate, toStage, ctx = {}) {
  const c = candidate || {};
  const { role = null, touchCount = null, interviewCount = null, gates = null } = ctx;

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
      return rubricComplete(c)
        ? { ok: true }
        : { ok: false, reason: 'Rubrik doldurulmadan görüşme aşamasına geçilemez — üç eksen de girilmeli.' };
    }

    case 'finalist': {
      if (!thresholdMet(c))
        return {
          ok: false,
          reason: `Eşik sağlanmadı: toplam ≥ ${THRESHOLD.minTotal} ve hiçbir eksen ≤ ${THRESHOLD.minAxis - 1} olmamalı.`,
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

    case 'archived': {
      return filled(c.archiveReason)
        ? { ok: true }
        : { ok: false, reason: 'Arşivleme sebebi zorunludur.' };
    }

    default:
      // pool / replied / joined ve tanımsız hedefler: §9'da makine kısıtı yok.
      return { ok: true };
  }
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
