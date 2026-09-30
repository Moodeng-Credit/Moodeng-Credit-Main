-- Toggle for posting "due today" / "overdue" loans to the operator team group (team_group_chat_id).
-- Defaults ON; flip to 'false' to silence without a redeploy.
INSERT INTO public.telegram_bot_settings (key, value, description)
VALUES
  ('due_team_feed_enabled', 'true',
   'Set to false to stop posting due-today and overdue loans to the team group (team_group_chat_id).')
ON CONFLICT (key) DO NOTHING;
