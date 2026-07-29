-- Owner-visible wallet connection history.
--
-- wallet_usage_log is an internal fraud ledger. It proves which addresses have
-- been used with an account, but it cannot describe an exact connection event.
-- This table records those events from now on and seeds older addresses as
-- "historical" so the product can help users recognize a wallet they used before
-- without claiming an exact change or disconnect date.

create table if not exists public.wallet_connection_events (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.users(id) on delete cascade,
  event_type text not null check (event_type in ('connected', 'changed', 'disconnected', 'historical')),
  wallet_address text not null,
  previous_wallet_address text,
  wallet_provider text,
  wallet_connector_name text,
  wallet_chain_id integer,
  occurred_at timestamptz not null default now()
);

create index if not exists wallet_connection_events_user_time_idx
  on public.wallet_connection_events (user_id, occurred_at desc);

alter table public.wallet_connection_events enable row level security;

drop policy if exists "admins read wallet connection events" on public.wallet_connection_events;
create policy "admins read wallet connection events"
  on public.wallet_connection_events
  for select
  to authenticated
  using (app_private.is_moodeng_admin());

revoke all on table public.wallet_connection_events from public;
revoke all on table public.wallet_connection_events from anon;
revoke all on table public.wallet_connection_events from authenticated;
grant select on table public.wallet_connection_events to authenticated;
grant all on table public.wallet_connection_events to service_role;

create or replace function app_private.log_wallet_connection_event()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  old_address text := nullif(lower(btrim(old.wallet_address)), '');
  new_address text := nullif(lower(btrim(new.wallet_address)), '');
begin
  if old_address is not distinct from new_address then
    return new;
  end if;

  if old_address is null and new_address is not null then
    insert into public.wallet_connection_events (
      user_id,
      event_type,
      wallet_address,
      wallet_provider,
      wallet_connector_name,
      wallet_chain_id
    )
    values (
      new.id,
      'connected',
      new_address,
      new.wallet_provider,
      new.wallet_connector_name,
      new.wallet_chain_id
    );
  elsif old_address is not null and new_address is null then
    insert into public.wallet_connection_events (
      user_id,
      event_type,
      wallet_address,
      wallet_provider,
      wallet_connector_name,
      wallet_chain_id
    )
    values (
      new.id,
      'disconnected',
      old_address,
      old.wallet_provider,
      old.wallet_connector_name,
      old.wallet_chain_id
    );
  else
    insert into public.wallet_connection_events (
      user_id,
      event_type,
      wallet_address,
      previous_wallet_address,
      wallet_provider,
      wallet_connector_name,
      wallet_chain_id
    )
    values (
      new.id,
      'changed',
      new_address,
      old_address,
      new.wallet_provider,
      new.wallet_connector_name,
      new.wallet_chain_id
    );
  end if;

  return new;
end;
$$;

drop trigger if exists log_wallet_connection_event_on_users on public.users;
create trigger log_wallet_connection_event_on_users
  after update of wallet_address on public.users
  for each row
  execute function app_private.log_wallet_connection_event();

-- Seed the current address conservatively. Pre-migration timestamps can tell us
-- when the wallet was recorded, but not prove an exact connection event.
insert into public.wallet_connection_events (
  user_id,
  event_type,
  wallet_address,
  wallet_provider,
  wallet_connector_name,
  wallet_chain_id,
  occurred_at
)
select
  u.id,
  'historical',
  lower(btrim(u.wallet_address)),
  u.wallet_provider,
  u.wallet_connector_name,
  u.wallet_chain_id,
  coalesce(u.wallet_connected_at, u.updated_at, u.created_at, now())
from public.users u
where u.wallet_address is not null
  and btrim(u.wallet_address) <> ''
  and not exists (
    select 1
    from public.wallet_connection_events e
    where e.user_id = u.id
      and e.wallet_address = lower(btrim(u.wallet_address))
  );

-- Seed older addresses conservatively. "Historical" means only that the address
-- was used with Moodeng; it does not invent a connection or disconnection event.
insert into public.wallet_connection_events (
  user_id,
  event_type,
  wallet_address,
  occurred_at
)
select
  w.user_id,
  'historical',
  lower(btrim(w.wallet_address)),
  w.last_seen_at
from public.wallet_usage_log w
join public.users u on u.id = w.user_id
where lower(btrim(w.wallet_address)) is distinct from lower(btrim(u.wallet_address))
  and not exists (
    select 1
    from public.wallet_connection_events e
    where e.user_id = w.user_id
      and e.event_type = 'historical'
      and e.wallet_address = lower(btrim(w.wallet_address))
  );

create or replace function public.get_my_wallet_connection_history(p_limit integer default 12)
returns table (
  id uuid,
  event_type text,
  wallet_address text,
  previous_wallet_address text,
  wallet_provider text,
  wallet_connector_name text,
  wallet_chain_id integer,
  occurred_at timestamptz,
  total_wallets bigint
)
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  with wallet_addresses as (
    select e.wallet_address
    from public.wallet_connection_events e
    where e.user_id = auth.uid()

    union

    select e.previous_wallet_address
    from public.wallet_connection_events e
    where e.user_id = auth.uid()
      and e.previous_wallet_address is not null
  )
  select
    e.id,
    e.event_type,
    e.wallet_address,
    e.previous_wallet_address,
    e.wallet_provider,
    e.wallet_connector_name,
    e.wallet_chain_id,
    e.occurred_at,
    (select count(*) from wallet_addresses) as total_wallets
  from public.wallet_connection_events e
  where auth.uid() is not null
    and e.user_id = auth.uid()
  order by e.occurred_at desc
  limit least(greatest(coalesce(p_limit, 12), 1), 50);
$$;

revoke all on function public.get_my_wallet_connection_history(integer) from public;
revoke all on function public.get_my_wallet_connection_history(integer) from anon;
grant execute on function public.get_my_wallet_connection_history(integer) to authenticated;
grant execute on function public.get_my_wallet_connection_history(integer) to service_role;
