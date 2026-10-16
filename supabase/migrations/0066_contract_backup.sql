-- 0066_contract_backup.sql — "Sözleşme kayıtlarını indir" (D3)
-- Son yedeğin zamanı ve kimin aldığı; HR Bugün 14 günde bir "yedek al" hatırlatır.
-- Yalnızca sunucu (equity-contract, servis rolü) yazar. İndirme olayının kendisi equity_events'e
-- ayrıca 'note' olarak yazılır (kim, ne zaman, kaç kayıt).
alter table contract_settings
  add column last_backup_at timestamptz,
  add column last_backup_by text;

-- GERİ ALMA: alter table contract_settings drop column last_backup_at, drop column last_backup_by;
