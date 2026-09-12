// Supabase Edge Function: team-toggle-published  (main proje: fdlghaafspcuagxfrofz)
// Team App'in (/team/, ayrı Supabase projesi umgdtjlgivvymngsnqtv, tarayıcı-
// only tek dosya) Overview ekranındaki "Web sitesinde göster" anahtarı buraya
// yazar. Team App'in kendi kullanıcı oturumu bu projede YOK — bu yüzden
// JWT değil, paylaşılan bir anahtar (x-team-publish-key) ile korunuyor.
// Kapsam kasıtlı olarak DAR: yalnızca startups.published alanını, yalnızca
// team_app_id'si olan (Team App'e eşlenmiş) bir projede değiştirebilir —
// başka hiçbir alana dokunmaz. Anahtar Team App'in kendi (herkese açık,
// zaten okunabilir tek dosya) kodunda düz metin durur; bu yüzden yalnızca
// bu tek, geri alınması kolay alanı korumaya yeter kadar kapsamlı.
//
//   supabase secrets set TEAM_PUBLISH_KEY=<uzun-rastgele-deger> --project-ref fdlghaafspcuagxfrofz
//   supabase functions deploy team-toggle-published --project-ref fdlghaafspcuagxfrofz --no-verify-jwt

import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const TEAM_PUBLISH_KEY = Deno.env.get("TEAM_PUBLISH_KEY");

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-team-publish-key",
};
const json = (b: unknown, s = 200) =>
  new Response(JSON.stringify(b), { status: s, headers: { ...cors, "Content-Type": "application/json" } });

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });

  const key = req.headers.get("x-team-publish-key");
  if (!TEAM_PUBLISH_KEY || key !== TEAM_PUBLISH_KEY) return json({ error: "unauthorized" }, 401);

  try {
    const { teamId, published } = await req.json();
    if (!teamId || typeof published !== "boolean") return json({ error: "teamId ve published(boolean) zorunlu" }, 400);

    const db = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, { auth: { autoRefreshToken: false, persistSession: false } });
    const { data: s, error: sErr } = await db.from("startups").select("id, slug").eq("team_app_id", teamId).maybeSingle();
    if (sErr) return json({ error: sErr.message }, 500);
    if (!s) return json({ error: `'${teamId}' Team App ekibine eşlenmiş proje yok` }, 404);

    const { error } = await db.from("startups").update({ published }).eq("id", s.id);
    if (error) return json({ error: error.message }, 500);

    return json({ ok: true, slug: s.slug, published });
  } catch (e) {
    return json({ error: String(e) }, 500);
  }
});
