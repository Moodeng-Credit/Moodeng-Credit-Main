-- Disable the withdrawal (cash-out) face gate.
--
-- Product decision: the cash-out face scan was creating friction/complaints and (via Base's
-- keys.coinbase.com dependency) getting borrowers stuck. Rather than remove the whole feature,
-- we neutralise it at the source: both gate functions now ALWAYS allow. The edge functions
-- (create-didit-session, openfort-shield-session, didit-webhook, check-didit-status) still call
-- them, but no scan is ever required and the embedded wallet is never held for a cash-out.
--
-- Immediate + no redeploy (functions read these live). Reversible by restoring the definitions
-- from 20260919000000_cashout_gate_world_id_exempt.sql.
--
-- Scope: this is ONLY the cash-out/withdrawal gate. The wallet-MINT gate
-- (may_mint_embedded_wallet / wallet_face) is unaffected — new wallets still get the
-- one-wallet-per-person dedup.
--
-- Security note: this re-opens the scenario the gate was built for (a third party using an
-- unlocked phone to cash out a just-funded loan). Accepted tradeoff given the friction and the
-- move to instant wallets.

create or replace function public.cashout_face_gate_required(
   p_user_id uuid,
   p_destination text,
   p_amount numeric,
   p_country_iso text default null
)
returns jsonb
language plpgsql
stable
security definer
set search_path = public, pg_temp
as $$
begin
   return jsonb_build_object('required', false, 'reason', 'GATE_DISABLED');
end;
$$;

revoke all on function public.cashout_face_gate_required(uuid, text, numeric, text) from public;
revoke all on function public.cashout_face_gate_required(uuid, text, numeric, text) from anon;
revoke all on function public.cashout_face_gate_required(uuid, text, numeric, text) from authenticated;
grant execute on function public.cashout_face_gate_required(uuid, text, numeric, text) to service_role, postgres;

create or replace function public.cashout_gate_holds_wallet(
   p_user_id uuid,
   p_country_iso text default null
)
returns jsonb
language plpgsql
stable
security definer
set search_path = public, pg_temp
as $$
begin
   return jsonb_build_object('held', false, 'reason', 'GATE_DISABLED');
end;
$$;

revoke all on function public.cashout_gate_holds_wallet(uuid, text) from public;
revoke all on function public.cashout_gate_holds_wallet(uuid, text) from anon;
revoke all on function public.cashout_gate_holds_wallet(uuid, text) from authenticated;
grant execute on function public.cashout_gate_holds_wallet(uuid, text) to service_role, postgres;
