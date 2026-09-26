// Çalıştır: node src/hub/hub-bridge-create-team-logic.test.mjs
// hub-bridge-create-team Edge Function'ının saf mantığını (ağsız) test eder.
import assert from "node:assert/strict";
import { computeCreateTeam } from "../../supabase/functions/hub-bridge-create-team/logic.ts";

function baseSnapshot(overrides = {}) {
  return {
    teams: [{ id: "A", name: "Team A" }, { id: "B", name: "Team B" }],
    users: [{ id: 1, name: "sabit kalmalı" }],
    tasks: [{ id: 99, title: "sabit kalmalı" }],
    sprints: [{ id: "s1", team: "A" }],
    customCats: ["etiket"],
    activity: [],
    notifications: [],
    trash: [],
    _at: 1000,
    ...overrides,
  };
}

let pass = 0, fail = 0;
function check(name, cond) {
  if (cond) { pass++; console.log("  ok  " + name); }
  else { fail++; console.log("  FAIL " + name); }
}

// 1) Boş takım listesinde ilk harften (A) değil, kullanılmayan ilk harften başlar
{
  const snap = baseSnapshot();
  const r = computeCreateTeam(snap, { name: "Yeni Proje", oneLiner: "Kısa açıklama" });
  check("1a ok:true", r.ok === true);
  check("1b teamId 'C' (A,B kullanımda)", r.teamId === "C");
  check("1c teams'e eklendi", r.snapshot.teams.length === 3);
  const t = r.snapshot.teams.find((x) => x.id === "C");
  check("1d name doğru", t.name === "Yeni Proje");
  check("1e desc doğru", t.desc === "Kısa açıklama");
  check("1f info alanları boş nesne", t.info && t.info.goal === "" && t.info.problem === "");
  check("1g resources boş dizi", Array.isArray(t.resources) && t.resources.length === 0);
  check("1h color varsayılan", t.color === "#2563EB");
}

// 2) Renk geçilirse kullanılır
{
  const snap = baseSnapshot();
  const r = computeCreateTeam(snap, { name: "X", color: "#16A34A" });
  const t = r.snapshot.teams.find((x) => x.id === "C");
  check("2a özel renk kullanıldı", t.color === "#16A34A");
}

// 3) 3 aylık sprint üretiliyor, mevcut sprint'ler korunuyor
{
  const snap = baseSnapshot();
  const r = computeCreateTeam(snap, { name: "X" });
  const newSprints = r.snapshot.sprints.filter((s) => s.team === "C");
  check("3a 3 sprint üretildi", newSprints.length === 3);
  check("3b mevcut sprint korundu", r.snapshot.sprints.some((s) => s.id === "s1"));
  check("3c sprint isimleri sıralı", newSprints.map((s) => s.name).join(",") === "Sprint 1,Sprint 2,Sprint 3");
}

// 4) İsim zorunlu
{
  const snap = baseSnapshot();
  const r = computeCreateTeam(snap, { name: "" });
  check("4a boş isim reddedilir", r.ok === false);
}

// 5) İlgisiz alanlara (users/tasks/customCats/trash) dokunulmaz
{
  const snap = baseSnapshot();
  const r = computeCreateTeam(snap, { name: "X" });
  check("5a users değişmedi", r.snapshot.users === snap.users);
  check("5b tasks değişmedi", r.snapshot.tasks === snap.tasks);
  check("5c customCats değişmedi", r.snapshot.customCats === snap.customCats);
}

// 6) Aktivite kaydı düşüyor
{
  const snap = baseSnapshot();
  const r = computeCreateTeam(snap, { name: "Roket", source: { actorEmail: "kurucu@x.com" } });
  check("6a activity eklendi", r.snapshot.activity.length === 1);
  check("6b actor doğru", r.snapshot.activity[0].text.includes("kurucu@x.com"));
}

// 7) 26 takım doluysa T+length'e düşer
{
  const teams = Array.from({ length: 26 }, (_, i) => ({ id: String.fromCharCode(65 + i) }));
  const snap = baseSnapshot({ teams });
  const r = computeCreateTeam(snap, { name: "X" });
  check("7a fallback id", r.teamId === "T26");
}

console.log(`\n${pass} senaryo geçti${fail ? `, ${fail} BAŞARISIZ` : ""}`);
if (fail) process.exit(1);
