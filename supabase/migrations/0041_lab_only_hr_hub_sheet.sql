-- ══════════════════════════════════════════════════════════
-- 0041_lab_only_hr_hub_sheet.sql — HR yalnızca LAB başvurularını alır; HUB → Google Sheets
-- ══════════════════════════════════════════════════════════
-- Karar (2026-09-21):
--  • HUB (topluluk) tarafı başvuruları HR'a (hub_candidates) DÜŞMEZ; Google Sheets
--    tablosuna (Apps Script web bağlantısı) iletilir, yönetim orada yapılır.
--  • LAB (startup) tarafındaki normal aday başvuruları (project, pool_match) Adaylar'a
--    düşer ve ilgi alanı (interest) ile etiketlenir → Adaylar'da ilgi alanı kutucukları.
--  • LAB mentör / destekçi / fikir başvuruları applications tablosunda kalır
--    (HR: Mentörler / Destekçiler / Fikirler sayfaları).
--
-- 1) applications.interest, hub_candidates.interest  (frontend, backend, design …)
-- 2) is_hub_application(): HUB başvurusu mu?  target='community' (eski kayıtlarda
--    target boşsa: intent community/hub)
-- 3) hub_sheet_config: Apps Script web bağlantısı + gizli anahtar (yalnızca settings.write)
-- 4) hub_sheet_row / hub_sheet_test / hub_sheet_backfill + applications INSERT tetikleyicisi
--    (pg_net; gönderim hatası ASLA başvuruyu engellemez)
-- 5) applications_to_hub_candidate(): yalnız LAB, interest + role_type eşlemesi, telefon;
--    beklenmeyen hata başvuruyu engellemez (warning).
-- Idempotent; drop yok.

alter table applications   add column if not exists interest text;
alter table hub_candidates add column if not exists interest text;

-- ── HUB başvurusu mu? ─────────────────────────────────────────────────
create or replace function is_hub_application(a applications) returns boolean
language sql stable as $$
  select coalesce(a.target = 'community', false)
      or (a.target is null and a.intent in ('community', 'hub'))
$$;

-- ── Google Sheets bağlantı ayarı (tek satır) ──────────────────────────
create table if not exists hub_sheet_config (
  id           int primary key default 1 check (id = 1),
  webhook_url  text,
  secret       text,
  enabled      boolean not null default false,
  last_sent_at timestamptz,
  last_error   text,
  updated_at   timestamptz default now()
);
insert into hub_sheet_config (id) values (1) on conflict (id) do nothing;

alter table hub_sheet_config enable row level security;
drop policy if exists hub_sheet_config_rw on hub_sheet_config;
create policy hub_sheet_config_rw on hub_sheet_config
  for all using (has_perm('settings.write')) with check (has_perm('settings.write'));

-- ── Tabloya gidecek satır ────────────────────────────────────────────
create or replace function hub_sheet_row(a applications) returns jsonb
language sql stable as $$
  select jsonb_build_object(
    'id',           a.id::text,
    'created_at',   a.created_at,
    'type',         case a.intent
                      when 'community'          then 'Topluluğa Katılım'
                      when 'hub'                then 'Ekip Üyesi'
                      when 'mentor_application' then 'Mentör'
                      when 'sponsor_application' then 'Sponsor'
                      else coalesce(a.intent, '') end,
    'name',         coalesce(a.name, ''),
    'email',        coalesce(a.email, ''),
    'phone',        coalesce(a.phone, ''),
    'university',   coalesce(a.university, ''),
    'department',   coalesce(a.department, ''),
    'unit',         case when a.intent = 'hub' then coalesce(a.role, '') else '' end,
    'organization', coalesce(nullif(a.company_name, ''), nullif(a.company, ''), ''),
    'detail',       coalesce(nullif(concat_ws(' · ',
                      nullif(a.expertise, ''),
                      case when nullif(a.experience_years, '') is not null then a.experience_years || ' yıl' end,
                      case when nullif(a.weekly_hours, '') is not null then a.weekly_hours || ' saat/hafta' end,
                      (select string_agg(x, ', ') from jsonb_array_elements_text(to_jsonb(a.collaboration_types)) x),
                      nullif(a.website, ''),
                      nullif(a.linkedin_url, ''),
                      nullif(a.sponsor_message, ''),
                      case when a.intent in ('mentor_application') then nullif(a.bio, '') end
                    ), ''), ''),
    'status',       'Yeni'
  )
$$;

-- ── INSERT tetikleyicisi: HUB başvurusunu tabloya it ─────────────────
create or replace function applications_to_hub_sheet() returns trigger
language plpgsql security definer set search_path = public as $$
declare
  cfg hub_sheet_config%rowtype;
begin
  if not is_hub_application(new) then return new; end if;
  select * into cfg from hub_sheet_config where id = 1;
  if cfg.enabled is not true or coalesce(cfg.webhook_url, '') = '' then return new; end if;
  begin
    perform net.http_post(
      url     := cfg.webhook_url,
      headers := jsonb_build_object('Content-Type', 'application/json'),
      body    := jsonb_build_object('secret', cfg.secret, 'rows', jsonb_build_array(hub_sheet_row(new)))
    );
    update hub_sheet_config set last_sent_at = now(), last_error = null where id = 1;
  exception when others then
    update hub_sheet_config set last_error = left(sqlerrm, 300) where id = 1;
  end;
  return new;
end $$;

drop trigger if exists applications_to_hub_sheet_trg on applications;
create trigger applications_to_hub_sheet_trg
after insert on applications
for each row execute function applications_to_hub_sheet();

-- ── HR'dan: test satırı gönder ───────────────────────────────────────
create or replace function hub_sheet_test() returns text
language plpgsql security definer set search_path = public as $$
declare
  cfg hub_sheet_config%rowtype;
begin
  if not has_perm('settings.write') then raise exception 'Yetkin yok'; end if;
  select * into cfg from hub_sheet_config where id = 1;
  if coalesce(cfg.webhook_url, '') = '' then raise exception 'Önce web bağlantısını kaydet'; end if;
  perform net.http_post(
    url     := cfg.webhook_url,
    headers := jsonb_build_object('Content-Type', 'application/json'),
    body    := jsonb_build_object('secret', cfg.secret, 'rows', jsonb_build_array(jsonb_build_object(
      'id', 'TEST-' || to_char(now(), 'YYYYMMDDHH24MISS'),
      'created_at', now(), 'type', 'TEST', 'name', 'Test Başvurusu (silebilirsin)',
      'email', 'test@example.com', 'phone', '', 'university', '', 'department', '',
      'unit', '', 'organization', '', 'detail', 'HR''dan gönderilen bağlantı testi', 'status', 'Yeni')))
  );
  update hub_sheet_config set last_sent_at = now(), last_error = null where id = 1;
  return 'ok';
end $$;

-- ── HR'dan: mevcut HUB başvurularını tabloya aktar (tablo ID'ye göre tekrarı eler) ──
create or replace function hub_sheet_backfill() returns integer
language plpgsql security definer set search_path = public as $$
declare
  cfg hub_sheet_config%rowtype;
  r   applications;
  buf jsonb := '[]'::jsonb;
  n   integer := 0;
begin
  if not has_perm('settings.write') then raise exception 'Yetkin yok'; end if;
  select * into cfg from hub_sheet_config where id = 1;
  if coalesce(cfg.webhook_url, '') = '' then raise exception 'Önce web bağlantısını kaydet'; end if;

  for r in select * from applications a where is_hub_application(a) order by a.created_at loop
    buf := buf || jsonb_build_array(hub_sheet_row(r));
    n := n + 1;
    if jsonb_array_length(buf) >= 100 then
      perform net.http_post(
        url := cfg.webhook_url, headers := jsonb_build_object('Content-Type', 'application/json'),
        body := jsonb_build_object('secret', cfg.secret, 'rows', buf));
      buf := '[]'::jsonb;
    end if;
  end loop;
  if jsonb_array_length(buf) > 0 then
    perform net.http_post(
      url := cfg.webhook_url, headers := jsonb_build_object('Content-Type', 'application/json'),
      body := jsonb_build_object('secret', cfg.secret, 'rows', buf));
  end if;
  update hub_sheet_config set last_sent_at = now(), last_error = null where id = 1;
  return n;
end $$;

-- ── Başvuru → Adaylar: yalnızca LAB ─────────────────────────────────
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
  v_tag          text;
  v_interest     text;
  v_ilabel       text;
begin
  -- mentör / destekçi / fikir: aday değil, HR'da kendi sayfaları var
  if new.intent in ('mentor_application', 'sponsor_application', 'idea_application') then
    return new;
  end if;
  -- HUB başvuruları HR'a düşmez (Google Sheets tablosuna gider)
  if is_hub_application(new) then
    return new;
  end if;

  v_link := trim(coalesce(new.linkedin, new.portfolio, ''));
  if v_link <> '' then
    if v_link ~* 'github\.com' then v_github := v_link;
    elsif v_link ~* 'linkedin\.com' then v_linkedin := v_link;
    end if;
  end if;

  v_university := nullif(trim(both ' · ' from concat_ws(' · ', new.university, new.department)), '');

  -- ilgi alanı: yeni formda `interest`; eski kayıtlarda kategori anahtarı `role`'daydı
  v_interest := nullif(trim(coalesce(new.interest, '')), '');
  if v_interest is null and new.role in
     ('dev','design','marketing','business','content','other','frontend','backend','mobile','data','product') then
    v_interest := new.role;
  end if;

  v_ilabel := case v_interest
    when 'frontend'  then 'Frontend'
    when 'backend'   then 'Backend'
    when 'mobile'    then 'Mobil'
    when 'data'      then 'Veri & Yapay Zekâ'
    when 'design'    then 'UI/UX Tasarım'
    when 'product'   then 'Ürün & Proje Yönetimi'
    when 'marketing' then 'Pazarlama & Growth'
    when 'business'  then 'İş Geliştirme'
    when 'content'   then 'İçerik & Yazı'
    when 'dev'       then 'Yazılım'
    when 'other'     then 'Diğer'
    else null
  end;

  v_role_type := case v_interest
    when 'frontend'  then 'technical'
    when 'backend'   then 'technical'
    when 'mobile'    then 'technical'
    when 'data'      then 'technical'
    when 'dev'       then 'technical'
    when 'design'    then 'design'
    when 'product'   then 'business'
    when 'marketing' then 'business'
    when 'business'  then 'business'
    when 'content'   then 'business'
    when 'other'     then 'operations'
    else null
  end;

  v_tag := case new.intent
    when 'project'      then 'Lab · Proje Üyesi'
    when 'pool_match'   then 'Lab · Proje Havuzu'
    when 'founder_lead' then 'Lab · Kurucu (liderlik)'
    else new.intent
  end;

  v_why := nullif(left(trim(both ' — ' from concat_ws(' — ',
    v_tag,
    case when v_ilabel is not null then 'İlgi alanı: ' || v_ilabel end,
    case when new.project_name is not null then 'Proje: ' || new.project_name end,
    case when new.role is not null and new.role is distinct from v_interest then 'İlgilendiği pozisyon: ' || new.role end,
    case when new.skills is not null then 'Beceriler: ' || new.skills end,
    new.bio)), 500), '');

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
      full_name, email, phone, github, linkedin, university, source, source_ref,
      why_this_one, stage, role_type, interest, open_role_id, track
    )
    values (
      coalesce(new.name, '(isimsiz)'), new.email, nullif(trim(coalesce(new.phone, '')), ''),
      v_github, v_linkedin, v_university,
      'inbound', new.id::text, v_why, 'pool', v_role_type, v_interest, v_open_role_id, v_track
    );
  exception
    when unique_violation then null;   -- e-posta zaten bir adayda kayıtlı, sessizce atla
    when others then raise warning 'applications_to_hub_candidate: %', sqlerrm;   -- başvuruyu ASLA engelleme
  end;

  return new;
end $$;

drop trigger if exists applications_to_hub_candidate_trg on applications;
create trigger applications_to_hub_candidate_trg
after insert on applications
for each row execute function applications_to_hub_candidate();
