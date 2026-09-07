-- ══════════════════════════════════════════════════════════
-- 0018_startups_team_app_id_seed.sql — Kurucu Hattı → Team köprüsü
-- ══════════════════════════════════════════════════════════
-- 0017'de eklenen startups.team_app_id kolonunu, kullanıcı onayıyla
-- doğrulanmış 3 mevcut proje için doldurur. İş Geliştirme (BD) ekibinin
-- Hub'da ayrı bir startup kaydı yok — eşleştirilmeden kalır, bilinçli.

update startups set team_app_id = 'A' where slug = 'tid-cevirici';   -- TİD Çevirici → Team A (TİD Çevirmeni)
update startups set team_app_id = 'B' where slug = 'eventhub';       -- EventHub → Team B (Etkinlik Operasyon Sistemi)
update startups set team_app_id = 'C' where slug = 'grant-agent';    -- GrantAgent → Team C (Hibe & Teşvik Başvuru Yazım Ajanı)
