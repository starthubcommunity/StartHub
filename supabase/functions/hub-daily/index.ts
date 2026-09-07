// Supabase Edge Function: hub-daily
// Gece 03:00 (pg_cron — bkz. supabase/migrations/0004_hub_cron.sql).
// Elle de tetiklenebilir: supabase.functions.invoke("hub-daily").
//
// Yaptıkları (HUB_SPEC §12.1):
//  1. contact aşamasında takibi geçmiş adaylara otomatik takip görevi üretir
//  2. İKİNCİ takipten sonra hâlâ sessiz olanları archived / no_reply yapar
//  3. interview'da 5 günü aşan kartları raporlar (bayatlama UI'da canlı)
//  4. süresi dolan, teslim işaretlenmemiş kapıları failed yapar
//
// ⚠️ Aşama değerleri 0011 ile değişti: contacted→contact, interviewed→interview,
// finalist/gate_a/gate_b→trial, joined→member. Bu fonksiyon YENİ değerleri kullanır.
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
  const report = { followUpsCreated: 0, archivedNoReply: 0, gatesFailed: 0, staleInterview: 0 };
  const days = (iso: string) => (now - Date.parse(iso)) / DAY;

  // Takip zinciri metni (E2): sequence_key ile gruplanan şablonlar, adım N için
  // (N-1). şablon. Yoksa gömülü hatırlatma.
  const { data: seqTpls } = await db
    .from("hub_templates").select("body, sequence_key, name")
    .not("sequence_key", "is", null).eq("active", true).order("name", { ascending: true });
  const seqGroups: Record<string, string[]> = {};
  for (const t of seqTpls ?? []) (seqGroups[t.sequence_key] ??= []).push(t.body || "");
  const firstSeq = Object.values(seqGroups)[0] || [];
  const NUDGE: Record<number, string> = {
    2: "Kısa bir hatırlatma — ilk mesajımın üstünden birkaç gün geçti. Hâlâ ilgini çeker mi? Bir 'evet/hayır' bile yeterli.",
    3: "Son bir hatırlatma: uygun değilsen sorun yok, haber ver, listeden düşeyim. İlgilenirsen 15 dakikalık bir görüşme yeter.",
  };
  const stepText = (step: number) => firstSeq[step - 1] || NUDGE[step] || `Takip mesajı (adım ${step}).`;

  // ── 1 + 2: contact takip zinciri — gün 4 / gün 8 hazırla, gün 12 arşivle ──
  // OTOMATİK GÖNDERİM YOK. Hazırlanan mesaj Bugün ekranına "süresi gelen takip"
  // olarak düşer (pending touch, follow_up_at=now) + candidate.draft_text'e yazılır.
  const { data: contacted } = await db
    .from("hub_candidates").select("id").eq("stage", "contact");

  for (const c of contacted ?? []) {
    const { data: touches } = await db
      .from("hub_touches").select("*").eq("candidate_id", c.id).order("sent_at", { ascending: true });
    const list = touches ?? [];
    if (!list.length) continue;
    const last = list[list.length - 1];
    if (last.outcome === "replied") continue;                 // cevap gelmiş — insan ilgilenir
    const sinceFirst = days(list[0].sent_at);
    const maxStep = Math.max(...list.map((t: { step_no?: number }) => t.step_no ?? 1));

    // Zincir bitti, hâlâ sessiz → arşiv
    if (sinceFirst >= 12 && maxStep >= 3) {
      if (last.outcome === "pending") await db.from("hub_touches").update({ outcome: "no_reply" }).eq("id", last.id);
      await db.from("hub_candidates").update({
        stage: "archived", archive_reason: "no_reply", stage_changed_at: nowIso,
      }).eq("id", c.id);
      await db.from("hub_stage_log").insert({
        candidate_id: c.id, from_stage: "contact", to_stage: "archived",
        reason: "otomatik: takip zinciri bitti, cevap yok",
      });
      report.archivedNoReply++;
      continue;
    }

    // Sıradaki adımı hazırla
    let nextStep = 0;
    if (sinceFirst >= 8 && maxStep < 3) nextStep = 3;
    else if (sinceFirst >= 4 && maxStep < 2) nextStep = 2;
    if (!nextStep) continue;

    if (last.outcome === "pending") await db.from("hub_touches").update({ outcome: "no_reply" }).eq("id", last.id);
    const text = stepText(nextStep);
    await db.from("hub_touches").insert({
      candidate_id: c.id,
      channel: last.channel,
      sender_id: last.sender_id,
      outcome: "pending",
      follow_up_at: nowIso,           // hemen "süresi gelen" olarak görünür
      step_no: nextStep,
      note: text,
    });
    await db.from("hub_candidates").update({ draft_text: text }).eq("id", c.id);
    report.followUpsCreated++;
  }

  // ── 3: interview 5 günü aşanlar (yalnızca sayım) ──────────────
  const { data: interv } = await db
    .from("hub_candidates").select("id, stage_changed_at").eq("stage", "interview");
  for (const c of interv ?? []) {
    if (c.stage_changed_at && now - Date.parse(c.stage_changed_at) > 5 * DAY) report.staleInterview++;
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
