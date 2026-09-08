-- ══════════════════════════════════════════════════════════
-- 0019_startups_team_app_id_revert.sql — Kurucu Hattı → Team köprüsü geri alındı
-- ══════════════════════════════════════════════════════════
-- 0017/0018'de eklenen team_app_id kolonu ve içeriği, "Kurucu Hattı →
-- Team köprüsü" özelliğinin tamamen geri alınması kararıyla kaldırılıyor.
-- 0017/0018 dosyaları SİLİNMİYOR (zaten uzakta uygulanmış durumdalar —
-- silmek 0013-0016'da yaşanan yerel/uzak sürüm çakışmasını tekrar
-- yaratır); geri alma bu YENİ migration ile yapılıyor.

alter table startups drop column if exists team_app_id;
