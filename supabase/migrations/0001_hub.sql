-- ══════════════════════════════════════════════════════════
-- 0001_hub.sql — Kurucu Hattı
-- ══════════════════════════════════════════════════════════

-- ── Üyelik / yetki ────────────────────────────────────────
create table hub_members (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid unique references auth.users(id) on delete cascade,
  email       text not null unique,
  full_name   text,
  role        text not null default 'recruiter'
              check (role in ('cofounder','recruiter','project_owner')),
  -- project_owner kapsamı: startups.id değerleri (bigint — uuid DEĞİL).
  -- Kapsam projeye bağlanır, açık role değil: projeye yeni rol eklendiğinde
  -- o rolün adayları sahibine görünmeye devam etsin.
  startup_ids bigint[] default '{}',
  active      boolean not null default true,
  created_at  timestamptz not null default now()
);

-- Yetki E-POSTA üzerinden çözülür, user_id üzerinden değil.
-- Sebep: bir kişiyi Supabase hesabı açmadan ÖNCE yetkilendirebilmek gerekir.
-- user_id yine de doldurulur (aşağıdaki tetikleyici ile), ama yetkinin
-- kaynağı e-postadır. Her iki eşleşme de kabul edilir.
create or replace function hub_role() returns text
language sql stable security definer set search_path = public, auth as $$
  select role from hub_members
   where active = true
     and (user_id = auth.uid()
          or lower(email) = lower(coalesce(auth.jwt() ->> 'email', '')))
   limit 1
$$;

create or replace function is_hub_member() returns boolean
language sql stable security definer set search_path = public, auth as $$
  select hub_role() is not null
$$;

-- project_owner'ın kapsamındaki projeler (startups.id listesi)
create or replace function hub_my_startups() returns bigint[]
language sql stable security definer set search_path = public, auth as $$
  select coalesce(startup_ids, '{}') from hub_members
   where active = true
     and (user_id = auth.uid()
          or lower(email) = lower(coalesce(auth.jwt() ->> 'email', '')))
   limit 1
$$;

-- Hesap İLK OLUŞTURULDUĞUNDA user_id'yi otomatik bağlar (girişte değil —
-- tetikleyici yalnızca auth.users'a insert'te çalışır). Zaten hesabı olanlar
-- aşağıdaki manuel update ile bağlanır. Her iki durumda da yetkinin kaynağı
-- e-postadır; user_id yalnızca kolaylık alanıdır, dolmamış olması yetkiyi
-- etkilemez.
create or replace function hub_link_user() returns trigger
language plpgsql security definer set search_path = public, auth as $$
begin
  update hub_members
     set user_id = new.id
   where user_id is null
     and lower(email) = lower(new.email);
  return new;
end $$;

drop trigger if exists hub_link_user_trg on auth.users;
create trigger hub_link_user_trg
after insert on auth.users
for each row execute function hub_link_user();

-- ── Açık roller (projelerin aradığı pozisyonlar) ──────────
create table hub_open_roles (
  id          uuid primary key default gen_random_uuid(),
  startup_id  bigint,                   -- startups.id (FK yok: tip uyumsuzluğu riski)
  title       text not null,
  role_type   text check (role_type in ('technical','business','design','operations')),
  profile     text,
  skills      text[] default '{}',
  urgency     text default 'normal' check (urgency in ('low','normal','high')),
  filled      boolean not null default false,
  created_at  timestamptz not null default now()
);

-- ── Adaylar ───────────────────────────────────────────────
create table hub_candidates (
  id            uuid primary key default gen_random_uuid(),

  -- kimlik
  full_name     text not null,
  email         text,
  linkedin      text,
  github        text,
  phone         text,
  city          text,

  -- eğitim
  university    text,
  department    text,
  class_year    text,                   -- '1','2','3','4','yl','dr'
  grad_year     int,
  edu_status    text check (edu_status in ('student','new_grad','working','unknown'))
                default 'unknown',
  data_trust    text not null default 'guess'
                check (data_trust in ('verified','declared','guess')),

  -- yetkinlik
  role_type     text check (role_type in ('technical','business','design','operations')),
  skills        text[] default '{}',
  languages     text[] default '{}',
  weekly_hours  int,

  -- kaynak
  source        text not null
                check (source in ('hackathon','github','dead_startup','incubator',
                                  'tubitak','club','bootcamp','competition',
                                  'content','open_source','referral','inbound',
                                  'event','other')),
  source_detail text,                   -- ör. "Teknofest 2026 finalistleri"
  source_ref    text,                   -- ör. applications.id
  batch_id      uuid,                   -- hub_import_batches.id
  evidence      jsonb default '[]',     -- [{type,url,note}]
  why_this_one  text,

  -- zenginleştirme (§8.6.5) — yalnızca halka açık veriden
  enrichment    jsonb default '{}',     -- {finished_projects, activity_recency,
                                        --  consistency, breadth, collaboration,
                                        --  solo_finisher, fetched_at}
  enriched_at   timestamptz,

  -- süreç
  stage         text not null default 'pool'
                check (stage in ('pool','contacted','replied','interviewed',
                                 'finalist','gate_a','gate_b','joined','archived')),
  archive_reason text check (archive_reason in
                ('no_reply','not_interested','no_time','below_bar','we_passed')),
  owner_id      uuid references hub_members(id),
  open_role_id  uuid references hub_open_roles(id),
  startup_id    bigint,

  -- puanlama
  score_finishing     int check (score_finishing between 1 and 5),
  score_communication int check (score_communication between 1 and 5),
  score_capacity      int check (score_capacity between 1 and 5),
  score_total   int generated always as
                (coalesce(score_finishing,0) + coalesce(score_communication,0)
                 + coalesce(score_capacity,0)) stored,
  ai_score      int,
  ai_score_note text,

  -- bayraklar
  red_flags     text[] default '{}',
  flag_notes    jsonb default '{}',
  override_reason text,

  -- takip
  tags          text[] default '{}',
  last_contact_at  timestamptz,
  next_action      text,
  next_action_at   timestamptz,
  next_action_link text,

  -- kvkk
  kvkk_consent  boolean not null default false,
  kvkk_at       timestamptz,
  retain_until  date default (current_date + interval '1 year'),

  created_by    uuid references hub_members(id),
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);

create index hub_cand_stage_idx  on hub_candidates(stage);
create index hub_cand_owner_idx  on hub_candidates(owner_id);
create index hub_cand_source_idx on hub_candidates(source);
create index hub_cand_uni_idx    on hub_candidates(university);
create index hub_cand_next_idx   on hub_candidates(next_action_at);
create unique index hub_cand_email_uq
  on hub_candidates(lower(email)) where email is not null;

-- ── Aşama geçiş günlüğü ───────────────────────────────────
create table hub_stage_log (
  id           uuid primary key default gen_random_uuid(),
  candidate_id uuid not null references hub_candidates(id) on delete cascade,
  from_stage   text,
  to_stage     text not null,
  reason       text,
  actor_id     uuid references hub_members(id),
  created_at   timestamptz not null default now()
);

-- ── Temaslar ──────────────────────────────────────────────
create table hub_touches (
  id           uuid primary key default gen_random_uuid(),
  candidate_id uuid not null references hub_candidates(id) on delete cascade,
  channel      text not null check (channel in ('linkedin','email','whatsapp','other')),
  template_id  uuid,
  variant      text,
  sender_id    uuid references hub_members(id),
  sent_at      timestamptz not null default now(),
  outcome      text default 'pending'
               check (outcome in ('pending','replied','declined','no_reply')),
  follow_up_at timestamptz,
  note         text
);
create index hub_touch_cand_idx on hub_touches(candidate_id);

-- ── Görüşmeler ────────────────────────────────────────────
create table hub_interviews (
  id            uuid primary key default gen_random_uuid(),
  candidate_id  uuid not null references hub_candidates(id) on delete cascade,
  held_at       timestamptz not null default now(),
  interviewer_id uuid references hub_members(id),
  answers       jsonb default '{}',     -- {q1:{score,note}, ...}
  flags         text[] default '{}',
  decision      text check (decision in ('finalist','archive','hold')),
  note          text
);

-- ── Kapılar ───────────────────────────────────────────────
create table hub_gates (
  id           uuid primary key default gen_random_uuid(),
  candidate_id uuid not null references hub_candidates(id) on delete cascade,
  gate         text not null check (gate in ('A','B')),
  startup_id   bigint,
  person_id    bigint,                  -- people.id — team app'e referans
  task_text    text,
  started_at   timestamptz not null default now(),
  due_at       timestamptz not null,
  delivered    boolean,
  evaluation   text,
  result       text check (result in ('passed','failed','pending')) default 'pending'
);
create index hub_gate_due_idx on hub_gates(due_at) where result = 'pending';

-- ── Şablonlar ─────────────────────────────────────────────
create table hub_templates (
  id           uuid primary key default gen_random_uuid(),
  name         text not null,
  source_type  text,
  variant      text default 'A',
  subject      text,
  body         text not null,
  variables    text[] default '{}',
  sent_count   int not null default 0,
  reply_count  int not null default 0,
  active       boolean not null default true,
  created_at   timestamptz not null default now()
);

-- ── Kaynak kütüğü (§8.6.8) ────────────────────────────────
-- Avın nerede yapılacağı birinin aklında değil, burada durur.
create table hub_source_registry (
  id            uuid primary key default gen_random_uuid(),
  name          text not null,          -- "Teknofest sonuç sayfası"
  url           text,
  source        text not null,          -- hub_candidates.source ile aynı küme
  note          text,
  check_every   interval default '7 days',
  last_checked  timestamptz,
  owner_id      uuid references hub_members(id),
  status        text not null default 'active'
                check (status in ('active','paused','dead')),
  created_at    timestamptz not null default now()
);
create index hub_srcreg_due_idx on hub_source_registry(last_checked)
  where status = 'active';

-- ── İçe aktarma partileri (§8.6.3) ────────────────────────
-- Ham yapıştırılan metin saklanır: "bu kişi nereden gelmişti" sorusunun cevabı.
create table hub_import_batches (
  id            uuid primary key default gen_random_uuid(),
  method        text not null check (method in ('paste','csv','github','inbound')),
  source        text not null,
  source_detail text,
  event_date    date,
  raw_text      text,                   -- yalnızca 'paste' için
  parsed_count  int not null default 0,
  accepted_count int not null default 0,
  created_by    uuid references hub_members(id),
  created_at    timestamptz not null default now()
);

-- ── Kayıtlı görünümler ────────────────────────────────────
create table hub_views (
  id          uuid primary key default gen_random_uuid(),
  name        text not null,
  owner_id    uuid references hub_members(id),
  filters     jsonb not null default '{}',
  columns     text[] default '{}',
  sort        jsonb default '{}',
  shared      boolean not null default true,
  created_at  timestamptz not null default now()
);

-- ── updated_at tetikleyicisi ──────────────────────────────
create or replace function hub_touch_updated() returns trigger
language plpgsql as $$
begin new.updated_at = now(); return new; end $$;

create trigger hub_cand_updated before update on hub_candidates
for each row execute function hub_touch_updated();

-- ══════════════════════════════════════════════════════════
-- RLS
-- ══════════════════════════════════════════════════════════
alter table hub_members    enable row level security;
alter table hub_candidates enable row level security;
alter table hub_stage_log  enable row level security;
alter table hub_touches    enable row level security;
alter table hub_interviews enable row level security;
alter table hub_gates      enable row level security;
alter table hub_templates  enable row level security;
alter table hub_views      enable row level security;
alter table hub_open_roles enable row level security;
alter table hub_source_registry enable row level security;
alter table hub_import_batches  enable row level security;

-- Üyeler kendi listesini görür; sadece cofounder yazar
create policy hub_members_read on hub_members
  for select using (is_hub_member());
create policy hub_members_write on hub_members
  for all using (hub_role() = 'cofounder') with check (hub_role() = 'cofounder');

-- Adaylar: cofounder/recruiter hepsini; project_owner yalnızca kendi projesini
create policy hub_cand_read on hub_candidates for select using (
  hub_role() in ('cofounder','recruiter')
  or (hub_role() = 'project_owner'
      and startup_id is not null
      and startup_id = any (hub_my_startups()))
);
create policy hub_cand_write on hub_candidates for all
  using (hub_role() in ('cofounder','recruiter'))
  with check (hub_role() in ('cofounder','recruiter'));

-- Bağlı tablolar: hub üyesi ise oku/yaz (aday görünürlüğü uygulama katmanında daraltılır)
create policy hub_log_all   on hub_stage_log  for all using (is_hub_member()) with check (is_hub_member());
create policy hub_touch_all on hub_touches    for all using (is_hub_member()) with check (is_hub_member());
create policy hub_int_all   on hub_interviews for all using (is_hub_member()) with check (is_hub_member());
create policy hub_gate_all  on hub_gates      for all using (is_hub_member()) with check (is_hub_member());
create policy hub_view_all  on hub_views      for all using (is_hub_member()) with check (is_hub_member());
create policy hub_role_all  on hub_open_roles for all using (is_hub_member()) with check (is_hub_member());
create policy hub_srcreg_all on hub_source_registry for all
  using (hub_role() in ('cofounder','recruiter'))
  with check (hub_role() in ('cofounder','recruiter'));
create policy hub_batch_all on hub_import_batches for all
  using (hub_role() in ('cofounder','recruiter'))
  with check (hub_role() in ('cofounder','recruiter'));

create policy hub_tpl_read  on hub_templates for select using (is_hub_member());
create policy hub_tpl_write on hub_templates for all
  using (hub_role() = 'cofounder') with check (hub_role() = 'cofounder');

-- ══════════════════════════════════════════════════════════
-- İlk kayıtlar
-- ══════════════════════════════════════════════════════════
insert into hub_members (email, full_name, role) values
  ('kadirks2003@gmail.com',        'Kadir Kuş', 'cofounder'),
  ('talha@starthub-community.com', 'Talha',     'cofounder')
on conflict (email) do nothing;

-- Zaten hesabı olanların user_id'sini şimdi bağla
-- (hesabı olmayanlar ilk kayıtta tetikleyiciyle otomatik bağlanacak)
update hub_members m
   set user_id = u.id
  from auth.users u
 where lower(u.email) = lower(m.email)
   and m.user_id is null;

-- ══════════════════════════════════════════════════════════
-- Doğrulama sorguları
-- ══════════════════════════════════════════════════════════
-- 1) Üyeler ve bağlanma durumu
select email, role, active, (user_id is not null) as linked from hub_members;

-- 2) Giriş yapmış kullanıcının rolü (Supabase SQL Editor'de null döner —
--    bunu uygulamadan test et)
select hub_role(), is_hub_member();
