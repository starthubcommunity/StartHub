-- ══════════════════════════════════════════════════════════
-- 0046_hub_sheet_lab_rename.sql — LAB yedek sekmesinin varsayılan adı değişti
-- ══════════════════════════════════════════════════════════
-- Karar (2026-09-25): LAB yedeği 0043'ten beri Sheets'in kendiliğinden oluşturduğu
-- boş "Sayfa1" sekmesine gidiyordu — kafa karıştırıcıydı ("Sayfa1'e ne yansıyor?").
-- Bundan böyle varsayılan/boş değer "Lab Başvuruları" sekmesine düşer (HUB tarafının
-- "Hub Başvuruları" adıyla simetrik). "Sayfa1" sekmesi Sheets'te elle silinmediği
-- sürece dokunulmadan durur — yalnızca artık hiçbir yeni satır oraya YAZILMIYOR.

alter table hub_sheet_config alter column lab_sheet_name set default 'Lab Başvuruları';

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
    else coalesce(nullif(cfg.lab_sheet_name, ''), 'Lab Başvuruları') end;
  begin
    perform hub_sheet_post_batch(target_sheet, jsonb_build_array(hub_sheet_row(new)));
  exception when others then
    update hub_sheet_config set last_error = left(sqlerrm, 300) where id = 1;
  end;
  return new;
end $$;

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
  sh_lab := coalesce(nullif(cfg.lab_sheet_name, ''), 'Lab Başvuruları');

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

-- Mevcut satırın kendisini de güncelle (default yalnızca YENİ satırlara uygulanır).
update hub_sheet_config set lab_sheet_name = 'Lab Başvuruları' where id = 1 and coalesce(lab_sheet_name, '') in ('', 'Sayfa1');
