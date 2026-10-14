// hub-team-access-request/logic.ts — saf mantık (test: src/hub/hub-access-request-logic.test.mjs).
// Team App'e giriş hesabıyla girip PROFİLİ olmayan kişinin erişim talebi.
// app_state.data.accessRequests — users listesinin DIŞINDA ayrı bir alan; üyelik koruma
// tetikleyicisi (supabase/team-app/0001) yalnızca users'a baktığı için etkilenmez.
// Admin'lere zil bildirimi: yeni talepte ya da son bildirimden 24 saat sonra tekrar denerse.

const NOTIFY_AGAIN_MS = 24 * 60 * 60 * 1000;
const MAX_REQUESTS = 100;

export interface AccessRequest { email: string; name: string; firstAt: number; lastAt: number; attempts: number; notifiedAt: number }

// deno-lint-ignore no-explicit-any
export function computeAccessRequest(data: any, input: { email: string; name?: string | null; now: number; uid: () => string }) {
  const email = String(input.email || "").trim().toLowerCase();
  if (!email.includes("@")) return { ok: false as const, error: "e-posta yok" };
  const users = Array.isArray(data?.users) ? data.users : [];
  // deno-lint-ignore no-explicit-any
  if (users.some((u: any) => String(u.email || "").toLowerCase() === email)) {
    return { ok: true as const, hasProfile: true, changed: false, snapshot: data };
  }
  const list: AccessRequest[] = Array.isArray(data?.accessRequests) ? data.accessRequests : [];
  const prev = list.find((r) => r.email === email);
  const name = String(input.name || "").trim().slice(0, 80) || email.split("@")[0];
  const shouldNotify = !prev || input.now - (prev.notifiedAt || 0) >= NOTIFY_AGAIN_MS;
  const rec: AccessRequest = prev
    ? { ...prev, name: prev.name || name, lastAt: input.now, attempts: (prev.attempts || 1) + 1, notifiedAt: shouldNotify ? input.now : prev.notifiedAt }
    : { email, name, firstAt: input.now, lastAt: input.now, attempts: 1, notifiedAt: input.now };
  const nextList = [rec, ...list.filter((r) => r.email !== email)].slice(0, MAX_REQUESTS);

  // deno-lint-ignore no-explicit-any
  const admins = users.filter((u: any) => u.role === "admin");
  const notifs = shouldNotify
    // deno-lint-ignore no-explicit-any
    ? admins.map((a: any) => ({
        id: input.uid(), type: "access_request", forUser: a.id, actor: null, teamId: null, entityId: email,
        text: `${name} (${email}) giriş yaptı ama hiçbir ekipte değil — Team sayfasından ekibe ekleyebilirsin`,
        ts: input.now, read: false,
      }))
    : [];
  const snapshot = { ...data, accessRequests: nextList, notifications: [...notifs, ...(Array.isArray(data?.notifications) ? data.notifications : [])] };
  return { ok: true as const, hasProfile: false, changed: true, isNew: !prev, notified: notifs.length, snapshot };
}
