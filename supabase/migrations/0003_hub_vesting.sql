-- ══════════════════════════════════════════════════════════
-- 0003_hub_vesting.sql — Hak ediş ve katılım tarihi
-- 0001 + 0002 çalıştırıldıktan sonra eklenir (HUB_SPEC §6).
-- Hak ediş başlangıcı hisseyi belirleyen tarihtir; log metnine gömülmez.
-- Katılım tarihi "90 günde hâlâ aktif" metriğinin dayanağıdır.
-- ══════════════════════════════════════════════════════════

alter table hub_candidates
  add column if not exists joined_at          timestamptz,
  add column if not exists vesting_start_date date;

comment on column hub_candidates.vesting_start_date is
  'Hak ediş başlangıcı — Kapı A''nın ilk günü, geriye dönük.';

create index if not exists hub_cand_joined_idx
  on hub_candidates(joined_at) where joined_at is not null;
