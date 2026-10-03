-- 0050_posts_is_indexable.sql
-- SEO Aşama 4, madde 6 (Otomatik haberler): otomasyonla (automation/publish.py)
-- yayınlanan ama ekip tarafından henüz yorumlanmamış/incelenmemiş yazıları
-- Google dizininden ayrı tutabilmek için bir bayrak.
--
-- YAZILDI AMA ÇALIŞTIRILMADI — proje kuralı: "Supabase migration yazabilirsin
-- ama ÇALIŞTIRMA, bana göster" (kullanıcı talimatı, SEO çalışma planı).
-- Kullanıcı onayı olmadan `supabase db push` ÇALIŞTIRILMAMALI.
--
-- Varsayılan true: mevcut tüm yazılar (elle girilmiş, zaten yayında olanlar)
-- geriye dönük noindex OLMASIN diye. automation/publish.py şu an bu kolonu
-- HİÇ yazmıyor — istenirse otomatik (source dolu) satırlara false, editör
-- 2-3 cümlelik yorumunu ekleyip onayladıktan sonra true atanabilir. Kod tarafı
-- (prerender.mjs: noindex + sitemap/RSS dışı bırakma; app.jsx: noindex) kolon
-- yokken de güvenli çalışır (eksik kolon = indekslenebilir). Migration'ın
-- kendisi kullanıcı onayı olmadan çalıştırılmaz.
alter table posts
  add column if not exists is_indexable boolean not null default true;

comment on column posts.is_indexable is
  'false ise yazı sitede görünmeye devam eder ama robots meta noindex, follow olur (SEO Aşama 4, madde 6). automation/publish.py şu an bu kolonu yazmıyor.';
