-- TEST — 0061_contract_documents.sql (KALICI DEĞİŞİKLİK YAPMAZ)
-- Migration uygulandıktan sonra ana projede çalışır; işlem içinde GEÇİCİ koltuk/söz/
-- kabul/PDF kaydı oluşturur, senaryoları dener, sonunda hata fırlatır → her şey geri alınır.
--   npx supabase db query --linked -f supabase/tests/0061_contract_documents.test.sql
begin;
do $t$
declare
  e_cof text; e_rec text; v_seat uuid; v_g uuid; v_tpl uuid; v_acc uuid; v_doc uuid; n int; res text := '';
begin
  select lower(email) into e_cof from hub_members where role = 'cofounder' and active limit 1;
  select lower(email) into e_rec from hub_members where role = 'recruiter' and active limit 1;
  if e_rec is null then
    insert into hub_members (email, role, active) values ('recruiter-test@test.invalid', 'recruiter', true);
    e_rec := 'recruiter-test@test.invalid';
  end if;
  select id into v_tpl from contract_templates where kind = 'member' order by version desc limit 1;
  insert into equity_seats (startup_id, title, seat_kind, budget_pct) values (-1, 'ZZ', 'member_standard', 10) returning id into v_seat;
  insert into equity_grants (seat_id, holder_name, holder_email, grant_pct, schedule, vest_months, cliff_months, start_date, status, contract_template_id, signed_at)
    values (v_seat, 'ZZ', 'zz@test.invalid', 5, 'time', 12, 6, current_date, 'active', v_tpl, now()) returning id into v_g;
  insert into contract_acceptances (grant_id, template_id, template_kind, template_version, holder_email, typed_name, consent, text_sha256, text_snapshot, terms)
    values (v_g, v_tpl, 'member', 1, 'zz@test.invalid', 'ZZ Test', true, repeat('a', 64), 'metin', '{}') returning id into v_acc;

  -- 1 bucket private, yalnızca PDF, 2 MB
  select count(*) into n from storage.buckets where id = 'contract-pdfs' and public = false and file_size_limit = 2097152 and allowed_mime_types = array['application/pdf'];
  res := res || ' 1:' || case when n = 1 then 'G' else 'R' end;

  -- 2 sunucu PDF kaydı yazar → G
  begin
    perform set_config('request.jwt.claims', json_build_object('role','service_role')::text, true);
    execute 'set local role service_role';
    insert into contract_documents (acceptance_id, grant_id, storage_path, pdf_sha256, size_bytes)
      values (v_acc, v_g, v_g || '/' || v_acc || '.pdf', repeat('b', 64), 14000) returning id into v_doc;
    execute 'reset role'; res := res || ' 2:G';
  exception when others then execute 'reset role'; res := res || ' 2:R(' || sqlerrm || ')';
  end;

  -- 3 aynı kabul için ikinci PDF → R
  begin
    perform set_config('request.jwt.claims', json_build_object('role','service_role')::text, true);
    execute 'set local role service_role';
    insert into contract_documents (acceptance_id, grant_id, storage_path, pdf_sha256, size_bytes)
      values (v_acc, v_g, v_g || '/' || gen_random_uuid() || '.pdf', repeat('c', 64), 1);
    execute 'reset role'; res := res || ' 3:G';
  exception when others then execute 'reset role'; res := res || ' 3:R';
  end;

  -- 4 servis rolü PDF kaydını değiştirir → R
  begin
    perform set_config('request.jwt.claims', json_build_object('role','service_role')::text, true);
    execute 'set local role service_role';
    update contract_documents set size_bytes = 1 where id = v_doc;
    execute 'reset role'; res := res || ' 4:G';
  exception when others then execute 'reset role'; res := res || ' 4:R';
  end;

  -- 5 servis rolü PDF kaydını siler → R
  begin
    perform set_config('request.jwt.claims', json_build_object('role','service_role')::text, true);
    execute 'set local role service_role';
    delete from contract_documents where id = v_doc;
    execute 'reset role'; res := res || ' 5:G';
  exception when others then execute 'reset role'; res := res || ' 5:R';
  end;

  -- 6 cofounder tarayıcıdan PDF kaydı ekler → R
  begin
    perform set_config('request.jwt.claims', json_build_object('role','authenticated','email',e_cof)::text, true);
    execute 'set local role authenticated';
    insert into contract_documents (acceptance_id, grant_id, storage_path, pdf_sha256, size_bytes)
      values (v_acc, v_g, v_g || '/' || gen_random_uuid() || '.pdf', repeat('d', 64), 1);
    execute 'reset role'; res := res || ' 6:G';
  exception when others then execute 'reset role'; res := res || ' 6:R';
  end;

  -- 7 cofounder okur → 1 satır
  begin
    perform set_config('request.jwt.claims', json_build_object('role','authenticated','email',e_cof)::text, true);
    execute 'set local role authenticated';
    select count(*) into n from contract_documents where id = v_doc;
    execute 'reset role'; res := res || ' 7:' || case when n = 1 then 'G' else 'R' end;
  exception when others then execute 'reset role'; res := res || ' 7:R';
  end;

  -- 8 recruiter okur → 0 satır
  begin
    perform set_config('request.jwt.claims', json_build_object('role','authenticated','email',e_rec)::text, true);
    execute 'set local role authenticated';
    select count(*) into n from contract_documents;
    execute 'reset role'; res := res || ' 8:' || case when n = 0 then 'R(0 satır)' else 'G' end;
  exception when others then execute 'reset role'; res := res || ' 8:R';
  end;

  -- 9 cofounder bucket'taki nesneleri listeleyemez (storage politikası yok) → 0 satır
  begin
    perform set_config('request.jwt.claims', json_build_object('role','authenticated','email',e_cof)::text, true);
    execute 'set local role authenticated';
    select count(*) into n from storage.objects where bucket_id = 'contract-pdfs';
    execute 'reset role'; res := res || ' 9:' || case when n = 0 then 'R(0 satır)' else 'G' end;
  exception when others then execute 'reset role'; res := res || ' 9:R';
  end;

  -- 10 geçersiz dosya yolu → R
  begin
    perform set_config('request.jwt.claims', json_build_object('role','service_role')::text, true);
    execute 'set local role service_role';
    insert into contract_documents (acceptance_id, grant_id, storage_path, pdf_sha256, size_bytes)
      values (v_acc, v_g, '../baska.pdf', repeat('e', 64), 1);
    execute 'reset role'; res := res || ' 10:G';
  exception when others then execute 'reset role'; res := res || ' 10:R';
  end;

  raise exception 'SONUC beklenen= 1:G 2:G 3:R 4:R 5:R 6:R 7:G 8:R(0 satır) 9:R(0 satır) 10:R | gerçek=%', res;
end $t$;
rollback;
