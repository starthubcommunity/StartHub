// hub-bridge-present-candidate/logic.ts
// Saf, yan etkisiz mantık — hub-bridge-add-member/logic.ts ile aynı desen
// (Deno hem de Node'dan test edilebilir). Kurucu Hattı'nda üye hattındaki bir
// aday Kapı A'yı geçince "Proje sahibine sun" ile buraya bir "bekleyen aday"
// (candidateOffer) kaydı düşer — Team App'in KENDİ app_state'inde durur, o
// ekibin Team Lead'i (veya admin) Team sayfasında görüp Kabul/Ret verir
// (bkz. hub-team-decide-offer). Karar HR'a `hub-owner-decision` ile döner.

function uid(): string {
  return "o" + Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
}

export interface PresentPayload {
  teamId: string;
  hubCandidateId: string;
  fullName: string;
  email: string;
  phone?: string | null;
  roleTitle?: string | null;
  note?: string | null;
}

export interface PresentResult {
  ok: boolean;
  error?: string;
  snapshot?: any;
  offerId?: string;
  alreadyPending?: boolean;
}

function effRole(u: any, tid: string): string {
  return (u.teamRoles && u.teamRoles[tid]) || u.role;
}

// snapshot'ın DIŞINDAKİ hiçbir alana dokunulmaz — yalnızca candidateOffers
// üretilir/güncellenir, geri kalanı olduğu gibi spread edilir.
export function computeOfferPresentPatch(snapshot: any, payload: PresentPayload): PresentResult {
  const { teamId, hubCandidateId, fullName, email, phone, roleTitle, note } = payload || ({} as PresentPayload);

  const errors: string[] = [];
  if (!teamId) errors.push("teamId zorunlu");
  if (!hubCandidateId) errors.push("hubCandidateId zorunlu");
  if (!email) errors.push("email zorunlu");
  if (!fullName) errors.push("fullName zorunlu");
  if (errors.length) return { ok: false, error: errors.join(", ") };

  const team = (snapshot.teams || []).find((t: any) => t.id === teamId);
  if (!team) return { ok: false, error: `Team app'te '${teamId}' ekibi yok` };

  const offers: any[] = snapshot.candidateOffers || [];
  const existing = offers.find(
    (o) => o.hubCandidateId === hubCandidateId && o.teamId === teamId && o.status === "pending"
  );
  if (existing) {
    // İdempotent — aynı aday için ikinci "sun" tıklaması yeni kayıt açmaz.
    return { ok: true, snapshot, offerId: existing.id, alreadyPending: true };
  }

  const offer = {
    id: uid(),
    teamId,
    hubCandidateId,
    fullName: fullName.trim(),
    email: email.trim().toLowerCase(),
    phone: phone || null,
    roleTitle: roleTitle || null,
    note: note || null,
    status: "pending",
    createdAt: Date.now(),
    decidedAt: null,
    decidedBy: null,
  };
  const newOffers = [offer, ...offers];

  // Bildirim: bu ekibin lead'i + tüm admin'ler (Team sayfasındaki panelini
  // görebilecek herkes — canManageTeam ile aynı kapsam).
  const notifyUsers: any[] = (snapshot.users || []).filter(
    (u: any) => u.role === "admin" || (((u.teams && u.teams.length) ? u.teams : (u.team ? [u.team] : [])).includes(teamId) && effRole(u, teamId) === "lead")
  );
  const newNotifs = notifyUsers.map((u) => ({
    id: uid(), type: "candidate_offer", forUser: u.id, actor: null, teamId, entityId: offer.id,
    text: `${team.name} ekibi için bir aday sunuldu: ${offer.fullName}`,
    ts: Date.now(), read: false,
  }));
  const notifications = [...newNotifs, ...(snapshot.notifications || [])];

  const newSnapshot = { ...snapshot, candidateOffers: newOffers, notifications };
  return { ok: true, snapshot: newSnapshot, offerId: offer.id, alreadyPending: false };
}
