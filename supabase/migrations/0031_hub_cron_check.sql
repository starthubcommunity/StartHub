-- ══════════════════════════════════════════════════════════
-- 0031_hub_cron_check.sql — 0015'in gerçekten planlandığını doğrulamak için
-- ══════════════════════════════════════════════════════════
create or replace function hub_cron_check()
returns table(jobname text, schedule text, active boolean)
language sql stable security definer set search_path = public, cron as $$
  select jobname, schedule, active from cron.job where jobname like 'hub-%';
$$;
