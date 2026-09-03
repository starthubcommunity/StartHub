-- ══════════════════════════════════════════════════════════
-- 0011_hub_stage_values.sql — v2 aşama değerleri: şema + VERİ migrasyonu
-- 0010'dan SONRA. 0001'deki eski 8-aşama check kısıtı ve eski veriyi düzeltir.
-- ══════════════════════════════════════════════════════════
-- Sorun: 0001 `hub_candidates.stage` check'i hâlâ eski değerlerde
-- (contacted/replied/interviewed/finalist/gate_a/gate_b/joined). v2 kodu
-- 'contact'/'interview'/'trial'/'member' yazınca hub_candidates_stage_check
-- ihlali. Ayrıca DB'de eski değerli satırlar var — bunlar taşınmalı.
-- Idempotent, tekrar çalıştırılabilir.

-- ── 1. hub_candidates.stage ────────────────────────────────
alter table hub_candidates drop constraint if exists hub_candidates_stage_check;

update hub_candidates set stage = 'contact'   where stage in ('contacted', 'replied');
update hub_candidates set stage = 'interview' where stage = 'interviewed';
update hub_candidates set stage = 'trial'     where stage in ('finalist', 'gate_a', 'gate_b');
update hub_candidates set stage = 'member'    where stage = 'joined';

alter table hub_candidates
  add constraint hub_candidates_stage_check
  check (stage in ('pool', 'contact', 'interview', 'trial', 'member', 'archived'));

-- ── 2. archive_reason — v2 'gate_failed' eklendi ───────────
alter table hub_candidates drop constraint if exists hub_candidates_archive_reason_check;
alter table hub_candidates
  add constraint hub_candidates_archive_reason_check
  check (archive_reason in ('no_reply', 'not_interested', 'no_time', 'below_bar', 'we_passed', 'gate_failed'));

-- ── 3. hub_stage_log — check kısıtı yok ama veri tutarlılığı ─
-- (metrikler / dönüşüm oranı bu kolonlardan hesaplıyor)
update hub_stage_log set to_stage = 'contact'   where to_stage in ('contacted', 'replied');
update hub_stage_log set to_stage = 'interview' where to_stage = 'interviewed';
update hub_stage_log set to_stage = 'trial'     where to_stage in ('finalist', 'gate_a', 'gate_b');
update hub_stage_log set to_stage = 'member'    where to_stage = 'joined';

update hub_stage_log set from_stage = 'contact'   where from_stage in ('contacted', 'replied');
update hub_stage_log set from_stage = 'interview' where from_stage = 'interviewed';
update hub_stage_log set from_stage = 'trial'     where from_stage in ('finalist', 'gate_a', 'gate_b');
update hub_stage_log set from_stage = 'member'    where from_stage = 'joined';
