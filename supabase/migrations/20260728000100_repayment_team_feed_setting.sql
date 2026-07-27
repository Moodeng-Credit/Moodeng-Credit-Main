-- Toggle for posting a "loan repaid" message to the operator team group (the same group that already
-- receives new-request lender suggestions). Defaults ON; flip to 'false' to silence without a redeploy.
INSERT INTO public.telegram_bot_settings (key, value, description)
VALUES
  ('repayment_team_feed_enabled', 'true',
   'Set to true to post a message to the team group (team_group_chat_id) when a loan is fully repaid.')
ON CONFLICT (key) DO NOTHING;
