-- ══════════════════════════════════════════════════════════
-- 0047_hub_sheet_mentor_sponsor_split.sql — Mentör/Destekçi kendi sekmesine, HUB+LAB birlikte
-- ══════════════════════════════════════════════════════════
-- Karar (2026-09-25): "Sayfa1" tamamen bırakıldı (0046), yerine kullanıcı iki
-- yeni sekme istedi: "Mentör Başvuruları" ve "Destekçi Başvuruları". Bunlar
-- hedefe (HUB/LAB) göre AYRILMIYOR — bir mentör/destekçi Topluluk mu Startup mı
-- seçmiş olursa olsun aynı sekmede birleşiyor (mentör/destekçi ilişkisi hedeften
-- bağımsız, tek bir havuzda görülmek isteniyor). Geri kalan başvuru türleri
-- (community/hub → Hub Başvuruları; project/pool_match/idea_application/
-- founder_lead → Lab Başvuruları) DEĞİŞMEDİ — hâlâ hedefe göre ikiye ayrılıyor.
--
-- 1) hub_sheet_config.mentor_sheet_name / sponsor_sheet_name (varsayılan adlarla)
-- 2) applications_to_hub_sheet(): intent mentor_application/sponsor_application
--    ise hedefe bakmadan kendi sekmesine, değilse eskisi gibi is_hub_application()
-- 3) hub_sheet_backfill(): dört ayrı tampon (hub/lab/mentor/sponsor)
-- Idempotent; drop yok. Eski "Sayfa1" sekmesi Google Sheets'te elle silinebilir
-- (kod tarafında dokunulmuyor, yalnızca artık hiçbir şey yazılmıyor).

alter table hub_sheet_config add column if not exists mentor_sheet_name text default 'Mentör Başvuruları';
alter table hub_sheet_config add column if not exists sponsor_sheet_name text default 'Destekçi Başvuruları';

update hub_sheet_config set mentor_sheet_name = 'Mentör Başvuruları' where id = 1 and coalesce(mentor_sheet_name, '') = '';
update hub_sheet_config set sponsor_sheet_name = 'Destekçi Başvuruları' where id = 1 and coalesce(sponsor_sheet_name, '') = '';

-- ── Bir başvurunun gideceği sekme adı — tek yerden, trigger + backfill ortak ──
create or replace function hub_sheet_target(a applications, cfg hub_sheet_config) returns text
language sql stable as $$
  select case
    when a.intent = 'mentor_application'  then coalesce(nullif(cfg.mentor_sheet_name, ''), 'Mentör Başvuruları')
    when a.intent = 'sponsor_application' then coalesce(nullif(cfg.sponsor_sheet_name, ''), 'Destekçi Başvuruları')
    when is_hub_application(a)            then coalesce(nullif(cfg.sheet_name, ''), 'Hub Başvuruları')
    else                                        coalesce(nullif(cfg.lab_sheet_name, ''), 'Lab Başvuruları')
  end
$$;

create or replace function applications_to_hub_sheet() returns trigger
language plpgsql security definer set search_path = public as $$
declare
  cfg hub_sheet_config%rowtype;
begin
  select * into cfg from hub_sheet_config where id = 1;
  if cfg.enabled is not true or coalesce(cfg.spreadsheet_id, '') = '' then return new; end if;
  begin
    perform hub_sheet_post_batch(hub_sheet_target(new, cfg), jsonb_build_array(hub_sheet_row(new)));
  exception when others then
    update hub_sheet_config set last_error = left(sqlerrm, 300) where id = 1;
  end;
  return new;
end $$;

create or replace function hub_sheet_backfill() returns integer
language plpgsql security definer set search_path = public as $$
declare
  cfg      hub_sheet_config%rowtype;
  r        applications;
  buckets  jsonb := '{}'::jsonb;   -- sheet_name -> jsonb_array satır tamponu
  sheet    text;
  n        integer := 0;
  k        text;
begin
  if not has_perm('settings.write') then raise exception 'Yetkin yok'; end if;
  select * into cfg from hub_sheet_config where id = 1;
  if coalesce(cfg.spreadsheet_id, '') = '' then raise exception 'Önce tablo ID''sini kaydet'; end if;

  for r in select * from applications a order by a.created_at loop
    n := n + 1;
    sheet := hub_sheet_target(r, cfg);
    buckets := jsonb_set(buckets, array[sheet], coalesce(buckets->sheet, '[]'::jsonb) || jsonb_build_array(hub_sheet_row(r)));
    if jsonb_array_length(buckets->sheet) >= 100 then
      perform hub_sheet_post_batch(sheet, buckets->sheet);
      buckets := jsonb_set(buckets, array[sheet], '[]'::jsonb);
    end if;
  end loop;

  for k in select jsonb_object_keys(buckets) loop
    perform hub_sheet_post_batch(k, buckets->k);
  end loop;
  return n;
end $$;
