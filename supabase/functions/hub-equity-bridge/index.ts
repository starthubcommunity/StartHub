// Supabase Edge Function: hub-equity-bridge
// BU PROJEYE DEPLOY EDİLİR: fdlghaafspcuagxfrofz (ana proje) — `--no-verify-jwt`
// (yalnızca x-hub-bridge-key ile, Team App'in hub-team-my-equity'si çağırır).
//
// 2026-10-04 (Adım 5/5) — Team App "Payım" sekmesi. Pay verisi Team App'in
// app_state'ine KONMAZ (0052): ana projede, RLS'li tablolarda durur. Team App
// kullanıcıları bu projede oturum açmadığı için RLS onları tanıyamaz; bu
// fonksiyon servis rolüyle okur ama YALNIZCA:
//   • `email` — çağıranın kendi sözleri (hub-team-my-equity, kullanıcının
//     KENDİ JWT'sinden çıkardığı e-postayı gönderir; istemci seçemez)
//   • `leadTeamIds` — çağıranın lead'i olduğu ekiplerin (Team App'te sunucu
//     tarafında doğrulanmış) pay tablosu, Bölüm G madde 9: "kendi ekibinin pay
//     durumunu görüntüleme — salt okunur". Bu listede e-posta DÖNMEZ.
// Hesap: _shared/equity-rules.js (HR'daki "Pay Sözleri" ile aynı kod).
//
// 0060 (A) — sözleşme onayı:
//   • "mine"de "Teyit bekliyor" (pending_confirm) sözler GÖSTERİLMEZ (henüz
//     cofounder teyit etmedi); "Onay bekliyor" sözler sözleşme metniyle döner.
//   • action 'accept' { email, grantId, typedName, consent, sha256, ip, userAgent }:
//     metni SUNUCUDA yeniden üretir, kişinin gördüğü parmak iziyle karşılaştırır,
//     kabul kaydını (değiştirilemez) yazar, sözü aktifleştirir; hak ediş
//     başlangıcı = onay günü (Europe/Istanbul). IP/UA'yı Team App fonksiyonu
//     (hub-team-my-equity) isteğin kendisinden alır — istemci seçemez.

import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import {
  summarizeGrant, mapGrantFromDb, mapSeatFromDb, mapMilestoneFromDb,
} from "../_shared/equity-rules.js";
import { buildContract } from "../_shared/contract-server.ts";
import { istanbulDate } from "../_shared/contract-render.js";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const HUB_BRIDGE_SECRET = Deno.env.get("HUB_BRIDGE_SECRET");

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-hub-bridge-key",
};
const json = (b: unknown, s = 200) =>
  new Response(JSON.stringify(b), { status: s, headers: { ...cors, "Content-Type": "application/json" } });

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  const token = req.headers.get("x-hub-bridge-key");
  if (!HUB_BRIDGE_SECRET || token !== HUB_BRIDGE_SECRET) return json({ ok: false, error: "unauthorized" }, 401);

  try {
    const body = await req.json();
    const email = String(body?.email || "").trim().toLowerCase();
    const leadTeamIds: string[] = Array.isArray(body?.leadTeamIds) ? body.leadTeamIds.map(String).slice(0, 50) : [];
    if (!email.includes("@")) return json({ ok: false, error: "email zorunlu" }, 400);

    const db = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, { auth: { autoRefreshToken: false, persistSession: false } });

    if (body?.action === "accept") return await accept(db, email, body);

    // 1) Kişinin kendi sözleri ("Teyit bekliyor" hariç)
    const { data: myRowsAll, error: ge } = await db.from("equity_grants").select("*").ilike("holder_email", email);
    if (ge) return json({ ok: false, error: ge.message }, 500);
    const myRows = (myRowsAll || []).filter((r: any) => String(r.holder_email).toLowerCase() === email && r.status !== "pending_confirm");
    const myGrants = myRows.map(mapGrantFromDb);
    // "Onay bekliyor" → onay ekranı için metin + özet + parmak izi
    const contracts = new Map<string, any>();
    for (const r of myRows.filter((x: any) => x.status === "pending_signature" && x.contract_template_id)) {
      const c = await buildContract(db, r, r.contract_template_id);
      contracts.set(r.id, {
        grantId: r.id, title: c.template.title, version: c.template.version, isPlaceholder: c.template.isPlaceholder,
        sentAt: r.contract_sent_at, terms: c.terms, text: c.text, sha256: c.sha,
      });
    }

    // 2) Lead'in ekip(ler)i → startups.team_app_id eşlemesi
    let teamStartupIds: number[] = [];
    if (leadTeamIds.length) {
      const { data: st } = await db.from("startups").select("id, team_app_id").in("team_app_id", leadTeamIds);
      teamStartupIds = (st || []).map((r: any) => Number(r.id));
    }

    const seatIdsMine = [...new Set(myGrants.map((g: any) => g.seatId))];
    const { data: seatRows } = seatIdsMine.length || teamStartupIds.length
      ? await db.from("equity_seats").select("*").or(
          [seatIdsMine.length ? `id.in.(${seatIdsMine.join(",")})` : "", teamStartupIds.length ? `startup_id.in.(${teamStartupIds.join(",")})` : ""].filter(Boolean).join(","),
        )
      : { data: [] as any[] };
    const seats = (seatRows || []).map(mapSeatFromDb);
    const seatById = new Map(seats.map((s: any) => [s.id, s]));
    const startupIds = [...new Set(seats.map((s: any) => s.startupId))];

    const [{ data: sRows }, { data: mRows }] = await Promise.all([
      startupIds.length ? db.from("startups").select("id, name").in("id", startupIds) : Promise.resolve({ data: [] as any[] }),
      startupIds.length ? db.from("equity_milestones").select("*").in("startup_id", startupIds) : Promise.resolve({ data: [] as any[] }),
    ]);
    const nameOf = new Map((sRows || []).map((r: any) => [Number(r.id), r.name]));
    const msOf = (sid: number) => (mRows || []).filter((m: any) => Number(m.startup_id) === Number(sid)).map(mapMilestoneFromDb);

    // Adım 7 — haftalık saat beklentisi: koltuğa bağlı rol, yoksa sözdeki adayın rolü.
    const allGrantsForHours = myGrants;
    const candIds = [...new Set(allGrantsForHours.map((g: any) => g.hubCandidateId).filter(Boolean))];
    const { data: candRows } = candIds.length ? await db.from("hub_candidates").select("id, open_role_id").in("id", candIds) : { data: [] as any[] };
    const roleOfCand = new Map((candRows || []).map((r: any) => [r.id, r.open_role_id]));
    const hoursFor = async (grantList: any[]) => {
      const roleIds = new Set<string>();
      for (const g of grantList) {
        const seat: any = seatById.get(g.seatId);
        if (seat?.openRoleId) roleIds.add(seat.openRoleId);
        const r = roleOfCand.get(g.hubCandidateId); if (r) roleIds.add(r);
      }
      if (!roleIds.size) return new Map();
      const { data } = await db.from("hub_open_roles").select("id, weekly_hours").in("id", [...roleIds]);
      return new Map((data || []).map((r: any) => [r.id, r.weekly_hours]));
    };
    const hoursOf = (g: any, hm: Map<any, any>) => {
      const seat: any = seatById.get(g.seatId);
      return (seat?.openRoleId && hm.get(seat.openRoleId)) || hm.get(roleOfCand.get(g.hubCandidateId)) || null;
    };
    const hoursMap = await hoursFor(myGrants);

    const now = new Date();
    const mine = myGrants
      .filter((g: any) => seatById.has(g.seatId))
      .map((g: any) => { const seat: any = seatById.get(g.seatId); return { ...summarizeGrant(g, seat, nameOf.get(Number(seat.startupId)), msOf(seat.startupId), now), weeklyHours: hoursOf(g, hoursMap), grantId: g.id, contract: contracts.get(g.id) || null }; });

    // 3) Ekip tablosu (lead) — e-posta yok, yalnızca ad + koltuk + rakamlar
    let team: any[] = [];
    const teamSeatIds = seats.filter((s: any) => teamStartupIds.includes(Number(s.startupId))).map((s: any) => s.id);
    if (teamSeatIds.length) {
      const { data: tg } = await db.from("equity_grants").select("*").in("seat_id", teamSeatIds);
      team = (tg || []).filter((r: any) => r.status !== "pending_confirm").map(mapGrantFromDb).map((g: any) => {
        const seat: any = seatById.get(g.seatId);
        const sum = summarizeGrant(g, seat, nameOf.get(Number(seat.startupId)), msOf(seat.startupId), now);
        return { name: g.holderName, isMe: String(g.holderEmail).toLowerCase() === email, ...sum };
      }).sort((a: any, b: any) => (a.project || "").localeCompare(b.project || "", "tr") || b.total - a.total);
    }

    return json({ ok: true, mine, team, asOf: now.toISOString().slice(0, 10) });
  } catch (e) {
    return json({ ok: false, error: String(e) }, 500);
  }
});

// deno-lint-ignore no-explicit-any
async function accept(db: any, email: string, body: any) {
  const grantId = String(body?.grantId || "");
  const typedName = String(body?.typedName || "").trim().replace(/\s+/g, " ").slice(0, 120);
  const sha = String(body?.sha256 || "").toLowerCase();
  if (!grantId) return json({ ok: false, error: "grantId zorunlu" }, 400);
  if (body?.consent !== true) return json({ ok: false, error: "“Okudum, kabul ediyorum” kutusu işaretlenmeli." }, 400);
  if (typedName.length < 3) return json({ ok: false, error: "Adını ve soyadını yaz." }, 400);

  const { data: row } = await db.from("equity_grants").select("*").eq("id", grantId).maybeSingle();
  if (!row || String(row.holder_email).toLowerCase() !== email) return json({ ok: false, error: "Sözleşme bulunamadı." }, 404);
  if (row.status !== "pending_signature" || !row.contract_template_id) {
    return json({ ok: false, error: row.status === "active" ? "Bu sözleşme zaten onaylanmış." : "Bu sözleşme şu an onaya açık değil." }, 409);
  }
  const c = await buildContract(db, row, row.contract_template_id);
  if (sha !== c.sha) return json({ ok: false, error: "Sözleşme metni sen açtıktan sonra değişmiş — sayfayı yenileyip tekrar oku.", stale: true }, 409);

  const now = new Date();
  const startDate = istanbulDate(now);
  // 1) Söz → aktif (yalnızca hâlâ "Onay bekliyor"sa — çift tıklama/yarış koruması)
  const { data: upd, error: ue } = await db.from("equity_grants").update({
    status: "active", signed_at: now.toISOString(), start_date: startDate,
  }).eq("id", grantId).eq("status", "pending_signature").select("id");
  if (ue) return json({ ok: false, error: ue.message }, 500);
  if (!upd?.length) return json({ ok: false, error: "Bu sözleşme zaten onaylanmış." }, 409);

  // 2) Kabul kaydı (değiştirilemez); yazılamazsa söz geri alınır
  const { data: acc, error: ae } = await db.from("contract_acceptances").insert({
    grant_id: grantId, template_id: c.template.id, template_kind: c.template.kind, template_version: c.template.version,
    holder_email: email, typed_name: typedName, consent: true, accepted_at: now.toISOString(),
    ip: String(body?.ip || "").slice(0, 100) || null, user_agent: String(body?.userAgent || "").slice(0, 500) || null,
    text_sha256: c.sha, text_snapshot: c.text, terms: c.terms,
  }).select("id").single();
  if (ae || !acc) {
    await db.from("equity_grants").update({ status: "pending_signature", signed_at: null, start_date: row.start_date }).eq("id", grantId);
    return json({ ok: false, error: "Onay kaydedilemedi: " + (ae?.message || "bilinmeyen hata") }, 500);
  }
  await db.from("equity_grants").update({ acceptance_id: acc.id }).eq("id", grantId);
  await db.from("equity_events").insert({
    grant_id: grantId, seat_id: row.seat_id, kind: "note",
    note: `Sözleşme onaylandı — ${c.template.title} v${c.template.version} · ${typedName} · hak ediş başlangıcı ${startDate}`,
    payload: { acceptanceId: acc.id, sha256: c.sha }, created_by: email,
  });
  return json({ ok: true, acceptanceId: acc.id, startDate, acceptedAt: now.toISOString() });
}
