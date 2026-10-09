// Supabase Edge Function: hub-owner-decision
// BU PROJEYE DEPLOY EDİLİR: fdlghaafspcuagxfrofz (ana proje — HR/Admin/Hub),
// umgdtjlgivvymngsnqtv (Team App) DEĞİL. `--no-verify-jwt` (yalnızca
// x-hub-bridge-key ile çağrılır — Team App'in hub-team-decide-offer'ı).
//
// Team App'teki kurucunun (Team Lead) her adımını HR'a (hub_candidates /
// hub_gates) yansıtır. 2026-10-04 (Adım 4/5) — üye hattı yeni sıra:
//   action 'templates'    → aktif Kapı A şablonları (kurucunun seçicisi, Bölüm H)
//   action 'interview'    → owner_stage='interview' ("kendim görüşeyim")
//   action 'gate_started' → kurucu kabul etti + Kapı A görevini gönderdi:
//                           hub_gates satırı (template_id, task_text, due_at),
//                           stage → trial, owner_decision='accepted', owner_stage='gate'
//   action 'gate_result'  → kurucu Kapı A'yı değerlendirdi (passed|failed)
//   decision 'accepted'   → "Ekibe Al": Team App'te üyelik zaten kuruldu; burada
//                           _shared/move-to-team-core.ts (hub-move-to-team ile AYNI kod)
//   decision 'rejected'   → owner_decision='rejected' + rol yeniden açma
// Eski çağrılar ({ decision }) aynen çalışır.

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

// Ret sonrası rol asılı bırakılmaz (hub-rules.js roleStatusAfterReject ile
// AYNI mantık — o dosya frontend bundle'ının parçası, buradan import edilemez).
async function reopenRoleIfNeeded(db: any, cand: any, warnings: string[]) {
  if (!cand.open_role_id) return;
  const { data: roleRow } = await db.from("hub_open_roles").select("*").eq("id", cand.open_role_id).single();
  if (!roleRow || roleRow.status !== "shortlist") return;
  const { count } = await db.from("hub_candidates")
    .select("id", { count: "exact", head: true })
    .eq("open_role_id", cand.open_role_id)
    .eq("owner_decision", "pending")
    .neq("id", cand.id);
  if (!count) {
    const { error: re } = await db.from("hub_open_roles").update({ status: "sourcing" }).eq("id", cand.open_role_id);
    if (re) warnings.push("rol 'sourcing'e döndürülemedi: " + re.message);
  }
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });

  const token = req.headers.get("x-hub-bridge-key");
  if (!HUB_BRIDGE_SECRET || token !== HUB_BRIDGE_SECRET) return json({ ok: false, error: "unauthorized" }, 401);

  try {
    const body = await req.json();
    const { hubCandidateId, note } = body || {};
    const action: string = body?.action || body?.decision;
    const db = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, { auth: { autoRefreshToken: false, persistSession: false } });

    // ── Şablon listesi — adaya bağlı değil ──────────────────────────────
    if (action === "templates") {
      const { data, error } = await db.from("hub_gate_templates")
        .select("id, category, title, description, duration_hours, delivery_type, sort_order")
        .eq("active", true).order("category").order("sort_order").order("title");
      if (error) return json({ ok: false, error: error.message }, 500);
      return json({ ok: true, templates: data || [] });
    }

    if (!hubCandidateId) return json({ ok: false, error: "hubCandidateId zorunlu" }, 400);
    const { data: cand, error: ce } = await db.from("hub_candidates").select("*").eq("id", hubCandidateId).single();
    if (ce || !cand) return json({ ok: false, error: "Aday bulunamadı." }, 404);
    const warnings: string[] = [];

    if (action === "interview") {
      const { error } = await db.from("hub_candidates").update({ owner_stage: "interview" }).eq("id", hubCandidateId);
      if (error) return json({ ok: false, error: error.message }, 500);
      return json({ ok: true, action });
    }

    if (action === "gate_started") {
      const { templateId, taskText, dueAt } = body;
      if (!taskText || !dueAt) return json({ ok: false, error: "taskText ve dueAt zorunlu" }, 400);
      let startupId = cand.startup_id ?? null;
      if (startupId == null && cand.open_role_id) {
        const { data: r } = await db.from("hub_open_roles").select("startup_id").eq("id", cand.open_role_id).single();
        startupId = r?.startup_id ?? null;
      }
      const startedAt = new Date().toISOString();
      const { error: ge } = await db.from("hub_gates").insert({
        candidate_id: hubCandidateId, gate: "A", startup_id: startupId, template_id: templateId || null,
        task_text: taskText, started_at: startedAt, due_at: new Date(dueAt).toISOString(), result: "pending",
      });
      if (ge) return json({ ok: false, error: "Kapı A kaydı açılamadı: " + ge.message }, 500);
      const { error: ue } = await db.from("hub_candidates").update({
        stage: "trial", stage_changed_at: startedAt, startup_id: startupId,
        owner_decision: "accepted", owner_decision_note: null, owner_stage: "gate",
      }).eq("id", hubCandidateId);
      if (ue) return json({ ok: false, error: ue.message }, 500);
      if (cand.stage !== "trial") {
        await db.from("hub_stage_log").insert({
          candidate_id: hubCandidateId, from_stage: cand.stage, to_stage: "trial",
          reason: "proje sahibi kabul etti — Kapı A görevini kendisi gönderdi",
        });
      }
      return json({ ok: true, action });
    }

    if (action === "gate_result") {
      const { result } = body;
      if (result !== "passed" && result !== "failed") return json({ ok: false, error: "result 'passed' ya da 'failed'" }, 400);
      const { data: gates } = await db.from("hub_gates").select("id").eq("candidate_id", hubCandidateId)
        .eq("gate", "A").eq("result", "pending").order("started_at", { ascending: false }).limit(1);
      if (gates?.[0]) {
        const { error } = await db.from("hub_gates").update({
          delivered: result === "passed", result, evaluation: note || null,
        }).eq("id", gates[0].id);
        if (error) warnings.push("Kapı A sonucu yazılamadı: " + error.message);
      } else warnings.push("bekleyen Kapı A kaydı bulunamadı");
      const patch: Record<string, unknown> = { owner_stage: result === "passed" ? "gate_passed" : "rejected" };
      if (result === "failed") { patch.owner_decision = "rejected"; patch.owner_decision_note = note || null; }
      const { error: ue } = await db.from("hub_candidates").update(patch).eq("id", hubCandidateId);
      if (ue) return json({ ok: false, error: ue.message }, 500);
      if (result === "failed") await reopenRoleIfNeeded(db, cand, warnings);
      return json({ ok: true, action, warnings });
    }

    if (action === "accepted") {
      const core = await runMoveToTeamCore(db, hubCandidateId);
      if (!core.ok) return json({ ok: false, error: core.error }, 500);
      await db.from("hub_candidates").update({ owner_decision: "accepted", owner_stage: "joined" }).eq("id", hubCandidateId);
      return json({ ok: true, decision: action, personId: core.personId, vestingStart: core.vestingStart, equityDraft: core.equityDraft, steps: core.steps, warnings: core.warnings });
    }

    if (action === "rejected") {
      const { error: ue } = await db.from("hub_candidates")
        .update({ owner_decision: "rejected", owner_decision_note: note || null, owner_stage: "rejected" })
        .eq("id", hubCandidateId);
      if (ue) return json({ ok: false, error: ue.message }, 500);
      // Kapı A sürerken ret → açık kapı kaydı da kapanır (asılı kalmasın).
      await db.from("hub_gates").update({ result: "failed", evaluation: note || "proje sahibi reddetti" })
        .eq("candidate_id", hubCandidateId).eq("gate", "A").eq("result", "pending");
      await reopenRoleIfNeeded(db, cand, warnings);
      return json({ ok: true, decision: action, warnings });
    }

    return json({ ok: false, error: `Geçersiz işlem: ${action}` }, 400);
  } catch (e) {
    return json({ ok: false, error: String(e) }, 500);
  }
});
