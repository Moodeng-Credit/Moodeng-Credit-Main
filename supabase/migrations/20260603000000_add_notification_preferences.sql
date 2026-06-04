-- Add notification preference columns to users table
-- These control whether email/Telegram notifications are sent per category

ALTER TABLE public.users
  ADD COLUMN IF NOT EXISTS notif_account_activity     BOOLEAN NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS notif_transaction_activity BOOLEAN NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS notif_blogs                BOOLEAN NOT NULL DEFAULT false;

COMMENT ON COLUMN public.users.notif_account_activity     IS 'User wants notifications for account events (loan approvals, World ID, etc.)';
COMMENT ON COLUMN public.users.notif_transaction_activity IS 'User wants notifications for money movements (funded, repayment, overdue, due)';
COMMENT ON COLUMN public.users.notif_blogs                IS 'User wants Moodeng blog/news/weekly digest notifications';
