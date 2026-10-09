-- TEST — 0059_hub_candidate_hide.sql (KALICI DEĞİŞİKLİK YAPMAZ)
-- Ana projede (fdlghaafspcuagxfrofz) çalışır: işlem içinde GEÇİCİ bir aday
-- oluşturur (gerçek kayıtlara dokunmaz), senaryoları gerçek rol + JWT ile
-- dener, sonunda bilerek hata fırlatır → her şey geri alınır.
--   npx supabase db query --linked -f supabase/tests/0059_hub_candidate_hide.test.sql
-- Çıktı: "SONUC beklenen=… | gerçek=…"
begin;
do $t$
declare
  e_cof text; e_rec text; v_id uuid; v_id2 uuid; n int; res text := '';
begin
  select lower(email) into e_cof from hub_members where role = 'cofounder' and active limit 1;
  select lower(email) into e_rec from hub_members where role = 'recruiter' and active limit 1;
  if e_rec is null then
    -- canlıda recruiter yoksa işlem içinde geçici bir tane (geri alınır)
    insert into hub_members (email, role, active) values ('recruiter-test@test.invalid', 'recruiter', true);
    e_rec := 'recruiter-test@test.invalid';
  end if;
  insert into hub_candidates (full_name, email, stage, track, source)
    values ('ZZ Gizleme Testi', 'zz-gizleme-testi@test.invalid', 'member', 'member', 'referral') returning id into v_id;

  -- 1 recruiter gizlemeye çalışır → R
  begin
    perform set_config('request.jwt.claims', json_build_object('role','authenticated','email',e_rec)::text, true);
    execute 'set local role authenticated';
    update hub_candidates set hidden_at = now(), hidden_reason = 'test' where id = v_id;
    get diagnostics n = row_count;
    execute 'reset role'; res := res || ' 1:' || case when n = 0 then 'R(0 satır)' else 'G' end;
  exception when others then execute 'reset role'; res := res || ' 1:R';
  end;

  -- 2 cofounder gizler → G
  begin
    perform set_config('request.jwt.claims', json_build_object('role','authenticated','email',e_cof)::text, true);
    execute 'set local role authenticated';
    update hub_candidates set hidden_at = now(), hidden_reason = 'test', hidden_by = e_cof where id = v_id;
    get diagnostics n = row_count;
    execute 'reset role'; res := res || ' 2:' || case when n = 1 then 'G' else 'R(0 satır)' end;
  exception when others then execute 'reset role'; res := res || ' 2:R';
  end;

  -- 3 recruiter gizli satırı GÖREMEZ → 0 satır beklenir (G = görmedi)
  begin
    perform set_config('request.jwt.claims', json_build_object('role','authenticated','email',e_rec)::text, true);
    execute 'set local role authenticated';
    select count(*) into n from hub_candidates where id = v_id;
    execute 'reset role'; res := res || ' 3:' || case when n = 0 then 'G(görmedi)' else 'R(gördü)' end;
  exception when others then execute 'reset role'; res := res || ' 3:hata';
  end;

  -- 4 cofounder gizli satırı görür → 1
  begin
    perform set_config('request.jwt.claims', json_build_object('role','authenticated','email',e_cof)::text, true);
    execute 'set local role authenticated';
    select count(*) into n from hub_candidates where id = v_id;
    execute 'reset role'; res := res || ' 4:' || case when n = 1 then 'G(gördü)' else 'R' end;
  exception when others then execute 'reset role'; res := res || ' 4:hata';
  end;

  -- 5 Pay Sözleri "Ekibe alındı, pay sözü bekliyor" sorgusu (equity.jsx ile aynı filtre) → gizli aday düşer
  begin
    perform set_config('request.jwt.claims', json_build_object('role','authenticated','email',e_cof)::text, true);
    execute 'set local role authenticated';
    select count(*) into n from hub_candidates where stage = 'member' and hidden_at is null and id = v_id;
    execute 'reset role'; res := res || ' 5:' || case when n = 0 then 'G(düştü)' else 'R(listede)' end;
  exception when others then execute 'reset role'; res := res || ' 5:hata';
  end;

  -- 6 recruiter gizli kaydı geri getirmeye çalışır → R (göremediği için 0 satır)
  begin
    perform set_config('request.jwt.claims', json_build_object('role','authenticated','email',e_rec)::text, true);
    execute 'set local role authenticated';
    update hub_candidates set hidden_at = null, hidden_reason = null, hidden_by = null where id = v_id;
    get diagnostics n = row_count;
    execute 'reset role'; res := res || ' 6:' || case when n = 0 then 'R(0 satır)' else 'G' end;
  exception when others then execute 'reset role'; res := res || ' 6:R';
  end;

  -- 7 mükerrer: recruiter gizli kaydın e-postasıyla yeni aday ekler → R (hub_cand_email_uq)
  begin
    perform set_config('request.jwt.claims', json_build_object('role','authenticated','email',e_rec)::text, true);
    execute 'set local role authenticated';
    insert into hub_candidates (full_name, email, stage, track, source) values ('ZZ Mükerrer', 'ZZ-Gizleme-Testi@test.invalid', 'pool', 'member', 'referral');
    execute 'reset role'; res := res || ' 7:G';
  exception when others then execute 'reset role'; res := res || ' 7:R(' || sqlstate || ')';
  end;

  -- 8 recruiter yeni adayı baştan gizli eklemeye çalışır → R
  begin
    perform set_config('request.jwt.claims', json_build_object('role','authenticated','email',e_rec)::text, true);
    execute 'set local role authenticated';
    insert into hub_candidates (full_name, email, stage, track, source, hidden_at) values ('ZZ Gizli Ekle', 'zz-gizli-ekle@test.invalid', 'pool', 'member', 'referral', now());
    execute 'reset role'; res := res || ' 8:G';
  exception when others then execute 'reset role'; res := res || ' 8:R';
  end;

  -- 9 cofounder gizlemeyi kaldırır → G, sonra recruiter görür
  begin
    perform set_config('request.jwt.claims', json_build_object('role','authenticated','email',e_cof)::text, true);
    execute 'set local role authenticated';
    update hub_candidates set hidden_at = null, hidden_reason = null, hidden_by = null where id = v_id;
    perform set_config('request.jwt.claims', json_build_object('role','authenticated','email',e_rec)::text, true);
    select count(*) into n from hub_candidates where id = v_id;
    execute 'reset role'; res := res || ' 9:' || case when n = 1 then 'G' else 'R' end;
  exception when others then execute 'reset role'; res := res || ' 9:hata';
  end;

  -- 10 recruiter gizleme dışı bir alanı (not) günceller → G (tetikleyici karışmaz)
  begin
    perform set_config('request.jwt.claims', json_build_object('role','authenticated','email',e_rec)::text, true);
    execute 'set local role authenticated';
    update hub_candidates set interview_note = 'test notu' where id = v_id;
    get diagnostics n = row_count;
    execute 'reset role'; res := res || ' 10:' || case when n = 1 then 'G' else 'R(0 satır)' end;
  exception when others then execute 'reset role'; res := res || ' 10:R';
  end;

  raise exception 'SONUC beklenen= 1:R 2:G 3:G(görmedi) 4:G(gördü) 5:G(düştü) 6:R 7:R(23505) 8:R 9:G 10:G | gerçek=%', res;
end
$t$;
rollback;
