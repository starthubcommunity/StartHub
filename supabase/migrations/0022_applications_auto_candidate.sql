-- ══════════════════════════════════════════════════════════
-- 0022_applications_auto_candidate.sql — Başvuru → Kurucu Hattı otomatik
-- ══════════════════════════════════════════════════════════
-- 0009 sonrası (C5) her başvurunun Hub'ın aday havuzuna (hub_candidates)
-- girmesi admin panelden ELLE "Aktar" gerektiriyordu (bilinçli insan-
-- inceleme adımı). Kullanıcı kararıyla bu adım kaldırıldı: artık her
-- 'community' türü başvuru geldiğinde otomatik olarak hub_candidates'a
-- düşer — sürtünme azaltmak için. mentor_application/sponsor_application
-- dahil edilmez (aday değiller); 'community' ve 'project' (proje sayfasından
-- gelen) ikisi de dahildir.
--
-- SECURITY DEFINER: anon (site ziyaretçisi) applications'a INSERT
-- yapabiliyor ama hub_candidates'a RLS gereği yazamaz (has_perm
-- ('candidates.create') anon için her zaman false) — bu fonksiyon
-- tetikleyici sahibinin yetkisiyle çalışıp RLS'i bypass eder.
--
-- Aynı e-posta zaten bir adaysa (hub_cand_email_uq) SESSİZCE atlanır —
-- başvuru kaydı bu yüzden asla başarısız olmaz (exception yutulur).

create or replace function applications_to_hub_candidate() returns trigger
language plpgsql security definer set search_path = public as $$
declare
  v_link      text;
  v_github    text;
  v_linkedin  text;
  v_university text;
  v_why       text;
begin
  if new.intent in ('mentor_application', 'sponsor_application') then
    return new;
  end if;

  v_link := trim(coalesce(new.linkedin, new.portfolio, ''));
  if v_link <> '' then
    if v_link ~* 'github\.com' then v_github := v_link;
    elsif v_link ~* 'linkedin\.com' then v_linkedin := v_link;
    end if;
  end if;

  v_university := nullif(trim(both ' · ' from concat_ws(' · ', new.university, new.department)), '');
  v_why := nullif(left(trim(both ' — ' from concat_ws(' — ',
    new.intent,
    case when new.project_name is not null then 'Proje: ' || new.project_name end,
    case when new.role is not null then 'İlgilendiği pozisyon: ' || new.role end,
    case when new.skills is not null then 'Beceriler: ' || new.skills end,
    new.bio)), 500), '');

  begin
    insert into hub_candidates (full_name, email, github, linkedin, university, source, source_ref, why_this_one, stage)
    values (coalesce(new.name, '(isimsiz)'), new.email, v_github, v_linkedin, v_university, 'inbound', new.id::text, v_why, 'pool');
  exception when unique_violation then
    null; -- e-posta zaten bir adayda kayıtlı, sessizce atla
  end;

  return new;
end $$;

drop trigger if exists applications_to_hub_candidate_trg on applications;
create trigger applications_to_hub_candidate_trg
after insert on applications
for each row execute function applications_to_hub_candidate();
