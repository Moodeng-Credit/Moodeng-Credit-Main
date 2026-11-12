-- Walt P2P API key (vault secret WALT_P2P_API_KEY): read-only live USDT/IDR ad prices, used to show
-- Indonesian borrowers the rupiah they'll really get / pay on Walt P2P (_shared/waltP2p.ts).
create or replace function public.walt_p2p_api_key()
returns text
language sql
stable
security definer
set search_path = ''
as $$
   select decrypted_secret from vault.decrypted_secrets where name = 'WALT_P2P_API_KEY' limit 1;
$$;

revoke all on function public.walt_p2p_api_key() from public, anon, authenticated;
grant execute on function public.walt_p2p_api_key() to service_role;
