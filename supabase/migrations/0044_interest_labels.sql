-- ══════════════════════════════════════════════════════════
-- 0044_interest_labels.sql — Katıl formundaki "ilgi alanı" seçenek metinleri
-- artık HR'dan (ve admin panelden) düzenlenebilir.
-- ══════════════════════════════════════════════════════════
-- Karar (2026-09-23): kullanıcı HR'dan basit bir alan istedi — ilgi alanı
-- seçeneklerinin (Frontend/Backend/Tasarım…) TR metinlerini ve ilgi alanı
-- sorusunu (zaten var olan field_labels.c_role) tek bir yerden değiştirebilsin.
-- Yeni kolon nullable; boşsa kod içindeki sabit TR etiketler (JOIN_INTERESTS,
-- other-pages.jsx) kullanılmaya devam eder — hiçbir zaman boş görünmez.
-- Şekil: { frontend: "Frontend", backend: "Backend", ... } — yalnızca
-- değiştirilen anahtarlar yazılır, eksik anahtar sabit karşılığına düşer.

alter table join_form_settings add column if not exists interest_labels jsonb;
