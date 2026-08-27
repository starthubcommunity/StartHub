-- ══════════════════════════════════════════════════════════
-- 0002_hub_stage_clock.sql — Bayatlama sayacı için ayrı zaman kolonu
-- 0001 çalıştırıldıktan sonra eklenir (HUB_SPEC §6).
-- ══════════════════════════════════════════════════════════

alter table hub_candidates
  add column if not exists stage_changed_at timestamptz not null default now();

-- Mevcut kayıtlar (varsa) için makul başlangıç
update hub_candidates
   set stage_changed_at = coalesce(updated_at, created_at)
 where stage_changed_at is null;

create index if not exists hub_cand_stageclock_idx
  on hub_candidates(stage, stage_changed_at);
