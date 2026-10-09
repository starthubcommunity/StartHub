-- ══════════════════════════════════════════════════════════
-- 0060_equity_contracts.sql — Sürümlü sözleşme metni + kabul kaydı (A)
-- ══════════════════════════════════════════════════════════
-- Ekleme niteliğinde: mevcut sözlerin durumu/rakamları DEĞİŞMEZ.
--
-- Pay sözü yaşam döngüsü:
--   pending_confirm   "Teyit bekliyor" — taslak; yüzdeyi cofounder henüz onaylamadı
--   pending_signature "Onay bekliyor"  — sözleşme gönderildi, kişi kabul etmedi
--   active            kabul edildi (signed_at doluysa arayüzde "İmzalandı")
-- İlk iki durumda pay İŞLEMEZ ama koltuk bütçesinde ayrılmış sayılır.
-- pending → active geçişi YALNIZCA sunucu (servis rolü) yapar: kabul kaydı
-- yazılırken. Tarayıcı bu geçişi yapamaz (tetikleyici).
--
-- Gönderim kilitleri (sunucuda, equity-contract fonksiyonu):
--   • contract_settings.test_mode = true  → yalnızca test_emails'e gönderilir
--   • gönderilen şablon is_placeholder     → yalnızca test_emails'e gönderilir
-- test_mode'u yalnızca cofounder kapatır ("Canlıya aç, evet eminim");
-- test_emails listesi tarayıcıdan değiştirilemez.
--
-- Geri alma notu: dosyanın sonunda (yorum olarak).

-- ── 1. equity_grants: yeni durumlar + sözleşme alanları ────────────────
alter table equity_grants drop constraint equity_grants_status_check;
alter table equity_grants drop constraint equity_grants_check;    -- (status='active') = (ended_at is null)
alter table equity_grants drop constraint equity_grants_check1;   -- status='active' or vested_at_end is not null

alter table equity_grants add constraint equity_grants_status_check check (status in
  ('pending_confirm','pending_signature','active','left_good','left_bad','removed'));
alter table equity_grants add constraint equity_grants_open_check check
  ((status in ('pending_confirm','pending_signature','active')) = (ended_at is null));
alter table equity_grants add constraint equity_grants_frozen_check check
  (status in ('pending_confirm','pending_signature','active') or vested_at_end is not null);

-- Yeni sözler varsayılan olarak taslak başlar (eski satırlar etkilenmez).
alter table equity_grants alter column status set default 'pending_confirm';

alter table equity_grants
  add column contract_template_id uuid,
  add column contract_sent_at     timestamptz,
  add column contract_sent_by     text,
  add column signed_at            timestamptz,
  add column acceptance_id        uuid;

-- ── 2. Sözleşme metinleri (sürümlü, değiştirilemez) ───────────────────
create table contract_templates (
  id             uuid primary key default gen_random_uuid(),
  kind           text not null check (kind in ('founder','member')),
  version        int  not null,
  title          text not null,
  body           text not null check (length(body) between 20 and 100000),
  is_placeholder boolean not null default false,
  note           text,
  published_at   timestamptz not null default now(),
  published_by   text default (auth.jwt() ->> 'email'),
  unique (kind, version)
);

-- Sürüm numarasını sunucu verir; "YER TUTUCU" içeren metin her zaman
-- yer tutucu sayılır (gerçek adrese gönderilemez).
create or replace function contract_templates_before_insert() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  perform pg_advisory_xact_lock(hashtext('contract_templates:' || new.kind));
  select coalesce(max(version), 0) + 1 into new.version from contract_templates where kind = new.kind;
  if new.body ilike '%YER TUTUCU%' then new.is_placeholder := true; end if;
  new.published_at := now();
  return new;
end $$;
create trigger contract_templates_before_insert before insert on contract_templates
  for each row execute function contract_templates_before_insert();

-- ── 3. Kabul kayıtları (değiştirilemez, silinemez) ────────────────────
create table contract_acceptances (
  id               uuid primary key default gen_random_uuid(),
  grant_id         uuid not null references equity_grants(id) on delete restrict,
  template_id      uuid not null references contract_templates(id) on delete restrict,
  template_kind    text not null,
  template_version int  not null,
  holder_email     text not null,
  typed_name       text not null check (length(btrim(typed_name)) >= 3),
  consent          boolean not null check (consent),
  accepted_at      timestamptz not null default now(),
  ip               text,
  user_agent       text,
  text_sha256      text not null check (text_sha256 ~ '^[0-9a-f]{64}$'),
  text_snapshot    text not null,
  terms            jsonb not null           -- özet kartında gösterilen rakamlar
);
create index contract_acceptances_grant_idx on contract_acceptances(grant_id);

alter table equity_grants
  add constraint equity_grants_contract_template_fk foreign key (contract_template_id) references contract_templates(id) on delete restrict,
  add constraint equity_grants_acceptance_fk       foreign key (acceptance_id)        references contract_acceptances(id) on delete restrict;

-- Değiştirilemezlik: servis rolü dahil HERKES için (yalnızca insert).
create or replace function contract_immutable() returns trigger
language plpgsql as $$
begin
  raise exception '% kayıtları değiştirilemez ve silinemez', tg_table_name;
end $$;
create trigger contract_templates_immutable   before update or delete on contract_templates
  for each row execute function contract_immutable();
create trigger contract_acceptances_immutable before update or delete on contract_acceptances
  for each row execute function contract_immutable();

-- ── 4. Gönderim ayarı (tek satır) ─────────────────────────────────────
create table contract_settings (
  id              int primary key default 1 check (id = 1),
  test_mode       boolean not null default true,
  test_emails     text[]  not null,
  live_enabled_at timestamptz,
  live_enabled_by text,
  updated_at      timestamptz not null default now()
);
insert into contract_settings (id, test_mode, test_emails)
values (1, true, array['starthub.community@gmail.com','ka2003em@gmail.com']);

create or replace function contract_settings_guard() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if coalesce(auth.role(), '') in ('authenticated','anon') then
    if new.test_emails is distinct from old.test_emails then
      raise exception 'Test adresi listesi arayüzden değiştirilemez';
    end if;
  end if;
  if old.test_mode and not new.test_mode then
    new.live_enabled_at := now();
    new.live_enabled_by := coalesce(auth.jwt() ->> 'email', new.live_enabled_by);
  end if;
  new.updated_at := now();
  return new;
end $$;
create trigger contract_settings_guard before update on contract_settings
  for each row execute function contract_settings_guard();
create trigger contract_settings_no_delete before delete on contract_settings
  for each row execute function contract_immutable();

-- ── 5. Pay sözü koruması (tarayıcıdan yapılabilecekler) ───────────────
-- Servis rolü (sunucu fonksiyonları) kısıtlanmaz.
create or replace function equity_grants_contract_guard() returns trigger
language plpgsql security definer set search_path = public as $$
declare
  v_client boolean := coalesce(auth.role(), '') in ('authenticated','anon');
begin
  if not v_client then return new; end if;

  if tg_op = 'INSERT' then
    if new.status <> 'pending_confirm' then
      raise exception 'Yeni pay sözü "Teyit bekliyor" durumunda başlar; sözleşme kabul edilince aktifleşir';
    end if;
    if new.contract_template_id is not null or new.contract_sent_at is not null
       or new.signed_at is not null or new.acceptance_id is not null then
      raise exception 'Sözleşme alanlarını yalnızca sunucu yazar';
    end if;
    return new;
  end if;

  -- UPDATE
  if new.contract_template_id is distinct from old.contract_template_id
     or new.contract_sent_at is distinct from old.contract_sent_at
     or new.contract_sent_by is distinct from old.contract_sent_by
     or new.signed_at is distinct from old.signed_at
     or new.acceptance_id is distinct from old.acceptance_id then
    -- tek istisna: "Geri çek" (Onay bekliyor → Teyit bekliyor) gönderim izini temizler
    if not (old.status = 'pending_signature' and new.status = 'pending_confirm'
            and new.signed_at is null and new.acceptance_id is null) then
      raise exception 'Sözleşme alanlarını yalnızca sunucu yazar';
    end if;
  end if;

  if new.status is distinct from old.status then
    if new.status = 'pending_signature' then
      raise exception 'Sözleşme yalnızca "Sözleşmeyi gönder" ile gönderilir';
    end if;
    if new.status = 'active' then
      raise exception 'Pay sözü yalnızca kişi sözleşmeyi kabul edince aktifleşir';
    end if;
    if new.status = 'pending_confirm' and old.status <> 'pending_signature' then
      raise exception 'Geçersiz durum geçişi';
    end if;
  end if;

  -- Gönderilmiş sözün şartları değişmez (önce "Geri çek").
  if old.status = 'pending_signature' and new.status = 'pending_signature' and (
       new.grant_pct is distinct from old.grant_pct or new.schedule is distinct from old.schedule
    or new.vest_months is distinct from old.vest_months or new.cliff_months is distinct from old.cliff_months
    or new.milestone_bonus_pct is distinct from old.milestone_bonus_pct
    or new.holder_email is distinct from old.holder_email or new.holder_name is distinct from old.holder_name
    or new.seat_id is distinct from old.seat_id) then
    raise exception 'Gönderilmiş sözleşmenin şartları değiştirilemez — önce "Geri çek"';
  end if;

  -- İmzalanmış sözün şartları değişmez.
  if old.signed_at is not null and (
       new.grant_pct is distinct from old.grant_pct or new.schedule is distinct from old.schedule
    or new.vest_months is distinct from old.vest_months or new.cliff_months is distinct from old.cliff_months
    or new.milestone_bonus_pct is distinct from old.milestone_bonus_pct or new.start_date is distinct from old.start_date
    or new.holder_email is distinct from old.holder_email or new.seat_id is distinct from old.seat_id) then
    raise exception 'İmzalanmış sözün şartları değiştirilemez';
  end if;
  return new;
end $$;
create trigger equity_grants_contract_guard before insert or update on equity_grants
  for each row execute function equity_grants_contract_guard();

-- ── 6. Denetim izi (0052'deki equity_audit) ───────────────────────────
create trigger contract_templates_audit after insert on contract_templates
  for each row execute function equity_audit();
create trigger contract_settings_audit  after update on contract_settings
  for each row execute function equity_audit();
create trigger contract_acceptances_audit after insert on contract_acceptances
  for each row execute function equity_audit();

-- ── 7. RLS ─────────────────────────────────────────────────────────────
alter table contract_templates   enable row level security;
alter table contract_acceptances enable row level security;
alter table contract_settings    enable row level security;

create policy ct_read   on contract_templates for select using (has_perm('equity.read'));
create policy ct_insert on contract_templates for insert with check (has_perm('equity.manage'));
-- update/delete politikası YOK (zaten tetikleyiciyle de engelli)

create policy ca_read   on contract_acceptances for select using (has_perm('equity.read'));
-- insert/update/delete politikası YOK — yalnızca sunucu (servis rolü) yazar

create policy cs_read   on contract_settings for select using (has_perm('equity.read'));
create policy cs_update on contract_settings for update using (has_perm('equity.manage')) with check (has_perm('equity.manage'));

-- ── 8. v1 metinleri — YER TUTUCU (gerçek metin yeni sürümle gelecek) ──
-- {alan} biçimindeki yerler sözden doldurulur (bkz. _shared/contract-render.js).
insert into contract_templates (kind, version, title, body, is_placeholder, note, published_by) values
('founder', 0, 'Kurucu (Team Lead) Pay Sözü Sözleşmesi',
$t$YER TUTUCU METİN — gerçek sözleşme metni yeni bir sürümle yayınlanacak.
Bu sürüm yalnızca test adreslerine gönderilebilir.

KURUCU (TEAM LEAD) PAY SÖZÜ SÖZLEŞMESİ

Taraflar: Start-Hub adına {taraflar} ile {ad} ({eposta}).

Proje: {proje}
Koltuk: {koltuk}
Pay sözü: %{pay}
Hak ediş süresi: {sure} ay
Bekleme süresi: {bekleme} ay
Haftalık saat beklentisi: {saat}
Kilometre taşları: {kilometre_taslari}
Hak ediş başlangıcı: bu sözleşmenin onaylandığı tarih.

[Sözleşme maddeleri burada yer alacak.]
$t$, true, 'v1 — yer tutucu', 'sistem'),
('member', 0, 'Ekip Üyesi Pay Sözü Sözleşmesi',
$t$YER TUTUCU METİN — gerçek sözleşme metni yeni bir sürümle yayınlanacak.
Bu sürüm yalnızca test adreslerine gönderilebilir.

EKİP ÜYESİ PAY SÖZÜ SÖZLEŞMESİ

Taraflar: Start-Hub adına {taraflar} ile {ad} ({eposta}).

Proje: {proje}
Koltuk: {koltuk}
Pay sözü: %{pay}
Hak ediş süresi: {sure} ay
Bekleme süresi: {bekleme} ay
Haftalık saat beklentisi: {saat}
Hak ediş başlangıcı: bu sözleşmenin onaylandığı tarih.

[Sözleşme maddeleri burada yer alacak.]
$t$, true, 'v1 — yer tutucu', 'sistem');

-- ══════════════════════════════════════════════════════════
-- GERİ ALMA NOTU (yalnızca hiç kabul kaydı yokken anlamlı):
--   1) Bekleyen sözler varsa önce kapatılmalı (status pending_* → 'removed',
--      ended_at=today, vested_at_end=0) — eski kısıtlar bu durumları tanımaz.
--   2) drop trigger equity_grants_contract_guard on equity_grants;
--      drop function equity_grants_contract_guard();
--      alter table equity_grants drop constraint equity_grants_acceptance_fk,
--        drop constraint equity_grants_contract_template_fk;
--      drop table contract_acceptances;   -- immutable tetikleyicisi drop'u engellemez
--      drop table contract_templates; drop table contract_settings;
--      drop function contract_templates_before_insert(); drop function contract_immutable();
--      drop function contract_settings_guard();
--      alter table equity_grants drop column contract_template_id, drop column contract_sent_at,
--        drop column contract_sent_by, drop column signed_at, drop column acceptance_id;
--      alter table equity_grants alter column status set default 'active';
--      alter table equity_grants drop constraint equity_grants_status_check,
--        drop constraint equity_grants_open_check, drop constraint equity_grants_frozen_check;
--      alter table equity_grants add constraint equity_grants_status_check check (status in ('active','left_good','left_bad','removed')),
--        add constraint equity_grants_check  check ((status = 'active') = (ended_at is null)),
--        add constraint equity_grants_check1 check (status = 'active' or vested_at_end is not null);
--   Kabul kaydı oluştuktan sonra geri alma ÖNERİLMEZ (kanıt kaydı silinir);
--   bunun yerine yeni bir ileri migration yazılır.
-- ══════════════════════════════════════════════════════════
