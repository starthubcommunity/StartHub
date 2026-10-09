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

import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { buildContract, loadSettings } from "../_shared/contract-server.ts";
import { recipientLock, contractInviteMail } from "../_shared/contract-render.js";
import { seatBudget, mapGrantFromDb } from "../_shared/equity-rules.js";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY")!;
const RESEND_API_KEY = Deno.env.get("RESEND_API_KEY");
const FROM_EMAIL = Deno.env.get("MAIL_FROM") || "StartHub <no-reply@mail.starthub-community.com>";
const REPLY_TO = Deno.env.get("REPLY_TO") || "starthub.community@gmail.com";

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};
const json = (b: unknown, s = 200) =>
  new Response(JSON.stringify(b), { status: s, headers: { ...cors, "Content-Type": "application/json" } });

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  try {
    const asUser = createClient(SUPABASE_URL, ANON_KEY, {
      global: { headers: { Authorization: req.headers.get("Authorization") || "" } },
      auth: { autoRefreshToken: false, persistSession: false },
    });
    const { data: allowed } = await asUser.rpc("has_perm", { p_key: "equity.manage" });
    if (allowed !== true) return json({ ok: false, error: "Yetkisiz — yalnızca cofounder." }, 403);
    const { data: who } = await asUser.auth.getUser();
    const actor = who?.user?.email?.toLowerCase() || null;

    const { action, grantId, confirm } = await req.json();
    if (!grantId) return json({ ok: false, error: "grantId zorunlu" }, 400);
    const db = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, { auth: { autoRefreshToken: false, persistSession: false } });

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
    if (!RESEND_API_KEY) return json({ ok: false, error: "RESEND_API_KEY tanımlı değil" }, 500);

    // 1) Mail önce — gidemezse hiçbir şey yazılmaz.
    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: { Authorization: `Bearer ${RESEND_API_KEY}`, "Content-Type": "application/json; charset=utf-8" },
      body: JSON.stringify({ from: FROM_EMAIL, to: [c.terms.holderEmail], subject: mail.subject, text: mail.body, reply_to: REPLY_TO }),
    });
    const sent = await res.json().catch(() => null);
    if (!res.ok) return json({ ok: false, error: "Mail gönderilemedi: " + JSON.stringify(sent?.message || sent || res.status) }, 502);

    // 2) Söz → "Onay bekliyor" (yalnızca hâlâ "Teyit bekliyor"sa)
    const { data: upd, error: ue } = await db.from("equity_grants").update({
      status: "pending_signature", contract_template_id: c.template.id,
      contract_sent_at: new Date().toISOString(), contract_sent_by: actor,
    }).eq("id", row.id).eq("status", "pending_confirm").select("id");
    if (ue || !upd?.length) {
      return json({ ok: false, error: "Mail gitti ama söz güncellenemedi: " + (ue?.message || "durum değişmiş") }, 500);
    }
    await db.from("equity_events").insert({
      grant_id: row.id, seat_id: row.seat_id, kind: "note",
      note: `Sözleşme gönderildi — ${c.template.title} v${c.template.version}${c.template.isPlaceholder ? " (yer tutucu)" : ""} → ${c.terms.holderEmail}`,
      payload: { mailId: sent?.id || null, sha256: c.sha, templateId: c.template.id }, created_by: actor,
    });
    return json({ ...base, sent: true, mailId: sent?.id || null });
  } catch (e) {
    return json({ ok: false, error: String(e) }, 500);
  }
});
