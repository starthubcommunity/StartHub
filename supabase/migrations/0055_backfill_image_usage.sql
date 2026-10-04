-- 0055_backfill_image_usage.sql
-- Mevcut yayınlanmış yazıların görsel kullanımını image_usage'a yazar (tek seferlik).
-- YAZILDI, UYGULANMADI — 0054 uygulandıktan sonra ve kullanıcı onayıyla çalıştırılır.
-- Tekrar çalıştırılırsa aynı (image_id, post_id) çifti ikinci kez eklenmez.

insert into image_usage (image_id, post_id, used_at, reason)
select i.id, p.id, coalesce(p.published_at, p.generated_at, now()), '{"backfill": true}'::jsonb
from posts p
join image_stock i on i.url = p.image_url
where p.image_url is not null
on conflict (image_id, post_id) where post_id is not null do nothing;
