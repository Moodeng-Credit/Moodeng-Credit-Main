INSERT INTO public.telegram_bot_settings (key, value, description)
VALUES
  ('borrower_notifications_enabled', 'false', 'Set to true after borrower Telegram notifications are ready for staging.')
ON CONFLICT (key) DO NOTHING;
