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
//   - Markali sifre-belirleme maili bu fonksiyon tarafindan send-mail
//     uzerinden gonderilir; link YANITTA DONMEZ.
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
  hub:   `${SITE_BASE}/hub/`,
};

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};
const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { ...corsHeaders, "Content-Type": "application/json" } });

// Yetkisiz durumda bile donen genel yanit.
const GENERIC = { ok: true, message: "İşlem alındı." };

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const { email, area } = await req.json();
    if (!email) return json({ error: "email zorunlu" }, 400);

    const target = (area === "admin" || area === "hub" || area === "team") ? area : "team";
    const admin = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, {
      auth: { autoRefreshToken: false, persistSession: false },
    });

    // ── Yetki kontrolu (yalnizca admin/hub) ──────────────────────
    if (target === "admin" || target === "hub") {
      const table = target === "admin" ? "admin_members" : "hub_members";
      const { data: member } = await admin
        .from(table).select("id").eq("active", true)
        .ilike("email", email.trim()).maybeSingle();
      if (!member) {
        // Yetkisiz — hicbir sey yapma, genel yanit don.
        return json(GENERIC);
      }
    }

    // ── Hesap / link uret ────────────────────────────────────────
    const redirectTo = REDIRECT[target];
    let { data, error } = await admin.auth.admin.generateLink({
      type: "invite", email, options: { redirectTo },
    });
    if (error) {
      const retry = await admin.auth.admin.generateLink({
        type: "recovery", email, options: { redirectTo },
      });
      data = retry.data; error = retry.error;
    }
    if (error || !data?.properties?.action_link) {
      // team icin hatayi don (cagiran ele alsin); admin/hub icin genel yanit.
      return target === "team"
        ? json({ error: error?.message || "link uretilemedi" }, 400)
        : json(GENERIC);
    }

    const link = data.properties.action_link;

    // team: eski davranis — linki cagirana don, mail gonderimini o yapar.
    if (target === "team") return json({ ok: true, link });

    // admin/hub: markali maili burada gonder, linki DONME.
    const areaLabel = target === "admin" ? "Yönetim Paneli" : "Kurucu Hattı";
    const body =
      `Start-Hub ${areaLabel} için hesabın hazırlandı.\n\n` +
      `Şifreni belirlemek ve giriş yapmak için:\n${link}\n\n` +
      `Bu bağlantı bir kez kullanılır. Sen istemediysen bu e-postayı yok sayabilirsin.`;
    await fetch(`${SUPABASE_URL}/functions/v1/send-mail`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${SERVICE_ROLE_KEY}` },
      body: JSON.stringify({ to: email.trim(), subject: `Start-Hub ${areaLabel} — şifre belirleme`, body }),
    });

    return json(GENERIC);
  } catch (e) {
    return json({ error: String(e) }, 500);
  }
});
