-- 0051_startups_seo_title.sql
-- SEO/GEO (feat/seo-faq, 2026-10-02): proje sayfalarının <title> etiketi şu
-- ana kadar sabit "${ad} | Start-Hub Lab" deseniyle otomatik üretiliyordu.
-- Kullanıcı bazı projeler için daha anahtar kelime zengin, özel başlıklar
-- hazırladı (ör. "TİD Çevirici — Yapay Zekâ ile Anlık Türk İşaret Dili
-- Çevirmeni | Start-Hub"). Bu kolonlar OPSİYONEL — doluysa kullanılır,
-- boşsa (null) mevcut otomatik desene düşülür (src/app.jsx + prerender.mjs).
alter table startups
  add column if not exists seo_title_tr text,
  add column if not exists seo_title_en text;

comment on column startups.seo_title_tr is
  'Opsiyonel özel <title> (TR) — boşsa "${ad} | Start-Hub Lab" otomatik deseni kullanılır.';
comment on column startups.seo_title_en is
  'Opsiyonel özel <title> (EN) — boşsa "${ad} | Start-Hub Lab" otomatik deseni kullanılır.';
