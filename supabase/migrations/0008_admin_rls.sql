-- ══════════════════════════════════════════════════════════
-- 0008_admin_rls.sql — içerik tablolarına rol bazlı RLS
-- ══════════════════════════════════════════════════════════
-- ⚠️  BU MIGRATION'I ÖNCE 0007'Yİ ÇALIŞTIRIP admin_members'A EN AZ BİR
--     'admin' ROLLÜ ÜYE GİRDİKTEN SONRA ÇALIŞTIR.
--     Aksi halde hiç kimse içerik yazamaz ve panel kilitlenir.
--
-- ⚠️  app_state: /team/ bu tabloyu yazıyorsa, /team/'in auth bağlamına göre
--     ek policy gerekebilir. 0008'i çalıştırmadan önce /team/ yazma yolunu
--     doğrula; gerekirse app_state write policy'sini genişlet.
--
-- Model: admin → tam yetki · editor → yalnızca posts'ta yazar, geri kalanı
-- okur. Siteyi besleyen tablolar (posts/people/startups/sponsors/events/
-- app_state) herkese açık SELECT; applications yalnızca admin okur ama
-- herkes ekleyebilir (katılım formu).
-- ══════════════════════════════════════════════════════════

alter table posts        enable row level security;
alter table people       enable row level security;
alter table startups     enable row level security;
alter table sponsors     enable row level security;
alter table events       enable row level security;
alter table applications enable row level security;
alter table app_state    enable row level security;

-- ── Herkese açık okuma (site anon anahtarıyla besleniyor) ──────
create policy pub_read_posts    on posts     for select using (true);
create policy pub_read_people   on people    for select using (true);
create policy pub_read_startups on startups  for select using (true);
create policy pub_read_sponsors on sponsors  for select using (true);
create policy pub_read_events   on events    for select using (true);
create policy pub_read_appstate on app_state for select using (true);

-- ── applications: okuma yalnızca admin; ekleme herkese açık (form) ──
create policy adm_read_apps    on applications for select using (is_admin_member());
create policy pub_insert_apps  on applications for insert with check (true);

-- ── Yazma: admin her şey ──────────────────────────────────────
create policy adm_write_posts    on posts     for all using (admin_role() = 'admin') with check (admin_role() = 'admin');
create policy adm_write_people   on people    for all using (admin_role() = 'admin') with check (admin_role() = 'admin');
create policy adm_write_startups on startups  for all using (admin_role() = 'admin') with check (admin_role() = 'admin');
create policy adm_write_sponsors on sponsors  for all using (admin_role() = 'admin') with check (admin_role() = 'admin');
create policy adm_write_events   on events    for all using (admin_role() = 'admin') with check (admin_role() = 'admin');
create policy adm_write_appstate on app_state for all using (admin_role() = 'admin') with check (admin_role() = 'admin');
create policy adm_update_apps    on applications for update using (admin_role() = 'admin') with check (admin_role() = 'admin');
create policy adm_delete_apps    on applications for delete using (admin_role() = 'admin');

-- ── editor: yalnızca posts'ta yazar ──────────────────────────
create policy editor_write_posts on posts for all
  using (admin_role() in ('admin','editor'))
  with check (admin_role() in ('admin','editor'));
