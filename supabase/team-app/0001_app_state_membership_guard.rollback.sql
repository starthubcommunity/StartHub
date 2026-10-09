-- GERİ ALMA — team-app/0001_app_state_membership_guard.sql
-- !!! TEAM APP PROJESİNE: umgdtjlgivvymngsnqtv !!!
--   npx supabase db query --linked --project-ref umgdtjlgivvymngsnqtv -f <bu dosya>
-- Yalnızca tetikleyiciyi ve iki fonksiyonu kaldırır; app_state verisine dokunmaz.
drop trigger if exists app_state_membership_guard on public.app_state;
drop function if exists public.app_state_membership_guard();
drop function if exists public.app_state_membership(jsonb);
