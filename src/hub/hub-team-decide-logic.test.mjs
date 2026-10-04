// Çalıştır: node src/hub/hub-team-decide-logic.test.mjs
// hub-team-decide-offer Edge Function'ının saf mantığını (ağsız) test eder.
// 2026-10-04 (Adım 4/5): üye hattı yeni sıra — sun → kabul (Kapı A kurucudan)
// → değerlendir → ekibe al. "Ekibe al" yalnızca Kapı A geçildiyse.
import assert from "node:assert/strict";
import { computeDecideOfferPatch, computeOfferActionPatch, gateTaskMail } from "../../supabase/functions/hub-team-decide-offer/logic.ts";

function offer(status = "pending", extra = {}) {
  return { id: "o1", teamId: "A", hubCandidateId: "hc1", fullName: "Ada Yılmaz", email: "ada@x.com", status, createdAt: 1000, decidedAt: null, decidedBy: null, ...extra };
}
function baseSnapshot(overrides = {}) {
  return {
    teams: [{ id: "A", name: "Team A" }],
    users: [{ id: 1, name: "Lead A", email: "leada@x.com", role: "lead", team: "A" }],
    candidateOffers: [offer()],
    activity: [], notifications: [], trash: [], _at: 1000,
    ...overrides,
  };
}
const GATE = { templateId: "t1", title: "Tek ekranlı prototip", taskText: "Tek ekranlı prototip\n\nAçıklama", durationHours: 72 };
const st = (r) => r.snapshot.candidateOffers.find((o) => o.id === "o1");

let failures = 0;
function check(label, cond) {
  if (!cond) { failures++; console.log("FAIL:", label); }
  else console.log("ok  :", label);
}

// 1. Tam akış: pending → interview → gate → gate_passed → accepted (üye eklenir)
{
  let s = baseSnapshot();
  let r = computeOfferActionPatch(s, { offerId: "o1", action: "interview", actorId: 1, now: 2000 });
  check("1a kendim görüşeyim → interview", r.ok && st(r).status === "interview");
  r = computeOfferActionPatch(r.snapshot, { offerId: "o1", action: "start_gate", actorId: 1, gate: GATE, now: 3000 });
  check("1b kabul + Kapı A → gate", r.ok && st(r).status === "gate");
  check("1c dueAt = gönderim + 72 saat", st(r).gate.dueAt === 3000 + 72 * 3600000);
  check("1d şablon kimliği kaydedildi", st(r).gate.templateId === "t1");
  check("1e henüz üye EKLENMEDİ", r.snapshot.users.length === 1);
  r = computeOfferActionPatch(r.snapshot, { offerId: "o1", action: "evaluate", result: "passed", actorId: 1, now: 4000 });
  check("1f yeterli → gate_passed", r.ok && st(r).status === "gate_passed");
  r = computeOfferActionPatch(r.snapshot, { offerId: "o1", action: "join", actorId: 1, now: 5000 });
  check("1g ekibe al → accepted", r.ok && st(r).status === "accepted");
  check("1h kullanıcı eklendi + davet uygun", r.snapshot.users.some((u) => u.email === "ada@x.com") && r.inviteEligible === true);
  check("1i işlem günlüğü 4 adım", st(r).log.length === 4);
}

// 2. Kapı A'yı atlayarak ekibe alma YOK (eski sekmenin "Kabul"ü dahil)
{
  const r = computeOfferActionPatch(baseSnapshot(), { offerId: "o1", action: "join" });
  check("2a pending'den join reddedilir", r.ok === false);
  const old = computeDecideOfferPatch(baseSnapshot(), { offerId: "o1", decision: "accepted", decidedBy: 1 });
  check("2b eski 'accepted' çağrısı da Kapı A'yı atlayamaz", old.ok === false);
  const inGate = computeOfferActionPatch(baseSnapshot({ candidateOffers: [offer("gate", { gate: GATE })] }), { offerId: "o1", action: "join" });
  check("2c Kapı A değerlendirilmeden join yok", inGate.ok === false);
}

// 3. Ret — gerekçe zorunlu, kullanıcı eklenmez
{
  const noNote = computeOfferActionPatch(baseSnapshot(), { offerId: "o1", action: "reject", note: "  " });
  check("3a gerekçesiz ret reddedilir", noNote.ok === false);
  const r = computeOfferActionPatch(baseSnapshot(), { offerId: "o1", action: "reject", note: "Teknik seviye yeterli değil" });
  check("3b ret → rejected + gerekçe", r.ok && st(r).status === "rejected" && st(r).rejectNote === "Teknik seviye yeterli değil");
  check("3c users değişmedi", r.snapshot.users.length === 1);
  const old = computeDecideOfferPatch(baseSnapshot(), { offerId: "o1", decision: "rejected" });
  check("3d eski 'rejected' çağrısı hâlâ çalışır", old.ok && st(old).status === "rejected");
}

// 4. Kapı A yetersiz → rejected (gerekçe zorunlu)
{
  const s = baseSnapshot({ candidateOffers: [offer("gate", { gate: { ...GATE, result: null } })] });
  check("4a gerekçesiz 'yetersiz' reddedilir", computeOfferActionPatch(s, { offerId: "o1", action: "evaluate", result: "failed" }).ok === false);
  const r = computeOfferActionPatch(s, { offerId: "o1", action: "evaluate", result: "failed", note: "Teslim etmedi" });
  check("4b yetersiz → rejected", r.ok && st(r).status === "rejected" && st(r).gate.result === "failed");
}

// 5. Geçersiz durum geçişleri
{
  check("5a interview iki kez olmaz", computeOfferActionPatch(baseSnapshot({ candidateOffers: [offer("interview")] }), { offerId: "o1", action: "interview" }).ok === false);
  check("5b reddedilmiş adaya Kapı A gitmez", computeOfferActionPatch(baseSnapshot({ candidateOffers: [offer("rejected")] }), { offerId: "o1", action: "start_gate", gate: GATE }).ok === false);
  check("5c görevsiz start_gate reddedilir", computeOfferActionPatch(baseSnapshot(), { offerId: "o1", action: "start_gate", gate: { title: "", taskText: "", durationHours: 72 } }).ok === false);
  check("5d 12 saatlik süre reddedilir", computeOfferActionPatch(baseSnapshot(), { offerId: "o1", action: "start_gate", gate: { ...GATE, durationHours: 12 } }).ok === false);
  check("5e var olmayan teklif", computeOfferActionPatch(baseSnapshot(), { offerId: "yok", action: "interview" }).ok === false);
  check("5f geçersiz işlem", computeOfferActionPatch(baseSnapshot(), { offerId: "o1", action: "maybe" }).ok === false);
  check("5g geçersiz decision", computeDecideOfferPatch(baseSnapshot(), { offerId: "o1", decision: "maybe" }).ok === false);
}

// 6. Kapı A görev maili — teslim kurucunun adresine (reply_to Start-Hub kutusu)
{
  const m = gateTaskMail(offer(), "Team A", GATE, { name: "Lead A", email: "leada@x.com" }, Date.UTC(2026, 9, 4, 9, 0));
  check("6a konu ekip adını içerir", m.subject.includes("Team A") && m.subject.includes("Kapı A"));
  check("6b gövde görevi + teslim adresini içerir", m.body.includes("Açıklama") && m.body.includes("leada@x.com"));
}

console.log(failures === 0 ? "\nTÜM TESTLER GEÇTİ" : `\n${failures} TEST BAŞARISIZ`);
process.exit(failures === 0 ? 0 : 1);
