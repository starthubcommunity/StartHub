-- ══════════════════════════════════════════════════════════
-- 0005_hub_roles.sql — Roller ve iki hat (HUB_SPEC v2 §10)
-- 0001–0003 çalıştırıldıktan sonra eklenir. (0004 ertelendi: _deferred/)
-- ══════════════════════════════════════════════════════════
-- v2 sadeleştirmesi: talep/onay el sıkışması kaldırıldı — rol doğrudan
-- 'sourcing'e düşer. requested/paused/cancelled durumları ve
-- requested_by/requested_at/accepted_at kolonları çıkarıldı.
-- Not: hub_role_log tablosu bırakıldı (0009 RLS'i ona bağlı) ama v2'de
-- uygulama ona yazmaz — ölü tablo. Canlı DB için değişiklikler
-- 0010_hub_simplify.sql'de incremental olarak da uygulanır.

-- Açık roller: arama girdileri (talep akışı yok)
alter table hub_open_roles
  add column if not exists status text not null default 'draft'
      check (status in ('draft','sourcing','shortlist','filled')),
  add column if not exists track text not null default 'member'
      check (track in ('founder','member')),
  add column if not exists needs_communication boolean not null default false,
  add column if not exists weekly_hours      int,
  add column if not exists duration_months   int,
  add column if not exists first_deliverable text,
  add column if not exists team_size         int,
  add column if not exists assigned_to uuid references hub_members(id),
  add column if not exists filled_at    timestamptz;

create index if not exists hub_role_status_idx on hub_open_roles(status);
create index if not exists hub_role_assigned_idx on hub_open_roles(assigned_to);

-- Adaylar: hat ve proje sahibi kararı
alter table hub_candidates
  add column if not exists track text not null default 'founder'
      check (track in ('founder','member')),
  add column if not exists presented_at timestamptz,
  add column if not exists owner_decision text
      check (owner_decision in ('pending','accepted','rejected')),
  add column if not exists owner_decision_note text;

create index if not exists hub_cand_presented_idx
  on hub_candidates(presented_at) where presented_at is not null;

-- Rol durum günlüğü — v2'de KULLANILMIYOR (uygulama yazmaz). Tablo, 0009
-- RLS politikaları ona bağlı olduğu için bırakıldı; ileride geri gelebilir.
create table if not exists hub_role_log (
  id         uuid primary key default gen_random_uuid(),
  role_id    uuid not null references hub_open_roles(id) on delete cascade,
  from_status text,
  to_status   text not null,
  note        text,
  actor_id    uuid references hub_members(id),
  created_at  timestamptz not null default now()
);

alter table hub_role_log enable row level security;
create policy hub_rolelog_all on hub_role_log for all
  using (is_hub_member()) with check (is_hub_member());
