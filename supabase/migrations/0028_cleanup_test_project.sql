-- ══════════════════════════════════════════════════════════
-- 0028_cleanup_test_project.sql — team-project-save "yeni proje oluştur"
-- akışını test ederken eklenen deneme satırının temizliği.
-- ══════════════════════════════════════════════════════════
delete from startups where team_app_id = 'ZZTEST123';
