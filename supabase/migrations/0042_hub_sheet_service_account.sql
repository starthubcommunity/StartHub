-- ══════════════════════════════════════════════════════════
-- 0042_hub_sheet_service_account.sql — Hub Başvuru Tablosu: Apps Script yerine
-- Google servis hesabı (tam otomatik, kullanıcı elle kurulum yapmaz).
-- ══════════════════════════════════════════════════════════
-- Karar (2026-09-22, kullanıcı onayı ile): 0041'deki Apps Script web-uygulaması
-- yöntemi (kullanıcı Google Sheets'te elle Apps Script yapıştırıp yayınlıyordu)
-- yerine, `hub-sheet-sync` edge function'ı bir Google servis hesabıyla doğrudan
-- Sheets API'ye yazıyor. Kullanıcı yalnızca BİR KEZ tabloyu servis hesabı
-- e-postasıyla paylaşır; ID (spreadsheet_id) HR › Ayarlar'a yapıştırılır.
--
-- Servis hesabı anahtarı (GOOGLE_SA_EMAIL, GOOGLE_SA_PRIVATE_KEY) tarayıcıya
-- KONMAZ — yalnızca edge function secret'ı (`supabase secrets set`), Vault'taki
-- `service_role_key` ile aynı prensip (bkz. 0015_hub_cron.sql).
--
-- webhook_url / secret kolonları DB'de duruyor ama artık kullanılmıyor (drop yok,
-- proje kuralı). spreadsheet_id boşken tetikleyici hiçbir şey yapmaz.

alter table hub_sheet_config add column if not exists spreadsheet_id       text;
alter table hub_sheet_config add column if not exists sheet_name          text default 'Hub Başvuruları';
alter table hub_sheet_config add column if not exists service_account_email text;  -- gizli değil, yalnızca paylaşım için gösterilir

-- ── INSERT tetikleyicisi: edge function'ı service-role ile çağır ─────
create or replace function applications_to_hub_sheet() returns trigger
language plpgsql security definer set search_path = public as $$
declare
  cfg hub_sheet_config%rowtype;
begin
  if not is_hub_application(new) then return new; end if;
  select * into cfg from hub_sheet_config where id = 1;
  if cfg.enabled is not true or coalesce(cfg.spreadsheet_id, '') = '' then return new; end if;
  begin
    perform net.http_post(
      url     := (select decrypted_secret from vault.decrypted_secrets where name = 'project_url')
                 || '/functions/v1/hub-sheet-sync',
      headers := jsonb_build_object(
        'Content-Type', 'application/json',
        'Authorization', 'Bearer ' ||
          (select decrypted_secret from vault.decrypted_secrets where name = 'service_role_key')
      ),
      body    := jsonb_build_object('rows', jsonb_build_array(hub_sheet_row(new)))
    );
  exception when others then
    update hub_sheet_config set last_error = left(sqlerrm, 300) where id = 1;
  end;
  return new;
end $$;

-- ── HR'dan: test satırı gönder ───────────────────────────────────────
create or replace function hub_sheet_test() returns text
language plpgsql security definer set search_path = public as $$
declare
  cfg hub_sheet_config%rowtype;
begin
  if not has_perm('settings.write') then raise exception 'Yetkin yok'; end if;
  select * into cfg from hub_sheet_config where id = 1;
  if coalesce(cfg.spreadsheet_id, '') = '' then raise exception 'Önce tablo ID''sini kaydet'; end if;
  perform net.http_post(
    url     := (select decrypted_secret from vault.decrypted_secrets where name = 'project_url')
               || '/functions/v1/hub-sheet-sync',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' ||
        (select decrypted_secret from vault.decrypted_secrets where name = 'service_role_key')
    ),
    body    := jsonb_build_object('rows', jsonb_build_array(jsonb_build_object(
      'id', 'TEST-' || to_char(now(), 'YYYYMMDDHH24MISS'),
      'created_at', now(), 'type', 'TEST', 'name', 'Test Başvurusu (silebilirsin)',
      'email', 'test@example.com', 'phone', '', 'university', '', 'department', '',
      'unit', '', 'organization', '', 'detail', 'HR''dan gönderilen bağlantı testi', 'status', 'Yeni')))
  );
  return 'ok';
end $$;

-- ── HR'dan: mevcut HUB başvurularını tabloya aktar (edge function ID'ye göre tekrarı eler) ──
create or replace function hub_sheet_backfill() returns integer
language plpgsql security definer set search_path = public as $$
declare
  cfg hub_sheet_config%rowtype;
  r   applications;
  buf jsonb := '[]'::jsonb;
  n   integer := 0;
  purl text;
  auth text;
begin
  if not has_perm('settings.write') then raise exception 'Yetkin yok'; end if;
  select * into cfg from hub_sheet_config where id = 1;
  if coalesce(cfg.spreadsheet_id, '') = '' then raise exception 'Önce tablo ID''sini kaydet'; end if;

  select decrypted_secret into purl from vault.decrypted_secrets where name = 'project_url';
  select 'Bearer ' || decrypted_secret into auth from vault.decrypted_secrets where name = 'service_role_key';

  for r in select * from applications a where is_hub_application(a) order by a.created_at loop
    buf := buf || jsonb_build_array(hub_sheet_row(r));
    n := n + 1;
    if jsonb_array_length(buf) >= 100 then
      perform net.http_post(
        url := purl || '/functions/v1/hub-sheet-sync',
        headers := jsonb_build_object('Content-Type', 'application/json', 'Authorization', auth),
        body := jsonb_build_object('rows', buf));
      buf := '[]'::jsonb;
    end if;
  end loop;
  if jsonb_array_length(buf) > 0 then
    perform net.http_post(
      url := purl || '/functions/v1/hub-sheet-sync',
      headers := jsonb_build_object('Content-Type', 'application/json', 'Authorization', auth),
      body := jsonb_build_object('rows', buf));
  end if;
  return n;
end $$;
