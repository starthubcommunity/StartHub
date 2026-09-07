-- ══════════════════════════════════════════════════════════
-- 0017_startups_team_app_id.sql — Kurucu Hattı → Team köprüsü
-- ══════════════════════════════════════════════════════════
-- startups.id (main proje, bigint) ile Team app'in (umgdtjlgivvymngsnqtv
-- projesi, app_state.data.teams[].id) ekip id'si arasında gevşek referans.
-- Yeni bir eşleştirme tablosu değil, tek nullable kolon: ilişki 1:1
-- opsiyonel, hub_open_roles/hub_candidates'ın zaten startups.id'ye verdiği
-- "FK yok, tip uyumsuzluğu riski" felsefesiyle tutarlı.

alter table startups add column if not exists team_app_id text;

comment on column startups.team_app_id is
  'Team app''ın (umgdtjlgivvymngsnqtv projesi) karşılık gelen ekip id''si '
  '(ör. "A"/"B"/"C"/"BD"). FK YOK: farklı Supabase projesi, hiçbir kod yolu '
  'burada JOIN yapamaz — köprü her zaman application-layer (Edge Function) '
  'olmak zorunda. Boşsa Kurucu Hattı → Team köprüsü bu proje için çalışmaz.';
