// _shared/team-leads.ts — bir koltuğun projesindeki Team Lead e-postaları (ana projeden).
// Team App ayrı Supabase projesinde: hub-bridge-team-roster (köprü anahtarı, salt okuma) üzerinden.
// Hata olursa boş liste döner — bilgi maili hiçbir akışı durdurmaz.
const HUB_BRIDGE_SECRET = Deno.env.get("HUB_BRIDGE_SECRET");
const TEAM_PROJECT_URL = "https://umgdtjlgivvymngsnqtv.supabase.co";

// deno-lint-ignore no-explicit-any
export async function leadEmailsForStartup(db: any, startupId: number | string | null): Promise<string[]> {
  try {
    if (startupId == null || !HUB_BRIDGE_SECRET) return [];
    const { data: st } = await db.from("startups").select("team_app_id").eq("id", Number(startupId)).maybeSingle();
    const teamId = st?.team_app_id;
    if (!teamId) return [];
    const res = await fetch(`${TEAM_PROJECT_URL}/functions/v1/hub-bridge-team-roster`, {
      method: "POST",
      headers: { "Content-Type": "application/json", "x-hub-bridge-key": HUB_BRIDGE_SECRET },
      body: JSON.stringify({ teamId }),
      signal: AbortSignal.timeout(8000),
    });
    const b = await res.json().catch(() => null);
    if (!res.ok || !b?.ok) return [];
    // deno-lint-ignore no-explicit-any
    return (b.members || []).filter((m: any) => m.role === "lead" && !m.isAdmin && m.email).map((m: any) => String(m.email).toLowerCase());
  } catch (_) {
    return [];
  }
}
