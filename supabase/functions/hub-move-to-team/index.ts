// Supabase Edge Function: hub-move-to-team  (PROMPT_V3 C4)
// Bir Kurucu Hattı adayını ekibe alır. TEK çağrı, servis rolüyle:
//   1. Aşama -> member (+ joined_at / vesting_start_date)
//   2. people roster kaydı (ad, rol, project_id=startup_id)   [best-effort]
//   3. startups.member_ids'e ekle                             [best-effort]
//   4. hub-bridge-add-member (Team app'in KENDİ Supabase projesi) ile
//      gerçek Ekip Paneli üyeliği + markalı şifre-belirleme maili
//   5. hub_candidates.person_id geri yaz + bağlı rol -> filled
//
// Her adım ayrı try/catch — patlayan adım `warnings`e yazılır, akış durmaz.
// Çağıran (hub-store.moveToTeam) kısmi durumu kullanıcıya gösterir.
//
// Şema (2025-... dökümü): people.id = TEXT (default yok → biz üretiriz),
// project_id = bigint → startups.id. startups.member_ids = text[] (people.id
// değerlerini tutar). app_state.data şu an boş {} — takım/roster modeli
// people + startups.member_ids üzerinde. app_state'e dokunulmaz.
//
// ÖNEMLİ (2026-09-12 düzeltmesi): 4. adım eskiden invite-member(area:'team')
// çağırıyordu — ama o, BU projenin (main, fdlghaafspcuagxfrofz) kendi auth
// sisteminde hesap/link üretiyordu. Gerçek /team/ bundle'ı TAMAMEN AYRI bir
// Supabase projesine (umgdtjlgivvymngsnqtv) bağlı — Supabase Auth token'ları
// projeye özel imzalandığı için o link /team/'de geçersiz kalıyordu, üstelik
// app_state.data.users'a (Team'in gerçek üye listesi) hiç dokunulmuyordu.
// Yani buton "başarılı" görünse de kişi Ekip Paneli'nde hiçbir zaman üye
// olarak belirmiyordu. Doğrusu: startups.team_app_id (0023) üzerinden Team
// projesindeki hub-bridge-add-member'ı çağırmak — bkz. aşağıdaki 4. adım.
//
// Yetki: çağıranın JWT'si iletilir; hub_role() cofounder|recruiter olmalı.

import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

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

    const { data: cand, error: ce } = await db
      .from("hub_candidates").select("*").eq("id", candidateId).single();
    if (ce || !cand) return json({ error: "Aday bulunamadı." }, 404);

    let role_row: Record<string, unknown> | null = null;
    if (cand.open_role_id) {
      const { data: r } = await db.from("hub_open_roles").select("*").eq("id", cand.open_role_id).single();
      role_row = r ?? null;
    }
    const startupId = (role_row?.startup_id as number | null) ?? (cand.startup_id as number | null) ?? null;

    // Hak ediş başlangıcı = Kapı A'nın ilk günü (geriye dönük).
    const { data: gatesA } = await db
      .from("hub_gates").select("started_at")
      .eq("candidate_id", candidateId).eq("gate", "A").not("started_at", "is", null)
      .order("started_at", { ascending: true }).limit(1);
    const vestingStart = gatesA?.[0]?.started_at ? String(gatesA[0].started_at).slice(0, 10) : null;
    const joinedAt = new Date().toISOString();

    const steps: Record<string, boolean> = { stage: false, person: false, membership: false, invite: false, roleFilled: false };
    const warnings: string[] = [];

    // ── 1. aşama -> member ─────────────────────────────────────
    try {
      const { error } = await db.from("hub_candidates").update({
        stage: "member", stage_changed_at: joinedAt,
        joined_at: joinedAt, vesting_start_date: vestingStart,
      }).eq("id", candidateId);
      if (error) throw new Error(error.message);
      await db.from("hub_stage_log").insert({
        candidate_id: candidateId, from_stage: cand.stage, to_stage: "member",
        reason: vestingStart ? `hak ediş başlangıcı: ${vestingStart} (Kapı A ilk günü)` : "ekibe aktarıldı",
      });
      steps.stage = true;
    } catch (e) {
      return json({ error: "Aşama güncellenemedi: " + (e as Error).message }, 500);
    }

    // ── 2. people roster kaydı (people.id TEXT — biz üretiriz) ─
    let personId: string | null = (cand.person_id as string | null) ?? null;
    if (!personId) {
      try {
        const newId = crypto.randomUUID();
        const rosterRow = {
          id: newId,
          name: cand.full_name || "Yeni üye",
          role_tr: (role_row?.title as string) || "Ekip üyesi",
          role_en: (role_row?.title as string) || "Team member",
          type: startupId != null ? "project_member" : "team",
          project_id: startupId,
          color: "#2563EB",
          linkedin: cand.linkedin || "#",
          sort_order: 99,
        };
        const ins = await db.from("people").insert(rosterRow).select("id").single();
        if (ins.error) throw new Error(ins.error.message);
        personId = String(ins.data.id);
        steps.person = true;
      } catch (e) {
        warnings.push("roster (people) kaydı açılamadı: " + (e as Error).message);
      }
    } else {
      steps.person = true;
    }

    // ── 3. startups.member_ids'e ekle (text[]) ────────────────
    if (personId && startupId != null) {
      try {
        const { data: s, error } = await db.from("startups").select("member_ids, team").eq("id", startupId).single();
        if (error) throw new Error(error.message);
        const ids: string[] = Array.isArray(s?.member_ids) ? s.member_ids.map(String) : [];
        if (!ids.includes(personId)) {
          const { error: ue } = await db.from("startups")
            .update({ member_ids: [...ids, personId], team: ids.length + 1 })
            .eq("id", startupId);
          if (ue) throw new Error(ue.message);
        }
        steps.membership = true;
      } catch (e) {
        warnings.push("takım üyeliği (startups.member_ids) yazılamadı: " + (e as Error).message);
      }
    } else if (startupId == null) {
      warnings.push("bağlı proje yok — takım üyeliği atlandı");
    }

    // ── 4. Team app'e (ayrı Supabase projesi) gerçek üye olarak ekle ──
    if (cand.email && startupId != null) {
      try {
        const { data: sRow, error: sErr } = await db.from("startups").select("team_app_id").eq("id", startupId).single();
        if (sErr) throw new Error(sErr.message);
        const teamId = (sRow?.team_app_id as string | null) || null;
        if (!teamId) {
          warnings.push("proje Team App'e eşlenmemiş (startups.team_app_id boş) — Ekip Paneli'ne otomatik eklenemedi, elle eklenmeli");
        } else if (!HUB_BRIDGE_SECRET) {
          warnings.push("HUB_BRIDGE_SECRET tanımlı değil — Ekip Paneli köprüsü atlandı");
        } else {
          const bridgeRole = cand.track === "founder" ? "lead" : "member";
          const bRes = await fetch(`${TEAM_PROJECT_URL}/functions/v1/hub-bridge-add-member`, {
            method: "POST",
            headers: { "Content-Type": "application/json", "x-hub-bridge-key": HUB_BRIDGE_SECRET },
            body: JSON.stringify({
              teamId, fullName: cand.full_name || "Yeni üye", email: cand.email, role: bridgeRole,
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
    } else if (!cand.email) {
      warnings.push("adayın e-postası yok — Ekip Paneli'ne eklenemedi");
    } else {
      warnings.push("bağlı proje yok — Ekip Paneli'ne eklenemedi");
    }

    // ── 5. person_id geri yaz + rol filled ───────────────────
    if (personId && personId !== cand.person_id) {
      const { error } = await db.from("hub_candidates").update({ person_id: personId }).eq("id", candidateId);
      if (error) warnings.push("person_id geri yazılamadı: " + error.message);
    }
    if (role_row && role_row.status !== "filled") {
      const { error } = await db.from("hub_open_roles")
        .update({ status: "filled", filled_at: joinedAt }).eq("id", role_row.id);
      if (error) warnings.push("rol 'filled' işaretlenemedi: " + error.message);
      else steps.roleFilled = true;
    }

    return json({ ok: true, personId, vestingStart, steps, warnings });
  } catch (e) {
    return json({ error: String(e) }, 500);
  }
});
