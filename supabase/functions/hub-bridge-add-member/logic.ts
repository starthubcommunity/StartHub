// hub-bridge-add-member/logic.ts
// Saf, yan etkisiz mantık — hem Deno (index.ts) hem Node (test dosyası)
// tarafından import edilebilir. app_state.data snapshot'ını ve istek
// gövdesini alır, YENİ bir snapshot + meta bilgi döner. Ağa/DB'ye hiç
// dokunmaz — bu yüzden Node'dan doğrudan test edilebilir.

export function teamsOf(u: any): string[] {
  return (u.teams && u.teams.length) ? u.teams : (u.team ? [u.team] : []);
}

export function effRole(u: any, tid: string): string {
  return (u.teamRoles && u.teamRoles[tid]) || u.role;
}

function uid(): string {
  return "x" + Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
}

function initialsOf(fullName: string): string {
  return fullName.trim().split(/\s+/).map((w) => w[0]).filter(Boolean).slice(0, 2).join("").toUpperCase() || "?";
}

export interface BridgePayload {
  teamId: string;
  fullName: string;
  email: string;
  role: "lead" | "member";
  source?: { candidateId?: string | null; actorEmail?: string | null };
}

export interface BridgeResult {
  ok: boolean;
  error?: string;
  snapshot?: any;
  userId?: number;
  created?: boolean;
  addedToTeam?: boolean;
  alreadyMember?: boolean;
  downgradedFromLead?: boolean;
}

// snapshot'ın DIŞINDAKİ hiçbir alana (tasks, sprints, teams, customCats,
// trash, vb.) dokunulmaz — yalnızca users/activity/notifications
// üretilir/güncellenir, geri kalanı olduğu gibi spread edilir.
export function computeBridgePatch(snapshot: any, payload: BridgePayload): BridgeResult {
  const { teamId, fullName, email, role, source } = payload || ({} as BridgePayload);

  const errors: string[] = [];
  if (!teamId) errors.push("teamId zorunlu");
  if (!email) errors.push("email zorunlu");
  if (!fullName) errors.push("fullName zorunlu");
  if (role !== "lead" && role !== "member") errors.push("role 'lead' veya 'member' olmalı");
  if (errors.length) return { ok: false, error: errors.join(", ") };

  const team = (snapshot.teams || []).find((t: any) => t.id === teamId);
  if (!team) return { ok: false, error: `Team app'te '${teamId}' ekibi yok` };

  const emailLc = email.trim().toLowerCase();
  const users: any[] = snapshot.users || [];
  const existing = users.find((u) => (u.email || "").toLowerCase() === emailLc);

  const otherLead = (excludeId: number | null) =>
    users.find((u) => u.id !== excludeId && teamsOf(u).includes(teamId) && effRole(u, teamId) === "lead");

  let user: any;
  let created = false;
  let addedToTeam = false;
  let downgradedFromLead = false;
  let alreadyMember = false;

  if (existing) {
    const alreadyInTeam = teamsOf(existing).includes(teamId);
    if (alreadyInTeam) {
      user = existing;
      alreadyMember = true;
    } else {
      let asMember = role !== "lead";
      if (role === "lead" && otherLead(existing.id)) { asMember = true; downgradedFromLead = true; }
      const teams = [...teamsOf(existing), teamId];
      const teamRoles = { ...(existing.teamRoles || {}) };
      if (asMember) teamRoles[teamId] = "member";
      user = { ...existing, teams, teamRoles };
      addedToTeam = true;
    }
  } else {
    let effectiveRole = role;
    if (role === "lead" && otherLead(null)) { effectiveRole = "member"; downgradedFromLead = true; }
    user = {
      id: Date.now(), name: fullName.trim(), email: emailLc, role: effectiveRole,
      team: teamId, teams: [teamId], avatar: initialsOf(fullName),
    };
    created = true;
    addedToTeam = true;
  }

  const newUsers = created ? [...users, user] : users.map((u) => (u.id === user.id ? user : u));

  const actorLabel = (source && source.actorEmail) || "Kurucu Hattı";
  const activity = addedToTeam
    ? [{ id: uid(), text: `${actorLabel} ${user.name} kullanıcısını ${team.name} ekibine ekledi (Kurucu Hattı)`, teamId, type: "team", ts: Date.now() }, ...(snapshot.activity || [])]
    : (snapshot.activity || []);
  const notifications = addedToTeam
    ? [{ id: uid(), type: "team", forUser: user.id, actor: null, teamId, entityId: null, text: `Kurucu Hattı seni ${team.name} ekibine ${user.role === "lead" ? "Team Lead" : "üye"} olarak ekledi`, ts: Date.now(), read: false }, ...(snapshot.notifications || [])]
    : (snapshot.notifications || []);

  const newSnapshot = { ...snapshot, users: newUsers, activity, notifications };

  return { ok: true, snapshot: newSnapshot, userId: user.id, created, addedToTeam, alreadyMember, downgradedFromLead };
}
