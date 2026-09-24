-- The public profile / insights page (/user/:username) reads public_user_profiles, which blanks `cs`
-- (credit limit) and `credit_progression_paused`. The page then fell back to the $15 minimum, so every
-- borrower showed as LV1 there while their dashboard showed the real level. The page displays the
-- credit level publicly anyway, so expose just those two values through a narrow read-only function.
create or replace function public.get_public_credit_limit(p_user_id uuid)
returns table (cs integer, credit_progression_paused boolean)
language sql
stable
security definer
set search_path = ''
as $$
  select u.cs, coalesce(u.credit_progression_paused, false)
  from public.users u
  where u.id = p_user_id;
$$;

revoke all on function public.get_public_credit_limit(uuid) from public;
grant execute on function public.get_public_credit_limit(uuid) to anon, authenticated;
