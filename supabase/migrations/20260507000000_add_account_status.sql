DO $$
BEGIN
  CREATE TYPE account_status AS ENUM ('active', 'blocked', 'banned');
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

ALTER TABLE users
ADD COLUMN IF NOT EXISTS account_status account_status NOT NULL DEFAULT 'active';

CREATE INDEX IF NOT EXISTS idx_users_account_status ON users(account_status);
