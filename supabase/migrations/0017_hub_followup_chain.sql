-- ══════════════════════════════════════════════════════════
-- 0017_hub_followup_chain.sql — takip zinciri (PROMPT_V3 E2)
-- ══════════════════════════════════════════════════════════
-- hub_touches.step_no   : zincirdeki adım (1 = insanın attığı ilk mesaj,
--                         2 = gün 4 hatırlatma, 3 = gün 8 son hatırlatma).
-- hub_templates.sequence_key : aynı zincire ait şablonları gruplar; hub-daily
--                         adım N için sequence_key grubunun (N-1). şablonunu
--                         Bugün ekranına görev metni olarak hazırlar.
-- Otomatik GÖNDERİM YOK — yalnızca hazırlar. Idempotent.

alter table hub_touches
  add column if not exists step_no int not null default 1;

alter table hub_templates
  add column if not exists sequence_key text;

comment on column hub_touches.step_no is 'E2: takip zinciri adımı (1 ilk mesaj, 2 gün-4, 3 gün-8).';
comment on column hub_templates.sequence_key is 'E2: aynı takip zincirinin şablonlarını gruplar.';
