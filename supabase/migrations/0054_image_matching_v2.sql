-- 0054_image_matching_v2.sql
-- Görsel eşleştirme v2 (automation/image_matcher.py). Görsel seçimi yayın anında
-- deterministik ve yerel çalışır; bu tablolar kullanım geçmişini ve görsel
-- sınıflandırmasını tutar.
--
-- YAZILDI, UYGULANMADI — canlı DB'ye uygulamadan önce kullanıcı onayı gerekir.
-- image_stock tablosu zaten var (kolonlar canlıdan okundu); yalnızca eksikler eklenir.

alter table image_stock
  add column if not exists visual_type text,
  add column if not exists is_generic  boolean not null default false,
  add column if not exists license     text,
  add column if not exists source_url  text,
  add column if not exists width       int,
  add column if not exists height      int;

alter table image_stock drop constraint if exists image_stock_visual_type_check;
alter table image_stock add constraint image_stock_visual_type_check check (
  visual_type is null or visual_type in (
    'el_sikisma', 'ofis_toplanti', 'grafik_borsa', 'para_finans', 'robot_ai',
    'cip_donanim', 'kod_ekran', 'cihaz_telefon', 'veri_merkezi', 'sehir_bina',
    'arac_enerji', 'insan_portre', 'laboratuvar', 'soyut_diger'
  )
);

-- Her yayın seçiminin kaydı: hangi görsel, hangi yazı, hangi skorla, hangi
-- filtrelerle. Skorlama son 90 gün / son 10 yazı kurallarını buradan okur.
create table if not exists image_usage (
  id       uuid primary key default gen_random_uuid(),
  image_id bigint not null references image_stock(id) on delete cascade,
  post_id  bigint references posts(id) on delete set null,
  used_at  timestamptz not null default now(),
  score    numeric,
  reason   jsonb
);

create index if not exists image_usage_used_at_idx on image_usage (used_at desc);
create index if not exists image_usage_image_id_idx on image_usage (image_id);
create unique index if not exists image_usage_image_post_uidx
  on image_usage (image_id, post_id) where post_id is not null;

-- RLS: yazma yalnızca service role (automation/publish.py) tarafından yapılır;
-- admin paneli yalnızca okur. Anon ve diğer authenticated kullanıcılar erişemez.
alter table image_usage enable row level security;

drop policy if exists "admin reads image_usage" on image_usage;
create policy "admin reads image_usage" on image_usage
  for select to authenticated
  using (exists (
    select 1 from admin_members m
    where m.active and (m.user_id = auth.uid()
      or lower(m.email) = lower(coalesce(auth.jwt() ->> 'email', '')))
  ));

-- Görsel seçimi son çareye düştüyse veya çok sayıda filtre gevşediyse yazı
-- admin panelinde "görsel kontrol edilmeli" olarak işaretlenir. Kolon yoksa
-- publish.py bu alanı yazmaz (yalnızca needs_review=true olduğunda ekler).
alter table posts add column if not exists needs_review boolean not null default false;
