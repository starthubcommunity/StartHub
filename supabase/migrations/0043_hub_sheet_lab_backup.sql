-- ══════════════════════════════════════════════════════════
-- 0043_hub_sheet_lab_backup.sql — Google Sheets: LAB başvuruları da yedek olarak eklensin
-- ══════════════════════════════════════════════════════════
-- Karar (2026-09-22): "site giderse elimizde yedek bulunsun" — 0041/0042'de yalnızca
-- HUB (topluluk) başvuruları Sheets'e gidiyordu (LAB, HR'a zaten düşüyor diye
-- atlanmıştı). Artık LAB başvuruları da AYNI tabloda AYRI bir sekmeye (varsayılan
-- "Sayfa1" — Sheets'in kendiliğinden oluşturduğu, boş duran varsayılan sekme) yedek
-- olarak yazılıyor. Yönlendirme (hangi sekme) DB'de karar veriliyor; HR'ın kendi
-- akışı (LAB → Adaylar/Mentörler/Destekçiler/Fikirler) DEĞİŞMEDİ, bu yalnızca ek bir
-- yedekleme kanalı. Kayıt olunca (INSERT) hem HR/hub_candidates hem Sheets'e gider.
--
-- 1) hub_sheet_config.lab_sheet_name (varsayılan 'Sayfa1')
-- 2) hub_sheet_row(): LAB'a özel alanlar da 'detail'e eklendi (proje, ilgi alanı,
--    pozisyon, yetenekler, linkedin/portfolyo, fikir/problem/ilerleme, kısa bio) +
--    'type' eşlemesi project/pool_match/founder_lead/idea_application'ı da kapsıyor
-- 3) hub_sheet_post_batch(): net.http_post'u tek yerden yapan yardımcı (tetikleyici +
--    backfill ikisi de kullanır)
-- 4) applications_to_hub_sheet(): artık HUB için erken çıkış yok — her iki taraf da
--    (hedef sekmesi ayrı) gönderiliyor
-- 5) hub_sheet_backfill(): hem HUB hem LAB geçmişini iki sekmeye aktarır (ID'ye göre
--    tekrarı eler, güvenle tekrar çalıştırılabilir)

alter table hub_sheet_config add column if not exists lab_sheet_name text default 'Sayfa1';

-- ── Tabloya gidecek satır — artık LAB alanlarını da kapsıyor ──────────
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
                      when 'project'            then 'Lab · Proje Üyesi'
                      when 'pool_match'         then 'Lab · Proje Havuzu'
                      when 'founder_lead'       then 'Lab · Kurucu (liderlik)'
                      when 'idea_application'   then 'Lab · Yeni Fikir'
                      else coalesce(a.intent, '') end,
    'name',         coalesce(a.name, ''),
    'email',        coalesce(a.email, ''),
    'phone',        coalesce(a.phone, ''),
    'university',   coalesce(a.university, ''),
    'department',   coalesce(a.department, ''),
    'unit',         case when a.intent = 'hub' then coalesce(a.role, '') else '' end,
    'organization', coalesce(nullif(a.company_name, ''), nullif(a.company, ''), ''),
    'detail',       coalesce(nullif(concat_ws(' · ',
                      case when a.project_name is not null then 'Proje: ' || a.project_name end,
                      case a.interest
                        when 'frontend'  then 'İlgi alanı: Frontend'
                        when 'backend'   then 'İlgi alanı: Backend'
                        when 'mobile'    then 'İlgi alanı: Mobil'
                        when 'data'      then 'İlgi alanı: Veri & Yapay Zekâ'
                        when 'design'    then 'İlgi alanı: UI/UX Tasarım'
                        when 'product'   then 'İlgi alanı: Ürün & Proje'
                        when 'marketing' then 'İlgi alanı: Pazarlama & Growth'
                        when 'business'  then 'İlgi alanı: İş Geliştirme'
                        when 'content'   then 'İlgi alanı: İçerik & Yazı'
                        when 'other'     then 'İlgi alanı: Diğer'
                        else null end,
                      case when a.intent in ('project','pool_match') and a.role is not null then 'Pozisyon: ' || a.role end,
                      nullif(a.expertise, ''),
                      case when nullif(a.experience_years, '') is not null then a.experience_years || ' yıl' end,
                      case when nullif(a.weekly_hours, '') is not null then a.weekly_hours || ' saat/hafta' end,
                      (select string_agg(x, ', ') from jsonb_array_elements_text(to_jsonb(a.collaboration_types)) x),
                      nullif(a.skills, ''),
                      nullif(a.website, ''),
                      nullif(coalesce(a.linkedin_url, a.linkedin), ''),
                      nullif(a.portfolio, ''),
                      nullif(a.sponsor_message, ''),
                      case when a.intent = 'idea_application' then nullif(a.pitch, '') end,
                      case when a.intent = 'idea_application' then nullif(a.problem, '') end,
                      case when a.intent = 'idea_application' then nullif(a.progress, '') end,
                      nullif(a.bio, '')
                    ), ''), ''),
    'status',       'Yeni'
  )
$$;

-- ── Ortak gönderim yardımcısı: bir satır kümesini belirli bir sekmeye yollar ──
create or replace function hub_sheet_post_batch(p_sheet text, p_rows jsonb) returns void
language plpgsql security definer set search_path = public as $$
begin
  if p_rows is null or jsonb_array_length(p_rows) = 0 then return; end if;
  perform net.http_post(
    url     := (select decrypted_secret from vault.decrypted_secrets where name = 'project_url')
               || '/functions/v1/hub-sheet-sync',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' ||
        (select decrypted_secret from vault.decrypted_secrets where name = 'service_role_key')
    ),
    body    := jsonb_build_object('sheet_name', p_sheet, 'rows', p_rows)
  );
end $$;

-- ── INSERT tetikleyicisi: HUB → sheet_name sekmesi, LAB → lab_sheet_name sekmesi ──
create or replace function applications_to_hub_sheet() returns trigger
language plpgsql security definer set search_path = public as $$
declare
  cfg hub_sheet_config%rowtype;
  target_sheet text;
begin
  select * into cfg from hub_sheet_config where id = 1;
  if cfg.enabled is not true or coalesce(cfg.spreadsheet_id, '') = '' then return new; end if;
  target_sheet := case when is_hub_application(new)
    then coalesce(nullif(cfg.sheet_name, ''), 'Hub Başvuruları')
    else coalesce(nullif(cfg.lab_sheet_name, ''), 'Sayfa1') end;
  begin
    perform hub_sheet_post_batch(target_sheet, jsonb_build_array(hub_sheet_row(new)));
  exception when others then
    update hub_sheet_config set last_error = left(sqlerrm, 300) where id = 1;
  end;
  return new;
end $$;

-- ── HR'dan: mevcut TÜM başvuruları (HUB + LAB) iki sekmeye aktar ─────
create or replace function hub_sheet_backfill() returns integer
language plpgsql security definer set search_path = public as $$
declare
  cfg     hub_sheet_config%rowtype;
  r       applications;
  buf_hub jsonb := '[]'::jsonb;
  buf_lab jsonb := '[]'::jsonb;
  n       integer := 0;
  sh_hub  text;
  sh_lab  text;
begin
  if not has_perm('settings.write') then raise exception 'Yetkin yok'; end if;
  select * into cfg from hub_sheet_config where id = 1;
  if coalesce(cfg.spreadsheet_id, '') = '' then raise exception 'Önce tablo ID''sini kaydet'; end if;

  sh_hub := coalesce(nullif(cfg.sheet_name, ''), 'Hub Başvuruları');
  sh_lab := coalesce(nullif(cfg.lab_sheet_name, ''), 'Sayfa1');

  for r in select * from applications a order by a.created_at loop
    n := n + 1;
    if is_hub_application(r) then
      buf_hub := buf_hub || jsonb_build_array(hub_sheet_row(r));
      if jsonb_array_length(buf_hub) >= 100 then
        perform hub_sheet_post_batch(sh_hub, buf_hub);
        buf_hub := '[]'::jsonb;
      end if;
    else
      buf_lab := buf_lab || jsonb_build_array(hub_sheet_row(r));
      if jsonb_array_length(buf_lab) >= 100 then
        perform hub_sheet_post_batch(sh_lab, buf_lab);
        buf_lab := '[]'::jsonb;
      end if;
    end if;
  end loop;
  perform hub_sheet_post_batch(sh_hub, buf_hub);
  perform hub_sheet_post_batch(sh_lab, buf_lab);
  return n;
end $$;
