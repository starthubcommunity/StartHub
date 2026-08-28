-- ══════════════════════════════════════════════════════════
-- 0004_hub_cron.sql — hub-daily / hub-weekly zamanlaması (HUB_SPEC §10)
-- ══════════════════════════════════════════════════════════
-- ÖNKOŞUL: hub-daily ve hub-weekly edge function'ları deploy edilmiş olmalı.
-- <PROJECT_REF> yerine Supabase proje referansını yaz; servis anahtarını
-- Vault'tan çek (aşağıdaki örnek current_setting ile).
--
-- Supabase'de pg_cron + pg_net zaten yüklüdür. Bu blok idempotent değildir —
-- tekrar çalıştırmadan önce cron.unschedule ile eski job'u kaldır.

-- select cron.unschedule('hub-daily');
-- select cron.unschedule('hub-weekly');

select cron.schedule(
  'hub-daily',
  '0 3 * * *',                                   -- her gece 03:00 UTC
  $$
  select net.http_post(
    url     := 'https://<PROJECT_REF>.functions.supabase.co/hub-daily',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || current_setting('app.settings.service_role_key', true)
    ),
    body    := '{}'::jsonb
  );
  $$
);

select cron.schedule(
  'hub-weekly',
  '0 8 * * 1',                                   -- pazartesi 08:00 UTC
  $$
  select net.http_post(
    url     := 'https://<PROJECT_REF>.functions.supabase.co/hub-weekly',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || current_setting('app.settings.service_role_key', true)
    ),
    body    := '{}'::jsonb
  );
  $$
);
