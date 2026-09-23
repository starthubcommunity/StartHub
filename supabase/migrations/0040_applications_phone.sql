-- ══════════════════════════════════════════════════════════
-- 0040_applications_phone.sql — Katıl formu: HUB tarafı telefon soruyor
-- ══════════════════════════════════════════════════════════
-- 1) applications.phone (nullable): "Topluluğa katılmak" ve "Ekipte yer almak"
--    başvurularında telefon numarası.
-- 2) applications_to_hub_candidate() (0037 hâli) üç noktada güncellendi:
--    - phone -> hub_candidates.phone kopyalanır
--    - intent 'hub' (ekip birimi; role = 'Sosyal Medya' | 'Tasarım' | 'Organizasyon' |
--      'Sponsorluk') için role_type anahtar kelimeyle türetilir
--    - why_this_one başında okunur kaynak etiketi ("Hub · Topluluk", "Lab · Proje Havuzu" …)
--    'pool_match' (ilgi alanına göre proje havuzu) özel işlem GÖRMEZ: diğer normal
--    başvurular gibi Adaylar havuzuna (stage 'pool') düşer.
-- Idempotent; drop yok.

alter table applications
  add column if not exists phone text;

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

  v_tag := case new.intent
    when 'community'    then 'Hub · Topluluk'
    when 'hub'         then 'Hub · Ekip Üyesi'
    when 'project'     then 'Lab · Proje Üyesi'
    when 'pool_match'  then 'Lab · Proje Havuzu'
    when 'founder_lead' then 'Lab · Kurucu (liderlik)'
    else new.intent
  end;

  v_why := nullif(left(trim(both ' — ' from concat_ws(' — ',
    v_tag,
    case when new.project_name is not null then 'Proje: ' || new.project_name end,
    case when new.role is not null then 'İlgilendiği pozisyon: ' || new.role end,
    case when new.skills is not null then 'Beceriler: ' || new.skills end,
    new.bio)), 500), '');

  v_role_lc := lower(coalesce(new.role, ''));
  v_role_type := case
    when new.intent = 'hub' then
      case
        when v_role_lc like '%tasar%' or v_role_lc like '%design%' then 'design'
        when v_role_lc like '%sosyal%' or v_role_lc like '%sponsor%'
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
      full_name, email, phone, github, linkedin, university, source, source_ref,
      why_this_one, stage, role_type, open_role_id, track
    )
    values (
      coalesce(new.name, '(isimsiz)'), new.email, nullif(trim(coalesce(new.phone, '')), ''),
      v_github, v_linkedin, v_university,
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
