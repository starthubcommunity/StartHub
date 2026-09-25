-- ══════════════════════════════════════════════════════════
-- 0047_hub_candidate_sort_order.sql — Adaylar listesinde elle sıralama
-- ══════════════════════════════════════════════════════════
-- Kullanıcı adayları sürükleyip bırakarak sıralayabilmek istedi. NULL =
-- henüz elle sıralanmamış (varsayılan: inbound-önce + en yeni sırası
-- geçerli kalır, candidates-list.jsx'te client-side). Bir kez sürüklenince
-- o an görünen satırlar için ardışık bir değer yazılır.
-- Idempotent; drop column yok.

alter table hub_candidates add column if not exists sort_order integer;
