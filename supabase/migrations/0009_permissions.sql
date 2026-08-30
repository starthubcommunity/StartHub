-- ══════════════════════════════════════════════════════════
-- 0009_permissions.sql — arayüzden tam yönetilen yetki sistemi
-- 0008_admin_rls.sql'in YERİNE geçer (0008 YAZILMADI/ÇALIŞTIRILMADI).
-- Rol = başlangıç şablonu; kişi bazlı istisna üstüne yazılır.
-- Tekrarlanabilir: politikalar drop-if-exists ile.
--
-- ⚠️  app_state ve notifications'a DOKUNULMADI — /team/ kullanıyor.
-- ⚠️  Storage (post-images kovası) politikaları AYRI dosyada, elle incelenecek:
--     supabase/storage-policies-REVIEW.sql
-- ══════════════════════════════════════════════════════════

-- ── Katalog: yetki anahtarları ───────────────────────────────
-- NOT: `members.manage` ve `settings.write` her iki alanda da var; bu yüzden
-- PK (area, key) — verilen taslaktaki tek-kolon PK yerine.
create table if not exists permission_keys (
  area        text not null check (area in ('admin','hub')),
  key         text not null,
  grp         text not null,
  label       text not null,
  description text,
  sort_order  int not null default 0,
  primary key (area, key)
);

create table if not exists permission_presets (
  area text not null,
  role text not null,
  key  text not null,
  primary key (area, role, key),
  foreign key (area, key) references permission_keys(area, key) on delete cascade
);

alter table admin_members add column if not exists permissions jsonb not null default '{}';
alter table hub_members   add column if not exists permissions jsonb not null default '{}';

create table if not exists permission_log (
  id         uuid primary key default gen_random_uuid(),
  area       text not null,
  actor_id   uuid,
  member_id  uuid not null,
  key        text not null,
  old_value  boolean,
  new_value  boolean,
  created_at timestamptz not null default now()
);

-- ── Katalog seed ─────────────────────────────────────────────
insert into permission_keys (area, key, grp, label, sort_order) values
  ('admin','posts.read','İçerik','Yazıları görüntüle',10),
  ('admin','posts.write','İçerik','Yazı oluştur / düzenle',11),
  ('admin','posts.publish','İçerik','Yazı yayınla',12),
  ('admin','posts.delete','İçerik','Yazı sil',13),
  ('admin','projects.read','Projeler','Projeleri görüntüle',20),
  ('admin','projects.write','Projeler','Proje oluştur / düzenle',21),
  ('admin','people.read','Kişiler','Kişileri görüntüle',30),
  ('admin','people.write','Kişiler','Kişi oluştur / düzenle',31),
  ('admin','sponsors.read','Destekçiler','Destekçileri görüntüle',40),
  ('admin','sponsors.write','Destekçiler','Destekçi oluştur / düzenle',41),
  ('admin','events.read','Etkinlikler','Etkinlikleri görüntüle',50),
  ('admin','events.write','Etkinlikler','Etkinlik oluştur / düzenle',51),
  ('admin','applications.read','Başvurular','Başvuruları görüntüle',60),
  ('admin','applications.write','Başvurular','Başvuru durumu değiştir / sil',61),
  ('admin','analytics.read','Analitik','Analitiği görüntüle',70),
  ('admin','automation.read','Otomasyon','Otomasyonu görüntüle',80),
  ('admin','automation.run','Otomasyon','Otomasyon çalıştır',81),
  ('admin','media.upload','Medya','Görsel yükle',90),
  ('admin','media.delete','Medya','Görsel sil',91),
  ('admin','trash.read','Çöp kutusu','Son silinenleri görüntüle',100),
  ('admin','trash.restore','Çöp kutusu','Silineni geri yükle',101),
  ('admin','trash.purge','Çöp kutusu','Kalıcı sil',102),
  ('admin','settings.write','Ayarlar','Site ayarlarını değiştir',110),
  ('admin','members.manage','Üyeler','Üye ve yetki yönetimi',120),
  ('hub','candidates.read','Adaylar','Adayları görüntüle',10),
  ('hub','candidates.read_all','Adaylar','Tüm aday havuzunu görür',11),
  ('hub','candidates.write','Adaylar','Aday oluştur / düzenle',12),
  ('hub','candidates.archive','Adaylar','Aday arşivle',13),
  ('hub','candidates.purge','Adaylar','Adayı tamamen sil (KVKK)',14),
  ('hub','stage.advance','Hat','Aşama ilerlet',20),
  ('hub','interview.score','Hat','Rubrik puanla',21),
  ('hub','flags.override','Hat','Kırmızı bayrak override',22),
  ('hub','roles.read','Roller','Rolleri görüntüle',30),
  ('hub','roles.create','Roller','Rol oluştur / talep gönder',31),
  ('hub','roles.assign','Roller','Rol üstlen / ata',32),
  ('hub','roles.close','Roller','Rol kapat / dondur',33),
  ('hub','present','Karar','Proje sahibine sun',40),
  ('hub','decide','Karar','Kabul / ret ver',41),
  ('hub','templates.read','Şablonlar','Şablonları görüntüle',50),
  ('hub','templates.manage','Şablonlar','Şablon oluştur / düzenle',51),
  ('hub','sources.read','Kaynaklar','Kaynak kütüğünü görüntüle',60),
  ('hub','sources.manage','Kaynaklar','Kaynak ekle / düzenle',61),
  ('hub','scan.run','Kaynaklar','GitHub taraması çalıştır',62),
  ('hub','import.run','Kaynaklar','İçe aktarma çalıştır',63),
  ('hub','metrics.read','Metrikler','Metrikleri görüntüle',70),
  ('hub','members.manage','Üyeler','Üye ve yetki yönetimi',80),
  ('hub','settings.write','Ayarlar','Hub ayarlarını değiştir',90)
on conflict (area, key) do nothing;

-- ── Şablon seed ──────────────────────────────────────────────
-- admin/admin ve hub/cofounder → hepsi
insert into permission_presets (area, role, key)
  select 'admin','admin',key from permission_keys where area='admin'
on conflict do nothing;
insert into permission_presets (area, role, key)
  select 'hub','cofounder',key from permission_keys where area='hub'
on conflict do nothing;

-- admin/editor
insert into permission_presets (area, role, key) values
  ('admin','editor','posts.read'),('admin','editor','posts.write'),
  ('admin','editor','posts.publish'),('admin','editor','people.read'),
  ('admin','editor','projects.read'),('admin','editor','sponsors.read'),
  ('admin','editor','events.read'),('admin','editor','analytics.read'),
  ('admin','editor','media.upload')
on conflict do nothing;

-- hub/recruiter → decide, flags.override, members.manage, settings.write,
--                 candidates.purge HARİÇ hepsi
insert into permission_presets (area, role, key)
  select 'hub','recruiter',key from permission_keys
   where area='hub'
     and key not in ('decide','flags.override','members.manage','settings.write','candidates.purge')
on conflict do nothing;

-- hub/project_owner — candidates.read VAR ama candidates.read_all YOK:
-- yalnızca kendi projesine SUNULMUŞ adayı görür (§12.7, hc_read politikası).
insert into permission_presets (area, role, key) values
  ('hub','project_owner','candidates.read'),('hub','project_owner','interview.score'),
  ('hub','project_owner','roles.read'),('hub','project_owner','roles.create'),
  ('hub','project_owner','decide'),('hub','project_owner','metrics.read')
on conflict do nothing;

-- ── Fonksiyonlar ─────────────────────────────────────────────
-- Etkin yetki = şablon ∪ istisna. İstisna varsa o kazanır.
create or replace function has_perm(p_key text) returns boolean
language sql stable security definer set search_path = public, auth as $$
  with me as (
    select 'admin' as area, role, permissions from admin_members
     where active and (user_id = auth.uid()
                       or lower(email) = lower(coalesce(auth.jwt() ->> 'email','')))
    union all
    select 'hub', role, permissions from hub_members
     where active and (user_id = auth.uid()
                       or lower(email) = lower(coalesce(auth.jwt() ->> 'email','')))
  )
  select coalesce(bool_or(
    case
      when me.permissions ? p_key then (me.permissions ->> p_key)::boolean
      else exists (select 1 from permission_presets pp
                    where pp.area = me.area and pp.role = me.role and pp.key = p_key)
    end
  ), false)
  from me;
$$;

-- Giriş yapan kullanıcının tüm etkin yetkileri (arayüz menüyü buna göre çizer)
create or replace function my_permissions()
returns table(area text, key text, granted boolean, overridden boolean)
language sql stable security definer set search_path = public, auth as $$
  with me as (
    select 'admin'::text as area, role, permissions from admin_members
     where active and (user_id = auth.uid()
                       or lower(email) = lower(coalesce(auth.jwt() ->> 'email','')))
    union all
    select 'hub', role, permissions from hub_members
     where active and (user_id = auth.uid()
                       or lower(email) = lower(coalesce(auth.jwt() ->> 'email','')))
  )
  select me.area, pk.key,
    case when me.permissions ? pk.key then (me.permissions ->> pk.key)::boolean
         else exists (select 1 from permission_presets pp
                       where pp.area = me.area and pp.role = me.role and pp.key = pk.key)
    end as granted,
    (me.permissions ? pk.key) as overridden
  from me join permission_keys pk on pk.area = me.area;
$$;

-- Bir üyenin etkin yetki listesi (Yetkiler ekranı sağ panel)
create or replace function effective_permissions(p_area text, p_member uuid)
returns table(key text, granted boolean, overridden boolean)
language sql stable security definer set search_path = public as $$
  with m as (
    select role, permissions from admin_members where p_area = 'admin' and id = p_member
    union all
    select role, permissions from hub_members where p_area = 'hub' and id = p_member
  )
  select pk.key,
    case when m.permissions ? pk.key then (m.permissions ->> pk.key)::boolean
         else exists (select 1 from permission_presets pp
                       where pp.area = p_area and pp.role = m.role and pp.key = pk.key)
    end as granted,
    (m.permissions ? pk.key) as overridden
  from permission_keys pk cross join m
  where pk.area = p_area
  order by pk.sort_order, pk.key;
$$;

-- Bir adayı görme hakkı (§12.7): candidates.read_all olan HERKESİ görür;
-- yoksa yalnızca KENDİ projesine SUNULMUŞ adayı. hub_candidates ve tüm
-- alt kayıt tabloları (stage_log, touches, interviews, gates) bunu kullanır.
create or replace function hub_sees_candidate(p_cand uuid) returns boolean
language sql stable security definer set search_path = public, auth as $$
  select has_perm('candidates.read_all')
     or exists (
       select 1 from hub_candidates c
        where c.id = p_cand
          and c.presented_at is not null
          and c.startup_id is not null
          and c.startup_id = any (hub_my_startups())
     );
$$;

-- ── Kilitlenme koruması + günlük (VERİTABANI SEVİYESİNDE) ─────
create or replace function guard_member_change() returns trigger
language plpgsql security definer set search_path = public, auth as $$
declare
  v_area   text := tg_argv[0];
  v_email  text := lower(coalesce(auth.jwt() ->> 'email',''));
  v_self   boolean;
  v_old_m  boolean;
  v_new_m  boolean;
  v_others int;
begin
  v_self := (new.user_id is not null and new.user_id = auth.uid())
            or (v_email <> '' and lower(new.email) = v_email);

  v_old_m := case when old.permissions ? 'members.manage'
                  then (old.permissions ->> 'members.manage')::boolean
                  else exists(select 1 from permission_presets pp
                               where pp.area=v_area and pp.role=old.role and pp.key='members.manage') end;
  v_new_m := case when new.permissions ? 'members.manage'
                  then (new.permissions ->> 'members.manage')::boolean
                  else exists(select 1 from permission_presets pp
                               where pp.area=v_area and pp.role=new.role and pp.key='members.manage') end;

  -- 1. Kendi members.manage yetkini kaldıramazsın
  if v_self and v_old_m and not v_new_m then
    raise exception 'Kendi üye yönetimi yetkini kaldıramazsın.';
  end if;
  -- 2. Kendi hesabını pasifleştiremezsin
  if v_self and old.active and not new.active then
    raise exception 'Kendi hesabını pasifleştiremezsin.';
  end if;
  -- 3. Her alanda en az bir aktif üye yöneticisi kalmalı
  if (v_old_m and not v_new_m) or (v_old_m and old.active and not new.active) then
    if v_area = 'admin' then
      select count(*) into v_others from admin_members o
       where o.active and o.id <> old.id
         and (case when o.permissions ? 'members.manage' then (o.permissions ->> 'members.manage')::boolean
                   else exists(select 1 from permission_presets pp where pp.area='admin' and pp.role=o.role and pp.key='members.manage') end);
    else
      select count(*) into v_others from hub_members o
       where o.active and o.id <> old.id
         and (case when o.permissions ? 'members.manage' then (o.permissions ->> 'members.manage')::boolean
                   else exists(select 1 from permission_presets pp where pp.area='hub' and pp.role=o.role and pp.key='members.manage') end);
    end if;
    if v_others = 0 then
      raise exception 'Son üye yöneticisini düşüremezsin — her alanda en az bir aktif yönetici kalmalı.';
    end if;
  end if;

  return new;
end $$;

create or replace function log_member_perm_change() returns trigger
language plpgsql security definer set search_path = public, auth as $$
declare
  v_area text := tg_argv[0];
  k text;
  vo boolean; vn boolean;
begin
  if new.permissions is distinct from old.permissions then
    for k in
      select x from (select jsonb_object_keys(old.permissions) x
                     union select jsonb_object_keys(new.permissions)) s
    loop
      vo := case when old.permissions ? k then (old.permissions ->> k)::boolean else null end;
      vn := case when new.permissions ? k then (new.permissions ->> k)::boolean else null end;
      if vo is distinct from vn then
        insert into permission_log(area, actor_id, member_id, key, old_value, new_value)
        values (v_area, auth.uid(), new.id, k, vo, vn);
      end if;
    end loop;
  end if;
  return null;
end $$;

drop trigger if exists admin_members_guard on admin_members;
drop trigger if exists hub_members_guard   on hub_members;
drop trigger if exists admin_members_permlog on admin_members;
drop trigger if exists hub_members_permlog   on hub_members;
create trigger admin_members_guard before update on admin_members
  for each row execute function guard_member_change('admin');
create trigger hub_members_guard before update on hub_members
  for each row execute function guard_member_change('hub');
create trigger admin_members_permlog after update on admin_members
  for each row execute function log_member_perm_change('admin');
create trigger hub_members_permlog after update on hub_members
  for each row execute function log_member_perm_change('hub');

-- ══════════════════════════════════════════════════════════
-- RLS — hepsi has_perm() üzerinden (rol adı kontrolü YOK)
-- ══════════════════════════════════════════════════════════
alter table permission_keys    enable row level security;
alter table permission_presets enable row level security;
alter table permission_log     enable row level security;
drop policy if exists permkeys_read    on permission_keys;
drop policy if exists permpresets_read on permission_presets;
drop policy if exists permlog_read     on permission_log;
create policy permkeys_read    on permission_keys    for select using (auth.role() = 'authenticated');
create policy permpresets_read on permission_presets for select using (auth.role() = 'authenticated');
create policy permlog_read     on permission_log     for select using (has_perm('members.manage'));

-- ── Katalog / üye tabloları ─────────────────────────────────
alter table admin_members enable row level security;
alter table hub_members   enable row level security;
drop policy if exists adm_read  on admin_members;
drop policy if exists adm_write on admin_members;
drop policy if exists hub_members_read  on hub_members;
drop policy if exists hub_members_write on hub_members;
create policy adm_read  on admin_members for select using (is_admin_member());
create policy adm_write on admin_members for all
  using (has_perm('members.manage')) with check (has_perm('members.manage'));
create policy hub_members_read  on hub_members for select using (is_hub_member());
create policy hub_members_write on hub_members for all
  using (has_perm('members.manage')) with check (has_perm('members.manage'));

-- ── Admin içerik tabloları ──────────────────────────────────
-- Site anon anahtarıyla besleniyor → SELECT herkese açık kalır. X.read izni
-- MENÜ görünürlüğünü belirler, satır okumasını DEĞİL (gatelenirse site kararır).
alter table posts        enable row level security;
alter table people       enable row level security;
alter table startups     enable row level security;
alter table sponsors     enable row level security;
alter table events       enable row level security;
alter table applications enable row level security;

drop policy if exists pub_read_posts    on posts;
drop policy if exists pub_read_people   on people;
drop policy if exists pub_read_startups on startups;
drop policy if exists pub_read_sponsors on sponsors;
drop policy if exists pub_read_events   on events;
drop policy if exists posts_write  on posts;
drop policy if exists posts_delete on posts;
drop policy if exists people_write   on people;
drop policy if exists startups_write on startups;
drop policy if exists sponsors_write on sponsors;
drop policy if exists events_write   on events;
drop policy if exists apps_read on applications;
drop policy if exists apps_insert on applications;
drop policy if exists apps_write on applications;
-- eski (0001 / 0006 / 0008) politika adları da temizlensin
drop policy if exists adm_write_posts on posts;
drop policy if exists adm_write_people on people;
drop policy if exists adm_write_startups on startups;
drop policy if exists adm_write_sponsors on sponsors;
drop policy if exists adm_write_events on events;
drop policy if exists editor_insert_posts on posts;
drop policy if exists editor_update_posts on posts;
drop policy if exists adm_read_apps on applications;
drop policy if exists pub_insert_apps on applications;
drop policy if exists adm_update_apps on applications;
drop policy if exists adm_delete_apps on applications;

create policy pub_read_posts    on posts    for select using (true);
create policy pub_read_people   on people   for select using (true);
create policy pub_read_startups on startups for select using (true);
create policy pub_read_sponsors on sponsors for select using (true);
create policy pub_read_events   on events   for select using (true);

create policy posts_write  on posts for insert with check (has_perm('posts.write'));
create policy posts_update on posts for update using (has_perm('posts.write')) with check (has_perm('posts.write'));
create policy posts_delete on posts for delete using (has_perm('posts.delete'));
create policy people_write   on people   for all using (has_perm('people.write'))   with check (has_perm('people.write'));
create policy startups_write on startups for all using (has_perm('projects.write')) with check (has_perm('projects.write'));
create policy sponsors_write on sponsors for all using (has_perm('sponsors.write')) with check (has_perm('sponsors.write'));
create policy events_write   on events   for all using (has_perm('events.write'))   with check (has_perm('events.write'));

create policy apps_read   on applications for select using (has_perm('applications.read'));
create policy apps_insert on applications for insert with check (true);
create policy apps_write  on applications for update using (has_perm('applications.write')) with check (has_perm('applications.write'));
create policy apps_delete on applications for delete using (has_perm('applications.write'));

-- ── Hub tabloları — 0001/0006 politikalarının YERİNE ────────
alter table hub_candidates enable row level security;
alter table hub_stage_log  enable row level security;
alter table hub_touches    enable row level security;
alter table hub_interviews enable row level security;
alter table hub_gates      enable row level security;
alter table hub_templates  enable row level security;
alter table hub_views      enable row level security;
alter table hub_open_roles enable row level security;
alter table hub_source_registry enable row level security;
alter table hub_import_batches  enable row level security;
alter table hub_role_log   enable row level security;

do $$
declare p text;
begin
  foreach p in array array[
    'hub_cand_read','hub_cand_write','hub_log_all','hub_touch_all','hub_int_all',
    'hub_gate_all','hub_view_all','hub_role_all','hub_srcreg_all','hub_batch_all',
    'hub_tpl_read','hub_tpl_write','hub_rolelog_all'
  ] loop
    execute format('drop policy if exists %I on hub_candidates', p);
    execute format('drop policy if exists %I on hub_stage_log', p);
    execute format('drop policy if exists %I on hub_touches', p);
    execute format('drop policy if exists %I on hub_interviews', p);
    execute format('drop policy if exists %I on hub_gates', p);
    execute format('drop policy if exists %I on hub_templates', p);
    execute format('drop policy if exists %I on hub_views', p);
    execute format('drop policy if exists %I on hub_open_roles', p);
    execute format('drop policy if exists %I on hub_source_registry', p);
    execute format('drop policy if exists %I on hub_import_batches', p);
    execute format('drop policy if exists %I on hub_role_log', p);
  end loop;
end $$;

-- yeni politika adları da drop-if-exists (tekrar çalıştırılabilirlik)
do $$
declare p text; t text;
begin
  foreach p in array array[
    'hc_read','hc_write','hc_update','hc_delete','hsl_read','hsl_ins',
    'ht_read','ht_write','hi_read','hi_write','hg_read','hg_write','hv_all',
    'hr_read','hr_ins','hr_update','hr_delete','hrl_read','hrl_ins',
    'htpl_read','htpl_write','hsrc_read','hsrc_write','hib_read','hib_ins',
    'ht_all','hi_all','hg_all'
  ] loop
    foreach t in array array[
      'hub_candidates','hub_stage_log','hub_touches','hub_interviews','hub_gates',
      'hub_views','hub_open_roles','hub_role_log','hub_templates',
      'hub_source_registry','hub_import_batches'
    ] loop
      execute format('drop policy if exists %I on %I', p, t);
    end loop;
  end loop;
end $$;

-- ── Adaylar — §12.7: proje sahibi yalnızca KENDİ projesine SUNULMUŞ adayı ──
-- candidates.read_all → tüm havuz (cofounder/recruiter).
create policy hc_read on hub_candidates for select using (
  has_perm('candidates.read_all')
  or (
    has_perm('candidates.read')
    and presented_at is not null
    and startup_id is not null
    and startup_id = any (hub_my_startups())
  )
);
create policy hc_write  on hub_candidates for insert with check (has_perm('candidates.write'));
-- Güncelleme: candidates.write olan her şeyi; proje sahibi (decide) yalnızca
-- kendi projesine sunulmuş adayı (owner_decision / gerekçe yazabilsin — 0006).
create policy hc_update on hub_candidates for update
  using (
    has_perm('candidates.write')
    or (has_perm('decide') and presented_at is not null
        and startup_id is not null and startup_id = any (hub_my_startups()))
  )
  with check (
    has_perm('candidates.write')
    or (has_perm('decide') and startup_id is not null
        and startup_id = any (hub_my_startups()))
  );
create policy hc_delete on hub_candidates for delete using (has_perm('candidates.purge'));

-- Alt kayıtlar aday görünürlüğünü izler (hub_sees_candidate).
create policy hsl_read on hub_stage_log for select
  using (has_perm('candidates.read') and hub_sees_candidate(candidate_id));
create policy hsl_ins  on hub_stage_log for insert with check (has_perm('stage.advance'));

create policy ht_read  on hub_touches for select
  using (has_perm('candidates.read') and hub_sees_candidate(candidate_id));
create policy ht_write on hub_touches for all
  using (has_perm('candidates.write') and hub_sees_candidate(candidate_id))
  with check (has_perm('candidates.write') and hub_sees_candidate(candidate_id));

create policy hi_read  on hub_interviews for select
  using (has_perm('interview.score') and hub_sees_candidate(candidate_id));
create policy hi_write on hub_interviews for all
  using (has_perm('interview.score') and hub_sees_candidate(candidate_id))
  with check (has_perm('interview.score') and hub_sees_candidate(candidate_id));

create policy hg_read  on hub_gates for select
  using (has_perm('candidates.read') and hub_sees_candidate(candidate_id));
create policy hg_write on hub_gates for all
  using (has_perm('stage.advance') and hub_sees_candidate(candidate_id))
  with check (has_perm('stage.advance') and hub_sees_candidate(candidate_id));

create policy hv_all on hub_views for all using (has_perm('candidates.read')) with check (has_perm('candidates.read'));

create policy hr_read   on hub_open_roles for select using (has_perm('roles.read'));
create policy hr_ins    on hub_open_roles for insert with check (has_perm('roles.create'));
create policy hr_update on hub_open_roles for update
  using (has_perm('roles.assign') or has_perm('roles.close') or has_perm('roles.create'))
  with check (has_perm('roles.assign') or has_perm('roles.close') or has_perm('roles.create'));
create policy hr_delete on hub_open_roles for delete using (has_perm('roles.close'));

create policy hrl_read on hub_role_log for select using (has_perm('roles.read'));
create policy hrl_ins  on hub_role_log for insert with check (has_perm('roles.assign') or has_perm('roles.close') or has_perm('roles.create'));

create policy htpl_read  on hub_templates for select using (has_perm('templates.read'));
create policy htpl_write on hub_templates for all using (has_perm('templates.manage')) with check (has_perm('templates.manage'));

create policy hsrc_read  on hub_source_registry for select using (has_perm('sources.read'));
create policy hsrc_write on hub_source_registry for all using (has_perm('sources.manage')) with check (has_perm('sources.manage'));

create policy hib_read on hub_import_batches for select using (has_perm('candidates.read'));
create policy hib_ins  on hub_import_batches for insert with check (has_perm('import.run'));
