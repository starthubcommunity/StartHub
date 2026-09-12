// Supabase Edge Function: invite-member
// Gercek bir Supabase Auth hesabi olusturur (veya yoksa olusturur) ve
// giris/sifre belirleme linki uretir.
//
// GERIYE DONUK UYUMLU: `area` verilmezse 'team' varsayilir ve eski davranis
// aynen korunur — { ok, link } doner, mail gonderimini cagiran yapar.
//
// `area` = 'admin' | 'hub' verildiginde:
//   - Yetki kontrolu yapilir: admin_members / hub_members'ta AKTIF satir
//     olmalidir. Yoksa hesap ACILMAZ.
//   - Yanit her durumda ayni ("islem alindi") — yetkili/yetkisiz e-posta
//     ayirt edilemez (e-posta sayimini engellemek icin).
//   - MARKALI HTML maili bu fonksiyon tarafindan send-mail uzerinden
//     gonderilir; link YANITTA DONMEZ.
//
// `mode` = 'invite' | 'recovery' (opsiyonel). 'recovery' → "Sifremi unuttum"
// akisi: markali sifirlama maili gonderilir. Verilmezse: once invite denenir,
// hesap zaten varsa recovery'e duser; sablon uretilen link tipine gore secilir.
//
// ⚠️ HICBIR MAILDE DUZ METIN SIFRE YOK — yalnizca tek kullanimlik baglanti.
//
// SUPABASE_URL ve SUPABASE_SERVICE_ROLE_KEY platform tarafindan saglanir.

import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const APP_URL = Deno.env.get("APP_URL") || "https://www.starthub-community.com/team/";
// APP_URL genelde ".../team/" — kök adresi buradan turet.
const SITE_BASE = APP_URL.replace(/\/team\/?$/, "").replace(/\/$/, "");

const REDIRECT: Record<string, string> = {
  team:  APP_URL,
  admin: `${SITE_BASE}/admin/`,
  hub:   `${SITE_BASE}/HR/`,
};
const AREA_LABEL: Record<string, string> = {
  admin: "Yönetim Paneli",
  hub:   "Kurucu Hattı",
  team:  "Ekip Paneli",
};

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};
const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { ...corsHeaders, "Content-Type": "application/json" } });

// Yetkisiz durumda bile donen genel yanit.
const GENERIC = { ok: true, message: "İşlem alındı." };

const esc = (s: string) =>
  String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

// ── Markali e-posta iskeleti (team sistemindeki gorunumun ayni) ────
//    siyah baslik seridi + "StartHub" · beyaz govde · gri bilgi kutusu ·
//    kirmizi (#DC2626) buton · altta gri alt bilgi.
function shell(inner: string): string {
  return `<!doctype html><html><body style="margin:0;padding:0;background:#f4f4f5;">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#f4f4f5;padding:24px 0;">
<tr><td align="center">
<table role="presentation" width="480" cellpadding="0" cellspacing="0" style="width:480px;max-width:92%;background:#ffffff;border-radius:12px;overflow:hidden;font-family:-apple-system,Segoe UI,Roboto,Helvetica,Arial,sans-serif;">
  <tr><td style="background:#111111;padding:18px 28px;">
    <span style="color:#ffffff;font-size:17px;font-weight:700;letter-spacing:-0.01em;">StartHub</span>
  </td></tr>
  <tr><td style="padding:28px;color:#1c1917;font-size:15px;line-height:1.6;">
    ${inner}
  </td></tr>
  <tr><td style="padding:16px 28px;background:#fafaf9;border-top:1px solid #eeeeee;color:#78716c;font-size:12px;line-height:1.5;">
    Bu e-posta <b>no-reply@mail.starthub-community.com</b> adresinden otomatik gönderildi. Lütfen yanıtlamayın.
  </td></tr>
</table>
</td></tr></table>
</body></html>`;
}

function inviteHtml(o: { name?: string; email: string; role?: string; areaLabel: string; url: string }): string {
  const greet = o.name ? `Merhaba ${esc(o.name)},` : "Merhaba,";
  return shell(`
    <p style="margin:0 0 14px;">${greet}</p>
    <p style="margin:0 0 18px;">StartHub <b>${esc(o.areaLabel)}</b> paneline erişimin tanımlandı. Şifreni belirleyip giriş yapabilirsin.</p>
    <table role="presentation" cellpadding="0" cellspacing="0" style="width:100%;background:#f5f5f4;border-radius:8px;margin:0 0 22px;">
      <tr><td style="padding:12px 14px;font-size:13px;color:#57534e;line-height:1.7;">
        <b>E-posta:</b> ${esc(o.email)}<br/>
        <b>Rol:</b> ${esc(o.role || "—")}
      </td></tr>
    </table>
    <table role="presentation" cellpadding="0" cellspacing="0" style="margin:0 0 20px;"><tr><td>
      <a href="${esc(o.url)}" style="display:inline-block;background:#DC2626;color:#ffffff;text-decoration:none;font-weight:700;font-size:14px;padding:12px 22px;border-radius:8px;">Şifreni Belirle</a>
    </td></tr></table>
    <p style="margin:0;color:#78716c;font-size:12.5px;">Bağlantı tek kullanımlıktır ve 1 saat içinde geçerliliğini yitirir.</p>
  `);
}

function recoveryHtml(o: { name?: string; email: string; areaLabel: string; url: string }): string {
  const greet = o.name ? `Merhaba ${esc(o.name)},` : "Merhaba,";
  return shell(`
    <p style="margin:0 0 14px;">${greet}</p>
    <p style="margin:0 0 18px;">StartHub <b>${esc(o.areaLabel)}</b> için şifreni sıfırlamak üzere bir talep aldık.</p>
    <table role="presentation" cellpadding="0" cellspacing="0" style="width:100%;background:#f5f5f4;border-radius:8px;margin:0 0 22px;">
      <tr><td style="padding:12px 14px;font-size:13px;color:#57534e;"><b>E-posta:</b> ${esc(o.email)}</td></tr>
    </table>
    <table role="presentation" cellpadding="0" cellspacing="0" style="margin:0 0 20px;"><tr><td>
      <a href="${esc(o.url)}" style="display:inline-block;background:#DC2626;color:#ffffff;text-decoration:none;font-weight:700;font-size:14px;padding:12px 22px;border-radius:8px;">Yeni Şifre Belirle</a>
    </td></tr></table>
    <p style="margin:0;color:#78716c;font-size:12.5px;">Bu talebi sen yapmadıysan bu e-postayı yok sayabilirsin. Bağlantı tek kullanımlıktır ve 1 saat içinde geçerliliğini yitirir.</p>
  `);
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const { email, area, mode } = await req.json();
    if (!email) return json({ error: "email zorunlu" }, 400);

    const target = (area === "admin" || area === "hub" || area === "team") ? area : "team";
    const admin = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, {
      auth: { autoRefreshToken: false, persistSession: false },
    });

    // ── Yetki kontrolu (yalnizca admin/hub) ──────────────────────
    let member: { full_name?: string; role?: string } | null = null;
    if (target === "admin" || target === "hub") {
      const table = target === "admin" ? "admin_members" : "hub_members";
      const { data } = await admin
        .from(table).select("id, full_name, role").eq("active", true)
        .ilike("email", email.trim()).maybeSingle();
      if (!data) return json(GENERIC);        // yetkisiz — sessizce genel yanit
      member = data;
    }

    // ── Link uret ────────────────────────────────────────────────
    const redirectTo = REDIRECT[target];
    const wantRecoveryFirst = mode === "recovery";
    const order: Array<"invite" | "recovery"> = wantRecoveryFirst
      ? ["recovery", "invite"]
      : ["invite", "recovery"];

    let link: string | null = null;
    let usedType: "invite" | "recovery" = order[0];
    let lastErr = "";
    for (const type of order) {
      const { data, error } = await admin.auth.admin.generateLink({ type, email, options: { redirectTo } });
      if (!error && data?.properties?.action_link) { link = data.properties.action_link; usedType = type; break; }
      lastErr = error?.message || "link uretilemedi";
    }
    if (!link) {
      return target === "team" ? json({ error: lastErr }, 400) : json(GENERIC);
    }

    // team: eski davranis — linki cagirana don, mail gonderimini o yapar.
    if (target === "team") return json({ ok: true, link });

    // admin/hub: MARKALI mail burada gonderilir, link DONMEZ.
    const areaLabel = AREA_LABEL[target];
    // mode='recovery' isteniyorsa sablon her zaman sifirlama; degilse link tipine gore.
    const isRecovery = wantRecoveryFirst || usedType === "recovery";
    const html = isRecovery
      ? recoveryHtml({ name: member?.full_name, email: email.trim(), areaLabel, url: link })
      : inviteHtml({ name: member?.full_name, email: email.trim(), role: member?.role, areaLabel, url: link });
    const subject = isRecovery
      ? `StartHub ${areaLabel} — şifre sıfırlama`
      : `StartHub ${areaLabel} — erişimin tanımlandı`;
    const body = isRecovery
      ? `StartHub ${areaLabel} için şifreni sıfırlamak üzere bir talep aldık.\n\nYeni şifre belirlemek için:\n${link}\n\nBu talebi sen yapmadıysan bu e-postayı yok sayabilirsin. Bağlantı tek kullanımlıktır ve 1 saat içinde geçerliliğini yitirir.`
      : `StartHub ${areaLabel} paneline erişimin tanımlandı.\n\nŞifreni belirlemek için:\n${link}\n\nE-posta: ${email.trim()} · Rol: ${member?.role || "—"}\nBağlantı tek kullanımlıktır ve 1 saat içinde geçerliliğini yitirir.`;

    await fetch(`${SUPABASE_URL}/functions/v1/send-mail`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${SERVICE_ROLE_KEY}` },
      body: JSON.stringify({ to: email.trim(), subject, body, html }),
    });

    return json(GENERIC);
  } catch (e) {
    return json({ error: String(e) }, 500);
  }
});
