-- ══════════════════════════════════════════════════════════
-- 0052_equity.sql — Pay / vesting (hak ediş) kayıtları
-- ══════════════════════════════════════════════════════════
-- Kaynak: Start-Hub_Equity_Governance_Framework.md + Vesting_Kurallari.
-- Pay verisi Team App'in app_state JSON blob'una KONMAZ — burada, ana
-- projede, normalize tablolarda + RLS + denetim iziyle durur.
--
-- Bu tablolar yalnızca SÖZÜ (taahhüdü) ve olayları saklar; "şu an ne kadar
-- kazanıldı" bilgisi SAKLANMAZ, her seferinde src/lib/equity-rules.js
-- hesaplar (tek doğruluk kaynağı = kurallar + tarihler). İstisna:
-- ayrılma anında donan kazanılmış pay (vested_at_end) — koltuk bütçesinden
-- kalıcı düşen miktar budur (Kural 4b), sonradan kural değişse de oynamamalı.
--
-- Yazma: yalnızca equity.manage (cofounder). Okuma: equity.read.
-- Team App kullanıcıları ("Payım") bu tablolara DOĞRUDAN erişmez — ayrı
-- Supabase projesinde oturum açtıkları için RLS onları tanımaz; bir köprü
-- fonksiyonu yalnızca o kişinin kendi satırlarını döndürür (Adım 5).

-- ── Koltuk (seat) — bir projedeki role ayrılan TOPLAM pay tavanı ─────
create table equity_seats (
  id               uuid primary key default gen_random_uuid(),
  startup_id       bigint not null,            -- startups.id (hub_open_roles ile aynı: FK yok)
  title            text not null,              -- "Team Lead", "Mobil geliştirici"
  seat_kind        text not null check (seat_kind in
                     ('lead','member_critical','member_standard','member_support','mentor','cto')),
  budget_pct       numeric(6,3) not null check (budget_pct > 0 and budget_pct <= 100),
  -- Kural 4b: bütçe biterse Start-Hub onayıyla Gelecek Katılımcı Rezervi'nden takviye
  reserve_topup_pct numeric(6,3) not null default 0 check (reserve_topup_pct >= 0),
  open_role_id     uuid references hub_open_roles(id) on delete set null,
  note             text,
  active           boolean not null default true,   -- koltuk kapatılır, silinmez
  created_at       timestamptz not null default now(),
  created_by       text default (auth.jwt() ->> 'email')
);
create index equity_seats_startup_idx on equity_seats(startup_id);

-- ── Pay sözü (grant) — bir kişinin bir koltuktaki taahhüdü ───────────
create table equity_grants (
  id                   uuid primary key default gen_random_uuid(),
  seat_id              uuid not null references equity_seats(id) on delete restrict,
  holder_name          text not null,
  holder_email         text not null,          -- "Payım" eşlemesi (Team App oturum e-postası)
  hub_candidate_id     uuid references hub_candidates(id) on delete set null,
  grant_pct            numeric(6,3) not null check (grant_pct > 0 and grant_pct <= 100),
  -- 'lead_hybrid' = zaman tabanı + kilometre taşı hızlandırma (Kural 2)
  -- 'time'        = yalnızca zamana bağlı (üye, mentor, CTO — Kural 3/6)
  schedule             text not null check (schedule in ('lead_hybrid','time')),
  vest_months          int not null check (vest_months between 1 and 60),
  cliff_months         int not null default 6 check (cliff_months between 0 and 24),
  milestone_bonus_pct  numeric(6,3) not null default 5 check (milestone_bonus_pct >= 0),
  start_date           date not null,
  -- Kural 8: sözleşme öncesi çalışmaya en fazla 3 ay geriye dönük kredi
  retro_credit_months  int not null default 0 check (retro_credit_months between 0 and 3),
  retro_credit_note    text,
  status               text not null default 'active' check (status in
                         ('active','left_good','left_bad','removed')),
  ended_at             date,
  vested_at_end        numeric(6,3),           -- ayrılınca donan kazanılmış pay
  clawed_back          boolean not null default false,  -- Kural 10: ağır ihlalde nominal fiyattan geri alım
  -- Kural 7 (çift şart): satış/devir + 12 ay içinde haksız çıkarma → tamamı açılır
  accelerated_at       date,
  acceleration_note    text,
  note                 text,
  created_at           timestamptz not null default now(),
  created_by           text default (auth.jwt() ->> 'email'),
  check ((status = 'active') = (ended_at is null)),
  check (status = 'active' or vested_at_end is not null),
  check (not clawed_back or status in ('left_bad','removed'))
);
create index equity_grants_seat_idx  on equity_grants(seat_id);
create index equity_grants_email_idx on equity_grants(lower(holder_email));

-- ── Projenin kilometre taşları (Lider hızlandırması — Kural 2) ───────
create table equity_milestones (
  id           uuid primary key default gen_random_uuid(),
  startup_id   bigint not null,
  kind         text not null check (kind in ('mvp','first_user','first_revenue','incorporation')),
  achieved_at  date not null,
  note         text,
  created_at   timestamptz not null default now(),
  created_by   text default (auth.jwt() ->> 'email'),
  unique (startup_id, kind)
);

-- ── Olaylar + denetim izi (Kural 11-12, append-only) ─────────────────
create table equity_events (
  id           uuid primary key default gen_random_uuid(),
  grant_id     uuid references equity_grants(id) on delete restrict,
  seat_id      uuid references equity_seats(id) on delete restrict,
  startup_id   bigint,
  kind         text not null check (kind in (
                 'info_notice',        -- 1. adım: bilgilendirme
                 'written_warning',    -- 2. adım: yazılı uyarı + düzeltme süresi
                 'review',             -- 3. adım: değerlendirme
                 'decision',           -- kalsın / rol değişsin / çıkarılsın
                 'starthub_review',    -- Kural 12: 30 gün kontrolü
                 'note',
                 'audit')),            -- tetikleyiciyle otomatik: satır değişikliği
  task_ref     text,                   -- hangi görev
  task_due     date,                   -- görevin bitmesi gereken tarih
  fix_deadline date,                   -- düzeltme süresi sonu (7-10 gün)
  outcome      text check (outcome in ('stay','role_change','remove')),
  note         text,
  payload      jsonb,
  happened_at  timestamptz not null default now(),
  created_by   text default (auth.jwt() ->> 'email')
);
create index equity_events_grant_idx on equity_events(grant_id, happened_at);

-- ── Denetim tetikleyicisi: her insert/update/delete equity_events'e yazılır
create or replace function equity_audit() returns trigger
language plpgsql security definer set search_path = public as $$
declare
  v_new jsonb := case when tg_op = 'DELETE' then null else to_jsonb(new) end;
  v_old jsonb := case when tg_op = 'INSERT' then null else to_jsonb(old) end;
  v_row jsonb := coalesce(v_new, v_old);
begin
  insert into equity_events (grant_id, seat_id, startup_id, kind, payload)
  values (
    case when tg_table_name = 'equity_grants' and tg_op <> 'DELETE' then (v_row->>'id')::uuid end,
    case when tg_table_name = 'equity_seats'  and tg_op <> 'DELETE' then (v_row->>'id')::uuid
         when tg_table_name = 'equity_grants' then (v_row->>'seat_id')::uuid end,
    (v_row->>'startup_id')::bigint,
    'audit',
    jsonb_build_object('table', tg_table_name, 'op', tg_op, 'old', v_old, 'new', v_new)
  );
  return coalesce(new, old);
end $$;

create trigger equity_seats_audit      after insert or update or delete on equity_seats
  for each row execute function equity_audit();
create trigger equity_grants_audit     after insert or update or delete on equity_grants
  for each row execute function equity_audit();
create trigger equity_milestones_audit after insert or update or delete on equity_milestones
  for each row execute function equity_audit();

-- ── Yetki anahtarları — yalnızca cofounder ─────────────────────────────
insert into permission_keys (area, key, grp, label, sort_order) values
  ('hub','equity.read','Pay','Pay sözlerini görüntüle',99),
  ('hub','equity.manage','Pay','Pay sözü / koltuk / kilometre taşı düzenle',100)
on conflict (area, key) do nothing;

insert into permission_presets (area, role, key) values
  ('hub','cofounder','equity.read'), ('hub','cofounder','equity.manage')
on conflict do nothing;

-- ── RLS ────────────────────────────────────────────────────────────────
alter table equity_seats      enable row level security;
alter table equity_grants     enable row level security;
alter table equity_milestones enable row level security;
alter table equity_events     enable row level security;

create policy eq_seats_read  on equity_seats for select using (has_perm('equity.read'));
create policy eq_seats_ins   on equity_seats for insert with check (has_perm('equity.manage'));
create policy eq_seats_upd   on equity_seats for update using (has_perm('equity.manage')) with check (has_perm('equity.manage'));

create policy eq_grants_read on equity_grants for select using (has_perm('equity.read'));
create policy eq_grants_ins  on equity_grants for insert with check (has_perm('equity.manage'));
create policy eq_grants_upd  on equity_grants for update using (has_perm('equity.manage')) with check (has_perm('equity.manage'));

create policy eq_ms_read     on equity_milestones for select using (has_perm('equity.read'));
create policy eq_ms_ins      on equity_milestones for insert with check (has_perm('equity.manage'));
create policy eq_ms_upd      on equity_milestones for update using (has_perm('equity.manage')) with check (has_perm('equity.manage'));
create policy eq_ms_del      on equity_milestones for delete using (has_perm('equity.manage'));

-- Olaylar append-only: update/delete politikası YOK (denetim izi değiştirilemez).
create policy eq_ev_read     on equity_events for select using (has_perm('equity.read'));
create policy eq_ev_ins      on equity_events for insert with check (has_perm('equity.manage') and kind <> 'audit');

-- Koltuk ve pay sözü SİLİNMEZ (delete politikası yok) — kapatılır/sonlandırılır.
