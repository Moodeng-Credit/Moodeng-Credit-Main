-- BigQuery schema for Moodeng Credit (derived from PostgreSQL)
-- Run in order; replace `moodeng` with your dataset ID.
-- Note: BigQuery has no FK constraints, enums, or sequences; enums stored as STRING.

-- ---------------------------------------------------------------------------
-- users (referenced by loans, loan_notifications, point_events, user_points)
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS `moodeng.users` (
  id STRING NOT NULL,
  wallet_address STRING,cle
  username STRING NOT NULL,
  email STRING NOT NULL,
  google_id STRING,
  telegram_id INT64,
  telegram_username STRING,
  chat_id INT64,
  is_world_id STRING DEFAULT 'INACTIVE',  -- world_id_status enum
  nullifier_hash STRING,
  mal INT64 DEFAULT 3,
  nal INT64 DEFAULT 0,
  cs INT64 DEFAULT 20,
  reset_token STRING,
  reset_token_expiry TIMESTAMP,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP(),
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP(),
  credit_progression_paused BOOL NOT NULL DEFAULT FALSE
)
PARTITION BY DATE(created_at)
CLUSTER BY id;

-- ---------------------------------------------------------------------------
-- loans (references users)
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS `moodeng.loans` (
  id STRING NOT NULL,
  tracking_id STRING NOT NULL,
  borrower_wallet STRING,
  lender_wallet STRING,
  loan_amount NUMERIC NOT NULL,
  repaid_amount NUMERIC DEFAULT 0,
  total_repayment_amount NUMERIC NOT NULL,
  reason STRING NOT NULL,
  loan_status STRING DEFAULT 'Requested',       -- loan_status enum
  repayment_status STRING DEFAULT 'Unpaid',     -- repayment_status enum
  coin STRING NOT NULL,
  hash ARRAY<STRING> DEFAULT [],
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP(),
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP(),
  due_date TIMESTAMP NOT NULL,
  funded_at TIMESTAMP,
  borrower_user_id STRING,
  lender_user_id STRING
)
PARTITION BY DATE(created_at)
CLUSTER BY id, borrower_user_id, lender_user_id;

-- ---------------------------------------------------------------------------
-- loan_notifications (references loans, users)
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS `moodeng.loan_notifications` (
  id STRING NOT NULL,
  loan_id STRING NOT NULL,
  user_id STRING NOT NULL,
  notification_type STRING NOT NULL,  -- enum as STRING
  email_sent_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP()
)
PARTITION BY DATE(email_sent_at)
CLUSTER BY loan_id, user_id;

-- ---------------------------------------------------------------------------
-- point_events (references users)
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS `moodeng.point_events` (
  id INT64 NOT NULL,
  user_id STRING NOT NULL,
  event_type STRING NOT NULL,
  delta INT64 NOT NULL,
  source_type STRING NOT NULL,
  source_id STRING NOT NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP(),
  metadata JSON DEFAULT '{}'
)
PARTITION BY DATE(created_at)
CLUSTER BY user_id;

-- ---------------------------------------------------------------------------
-- user_points (references users)
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS `moodeng.user_points` (
  user_id STRING NOT NULL,
  points_total INT64 NOT NULL DEFAULT 0,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP(),
  last_event_id INT64
)
CLUSTER BY user_id;
