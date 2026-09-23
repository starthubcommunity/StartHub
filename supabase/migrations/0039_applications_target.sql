-- ══════════════════════════════════════════════════════════
-- 0039_applications_target.sql — Katıl formu: "Topluluk mu, Startup mı?" seçimi
-- ══════════════════════════════════════════════════════════
-- Katıl sayfasında Topluluğa Katıl / Mentör Ol / Destekçi Ol kartlarının altına
-- iki seçenek geldi (Hub = topluluk, Lab = startup). Seçim `applications.target`
-- kolonuna yazılır: 'community' | 'startup'. Mentör/destekçi için hangi startup
-- seçildiyse mevcut project_id / project_name kolonları kullanılır.
-- Nullable, drop yok; eski başvurularda NULL kalır. Idempotent.

alter table applications
  add column if not exists target text;   -- 'community' | 'startup'
