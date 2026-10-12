// _shared/contract-delivery.ts — kabul sonrası teslim (B, 0061). Servis rolüyle çalışır.
//   1) PDF: yoksa üret → contract-pdfs/<grant>/<acceptance>.pdf → contract_documents
//      varsa depodan indir, SHA-256'yı kayıtla karşılaştır (uyuşmazsa mail GİTMEZ, olay yazılır)
//   2) Kişiye bilgi maili + PDF eki — recipientLock (test modu / yer tutucu metin → yalnızca test adresleri)
//   3) Cofounder'lara "onaylandı" maili — test modunda yalnızca test adresleri, canlıda
//      HR'daki etkin cofounder kayıtlarının e-postaları (koda sabit adres yok)
// Her adımın sonucu equity_events'e 'note' olarak yazılır. Hiçbir adım kabul kaydını geri almaz.
import { PDFDocument, rgb } from "npm:pdf-lib@1.17.1";
import fontkit from "npm:@pdf-lib/fontkit@1.1.1";
import { buildAcceptancePdf, pdfInputFromAcceptance, fontBytes, istanbulDateTimeText } from "./contract-pdf.js";
import {
  recipientLock, cofounderMailRecipients, acceptedHolderMail, acceptedCofounderMail, pdfFileName,
  mapTemplateFromDb,
} from "./contract-render.js";
import { loadSettings, sha256Hex } from "./contract-server.ts";

export const PDF_BUCKET = "contract-pdfs";
const RESEND_API_KEY = Deno.env.get("RESEND_API_KEY");
const FROM_EMAIL = Deno.env.get("MAIL_FROM") || "StartHub <no-reply@mail.starthub-community.com>";
const REPLY_TO = Deno.env.get("REPLY_TO") || "starthub.community@gmail.com";

// deno-lint-ignore no-explicit-any
type Db = any;

const bytesSha = async (bytes: Uint8Array) => {
  const buf = await crypto.subtle.digest("SHA-256", bytes);
  return [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, "0")).join("");
};
const toB64 = (bytes: Uint8Array) => {
  let s = ""; const CH = 0x8000;
  for (let i = 0; i < bytes.length; i += CH) s += String.fromCharCode(...bytes.subarray(i, i + CH));
  return btoa(s);
};

export async function sendMail(to: string[], subject: string, text: string, attachments?: { filename: string; content: string }[]) {
  if (!RESEND_API_KEY) return { ok: false, error: "RESEND_API_KEY tanımlı değil" };
  const res = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: { Authorization: `Bearer ${RESEND_API_KEY}`, "Content-Type": "application/json; charset=utf-8" },
    body: JSON.stringify({ from: FROM_EMAIL, to, subject, text, reply_to: REPLY_TO, ...(attachments ? { attachments } : {}) }),
  });
  const b = await res.json().catch(() => null);
  return res.ok ? { ok: true, id: b?.id || null } : { ok: false, error: JSON.stringify(b?.message || b || res.status) };
}

async function logEvent(db: Db, grantId: string, seatId: string, note: string, payload: Record<string, unknown>) {
  await db.from("equity_events").insert({ grant_id: grantId, seat_id: seatId, kind: "note", note, payload, created_by: "sistem" });
}

// PDF'i hazırla (yoksa üret, varsa doğrula). Dönüş: { bytes, doc, created } ya da { error, tampered? }
export async function ensurePdf(db: Db, acc: any, grant: any, templateTitle: string) {
  const { data: existing } = await db.from("contract_documents").select("*").eq("acceptance_id", acc.id).maybeSingle();
  if (existing) {
    const { data: blob, error } = await db.storage.from(PDF_BUCKET).download(existing.storage_path);
    if (error || !blob) return { error: "PDF dosyası depoda bulunamadı", fileMissing: true, doc: existing };
    const bytes = new Uint8Array(await blob.arrayBuffer());
    const sha = await bytesSha(bytes);
    if (sha !== existing.pdf_sha256) return { error: "PDF parmak izi kayıttakiyle uyuşmuyor", tampered: true, doc: existing, actualSha: sha };
    return { bytes, doc: existing, created: false };
  }
  const { bytes } = await buildAcceptancePdf({ PDFDocument, rgb, fontkit, ...fontBytes() }, pdfInputFromAcceptance(acc, templateTitle));
  const path = `${grant.id}/${acc.id}.pdf`;
  const up = await db.storage.from(PDF_BUCKET).upload(path, bytes, { contentType: "application/pdf", upsert: false });
  if (up.error) return { error: "PDF depoya yazılamadı: " + up.error.message };
  const sha = await bytesSha(bytes);
  const { data: doc, error: de } = await db.from("contract_documents").insert({
    acceptance_id: acc.id, grant_id: grant.id, storage_path: path, pdf_sha256: sha, size_bytes: bytes.length,
  }).select("*").single();
  if (de) return { error: "PDF kaydı yazılamadı: " + de.message };
  return { bytes, doc, created: true };
}

export async function deliverAcceptance(db: Db, acceptanceId: string, opts: { notifyCofounders?: boolean } = {}) {
  const notifyCofounders = opts.notifyCofounders !== false;
  const out: Record<string, unknown> = { acceptanceId };
  const { data: acc } = await db.from("contract_acceptances").select("*").eq("id", acceptanceId).maybeSingle();
  if (!acc) return { ok: false, error: "Kabul kaydı bulunamadı" };
  const { data: grant } = await db.from("equity_grants").select("id, seat_id, start_date").eq("id", acc.grant_id).single();
  const { data: tplRow } = await db.from("contract_templates").select("*").eq("id", acc.template_id).single();
  const tpl = mapTemplateFromDb(tplRow);
  const terms = acc.terms || {};
  const acceptedAtText = istanbulDateTimeText(acc.accepted_at);
  const settings = await loadSettings(db);

  // 1) PDF
  const pdf: any = await ensurePdf(db, acc, grant, tpl.title);
  if (pdf.error) {
    await logEvent(db, grant.id, grant.seat_id, `Kabul belgesi PDF'i: ${pdf.error}`, { acceptanceId, tampered: !!pdf.tampered, actualSha: pdf.actualSha || null });
    out.pdf = { ok: false, error: pdf.error, tampered: !!pdf.tampered };
  } else {
    out.pdf = { ok: true, created: pdf.created, size: pdf.doc.size_bytes, sha256: pdf.doc.pdf_sha256 };
    if (pdf.created) await logEvent(db, grant.id, grant.seat_id, `Kabul belgesi PDF'i üretildi (${pdf.doc.size_bytes} bayt).`, { acceptanceId, pdfSha256: pdf.doc.pdf_sha256 });
  }

  // 2) Kişiye bilgi maili (PDF ekli) — PDF yoksa/bozuksa gitmez
  if (pdf.bytes) {
    const lock = recipientLock(settings, tpl, acc.holder_email);
    if (!lock.ok) {
      await logEvent(db, grant.id, grant.seat_id, `PDF maili gönderilmedi (test modu): ${acc.holder_email} test listesinde değil.`, { acceptanceId });
      out.holderMail = { ok: false, skipped: "test_mode" };
    } else {
      const m = acceptedHolderMail(terms, { acceptedAtText, startDate: grant.start_date, version: acc.template_version });
      const r = await sendMail([acc.holder_email], m.subject, m.body, [{ filename: pdfFileName(terms.project, acc.template_version), content: toB64(pdf.bytes) }]);
      await logEvent(db, grant.id, grant.seat_id, r.ok ? `PDF ekli “onaylandı” maili gönderildi → ${acc.holder_email}` : `PDF maili gönderilemedi: ${r.error}`, { acceptanceId, mailId: (r as any).id || null });
      out.holderMail = r;
    }
  }

  // 3) Cofounder'lara "onaylandı" maili
  if (notifyCofounders) {
    const { data: cof } = await db.from("hub_members").select("email").eq("role", "cofounder").eq("active", true);
    const to = cofounderMailRecipients(settings, (cof || []).map((r: any) => r.email));
    if (!to.length) {
      out.cofounderMail = { ok: false, skipped: "no_recipients" };
    } else {
      const m = acceptedCofounderMail(terms, { typedName: acc.typed_name, acceptedAtText, startDate: grant.start_date, version: acc.template_version });
      const r = await sendMail(to, m.subject, m.body);
      await logEvent(db, grant.id, grant.seat_id, r.ok ? `Cofounder “onaylandı” maili gönderildi → ${to.join(", ")}${settings.testMode ? " (test modu)" : ""}` : `Cofounder maili gönderilemedi: ${r.error}`, { acceptanceId, mailId: (r as any).id || null, testMode: settings.testMode });
      out.cofounderMail = { ...r, to };
    }
  }
  return { ok: true, ...out };
}

export { sha256Hex, bytesSha };
