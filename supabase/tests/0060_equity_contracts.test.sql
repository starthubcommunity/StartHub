-- TEST — 0060_equity_contracts.sql (KALICI DEĞİŞİKLİK YAPMAZ)
-- Migration uygulandıktan sonra ana projede çalışır; işlem içinde GEÇİCİ bir
-- koltuk + söz oluşturur, senaryoları gerçek rol + JWT ile dener, sonunda
-- bilerek hata fırlatır → her şey geri alınır.
--   npx supabase db query --linked -f supabase/tests/0060_equity_contracts.test.sql
-- Çıktı: "SONUC beklenen=… | gerçek=…"
begin;
do $t$
declare
  e_cof text; e_rec text; v_seat uuid; v_g uuid; v_g2 uuid; v_tpl uuid; v_acc uuid; n int; v int; ph boolean;
  res text := ''; before_cnt int; after_cnt int;
begin
  select lower(email) into e_cof from hub_members where role = 'cofounder' and active limit 1;
  select lower(email) into e_rec from hub_members where role = 'recruiter' and active limit 1;
  if e_rec is null then
    insert into hub_members (email, role, active) values ('recruiter-test@test.invalid', 'recruiter', true);
    e_rec := 'recruiter-test@test.invalid';
  end if;
  select count(*) into before_cnt from equity_grants where status in ('active','left_good','left_bad','removed');
  insert into equity_seats (startup_id, title, seat_kind, budget_pct) values (-1, 'ZZ Test koltuğu', 'member_standard', 10) returning id into v_seat;
  select id into v_tpl from contract_templates where kind = 'member' order by version desc limit 1;

  -- 1 cofounder doğrudan 'active' söz ekler → R
  begin
    perform set_config('request.jwt.claims', json_build_object('role','authenticated','email',e_cof)::text, true);
    execute 'set local role authenticated';
    insert into equity_grants (seat_id, holder_name, holder_email, grant_pct, schedule, vest_months, cliff_months, start_date, status)
      values (v_seat, 'ZZ', 'zz@test.invalid', 5, 'time', 12, 6, current_date, 'active');
    execute 'reset role'; res := res || ' 1:G';
  exception when others then execute 'reset role'; res := res || ' 1:R';
  end;

  -- 2 cofounder taslak söz ekler (varsayılan durum) → G
  begin
    perform set_config('request.jwt.claims', json_build_object('role','authenticated','email',e_cof)::text, true);
    execute 'set local role authenticated';
    insert into equity_grants (seat_id, holder_name, holder_email, grant_pct, schedule, vest_months, cliff_months, start_date)
      values (v_seat, 'ZZ', 'zz@test.invalid', 5, 'time', 12, 6, current_date) returning id into v_g;
    execute 'reset role'; res := res || ' 2:' || case when v_g is not null then 'G' else 'R' end;
  exception when others then execute 'reset role'; res := res || ' 2:R(' || sqlerrm || ')';
  end;

  -- 3 cofounder taslakta yüzdeyi değiştirir (teyit) → G
  begin
    perform set_config('request.jwt.claims', json_build_object('role','authenticated','email',e_cof)::text, true);
    execute 'set local role authenticated';
    update equity_grants set grant_pct = 6 where id = v_g; get diagnostics n = row_count;
    execute 'reset role'; res := res || ' 3:' || case when n = 1 then 'G' else 'R' end;
  exception when others then execute 'reset role'; res := res || ' 3:R';
  end;

  -- 4 cofounder taslağı 'active' yapar → R
  begin
    perform set_config('request.jwt.claims', json_build_object('role','authenticated','email',e_cof)::text, true);
    execute 'set local role authenticated';
    update equity_grants set status = 'active' where id = v_g;
    execute 'reset role'; res := res || ' 4:G';
  exception when others then execute 'reset role'; res := res || ' 4:R';
  end;

  -- 5 cofounder tarayıcıdan 'pending_signature' yapar → R
  begin
    perform set_config('request.jwt.claims', json_build_object('role','authenticated','email',e_cof)::text, true);
    execute 'set local role authenticated';
    update equity_grants set status = 'pending_signature' where id = v_g;
    execute 'reset role'; res := res || ' 5:G';
  exception when others then execute 'reset role'; res := res || ' 5:R';
  end;

  -- 6 sunucu (servis rolü) gönderir → G
  begin
    perform set_config('request.jwt.claims', json_build_object('role','service_role')::text, true);
    execute 'set local role service_role';
    update equity_grants set status = 'pending_signature', contract_template_id = v_tpl, contract_sent_at = now(), contract_sent_by = e_cof where id = v_g;
    get diagnostics n = row_count;
    execute 'reset role'; res := res || ' 6:' || case when n = 1 then 'G' else 'R' end;
  exception when others then execute 'reset role'; res := res || ' 6:R(' || sqlerrm || ')';
  end;

  -- 7 gönderilmiş sözün yüzdesini değiştirmek → R
  begin
    perform set_config('request.jwt.claims', json_build_object('role','authenticated','email',e_cof)::text, true);
    execute 'set local role authenticated';
    update equity_grants set grant_pct = 7 where id = v_g;
    execute 'reset role'; res := res || ' 7:G';
  exception when others then execute 'reset role'; res := res || ' 7:R';
  end;

  -- 8 "Geri çek" (Onay bekliyor → Teyit bekliyor, gönderim izi temizlenir) → G
  begin
    perform set_config('request.jwt.claims', json_build_object('role','authenticated','email',e_cof)::text, true);
    execute 'set local role authenticated';
    update equity_grants set status = 'pending_confirm', contract_template_id = null, contract_sent_at = null, contract_sent_by = null where id = v_g;
    get diagnostics n = row_count;
    execute 'reset role'; res := res || ' 8:' || case when n = 1 then 'G' else 'R' end;
  exception when others then execute 'reset role'; res := res || ' 8:R(' || sqlerrm || ')';
  end;

  -- 9 sunucu: tekrar gönder + kabul kaydı + aktifleştir → G
  begin
    perform set_config('request.jwt.claims', json_build_object('role','service_role')::text, true);
    execute 'set local role service_role';
    update equity_grants set status = 'pending_signature', contract_template_id = v_tpl, contract_sent_at = now() where id = v_g;
    insert into contract_acceptances (grant_id, template_id, template_kind, template_version, holder_email, typed_name, consent, ip, user_agent, text_sha256, text_snapshot, terms)
      values (v_g, v_tpl, 'member', 1, 'zz@test.invalid', 'ZZ Test', true, '127.0.0.1', 'test', repeat('a', 64), 'metin', '{}'::jsonb) returning id into v_acc;
    update equity_grants set status = 'active', signed_at = now(), acceptance_id = v_acc, start_date = current_date where id = v_g;
    get diagnostics n = row_count;
    execute 'reset role'; res := res || ' 9:' || case when n = 1 then 'G' else 'R' end;
  exception when others then execute 'reset role'; res := res || ' 9:R(' || sqlerrm || ')';
  end;

  -- 10 kabul kaydını değiştirmek (servis rolü bile) → R
  begin
    perform set_config('request.jwt.claims', json_build_object('role','service_role')::text, true);
    execute 'set local role service_role';
    update contract_acceptances set typed_name = 'Başka' where id = v_acc;
    execute 'reset role'; res := res || ' 10:G';
  exception when others then execute 'reset role'; res := res || ' 10:R';
  end;

  -- 11 kabul kaydını silmek (servis rolü bile) → R
  begin
    perform set_config('request.jwt.claims', json_build_object('role','service_role')::text, true);
    execute 'set local role service_role';
    delete from contract_acceptances where id = v_acc;
    execute 'reset role'; res := res || ' 11:G';
  exception when others then execute 'reset role'; res := res || ' 11:R';
  end;

  -- 12 imzalanmış sözün yüzdesini değiştirmek → R
  begin
    perform set_config('request.jwt.claims', json_build_object('role','authenticated','email',e_cof)::text, true);
    execute 'set local role authenticated';
    update equity_grants set grant_pct = 9 where id = v_g;
    execute 'reset role'; res := res || ' 12:G';
  exception when others then execute 'reset role'; res := res || ' 12:R';
  end;

  -- 13 sözleşme metnini değiştirmek → R
  begin
    perform set_config('request.jwt.claims', json_build_object('role','authenticated','email',e_cof)::text, true);
    execute 'set local role authenticated';
    update contract_templates set body = body || ' x' where id = v_tpl; get diagnostics n = row_count;
    execute 'reset role'; res := res || ' 13:' || case when n = 0 then 'R(0 satır)' else 'G' end;
  exception when others then execute 'reset role'; res := res || ' 13:R';
  end;

  -- 13b sözleşme metnini servis rolüyle değiştirmek → R
  begin
    perform set_config('request.jwt.claims', json_build_object('role','service_role')::text, true);
    execute 'set local role service_role';
    update contract_templates set body = body || ' x' where id = v_tpl;
    execute 'reset role'; res := res || ' 13b:G';
  exception when others then execute 'reset role'; res := res || ' 13b:R';
  end;

  -- 14 cofounder "YER TUTUCU" içeren yeni sürüm yayınlar → G, sürüm 2, yer tutucu
  begin
    perform set_config('request.jwt.claims', json_build_object('role','authenticated','email',e_cof)::text, true);
    execute 'set local role authenticated';
    insert into contract_templates (kind, version, title, body) values ('member', 99, 'T', 'YER TUTUCU deneme metni yirmi karakter') returning version, is_placeholder into v, ph;
    execute 'reset role'; res := res || ' 14:' || case when v = 2 and ph then 'G' else 'R(v=' || v || ')' end;
  exception when others then execute 'reset role'; res := res || ' 14:R(' || sqlerrm || ')';
  end;

  -- 15 recruiter yeni sürüm yayınlar → R
  begin
    perform set_config('request.jwt.claims', json_build_object('role','authenticated','email',e_rec)::text, true);
    execute 'set local role authenticated';
    insert into contract_templates (kind, version, title, body) values ('member', 1, 'T', 'gerçek metin yirmi karakterden uzun');
    execute 'reset role'; res := res || ' 15:G';
  exception when others then execute 'reset role'; res := res || ' 15:R';
  end;

  -- 16 cofounder test adresi listesini değiştirir → R
  begin
    perform set_config('request.jwt.claims', json_build_object('role','authenticated','email',e_cof)::text, true);
    execute 'set local role authenticated';
    update contract_settings set test_emails = array['baska@ornek.com'] where id = 1;
    execute 'reset role'; res := res || ' 16:G';
  exception when others then execute 'reset role'; res := res || ' 16:R';
  end;

  -- 17 recruiter canlıya açar → R (0 satır)
  begin
    perform set_config('request.jwt.claims', json_build_object('role','authenticated','email',e_rec)::text, true);
    execute 'set local role authenticated';
    update contract_settings set test_mode = false where id = 1; get diagnostics n = row_count;
    execute 'reset role'; res := res || ' 17:' || case when n = 0 then 'R(0 satır)' else 'G' end;
  exception when others then execute 'reset role'; res := res || ' 17:R';
  end;

  -- 18 cofounder canlıya açar → G, kim/ne zaman yazılır
  begin
    perform set_config('request.jwt.claims', json_build_object('role','authenticated','email',e_cof)::text, true);
    execute 'set local role authenticated';
    update contract_settings set test_mode = false where id = 1; get diagnostics n = row_count;
    execute 'reset role';
    select count(*) into n from contract_settings where id = 1 and not test_mode and live_enabled_by = e_cof and live_enabled_at is not null;
    res := res || ' 18:' || case when n = 1 then 'G' else 'R' end;
  exception when others then execute 'reset role'; res := res || ' 18:R(' || sqlerrm || ')';
  end;

  -- 19 recruiter kabul kayıtlarını okur → 0 satır
  begin
    perform set_config('request.jwt.claims', json_build_object('role','authenticated','email',e_rec)::text, true);
    execute 'set local role authenticated';
    select count(*) into n from contract_acceptances;
    execute 'reset role'; res := res || ' 19:' || case when n = 0 then 'R(0 satır)' else 'G' end;
  exception when others then execute 'reset role'; res := res || ' 19:R';
  end;

  -- 20 taslak sözü vazgeçip kapatmak (Teyit bekliyor → removed, 0 pay) → G
  begin
    perform set_config('request.jwt.claims', json_build_object('role','authenticated','email',e_cof)::text, true);
    execute 'set local role authenticated';
    insert into equity_grants (seat_id, holder_name, holder_email, grant_pct, schedule, vest_months, cliff_months, start_date)
      values (v_seat, 'ZZ2', 'zz2@test.invalid', 2, 'time', 12, 6, current_date) returning id into v_g2;
    update equity_grants set status = 'removed', ended_at = current_date, vested_at_end = 0 where id = v_g2;
    get diagnostics n = row_count;
    execute 'reset role'; res := res || ' 20:' || case when n = 1 then 'G' else 'R' end;
  exception when others then execute 'reset role'; res := res || ' 20:R(' || sqlerrm || ')';
  end;

  -- 21 mevcut (eski) sözler etkilenmedi
  select count(*) into after_cnt from equity_grants where status in ('active','left_good','left_bad','removed') and seat_id <> v_seat;
  res := res || ' 21:' || case when after_cnt = before_cnt then 'G' else 'R(' || before_cnt || '→' || after_cnt || ')' end;

  raise exception 'SONUC beklenen= 1:R 2:G 3:G 4:R 5:R 6:G 7:R 8:G 9:G 10:R 11:R 12:R 13:R(0 satır) 13b:R 14:G 15:R 16:R 17:R(0 satır) 18:G 19:R(0 satır) 20:G 21:G | gerçek=%', res;
end $t$;
rollback;
