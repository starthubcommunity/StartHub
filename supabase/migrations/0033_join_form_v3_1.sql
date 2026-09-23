-- ══════════════════════════════════════════════════════════
-- 0033_join_form_v3_1.sql — Katıl formu 5 seçenekli oldu (HUB_SPEC.md §16)
-- ══════════════════════════════════════════════════════════
-- Kapsam: applications_to_hub_candidate() trigger'ı (0022) dört noktada
-- güncelleniyor + yeni intent'lerin serbest metin alanları için 3 kolon.
-- Idempotent, drop column yok, why_this_one'ın mevcut serbest-metin
-- davranışı korunuyor (B1 ek, yerine geçmiyor).
--
-- B1 — Website İlgi Alanı (6 kategori) -> Hub role_type (4 kategori) eşlemesi.
--   dev->technical, design->design, marketing/business/content->business,
--   other->operations (kullanıcı kararı, 2026-09-16). Yalnızca new.role TAM
--   olarak bu 6 anahtardan biriyle eşleşirse uygulanır — new.role bir proje
--   deep-link'inden/seçicisinden gelen SPESİFİK pozisyon adı taşıyorsa (savedRole
--   deseni) eşleşme olmaz, role_type null kalır (zararsız, önceki davranış).
--
-- B2 — new.project_id doluysa ve new.role, AYNI startup_id altındaki bir
--   hub_open_roles.title ile TAM eşleşiyorsa, o role otomatik bağlanır
--   (open_role_id). Eşleşme yoksa (kısmi/olası dahil) sessizce atlanır —
--   yeni bir "olası eşleşme" arayüzü YOK (kullanıcı kararı), mevcut
--   trigger'ın "asla hata gösterme" felsefesiyle tutarlı.
--
-- B3 — new.intent = 'founder_lead' ise track: 'founder'. Bağlanan rol
--   varsa (B2) onun track'i esas alınır (linkCandidateRole'daki
--   inheritedTrack ile aynı öncelik: rol > intent > varsayılan).
--   ÖNEMLİ YAN DÜZELTME: hub_candidates.track kolonunun DB default'u
--   'founder' — eski trigger track'i hiç YAZMIYORDU, yani bugüne kadar
--   community/hub/project (normal üye) başvuran HERKES sessizce
--   track='founder' ile açılıyordu ve THRESHOLD.founder (daha sıkı eşik)
--   ile değerlendiriliyordu. Artık track her zaman açıkça yazılıyor:
--   founder_lead -> founder, aksi halde (rol track'i yoksa) member.
--
-- B4 — 'idea_application' artık mentor/sponsor ile aynı satırda: hub_candidates'a
--   HİÇ düşmez (aday değerlendirmesi değil, proje teklifi), applications
--   tablosunda kalır — "Diğer Başvurular" ekranına 3. filtre olarak eklenir
--   (bkz. src/hub/pages/applications.jsx).

alter table applications
  add column if not exists pitch    text,   -- "fikrini anlat" (idea_application, zorunlu) / "neden sen" (founder_lead, projesiz)
  add column if not exists problem  text,   -- idea_application: hangi problemi çözüyor
  add column if not exists progress text;   -- idea_application: şu ana kadar ne yapıldı (opsiyonel)

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
  v_why := nullif(left(trim(both ' — ' from concat_ws(' — ',
    new.intent,
    case when new.project_name is not null then 'Proje: ' || new.project_name end,
    case when new.role is not null then 'İlgilendiği pozisyon: ' || new.role end,
    case when new.skills is not null then 'Beceriler: ' || new.skills end,
    new.bio)), 500), '');

  v_role_type := case new.role
    when 'dev' then 'technical'
    when 'design' then 'design'
    when 'marketing' then 'business'
    when 'business' then 'business'
    when 'content' then 'business'
    when 'other' then 'operations'
    else null
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
