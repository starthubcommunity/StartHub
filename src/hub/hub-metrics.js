// hub-metrics.js — saf metrik fonksiyonları (HUB_SPEC §8.7).
//
// Dönüşüm oranları MEVCUT aşama dağılımından DEĞİL, hub_stage_log'dan
// hesaplanır. Bir aşamanın paydası, o aşamaya HİÇ ULAŞMIŞ benzersiz aday
// sayısıdır. ⚠️ Arşivlenenler paydadan ÇIKARILMAZ — aksi halde oranlar yalan
// söyler (10 görüşme, 8 arşiv, 2 finalist → doğru oran %20, arşivi elemeyen
// formül %100 der).
import { STAGE_ORDER } from './hub-constants.js';

// Postgres interval string ("7 days", "14 days 00:00:00", "1 mon") → gün.
export function intervalToDays(str) {
  if (!str) return 7;
  const s = String(str);
  let d = 0;
  const mon = s.match(/(\d+)\s*mon/); if (mon) d += +mon[1] * 30;
  const day = s.match(/(\d+)\s*day/); if (day) d += +day[1];
  const wk = s.match(/(\d+)\s*week/); if (wk) d += +wk[1] * 7;
  return d || 7;
}

// stageLog -> Map(candidateId -> pipeline'da ulaşılan EN İLERİ index)
// 'archived' pipeline dışıdır (index -1) ama adayın önceki geçişleri sayılır.
export function reachedIndexByCandidate(stageLog) {
  const maxIdx = new Map();
  for (const row of stageLog || []) {
    const i = STAGE_ORDER.indexOf(row.toStage);
    if (i < 0) continue;
    const cur = maxIdx.get(row.candidateId);
    if (cur == null || i > cur) maxIdx.set(row.candidateId, i);
  }
  return maxIdx;
}

// stageLog: [{ candidateId, toStage, ... }]
// -> { [stage]: o aşamaya (veya ötesine) hiç ulaşmış benzersiz aday sayısı }
export function stageReachCounts(stageLog) {
  const maxIdx = reachedIndexByCandidate(stageLog);
  const counts = {};
  STAGE_ORDER.forEach((stage, i) => {
    let n = 0;
    for (const v of maxIdx.values()) if (v >= i) n++;
    counts[stage] = n;
  });
  return counts;
}

// Hat sütun başlığı oranı: o aşamaya ulaşan / bir önceki aşamaya ulaşan.
// İlk aşamada (pool) oran yok → null. Payda 0 ise null.
export function stageConversion(stageLog) {
  const counts = stageReachCounts(stageLog);
  const out = {};
  STAGE_ORDER.forEach((stage, i) => {
    if (i === 0) { out[stage] = null; return; }
    const prev = counts[STAGE_ORDER[i - 1]] || 0;
    out[stage] = prev > 0 ? Math.round((100 * (counts[stage] || 0)) / prev) : null;
  });
  return out;
}

// Kaynak kırılımı (§8.6.9, §8.7): her kaynak tipi için o aşamaya HİÇ ULAŞMIŞ
// benzersiz aday sayısı. stage_log candidateId taşır; kaynak candidates'ten.
export function sourceFunnel(candidates = [], stageLog = []) {
  const srcOf = new Map(candidates.map((c) => [c.id, c.source || 'other']));
  const maxIdx = reachedIndexByCandidate(stageLog);
  // stage_log'da hiç kaydı olmayan (yeni, pool'da) adaylar da pool'a "ulaşmış" sayılır
  for (const c of candidates) if (!maxIdx.has(c.id)) maxIdx.set(c.id, 0);

  const blank = () => Object.fromEntries(STAGE_ORDER.map((s) => [s, 0]));
  const out = {};
  for (const [cid, idx] of maxIdx) {
    const src = srcOf.get(cid) || 'other';
    if (!out[src]) out[src] = blank();
    STAGE_ORDER.forEach((stage, i) => { if (idx >= i) out[src][stage]++; });
  }
  return out;
}

// sourceStats (PROMPT_V3 E1) — kaynak BAŞINA verim. Anahtar varsayılan olarak
// source_detail ("Teknofest 2026 ulaşım kategorisi"), yoksa source ("hackathon").
// Aday sayısı DEĞİL; asıl bakılan: cevap oranı ve işe alım sayısı.
//   { [key]: { key, total, sent, replied, replyRate, hired } }
export function sourceStats(candidates = [], touches = [], stageLog = [], keyFn) {
  const kf = keyFn || ((c) => (c.sourceDetail && String(c.sourceDetail).trim()) || c.source || 'other');
  const keyOf = new Map(candidates.map((c) => [c.id, kf(c)]));
  const reached = reachedIndexByCandidate(stageLog);
  const memberIdx = STAGE_ORDER.indexOf('member');

  const out = {};
  const bump = (k) => (out[k] = out[k] || { key: k, total: 0, sent: 0, replied: 0, replyRate: null, hired: 0 });

  for (const c of candidates) {
    const k = keyOf.get(c.id);
    const row = bump(k);
    row.total++;
    const hired = c.stage === 'member' || (reached.get(c.id) ?? -1) >= memberIdx;
    if (hired) row.hired++;
  }
  for (const t of touches) {
    const k = keyOf.get(t.candidateId);
    if (k == null) continue;
    const row = bump(k);
    row.sent++;
    if (t.outcome === 'replied') row.replied++;
  }
  for (const row of Object.values(out)) {
    row.replyRate = row.sent > 0 ? Math.round((100 * row.replied) / row.sent) : null;
  }
  return out;
}

// "90 günde hâlâ aktif" (v2 §11) — GERİYE DÖNÜK HESAPLANAMAZ. hub_stage_log'dan:
// 90+ gün önce `member`'a ulaşmış adaylardan bugün hâlâ "aktif" olanların oranı.
// Henüz 90 günü dolan aday yoksa rate=null (uydurma sayı yok).
//
// E6 — "aktif"in kaynağı: `opts.productionByPerson` verilirse (Team panelinden
// gelen { [person_id]: { lastActiveAt?, tasksDone?, ctoApproved? } }), o kişi
// için GERÇEK üretim sinyali kullanılır: son 90 günde aktiflik VEYA tamamlanmış
// görev VEYA CTO onayı. Verilmezse eski davranış: hâlâ `member` aşamasında mı.
// `source` alanı hangi yolun kullanıldığını söyler.
export function active90(candidates = [], stageLog = [], now = Date.now(), opts = {}) {
  const CUT = now - 90 * 86400000;
  const prod = opts.productionByPerson || null;
  const personIdOf = new Map(candidates.map((c) => [c.id, c.personId ?? null]));

  const joinedAt = new Map(); // candidateId -> ilk member stage_log zamanı
  for (const r of stageLog) {
    if (r.toStage !== 'member' || !r.createdAt) continue;
    const t = Date.parse(r.createdAt);
    if (!joinedAt.has(r.candidateId) || t < joinedAt.get(r.candidateId)) joinedAt.set(r.candidateId, t);
  }
  const stageNow = new Map(candidates.map((c) => [c.id, c.stage]));

  const isActive = (cid) => {
    const pid = personIdOf.get(cid);
    const p = prod && pid != null ? prod[pid] : null;
    if (p) {
      if (p.ctoApproved) return true;
      if ((p.tasksDone || 0) > 0) return true;
      if (p.lastActiveAt && Date.parse(p.lastActiveAt) >= CUT) return true;
      return false;
    }
    return stageNow.get(cid) === 'member';
  };

  let eligible = 0, active = 0, withProd = 0;
  for (const [cid, t] of joinedAt) {
    if (t > CUT) continue;
    eligible++;
    const pid = personIdOf.get(cid);
    if (prod && pid != null && prod[pid]) withProd++;
    if (isActive(cid)) active++;
  }
  return {
    eligible, active,
    rate: eligible ? Math.round((100 * active) / eligible) : null,
    source: prod && withProd > 0 ? 'production' : 'stage_log',
  };
}
