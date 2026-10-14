// _shared/contract-reminders.ts — onaylanmayan sözleşmeye hatırlatma (2026-10-14).
// hub-daily (gece) çağırır. "Onay bekliyor" her söz için gönderimden bu yana geçen gün:
// 3 → hatırlatma, 7 → hatırlatma, 14+ → mail yok (HR Bugün "Süresi doldu"; karar cofounder'da).
// Hangi hatırlatmanın atıldığı equity_events.payload.reminder ile izlenir → aynı gün iki kez çalışsa
// da ikinci mail gitmez. Kilit (test modu / yer tutucu) AYNEN uygulanır.
import { buildContract, loadSettings } from "./contract-server.ts";
import { recipientLock, reminderDue, contractReminderMail } from "./contract-render.js";
import { sendMail } from "./resend.ts";

// deno-lint-ignore no-explicit-any
export async function runContractReminders(db: any, now = Date.now()) {
  const { data: rows } = await db.from("equity_grants").select("*").eq("status", "pending_signature").not("contract_sent_at", "is", null);
  const settings = await loadSettings(db);
  const out = { checked: 0, sent: 0, locked: 0, failed: 0 };
  for (const row of rows || []) {
    out.checked++;
    const { data: evs } = await db.from("equity_events").select("payload, happened_at").eq("grant_id", row.id).eq("kind", "note")
      .gte("happened_at", row.contract_sent_at);
    // deno-lint-ignore no-explicit-any
    const sentDays = (evs || []).map((e: any) => Number(e.payload?.reminder)).filter((x: number) => x > 0);
    const day = reminderDue(row.contract_sent_at, now, sentDays);
    if (!day) continue;
    const c = await buildContract(db, row, row.contract_template_id);
    const lock = recipientLock(settings, c.template, c.terms.holderEmail);
    if (!lock.ok) {
      await db.from("equity_events").insert({ grant_id: row.id, seat_id: row.seat_id, kind: "note", created_by: "sistem",
        note: `${day}. gün hatırlatması gönderilmedi (test modu): ${c.terms.holderEmail} test listesinde değil.`, payload: { reminder: day, skipped: true } });
      out.locked++;
      continue;
    }
    const m = contractReminderMail(c.terms, day);
    const r = await sendMail([c.terms.holderEmail], m.subject, m.body);
    await db.from("equity_events").insert({ grant_id: row.id, seat_id: row.seat_id, kind: "note", created_by: "sistem",
      note: r.ok ? `${day}. gün hatırlatma maili gönderildi → ${c.terms.holderEmail}` : `${day}. gün hatırlatma maili gönderilemedi: ${r.error}`,
      payload: { reminder: r.ok ? day : 0, mailId: r.id || null } });
    if (r.ok) out.sent++; else out.failed++;
  }
  return out;
}
