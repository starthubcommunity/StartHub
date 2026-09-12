// Supabase Edge Function: team-project-save  (main proje: fdlghaafspcuagxfrofz)
// Team App'in (/team/, ayrı Supabase projesi umgdtjlgivvymngsnqtv, tarayıcı-
// only tek dosya) Overview ekranındaki proje düzenleme modalı buraya yazar.
// Admin panelin proje formu KALDIRILDI — bu, onun tek yerine geçen yazma
// yolu. Team App'in bu projede kendi oturumu YOK, bu yüzden JWT değil,
// paylaşılan bir anahtar (x-team-publish-key, team-toggle-published ile
// AYNI TEAM_PUBLISH_KEY) ile korunuyor.
//
// Kapsam kasıtlı olarak ALLOWLIST'li: yalnızca aşağıdaki kolonlar yazılır.
// people tablosu üzerinden ekip lideri/mentör/üye ataması (lead_id/
// member_ids/mentor_id) BURADA YOK — Team App'in kendi ayrı roster
// modeliyle çakışmaması için kasıtlı dışarıda tutuldu.
//
//   supabase functions deploy team-project-save --project-ref fdlghaafspcuagxfrofz --no-verify-jwt

import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const TEAM_PUBLISH_KEY = Deno.env.get("TEAM_PUBLISH_KEY");

const WRITABLE_FIELDS = [
  "name", "slug", "color", "stage", "logo",
  "tagline_tr", "tagline_en", "desc_tr", "desc_en",
  "about_tr", "about_en", "problem_tr", "problem_en", "solution_tr", "solution_en",
  "tags", "website", "demo", "github", "metrics",
  "trending", "featured", "is_new", "published",
];

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
    const { teamId, patch } = await req.json();
    if (!teamId || !patch || typeof patch !== "object") return json({ error: "teamId ve patch zorunlu" }, 400);

    const clean: Record<string, unknown> = {};
    for (const k of Object.keys(patch)) {
      if (WRITABLE_FIELDS.includes(k)) clean[k] = patch[k];
    }
    if (Object.keys(clean).length === 0) return json({ error: "yazılabilir alan yok" }, 400);
    if (typeof clean.slug === "string" && !/^[a-z0-9-]+$/.test(clean.slug)) {
      return json({ error: "slug yalnızca küçük harf/rakam/tire içerebilir" }, 400);
    }

    const db = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, { auth: { autoRefreshToken: false, persistSession: false } });
    const { data: s, error: sErr } = await db.from("startups").select("id").eq("team_app_id", teamId).maybeSingle();
    if (sErr) return json({ error: sErr.message }, 500);
    if (!s) return json({ error: `'${teamId}' Team App ekibine eşlenmiş proje yok` }, 404);

    const { data: updated, error } = await db.from("startups").update(clean).eq("id", s.id).select().single();
    if (error) return json({ error: error.message }, 500);

    return json({ ok: true, project: updated });
  } catch (e) {
    return json({ error: String(e) }, 500);
  }
});
