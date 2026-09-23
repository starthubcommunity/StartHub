-- ══════════════════════════════════════════════════════════
-- 0035_join_hub_lab.sql — Katıl sayfası HUB / LAB olarak ikiye ayrıldı
-- ══════════════════════════════════════════════════════════
-- 1) join_form_settings: HUB/LAB kart metinleri, kulüp ekip alanları (admin
--    panelden düzenlenir) ve başvuru sonrası çıkan bağlantılar
--    (WhatsApp / Instagram / LinkedIn) için kolonlar.
--    Tablo daha önce panelden elle kurulmuştu (migration'da yoktu) — bu yüzden
--    `if not exists` ile hem kurulu hem sıfır ortamı kapsıyor.
-- 2) applications_to_hub_candidate(): iki yeni intent —
--      club_team  (HUB › ekip üyesi; role = ekip alanı adı)
--      pool_match (LAB › ilgi alanına göre eşleşme havuzu)
--    ve why_this_one başına "Hub · …" / "Lab · …" kaynak etiketi.
--    applications tablosuna YENİ KOLON YOK — intent + role yeterli, böylece
--    bu migration uygulanmadan da form çalışır.
-- Idempotent; drop column yok.

create table if not exists join_form_settings (
  id         int primary key default 1,
  updated_at timestamptz default now()
);

alter table join_form_settings
  add column if not exists hero_title_tr            text,
  add column if not exists hero_title_en            text,
  add column if not exists hero_desc_tr             text,
  add column if not exists hero_desc_en             text,
  add column if not exists community_card_title_tr  text,
  add column if not exists community_card_desc_tr   text,
  add column if not exists mentor_card_title_tr     text,
  add column if not exists mentor_card_desc_tr      text,
  add column if not exists sponsor_card_title_tr    text,
  add column if not exists sponsor_card_desc_tr     text,
  add column if not exists field_labels             jsonb default '{}'::jsonb,
  -- v3.2 — HUB / LAB
  add column if not exists hub_card_title_tr        text,
  add column if not exists hub_card_desc_tr         text,
  add column if not exists lab_card_title_tr        text,
  add column if not exists lab_card_desc_tr         text,
  add column if not exists team_areas               jsonb,   -- [{key,label,label_en,desc,icon,active}]
  add column if not exists hub_whatsapp_url         text,
  add column if not exists hub_instagram_url        text,
  add column if not exists lab_whatsapp_url         text,
  add column if not exists lab_linkedin_url         text,
  add column if not exists hub_success_note_tr      text,
  add column if not exists lab_success_note_tr      text;

insert into join_form_settings (id) values (1) on conflict (id) do nothing;

alter table join_form_settings enable row level security;

do $$
begin
  if not exists (select 1 from pg_policies
                 where schemaname = 'public' and tablename = 'join_form_settings'
                   and cmd in ('SELECT', 'ALL')) then
    create policy "join_form_settings public read" on join_form_settings
      for select using (true);
  end if;
  if not exists (select 1 from pg_policies
                 where schemaname = 'public' and tablename = 'join_form_settings'
                   and cmd in ('ALL', 'UPDATE')) then
    create policy "join_form_settings auth write" on join_form_settings
      for all to authenticated using (true) with check (true);
  end if;
end $$;

-- ── Trigger: yeni intent'ler + kaynak etiketi ─────────────────────────────
create or replace function applications_to_hub_candidate() returns trigger
language plpgsql security definer set search_path = public as $$
declare
  v_link         text;
  v_github       text;
  v_linkedin     text;
  v_university   text;
  v_why          text;
  v_role_type    text;
  v_open_role_id uuid;
  v_role_track   text;
  v_track        text;
  v_source_tag   text;
  v_role_lc      text;
begin
  if new.intent in ('mentor_application', 'sponsor_application', 'idea_application') then
    return new;
  end if;

  v_link := trim(coalesce(new.linkedin, new.portfolio, ''));
  if v_link <> '' then
    if v_link ~* 'github\.com' then v_github := v_link;
    elsif v_link ~* 'linkedin\.com' then v_linkedin := v_link;
    end if;
  end if;

  v_university := nullif(trim(both ' · ' from concat_ws(' · ', new.university, new.department)), '');

  v_source_tag := case new.intent
    when 'community'     then 'Hub · Topluluk'
    when 'club_team'     then 'Hub · Ekip Üyesi'
    when 'hub'           then 'Hub · Bölüm'
    when 'project'       then 'Lab · Proje Üyesi'
    when 'pool_match'    then 'Lab · Eşleşme Havuzu'
    when 'founder_lead'  then 'Lab · Kurucu (liderlik)'
    else new.intent
  end;

  v_why := nullif(left(trim(both ' — ' from concat_ws(' — ',
    v_source_tag,
    case when new.project_name is not null then 'Proje: ' || new.project_name end,
    case when new.role is not null then 'İlgilendiği pozisyon: ' || new.role end,
    case when new.skills is not null then 'Beceriler: ' || new.skills end,
    new.bio)), 500), '');

  v_role_lc := lower(coalesce(new.role, ''));
  v_role_type := case
    -- Kulüp ekip alanı serbest metin (admin panelden düzenlenir) — anahtar
    -- kelimeyle eşle, tanımsızsa operasyon.
    when new.intent = 'club_team' then
      case
        when v_role_lc like '%tasar%' or v_role_lc like '%design%' then 'design'
        when v_role_lc like '%sosyal%' or v_role_lc like '%sponsor%'
          or v_role_lc like '%pazarlama%' or v_role_lc like '%marketing%'
          or v_role_lc like '%social%' then 'business'
        else 'operations'
      end
    else
      case new.role
        when 'dev' then 'technical'
        when 'design' then 'design'
        when 'marketing' then 'business'
        when 'business' then 'business'
        when 'content' then 'business'
        when 'other' then 'operations'
        else null
      end
  end;

  if new.project_id is not null and new.role is not null then
    select hor.id, hor.track into v_open_role_id, v_role_track
    from hub_open_roles hor
    where hor.startup_id = new.project_id and hor.title = new.role
    limit 1;
  end if;

  v_track := case
    when new.intent = 'founder_lead' then 'founder'
    when v_role_track is not null then v_role_track
    else 'member'
  end;

  begin
    insert into hub_candidates (
      full_name, email, github, linkedin, university, source, source_ref,
      why_this_one, stage, role_type, open_role_id, track
    )
    values (
      coalesce(new.name, '(isimsiz)'), new.email, v_github, v_linkedin, v_university,
      'inbound', new.id::text, v_why, 'pool', v_role_type, v_open_role_id, v_track
    );
  exception when unique_violation then
    null; -- e-posta zaten bir adayda kayıtlı, sessizce atla
  end;

  return new;
end $$;

drop trigger if exists applications_to_hub_candidate_trg on applications;
create trigger applications_to_hub_candidate_trg
after insert on applications
for each row execute function applications_to_hub_candidate();
