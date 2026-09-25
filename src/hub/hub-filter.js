// hub-filter.js — aday listesi filtre mantığı (SAF, yan etkisiz).
// filter-bar.jsx yalnızca görsel katman; kural burada, node testinden geçer.
import { rubricCompleteFor, isStale } from './hub-rules.js';

export const EMPTY_FILTERS = {
  q: '', stage: [], source: [], openRoleId: [], chip: '',
  interest: [],   // ilgi alanı kutucukları (boş ilgi alanı = 'none')
};

// Hazır çipler (HUB_SPEC v3 §5). Tek seçim; sessionStorage'da kalır.
export const QUICK_CHIPS = [
  { key: 'mine',              label: 'Benim adaylarım' },
  { key: 'awaiting_reply',    label: 'Cevap bekleyenler' },
  { key: 'awaiting_decision', label: 'Karar bekleyenler' },
  { key: 'no_message',        label: 'Hiç mesaj atılmamış' },
  { key: 'stale',             label: 'Bayatlamış' },
];

// chipPredicate(key, ctx) -> (candidate) => boolean
// ctx: { currentMemberId, touchesByCand: { [id]: touches[] (sent_at desc) }, now, openRoles }
export function chipPredicate(key, ctx = {}) {
  const { currentMemberId = null, touchesByCand = {}, now = Date.now(), openRoles = [] } = ctx;
  // Rubriğin "tam" sayılması HAT BAZINDA farklı (bkz. rubricCompleteFor) —
  // üye hattında iletişim ekseni yalnızca rol needs_communication ise şart.
  // Bu çip önceden her zaman kurucu-hattı sıkı kontrolünü (rubricComplete)
  // kullanıyordu; today.jsx'teki "Karar bekleyenler" bloğuyla tutarsızdı
  // (2026-09-16 bulgusu) — aynı role-duyarlı fonksiyona hizalandı.
  const roleOf = (c) => openRoles.find((r) => r.id === c.openRoleId) || null;
  switch (key) {
    case 'mine':
      return (c) => !!c.ownerId && c.ownerId === currentMemberId;
    case 'awaiting_reply':
      return (c) => {
        if (c.stage !== 'contact') return false;
        const last = (touchesByCand[c.id] || [])[0];
        return !!last && last.outcome === 'pending';
      };
    case 'awaiting_decision':
      return (c) =>
        (c.stage === 'interview' && rubricCompleteFor(c, roleOf(c))) ||
        (!!c.presentedAt && (!c.ownerDecision || c.ownerDecision === 'pending'));
    case 'no_message':
      return (c) => c.stage === 'pool' && (touchesByCand[c.id] || []).length === 0;
    case 'stale':
      return (c) => isStale(c, now).stale;
    default:
      return () => true;
  }
}

// Saf: aday listesini filtrelere göre süzer. archived HER ZAMAN elenir
// (arşiv ayrı sayfa — B1). member de HER ZAMAN elenir (2026-09-25) — ekibe
// alınan kişi artık "aday" değil, yönetimi Team Management'a taşınıyor;
// Adaylar listesinde kalması karışıklık yaratıyordu. roles.jsx'teki rol
// başına aşama dökümü (funnel) applyFilters KULLANMIYOR, oradan etkilenmez.
export function applyFilters(candidates, filters, ctx = {}) {
  const f = { ...EMPTY_FILTERS, ...(filters || {}) };
  const q = f.q.trim().toLowerCase();
  const chipFn = f.chip ? chipPredicate(f.chip, ctx) : null;
  return (candidates || []).filter((c) => {
    if (c.stage === 'archived' || c.stage === 'member') return false;
    if (q) {
      const hay = [c.fullName, c.university, c.sourceDetail].filter(Boolean).join(' ').toLowerCase();
      if (!hay.includes(q)) return false;
    }
    if (f.stage.length && !f.stage.includes(c.stage)) return false;
    if (f.source.length && !f.source.includes(c.source)) return false;
    if (f.openRoleId.length && !f.openRoleId.includes(c.openRoleId || '')) return false;
    if (f.interest.length && !f.interest.includes(c.interest || 'none')) return false;
    if (chipFn && !chipFn(c)) return false;
    return true;
  });
}

export function countActiveFilters(filters) {
  const f = { ...EMPTY_FILTERS, ...(filters || {}) };
  return ['stage', 'source', 'openRoleId', 'interest'].reduce((n, k) => n + f[k].length, 0)
    + (f.q.trim() ? 1 : 0) + (f.chip ? 1 : 0);
}
