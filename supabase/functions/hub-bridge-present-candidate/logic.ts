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
  // Adım 4 — kurucunun Kapı A şablon seçicisi için (Bölüm H)
  category?: string | null;
  suggestedTemplateId?: string | null;
  weeklyHours?: number | null;   // yalnızca beklenti (saat takibi yok)
}

export interface PresentResult {
  ok: boolean;
  error?: string;
  snapshot?: any;
  offerId?: string;
  alreadyPending?: boolean;
}

// Kurucunun hâlâ karar sürecinde olduğu durumlar (hub-team-decide-offer/logic.ts ile aynı küme).
const ACTIVE = ["pending", "interview", "gate", "gate_passed"];

function effRole(u: any, tid: string): string {
  return (u.teamRoles && u.teamRoles[tid]) || u.role;
}

// snapshot'ın DIŞINDAKİ hiçbir alana dokunulmaz — yalnızca candidateOffers
// üretilir/güncellenir, geri kalanı olduğu gibi spread edilir.
export function computeOfferPresentPatch(snapshot: any, payload: PresentPayload): PresentResult {
  const { teamId, hubCandidateId, fullName, email, phone, roleTitle, note, category, suggestedTemplateId, weeklyHours } = payload || ({} as PresentPayload);

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
    (o) => o.hubCandidateId === hubCandidateId && o.teamId === teamId && ACTIVE.includes(o.status)
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
    category: category || null,
    suggestedTemplateId: suggestedTemplateId || null,
    weeklyHours: Number.isFinite(Number(weeklyHours)) && Number(weeklyHours) > 0 ? Number(weeklyHours) : null,
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

// ── Adım 3 (2026-10-04): kurucuya otomatik bildirim maili ─────────────────
// Bölüm I, Tetikleyici 1 — "Sana bir aday önerildi". Karar değil BİLGİ maili
// olduğu için çift onay YOK, sunma anında tek adımda gider. Alıcı: o ekibin
// lead'i/lead'leri; ekipte lead yoksa admin'ler (aksi halde kimse haberdar
// olmaz). E-postası olmayan kullanıcı atlanır.
export function offerMailRecipients(snapshot: any, teamId: string): { id: any; name: string; email: string }[] {
  const users: any[] = snapshot?.users || [];
  const withMail = (u: any) => typeof u.email === "string" && u.email.includes("@");
  const teamsOf = (u: any) => ((u.teams && u.teams.length) ? u.teams : (u.team ? [u.team] : []));
  const leads = users.filter((u) => withMail(u) && teamsOf(u).includes(teamId) && effRole(u, teamId) === "lead");
  const pick = leads.length ? leads : users.filter((u) => withMail(u) && u.role === "admin");
  const seen = new Set<string>();
  return pick
    .map((u) => ({ id: u.id, name: u.name || "", email: String(u.email).trim().toLowerCase() }))
    .filter((u) => (seen.has(u.email) ? false : (seen.add(u.email), true)));
}

export const TEAM_APP_URL = "https://www.starthub-community.com/team/";

export function offerNotifyMail(teamName: string, payload: PresentPayload, recipientName: string) {
  const role = payload.roleTitle || "açık rol";
  const subject = `Sana bir aday önerildi — ${role}`;
  const lines = [
    `Merhaba ${recipientName || ""},`.trim(),
    "",
    `"${teamName}" ekibi için ${role} rolüne bir aday önerildi: ${payload.fullName}.`,
  ];
  if (payload.note) lines.push("", `Neden bu kişi: ${payload.note}`);
  lines.push(
    "",
    `İncelemek ve karar vermek için Ekip Paneli'ne gir — sağ üstteki zil simgesinde bekliyor:`,
    TEAM_APP_URL,
    "",
    "Adayı bekletmemek için 1-2 gün içinde karar vermen önerilir.",
    "",
    "StartHub",
  );
  return { subject, body: lines.join("\n") };
}

// ── Adım 4: HR tarafından kapatma (istisnai — kurucu cevap vermiyorsa) ────
// 'withdrawn': cofounder sunumu geri çekti. 'rejected': cofounder Kapı A'yı
// istisnai olarak reddetti (Bölüm I — "yedek/istisnai" ret). Aktif olmayan
// teklif tekrar kapatılmaz; teklif yoksa (hiç sunulmamış) ok + noop.
export function computeOfferClosePatch(snapshot: any, p: { hubCandidateId: string; status: "withdrawn" | "rejected"; note?: string | null; now?: number }) {
  if (!p?.hubCandidateId) return { ok: false, error: "hubCandidateId zorunlu" };
  if (p.status !== "withdrawn" && p.status !== "rejected") return { ok: false, error: "status 'withdrawn' ya da 'rejected' olmalı" };
  const offers: any[] = snapshot.candidateOffers || [];
  const target = offers.find((o) => o.hubCandidateId === p.hubCandidateId && ACTIVE.includes(o.status));
  if (!target) return { ok: true, noop: true, snapshot };
  const now = p.now ?? Date.now();
  const closed = { ...target, status: p.status, closedByHr: true, rejectNote: p.note || null, decidedAt: now, log: [...(target.log || []), { at: now, by: "hr", action: p.status }] };
  return { ok: true, noop: false, offerId: target.id, snapshot: { ...snapshot, candidateOffers: offers.map((o) => (o.id === target.id ? closed : o)) } };
}
