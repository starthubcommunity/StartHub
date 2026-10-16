-- TEST — 0065_storage_usage.sql (KALICI DEĞİŞİKLİK YAPMAZ; sonunda hata fırlatıp geri alır)
--   npx supabase db query --linked -f supabase/tests/0065_storage_usage.test.sql
begin;
do $t$
declare e_cof text; e_rec text; j jsonb; b bigint; res text := '';
begin
  select lower(email) into e_cof from hub_members where role = 'cofounder' and active limit 1;
  select lower(email) into e_rec from hub_members where role = 'recruiter' and active limit 1;
  if e_rec is null then insert into hub_members (email, role, active) values ('recruiter-test@test.invalid', 'recruiter', true); e_rec := 'recruiter-test@test.invalid'; end if;
  -- 1 cofounder kullanım satırını okur → G
  begin
    perform set_config('request.jwt.claims', json_build_object('role','authenticated','email',e_cof)::text, true);
    execute 'set local role authenticated';
    j := hub_storage_usage(); execute 'reset role';
    res := res || ' 1:' || case when (j->>'used')::bigint > 0 and (j->>'stopAt')::bigint = 734003200 then 'G' else 'R' end;
  exception when others then execute 'reset role'; res := res || ' 1:R(' || sqlerrm || ')'; end;
  -- 2 recruiter okuyamaz → R
  begin
    perform set_config('request.jwt.claims', json_build_object('role','authenticated','email',e_rec)::text, true);
    execute 'set local role authenticated';
    j := hub_storage_usage(); execute 'reset role'; res := res || ' 2:G';
  exception when others then execute 'reset role'; res := res || ' 2:R'; end;
  -- 3 tarayıcı (authenticated) ham fonksiyonu çağıramaz → R
  begin
    perform set_config('request.jwt.claims', json_build_object('role','authenticated','email',e_cof)::text, true);
    execute 'set local role authenticated';
    b := storage_usage_bytes(); execute 'reset role'; res := res || ' 3:G';
  exception when others then execute 'reset role'; res := res || ' 3:R'; end;
  -- 4 servis rolü ham fonksiyonu çağırır → G
  begin
    execute 'set local role service_role';
    b := storage_usage_bytes(); execute 'reset role'; res := res || ' 4:' || case when b > 0 then 'G' else 'R' end;
  exception when others then execute 'reset role'; res := res || ' 4:R(' || sqlerrm || ')'; end;
  raise exception 'SONUC beklenen= 1:G 2:R 3:R 4:G | gerçek=%', res;
end $t$;
rollback;
