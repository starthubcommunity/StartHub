// hub-team-decide-offer/logic.ts
// Saf, yan etkisiz mantık. Team Lead (veya admin) Team sayfasındaki "Bekleyen
// Adaylar" panelinde Kabul/Ret verince çağrılır. Kabul: hub-bridge-add-member
// ile AYNI ekleme mantığını (computeBridgePatch) çağırır — kod tekrarlanmaz,
// doğrudan import edilir. Ret: yalnızca teklifi 'rejected' işaretler.
// Her iki durumda da karar HR'a (hub-owner-decision ile) ayrıca bildirilir —
// bu dosya yalnızca Team App'in KENDİ snapshot'ını hesaplar, ana projeye
// yapılan çağrı index.ts'te.

import { computeBridgePatch } from "../hub-bridge-add-member/logic.ts";

export interface DecidePayload {
  offerId: string;
  decision: "accepted" | "rejected";
  decidedBy?: number | null;
}

export interface DecideResult {
  ok: boolean;
  error?: string;
  snapshot?: any;
  offer?: any;
  userId?: number;
  created?: boolean;
  inviteEligible?: boolean;   // accepted + created/addedToTeam -> davet maili gönderilmeli
}

export function computeDecideOfferPatch(snapshot: any, payload: DecidePayload): DecideResult {
  const { offerId, decision, decidedBy = null } = payload || ({} as DecidePayload);

  if (!offerId) return { ok: false, error: "offerId zorunlu" };
  if (decision !== "accepted" && decision !== "rejected") return { ok: false, error: "decision 'accepted' veya 'rejected' olmalı" };

  const offers: any[] = snapshot.candidateOffers || [];
  const offer = offers.find((o) => o.id === offerId);
  if (!offer) return { ok: false, error: `'${offerId}' bekleyen adayı bulunamadı` };
  if (offer.status !== "pending") return { ok: false, error: `Bu aday zaten karara bağlanmış (${offer.status})` };

  if (decision === "rejected") {
    const newOffers = offers.map((o) => (o.id === offerId ? { ...o, status: "rejected", decidedAt: Date.now(), decidedBy } : o));
    return { ok: true, snapshot: { ...snapshot, candidateOffers: newOffers }, offer: newOffers.find((o) => o.id === offerId) };
  }

  // decision === 'accepted' — gerçek üyeliği hub-bridge-add-member'ın AYNI mantığıyla kur.
  const bridge = computeBridgePatch(snapshot, {
    teamId: offer.teamId,
    fullName: offer.fullName,
    email: offer.email,
    role: "member",
    source: { candidateId: offer.hubCandidateId, actorEmail: null },
  });
  if (!bridge.ok) return { ok: false, error: bridge.error };

  const newOffers = offers.map((o) => (o.id === offerId ? { ...o, status: "accepted", decidedAt: Date.now(), decidedBy } : o));
  const finalSnapshot = { ...bridge.snapshot, candidateOffers: newOffers };

  return {
    ok: true,
    snapshot: finalSnapshot,
    offer: newOffers.find((o) => o.id === offerId),
    userId: bridge.userId,
    created: bridge.created,
    inviteEligible: !!bridge.created,
  };
}
