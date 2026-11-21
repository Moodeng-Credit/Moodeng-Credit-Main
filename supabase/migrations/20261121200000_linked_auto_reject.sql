-- Same person as an account we already turned down → rejected automatically (George 2026-11-21:
-- "can we do it automatically when the evidence is strong enough"). See _shared/linkedAccounts.ts.
-- auto_rejected_at: this rule rejected them (never twice). team_cleared_at: the team let them back in
-- with /reopen, so the rule leaves them alone.
alter table public.linked_account_alerts add column if not exists auto_rejected_at timestamptz;
alter table public.linked_account_alerts add column if not exists team_cleared_at timestamptz;

-- reject (default) | observe | off
insert into public.telegram_bot_settings (key, value) values ('linked_auto_reject', 'reject')
on conflict (key) do nothing;
