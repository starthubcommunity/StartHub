-- ══════════════════════════════════════════════════════════
-- 0021_public_open_roles.sql — Ana Site ↔ Hub "Açık Pozisyonlar" köprüsü
-- ══════════════════════════════════════════════════════════
-- Bugüne kadar Ana Site'daki "Açık Pozisyonlar" (startups.open_roles_list_tr/en,
-- düz metin listesi, admin panelden elle yazılıyor) ile Hub'ın "Roller"
-- sayfasındaki yapılandırılmış hub_open_roles tablosu birbirinden tamamen
-- bağımsızdı — aynı bilgi iki yerde elle senkron tutuluyordu. Artık
-- hub_open_roles TEK kaynak: bu view üzerinden Ana Site'a (anon) sadece
-- güvenli/kamuya açık alanlar, sadece fiilen aranan (sourcing/shortlist)
-- pozisyonlar için, sızdırılıyor.
--
-- hub_open_roles'un kendi RLS'i (0009_permissions.sql, has_perm('roles.read'))
-- anon'u zaten reddediyor — bu view'ın owner'ı (migration'ı çalıştıran
-- rol) RLS'i by-pass ettiği için, view'ın SELECT listesi + WHERE'i tek
-- güvenlik sınırı olur. Bu yüzden assigned_to, urgency, first_deliverable
-- gibi iç/hassas alanlar BİLEREK dışarıda bırakılıyor.

create or replace view public_open_roles as
  select id, startup_id, title, role_type, profile, skills, track, created_at
  from hub_open_roles
  where status in ('sourcing', 'shortlist');

grant select on public_open_roles to anon, authenticated;
