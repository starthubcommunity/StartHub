-- 0056_swap_post_image.sql — Yazının görselini atomik olarak değiştirir ve kaydını tutar.
--
-- Neden RPC: görsel değişimi üç yazmadan oluşur (posts.image_url/image_alt/needs_review +
-- image_usage kaydı). Bunların ayrı istemci çağrılarıyla yapılması yarım kalmaya açıktır.
-- Bu fonksiyon hepsini tek transaction'da yapar: herhangi bir adım hata verirse hiçbiri yazılmaz.
--
-- Yetki: image_usage'a authenticated için doğrudan INSERT politikası YOKTUR. Manuel kayıt
-- yalnızca bu fonksiyon üzerinden yazılır. Fonksiyon security definer çalıştığı için RLS'i
-- atlar; bu yüzden yetki kontrolü içeride, posts güncelleme politikasıyla AYNI koşulla
-- (has_perm('posts.write')) yapılır. Bu, "yalnızca admin" şartından bir adım sıkıdır:
-- posts'a yazma yetkisi olmayan bir admin de görsel değiştiremez.
-- Görsel URL'si ve alt metni istemciden değil image_stock'tan okunur.
--
-- Yazı onayı ("Görsel uygun") ayrı bir fonksiyon GEREKTİRMEZ: mevcut posts_update politikası
-- (has_perm('posts.write')) bu güncellemeye zaten izin verir.

-- Önceki taslak politikayı (uygulanmamıştı) temizle; idempotent olsun.
drop policy if exists "admin inserts manual image_usage" on image_usage;

create or replace function swap_post_image(
  p_post_id bigint,
  p_image_id bigint,
  p_score numeric,
  p_reason jsonb default '{}'::jsonb
)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_post posts%rowtype;
  v_img  image_stock%rowtype;
  v_inserted int;
begin
  if not coalesce(has_perm('posts.write'), false) then
    raise exception 'Yetkin yok' using errcode = '42501';
  end if;

  select * into v_post from posts where id = p_post_id for update;
  if not found then
    raise exception 'Yazı bulunamadı' using errcode = 'P0002';
  end if;

  select * into v_img from image_stock where id = p_image_id;
  if not found then
    raise exception 'Görsel bulunamadı' using errcode = 'P0002';
  end if;

  -- Aynı (görsel, yazı) çifti zaten kayıtlıysa (ör. önceki görsele geri dönüş) yeni satır
  -- eklenmez; eski kayıt korunur. Dönüşteki usage_inserted bunu bildirir.
  insert into image_usage (image_id, post_id, score, reason)
  values (
    p_image_id,
    p_post_id,
    p_score,
    coalesce(p_reason, '{}'::jsonb)
      || jsonb_build_object('manual', true, 'previous_image_url', v_post.image_url)
  )
  on conflict (image_id, post_id) where post_id is not null do nothing;
  get diagnostics v_inserted = row_count;

  update posts
     set image_url = v_img.url,
         image_alt = v_img.alt_tr,
         needs_review = false
   where id = p_post_id;

  return jsonb_build_object('usage_inserted', v_inserted = 1, 'image_url', v_img.url);
end;
$$;

-- Yalnızca oturum açmış kullanıcılar çağırabilir. anon ve PUBLIC'ten yetki alınır.
revoke all on function swap_post_image(bigint, bigint, numeric, jsonb) from public;
revoke all on function swap_post_image(bigint, bigint, numeric, jsonb) from anon;
grant execute on function swap_post_image(bigint, bigint, numeric, jsonb) to authenticated;
