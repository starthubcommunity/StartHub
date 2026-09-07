// Çalıştır: node src/hub/hub-bridge-logic.test.mjs
// hub-bridge-add-member Edge Function'ının saf mantığını (ağsız) test eder.
import assert from "node:assert/strict";
import { computeBridgePatch } from "../../supabase/functions/hub-bridge-add-member/logic.ts";

function baseSnapshot(overrides = {}) {
  return {
    teams: [{ id: "A", name: "Team A" }, { id: "B", name: "Team B" }],
    users: [
      { id: 1, name: "Lead A", email: "leada@x.com", role: "lead", team: "A" },
      { id: 2, name: "Member A", email: "membera@x.com", role: "member", team: "A" },
    ],
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

let failures = 0;
function check(label, cond) {
  if (!cond) { failures++; console.log("FAIL:", label); }
  else console.log("ok  :", label);
}

// 1. Yeni kullanıcı oluşturma
{
  const snap = baseSnapshot();
  const r = computeBridgePatch(snap, { teamId: "B", fullName: "Yeni Aday", email: "Yeni.Aday@X.com", role: "member", source: { candidateId: "c1", actorEmail: "kurucu@x.com" } });
  check("1a ok:true", r.ok === true);
  check("1b created", r.created === true);
  check("1c addedToTeam", r.addedToTeam === true);
  check("1d email küçük harfe normalize edildi", r.snapshot.users.find(u => u.id === r.userId).email === "yeni.aday@x.com");
  check("1e teams dizisi doğru", JSON.stringify(r.snapshot.users.find(u => u.id === r.userId).teams) === JSON.stringify(["B"]));
  check("1f activity kaydı eklendi", r.snapshot.activity.length === 1);
  check("1g notification eklendi", r.snapshot.notifications.length === 1);
  check("1h diğer alanlara dokunulmadı (tasks)", JSON.stringify(r.snapshot.tasks) === JSON.stringify(snap.tasks));
  check("1i diğer alanlara dokunulmadı (sprints)", JSON.stringify(r.snapshot.sprints) === JSON.stringify(snap.sprints));
  check("1j diğer alanlara dokunulmadı (customCats)", JSON.stringify(r.snapshot.customCats) === JSON.stringify(snap.customCats));
}

// 2. Var olan email'i yeni ekibe ekleme (multi-team)
{
  const snap = baseSnapshot();
  const r = computeBridgePatch(snap, { teamId: "B", fullName: "Member A", email: "membera@x.com", role: "member", source: {} });
  check("2a ok:true", r.ok === true);
  check("2b created:false (var olan kullanıcı)", r.created === false);
  check("2c addedToTeam:true", r.addedToTeam === true);
  check("2d userId aynı kişi", r.userId === 2);
  const updated = r.snapshot.users.find(u => u.id === 2);
  check("2e teams dizisine B eklendi", JSON.stringify(updated.teams.sort()) === JSON.stringify(["A", "B"]));
  check("2f orijinal team alanı A olarak korundu", updated.team === "A");
}

// 3. Zaten o ekipte — no-op (idempotent)
{
  const snap = baseSnapshot();
  const r = computeBridgePatch(snap, { teamId: "A", fullName: "Member A", email: "membera@x.com", role: "member", source: {} });
  check("3a ok:true", r.ok === true);
  check("3b alreadyMember:true", r.alreadyMember === true);
  check("3c addedToTeam:false", r.addedToTeam === false);
  check("3d activity eklenmedi", r.snapshot.activity.length === 0);
  check("3e notification eklenmedi", r.snapshot.notifications.length === 0);
}

// 4. Lead çakışması — yeni kullanıcı, zaten lead var → member'a düşürülür
{
  const snap = baseSnapshot();
  const r = computeBridgePatch(snap, { teamId: "A", fullName: "İkinci Kurucu", email: "ikinci@x.com", role: "lead", source: {} });
  check("4a ok:true", r.ok === true);
  check("4b downgradedFromLead:true", r.downgradedFromLead === true);
  const u = r.snapshot.users.find(x => x.id === r.userId);
  check("4c fiilen member olarak eklendi", u.role === "member");
}

// 5. Lead çakışması — var olan kullanıcı yeni ekipte lead istiyor, orada zaten lead var
{
  const snap = baseSnapshot({
    users: [
      { id: 1, name: "Lead A", email: "leada@x.com", role: "lead", team: "A" },
      { id: 3, name: "Lead B", email: "leadb@x.com", role: "lead", team: "B" },
    ],
  });
  const r = computeBridgePatch(snap, { teamId: "B", fullName: "Lead A", email: "leada@x.com", role: "lead", source: {} });
  check("5a downgradedFromLead:true", r.downgradedFromLead === true);
  const u = r.snapshot.users.find(x => x.id === 1);
  check("5b teamRoles.B = member", u.teamRoles?.B === "member");
  check("5c kendi orijinal rolü (A'daki lead) bozulmadı", u.role === "lead");
}

// 6. Bilinmeyen teamId → hata, 404 tipi
{
  const snap = baseSnapshot();
  const r = computeBridgePatch(snap, { teamId: "Z", fullName: "X", email: "x@x.com", role: "member", source: {} });
  check("6a ok:false", r.ok === false);
  check("6b hata mesajı ekip yok diyor", /ekibi yok/.test(r.error));
}

// 7. Eksik/geçersiz alanlar → doğrulama hatası
{
  const snap = baseSnapshot();
  const r1 = computeBridgePatch(snap, { teamId: "A", fullName: "", email: "x@x.com", role: "member", source: {} });
  check("7a boş fullName reddedilir", r1.ok === false);
  const r2 = computeBridgePatch(snap, { teamId: "A", fullName: "X", email: "x@x.com", role: "admin", source: {} });
  check("7b geçersiz role reddedilir", r2.ok === false);
}

console.log(failures === 0 ? "\nTÜM TESTLER GEÇTİ" : `\n${failures} TEST BAŞARISIZ`);
process.exit(failures === 0 ? 0 : 1);
