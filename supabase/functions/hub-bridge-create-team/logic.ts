// hub-bridge-create-team/logic.ts
// Saf, yan etkisiz mantık — hem Deno (index.ts) hem Node (test dosyası)
// tarafından import edilebilir. Kurucu Hattı'nda (HR, hub-create-draft-
// project) "Yeni bir proje taslağı oluştur" denince, Ekip Paneli'nin KENDİ
// app_state.data.teams listesine de gerçek bir ekip ekler (2026-09-26 —
// önceden yalnızca ana projedeki `startups` tablosuna bir "hayalet" satır
// düşüyordu, Team App'in bundan hiç haberi olmuyordu). Üretilen şekil,
// Team App'in kendi Overview "Düzenle" akışının yeni-ekip oluştururken
// ürettiğiyle BİREBİR AYNI olmalı (bkz. public/team/index.html
// _nextTeamId/_monthlySprints) — aksi halde iki taraf farklı veri
// şekillerine sahip olur.

function nextTeamId(teams: any[]): string {
  const used = (teams || []).map((t) => String(t.id || "").toUpperCase());
  for (let c = 65; c <= 90; c++) {
    const L = String.fromCharCode(c);
    if (!used.includes(L)) return L;
  }
  return "T" + (teams || []).length;
}

function todayISO(): string {
  return new Date().toISOString().slice(0, 10);
}
function addMonthsISO(iso: string, n: number): string {
  const d = new Date(iso + "T00:00:00");
  d.setMonth(d.getMonth() + n);
  return d.toISOString().slice(0, 10);
}
function addDaysISO(iso: string, n: number): string {
  const d = new Date(iso + "T00:00:00");
  d.setDate(d.getDate() + n);
  return d.toISOString().slice(0, 10);
}
// Team App'in kendi _monthlySprints(teamId) ile AYNI: ilk 3 ay için birer
// sprint, isim/tarih dışında boş.
function monthlySprints(teamId: string): any[] {
  const t = todayISO();
  const mk = (i: number) => ({
    id: "s" + (Date.now() + i) + "_" + teamId,
    name: "Sprint " + (i + 1),
    start: addMonthsISO(t, i),
    end: addDaysISO(addMonthsISO(t, i + 1), -1),
    goal: "",
    team: teamId,
  });
  return [mk(0), mk(1), mk(2)];
}

function uid(): string {
  return "x" + Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
}

export interface CreateTeamPayload {
  name: string;
  oneLiner?: string;
  color?: string;
  source?: { actorEmail?: string | null };
}

export interface CreateTeamResult {
  ok: boolean;
  error?: string;
  snapshot?: any;
  teamId?: string;
}

// snapshot'ın DIŞINDAKİ hiçbir alana (users, tasks, customCats, trash vb.)
// dokunulmaz — yalnızca teams/sprints/activity üretilir, geri kalanı
// olduğu gibi spread edilir (bkz. hub-bridge-add-member/logic.ts'teki aynı
// ilke — app_state.data BÜTÜN olarak üzerine yazılıyor, kısmi değil).
export function computeCreateTeam(snapshot: any, payload: CreateTeamPayload): CreateTeamResult {
  const { name, oneLiner, color, source } = payload || ({} as CreateTeamPayload);
  if (!name || !String(name).trim()) return { ok: false, error: "name zorunlu" };

  const teams: any[] = snapshot.teams || [];
  const teamId = nextTeamId(teams);
  const newTeam = {
    id: teamId,
    name: String(name).trim(),
    project: String(name).trim(),
    desc: (oneLiner || "").trim(),
    color: color || "#2563EB",
    info: { goal: "", problem: "", kpi: "", demoDate: "" },
    resources: [],
  };
  const newSprints = monthlySprints(teamId);

  const actorLabel = (source && source.actorEmail) || "Kurucu Hattı";
  const activity = [
    { id: uid(), text: `${actorLabel} "${newTeam.name}" ekibini Kurucu Hattı'ndan oluşturdu`, teamId, type: "team", ts: Date.now() },
    ...(snapshot.activity || []),
  ];

  const newSnapshot = {
    ...snapshot,
    teams: [...teams, newTeam],
    sprints: [...(snapshot.sprints || []), ...newSprints],
    activity,
  };

  return { ok: true, snapshot: newSnapshot, teamId };
}
