-- ══════════════════════════════════════════════════════════
-- 0008_admin_rls.sql — içerik tablolarına rol bazlı RLS
-- ══════════════════════════════════════════════════════════
-- ⚠️  BU MIGRATION'I ÖNCE 0007'Yİ ÇALIŞTIRIP admin_members'A EN AZ BİR
--     'admin' ROLLÜ ÜYE GİRDİKTEN SONRA ÇALIŞTIR.
--     Aksi halde hiç kimse içerik yazamaz ve panel kilitlenir.
--
-- ⚠️  app_state ve notifications'a DOKUNULMAZ — /team/ sistemi bunları
--     kullanıyor, RLS ile kilitlenirse çöker.
--
-- Model:
--   admin  → tam yetki (tüm tablolar)
--   editor → posts: SELECT + INSERT + UPDATE (DELETE YOK — silme yalnızca admin)
--            people / startups / sponsors / events: yalnızca SELECT
--            applications: ERİŞİM YOK (kişisel veri)
--   anon   → siteyi besleyen tablolarda SELECT; applications'a yalnızca INSERT
-- ══════════════════════════════════════════════════════════

alter table posts        enable row level security;
alter table people       enable row level security;
alter table startups     enable row level security;
alter table sponsors     enable row level security;
alter table events       enable row level security;
alter table applications enable row level security;

-- ── Herkese açık okuma (site anon anahtarıyla besleniyor) ──────
-- Editör de yazının yazarını ve bağlı projeyi seçebilsin diye people/
-- startups/sponsors/events okumasını bu politikalar zaten sağlar.
create policy pub_read_posts    on posts    for select using (true);
create policy pub_read_people   on people   for select using (true);
create policy pub_read_startups on startups for select using (true);
create policy pub_read_sponsors on sponsors for select using (true);
create policy pub_read_events   on events   for select using (true);

-- ── applications: okuma YALNIZCA admin; ekleme herkese açık (form) ──
create policy adm_read_apps    on applications for select using (admin_role() = 'admin');
create policy pub_insert_apps  on applications for insert with check (true);
create policy adm_update_apps  on applications for update using (admin_role() = 'admin') with check (admin_role() = 'admin');
create policy adm_delete_apps  on applications for delete using (admin_role() = 'admin');

-- ── Yazma: admin her tabloda tam yetki ────────────────────────
create policy adm_write_posts    on posts    for all using (admin_role() = 'admin') with check (admin_role() = 'admin');
create policy adm_write_people   on people   for all using (admin_role() = 'admin') with check (admin_role() = 'admin');
create policy adm_write_startups on startups for all using (admin_role() = 'admin') with check (admin_role() = 'admin');
create policy adm_write_sponsors on sponsors for all using (admin_role() = 'admin') with check (admin_role() = 'admin');
create policy adm_write_events   on events   for all using (admin_role() = 'admin') with check (admin_role() = 'admin');

-- ── editor: YALNIZCA posts — INSERT + UPDATE (DELETE YOK) ─────
-- SELECT zaten pub_read_posts ile açık. Silme hakkı bilerek verilmez:
-- editör sayısı arttıkça yanlışlıkla silinen yayın riski büyür.
create policy editor_insert_posts on posts for insert
  with check (admin_role() in ('admin','editor'));
create policy editor_update_posts on posts for update
  using (admin_role() in ('admin','editor'))
  with check (admin_role() in ('admin','editor'));
