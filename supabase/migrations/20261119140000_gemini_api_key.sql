-- Gemini API key (vault secret GEMINI_API_KEY, Google AI Studio paid tier, added 2026-11-19): Gemini
-- watches the pre-screening clips, reads the proof of income and grades (_shared/geminiPreScreen.ts).
create or replace function public.gemini_api_key()
returns text
language sql
stable
security definer
set search_path = ''
as $$
   select decrypted_secret from vault.decrypted_secrets where name = 'GEMINI_API_KEY' limit 1;
$$;

revoke all on function public.gemini_api_key() from public, anon, authenticated;
grant execute on function public.gemini_api_key() to service_role;
