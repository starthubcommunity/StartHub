-- TEST — team-app/0001_app_state_membership_guard.sql (KALICI DEĞİŞİKLİK YAPMAZ)
-- Tetikleyiciyi bir işlem içinde kurar, 11 senaryoyu gerçek rol + JWT ile dener,
-- sonunda bilerek hata fırlatır → her şey (tetikleyici dahil) geri alınır.
-- Çıktı: hata mesajındaki "SONUC ..." satırı. R = reddedildi, G = geçti.
--   npx supabase db query --linked --project-ref umgdtjlgivvymngsnqtv -f <bu dosya>
begin;
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

do $t$
declare
  e_admin text; e_lead text; e_member text; lead_team text;
  res text := '';
begin
  select lower(u->>'email') into e_admin  from app_state, jsonb_array_elements(data->'users') u where id='shl_v5' and u->>'role'='admin'  limit 1;
  select lower(u->>'email'), coalesce(u->>'team', u->'teams'->>0) into e_lead, lead_team from app_state, jsonb_array_elements(data->'users') u where id='shl_v5' and u->>'role'='lead' limit 1;
  select lower(u->>'email') into e_member from app_state, jsonb_array_elements(data->'users') u where id='shl_v5' and u->>'role'='member' limit 1;
  if e_admin is null or e_lead is null or e_member is null then
    raise exception 'SONUC test hesabı bulunamadı: admin=% lead=% member=%', e_admin is not null, e_lead is not null, e_member is not null;
  end if;

  -- yardımcı: senaryo çalıştır
  -- (her senaryo kendi alt-işleminde; hata alırsa yalnızca o senaryo geri alınır)

  -- 1 üye: başka bir ekibe kendini ekler → R bekleniyor
  begin
    perform set_config('request.jwt.claims', json_build_object('role','authenticated','email',e_member)::text, true);
    execute 'set local role authenticated';
    update app_state set data = jsonb_set(data, '{users}', (select jsonb_agg(case when lower(u->>'email')=e_member then jsonb_set(u,'{teams}', coalesce(u->'teams','[]'::jsonb) || '["ZZ"]') else u end) from jsonb_array_elements(data->'users') u)) where id='shl_v5';
    execute 'reset role'; res := res || ' 1:G';
  exception when others then execute 'reset role'; res := res || ' 1:R';
  end;

  -- 2 lead: kendini admin yapar → R
  begin
    perform set_config('request.jwt.claims', json_build_object('role','authenticated','email',e_lead)::text, true);
    execute 'set local role authenticated';
    update app_state set data = jsonb_set(data, '{users}', (select jsonb_agg(case when lower(u->>'email')=e_lead then jsonb_set(u,'{role}','"admin"') else u end) from jsonb_array_elements(data->'users') u)) where id='shl_v5';
    execute 'reset role'; res := res || ' 2:G';
  exception when others then execute 'reset role'; res := res || ' 2:R';
  end;

  -- 3 lead: yeni üye ekler → R
  begin
    perform set_config('request.jwt.claims', json_build_object('role','authenticated','email',e_lead)::text, true);
    execute 'set local role authenticated';
    update app_state set data = jsonb_set(data, '{users}', (data->'users') || jsonb_build_array(jsonb_build_object('id',999000001,'name','Test','email','yeni@test.invalid','role','member','team',lead_team,'teams',jsonb_build_array(lead_team)))) where id='shl_v5';
    execute 'reset role'; res := res || ' 3:G';
  exception when others then execute 'reset role'; res := res || ' 3:R';
  end;

  -- 4 lead: bir üyeyi ekipten çıkarır (kullanıcı listeden düşer) → R
  begin
    perform set_config('request.jwt.claims', json_build_object('role','authenticated','email',e_lead)::text, true);
    execute 'set local role authenticated';
    update app_state set data = jsonb_set(data, '{users}', (select jsonb_agg(u) from jsonb_array_elements(data->'users') u where lower(u->>'email') <> e_member)) where id='shl_v5';
    execute 'reset role'; res := res || ' 4:G';
  exception when others then execute 'reset role'; res := res || ' 4:R';
  end;

  -- 5 lead: görev ekler → G
  begin
    perform set_config('request.jwt.claims', json_build_object('role','authenticated','email',e_lead)::text, true);
    execute 'set local role authenticated';
    update app_state set data = jsonb_set(data, '{tasks}', coalesce(data->'tasks','[]'::jsonb) || jsonb_build_array(jsonb_build_object('id',999000002,'title','TEST görev','team',lead_team,'status','todo'))) where id='shl_v5';
    execute 'reset role'; res := res || ' 5:G';
  exception when others then execute 'reset role'; res := res || ' 5:R';
  end;

  -- 6 üye: sprint + review + kaynak (ekip kaynak listesi) + paylaşılan kaynak değiştirir → G
  begin
    perform set_config('request.jwt.claims', json_build_object('role','authenticated','email',e_member)::text, true);
    execute 'set local role authenticated';
    update app_state set data = jsonb_set(jsonb_set(jsonb_set(data,
        '{sprints}', coalesce(data->'sprints','[]'::jsonb) || '[{"id":"s-test","name":"Test sprint"}]'),
        '{teams}', (select jsonb_agg(case when t->>'id' = lead_team then jsonb_set(t,'{resources}', coalesce(t->'resources','[]'::jsonb) || '[{"tool":"Link","url":"https://example.com"}]') else t end) from jsonb_array_elements(data->'teams') t)),
        '{tasks}', (select coalesce(jsonb_agg(case when (x->>'id') = '999000002' then jsonb_set(x,'{status}','"review"') else x end), '[]'::jsonb) from jsonb_array_elements(data->'tasks') x))
      where id='shl_v5';
    execute 'reset role'; res := res || ' 6:G';
  exception when others then execute 'reset role'; res := res || ' 6:R';
  end;

  -- 7 üye: giriş (lastLoginAt) + profil (ad, avatar) → G
  begin
    perform set_config('request.jwt.claims', json_build_object('role','authenticated','email',e_member)::text, true);
    execute 'set local role authenticated';
    update app_state set data = jsonb_set(data, '{users}', (select jsonb_agg(case when lower(u->>'email')=e_member then u || jsonb_build_object('lastLoginAt', 1790000000000, 'avatar','ZZ','name', coalesce(u->>'name','') || ' ') else u end) from jsonb_array_elements(data->'users') u)) where id='shl_v5';
    execute 'reset role'; res := res || ' 7:G';
  exception when others then execute 'reset role'; res := res || ' 7:R';
  end;

  -- 8 admin: yeni üye ekler → G
  begin
    perform set_config('request.jwt.claims', json_build_object('role','authenticated','email',e_admin)::text, true);
    execute 'set local role authenticated';
    update app_state set data = jsonb_set(data, '{users}', (data->'users') || jsonb_build_array(jsonb_build_object('id',999000003,'name','Admin ekledi','email','admin-ekledi@test.invalid','role','member','team',lead_team,'teams',jsonb_build_array(lead_team)))) where id='shl_v5';
    execute 'reset role'; res := res || ' 8:G';
  exception when others then execute 'reset role'; res := res || ' 8:R';
  end;

  -- 9 köprü (servis rolü — Ekibe Al'ın yazdığı yol): yeni üye ekler → G
  begin
    perform set_config('request.jwt.claims', json_build_object('role','service_role')::text, true);
    execute 'set local role service_role';
    update app_state set data = jsonb_set(data, '{users}', (data->'users') || jsonb_build_array(jsonb_build_object('id',999000004,'name','Köprü ekledi','email','kopru@test.invalid','role','member','team',lead_team,'teams',jsonb_build_array(lead_team)))) where id='shl_v5';
    execute 'reset role'; res := res || ' 9:G';
  exception when others then execute 'reset role'; res := res || ' 9:R';
  end;

  -- 10 üye: satırı siler → R
  begin
    perform set_config('request.jwt.claims', json_build_object('role','authenticated','email',e_member)::text, true);
    execute 'set local role authenticated';
    delete from app_state where id='shl_v5';
    if not found then raise exception 'silinmedi'; end if;
    execute 'reset role'; res := res || ' 10:G';
  exception when others then execute 'reset role'; res := res || ' 10:R';
  end;

  -- 11 lead: aynı kayıtta görev + kendine ikinci ekip (karışık) → R (üyelik kısmı yüzünden)
  begin
    perform set_config('request.jwt.claims', json_build_object('role','authenticated','email',e_lead)::text, true);
    execute 'set local role authenticated';
    update app_state set data = jsonb_set(jsonb_set(data, '{tasks}', coalesce(data->'tasks','[]'::jsonb) || '[{"id":999000005,"title":"x"}]'),
        '{users}', (select jsonb_agg(case when lower(u->>'email')=e_lead then jsonb_set(u,'{teamRoles}', coalesce(u->'teamRoles','{}'::jsonb) || '{"ZZ":"lead"}') else u end) from jsonb_array_elements(data->'users') u)) where id='shl_v5';
    execute 'reset role'; res := res || ' 11:G';
  exception when others then execute 'reset role'; res := res || ' 11:R';
  end;

  raise exception 'SONUC beklenen= 1:R 2:R 3:R 4:R 5:G 6:G 7:G 8:G 9:G 10:R 11:R | gerçek=%', res;
end
$t$;

rollback;
