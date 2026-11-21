-- "Who invited you?" is now the first screen of sign-up and of the pre-screening link (George 2026-11-21:
-- friends kept signing up without the affiliate's code). As they type, the box completes the code in a
-- lighter colour (MAH → MAHJID) and shows "Invited by Mahjid" once it matches.
--
-- Anyone can call it (they don't have an account yet), so it gives away as little as possible:
-- - team codes (referral_codes) only complete from a prefix of 2+ letters (or text that starts with the
--   whole code, e.g. their full name), one match, and only codes
--   redeem_referral_code would accept (active, not expired, not full);
-- - a personal invite code (6 letters + 5 digits) is never completed, only confirmed when typed in
--   full (the same thing get_invite_inviter already tells anyone);
-- - the inviter is a first name only.

create or replace function public.suggest_invite_code(p_text text)
returns table (code text, inviter text)
language plpgsql
stable
security definer
set search_path = public, pg_temp
as $$
declare
  v_text text := upper(regexp_replace(coalesce(p_text, ''), '[^A-Za-z0-9]', '', 'g'));
begin
  if char_length(v_text) < 2 or char_length(v_text) > 40 then
    return;
  end if;

  if v_text ~ '^[A-Z]{6}[0-9]{5}$' then
    return query
      select c.code, split_part(coalesce(nullif(trim(u.display_name), ''), u.username), ' ', 1)
      from public.borrower_invite_codes c
      join public.users u on u.id = c.user_id
      where c.code = v_text;
    return;
  end if;

  return query
    select rc.code, n.first_name
    from public.referral_codes rc
    left join public.users u on u.id = rc.owner_user_id
    -- A first name with at least one letter (some display names are just "_").
    left join lateral (
      select nullif(split_part(trim(nm), ' ', 1), '') as first_name
      from unnest(array[u.display_name, u.facebook_name]) nm
      where trim(nm) ~ '^[[:alpha:]]'
      limit 1
    ) n on true
    -- MAH → MAHJID, and a full name typed as one word (MAHJIDMARCELO) → MAHJID.
    where (upper(rc.code) like v_text || '%' or (char_length(rc.code) >= 4 and v_text like upper(rc.code) || '%'))
      and rc.is_active = true
      and (rc.expires_at is null or rc.expires_at > now())
      and (rc.max_uses is null or rc.current_uses < rc.max_uses)
    order by (upper(rc.code) = v_text) desc, (upper(rc.code) like v_text || '%') desc, rc.current_uses desc, char_length(rc.code), rc.code
    limit 1;
end;
$$;

revoke all on function public.suggest_invite_code(text) from public;
grant execute on function public.suggest_invite_code(text) to anon, authenticated;
