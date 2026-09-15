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
// Site DURUMU (published/featured/trending/is_new) da KASITLI OLARAK
// YOK — kullanıcı kararı (2026-09-16): içerik Team Management'tan
// (burası), site durumu yalnızca admin panelden (StatusToggle, düz
// startups UPDATE + RLS has_perm('projects.write')) yönetilir. Team
// App bu alanlara hiç yazamaz; yeni proje oluşturulunca published
// varsayılan olarak true (aşağıdaki create bloğu) kalır, admin panelden
// istenirse gizlenir.
//
// teamId'ye eşlenmiş bir proje YOKSA artık 404 dönmüyor — kullanıcı kararı:
// cofounder istediği ekibi istediği an web sitesine ekleyebilmeli, admin
// panelden ayrıca "Team App Ekip ID" ayarlamaya gerek kalmadan. Bu durumda
// team_app_id=teamId ile YENİ bir startups satırı oluşturulur (slug
// name'den otomatik üretilir, çakışırsa teamId ile benzersizleştirilir).
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
];

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-team-publish-key",
};
const json = (b: unknown, s = 200) =>
  new Response(JSON.stringify(b), { status: s, headers: { ...cors, "Content-Type": "application/json" } });

function slugify(s: string): string {
  const base = (s || "")
    .toLowerCase()
    .replace(/ğ/g, "g").replace(/ü/g, "u").replace(/ş/g, "s")
    .replace(/ı/g, "i").replace(/ö/g, "o").replace(/ç/g, "c")
    .replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "");
  return base || "proje";
}

async function uniqueSlug(db: ReturnType<typeof createClient>, base: string, teamId: string): Promise<string> {
  let candidate = base;
  for (let i = 0; i < 20; i++) {
    const { data } = await db.from("startups").select("id").eq("slug", candidate).maybeSingle();
    if (!data) return candidate;
    candidate = i === 0 ? `${base}-${teamId.toLowerCase()}` : `${base}-${teamId.toLowerCase()}-${i + 1}`;
  }
  return `${base}-${Date.now()}`;
}

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

    if (!s) {
      // Bu ekip henüz web sitesine eşlenmemiş — yeni bir proje oluşturuluyor.
      if (!clean.name || String(clean.name).trim() === "") return json({ error: "Yeni proje için isim zorunlu" }, 400);
      const slug = await uniqueSlug(db, slugify(String(clean.name)), teamId);
      const row = {
        name: clean.name, slug,
        color: clean.color || "#2563EB", stage: clean.stage || "idea", logo: clean.logo || null,
        tagline_tr: clean.tagline_tr || "", tagline_en: clean.tagline_en || "",
        desc_tr: clean.desc_tr || "", desc_en: clean.desc_en || "",
        about_tr: clean.about_tr || "", about_en: clean.about_en || "",
        problem_tr: clean.problem_tr || "", problem_en: clean.problem_en || "",
        solution_tr: clean.solution_tr || "", solution_en: clean.solution_en || "",
        tags: clean.tags || [], website: clean.website || null, demo: clean.demo || null, github: clean.github || null,
        metrics: clean.metrics || [],
        trending: clean.trending || false, featured: clean.featured || false, is_new: clean.is_new || false,
        published: clean.published !== false,
        team: 0, id: Date.now(), team_app_id: teamId,
      };
      const { data: created, error: cErr } = await db.from("startups").insert(row).select().single();
      if (cErr) return json({ error: cErr.message }, 500);
      return json({ ok: true, created: true, project: created });
    }

    const { data: updated, error } = await db.from("startups").update(clean).eq("id", s.id).select().single();
    if (error) return json({ error: error.message }, 500);

    return json({ ok: true, project: updated });
  } catch (e) {
    return json({ error: String(e) }, 500);
  }
});
