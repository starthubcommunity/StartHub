-- 0056_image_usage_manual_insert.sql
-- Admin paneli "Görseli değiştir" ile yaptığı elle seçimleri image_usage'a yazabilsin.
-- Politika yalnızca reason.manual = true olan satırlara izin verir ve admin üyesi olmayı şart koşar.
-- YAZILDI, UYGULANMADI — kullanıcı onayıyla uygulanır.

drop policy if exists "admin inserts manual image_usage" on image_usage;
create policy "admin inserts manual image_usage" on image_usage
  for insert to authenticated
  with check (
    reason ->> 'manual' = 'true'
    and exists (
      select 1 from admin_members m
      where m.active and (m.user_id = auth.uid()
        or lower(m.email) = lower(coalesce(auth.jwt() ->> 'email', '')))
    )
  );
