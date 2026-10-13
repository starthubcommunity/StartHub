// Supabase Edge Function: equity-contract
// BU PROJEYE DEPLOY EDİLİR: fdlghaafspcuagxfrofz (ana proje) — JWT doğrulaması AÇIK.
//
// 0060 (A) — HR › Pay Sözleri › "Sözleşmeyi gönder".
// Yetki: çağıranın KENDİ oturumuyla has_perm('equity.manage') (cofounder).
//   action 'preview' { grantId }          → metin + özet + mail + kilit durumu (yazmaz)
//   action 'send'    { grantId, confirm } → kilitleri SUNUCUDA uygular, maili gönderir,
//                                           ancak mail gittiyse sözü "Onay bekliyor" yapar
// Kilit (recipientLock): test modu açıkken ya da metin yer tutucuyken yalnızca
// contract_settings.test_emails'e gönderilir; başka adrese istek REDDEDİLİR
// (hiçbir şey yazılmaz, mail gitmez).
//
// B (0061):
//   action 'pdf'      { acceptanceId } (equity.read)  → depodaki PDF'in SHA-256'sı contract_documents
//                     ile karşılaştırılır; aynıysa 5 dk imzalı bağlantı, değilse indirme YOK + olay kaydı
//   action 'deliver'  { acceptanceId } (equity.manage) → PDF yoksa üret, kişiye PDF ekli maili (yeniden) gönder
//   action 'selftest' (yalnızca servis rolü anahtarı)  → örnek PDF üretir, hiçbir şey yazmaz/göndermez

import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { buildContract, loadSettings } from "../_shared/contract-server.ts";
import { recipientLock, contractInviteMail } from "../_shared/contract-render.js";
import { seatBudget, mapGrantFromDb } from "../_shared/equity-rules.js";
import { sendContractForGrant } from "../_shared/contract-send.ts";
import { deliverAcceptance, bytesSha, PDF_BUCKET } from "../_shared/contract-delivery.ts";
import { pdfDownloadDecision, forbiddenWordsIn, pdfFileName, contractTerms, contractVars, renderContract } from "../_shared/contract-render.js";
import { buildAcceptancePdf, fontBytes } from "../_shared/contract-pdf.js";
import { PDFDocument, rgb } from "npm:pdf-lib@1.17.1";
import fontkit from "npm:@pdf-lib/fontkit@1.1.1";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY")!;

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};
const json = (b: unknown, s = 200) =>
  new Response(JSON.stringify(b), { status: s, headers: { ...cors, "Content-Type": "application/json" } });

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  try {
    const authHeader = req.headers.get("Authorization") || "";
    const body = await req.json().catch(() => ({}));
    const { action, grantId, confirm, acceptanceId } = body || {};
    const db = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, { auth: { autoRefreshToken: false, persistSession: false } });

    // Çalışma ortamı denetimi: yalnızca servis rolü anahtarıyla; hiçbir şey yazmaz/göndermez.
    if (action === "selftest") {
      // İmza ağ geçidinde doğrulanır (bu fonksiyon JWT doğrulaması AÇIK deploy edilir); burada yalnızca rol okunur.
      let role = "";
      try { role = JSON.parse(atob(authHeader.replace(/^Bearer\s+/, "").split(".")[1].replace(/-/g, "+").replace(/_/g, "/"))).role || ""; } catch { role = ""; }
      if (role !== "service_role") return json({ ok: false, error: "Yetkisiz" }, 403);
      const t0 = Date.now();
      const { data: tpl } = await db.from("contract_templates").select("*").eq("kind", "member").order("version", { ascending: false }).limit(1).single();
      const terms = contractTerms({ grant: { holderName: "Ğülşen Işıl Çağlayan", holderEmail: "ornek@ornek.com", grantPct: 10, schedule: "time", vestMonths: 12, cliffMonths: 6 }, seat: { title: "Mobil geliştirici" }, projectName: "Örnek Proje", weeklyHours: 8 });
      const text = renderContract(tpl.body, contractVars(terms, ["Kurucu 1", "Kurucu 2"]));
      const { bytes, lines } = await buildAcceptancePdf({ PDFDocument, rgb, fontkit, ...fontBytes() }, {
        title: tpl.title, version: tpl.version, typedName: "Ğülşen Işıl Çağlayan", email: "ornek@ornek.com",
        acceptedAtText: "örnek", ip: "0.0.0.0", sha256: "0".repeat(64), acceptanceId: "örnek", textSnapshot: text,
      });
      return json({ ok: true, ms: Date.now() - t0, size: bytes.length, pdfSha256: await bytesSha(bytes), forbidden: forbiddenWordsIn(lines.join("\n")), fileName: pdfFileName(terms.project, tpl.version) });
    }

    const asUser = createClient(SUPABASE_URL, ANON_KEY, {
      global: { headers: { Authorization: authHeader } },
      auth: { autoRefreshToken: false, persistSession: false },
    });
    const perm = action === "pdf" ? "equity.read" : "equity.manage";
    const { data: allowed } = await asUser.rpc("has_perm", { p_key: perm });
    if (allowed !== true) return json({ ok: false, error: "Yetkisiz — yalnızca cofounder." }, 403);
    const { data: who } = await asUser.auth.getUser();
    const actor = who?.user?.email?.toLowerCase() || null;

    // ── B: PDF indir (bütünlük denetimli) ──
    if (action === "pdf") {
      if (!acceptanceId) return json({ ok: false, error: "acceptanceId zorunlu" }, 400);
      const { data: acc } = await db.from("contract_acceptances").select("id, grant_id").eq("id", acceptanceId).maybeSingle();
      if (!acc) return json({ ok: false, error: "Kabul kaydı bulunamadı." }, 404);
      const { data: doc } = await db.from("contract_documents").select("*").eq("acceptance_id", acceptanceId).maybeSingle();
      let actualSha: string | null = null;
      if (doc) {
        const { data: blob } = await db.storage.from(PDF_BUCKET).download(doc.storage_path);
        if (blob) actualSha = await bytesSha(new Uint8Array(await blob.arrayBuffer()));
      }
      const d = pdfDownloadDecision(doc, actualSha);
      if (!d.ok) {
        if (d.logEvent) {
          const { data: g } = await db.from("equity_grants").select("seat_id").eq("id", acc.grant_id).single();
          await db.from("equity_events").insert({
            grant_id: acc.grant_id, seat_id: g?.seat_id || null, kind: "note",
            note: d.reason === "tampered" ? "PDF indirme durduruldu: dosyanın parmak izi kayıttakiyle uyuşmuyor (dosya değiştirilmiş olabilir)." : "PDF indirme durduruldu: dosya depoda bulunamadı.",
            payload: { acceptanceId, expectedSha: doc?.pdf_sha256 || null, actualSha, storagePath: doc?.storage_path || null }, created_by: actor,
          });
        }
        return json({ ok: false, reason: d.reason, error: d.message }, d.reason === "missing" ? 404 : 409);
      }
      const { data: signed, error: se } = await db.storage.from(PDF_BUCKET).createSignedUrl(doc.storage_path, 300, { download: doc.storage_path.split("/").pop() });
      if (se || !signed) return json({ ok: false, error: "Bağlantı oluşturulamadı: " + (se?.message || "") }, 500);
      return json({ ok: true, url: signed.signedUrl, expiresIn: 300, pdfSha256: doc.pdf_sha256 });
    }

    // ── B: PDF üret ve kişiye (yeniden) gönder ──
    if (action === "deliver") {
      if (!acceptanceId) return json({ ok: false, error: "acceptanceId zorunlu" }, 400);
      if (confirm !== true) return json({ ok: false, error: "Onay gerekli." }, 400);
      const r = await deliverAcceptance(db, acceptanceId, { notifyCofounders: false });
      return json(r, r.ok ? 200 : 404);
    }

    if (!grantId) return json({ ok: false, error: "grantId zorunlu" }, 400);

    const { data: row, error: ge } = await db.from("equity_grants").select("*").eq("id", grantId).maybeSingle();
    if (ge || !row) return json({ ok: false, error: "Pay sözü bulunamadı." }, 404);
    if (row.status !== "pending_confirm") {
      return json({ ok: false, error: "Yalnızca “Teyit bekliyor” durumundaki söz gönderilebilir." }, 409);
    }

    const c = await buildContract(db, row);
    const settings = await loadSettings(db);
    const lock = recipientLock(settings, c.template, c.terms.holderEmail);
    const mail = contractInviteMail(c.terms);

    // Koltuk bütçesi (Kural 4b) — gönderim anında yeniden doğrulanır.
    const { data: seatGrants } = await db.from("equity_grants").select("*").eq("seat_id", row.seat_id).neq("id", row.id);
    const budget = seatBudget(c.seat, (seatGrants || []).map(mapGrantFromDb));
    const overBudget = Number(row.grant_pct) > budget.available + 1e-9;

    const base = {
      ok: true,
      to: c.terms.holderEmail, toName: c.terms.holderName,
      template: { id: c.template.id, kind: c.template.kind, version: c.template.version, title: c.template.title, isPlaceholder: c.template.isPlaceholder },
      terms: c.terms, text: c.text, sha256: c.sha,
      mail, lock, testMode: settings.testMode, available: budget.available, overBudget,
    };
    if (action === "preview") return json(base);
    if (action !== "send") return json({ ok: false, error: "bilinmeyen action" }, 400);

    if (confirm !== true) return json({ ok: false, error: "Onay (“Evet, eminim”) gerekli." }, 400);
    if (!lock.ok) return json({ ok: false, error: lock.reason, locked: true }, 403);
    if (overBudget) return json({ ok: false, error: `Koltukta yalnızca %${budget.available} kaldı — yüzdeyi düşür.` }, 409);
    // Ortak yol (Ekibe Al otomatik gönderimiyle aynı): önce söz kilitlenir, sonra mail; mail gidemezse geri alınır.
    const r = await sendContractForGrant(db, row.id, actor);
    if (!r.sent) {
      const msg = r.reason === "already_sent" ? "Bu söz için sözleşme zaten gönderilmiş." : r.reason === "mail_failed" ? "Mail gönderilemedi: " + (r.error || "") : r.lockReason || "Gönderilemedi (" + r.reason + ").";
      return json({ ok: false, error: msg }, r.reason === "mail_failed" ? 502 : 409);
    }
    return json({ ...base, sent: true, mailId: r.mailId || null });
  } catch (e) {
    return json({ ok: false, error: String(e) }, 500);
  }
});
