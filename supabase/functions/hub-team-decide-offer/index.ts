// Supabase Edge Function: hub-team-decide-offer
// !!! BU PROJEYE DEPLOY EDILIR: umgdtjlgivvymngsnqtv (Team app / Ekip Paneli) !!!
//   supabase link --project-ref umgdtjlgivvymngsnqtv
//   supabase functions deploy hub-team-decide-offer
//
// Team App'in Team sayfasındaki "Bekleyen Adaylar" panelinde Team Lead (veya
// admin) Kabul/Ret verince ÇAĞIRANIN KENDİ oturumuyla çağrılır — hub-bridge-*
// fonksiyonlarının aksine HUB_BRIDGE_SECRET GEREKMEZ, çünkü bu Team App'in
// kendi verisine kendi yetkili kullanıcısının yazması. Yetki kontrolü burada
// yapılır: çağıran, app_state.data.users içinde bu teklifin ekibi için
// admin ya da lead olmalı (effRole ile aynı mantık, sunucu tarafında tekrar
// edilir — istemci tarafı kontrolüne güvenilmez).
//
// Kabul: computeDecideOfferPatch (→ computeBridgePatch, hub-bridge-add-member
// ile AYNI ekleme mantığı) + davet maili (aynı proje üzerindeki invite-member
// + send-mail zinciri, hub-bridge-add-member'daki sendInviteEmail deseni).
// Her iki kararda da ana projedeki hub-owner-decision'a HUB_BRIDGE_SECRET ile
// bildirilir — HR'daki hub_candidates güncellensin diye (stage→member veya
// owner_decision→rejected). Bu çağrı BAŞARISIZ olsa bile Team App'teki karar
// GERİ ALINMAZ (warning olarak döner) — Team App'in kendi verisi asıl kaynak.

import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { computeDecideOfferPatch } from "./logic.ts";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY")!;
const HUB_BRIDGE_SECRET = Deno.env.get("HUB_BRIDGE_SECRET");
// Ana projenin (fdlghaafspcuagxfrofz) hub-owner-decision'ına geri bildirim için.
const MAIN_PROJECT_URL = Deno.env.get("MAIN_PROJECT_URL") || "https://fdlghaafspcuagxfrofz.supabase.co";
const MAX_ATTEMPTS = 3;

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: { ...corsHeaders, "Content-Type": "application/json" } });
}

function teamsOf(u: any): string[] {
  return (u.teams && u.teams.length) ? u.teams : (u.team ? [u.team] : []);
}
function effRole(u: any, tid: string): string {
  return (u.teamRoles && u.teamRoles[tid]) || u.role;
}

async function sendInviteEmail(email: string, name: string, teamName: string): Promise<boolean> {
  try {
    const invRes = await fetch(`${SUPABASE_URL}/functions/v1/invite-member`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${SERVICE_ROLE_KEY}`, apikey: SERVICE_ROLE_KEY },
      body: JSON.stringify({ email }),
    });
    const inv = await invRes.json().catch(() => null);
    if (!inv?.ok || !inv.link) return false;

    const subject = `${teamName} ekibine davet edildin — StartHub`;
    const body = `Merhaba ${name},\n\n"${teamName}" ekibinin lideri seni StartHub'da ekibe kabul etti.\n\nHesabını kurmak ve şifreni belirlemek için:\n${inv.link}\n\nEkibe hoş geldin!\nStartHub Ekibi`;
    const html = `<!doctype html><html lang="tr"><head><meta charset="utf-8"></head><body style="margin:0;padding:0;background:#FBF9F4;"><div style="background:#FBF9F4;padding:32px 16px;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;"><table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:480px;margin:0 auto;background:#FFFFFF;border:1px solid #E7E0D2;border-radius:16px;overflow:hidden;"><tr><td style="background:#1C1917;padding:20px 28px;"><span style="color:#FFFFFF;font-size:18px;font-weight:700;">StartHub</span></td></tr><tr><td style="padding:28px 28px 8px;"><p style="margin:0 0 16px;color:#1C1917;font-size:15px;line-height:1.6;">Merhaba <strong>${name}</strong>,</p><p style="margin:0 0 16px;color:#1C1917;font-size:15px;line-height:1.6;"><strong>"${teamName}"</strong> ekibinin lideri seni StartHub'da ekibe kabul etti.</p><p style="margin:0;color:#57534E;font-size:13px;line-height:1.6;">Aşağıdaki butona tıklayarak şifreni belirleyip hesabını aktif hale getirebilirsin.</p></td></tr><tr><td style="padding:8px 28px 28px;"><a href="${inv.link}" style="display:inline-block;background:#DC2626;color:#FFFFFF;text-decoration:none;font-weight:700;font-size:14px;padding:12px 22px;border-radius:10px;">Hesabımı Kur</a></td></tr></table></div></body></html>`;

    const mailRes = await fetch(`${SUPABASE_URL}/functions/v1/send-mail`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${SERVICE_ROLE_KEY}`, apikey: SERVICE_ROLE_KEY },
      body: JSON.stringify({ to: email, subject, body, html }),
    });
    return mailRes.ok;
  } catch (_e) {
    return false;
  }
}

async function notifyMain(hubCandidateId: string, decision: "accepted" | "rejected", note: string | null) {
  if (!HUB_BRIDGE_SECRET) return { ok: false, error: "HUB_BRIDGE_SECRET tanımlı değil" };
  try {
    const res = await fetch(`${MAIN_PROJECT_URL}/functions/v1/hub-owner-decision`, {
      method: "POST",
      headers: { "Content-Type": "application/json", "x-hub-bridge-key": HUB_BRIDGE_SECRET },
      body: JSON.stringify({ hubCandidateId, decision, note }),
    });
    const b = await res.json().catch(() => null);
    if (!res.ok || !b?.ok) return { ok: false, error: b?.error || `hub-owner-decision ${res.status}` };
    return { ok: true };
  } catch (e) {
    return { ok: false, error: String(e) };
  }
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  const authHeader = req.headers.get("Authorization") || "";
  let payload: any;
  try { payload = await req.json(); } catch { return json({ ok: false, error: "geçersiz JSON gövde" }, 400); }
  const { offerId, decision, note } = payload || {};
  if (!offerId || (decision !== "accepted" && decision !== "rejected")) {
    return json({ ok: false, error: "offerId ve decision ('accepted'|'rejected') zorunlu" }, 400);
  }

  const asUser = createClient(SUPABASE_URL, ANON_KEY, {
    global: { headers: { Authorization: authHeader } },
    auth: { autoRefreshToken: false, persistSession: false },
  });
  const { data: authData } = await asUser.auth.getUser();
  const myEmail = authData?.user?.email?.toLowerCase();
  if (!myEmail) return json({ ok: false, error: "unauthorized" }, 401);

  const admin = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, { auth: { autoRefreshToken: false, persistSession: false } });

  for (let attempt = 0; attempt < MAX_ATTEMPTS; attempt++) {
    const { data: cur, error: readErr } = await admin.from("app_state").select("data").eq("id", "shl_v5").maybeSingle();
    if (readErr || !cur || !cur.data) return json({ ok: false, error: readErr?.message || "mevcut satır okunamadı" }, 500);

    const offer = (cur.data.candidateOffers || []).find((o: any) => o.id === offerId);
    if (!offer) return json({ ok: false, error: `'${offerId}' bekleyen adayı bulunamadı` }, 404);

    const me = (cur.data.users || []).find((u: any) => (u.email || "").toLowerCase() === myEmail);
    const authorized = !!me && (me.role === "admin" || (teamsOf(me).includes(offer.teamId) && effRole(me, offer.teamId) === "lead"));
    if (!authorized) return json({ ok: false, error: "Bu ekip için karar verme yetkin yok" }, 403);

    const knownAt = cur.data._at;
    const result = computeDecideOfferPatch(cur.data, { offerId, decision, decidedBy: me.id });
    if (!result.ok) return json(result, result.error?.includes("bulunamadı") ? 404 : 400);

    const merged = { ...result.snapshot, _by: "hub-team-decide", _at: Date.now() };

    const { data: recheck } = await admin.from("app_state").select("data").eq("id", "shl_v5").maybeSingle();
    if (recheck?.data?._at !== knownAt) continue; // aradan biri yazdı — yeniden oku + yeniden hesapla

    const { error: writeErr } = await admin.from("app_state").upsert({ id: "shl_v5", data: merged });
    if (writeErr) return json({ ok: false, error: writeErr.message }, 500);

    let inviteSent = false;
    if (result.inviteEligible) {
      const team = (merged.teams || []).find((t: any) => t.id === offer.teamId);
      inviteSent = await sendInviteEmail(offer.email, offer.fullName, team?.name || offer.teamId);
    }

    const mainReport = await notifyMain(offer.hubCandidateId, decision, note || null);

    return json({
      ok: true, decision, userId: result.userId, created: result.created, inviteSent,
      hrNotified: mainReport.ok, hrNotifyError: mainReport.ok ? undefined : mainReport.error,
    });
  }

  return json({ ok: false, error: "çok fazla eşzamanlı yazma çakışması, tekrar deneyin" }, 409);
});
