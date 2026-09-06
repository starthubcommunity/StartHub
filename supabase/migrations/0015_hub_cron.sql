-- ══════════════════════════════════════════════════════════
-- 0015_hub_cron.sql — hub-daily / hub-weekly zamanlaması (HUB_SPEC v3 §12.1)
-- _deferred/0004_hub_cron.sql'in yerini alır (o dosya silindi).
-- ══════════════════════════════════════════════════════════
-- ÖNKOŞULLAR (bu dosyayı çalıştırmadan önce):
--   1. hub-daily ve hub-weekly edge function'ları DEPLOY edilmiş olmalı.
--   2. Fonksiyonlar ELLE tetiklenip çıktısının GERÇEK sayı döndürdüğü
--      doğrulanmış olmalı (0011 sonrası aşama adları: contact/interview/trial/
--      member). Doğrulamadan cron açılırsa fonksiyon her gece çalışır ama
--      hiçbir şey bulmaz.
--   3. Supabase Vault'a iki secret eklenmiş olmalı (Dashboard → Project
--      Settings → Vault):
--        - name: project_url        value: https://<PROJECT_REF>.supabase.co
--        - name: service_role_key   value: <service role anahtarı>
--   pg_cron + pg_net Supabase'de yüklüdür.
--
-- Idempotent: mevcut job'ları önce kaldırır.

do $$ begin perform cron.unschedule('hub-daily');  exception when others then null; end $$;
do $$ begin perform cron.unschedule('hub-weekly'); exception when others then null; end $$;

select cron.schedule(
  'hub-daily',
  '0 3 * * *',                                   -- her gece 03:00 UTC
  $CRON$
  select net.http_post(
    url     := (select decrypted_secret from vault.decrypted_secrets where name = 'project_url')
               || '/functions/v1/hub-daily',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' ||
        (select decrypted_secret from vault.decrypted_secrets where name = 'service_role_key')
    ),
    body    := '{}'::jsonb
  );
  $CRON$
);

select cron.schedule(
  'hub-weekly',
  '0 8 * * 1',                                   -- pazartesi 08:00 UTC
  $CRON$
  select net.http_post(
    url     := (select decrypted_secret from vault.decrypted_secrets where name = 'project_url')
               || '/functions/v1/hub-weekly',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' ||
        (select decrypted_secret from vault.decrypted_secrets where name = 'service_role_key')
    ),
    body    := '{}'::jsonb
  );
  $CRON$
);

-- Kontrol:  select jobname, schedule, active from cron.job where jobname like 'hub-%';
