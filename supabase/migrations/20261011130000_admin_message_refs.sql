-- Admin decision cards with a before and after state (supabase/functions/_shared/adminCards.ts).
--
-- admin_message_refs remembers where each admin message that asks for a decision was posted, keyed
-- by what decides it (kind + ref_id, e.g. 'loan_access' + user id, 'voucher' + claim id). Whatever
-- path decides — a Telegram button or command, the admin panel, Zoom auto no-show, a Didit verdict —
-- stampDecisionCards deletes the refs (DELETE … RETURNING, so each card is stamped once) and edits
-- every message into its after-state. Channel-agnostic: only 'telegram' is posted today; 'discord'
-- (webhook messages, webhook_key → which webhook) is the next step.
create table if not exists public.admin_message_refs (
  id uuid primary key default gen_random_uuid(),
  kind text not null,
  ref_id text not null,
  channel text not null check (channel in ('telegram', 'discord')),
  chat_id text null,
  webhook_key text null,
  message_id text not null,
  original_text text null,
  -- Telegram: { links: [[{ text, url }]] } — the link buttons kept on the decided card.
  original_payload jsonb null,
  created_at timestamptz not null default now()
);

create index if not exists admin_message_refs_kind_ref_idx on public.admin_message_refs (kind, ref_id);
create index if not exists admin_message_refs_message_idx on public.admin_message_refs (channel, chat_id, message_id);

-- Edge functions only (service role). No client access at all.
alter table public.admin_message_refs enable row level security;
revoke all on public.admin_message_refs from anon, authenticated;

-- A voucher claim decided outside Telegram (the admin panel's Voucher claims) stamps its Telegram
-- card too: voucher-claim-telegram-notification with event 'decided'. Taps on the card's own
-- buttons already stamped it, so then this is a no-op. Same vault-secret pattern as
-- private.notify_voucher_claim_telegram.
create or replace function private.notify_voucher_claim_decided()
returns trigger
language plpgsql
security definer
set search_path = 'public', 'vault', 'net'
as $$
declare
  project_url text;
  service_key text;
  decided_by text;
begin
  select decrypted_secret into project_url from vault.decrypted_secrets where name = 'SUPABASE_PROJECT_URL' limit 1;
  select decrypted_secret into service_key from vault.decrypted_secrets where name = 'SUPABASE_SECRET_KEY' limit 1;

  if project_url is null or service_key is null then
    raise warning 'Voucher claim card stamp skipped: Supabase project URL or secret key missing from vault.';
    return new;
  end if;

  -- The admin who saved it in the panel (null for service-role updates, e.g. the Telegram button).
  select display_name into decided_by from public.admin_users where user_id = auth.uid() and active limit 1;

  perform net.http_post(
    url := project_url || '/functions/v1/voucher-claim-telegram-notification',
    headers := jsonb_build_object('Content-Type', 'application/json', 'Authorization', 'Bearer ' || service_key),
    body := jsonb_build_object('claimId', new.id, 'event', 'decided', 'decidedBy', decided_by)
  );
  return new;
end;
$$;

revoke all on function private.notify_voucher_claim_decided() from public, anon, authenticated;

drop trigger if exists notify_voucher_claim_decided on public.voucher_claims;
create trigger notify_voucher_claim_decided
  after update of status on public.voucher_claims
  for each row
  when (old.status = 'pending' and new.status in ('sent', 'rejected'))
  execute function private.notify_voucher_claim_decided();
