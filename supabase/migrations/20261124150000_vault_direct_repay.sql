-- Vault direct repay (2026-11-24): a BitRepo-vault loan repaid from the Instant Wallet goes straight
-- into the vault (approve + vault.repay(loanId)) instead of to the lending wallet, so BitRepo sees it
-- repaid at once and nothing waits on Admin → Credit line → Pay vault.
-- Switch: telegram_bot_settings.vault_direct_repay = off | all | <user ids, comma-separated> (test).
-- Off = every repay goes to the lending wallet, as before. confirm-loan-payment accepts both either way.
insert into public.telegram_bot_settings (key, value, description)
values ('vault_direct_repay', 'off', 'Instant Wallet repays of vault loans go straight into the BitRepo vault: off | all | comma-separated user ids (test)')
on conflict (key) do nothing;

create or replace function public.get_vault_direct_repay()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce((
    select lower(btrim(value)) = 'all'
        or (auth.uid() is not null and auth.uid()::text = any (string_to_array(replace(value, ' ', ''), ',')))
    from public.telegram_bot_settings where key = 'vault_direct_repay'
  ), false);
$$;

revoke all on function public.get_vault_direct_repay() from public;
grant execute on function public.get_vault_direct_repay() to authenticated;
