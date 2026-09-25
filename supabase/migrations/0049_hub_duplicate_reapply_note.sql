-- ══════════════════════════════════════════════════════════
-- 0049_hub_duplicate_reapply_note.sql — Aynı e-postayla yeniden başvuru artık SESSİZCE kaybolmuyor
-- ══════════════════════════════════════════════════════════
-- Olay (2026-09-25): "RAG" pozisyonuna (GrantAgent) gerçek bir başvuru geldi ama
-- HR'da hiç görünmedi. Sebep: applications_to_hub_candidate()'in unique_violation
-- yakalayıcısı ("e-posta zaten bir adayda kayıtlı, sessizce atla") — o e-posta
-- (shiptarea@gmail.com) 15 Eylül'den kalma bir TEST kaydında zaten vardı (isim
-- "fere", hatta yanlışlıkla 'member' aşamasına kadar ilerletilip people/team
-- rosterına bile sızmıştı — o test kaydı ve people satırı bu oturumda elle
-- temizlendi, gerçek başvuru elle hub_candidates'a işlendi).
--
-- Kök neden düzeltmesi: aynı e-postayla YENİDEN başvuru artık sessizce atlanmıyor
-- — mevcut adayın `interview_note`'una görünür, zaman damgalı bir satır ekleniyor
-- ("Yeniden başvurdu…"). Adayın aşaması/diğer alanları DEĞİŞTİRİLMİYOR (var olan
-- süreci bozmaz) — yalnızca HR'ın "bu kişi az önce tekrar başvurdu" bilgisini
-- görebilmesi sağlanıyor. İlk kez başvuran akış (insert) DEĞİŞMEDİ.

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
  v_folder_id    uuid;
  v_reapply_note text;
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

  if v_interest is not null then
    select id into v_folder_id from hub_folders where slug = v_interest limit 1;
  end if;

  -- YENİ (0049): tekrar başvuruda göze görünür not, aynı e-postadaki mevcut
  -- adaya eklenir. taşan uzunluk kırpılır, sınırsız birikmesin diye 2000 karakterde kesilir.
  v_reapply_note := 'Yeniden başvurdu (' || to_char(new.created_at, 'YYYY-MM-DD') || ')' ||
    case when v_tag is not null then ' — ' || v_tag else '' end ||
    case when v_ilabel is not null then ' · İlgi alanı: ' || v_ilabel else '' end ||
    case when new.role is not null then ' · Pozisyon: ' || new.role else '' end ||
    case when new.project_name is not null then ' · Proje: ' || new.project_name else '' end;

  begin
    insert into hub_candidates (
      full_name, email, phone, github, linkedin, university, source, source_ref,
      why_this_one, stage, role_type, interest, open_role_id, track, folder_id
    )
    values (
      coalesce(new.name, '(isimsiz)'), new.email, nullif(trim(coalesce(new.phone, '')), ''),
      v_github, v_linkedin, v_university,
      'inbound', new.id::text, v_why, 'pool', v_role_type, v_interest, v_open_role_id, v_track, v_folder_id
    );
  exception
    when unique_violation then
      update hub_candidates set interview_note = left(trim(both E'\n' from concat_ws(E'\n', interview_note, v_reapply_note)), 2000)
      where email = new.email;
    when others then raise warning 'applications_to_hub_candidate: %', sqlerrm;   -- başvuruyu ASLA engelleme
  end;

  return new;
end $$;
