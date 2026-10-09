-- ══════════════════════════════════════════════════════════════════════
-- team-app/0001_app_state_membership_guard.sql
-- !!! TEAM APP PROJESİNE UYGULANIR: umgdtjlgivvymngsnqtv (ana proje DEĞİL) !!!
--   npx supabase db query --linked --project-ref umgdtjlgivvymngsnqtv -f <bu dosya>
-- Geri alma: team-app/0001_app_state_membership_guard.rollback.sql
-- ══════════════════════════════════════════════════════════════════════
-- Neden: app_state'in tek RLS kuralı ("sadece_uyeler", authenticated, using
-- true / with check true) oturum açmış HER kullanıcıya tüm JSON'u yazdırıyor —
-- bir üye konsoldan kendini admin yapabilir, lead üye ekleyip çıkarabilir.
-- Arayüzdeki "üyelik yalnızca admin" kısıtı (2026-10-08) bu tetikleyiciyle
-- sunucuya taşınır.
--
-- Ne yapar: oturum açmış kullanıcının (auth.role() = 'authenticated') her
-- UPDATE'inde eski ve yeni data->'users' yalnızca ÜYELİK alanlarıyla
-- karşılaştırılır: id, e-posta, rol, team, teams, teamRoles, mentorTeams.
-- Ad, avatar, lastLoginAt gibi alanlar karşılaştırmaya GİRMEZ (giriş ve profil
-- kaydı engellenmez). Fark varsa yazan kişinin ESKİ veriye göre admin olması
-- gerekir (aynı yazmada kendini admin yapıp geçemez); değilse yazma reddedilir.
-- Servis rolü (köprüler: Ekibe Al, ekip açma, aday sunma) ve panel/CLI
-- (postgres) karışmaz. Oturum açmış kullanıcı satır SİLEMEZ.
-- INSERT'e tetikleyici KONMAZ: istemci upsert kullanıyor; çakışmada UPDATE
-- tetikleyicisi zaten çalışır.

create or replace function public.app_state_membership(d jsonb)
returns jsonb language sql immutable as $fn$
  select coalesce(jsonb_agg(jsonb_build_object(
           'id',          u->'id',
           'email',       lower(coalesce(u->>'email', '')),
           'role',        u->'role',
           'team',        u->'team',
           'teams',       (select coalesce(jsonb_agg(t order by t::text), '[]'::jsonb)
                             from jsonb_array_elements(case when jsonb_typeof(u->'teams') = 'array' then u->'teams' else '[]'::jsonb end) t),
           'teamRoles',   coalesce(u->'teamRoles', '{}'::jsonb),
           'mentorTeams', (select coalesce(jsonb_agg(t order by t::text), '[]'::jsonb)
                             from jsonb_array_elements(case when jsonb_typeof(u->'mentorTeams') = 'array' then u->'mentorTeams' else '[]'::jsonb end) t)
         ) order by u->>'id'), '[]'::jsonb)
  from jsonb_array_elements(case when jsonb_typeof(d->'users') = 'array' then d->'users' else '[]'::jsonb end) u
$fn$;

create or replace function public.app_state_membership_guard()
returns trigger language plpgsql security definer set search_path = public as $fn$
declare
  v_email text := lower(coalesce(auth.jwt() ->> 'email', ''));
  v_caller_role text;
begin
  if coalesce(auth.role(), '') <> 'authenticated' then
    return coalesce(new, old);          -- servis rolü / panel / CLI
  end if;
  if tg_op = 'DELETE' then
    raise exception 'app_state satırı silinemez' using errcode = '42501';
  end if;
  if public.app_state_membership(old.data) = public.app_state_membership(new.data) then
    return new;                          -- üyelik değişmedi: görev, sprint, kaynak, giriş, profil…
  end if;
  select u->>'role' into v_caller_role
    from jsonb_array_elements(case when jsonb_typeof(old.data->'users') = 'array' then old.data->'users' else '[]'::jsonb end) u
   where lower(u->>'email') = v_email
   limit 1;
  if v_caller_role = 'admin' then
    return new;
  end if;
  raise exception 'Üyelik değişiklikleri yalnızca yöneticiye açık' using errcode = '42501';
end
$fn$;

drop trigger if exists app_state_membership_guard on public.app_state;
create trigger app_state_membership_guard
  before update or delete on public.app_state
  for each row execute function public.app_state_membership_guard();
