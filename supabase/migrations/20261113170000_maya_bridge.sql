-- Send to Maya: Base USDC (Moodeng wallet) → Relay one-time address → USDC on Solana → the borrower's Maya.
-- users.maya_address = their Maya "Receive USDC" address on the Solana network. Written only by the
-- stableyard-deposit-address function (service role), which checks it is a real Solana address.
alter table public.users add column if not exists maya_address text;

-- users has a table-wide client UPDATE grant, so keep this column server-only with a trigger:
-- a signed-in client can neither set it on insert nor change it on update.
create or replace function app_private.keep_maya_address_server_only()
returns trigger language plpgsql set search_path = '' as $$
declare
  v_role text := coalesce(nullif(current_setting('request.jwt.claims', true), '')::jsonb ->> 'role', current_user::text);
begin
  if v_role in ('authenticated', 'anon') then
    if tg_op = 'INSERT' then
      new.maya_address := null;
    else
      new.maya_address := old.maya_address;
    end if;
  end if;
  return new;
end;
$$;
drop trigger if exists trg_keep_maya_address_server_only on public.users;
create trigger trg_keep_maya_address_server_only before insert or update of maya_address on public.users
  for each row execute function app_private.keep_maya_address_server_only();

-- relay_transfers gets a third direction, 'maya' (kept apart from the Walt 'cashout' rows).
alter table public.relay_transfers drop constraint if exists relay_transfers_direction_check;
alter table public.relay_transfers
  add constraint relay_transfers_direction_check check (direction in ('cashout', 'repay', 'maya'));

-- Kill switch / rollout: 'admins' (default, test first) → 'on' (everyone) → 'off'.
insert into public.telegram_bot_settings (key, value)
values ('maya_bridge', 'admins')
on conflict (key) do nothing;
