// _shared/contract-send.ts — sözleşmeyi gönder (HR "Sözleşmeyi gönder" + Ekibe Al otomatik, 2026-10-13).
// Tek yol: kilitler (recipientLock: test modu / yer tutucu), koltuk bütçesi ve çift gönderim kontrolü
// (shouldAutoSend) burada. Sıra: önce söz CAS'la "Onay bekliyor"a kilitlenir (yalnızca hâlâ
// "Teyit bekliyor"sa — tekrar basma/yarış ikinci maili engeller), sonra mail; mail gidemezse
// söz geri "Teyit bekliyor"a alınır. Her sonuç equity_events'e yazılır.
import { buildContract, loadSettings } from "./contract-server.ts";
import { recipientLock, contractInviteMail, shouldAutoSend, AUTO_SEND_REASON_TR } from "./contract-render.js";
import { seatBudget, mapGrantFromDb } from "./equity-rules.js";
import { sendMail } from "./resend.ts";

// deno-lint-ignore no-explicit-any
type Db = any;

export async function sendContractForGrant(db: Db, grantId: string, actor: string | null, opts: { auto?: boolean } = {}) {
  const { data: row } = await db.from("equity_grants").select("*").eq("id", grantId).maybeSingle();
  if (!row) return { sent: false, reason: "not_found" };
  const c = await buildContract(db, row);
  const settings = await loadSettings(db);
  const lock = recipientLock(settings, c.template, c.terms.holderEmail);
  const { data: seatGrants } = await db.from("equity_grants").select("*").eq("seat_id", row.seat_id).neq("id", row.id);
  const budget = seatBudget(c.seat, (seatGrants || []).map(mapGrantFromDb));
  const overBudget = Number(row.grant_pct) > budget.available + 1e-9;
  const decision = shouldAutoSend({ status: row.status, lock, overBudget, alreadySentAt: row.contract_sent_at });
  const tag = opts.auto ? "Ekibe Al — otomatik" : "elle";
  if (!decision.send) {
    if (opts.auto && decision.reason !== "already_sent" && decision.reason !== "already_signed") {
      await db.from("equity_events").insert({
        grant_id: row.id, seat_id: row.seat_id, kind: "note", created_by: actor,
        note: `Sözleşme otomatik gönderilmedi: ${AUTO_SEND_REASON_TR[decision.reason as keyof typeof AUTO_SEND_REASON_TR] || decision.reason}. Söz “Teyit bekliyor”da — Pay Sözleri'nden gönderilebilir.`,
      });
    }
    return { sent: false, reason: decision.reason, lockReason: lock.ok ? null : lock.reason, available: budget.available };
  }

  // 1) Kilitle (çift gönderim koruması)
  const sentAt = new Date().toISOString();
  const { data: locked } = await db.from("equity_grants").update({
    status: "pending_signature", contract_template_id: c.template.id, contract_sent_at: sentAt, contract_sent_by: actor,
  }).eq("id", row.id).eq("status", "pending_confirm").is("contract_sent_at", null).select("id");
  if (!locked?.length) return { sent: false, reason: "already_sent" };

  // 2) Mail
  const mail = contractInviteMail(c.terms);
  const r = await sendMail([c.terms.holderEmail], mail.subject, mail.body);
  if (!r.ok) {
    await db.from("equity_grants").update({ status: "pending_confirm", contract_template_id: null, contract_sent_at: null, contract_sent_by: null })
      .eq("id", row.id).eq("status", "pending_signature").eq("contract_sent_at", sentAt);
    await db.from("equity_events").insert({ grant_id: row.id, seat_id: row.seat_id, kind: "note", created_by: actor,
      note: `Sözleşme maili gönderilemedi (${tag}): ${r.error} — söz “Teyit bekliyor”a geri alındı.` });
    return { sent: false, reason: "mail_failed", error: r.error };
  }
  await db.from("equity_events").insert({
    grant_id: row.id, seat_id: row.seat_id, kind: "note", created_by: actor,
    note: `Sözleşme gönderildi (${tag}) — ${c.template.title} v${c.template.version}${c.template.isPlaceholder ? " (yer tutucu)" : ""} → ${c.terms.holderEmail}`,
    payload: { mailId: r.id || null, sha256: c.sha, templateId: c.template.id, auto: !!opts.auto },
  });
  return { sent: true, mailId: r.id || null, template: c.template, terms: c.terms, sha256: c.sha };
}
