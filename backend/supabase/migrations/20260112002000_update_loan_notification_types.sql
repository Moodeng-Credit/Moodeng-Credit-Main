ALTER TYPE loan_notification_type RENAME TO loan_notification_type_old;

CREATE TYPE loan_notification_type AS ENUM ('funded', 'urgent_reminder', 'final_reminder', 'weekly_digest');

ALTER TABLE loan_notifications
  ALTER COLUMN notification_type TYPE loan_notification_type
  USING (
    CASE notification_type::text
      WHEN 'close_to_default' THEN 'urgent_reminder'
      WHEN 'outstanding' THEN 'final_reminder'
      ELSE notification_type::text
    END
  )::loan_notification_type;

DROP TYPE loan_notification_type_old;

DROP INDEX IF EXISTS loan_notifications_unique;

CREATE UNIQUE INDEX loan_notifications_unique_non_weekly
  ON loan_notifications (loan_id, user_id, notification_type)
  WHERE notification_type <> 'weekly_digest';
