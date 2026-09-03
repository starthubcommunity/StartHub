-- ══════════════════════════════════════════════════════════
-- 0012_hub_role_fk.sql — açık rol silinince bağlı adaylar çözülsün
-- ══════════════════════════════════════════════════════════
-- Sorun: 0001'de hub_candidates.open_role_id FK'sinin ON DELETE eylemi yok
-- (NO ACTION). Bir role bağlı aday varken rol silinmek istenince FK ihlali
-- → istemcide "takılıyor". ON DELETE SET NULL yapılır: rol silinince adayın
-- open_role_id'si NULL olur, aday kalır. (track korunur — geri alma yok.)
-- Idempotent.

do $$
declare fk text;
begin
  for fk in
    select conname from pg_constraint
     where conrelid = 'hub_candidates'::regclass
       and contype = 'f'
       and confrelid = 'hub_open_roles'::regclass
  loop
    execute format('alter table hub_candidates drop constraint %I', fk);
  end loop;
end $$;

alter table hub_candidates
  add constraint hub_candidates_open_role_id_fkey
  foreign key (open_role_id) references hub_open_roles(id) on delete set null;
