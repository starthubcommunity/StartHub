// Supabase Edge Function: hub-daily
// Gece 03:00 (pg_cron — bkz. supabase/migrations/0004_hub_cron.sql).
// Elle de tetiklenebilir: supabase.functions.invoke("hub-daily").
//
// Yaptıkları (HUB_SPEC §10):
//  1. contacted aşamasında takibi geçmiş adaylara otomatik takip görevi üretir
//  2. İKİNCİ takipten sonra hâlâ sessiz olanları archived / no_reply yapar
//  3. interviewed'da 5 günü aşan kartları raporlar (kırmızı işaret UI'da canlı)
//  4. süresi dolan, teslim işaretlenmemiş kapıları failed yapar
//
// ⚠️ Otomatik AŞAMA kararı YALNIZCA no_reply arşivlemesidir. Kapı "failed"
// olmak aday aşamasını DEĞİŞTİRMEZ — sıradaki adımı insan verir. Sistem
// başka hiçbir aşamada kendiliğinden karar vermez.
//
// SUPABASE_URL ve SUPABASE_SERVICE_ROLE_KEY platform tarafından sağlanır.

import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const DAY = 86400000;
const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });

  const db = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  const now = Date.now();
  const nowIso = new Date().toISOString();
  const report = { followUpsCreated: 0, archivedNoReply: 0, gatesFailed: 0, staleInterviewed: 0 };

  // ── 1 + 2: contacted bayatlığı ─────────────────────────────────
  const { data: contacted } = await db
    .from("hub_candidates").select("id").eq("stage", "contacted");

  for (const c of contacted ?? []) {
    const { data: touches } = await db
      .from("hub_touches").select("*").eq("candidate_id", c.id).order("sent_at", { ascending: true });
    const list = touches ?? [];
    if (!list.length) continue;
    const last = list[list.length - 1];
    if (last.outcome !== "pending" || !last.follow_up_at || Date.parse(last.follow_up_at) > now) continue;

    await db.from("hub_touches").update({ outcome: "no_reply" }).eq("id", last.id);

    if (list.length < 2) {
      // 1. otomatik takip görevi — 7 gün sonrasına
      await db.from("hub_touches").insert({
        candidate_id: c.id,
        channel: last.channel,
        sender_id: last.sender_id,
        outcome: "pending",
        follow_up_at: new Date(now + 7 * DAY).toISOString(),
        note: "otomatik takip",
      });
      report.followUpsCreated++;
    } else {
      // ikinci takipten sonra hâlâ sessiz → archived / no_reply
      await db.from("hub_candidates").update({
        stage: "archived", archive_reason: "no_reply", stage_changed_at: nowIso,
      }).eq("id", c.id);
      await db.from("hub_stage_log").insert({
        candidate_id: c.id, from_stage: "contacted", to_stage: "archived",
        reason: "otomatik: ikinci takipten sonra cevap yok",
      });
      report.archivedNoReply++;
    }
  }

  // ── 3: interviewed 5 günü aşanlar (yalnızca sayım) ─────────────
  const { data: interv } = await db
    .from("hub_candidates").select("id, stage_changed_at").eq("stage", "interviewed");
  for (const c of interv ?? []) {
    if (c.stage_changed_at && now - Date.parse(c.stage_changed_at) > 5 * DAY) report.staleInterviewed++;
  }

  // ── 4: süresi dolan kapılar → failed (teslim işaretlenmemişse) ─
  const { data: gates } = await db
    .from("hub_gates").select("id, delivered").eq("result", "pending").lte("due_at", nowIso);
  for (const g of gates ?? []) {
    if (g.delivered === true) continue;
    await db.from("hub_gates").update({
      result: "failed", evaluation: "Süre doldu, teslim işaretlenmedi (otomatik).",
    }).eq("id", g.id);
    report.gatesFailed++;
  }

  return new Response(JSON.stringify({ ok: true, ran_at: nowIso, ...report }), {
    headers: { ...cors, "Content-Type": "application/json" },
  });
});
