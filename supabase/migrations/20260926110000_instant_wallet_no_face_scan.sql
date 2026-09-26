-- Remove the face scan from Instant Wallet creation (George, 2026-09-26).
--
-- The scan used Didit's "Biometric Authentication" workflow, which matches a face against one Didit
-- already holds for the user. Anyone who had never done a full Didit ID check (most lenders, new
-- borrowers) got "Failed to create verification session" and could not create a wallet at all.
-- George's call: no face check to open an Instant Wallet. Any signed-in user may mint one; a grant row
-- is still recorded so recovery keeps taking the already-granted path.
--
-- The first-cash-out face hold (cashout_face_gate_required / cashout_gate_holds_wallet) is separate
-- and unchanged.

create or replace function public.may_mint_embedded_wallet(p_user_id uuid)
returns jsonb
language plpgsql
stable
security definer
set search_path to 'public', 'pg_temp'
as $function$
begin
   if exists (select 1 from public.embedded_wallet_grants g where g.user_id = p_user_id) then
      return jsonb_build_object('allowed', true, 'reason', 'ALREADY_GRANTED', 'already_granted', true);
   end if;
   return jsonb_build_object('allowed', true, 'reason', 'NO_FACE_REQUIRED', 'already_granted', false);
end;
$function$;

create or replace function public.claim_embedded_wallet_grant(p_user_id uuid)
returns boolean
language plpgsql
security definer
set search_path to 'public', 'pg_temp'
as $function$
begin
   -- An approval from an earlier scan is spent with the grant, as before.
   update public.users
      set wallet_face_status = 'CONSUMED'
    where id = p_user_id
      and wallet_face_status = 'APPROVED';

   insert into public.embedded_wallet_grants (user_id, user_role, face_session_id, wallet_address)
   select p_user_id, u.user_role::text, u.wallet_face_session_id, lower(btrim(nullif(u.wallet_address, '')))
   from public.users u
   where u.id = p_user_id
   on conflict (user_id) do nothing;
   return true;
end;
$function$;
