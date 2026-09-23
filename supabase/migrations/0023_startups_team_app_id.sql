-- ══════════════════════════════════════════════════════════
-- 0023_startups_team_app_id.sql — Kurucu Hattı → Team köprüsü (yeniden)
-- ══════════════════════════════════════════════════════════
-- 0017/0018'de eklenip 0019'da geri alınmıştı. Bu kez hub-move-to-team
-- (main proje, server-side) içinden kullanılacak — bkz. o fonksiyonun
-- kaynağı ve HUB_SPEC. startups.id (main proje) ile Team app'in
-- (umgdtjlgivvymngsnqtv projesi, app_state.data.teams[].id) ekip id'si
-- arasında gevşek referans. Yeni bir eşleştirme tablosu değil, tek
-- nullable kolon: ilişki 1:1 opsiyonel, hub_open_roles/hub_candidates'ın
-- zaten startups.id'ye verdiği "FK yok, farklı proje" felsefesiyle tutarlı.

alter table startups add column if not exists team_app_id text;

comment on column startups.team_app_id is
  'Team app''ın (umgdtjlgivvymngsnqtv projesi) karşılık gelen ekip id''si '
  '(ör. "A"/"B"/"C"/"BD"). FK YOK: farklı Supabase projesi, hiçbir kod yolu '
  'burada JOIN yapamaz — köprü her zaman application-layer (Edge Function) '
  'olmak zorunda. Boşsa Kurucu Hattı → Team köprüsü bu proje için çalışmaz.';

-- Daha önce (0018) doğrulanmış 3 proje eşleştirmesi. İş Geliştirme (BD)
-- ekibinin Hub'da ayrı bir startup kaydı yok — eşleştirilmeden kalır.
update startups set team_app_id = 'A' where slug = 'tid-cevirici';   -- TİD Çevirici → Team A (TİD Çevirmeni)
update startups set team_app_id = 'B' where slug = 'eventhub';       -- EventHub → Team B (Etkinlik Operasyon Sistemi)
update startups set team_app_id = 'C' where slug = 'grant-agent';    -- GrantAgent → Team C (Hibe & Teşvik Başvuru Yazım Ajanı)
