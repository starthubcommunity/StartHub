-- supabase/team-app/0002_keepalive.sql — TEAM APP PROJESİNE (umgdtjlgivvymngsnqtv) uygulanır.
-- D4 (2026-10-16): ücretsiz planda 7 gün hareketsiz kalan proje duraklatılır. Haftalık GitHub Actions
-- işi (.github/workflows/supabase-keepalive.yml) bu fonksiyonu çağırır. Fonksiyon app_state'ten
-- GERÇEKTEN okur (satır sayısı) ama hiçbir içerik döndürmez — herkese açık anahtarla çağrılabilir.
--   npx supabase db query --linked --project-ref umgdtjlgivvymngsnqtv -f supabase/team-app/0002_keepalive.sql
create or replace function public.keepalive() returns jsonb
language sql stable security definer set search_path = public as $$
  select jsonb_build_object('ok', true, 'rows', (select count(*) from public.app_state), 'at', now())
$$;
revoke all on function public.keepalive() from public;
grant execute on function public.keepalive() to anon, authenticated;

-- GERİ ALMA: drop function public.keepalive();
