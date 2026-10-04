// hub-team-decide-offer/logic.ts
// Saf, yan etkisiz mantık. Team Lead (veya admin) önerilen bir aday için
// karar akışını yürütür. Ana projeye yapılan çağrılar ve mailler index.ts'te;
// bu dosya yalnızca Team App'in KENDİ snapshot'ını hesaplar.
//
// 2026-10-04 (Adım 4/5) — üye hattında yeni sıra (StartHub_Aday_Bulma_Senaryosu
// Bölüm A/G/H/K):
//
//   pending ──interview──▶ interview          ("kendim görüşeyim" — yalnızca işaret)
//   pending|interview ──start_gate──▶ gate     (kabul = Kapı A görevi kurucudan gider)
//   gate ──evaluate(passed)──▶ gate_passed
//   gate ──evaluate(failed)──▶ rejected        (gerekçe zorunlu)
//   gate_passed ──join──▶ accepted             (gerçek üyelik: computeBridgePatch)
//   pending|interview|gate|gate_passed ──reject──▶ rejected (gerekçe zorunlu)
//   (HR'dan kapatma — geri çekme / istisnai ret — hub-bridge-present-candidate'te)
//
// "Ekibe al" artık YALNIZCA gate_passed'tan mümkün — eski bir sekmedeki
// Kabul butonu Kapı A'yı atlayamaz.

import { computeBridgePatch } from "../hub-bridge-add-member/logic.ts";

export type OfferAction = "interview" | "start_gate" | "evaluate" | "join" | "reject";

export const ACTIVE_OFFER_STATUSES = ["pending", "interview", "gate", "gate_passed"];

const FROM: Record<OfferAction, string[]> = {
  interview: ["pending"],
  start_gate: ["pending", "interview"],
  evaluate: ["gate"],
  join: ["gate_passed"],
  reject: ["pending", "interview", "gate", "gate_passed"],
};

export interface OfferActionPayload {
  offerId: string;
  action: OfferAction;
  actorId?: number | null;
  now?: number;
  note?: string | null;
  // start_gate
  gate?: { templateId?: string | null; title: string; taskText: string; durationHours: number };
  // evaluate
  result?: "passed" | "failed";
}

export interface OfferActionResult {
  ok: boolean;
  error?: string;
  snapshot?: any;
  offer?: any;
  userId?: number;
  created?: boolean;
  inviteEligible?: boolean;
}

const MIN_NOTE = 5;

export function computeOfferActionPatch(snapshot: any, p: OfferActionPayload): OfferActionResult {
  const { offerId, action, actorId = null } = p || ({} as OfferActionPayload);
  const now = p?.now ?? Date.now();
  if (!offerId) return { ok: false, error: "offerId zorunlu" };
  if (!FROM[action as OfferAction]) return { ok: false, error: `Geçersiz işlem: ${action}` };

  const offers: any[] = snapshot.candidateOffers || [];
  const offer = offers.find((o) => o.id === offerId);
  if (!offer) return { ok: false, error: `'${offerId}' adayı bulunamadı` };
  if (!FROM[action].includes(offer.status)) {
    return { ok: false, error: `Bu adım şu durumda yapılamaz (${offer.status}). Sayfayı yenileyip tekrar dene.` };
  }

  const note = (p.note || "").trim();
  const log = (entry: any) => [...(offer.log || []), { at: now, by: actorId, ...entry }];
  let next: any;

  if (action === "interview") {
    next = { ...offer, status: "interview", log: log({ action }) };
  } else if (action === "start_gate") {
    const g = p.gate;
    if (!g || !g.title?.trim() || !g.taskText?.trim()) return { ok: false, error: "Kapı A görevi seçilmeli." };
    const hours = Number(g.durationHours);
    if (!(hours >= 24 && hours <= 336)) return { ok: false, error: "Süre 1–14 gün olmalı." };
    next = {
      ...offer, status: "gate", decidedAt: now, decidedBy: actorId,
      gate: { templateId: g.templateId || null, title: g.title.trim(), taskText: g.taskText.trim(), durationHours: hours, sentAt: now, dueAt: now + hours * 3600000, result: null, evaluation: null, evaluatedAt: null },
      log: log({ action, templateId: g.templateId || null }),
    };
  } else if (action === "evaluate") {
    if (p.result !== "passed" && p.result !== "failed") return { ok: false, error: "Sonuç 'passed' ya da 'failed' olmalı." };
    if (p.result === "failed" && note.length < MIN_NOTE) return { ok: false, error: "Yetersiz bulunduysa gerekçe zorunlu." };
    next = {
      ...offer, status: p.result === "passed" ? "gate_passed" : "rejected",
      gate: { ...(offer.gate || {}), result: p.result, evaluation: note || null, evaluatedAt: now },
      ...(p.result === "failed" ? { rejectNote: note } : {}),
      log: log({ action, result: p.result }),
    };
  } else if (action === "reject") {
    if (note.length < MIN_NOTE) return { ok: false, error: "Ret gerekçesi zorunlu ve somut olmalı." };
    next = { ...offer, status: "rejected", decidedAt: now, decidedBy: actorId, rejectNote: note, log: log({ action }) };
  } else {
    // join — gerçek üyeliği hub-bridge-add-member'ın AYNI mantığıyla kur.
    const bridge = computeBridgePatch(snapshot, {
      teamId: offer.teamId,
      fullName: offer.fullName,
      email: offer.email,
      role: "member",
      source: { candidateId: offer.hubCandidateId, actorEmail: null },
    });
    if (!bridge.ok) return { ok: false, error: bridge.error };
    next = { ...offer, status: "accepted", joinedAt: now, decidedBy: actorId, log: log({ action }) };
    const newOffers = offers.map((o) => (o.id === offerId ? next : o));
    return {
      ok: true, snapshot: { ...bridge.snapshot, candidateOffers: newOffers }, offer: next,
      userId: bridge.userId, created: bridge.created, inviteEligible: !!bridge.created,
    };
  }

  const newOffers = offers.map((o) => (o.id === offerId ? next : o));
  return { ok: true, snapshot: { ...snapshot, candidateOffers: newOffers }, offer: next };
}

// ── Geriye dönük arayüz (eski istemciler 'decision' gönderir) ────────────
export interface DecidePayload {
  offerId: string;
  decision: "accepted" | "rejected";
  decidedBy?: number | null;
  note?: string | null;
}
export type DecideResult = OfferActionResult;

export function computeDecideOfferPatch(snapshot: any, payload: DecidePayload): DecideResult {
  const { offerId, decision, decidedBy = null, note = null } = payload || ({} as DecidePayload);
  if (decision !== "accepted" && decision !== "rejected") return { ok: false, error: "decision 'accepted' veya 'rejected' olmalı" };
  return computeOfferActionPatch(snapshot, {
    offerId, action: decision === "accepted" ? "join" : "reject", actorId: decidedBy,
    note: decision === "rejected" ? (note || "Gerekçe belirtilmedi (eski ekran)") : null,
  });
}

// Kapı A görev maili (kurucu önizlemede düzenleyebilir — Bölüm I, Tetikleyici 2).
// Teslim adresi kurucunun kendisi: send-mail'in reply_to'su Start-Hub'ın genel
// kutusu olduğu için "bu maile yanıt ver" denmez. Team App önizlemesi
// (offerGateMail) bu metnin AYNISINI üretir — biri değişirse diğeri de.
export function gateTaskMail(offer: any, teamName: string, gate: { title: string; taskText: string; durationHours: number }, lead: { name: string; email: string }, now = Date.now()) {
  const due = new Date(now + gate.durationHours * 3600000);
  const dueLabel = due.toLocaleString("tr-TR", { dateStyle: "medium", timeStyle: "short", timeZone: "Europe/Istanbul" });
  return {
    subject: `Start-Hub — ${teamName} için Kapı A görevin`,
    body: `Merhaba ${offer.fullName},\n\n"${teamName}" ekibinin lideri seninle bir sonraki adıma geçmek istiyor. Kapı A görevin:\n\n${gate.taskText}\n\nSon teslim: ${dueLabel}\n\nTeslimini ${lead.name} (${lead.email}) adresine gönder. Sorun olursa yine bu adrese yaz.\n\nStart-Hub`,
  };
}
