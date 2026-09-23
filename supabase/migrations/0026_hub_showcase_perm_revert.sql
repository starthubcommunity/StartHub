-- ══════════════════════════════════════════════════════════
-- 0026_hub_showcase_perm_revert.sql — 0025'in geri alınması
-- ══════════════════════════════════════════════════════════
-- Kullanıcı kararıyla: proje vitrini (logo/slogan/açıklama/trend/yayın)
-- Kurucu Hattı'na taşınmadı, admin panelde kalıyor. 0025'te eklenen
-- 'showcase.write' yetkisi ve buna bağlı RLS genişletmesi geri alınıyor.

delete from permission_presets where area = 'hub' and role = 'cofounder' and key = 'showcase.write';
delete from permission_keys where area = 'hub' and key = 'showcase.write';

drop policy if exists startups_write on startups;
create policy startups_write on startups for all
  using (has_perm('projects.write'))
  with check (has_perm('projects.write'));
