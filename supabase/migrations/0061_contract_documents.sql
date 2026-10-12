-- ══════════════════════════════════════════════════════════
-- 0061_contract_documents.sql — Kabul belgesi PDF'i (B)
-- ══════════════════════════════════════════════════════════
-- Ekleme niteliğinde: mevcut tablolar/kayıtlar DEĞİŞMEZ.
--
-- • contract-pdfs: ana projede PRIVATE bucket (yalnızca PDF, en fazla 2 MB).
--   storage.objects için HİÇBİR tarayıcı politikası eklenmez → yalnızca
--   sunucu (servis rolü) yazar/okur; HR indirme 5 dakikalık imzalı bağlantıyla.
-- • contract_documents: kabul kaydı başına TEK PDF kaydı (dosya yolu, PDF'in
--   kendi SHA-256'sı, boyut). Servis rolü dahil değiştirilemez/silinemez
--   (0060'taki contract_immutable). Okuma: equity.read (cofounder).
-- PDF/mail sonuçları equity_events'e 'note' olarak yazılır (append-only).

-- ── 1. Private bucket ──────────────────────────────────────────────────
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('contract-pdfs', 'contract-pdfs', false, 2097152, array['application/pdf'])
on conflict (id) do nothing;

-- ── 2. PDF kaydı ───────────────────────────────────────────────────────
create table contract_documents (
  id            uuid primary key default gen_random_uuid(),
  acceptance_id uuid not null unique references contract_acceptances(id) on delete restrict,
  grant_id      uuid not null references equity_grants(id) on delete restrict,
  storage_path  text not null unique
                check (storage_path ~ '^[0-9a-f-]{36}/[0-9a-f-]{36}\.pdf$'),   -- <grant_id>/<acceptance_id>.pdf
  pdf_sha256    text not null check (pdf_sha256 ~ '^[0-9a-f]{64}$'),
  size_bytes    int  not null check (size_bytes > 0 and size_bytes <= 2097152),
  created_at    timestamptz not null default now()
);
create index contract_documents_grant_idx on contract_documents(grant_id);

create trigger contract_documents_immutable before update or delete on contract_documents
  for each row execute function contract_immutable();
create trigger contract_documents_audit after insert on contract_documents
  for each row execute function equity_audit();

alter table contract_documents enable row level security;
create policy cd_read on contract_documents for select using (has_perm('equity.read'));
-- insert/update/delete politikası YOK — yalnızca sunucu (servis rolü) yazar

-- ══════════════════════════════════════════════════════════
-- GERİ ALMA NOTU:
--   PDF kaydı yokken:  drop table contract_documents;
--                      delete from storage.buckets where id = 'contract-pdfs';
--   PDF kaydı oluştuktan sonra geri alma ÖNERİLMEZ (kabul belgesi kaybolur).
--   Gerekirse önce bucket'taki dosyalar Supabase panelinden indirilip
--   saklanır, sonra dosyalar silinir, ardından yukarıdaki iki komut çalışır
--   (bucket boş değilken silinemez). contract_acceptances (0060) etkilenmez.
-- ══════════════════════════════════════════════════════════
