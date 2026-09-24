-- Tell the team when a borrower claims a GrabFood voucher (Telegram team group + Discord), so
-- someone buys and sends it. Same pattern as private.notify_loan_request_telegram(): an AFTER
-- INSERT trigger posts the claim id to an internal edge function with the vault secret key.
-- Best-effort: the claim row is already written, and net.http_post is async, so a missing secret
-- or a failed call never blocks the claim.

create or replace function private.notify_voucher_claim()
returns trigger
language plpgsql
security definer
set search_path = public, vault, net
as $$
declare
  project_url text;
  service_key text;
begin
  select decrypted_secret into project_url from vault.decrypted_secrets where name = 'SUPABASE_PROJECT_URL' limit 1;
  select decrypted_secret into service_key from vault.decrypted_secrets where name = 'SUPABASE_SECRET_KEY' limit 1;

  if project_url is null or service_key is null then
    raise warning 'Voucher claim notification skipped: Supabase project URL or secret key missing from vault.';
    return new;
  end if;

  perform net.http_post(
    url := project_url || '/functions/v1/voucher-claim-notification',
    headers := jsonb_build_object('Content-Type', 'application/json', 'Authorization', 'Bearer ' || service_key),
    body := jsonb_build_object('claimId', new.id)
  );
  return new;
exception
  when others then
    raise warning 'Voucher claim notification failed: %', sqlerrm;
    return new;
end;
$$;

revoke all on function private.notify_voucher_claim() from public;

drop trigger if exists notify_voucher_claim on public.voucher_claims;
create trigger notify_voucher_claim
  after insert on public.voucher_claims
  for each row execute function private.notify_voucher_claim();
