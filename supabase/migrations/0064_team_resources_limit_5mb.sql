-- 0064_team_resources_limit_5mb.sql — ücretsiz plan koruması (D1)
-- Kaynaklar PDF'i dosya başına 10 MB → 5 MB. Bucket sınırı yalnızca YENİ yüklemelere
-- uygulanır; mevcut dosyalara dokunulmaz (tablo kısıtı 10 MB'ta kalır — eski kayıtlar geçerli).
-- Ekip başına 15 / Genel 15 sınırı kodda (_shared/resource-files.js).
update storage.buckets set file_size_limit = 5242880 where id = 'team-resources';

-- GERİ ALMA: update storage.buckets set file_size_limit = 10485760 where id = 'team-resources';
