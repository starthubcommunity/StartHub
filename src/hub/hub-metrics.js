// hub-metrics.js — saf metrik fonksiyonları (HUB_SPEC §8.7).
//
// Dönüşüm oranları MEVCUT aşama dağılımından DEĞİL, hub_stage_log'dan
// hesaplanır. Bir aşamanın paydası, o aşamaya HİÇ ULAŞMIŞ benzersiz aday
// sayısıdır. ⚠️ Arşivlenenler paydadan ÇIKARILMAZ — aksi halde oranlar yalan
// söyler (10 görüşme, 8 arşiv, 2 finalist → doğru oran %20, arşivi elemeyen
// formül %100 der).
import { STAGE_ORDER } from './hub-constants.js';

// stageLog: [{ candidateId, toStage, ... }]
// -> { [stage]: o aşamaya (veya ötesine) hiç ulaşmış benzersiz aday sayısı }
export function stageReachCounts(stageLog) {
  // Her aday için pipeline'da ulaştığı EN İLERİ index (archived pipeline dışı).
  const maxIdx = new Map();
  for (const row of stageLog || []) {
    const i = STAGE_ORDER.indexOf(row.toStage);
    if (i < 0) continue; // 'archived' vb. — pipeline dışı, ama adayın önceki
    const cur = maxIdx.get(row.candidateId); //   geçişleri sayılmaya devam eder
    if (cur == null || i > cur) maxIdx.set(row.candidateId, i);
  }
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
