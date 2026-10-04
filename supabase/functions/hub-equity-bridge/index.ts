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

import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import {
  summarizeGrant, mapGrantFromDb, mapSeatFromDb, mapMilestoneFromDb,
} from "../_shared/equity-rules.js";

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

    // 1) Kişinin kendi sözleri
    const { data: myRows, error: ge } = await db.from("equity_grants").select("*").ilike("holder_email", email);
    if (ge) return json({ ok: false, error: ge.message }, 500);
    const myGrants = (myRows || []).filter((r: any) => String(r.holder_email).toLowerCase() === email).map(mapGrantFromDb);

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

    const now = new Date();
    const mine = myGrants
      .filter((g: any) => seatById.has(g.seatId))
      .map((g: any) => { const seat: any = seatById.get(g.seatId); return summarizeGrant(g, seat, nameOf.get(Number(seat.startupId)), msOf(seat.startupId), now); });

    // 3) Ekip tablosu (lead) — e-posta yok, yalnızca ad + koltuk + rakamlar
    let team: any[] = [];
    const teamSeatIds = seats.filter((s: any) => teamStartupIds.includes(Number(s.startupId))).map((s: any) => s.id);
    if (teamSeatIds.length) {
      const { data: tg } = await db.from("equity_grants").select("*").in("seat_id", teamSeatIds);
      team = (tg || []).map(mapGrantFromDb).map((g: any) => {
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
