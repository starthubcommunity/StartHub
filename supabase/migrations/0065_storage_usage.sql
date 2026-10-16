-- 0065_storage_usage.sql — ücretsiz plan koruması (D2)
-- Projedeki tüm depolama kullanımı (bayt). Yükleme kapısı (hub-resource-files) servis
-- rolüyle storage_usage_bytes()'ı okur; 700 MB'ta Kaynaklar PDF yüklemesi durur.
-- Sözleşme kabul PDF'leri (contract-pdfs) bu kapıdan MUAFTIR — onları yazan kod
-- (contract-delivery) kullanımı hiç kontrol etmez.
-- HR (cofounder) kullanım satırı için hub_storage_usage(): yalnızca equity.read.

create or replace function storage_usage_bytes() returns bigint
language sql stable security definer set search_path = public, storage as $$
  select coalesce(sum((metadata->>'size')::bigint), 0)::bigint from storage.objects
$$;
revoke all on function storage_usage_bytes() from public, anon, authenticated;
grant execute on function storage_usage_bytes() to service_role;

create or replace function hub_storage_usage() returns jsonb
language plpgsql stable security definer set search_path = public, storage as $$
begin
  if not has_perm('equity.read') then raise exception 'Yetkin yok'; end if;
  return jsonb_build_object(
    'used', (select coalesce(sum((metadata->>'size')::bigint), 0) from storage.objects),
    'limit', 1073741824,          -- ücretsiz plan: 1 GB
    'stopAt', 734003200           -- 700 MB: Kaynaklar PDF yüklemesi durur
  );
end $$;
revoke all on function hub_storage_usage() from public, anon;
grant execute on function hub_storage_usage() to authenticated;

-- GERİ ALMA: drop function hub_storage_usage(); drop function storage_usage_bytes();
