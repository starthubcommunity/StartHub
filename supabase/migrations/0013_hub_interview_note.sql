-- ══════════════════════════════════════════════════════════
-- 0013_hub_interview_note.sql — Görüşme notu (PROMPT_V3 A4)
-- ══════════════════════════════════════════════════════════
-- Kırmızı bayraklar (red_flags / flag_notes) v3'te kaldırıldı; yerine aday
-- kartında tek serbest "Görüşme notu" alanı geldi. Bu migration o kolonu ekler.
-- Eski bayrak kolonları DÜŞÜRÜLMEZ (bkz. 0014) — yalnızca UI yazmayı bırakır.
-- Idempotent.

alter table hub_candidates
  add column if not exists interview_note text;

comment on column hub_candidates.interview_note is
  'v3 (PROMPT_V3 A4): görüşme sonrası tek serbest not. red_flags/flag_notes''un yerine. İlerlemeyi engellemez.';
