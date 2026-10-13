// _shared/resend.ts — Resend ile mail (ana proje secret'ları: RESEND_API_KEY, MAIL_FROM, REPLY_TO).
// contract-send.ts ve contract-delivery.ts ortak kullanır.
const RESEND_API_KEY = Deno.env.get("RESEND_API_KEY");
const FROM_EMAIL = Deno.env.get("MAIL_FROM") || "StartHub <no-reply@mail.starthub-community.com>";
const REPLY_TO = Deno.env.get("REPLY_TO") || "starthub.community@gmail.com";

export async function sendMail(to: string[], subject: string, text: string, attachments?: { filename: string; content: string }[]) {
  if (!RESEND_API_KEY) return { ok: false, error: "RESEND_API_KEY tanımlı değil" };
  const res = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: { Authorization: `Bearer ${RESEND_API_KEY}`, "Content-Type": "application/json; charset=utf-8" },
    body: JSON.stringify({ from: FROM_EMAIL, to, subject, text, reply_to: REPLY_TO, ...(attachments ? { attachments } : {}) }),
  });
  const b = await res.json().catch(() => null);
  return res.ok ? { ok: true, id: (b?.id as string) || null } : { ok: false, error: JSON.stringify(b?.message || b || res.status) };
}
