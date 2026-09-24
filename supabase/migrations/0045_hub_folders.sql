-- ══════════════════════════════════════════════════════════
-- 0045_hub_folders.sql — Aday klasörleme (dosya gezgini modeli)
-- ══════════════════════════════════════════════════════════
-- Kullanıcı adayları "bilgisayardaki dosyalar" gibi klasörleyebilmek istedi:
-- özel klasörler (ör. "LLM için adaylar", "Mobil Flutter") oluşturup hem
-- dışarıdan bulunan adayları doğrudan bir klasöre ekleyebilmek hem de formdan
-- (inbound) gelen adayların ilgi alanına göre otomatik doğru klasöre düşmesi.
--
-- Model: TEK klasör (bir aday tek klasörde durur — dosya gezgini mantığı,
-- kullanıcı onayı). Bu yüzden ayrı bir çoka-çok (join) tablo YERİNE
-- hub_candidates'a basit bir folder_id kolonu yeterli.
--
-- Mevcut hub_candidates.interest (Frontend/Backend/Mobil/... 10 sabit değer,
-- hub-constants.js/join-form-fields.jsx/other-pages.jsx'te elle senkronize
-- edilen düz text kolon) gerçek bir kategori VARLIĞI değil — genişletilemez.
-- Bu migration onun YERİNE geçmiyor, üstüne gerçek bir varlık (hub_folders)
-- kuruyor; interest alanı ve ona bağlı filtre/UI dokunulmadan kalıyor.
--
-- Idempotent; drop column yok.

create table if not exists hub_folders (
  id         uuid primary key default gen_random_uuid(),
  name       text not null,
  slug       text unique,   -- yalnızca ilgi-alanından türeyen varsayılan klasörlerde dolu
  created_by uuid,
  created_at timestamptz not null default now()
);

alter table hub_candidates
  add column if not exists folder_id uuid references hub_folders(id) on delete set null;
-- ON DELETE SET NULL: klasör silinince adaylar SİLİNMEZ, otomatik kategorisiz
-- kalır — istenen davranış, uygulama kodu yazmaya gerek kalmadan DB'den gelir.

alter table hub_folders enable row level security;

do $$
begin
  if not exists (select 1 from pg_policies
                 where schemaname = 'public' and tablename = 'hub_folders' and cmd = 'SELECT') then
    create policy hfld_read on hub_folders for select using (has_perm('candidates.read'));
  end if;
  if not exists (select 1 from pg_policies
                 where schemaname = 'public' and tablename = 'hub_folders' and cmd = 'ALL') then
    create policy hfld_write on hub_folders for all
      using (has_perm('candidates.write')) with check (has_perm('candidates.write'));
  end if;
end $$;

-- ── Varsayılan klasörler: mevcut 10 ilgi alanı ──────────────────────────────
insert into hub_folders (name, slug) values
  ('Frontend', 'frontend'),
  ('Backend', 'backend'),
  ('Mobil', 'mobile'),
  ('Veri & Yapay Zekâ', 'data'),
  ('UI-UX Tasarım', 'design'),
  ('Ürün & Proje', 'product'),
  ('Pazarlama & Growth', 'marketing'),
  ('İş Geliştirme', 'business'),
  ('İçerik & Yazı', 'content'),
  ('Diğer', 'other')
on conflict (slug) do nothing;

-- ── Geriye dönük: mevcut adaylar kendi interest'ine göre klasörlenir ────────
update hub_candidates c set folder_id = f.id
from hub_folders f
where f.slug = c.interest and c.folder_id is null;

-- ── Trigger: yeni inbound aday, ilgi alanına göre otomatik doğru klasöre
-- düşsün. applications_to_hub_candidate()'in 0041'deki GÜNCEL/canlı tanımı
-- birebir korunuyor — tek ek: hesaplanan v_interest'ten hub_folders.slug
-- eşleşmesiyle folder_id, insert edilen satıra ekleniyor.
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

  -- YENİ (0045): ilgi alanına göre otomatik klasör eşleşmesi.
  if v_interest is not null then
    select id into v_folder_id from hub_folders where slug = v_interest limit 1;
  end if;

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
    when unique_violation then null;   -- e-posta zaten bir adayda kayıtlı, sessizce atla
    when others then raise warning 'applications_to_hub_candidate: %', sqlerrm;   -- başvuruyu ASLA engelleme
  end;

  return new;
end $$;
