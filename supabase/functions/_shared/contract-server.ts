// _shared/contract-server.ts — sözleşme bağlamını DB'den kurar (servis rolüyle).
// equity-contract (HR → gönder) ve hub-equity-bridge (Team App → göster/kabul)
// AYNI fonksiyonu kullanır: kişinin gördüğü metin = parmak izi alınan metin.
import {
  contractKindFor, contractTerms, contractVars, renderContract,
  mapTemplateFromDb, mapSettingsFromDb,
} from "./contract-render.js";
import { mapGrantFromDb, mapSeatFromDb } from "./equity-rules.js";

export async function sha256Hex(text: string): Promise<string> {
  const buf = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(text));
  return [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, "0")).join("");
}

// deno-lint-ignore no-explicit-any
type Db = any;

export async function loadSettings(db: Db) {
  const { data } = await db.from("contract_settings").select("*").eq("id", 1).maybeSingle();
  return mapSettingsFromDb(data);
}

export async function latestTemplate(db: Db, kind: string) {
  const { data } = await db.from("contract_templates").select("*").eq("kind", kind)
    .order("version", { ascending: false }).limit(1).maybeSingle();
  return data ? mapTemplateFromDb(data) : null;
}

export async function cofounderNames(db: Db): Promise<string[]> {
  const { data } = await db.from("hub_members").select("full_name, email, created_at")
    .eq("role", "cofounder").eq("active", true).order("created_at");
  return (data || []).map((r: any) => (r.full_name || r.email || "").trim()).filter(Boolean);
}

export async function weeklyHoursFor(db: Db, seatOpenRoleId: string | null, hubCandidateId: string | null) {
  let roleId = seatOpenRoleId;
  if (!roleId && hubCandidateId) {
    const { data: c } = await db.from("hub_candidates").select("open_role_id").eq("id", hubCandidateId).maybeSingle();
    roleId = c?.open_role_id || null;
  }
  if (!roleId) return null;
  const { data: r } = await db.from("hub_open_roles").select("weekly_hours").eq("id", roleId).maybeSingle();
  return r?.weekly_hours ?? null;
}

// templateId verilirse o sürüm (gönderilmiş söz), verilmezse türün son sürümü (gönderim önizlemesi).
export async function buildContract(db: Db, grantRow: any, templateId: string | null = null) {
  const grant = mapGrantFromDb(grantRow);
  const { data: seatRow } = await db.from("equity_seats").select("*").eq("id", grant.seatId).single();
  const seat = mapSeatFromDb(seatRow);
  const { data: st } = await db.from("startups").select("name").eq("id", seat.startupId).maybeSingle();
  const weeklyHours = await weeklyHoursFor(db, seat.openRoleId, grant.hubCandidateId);
  const kind = contractKindFor(seat, grant);
  let template;
  if (templateId) {
    const { data } = await db.from("contract_templates").select("*").eq("id", templateId).single();
    template = mapTemplateFromDb(data);
  } else {
    template = await latestTemplate(db, kind);
  }
  if (!template) throw new Error(`"${kind}" türünde yayınlanmış sözleşme metni yok`);
  const parties = await cofounderNames(db);
  const terms = contractTerms({ grant, seat, projectName: st?.name, weeklyHours });
  const text = renderContract(template.body, contractVars(terms, parties));
  const sha = await sha256Hex(text);
  return { grant, seat, template, terms, text, sha, kind };
}
