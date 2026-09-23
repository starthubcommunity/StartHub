-- ══════════════════════════════════════════════════════════
-- 0027_startups_logo.sql — startups.logo kolonu (eksik olduğu keşfedildi)
-- ══════════════════════════════════════════════════════════
-- admin-store.jsx (mapStartupToDb/FromDb), eski ProjectForm ve site
-- render kodu (ui-components.jsx, detail-pages.jsx vb.) hep bir
-- startups.logo alanı OKUYUP YAZMAYA çalışıyordu ama hiçbir migration
-- bu kolonu hiç oluşturmamış — sessizce hep null/no-op kalmış (kimse
-- fark etmemiş çünkü tüm projeler zaten baş harf-rozeti fallback'iyle
-- gösteriliyordu). team-project-save'in "yeni proje oluştur" akışını
-- test ederken PostgREST'in "column does not exist" hatasıyla ortaya
-- çıktı.

alter table startups add column if not exists logo text;

comment on column startups.logo is
  'Proje logosu — base64 data URL (ImageUpload/resizeImage ile üretilir, '
  'Supabase Storage kullanılmaz). Boşsa arayüzde baş harf rozeti gösterilir.';
