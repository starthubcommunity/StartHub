-- ══════════════════════════════════════════════════════════
-- 0024_startups_published.sql — projeler için "yayında mı" bayrağı
-- ══════════════════════════════════════════════════════════
-- Bazı projeler arka planda (Kurucu Hattı/Team üzerinden) yönetiliyor
-- ama henüz web sitesinde herkese açık gösterilmek istenmiyor. Şimdiye
-- kadar startups tablosundaki HER satır koşulsuz web sitesinde
-- gösteriliyordu — ayrı bir yayın kontrolü yoktu.
--
-- default true: mevcut projelerin hiçbiri görünürlükten düşmez (geriye
-- dönük uyumlu). Yeni eklenecek "arka planda yönetilen" bir proje
-- published=false ile eklenip hazır olunca açılabilir.

alter table startups add column if not exists published boolean not null default true;

comment on column startups.published is
  'true ise proje web sitesinde (ana sayfa/proje detay) gösterilir. '
  'false: yalnızca admin panelde/Kurucu Hattı''nda görünür, site''den '
  'gizlenir — "arka planda yönetilen" proje.';
