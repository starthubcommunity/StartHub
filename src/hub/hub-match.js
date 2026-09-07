// hub-match.js — aday ↔ açık rol eşleştirme ÖNERİSİ (§12.4).
// ÖNERİ ATAMA DEĞİLDİR — insan atar. role_type eşleşmesi + beceri örtüşmesi
// + (varsa) hat uyumu. Saf fonksiyonlar.
const norm = (s) => String(s || '').toLowerCase().trim();

export function matchScore(candidate, role) {
  if (!candidate || !role) return 0;
  let score = 0;
  if (candidate.roleType && role.roleType && candidate.roleType === role.roleType) score += 2;
  const cs = new Set((candidate.skills || []).map(norm).filter(Boolean));
  const rs = (role.skills || []).map(norm).filter(Boolean);
  const hit = rs.filter((s) => cs.has(s)).length;
  score += hit;
  if (hit > 0 && candidate.track && role.track && candidate.track === role.track) score += 1;
  return score;
}

const OPEN = ['draft', 'requested', 'sourcing', 'shortlist'];

export function suggestRolesFor(candidate, openRoles = [], { min = 2, limit = 4 } = {}) {
  return openRoles
    .filter((r) => OPEN.includes(r.status))
    .map((r) => ({ role: r, score: matchScore(candidate, r) }))
    .filter((x) => x.score >= min)
    .sort((a, b) => b.score - a.score)
    .slice(0, limit);
}

export function suggestCandidatesFor(role, candidates = [], { min = 2, limit = 6 } = {}) {
  return candidates
    .filter((c) => c.stage !== 'archived' && !c.openRoleId)
    .map((c) => ({ candidate: c, score: matchScore(c, role) }))
    .filter((x) => x.score >= min)
    .sort((a, b) => b.score - a.score)
    .slice(0, limit);
}

// E4 — yeni rol açılınca arşivdeki UYGUN adayları hatırlat. Yalnızca
// "vakti yok" / "çıtanın altında" sebepli arşivler (yeniden değerlendirilebilir).
export const REMINDER_ARCHIVE_REASONS = ['no_time', 'below_bar'];
// Havuz bu boyuta ulaşmadan öneri açılmaz (gürültü olur).
export const MATCH_MIN_POOL = 100;

export function suggestArchivedFor(role, candidates = [], { min = 2, limit = 5 } = {}) {
  return candidates
    .filter((c) => c.stage === 'archived' && REMINDER_ARCHIVE_REASONS.includes(c.archiveReason))
    .map((c) => ({ candidate: c, score: matchScore(c, role) }))
    .filter((x) => x.score >= min)
    .sort((a, b) => b.score - a.score)
    .slice(0, limit);
}
