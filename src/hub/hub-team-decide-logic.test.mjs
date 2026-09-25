// Çalıştır: node src/hub/hub-team-decide-logic.test.mjs
// hub-team-decide-offer Edge Function'ının saf mantığını (ağsız) test eder.
import assert from "node:assert/strict";
import { computeDecideOfferPatch } from "../../supabase/functions/hub-team-decide-offer/logic.ts";

function baseSnapshot(overrides = {}) {
  return {
    teams: [{ id: "A", name: "Team A" }],
    users: [{ id: 1, name: "Lead A", email: "leada@x.com", role: "lead", team: "A" }],
    candidateOffers: [
      { id: "o1", teamId: "A", hubCandidateId: "hc1", fullName: "Ada Yılmaz", email: "ada@x.com", status: "pending", createdAt: 1000, decidedAt: null, decidedBy: null },
    ],
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

// 1. Kabul — gerçek üye eklenir + teklif accepted olur
{
  const snap = baseSnapshot();
  const r = computeDecideOfferPatch(snap, { offerId: "o1", decision: "accepted", decidedBy: 1 });
  check("1a ok:true", r.ok === true);
  check("1b created:true", r.created === true);
  check("1c inviteEligible:true", r.inviteEligible === true);
  check("1d kullanıcı users'a eklendi", r.snapshot.users.some((u) => u.id === r.userId && u.email === "ada@x.com"));
  check("1e teklif accepted", r.snapshot.candidateOffers.find((o) => o.id === "o1").status === "accepted");
  check("1f decidedBy yazıldı", r.snapshot.candidateOffers.find((o) => o.id === "o1").decidedBy === 1);
}

// 2. Ret — kullanıcı EKLENMEZ, yalnızca teklif rejected olur
{
  const snap = baseSnapshot();
  const r = computeDecideOfferPatch(snap, { offerId: "o1", decision: "rejected", decidedBy: 1 });
  check("2a ok:true", r.ok === true);
  check("2b users değişmedi", r.snapshot.users.length === 1);
  check("2c teklif rejected", r.snapshot.candidateOffers.find((o) => o.id === "o1").status === "rejected");
}

// 3. Zaten karar verilmiş bir teklif tekrar karara bağlanamaz
{
  const snap = baseSnapshot({ candidateOffers: [{ id: "o1", teamId: "A", hubCandidateId: "hc1", fullName: "Ada", email: "ada@x.com", status: "accepted" }] });
  const r = computeDecideOfferPatch(snap, { offerId: "o1", decision: "rejected" });
  check("3a ok:false", r.ok === false);
  check("3b hata mesajı zaten karar verildi diyor", /karara bağlanmış/.test(r.error || ""));
}

// 4. Var olmayan teklif
{
  const snap = baseSnapshot();
  const r = computeDecideOfferPatch(snap, { offerId: "yok", decision: "accepted" });
  check("4a ok:false", r.ok === false);
}

// 5. Geçersiz decision
{
  const snap = baseSnapshot();
  const r = computeDecideOfferPatch(snap, { offerId: "o1", decision: "maybe" });
  check("5a ok:false", r.ok === false);
}

console.log(failures === 0 ? "\nTÜM TESTLER GEÇTİ" : `\n${failures} TEST BAŞARISIZ`);
process.exit(failures === 0 ? 0 : 1);
