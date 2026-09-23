-- Make a ban a real ban at the auth layer, not just a frontend redirect.
--
-- Until now 'banned' lived only in public.users.account_status: Supabase Auth still issued and
-- refreshed tokens for banned users, so they stayed signed in and could hit PostgREST / RPCs / edge
-- functions directly with a valid JWT. This closes that in three layers:
--
--   1. Trigger on account_status: moving INTO 'banned' sets auth.users.banned_until (GoTrue then
--      refuses sign-in and token refresh) and deletes every auth session (refresh tokens cascade),
--      so edge functions calling auth.getUser() reject the old JWT immediately. Moving OUT of
--      'banned' clears banned_until. Hanging it on account_status catches every ban path — the
--      admin Ban button (admin-ban-user), the restriction dropdown, admin-refund-loan, and SQL.
--   2. PostgREST pre-request hook: an access token that was minted before the ban stays
--      cryptographically valid until it expires, so every non-read request from a banned user is
--      rejected with 403. Reads stay allowed so the app can still load the profile and show the
--      /account-restricted page during that window (RLS already scopes reads to their own rows).
--   3. Backfill: apply the auth ban to everyone already banned.

create or replace function private.enforce_ban_in_auth()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.account_status = 'banned' and old.account_status is distinct from 'banned' then
    update auth.users set banned_until = now() + interval '100 years' where id = new.id;
    delete from auth.sessions where user_id = new.id;
  elsif old.account_status = 'banned' and new.account_status is distinct from 'banned' then
    update auth.users set banned_until = null where id = new.id;
  end if;
  return new;
end;
$$;

drop trigger if exists enforce_ban_in_auth on public.users;
create trigger enforce_ban_in_auth
after update of account_status on public.users
for each row
execute function private.enforce_ban_in_auth();

-- PostgREST calls this before every request, as the request's role. auth.uid() is null for anon
-- and service_role, so only signed-in end users are checked (a single PK lookup).
create or replace function public.reject_banned_writes()
returns void
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  if current_setting('request.method', true) in ('GET', 'HEAD') then
    return;
  end if;
  if exists (select 1 from public.users where id = auth.uid() and account_status = 'banned') then
    raise sqlstate 'PT403' using message = 'Account banned', hint = 'This account has been closed.';
  end if;
end;
$$;

grant execute on function public.reject_banned_writes() to anon, authenticated, service_role;

alter role authenticator set pgrst.db_pre_request = 'public.reject_banned_writes';
notify pgrst, 'reload config';

-- Backfill: everyone already banned.
update auth.users a
set banned_until = now() + interval '100 years'
from public.users u
where u.id = a.id and u.account_status = 'banned' and a.banned_until is null;

delete from auth.sessions s
using public.users u
where u.id = s.user_id and u.account_status = 'banned';
