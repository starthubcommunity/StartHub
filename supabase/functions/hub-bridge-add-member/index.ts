// Supabase Edge Function: hub-bridge-add-member
// !!! BU PROJEYE DEPLOY EDILIR: umgdtjlgivvymngsnqtv (Team app / Ekip Paneli),
//     fdlghaafspcuagxfrofz (Ana Site/Admin/Hub projesi) DEGIL !!!
//   supabase link --project-ref umgdtjlgivvymngsnqtv
//   supabase functions deploy hub-bridge-add-member
//   supabase secrets set HUB_BRIDGE_SECRET=<uzun-rastgele-deger>
//   (Hub tarafinda VITE_TEAM_BRIDGE_SECRET ile AYNI deger olmali)
//
// Kurucu Hattı'nda bir aday "Ekibe aktar" ile işe alındığında, o kişiyi
// Ekip Paneli'nin (app_state.data) users[] listesine gerçek bir kullanıcı
// olarak ekler. repair-write'ın "taze-oku -> üst-seviye alanı birleştir ->
// yaz" desenini kullanır, ayrıca optimistic-concurrency (CAS) retry
// uygular — repair-write elle/nadiren çalışan bir araçtır, bu ise Hub'dan
// otomatik/sık tetikleneceği için çakışma riski gerçektir.
//
// Yeni kullanıcı oluşturulduysa invite-member + send-mail zincirini
// (aynı projede zaten duran, test edilmiş fonksiyonlar) çağırıp gerçek
// bir davet maili yollar — mail atılamazsa bile yazma işlemi BAŞARILI
// sayılır (inviteSent:false döner, engelleyici değildir).
//
// x-dry-run: 1 header'ıyla hiçbir şey yazılmaz/mail atılmaz, yalnızca
// hesaplanan sonuç (created/addedToTeam/downgradedFromLead vb.) döner —
// test için.

import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { computeBridgePatch } from "./logic.ts";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const HUB_BRIDGE_SECRET = Deno.env.get("HUB_BRIDGE_SECRET");
const MAX_ATTEMPTS = 3;

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-hub-bridge-key, x-dry-run",
};

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: { ...corsHeaders, "Content-Type": "application/json" } });
}

async function sendInviteEmail(admin: ReturnType<typeof createClient>, email: string, name: string, teamName: string, roleLabel: string): Promise<boolean> {
  try {
    const invRes = await fetch(`${SUPABASE_URL}/functions/v1/invite-member`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${SERVICE_ROLE_KEY}`, apikey: SERVICE_ROLE_KEY },
      body: JSON.stringify({ email }),
    });
    const inv = await invRes.json().catch(() => null);
    if (!inv?.ok || !inv.link) return false;

    const subject = `${teamName} ekibine davet edildin — StartHub`;
    const body = `Merhaba ${name},\n\nKurucu Hattı seni StartHub'da "${teamName}" ekibine ${roleLabel} olarak ekledi.\n\nHesabını kurmak ve şifreni belirlemek için:\n${inv.link}\n\nEkibe hoş geldin!\nStartHub Ekibi`;
    const html = `<!doctype html><html lang="tr"><head><meta charset="utf-8"></head><body style="margin:0;padding:0;background:#FBF9F4;"><div style="background:#FBF9F4;padding:32px 16px;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;"><table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:480px;margin:0 auto;background:#FFFFFF;border:1px solid #E7E0D2;border-radius:16px;overflow:hidden;"><tr><td style="background:#1C1917;padding:20px 28px;"><span style="color:#FFFFFF;font-size:18px;font-weight:700;">StartHub</span></td></tr><tr><td style="padding:28px 28px 8px;"><p style="margin:0 0 16px;color:#1C1917;font-size:15px;line-height:1.6;">Merhaba <strong>${name}</strong>,</p><p style="margin:0 0 16px;color:#1C1917;font-size:15px;line-height:1.6;">Kurucu Hattı seni StartHub'da <strong>"${teamName}"</strong> ekibine <strong>${roleLabel}</strong> olarak ekledi.</p><p style="margin:0;color:#57534E;font-size:13px;line-height:1.6;">Aşağıdaki butona tıklayarak şifreni belirleyip hesabını aktif hale getirebilirsin.</p></td></tr><tr><td style="padding:8px 28px 28px;"><a href="${inv.link}" style="display:inline-block;background:#DC2626;color:#FFFFFF;text-decoration:none;font-weight:700;font-size:14px;padding:12px 22px;border-radius:10px;">Hesabımı Kur</a></td></tr></table></div></body></html>`;

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

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  const token = req.headers.get("x-hub-bridge-key");
  if (!HUB_BRIDGE_SECRET || token !== HUB_BRIDGE_SECRET) return json({ ok: false, error: "unauthorized" }, 401);

  const dryRun = req.headers.get("x-dry-run") === "1";

  let payload: any;
  try { payload = await req.json(); } catch { return json({ ok: false, error: "geçersiz JSON gövde" }, 400); }

  const admin = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, { auth: { autoRefreshToken: false, persistSession: false } });

  for (let attempt = 0; attempt < MAX_ATTEMPTS; attempt++) {
    const { data: cur, error: readErr } = await admin.from("app_state").select("data").eq("id", "shl_v5").maybeSingle();
    if (readErr || !cur || !cur.data) return json({ ok: false, error: readErr?.message || "mevcut satır okunamadı" }, 500);

    const knownAt = cur.data._at;
    const result = computeBridgePatch(cur.data, payload);
    if (!result.ok) return json(result, result.error?.includes("zorunlu") || result.error?.includes("olmalı") ? 400 : 404);

    if (dryRun) {
      const { snapshot: _drop, ...meta } = result;
      return json({ ...meta, dryRun: true });
    }

    const merged = { ...result.snapshot, _by: "hub-bridge", _at: Date.now() };

    // CAS: yazmadan hemen önce satırın hâlâ bildiğimiz sürüm olduğunu doğrula.
    const { data: recheck } = await admin.from("app_state").select("data").eq("id", "shl_v5").maybeSingle();
    if (recheck?.data?._at !== knownAt) continue; // aradan biri yazdı — yeniden oku + yeniden hesapla

    const { error: writeErr } = await admin.from("app_state").upsert({ id: "shl_v5", data: merged });
    if (writeErr) return json({ ok: false, error: writeErr.message }, 500);

    let inviteSent = false;
    if (result.created) {
      const team = (merged.teams || []).find((t: any) => t.id === payload.teamId);
      const roleLabel = merged.users.find((u: any) => u.id === result.userId)?.role === "lead" ? "Team Lead" : "Member";
      inviteSent = await sendInviteEmail(admin, payload.email.trim().toLowerCase(), payload.fullName, team?.name || payload.teamId, roleLabel);
    }

    return json({
      ok: true,
      userId: result.userId,
      created: result.created,
      addedToTeam: result.addedToTeam,
      alreadyMember: result.alreadyMember,
      downgradedFromLead: result.downgradedFromLead,
      inviteSent,
    });
  }

  return json({ ok: false, error: "çok fazla eşzamanlı yazma çakışması, tekrar deneyin" }, 409);
});
