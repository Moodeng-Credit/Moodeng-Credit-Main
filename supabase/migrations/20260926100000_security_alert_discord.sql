-- Security alerts now go to Discord #security (all of them) and Telegram only for high/critical,
-- so record whether the Discord post landed alongside the Telegram and email outcomes.
alter table public.security_alert_deliveries add column if not exists discord_ok boolean not null default false;
