-- ══════════════════════════════════════════════════════════
-- 0036_inbound_crm.sql — HR: Inbound / Outbound ayrımı
-- ══════════════════════════════════════════════════════════
-- Karar (2026-09-21): web formundan gelen başvurular artık Outbound aday
-- havuzuna (hub_candidates) DÜŞMEZ. Inbound kendi hattıdır: `applications`
-- tablosu doğrudan CRM kaydıdır (aşama, sahip, puan, not/aktivite).
--
-- 1) 0022/0033/0035 tetikleyicisi (applications → hub_candidates) kapatıldı.
--    Fonksiyon geçmiş için yerinde bırakıldı, hiçbir yerden çağrılmıyor.
--    MEVCUT hub_candidates kayıtlarına DOKUNULMAZ (silme yok) — arayüz,
--    aşaması hâlâ 'pool' olan eski inbound adayları Outbound'dan gizler;
--    ilerlemiş olanlar (temas/görüşme/…) Outbound'da görünmeye devam eder.
-- 2) applications: CRM kolonları (drop yok, hepsi nullable/varsayılanlı).
--    Aşama `status` kolonunda tutulur (eski panel/Hub kodu zaten burayı
--    okuyor): new · reviewed · interview · waitlist · accepted · rejected.
--    Eski değerler (new/reviewed/accepted/rejected) aynen geçerli.
-- 3) `status` üzerinde daha önce elle tanımlanmış bir CHECK varsa yeni
--    aşamaları (interview, waitlist) engellemesin diye kaldırılır.
-- Idempotent.

drop trigger if exists applications_to_hub_candidate_trg on applications;

alter table applications
  add column if not exists status           text default 'new',
  add column if not exists owner_email      text,
  add column if not exists stage_changed_at timestamptz,
  add column if not exists last_contact_at  timestamptz,
  add column if not exists rating           smallint,
  add column if not exists activity         jsonb not null default '[]'::jsonb;  -- [{at,by,type,text,from,to}]

do $$
declare c record;
begin
  for c in
    select conname from pg_constraint
    where conrelid = 'public.applications'::regclass
      and contype = 'c'
      and pg_get_constraintdef(oid) ilike '%status%'
  loop
    execute format('alter table public.applications drop constraint %I', c.conname);
  end loop;

  if not exists (select 1 from pg_constraint where conname = 'applications_rating_range') then
    alter table public.applications
      add constraint applications_rating_range check (rating is null or rating between 1 and 5);
  end if;
end $$;

create index if not exists applications_status_created_idx on applications (status, created_at desc);
