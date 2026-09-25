// Supabase Edge Function: hub-owner-decision
// BU PROJEYE DEPLOY EDİLİR: fdlghaafspcuagxfrofz (ana proje — HR/Admin/Hub),
// umgdtjlgivvymngsnqtv (Team App) DEĞİL.
//
// 2026-09-25 — üye (member) hattındaki adaylar artık HR'daki cofounder'ın
// tek başına "Ekibe al"ıyla değil, Team App'teki gerçek Team Lead'in
// (o ekibin sahibi) kararıyla ekibe alınıyor. Team Lead Team sayfasında
// Kabul/Ret verince, Team App'in `hub-team-decide-offer` fonksiyonu BU
// fonksiyonu çağırıp kararı HR'a bildirir — `x-hub-bridge-key` ile yetkilenir
// (hub-bridge-add-member/hub-bridge-present-candidate'in AYNI sırrı,
// simetrik yön: Team → Main).
//
// decision='accepted': Team App'te üyelik zaten kuruldu (hub-team-decide-offer
// içinde) — burada yalnızca HR tarafı senkronize edilir: stage->member,
// people roster, startups.member_ids, rol->filled. `_shared/move-to-team-core.ts`
// hub-move-to-team ile AYNI kod — TEKRARLANMAZ. Team App'e tekrar bridge
// çağrısı YAPILMAZ (zaten oradan geldik).
//
// decision='rejected': owner_decision/owner_decision_note yazılır, stage
// DEĞİŞMEZ; bağlı rol shortlist'teyse ve başka bekleyen sunum yoksa sourcing'e
// döner (roleStatusAfterReject, hub-rules.js ile AYNI mantık — SQL'de tekrar
// edilir, o dosya frontend bundle'ının parçası, edge function'dan import
// edilemez).

import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { runMoveToTeamCore } from "../_shared/move-to-team-core.ts";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const HUB_BRIDGE_SECRET = Deno.env.get("HUB_BRIDGE_SECRET");

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-hub-bridge-key",
};
const json = (b: unknown, s = 200) =>
  new Response(JSON.stringify(b), { status: s, headers: { ...cors, "Content-Type": "application/json" } });

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });

  const token = req.headers.get("x-hub-bridge-key");
  if (!HUB_BRIDGE_SECRET || token !== HUB_BRIDGE_SECRET) return json({ ok: false, error: "unauthorized" }, 401);

  try {
    const { hubCandidateId, decision, note } = await req.json();
    if (!hubCandidateId) return json({ ok: false, error: "hubCandidateId zorunlu" }, 400);
    if (decision !== "accepted" && decision !== "rejected") {
      return json({ ok: false, error: "decision 'accepted' veya 'rejected' olmalı" }, 400);
    }

    const db = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, { auth: { autoRefreshToken: false, persistSession: false } });

    const { data: cand, error: ce } = await db.from("hub_candidates").select("*").eq("id", hubCandidateId).single();
    if (ce || !cand) return json({ ok: false, error: "Aday bulunamadı." }, 404);

    if (decision === "accepted") {
      const core = await runMoveToTeamCore(db, hubCandidateId);
      if (!core.ok) return json({ ok: false, error: core.error }, 500);
      await db.from("hub_candidates").update({ owner_decision: "accepted", owner_decision_note: note || null }).eq("id", hubCandidateId);
      return json({ ok: true, decision, personId: core.personId, vestingStart: core.vestingStart, steps: core.steps, warnings: core.warnings });
    }

    // decision === 'rejected'
    const { error: ue } = await db.from("hub_candidates")
      .update({ owner_decision: "rejected", owner_decision_note: note || null })
      .eq("id", hubCandidateId);
    if (ue) return json({ ok: false, error: ue.message }, 500);

    const warnings: string[] = [];
    if (cand.open_role_id) {
      const { data: roleRow } = await db.from("hub_open_roles").select("*").eq("id", cand.open_role_id).single();
      if (roleRow && roleRow.status === "shortlist") {
        const { count } = await db.from("hub_candidates")
          .select("id", { count: "exact", head: true })
          .eq("open_role_id", cand.open_role_id)
          .eq("owner_decision", "pending")
          .neq("id", hubCandidateId);
        if (!count) {
          const { error: re } = await db.from("hub_open_roles").update({ status: "sourcing" }).eq("id", cand.open_role_id);
          if (re) warnings.push("rol 'sourcing'e döndürülemedi: " + re.message);
        }
      }
    }

    return json({ ok: true, decision, warnings });
  } catch (e) {
    return json({ ok: false, error: String(e) }, 500);
  }
});
