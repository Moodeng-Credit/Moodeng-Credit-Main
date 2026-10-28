-- Food voucher claims, sends and "I got it" / "Didn't get it" answers go to their own Telegram group
-- (same bot). voucher-claim-telegram-notification falls back to kyc_alert_chat_id when this is unset.
insert into public.telegram_bot_settings (key, value, description)
values ('voucher_alert_chat_id', '-5423074039', 'Telegram group for food voucher claims, sends and receipt answers.')
on conflict (key) do update set value = excluded.value;

-- Admins can see which link or code each claim got (Food vouchers → Sent: who got what).
drop policy if exists voucher_codes_admin_read on public.voucher_codes;
create policy voucher_codes_admin_read on public.voucher_codes
  for select to authenticated
  using (app_private.is_moodeng_admin());
