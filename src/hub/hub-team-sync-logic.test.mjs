// Çalıştır: node src/hub/hub-team-sync-logic.test.mjs
// hub-team-sync Edge Function'ının saf mantığını (ağsız) test eder.
import assert from "node:assert/strict";
import { computePushDescription, computeRosterSummary } from "../../supabase/functions/hub-team-sync/logic.ts";

function baseSnapshot(overrides = {}) {
  return {
    teams: [{ id: "A", name: "Team A" }, { id: "B", name: "Team B", description: "eski açıklama" }],
    users: [
      { id: 1, name: "Lider A", email: "lidera@x.com", role: "lead", team: "A" },
      { id: 2, name: "Üye A", email: "uyea@x.com", role: "member", team: "A" },
      { id: 3, name: "Çoklu Üye", email: "coklu@x.com", role: "member", teams: ["A", "B"], teamRoles: { B: "lead" } },
    ],
    tasks: [{ id: 99, title: "sabit kalmalı" }],
    _at: 1000,
    ...overrides,
  };
}

let n = 0;
function ok(label, cond) { n++; if (!cond) { console.error("FAIL:", label); process.exit(1); } console.log("ok  ", label); }

// ── computePushDescription ──────────────────────────────────
{
  const r = computePushDescription(baseSnapshot(), { teamId: "A", description: "Yeni, güzel açıklama" });
  ok("push: ok:true", r.ok === true);
  ok("push: changed:true (önce yoktu)", r.changed === true);
  ok("push: teams[A].description doğru", r.snapshot.teams.find(t => t.id === "A").description === "Yeni, güzel açıklama");
  ok("push: teams[B] dokunulmadı", r.snapshot.teams.find(t => t.id === "B").description === "eski açıklama");
  ok("push: users/tasks dokunulmadı", r.snapshot.users.length === 3 && r.snapshot.tasks.length === 1);
}
{
  const r = computePushDescription(baseSnapshot(), { teamId: "B", description: "eski açıklama" });
  ok("push: aynı değer -> changed:false", r.ok === true && r.changed === false);
}
{
  const r = computePushDescription(baseSnapshot(), { teamId: "ZZZ", description: "x" });
  ok("push: bilinmeyen teamId -> ok:false", r.ok === false && /ekibi yok/.test(r.error));
}
{
  const r = computePushDescription(baseSnapshot(), { teamId: "", description: "x" });
  ok("push: teamId zorunlu", r.ok === false);
}

// ── computeRosterSummary ────────────────────────────────────
{
  const r = computeRosterSummary(baseSnapshot(), { teamId: "A" });
  ok("roster A: ok:true", r.ok === true);
  ok("roster A: memberCount 3 (Lider A + Üye A + Çoklu Üye)", r.memberCount === 3);
  ok("roster A: isimler doğru", r.members.map(m => m.name).sort().join(',') === "Lider A,Üye A,Çoklu Üye".split(',').sort().join(','));
}
{
  const r = computeRosterSummary(baseSnapshot(), { teamId: "B" });
  ok("roster B: memberCount 1 (yalnızca Çoklu Üye)", r.ok === true && r.memberCount === 1);
  ok("roster B: rolü teamRoles'tan (lead)", r.members[0].role === "lead");
}
{
  const r = computeRosterSummary(baseSnapshot(), { teamId: "ZZZ" });
  ok("roster: bilinmeyen teamId -> ok:false", r.ok === false);
}
{
  const r = computeRosterSummary(baseSnapshot({ teams: [{ id: "C", name: "Team C" }], users: [] }), { teamId: "C" });
  ok("roster: hiç üye yok -> memberCount 0", r.ok === true && r.memberCount === 0);
}

console.log(`\n${n} senaryo geçti`);
