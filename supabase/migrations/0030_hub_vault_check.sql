-- ══════════════════════════════════════════════════════════
-- 0030_hub_vault_check.sql — cron (0015) önkoşulunu doğrulamak için
-- ══════════════════════════════════════════════════════════
-- Vault'ta 'project_url'/'service_role_key' secret'larının GERÇEKTEN
-- ayarlanmış olup olmadığını, DEĞERLERİNİ HİÇ DÖNDÜRMEDEN kontrol eder.
-- Tanı amaçlı — kalıcı bir özellik değil, ileride ops kontrolü için
-- faydalıysa kalabilir.

create or replace function hub_vault_check()
returns table(name text, exists_ boolean)
language sql stable security definer set search_path = public, vault as $$
  select n, exists(select 1 from vault.decrypted_secrets where vault.decrypted_secrets.name = n)
  from unnest(array['project_url','service_role_key']) as n;
$$;
