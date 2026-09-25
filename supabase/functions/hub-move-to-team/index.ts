// Supabase Edge Function: hub-move-to-team  (PROMPT_V3 C4)
// Bir Kurucu Hattı adayını ekibe alır. TEK çağrı, servis rolüyle:
//   1-2-3-5. _shared/move-to-team-core.ts (stage->member, people roster,
//      startups.member_ids, person_id/rol->filled) — hub-owner-decision ile
//      ORTAK, kod tekrarlanmıyor.
//   4. hub-bridge-add-member (Team app'in KENDİ Supabase projesi) ile
//      gerçek Ekip Paneli üyeliği + markalı şifre-belirleme maili
//
// 2026-09-25 düzeltmesi: bu fonksiyon artık YALNIZCA KURUCU (founder) hattı
// içindir — üye (member) hattındaki adaylar artık HR'dan doğrudan "Ekibe al"
// ile buraya gelmiyor, önce Team Lead'e sunulup (hub-bridge-present-candidate)
// Team App'te kabul görmesi gerekiyor (bkz. hub-team-decide-offer +
// hub-owner-decision). Kurucu hattında ayrı bir "proje sahibi" olmadığından
// (aday genelde kendisi o projenin lider/sahibi olacak kişi) bu akış
// DEĞİŞMEDİ — cofounder hâlâ doğrudan karar verir.
//
// Şema (2025-... dökümü): people.id = TEXT (default yok → biz üretiriz),
// project_id = bigint → startups.id. startups.member_ids = text[] (people.id
// değerlerini tutar). app_state.data şu an boş {} — takım/roster modeli
// people + startups.member_ids üzerinde. app_state'e dokunulmaz.
//
// Yetki: çağıranın JWT'si iletilir; hub_role() cofounder|recruiter olmalı.

import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { runMoveToTeamCore } from "../_shared/move-to-team-core.ts";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY")!;
// Team app'in KENDİ (ayrı) Supabase projesi — main projeyle karıştırılmaz.
const TEAM_PROJECT_URL = "https://umgdtjlgivvymngsnqtv.supabase.co";
const HUB_BRIDGE_SECRET = Deno.env.get("HUB_BRIDGE_SECRET");

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
    const { candidateId } = await req.json();
    if (!candidateId) return json({ error: "candidateId zorunlu" }, 400);

    // ── Yetki: çağıran hub cofounder/recruiter mi? ──────────────
    const asUser = createClient(SUPABASE_URL, ANON_KEY, {
      global: { headers: { Authorization: authHeader } },
      auth: { autoRefreshToken: false, persistSession: false },
    });
    const { data: role } = await asUser.rpc("hub_role");
    if (role !== "cofounder" && role !== "recruiter") {
      return json({ error: "Yetkisiz — ekibe alma yalnızca cofounder/recruiter." }, 403);
    }

    const db = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, {
      auth: { autoRefreshToken: false, persistSession: false },
    });

    const core = await runMoveToTeamCore(db, candidateId);
    if (!core.ok) return json({ error: core.error }, core.error === "Aday bulunamadı." ? 404 : 500);

    const { cand, startupId, personId, vestingStart, steps, warnings } = core;

    // ── 4. Team app'e (ayrı Supabase projesi) gerçek üye olarak ekle ──
    if (cand!.email && startupId != null) {
      try {
        const { data: sRow, error: sErr } = await db.from("startups").select("team_app_id").eq("id", startupId).single();
        if (sErr) throw new Error(sErr.message);
        const teamId = (sRow?.team_app_id as string | null) || null;
        if (!teamId) {
          warnings.push("proje Team App'e eşlenmemiş (startups.team_app_id boş) — Ekip Paneli'ne otomatik eklenemedi, elle eklenmeli");
        } else if (!HUB_BRIDGE_SECRET) {
          warnings.push("HUB_BRIDGE_SECRET tanımlı değil — Ekip Paneli köprüsü atlandı");
        } else {
          const bridgeRole = cand!.track === "founder" ? "lead" : "member";
          const bRes = await fetch(`${TEAM_PROJECT_URL}/functions/v1/hub-bridge-add-member`, {
            method: "POST",
            headers: { "Content-Type": "application/json", "x-hub-bridge-key": HUB_BRIDGE_SECRET },
            body: JSON.stringify({
              teamId, fullName: cand!.full_name || "Yeni üye", email: cand!.email, role: bridgeRole,
              source: { candidateId, actorEmail: null },
            }),
            signal: AbortSignal.timeout(8000),
          });
          const b = await bRes.json();
          if (!bRes.ok || !b?.ok) throw new Error(b?.error || `hub-bridge-add-member ${bRes.status}`);
          steps.invite = true;
          if (b.downgradedFromLead) warnings.push("ekipte zaten bir lead var — Ekip Paneli'nde member olarak eklendi");
          if (b.alreadyMember) warnings.push("kişi zaten bu Team App ekibinde kayıtlı");
          if (b.created && b.inviteSent === false) warnings.push("Ekip Paneli hesabı açıldı ama davet maili gönderilemedi");
        }
      } catch (e) {
        warnings.push("Ekip Paneli'ne otomatik eklenemedi: " + (e as Error).message);
      }
    } else if (!cand!.email) {
      warnings.push("adayın e-postası yok — Ekip Paneli'ne eklenemedi");
    } else {
      warnings.push("bağlı proje yok — Ekip Paneli'ne eklenemedi");
    }

    return json({ ok: true, personId, vestingStart, steps, warnings });
  } catch (e) {
    return json({ error: String(e) }, 500);
  }
});
