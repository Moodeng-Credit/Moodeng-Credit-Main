-- Pre-screening cards go to the "Pre Screening" Telegram group (George, 2026-11-18). Empty = KYC group.
insert into public.telegram_bot_settings (key, value, description)
values ('prescreen_chat_id', '-5306523492', 'Telegram chat for pre-screening cards (✅/❌ buttons); empty = kyc_alert_chat_id')
on conflict (key) do update set value = excluded.value;
