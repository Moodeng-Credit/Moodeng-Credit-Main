-- Post every new GrabFood voucher claim to the admin Telegram channel (Mark sent / Reject buttons),
-- via the voucher-claim-telegram-notification edge function. Same vault-secret pattern as
-- private.notify_loan_request_telegram.
create or replace function private.notify_voucher_claim_telegram()
returns trigger
language plpgsql
security definer
set search_path = 'public', 'vault', 'net'
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
    url := project_url || '/functions/v1/voucher-claim-telegram-notification',
    headers := jsonb_build_object('Content-Type', 'application/json', 'Authorization', 'Bearer ' || service_key),
    body := jsonb_build_object('claimId', new.id)
  );
  return new;
end;
$$;

drop trigger if exists notify_voucher_claim_telegram on public.voucher_claims;
create trigger notify_voucher_claim_telegram
  after insert on public.voucher_claims
  for each row
  execute function private.notify_voucher_claim_telegram();
