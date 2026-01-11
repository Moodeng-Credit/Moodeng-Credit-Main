CREATE TYPE loan_notification_type AS ENUM ('funded', 'close_to_default', 'outstanding');

CREATE TABLE loan_email_notifications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  loan_id UUID NOT NULL REFERENCES loans(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  notification_type loan_notification_type NOT NULL,
  sent_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE UNIQUE INDEX loan_email_notifications_unique
  ON loan_email_notifications (loan_id, user_id, notification_type);

ALTER TABLE loan_email_notifications ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Service role can manage notifications" ON loan_email_notifications
  FOR ALL TO service_role
  USING (true)
  WITH CHECK (true);
