-- ══════════════════════════════════════════════════════════
-- 0058_hub_role_requests.sql — Team Lead'in kişi talebi geri geliyor
-- ══════════════════════════════════════════════════════════
-- 0010 (2026-09-01) talep akışını kaldırmıştı. Gerekçe (HUB_SPEC v2 §10.1):
-- proje sahibi HR'a girip rolü KENDİSİ açıyordu (project_owner'da
-- roles.create vardı), ayrı bir talep/onay el sıkışması gereksizdi.
-- 2026-09-23'ten beri proje sahibi HR'a GİREMİYOR (ProjectOwnerRedirectPage)
-- → lead'in rol açmanın hiçbir yolu kalmadı; gerekçe artık geçerli değil.
-- StartHub_Aday_Bulma_Senaryosu Bölüm G m.1-2: lead Team Management'tan
-- talep açar, durumu görür (talep edildi → aranıyor → kısa liste → dolduruldu).
--
-- Akış: Team App (hub-team-role-request, lead JWT) → ana proje
-- (hub-role-request, x-hub-bridge-key) → hub_open_roles satırı
-- status='requested'. Recruiter HR'da yayına alır (sourcing) ya da taslağa
-- çeker. Yalnızca ekleme — mevcut satırlara dokunulmaz, kolon düşürülmez.

alter table hub_open_roles drop constraint if exists hub_open_roles_status_check;
alter table hub_open_roles
  add constraint hub_open_roles_status_check
  check (status in ('requested','draft','sourcing','shortlist','filled'));

alter table hub_open_roles
  add column if not exists requested_by_email text,
  add column if not exists requested_by_name  text,
  add column if not exists requested_at       timestamptz;

create index if not exists hub_open_roles_requested_idx
  on hub_open_roles(requested_at desc) where status = 'requested';
