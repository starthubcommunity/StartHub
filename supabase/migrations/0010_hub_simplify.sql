-- ══════════════════════════════════════════════════════════
-- 0010_hub_simplify.sql — Hub v2 sadeleştirmesi, şema tarafı
-- HUB_SPEC v2 §12. 0009 ÇALIŞTIRILDIKTAN SONRA uygulanır.
-- ══════════════════════════════════════════════════════════
-- Canlı DB, eski 0005'i (requested/paused/cancelled + 3 talep kolonu)
-- çalıştırmış durumda. Bu migration o farkı kapatır — idempotent,
-- tekrar çalıştırılabilir.
--
-- ⚠️ 0009_permissions.sql'e DOKUNULMUYOR. RLS politikaları değişmiyor.
-- ⚠️ hub_role_log DÜŞÜRÜLMÜYOR — v2'de kullanılmıyor ama 0009 RLS'i ona
--    bağlı (bkz. 0005 notu).
-- ⚠️ hub_candidates.tags / languages / phone / city DÜŞÜRÜLMÜYOR — veri
--    kaybı riski; v2'de yalnızca UI'dan gizleniyor (§4). Gerçek drop,
--    "sıfır aday" teyidiyle ayrı bir migration'da.

-- ── 1. hub_candidates: AI taslağı + içe aktarma etiketi ─────
alter table hub_candidates
  add column if not exists draft_text          text,
  add column if not exists import_batch_label  text;

-- ── 2. hub_gates: süre uzatma (§2.2) ───────────────────────
alter table hub_gates
  add column if not exists extended_days int not null default 0;

-- ── 3. hub_open_roles: talep akışını kaldır (§10.1) ─────────
-- 3a. Kaldırılan durumları geçerli olanlara taşı (constraint'ten ÖNCE).
--     requested → sourcing (rol doğrudan "Aranıyor"a düşer)
--     paused / cancelled → draft
alter table hub_open_roles drop constraint if exists hub_open_roles_status_check;
do $$
declare c text;
begin
  -- 0005'in adlandırmasından farklı bir isimle eklendiyse onu da düşür
  for c in
    select conname from pg_constraint
     where conrelid = 'hub_open_roles'::regclass and contype = 'c'
       and pg_get_constraintdef(oid) ilike '%status%'
  loop
    execute format('alter table hub_open_roles drop constraint %I', c);
  end loop;
end $$;

update hub_open_roles set status = 'sourcing' where status = 'requested';
update hub_open_roles set status = 'draft'    where status in ('paused','cancelled');

alter table hub_open_roles
  add constraint hub_open_roles_status_check
  check (status in ('draft','sourcing','shortlist','filled'));

-- 3b. Talep akışı kolonlarını düşür (roller özelliği yeni, veri ~sıfır).
alter table hub_open_roles
  drop column if exists requested_by,
  drop column if exists requested_at,
  drop column if exists accepted_at;

-- ── 4. Kullanılmayan tabloları düşür (§12) ─────────────────
-- İçe aktarma artık hub_candidates.import_batch_label serbest metniyle;
-- kayıtlı görünümler v2'de yok. İkisi de boş.
drop table if exists hub_views          cascade;
drop table if exists hub_import_batches cascade;
