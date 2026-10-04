// Çalıştır: node src/hub/hub-bridge-present-logic.test.mjs
// hub-bridge-present-candidate Edge Function'ının saf mantığını (ağsız) test eder.
import assert from "node:assert/strict";
import { computeOfferPresentPatch } from "../../supabase/functions/hub-bridge-present-candidate/logic.ts";

function baseSnapshot(overrides = {}) {
  return {
    teams: [{ id: "A", name: "Team A" }],
    users: [
      { id: 1, name: "Lead A", email: "leada@x.com", role: "lead", team: "A" },
      { id: 2, name: "Admin", email: "admin@x.com", role: "admin" },
      { id: 3, name: "Member A", email: "membera@x.com", role: "member", team: "A" },
    ],
    candidateOffers: [],
    notifications: [],
    _at: 1000,
    ...overrides,
  };
}

let failures = 0;
function check(label, cond) {
  if (!cond) { failures++; console.log("FAIL:", label); }
  else console.log("ok  :", label);
}

// 1. Yeni bir bekleyen aday sunulur
{
  const snap = baseSnapshot();
  const r = computeOfferPresentPatch(snap, {
    teamId: "A", hubCandidateId: "hc1", fullName: "Ada Yılmaz", email: "Ada@X.com",
    phone: "+90500", roleTitle: "Backend Geliştirici", note: "Kapı A'yı geçti.",
  });
  check("1a ok:true", r.ok === true);
  check("1b alreadyPending:false", r.alreadyPending === false);
  check("1c candidateOffers'a eklendi", r.snapshot.candidateOffers.length === 1);
  check("1d status pending", r.snapshot.candidateOffers[0].status === "pending");
  check("1e email normalize edildi", r.snapshot.candidateOffers[0].email === "ada@x.com");
  check("1f lead + admin'e bildirim gitti (member'a değil)", r.snapshot.notifications.length === 2);
  check("1g bildirim doğru kullanıcılara", new Set(r.snapshot.notifications.map(n => n.forUser)).size === 2 &&
    [1, 2].every(id => r.snapshot.notifications.some(n => n.forUser === id)));
}

// 2. Aynı aday ikinci kez sunulursa (idempotent) — yeni kayıt açılmaz
{
  const snap = baseSnapshot();
  const r1 = computeOfferPresentPatch(snap, { teamId: "A", hubCandidateId: "hc1", fullName: "Ada", email: "ada@x.com" });
  const r2 = computeOfferPresentPatch(r1.snapshot, { teamId: "A", hubCandidateId: "hc1", fullName: "Ada", email: "ada@x.com" });
  check("2a ikinci çağrı ok:true", r2.ok === true);
  check("2b alreadyPending:true", r2.alreadyPending === true);
  check("2c ikinci kayıt açılmadı", r2.snapshot.candidateOffers.length === 1);
  check("2d aynı offerId döndü", r1.offerId === r2.offerId);
}

// 3. Aynı aday daha önce reddedilmişse (status !== pending) yeniden sunulabilir
{
  const rejected = [{ id: "old1", teamId: "A", hubCandidateId: "hc1", status: "rejected", fullName: "Ada", email: "ada@x.com" }];
  const snap = baseSnapshot({ candidateOffers: rejected });
  const r = computeOfferPresentPatch(snap, { teamId: "A", hubCandidateId: "hc1", fullName: "Ada", email: "ada@x.com" });
  check("3a yeni bir pending kayıt açıldı", r.snapshot.candidateOffers.length === 2);
  check("3b eskisi durdu, yenisi pending", r.snapshot.candidateOffers.some(o => o.id === "old1" && o.status === "rejected"));
}

// 4. Zorunlu alanlar
{
  const snap = baseSnapshot();
  const r = computeOfferPresentPatch(snap, { teamId: "A", fullName: "Ada", email: "ada@x.com" });
  check("4a hubCandidateId eksikse reddedilir", r.ok === false);
}

// 5. Bilinmeyen ekip
{
  const snap = baseSnapshot();
  const r = computeOfferPresentPatch(snap, { teamId: "ZZZ", hubCandidateId: "hc1", fullName: "Ada", email: "ada@x.com" });
  check("5a ok:false", r.ok === false);
  check("5b hata mesajı ekip yok diyor", /ekibi yok/.test(r.error || ""));
}


// ── Adım 3: kurucuya bildirim maili ─────────────────────────────────────
import { offerMailRecipients, offerNotifyMail } from "../../supabase/functions/hub-bridge-present-candidate/logic.ts";
{
  const r = offerMailRecipients(baseSnapshot(), "A");
  assert.deepEqual(r.map((u) => u.email), ["leada@x.com"], "lead varsa yalnızca lead'e gider");
  const noLead = baseSnapshot({ users: [{ id: 2, name: "Admin", email: "Admin@X.com", role: "admin" }, { id: 3, email: "m@x.com", role: "member", team: "A" }] });
  assert.deepEqual(offerMailRecipients(noLead, "A").map((u) => u.email), ["admin@x.com"], "lead yoksa admin'e düşer");
  const teamRole = baseSnapshot({ users: [{ id: 5, name: "Çok ekipli", email: "c@x.com", role: "member", teams: ["B", "A"], teamRoles: { A: "lead" } }] });
  assert.deepEqual(offerMailRecipients(teamRole, "A").map((u) => u.email), ["c@x.com"], "teamRoles ile lead olan da sayılır");
  const m = offerNotifyMail("Team A", { teamId: "A", hubCandidateId: "h", fullName: "Ece", email: "e@x.com", roleTitle: "Mobil", note: "React Native deneyimi" }, "Lead A");
  assert.equal(m.subject, "Sana bir aday önerildi — Mobil");
  assert.ok(m.body.includes("Ece") && m.body.includes("Neden bu kişi: React Native deneyimi") && m.body.includes("/team/"));
  console.log("ok — kurucuya bildirim maili (alıcı + metin)");
}

console.log(failures === 0 ? "\nTÜM TESTLER GEÇTİ" : `\n${failures} TEST BAŞARISIZ`);
process.exit(failures === 0 ? 0 : 1);
