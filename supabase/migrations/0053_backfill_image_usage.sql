-- 0053_backfill_image_usage.sql
-- Mevcut yayınlanmış yazıların görsel kullanımını image_usage'a yazar (tek seferlik).
-- YAZILDI, UYGULANMADI — 0052 uygulandıktan sonra ve kullanıcı onayıyla çalıştırılır.
-- Tekrar çalıştırılırsa aynı (image_id, post_id) çifti ikinci kez eklenmez.

insert into image_usage (image_id, post_id, used_at, reason)
select i.id, p.id, coalesce(p.published_at, p.generated_at, now()), '{"backfill": true}'::jsonb
from posts p
join image_stock i on i.url = p.image_url
where p.image_url is not null
  and not exists (
    select 1 from image_usage u where u.image_id = i.id and u.post_id = p.id
  );
