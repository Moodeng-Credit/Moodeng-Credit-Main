#!/bin/bash

# This script decrypts the staging environment variables and prints the SQL commands
# to add PROJECT_URL and SUPABASE_SECRET_KEY to the Supabase Vault.

# Ensure dotenvx is installed
if ! command -v dotenvx &> /dev/null; then
    echo "Error: dotenvx is not installed. Please install it first."
    exit 1
fi

ENV_FILE=".env.staging"

if [ ! -f "$ENV_FILE" ]; then
    echo "Error: $ENV_FILE not found."
    exit 1
fi

echo "--- Staging Supabase Vault Setup ---"
echo "Decrypting $ENV_FILE..."


# Extract values using dotenvx
# We use VITE_SUPABASE_URL as SUPABASE_PROJECT_URL
SUPABASE_PROJECT_URL=$(dotenvx get VITE_SUPABASE_URL --env-file "$ENV_FILE")
SUPABASE_SECRET_KEY=$(dotenvx get SUPABASE_SECRET_KEY --env-file "$ENV_FILE")
# Optional: try to get DB password for psql
SUPABASE_DB_PASSWORD=$(dotenvx get SUPABASE_DB_PASSWORD --env-file "$ENV_FILE")

if [ -z "$SUPABASE_PROJECT_URL" ] || [ -z "$SUPABASE_SECRET_KEY" ]; then
    echo "Error: Could not extract VITE_SUPABASE_URL or SUPABASE_SECRET_KEY from $ENV_FILE."
    echo "Make sure VITE_SUPABASE_URL and SUPABASE_SECRET_KEY are defined and decrypted."
    exit 1
fi

# Extract project ref from URL
PROJECT_REF=$(echo "$SUPABASE_PROJECT_URL" | sed -E 's/https:\/\/([^.]+)\.supabase\.(co|net).*/\1/')

echo "Project URL: $SUPABASE_PROJECT_URL"
echo "Secret Key: $SUPABASE_SECRET_KEY"
echo "Project Ref: $PROJECT_REF"
echo ""
echo "Updating Database Vault for project $PROJECT_REF..."

# 1. Update Database Vault Secrets using psql (required for SQL Cron)
SQL="DO \$\$
DECLARE
  project_url_id uuid;
  secret_key_id uuid;
BEGIN
  -- Handle SUPABASE_PROJECT_URL
  SELECT id INTO project_url_id FROM vault.secrets WHERE name = 'SUPABASE_PROJECT_URL';
  IF project_url_id IS NOT NULL THEN
    PERFORM vault.update_secret(project_url_id, '$SUPABASE_PROJECT_URL');
  ELSE
    PERFORM vault.create_secret('$SUPABASE_PROJECT_URL', 'SUPABASE_PROJECT_URL');
  END IF;

  -- Handle SUPABASE_SECRET_KEY
  SELECT id INTO secret_key_id FROM vault.secrets WHERE name = 'SUPABASE_SECRET_KEY';
  IF secret_key_id IS NOT NULL THEN
    PERFORM vault.update_secret(secret_key_id, '$SUPABASE_SECRET_KEY');
  ELSE
    PERFORM vault.create_secret('$SUPABASE_SECRET_KEY', 'SUPABASE_SECRET_KEY');
  END IF;
END \$\$;"

# Construct psql command. psql is the most reliable way to run arbitrary SQL on remote.
if command -v psql &> /dev/null; then
    echo "Updating Database Vault using psql..."
    if [ ! -z "$SUPABASE_DB_PASSWORD" ]; then
        export PGPASSWORD="$SUPABASE_DB_PASSWORD"
    fi
    # Session Pooler Link: postgresql://postgres.[PROJECT_REF]:[password]@aws-1-ap-south-1.pooler.supabase.com:5432/postgres
    psql "postgresql://postgres.$PROJECT_REF@aws-1-ap-south-1.pooler.supabase.com:5432/postgres" -c "$SQL"
else
    echo "psql not found. Please run the following SQL manually in the Supabase Dashboard SQL Editor for project $PROJECT_REF:"
    echo ""
    echo "$SQL"
fi

if [ $? -eq 0 ]; then
    echo ""
    echo "Success: Vault secrets updated for $ENV_FILE."
else
    echo ""
    echo "Error: Failed to update Vault secrets. Check your psql connection and database password."
    echo "Construction used: postgresql://postgres.$PROJECT_REF@aws-1-ap-south-1.pooler.supabase.com:5432/postgres"
fi

