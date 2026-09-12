// hub-team-sync/logic.ts
// Saf, yan etkisiz mantık — hem Deno (index.ts) hem Node (test dosyası)
// tarafından import edilebilir. app_state.data snapshot'ını hiç mutate
// etmez, yeni değerler döner. Ağa/DB'ye dokunmaz.
//
// İki yön:
//  - push_description: Kurucu Hattı Vitrin'de kaydedilen açıklama, Team
//    app'in kendi ekip kaydına (teams[].description) yazılır — Team app
//    bu alanı henüz göstermiyor olabilir ama veri doğru olsun diye.
//  - pull_roster: Team app'teki gerçek üye listesi (roster) — sitedeki
//    ekip sayısını güncellemek için KÜÇÜK, ekibe özel bir özet döner
//    (tüm kullanıcı tablosu değil — yalnızca o teamId'ye ait olanlar).

export function teamsOf(u: any): string[] {
  return (u.teams && u.teams.length) ? u.teams : (u.team ? [u.team] : []);
}
export function effRole(u: any, tid: string): string {
  return (u.teamRoles && u.teamRoles[tid]) || u.role;
}

export function computePushDescription(snapshot: any, payload: { teamId: string; description: string }) {
  const { teamId, description } = payload || ({} as any);
  if (!teamId) return { ok: false, error: "teamId zorunlu" };
  const teams = snapshot.teams || [];
  const idx = teams.findIndex((t: any) => t.id === teamId);
  if (idx === -1) return { ok: false, error: `Team app'te '${teamId}' ekibi yok` };
  const before = teams[idx].description || null;
  const newTeams = teams.map((t: any, i: number) => (i === idx ? { ...t, description } : t));
  return { ok: true, snapshot: { ...snapshot, teams: newTeams }, changed: before !== description };
}

export function computeRosterSummary(snapshot: any, payload: { teamId: string }) {
  const { teamId } = payload || ({} as any);
  if (!teamId) return { ok: false, error: "teamId zorunlu" };
  const team = (snapshot.teams || []).find((t: any) => t.id === teamId);
  if (!team) return { ok: false, error: `Team app'te '${teamId}' ekibi yok` };
  const users = snapshot.users || [];
  const members = users
    .filter((u: any) => teamsOf(u).includes(teamId))
    .map((u: any) => ({ name: u.name || "", email: u.email || "", role: effRole(u, teamId) }));
  return { ok: true, teamId, teamName: team.name || teamId, memberCount: members.length, members };
}
