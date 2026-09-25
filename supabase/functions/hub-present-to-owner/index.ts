// Supabase Edge Function: hub-present-to-owner
// BU PROJEYE DEPLOY EDİLİR: fdlghaafspcuagxfrofz (ana proje).
//
// 2026-09-25 — üye (member) hattında bir aday Kapı A'yı geçince, HR'daki
// "Ekibe al" butonunun yerini bu fonksiyonu çağıran "Proje sahibine sun" alır.
// Adayı DOĞRUDAN ekibe eklemez — Team App'in kendi projesindeki
// `hub-bridge-present-candidate`'i (HUB_BRIDGE_SECRET ile, server-to-server —
// sır tarayıcıya hiç inmez) çağırıp o ekibin Team Lead'ine "bekleyen aday"
// olarak düşürür. `hub_candidates.presented_at`/`owner_decision='pending'`
// yazılır ki mevcut "proje sahibi kararı bekleniyor" gösterimi (candidate.jsx)
// olduğu gibi çalışsın. Gerçek karar Team App'ten `hub-owner-decision` ile döner.
//
// Yetki: çağıranın JWT'si iletilir; hub_role() cofounder|recruiter olmalı
// (hub-move-to-team ile AYNI desen).

import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY")!;
const TEAM_PROJECT_URL = "https://umgdtjlgivvymngsnqtv.supabase.co";
const HUB_BRIDGE_SECRET = Deno.env.get("HUB_BRIDGE_SECRET");

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};
const json = (b: unknown, s = 200) =>
  new Response(JSON.stringify(b), { status: s, headers: { ...cors, "Content-Type": "application/json" } });

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });

  try {
    const authHeader = req.headers.get("Authorization") || "";
    const { candidateId } = await req.json();
    if (!candidateId) return json({ error: "candidateId zorunlu" }, 400);

    const asUser = createClient(SUPABASE_URL, ANON_KEY, {
      global: { headers: { Authorization: authHeader } },
      auth: { autoRefreshToken: false, persistSession: false },
    });
    const { data: role } = await asUser.rpc("hub_role");
    if (role !== "cofounder" && role !== "recruiter") {
      return json({ error: "Yetkisiz — sunma yalnızca cofounder/recruiter." }, 403);
    }

    const db = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, { auth: { autoRefreshToken: false, persistSession: false } });

    const { data: cand, error: ce } = await db.from("hub_candidates").select("*").eq("id", candidateId).single();
    if (ce || !cand) return json({ error: "Aday bulunamadı." }, 404);
    if (!cand.email) return json({ error: "Adayın e-postası yok — sunulamaz." }, 400);
    if (!cand.open_role_id) return json({ error: "Aday bir açık role bağlı değil — sunulamaz." }, 400);

    const { data: roleRow, error: re } = await db.from("hub_open_roles").select("*").eq("id", cand.open_role_id).single();
    if (re || !roleRow) return json({ error: "Bağlı rol bulunamadı." }, 404);
    if (roleRow.startup_id == null) return json({ error: "Rol bir projeye bağlı değil — sunulamaz." }, 400);

    const { data: sRow, error: sErr } = await db.from("startups").select("team_app_id").eq("id", roleRow.startup_id).single();
    if (sErr) return json({ error: sErr.message }, 500);
    const teamId = (sRow?.team_app_id as string | null) || null;
    if (!teamId) return json({ error: "Proje Team App'e eşlenmemiş (startups.team_app_id boş) — önce Team App'te bu proje için Düzenle'yi kullan." }, 400);
    if (!HUB_BRIDGE_SECRET) return json({ error: "HUB_BRIDGE_SECRET tanımlı değil." }, 500);

    const bRes = await fetch(`${TEAM_PROJECT_URL}/functions/v1/hub-bridge-present-candidate`, {
      method: "POST",
      headers: { "Content-Type": "application/json", "x-hub-bridge-key": HUB_BRIDGE_SECRET },
      body: JSON.stringify({
        teamId,
        hubCandidateId: candidateId,
        fullName: cand.full_name || "Yeni üye",
        email: cand.email,
        phone: cand.phone || null,
        roleTitle: roleRow.title || null,
        note: cand.why_this_one || null,
      }),
      signal: AbortSignal.timeout(8000),
    });
    const b = await bRes.json().catch(() => null);
    if (!bRes.ok || !b?.ok) return json({ error: b?.error || `hub-bridge-present-candidate ${bRes.status}` }, 502);

    const now = new Date().toISOString();
    const { error: ue } = await db.from("hub_candidates")
      .update({ presented_at: now, owner_decision: "pending", owner_decision_note: null })
      .eq("id", candidateId);
    if (ue) return json({ error: ue.message }, 500);

    if (roleRow.status === "sourcing") {
      await db.from("hub_open_roles").update({ status: "shortlist" }).eq("id", roleRow.id);
    }

    return json({ ok: true, offerId: b.offerId, alreadyPending: !!b.alreadyPending });
  } catch (e) {
    return json({ error: String(e) }, 500);
  }
});
