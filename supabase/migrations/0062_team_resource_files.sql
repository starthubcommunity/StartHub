-- ══════════════════════════════════════════════════════════
-- 0062_team_resource_files.sql — Ekip Paneli "Kaynaklar"a PDF yükleme (C)
-- ══════════════════════════════════════════════════════════
-- Ekleme niteliğinde. Dosyalar ANA projede private bucket'ta durur; Team App
-- kullanıcıları bu projede oturum açmadığı için erişim YALNIZCA köprü
-- fonksiyonlarıyla (hub-team-resource-file → hub-resource-files) ve sunucuda
-- ekip üyeliği doğrulanarak olur:
--   yükleme: kısa ömürlü imzalı yükleme bağlantısı, sonra sunucu dosyayı
--            indirip boyutu ve %PDF- başlığını denetler (geçmezse siler)
--   indirme: 5 dakikalık imzalı bağlantı
-- storage.objects'e tarayıcı politikası YOK; tabloya da RLS politikası YOK
-- (yalnızca servis rolü).
-- Sınırlar: dosya başına 10 MB (bucket da zorlar), ekip başına 25, Genel 25.

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('team-resources', 'team-resources', false, 10485760, array['application/pdf'])
on conflict (id) do nothing;

create table team_resource_files (
  id           uuid primary key default gen_random_uuid(),
  team_id      text not null,                 -- Team App ekip kimliği; Genel = '__GENERAL__'
  storage_path text not null unique,
  file_name    text not null check (length(file_name) between 5 and 120),
  size_bytes   int  check (size_bytes is null or (size_bytes > 0 and size_bytes <= 10485760)),
  status       text not null default 'pending' check (status in ('pending','ready')),
  uploaded_by  text,
  created_at   timestamptz not null default now()
);
create index team_resource_files_team_idx on team_resource_files(team_id, status);

alter table team_resource_files enable row level security;
-- politika yok: yalnızca servis rolü (köprü fonksiyonları) okur/yazar

-- ══════════════════════════════════════════════════════════
-- GERİ ALMA NOTU:
--   Bucket boşken:  drop table team_resource_files;
--                   delete from storage.buckets where id = 'team-resources';
--   Dosya varsa önce Supabase panelinden bucket boşaltılır (Team App'teki kaynak
--   satırları bağlantısız kalır — önce Team App'ten PDF kaynakları silinmeli).
-- ══════════════════════════════════════════════════════════
