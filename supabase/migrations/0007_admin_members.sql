-- ══════════════════════════════════════════════════════════
-- 0007_admin_members.sql — Admin panel rol sistemi + hesap durumu görünümleri
-- ══════════════════════════════════════════════════════════

create table if not exists admin_members (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid unique references auth.users(id) on delete cascade,
  email      text not null unique,
  full_name  text,
  role       text not null default 'editor' check (role in ('admin','editor')),
  active     boolean not null default true,
  created_at timestamptz not null default now()
);

create or replace function admin_role() returns text
language sql stable security definer set search_path = public, auth as $$
  select role from admin_members
   where active = true
     and (user_id = auth.uid()
          or lower(email) = lower(coalesce(auth.jwt() ->> 'email','')))
   limit 1
$$;

create or replace function is_admin_member() returns boolean
language sql stable security definer set search_path = public, auth as $$
  select admin_role() is not null
$$;

alter table admin_members enable row level security;
create policy adm_read  on admin_members for select using (is_admin_member());
create policy adm_write on admin_members for all
  using (admin_role() = 'admin') with check (admin_role() = 'admin');

-- Tetikleyiciyi iki tabloyu birden bağlayacak şekilde güncelle
create or replace function hub_link_user() returns trigger
language plpgsql security definer set search_path = public, auth as $$
begin
  update hub_members   set user_id = new.id
   where user_id is null and lower(email) = lower(new.email);
  update admin_members set user_id = new.id
   where user_id is null and lower(email) = lower(new.email);
  return new;
end $$;

-- ── Hesap durumu görünümleri (Parça 3) ────────────────────────
-- auth.users ile e-posta üzerinden eşleşir. security_invoker = false →
-- görünüm sahibi (postgres) yetkisiyle çalışır, auth şemasını okuyabilir;
-- WHERE ile yalnızca yetkili çağıran satırları görür. Şifre hash'i ASLA
-- gösterilmez — yalnızca hesap var mı / son giriş / doğrulandı mı.
create or replace view admin_member_accounts
  with (security_invoker = false) as
select m.id, m.email, m.full_name, m.role, m.active,
       (u.id is not null)                  as has_account,
       u.last_sign_in_at,
       (u.email_confirmed_at is not null)  as email_confirmed
  from admin_members m
  left join auth.users u on lower(u.email) = lower(m.email)
 where is_admin_member();

create or replace view hub_member_accounts
  with (security_invoker = false) as
select m.id, m.email, m.full_name, m.role, m.active,
       (u.id is not null)                  as has_account,
       u.last_sign_in_at,
       (u.email_confirmed_at is not null)  as email_confirmed
  from hub_members m
  left join auth.users u on lower(u.email) = lower(m.email)
 where is_hub_member();

grant select on admin_member_accounts, hub_member_accounts to authenticated;

-- İlk admin (kendini kilitleme). E-postayı kendi hesabınla değiştir.
insert into admin_members (email, full_name, role) values
  ('kadirks2003@gmail.com', 'Kadir Kuş', 'admin')
on conflict (email) do nothing;

update admin_members m set user_id = u.id
  from auth.users u
 where lower(u.email) = lower(m.email) and m.user_id is null;
