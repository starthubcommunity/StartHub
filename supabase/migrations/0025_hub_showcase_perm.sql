-- ══════════════════════════════════════════════════════════
-- 0025_hub_showcase_perm.sql — Kurucu Hattı "Vitrin" sayfası yetkisi
-- ══════════════════════════════════════════════════════════
-- Web sitesinde gösterilen proje kartı alanları (logo, TR/EN slogan +
-- açıklama, trend, yayın durumu) artık Admin panel değil, Kurucu
-- Hattı'ndaki Vitrin sayfasından düzenleniyor — YALNIZCA cofounder.
-- Yeni bir hub yetki anahtarı: 'showcase.write'. Yalnızca cofounder
-- şablonuna ekleniyor (recruiter/project_owner'ın geniş "hepsi hariç X"
-- seçimi 0009'da statik seed'lendiği için buradaki yeni anahtar oraya
-- otomatik sızmaz — bilinçli, ayrıca kontrol edildi).
--
-- startups tablosunun RLS'i (0009 startups_write) daha önce yalnızca
-- admin/projects.write'a açıktı — hub/cofounder'ın Vitrin'den yazabilmesi
-- için 'showcase.write' de kabul edilecek şekilde genişletildi.
-- Not: Postgres RLS satır bazlı — hangi KOLONLARIN değiştiği burada
-- kısıtlanmıyor; Vitrin sayfası istemci tarafında yalnızca kendi
-- alanlarını (logo/tagline/desc/trending/published) gönderiyor. Admin
-- panelin projects.write yetkisi zaten tüm alanları değiştirebiliyordu,
-- bu değişiklik onun kapsamını küçültmüyor.

insert into permission_keys (area, key, grp, label, sort_order) values
  ('hub','showcase.write','Vitrin','Web sitesi vitrin bilgilerini düzenle (logo, açıklama, trend, yayın)',35)
on conflict (area, key) do nothing;

insert into permission_presets (area, role, key) values
  ('hub','cofounder','showcase.write')
on conflict do nothing;

drop policy if exists startups_write on startups;
create policy startups_write on startups for all
  using (has_perm('projects.write') or has_perm('showcase.write'))
  with check (has_perm('projects.write') or has_perm('showcase.write'));
