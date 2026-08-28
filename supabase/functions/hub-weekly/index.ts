// Supabase Edge Function: hub-weekly
// Pazartesi 08:00 (pg_cron). Haftalık özeti aktif cofounder'lara e-postayla
// gönderir — gönderim mevcut "send-mail" fonksiyonu üzerinden (HUB_SPEC §10).
//
// SUPABASE_URL ve SUPABASE_SERVICE_ROLE_KEY platform tarafından sağlanır.

import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

function weekStart() {
  const d = new Date();
  const back = (d.getUTCDay() + 6) % 7;
  d.setUTCDate(d.getUTCDate() - back);
  d.setUTCHours(0, 0, 0, 0);
  return d.toISOString();
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });

  const db = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
  const since = weekStart();

  const [cands, touches, logs, members] = await Promise.all([
    db.from("hub_candidates").select("id, source").gte("created_at", since),
    db.from("hub_touches").select("id, sender_id, outcome").gte("sent_at", since),
    db.from("hub_stage_log").select("to_stage").gte("created_at", since),
    db.from("hub_members").select("email, full_name, role, active"),
  ]);

  const newCands = cands.data ?? [];
  const newTouches = touches.data ?? [];
  const replies = newTouches.filter((t) => t.outcome === "replied").length;
  const toStage = (s: string) => (logs.data ?? []).filter((l) => l.to_stage === s).length;

  const perFounder = new Map<string, number>();
  for (const t of newTouches) if (t.sender_id) perFounder.set(t.sender_id, (perFounder.get(t.sender_id) ?? 0) + 1);

  const lines = [
    `Bu hafta (${since.slice(0, 10)}'den beri)`,
    `— Havuza yeni aday: ${newCands.length}`,
    `— Yeni temas: ${newTouches.length}`,
    `— Cevap: ${replies}`,
    `— Görüşmeye geçen: ${toStage("interviewed")}`,
    `— Finalist olan: ${toStage("finalist")}`,
    `— Ekibe katılan: ${toStage("joined")}`,
    `— Arşivlenen: ${toStage("archived")}`,
  ];
  const body = lines.join("\n");
  const subject = `Kurucu Hattı — haftalık özet (${since.slice(0, 10)})`;

  const recipients = (members.data ?? []).filter((m) => m.active && m.role === "cofounder");
  const results = [];
  for (const m of recipients) {
    const res = await fetch(`${SUPABASE_URL}/functions/v1/send-mail`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${SERVICE_ROLE_KEY}`,
      },
      body: JSON.stringify({ to: m.email, subject, body }),
    });
    results.push({ to: m.email, status: res.status });
  }

  return new Response(JSON.stringify({ ok: true, since, subject, sent: results }), {
    headers: { ...cors, "Content-Type": "application/json" },
  });
});
