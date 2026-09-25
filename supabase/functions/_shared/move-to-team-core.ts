// _shared/move-to-team-core.ts
// hub-move-to-team'in DB-yazan çekirdeği (adım 1-2-3-5) — hem hub-move-to-team
// (kurucu hattı, HR'dan doğrudan "Ekibe al") hem hub-owner-decision (üye
// hattı, Team Lead kabul edince ana projeye geri bildirim) tarafından
// kullanılır. Team App'e gerçek üyelik EKLEMEZ (o adım 4 — çağıranın işi:
// hub-move-to-team kendi yapar, hub-owner-decision'da zaten Team App
// tarafında önceden yapılmış olur).
//
// Her adım ayrı try/catch — patlayan adım `warnings`e yazılır, akış durmaz.

export interface MoveToTeamCoreResult {
  ok: boolean;
  error?: string;
  cand?: Record<string, unknown>;
  roleRow?: Record<string, unknown> | null;
  startupId?: number | null;
  personId?: string | null;
  vestingStart?: string | null;
  joinedAt?: string;
  steps: Record<string, boolean>;
  warnings: string[];
}

// deno-lint-ignore no-explicit-any
export async function runMoveToTeamCore(db: any, candidateId: string): Promise<MoveToTeamCoreResult> {
  const steps: Record<string, boolean> = { stage: false, person: false, membership: false, roleFilled: false };
  const warnings: string[] = [];

  const { data: cand, error: ce } = await db.from("hub_candidates").select("*").eq("id", candidateId).single();
  if (ce || !cand) return { ok: false, error: "Aday bulunamadı.", steps, warnings };

  let roleRow: Record<string, unknown> | null = null;
  if (cand.open_role_id) {
    const { data: r } = await db.from("hub_open_roles").select("*").eq("id", cand.open_role_id).single();
    roleRow = r ?? null;
  }
  const startupId = (roleRow?.startup_id as number | null) ?? (cand.startup_id as number | null) ?? null;

  // Hak ediş başlangıcı = Kapı A'nın ilk günü (geriye dönük).
  const { data: gatesA } = await db
    .from("hub_gates").select("started_at")
    .eq("candidate_id", candidateId).eq("gate", "A").not("started_at", "is", null)
    .order("started_at", { ascending: true }).limit(1);
  const vestingStart = gatesA?.[0]?.started_at ? String(gatesA[0].started_at).slice(0, 10) : null;
  const joinedAt = new Date().toISOString();

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
    return { ok: false, error: "Aşama güncellenemedi: " + (e as Error).message, steps, warnings };
  }

  // ── 2. people roster kaydı (people.id TEXT — biz üretiriz) ─
  let personId: string | null = (cand.person_id as string | null) ?? null;
  if (!personId) {
    try {
      const newId = crypto.randomUUID();
      const rosterRow = {
        id: newId,
        name: cand.full_name || "Yeni üye",
        role_tr: (roleRow?.title as string) || "Ekip üyesi",
        role_en: (roleRow?.title as string) || "Team member",
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

  // ── 5. person_id geri yaz + rol filled ───────────────────
  if (personId && personId !== cand.person_id) {
    const { error } = await db.from("hub_candidates").update({ person_id: personId }).eq("id", candidateId);
    if (error) warnings.push("person_id geri yazılamadı: " + error.message);
  }
  if (roleRow && roleRow.status !== "filled") {
    const { error } = await db.from("hub_open_roles")
      .update({ status: "filled", filled_at: joinedAt }).eq("id", roleRow.id);
    if (error) warnings.push("rol 'filled' işaretlenemedi: " + error.message);
    else steps.roleFilled = true;
  }

  return { ok: true, cand, roleRow, startupId, personId, vestingStart, joinedAt, steps, warnings };
}
