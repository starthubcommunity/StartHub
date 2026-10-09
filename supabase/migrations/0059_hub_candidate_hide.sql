-- ══════════════════════════════════════════════════════════
-- 0059_hub_candidate_hide.sql — adayı silmeden, geri alınabilir gizleme
-- ══════════════════════════════════════════════════════════
-- Kullanıcı kararı (2026-10-09): test kayıtları ("asd", "TEST Aday Kapi A"…)
-- silinmez; cofounder ekrandan "Gizle" der, istediği an "Gizlemeyi kaldır".
-- Gizli aday HR'ın Bugün / Adaylar / Metrikler / Pay Sözleri listelerinde
-- görünmez. YALNIZCA EKLEME: mevcut satır, aşama ve kural değişmez.
--
-- Yetki: yeni 'candidates.hide' (yalnızca cofounder).
--  • Gizleme alanlarını yalnızca bu yetkiye sahip olan değiştirebilir
--    (tetikleyici; servis rolü / panel etkilenmez).
--  • Gizli satırları yalnızca bu yetkiye sahip olan OKUYABİLİR: mevcut
--    hc_read'e ek, KISITLAYICI (restrictive) bir SELECT kuralı — recruiter
--    gizli adayı ne görür ne geri getirir. Mükerrer koruması yine çalışır:
--    hub_cand_email_uq (lower(email)) aynı e-postanın tekrar eklenmesini
--    veritabanında reddeder.

alter table hub_candidates
  add column if not exists hidden_at     timestamptz,
  add column if not exists hidden_reason text check (hidden_reason in ('test','duplicate','other')),
  add column if not exists hidden_by     text;

insert into permission_keys (area, key, grp, label, sort_order) values
  ('hub','candidates.hide','Adaylar','Adayı gizle / gizlemeyi kaldır (test kaydı vb.)',15)
on conflict (area, key) do nothing;
insert into permission_presets (area, role, key) values ('hub','cofounder','candidates.hide')
on conflict do nothing;

create policy hc_hidden_read on hub_candidates as restrictive for select
  using (hidden_at is null or has_perm('candidates.hide'));

create or replace function hub_candidates_hide_guard() returns trigger
language plpgsql security definer set search_path = public, auth as $$
begin
  if coalesce(auth.role(), '') <> 'authenticated' then return new; end if;
  if (new.hidden_at, new.hidden_reason, new.hidden_by) is distinct from (old.hidden_at, old.hidden_reason, old.hidden_by)
     and not has_perm('candidates.hide') then
    raise exception 'Adayı gizleme yetkin yok' using errcode = '42501';
  end if;
  return new;
end $$;

drop trigger if exists hub_candidates_hide_guard on hub_candidates;
create trigger hub_candidates_hide_guard before update on hub_candidates
  for each row execute function hub_candidates_hide_guard();

-- Yeni satırda gizleme alanları dolu gelemez (yalnızca güncellemeyle gizlenir).
create or replace function hub_candidates_hide_insert_guard() returns trigger
language plpgsql as $$
begin
  if coalesce(auth.role(), '') = 'authenticated' and new.hidden_at is not null and not has_perm('candidates.hide') then
    raise exception 'Adayı gizleme yetkin yok' using errcode = '42501';
  end if;
  return new;
end $$;
drop trigger if exists hub_candidates_hide_insert_guard on hub_candidates;
create trigger hub_candidates_hide_insert_guard before insert on hub_candidates
  for each row execute function hub_candidates_hide_insert_guard();
