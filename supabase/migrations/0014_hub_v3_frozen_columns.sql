-- ══════════════════════════════════════════════════════════
-- 0014_hub_v3_frozen_columns.sql — v3'te yazımı duran kolonlar (A4, A7)
-- ══════════════════════════════════════════════════════════
-- Bu migration ŞEMA DEĞİŞTİRMEZ. Yalnızca comment düşer: aşağıdaki kolonlara
-- uygulama artık YAZMIYOR ama veri kaybı riski olduğu için DROP EDİLMEDİ.
-- Gerçek drop, kullanılmadığı doğrulandıktan sonra ayrı bir migration'da ve
-- teyitle yapılacak (PROMPT_V3 §Çalışma biçimi). Idempotent.

-- A4 — kırmızı bayrak mekanizması kaldırıldı
comment on column hub_candidates.red_flags is
  'DONDURULDU v3 (A4): UI yazmıyor, kural motoru okumuyor. Yerine interview_note. Drop ileride.';
comment on column hub_candidates.flag_notes is
  'DONDURULDU v3 (A4): UI yazmıyor. Drop ileride.';
comment on column hub_candidates.override_reason is
  'v3 (A4): bayrak override''ı kaldırıldı. Yalnızca canAdvance() aşama-atlama override''ında OKUNUR; UI yazmıyor.';

-- A7 — next_action artık türetiliyor (hub-rules.js nextAction())
comment on column hub_candidates.next_action is
  'DONDURULDU v3 (A7): türetiliyor (nextAction()). UI/mapper yazmıyor. Drop ileride.';
comment on column hub_candidates.next_action_at is
  'DONDURULDU v3 (A7): mapper okumuyor/yazmıyor. Drop ileride.';
comment on column hub_candidates.next_action_link is
  'DONDURULDU v3 (A7): mapper okumuyor/yazmıyor. Drop ileride.';
