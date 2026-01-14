#!/bin/bash

# Script to sync secrets from .env.staging to Supabase Edge Functions

# Instructions:
# 1. Ensure you have supabase CLI and dotenvx installed.
# 2. Run this script from the project root.

ENV_FILE=".env.staging"

if [ ! -f "$ENV_FILE" ]; then
    echo "❌ Error: $ENV_FILE not found."
    exit 1
fi

echo "🔐 Decrypting $ENV_FILE..."

# Get Project Ref from VITE_SUPABASE_URL
VITE_SUPABASE_URL=$(npx dotenvx get VITE_SUPABASE_URL -f "$ENV_FILE")

if [ -z "$VITE_SUPABASE_URL" ]; then
    echo "❌ Error: Could not find VITE_SUPABASE_URL in $ENV_FILE"
    exit 1
fi

PROJECT_REF=$(echo "$VITE_SUPABASE_URL" | sed -E 's/https:\/\/([^.]+)\.supabase\.(co|net).*/\1/')

if [ -z "$PROJECT_REF" ]; then
    echo "❌ Error: Could not extract PROJECT_REF from $VITE_SUPABASE_URL"
    exit 1
fi

echo "🚀 Staging Project Ref: $PROJECT_REF"

# Decrypt to a temporary file
TEMP_ENV=$(mktemp)
npx dotenvx decrypt -f "$ENV_FILE" --stdout > "$TEMP_ENV"

# Sync to Supabase
echo "📤 Syncing secrets to Supabase..."

echo "--------------------------------------------------"
echo "Printing variables to be synced:"
cat "$TEMP_ENV"
echo "--------------------------------------------------"

npx supabase secrets set --project-ref "$PROJECT_REF" --env-file "$TEMP_ENV"

if [ $? -eq 0 ]; then
    echo "✅ Secrets synced successfully."
else
    echo "❌ Failed to sync secrets."
    rm "$TEMP_ENV"
    exit 1
fi

# Requirement: Check for variables used in functions but missing from .env.staging
echo "🔍 Checking for variables used in Supabase Functions but missing from $ENV_FILE..."

# Find all Deno.env.get('VAR_NAME') or Deno.env.get("VAR_NAME") in functions
FUNCTION_VARS=$(grep -r "Deno.env.get" supabase/functions | sed -E "s/.*Deno.env.get\(['\"]([^'\"]+)['\"]\).*/\1/" | sort | uniq)

MISSING_IN_DOTENV=()
for var in $FUNCTION_VARS; do
    # Skip standard Supabase vars that are usually auto-provided
    if [[ "$var" == SUPABASE_* ]]; then
        continue
    fi
    
    if ! grep -q "^$var=" "$TEMP_ENV"; then
        MISSING_IN_DOTENV+=("$var")
    fi
done

if [ ${#MISSING_IN_DOTENV[@]} -eq 0 ]; then
    echo "✅ All non-Supabase variables used in functions are present in $ENV_FILE."
else
    echo "⚠️  The following variables are used in functions but MISSING from $ENV_FILE:"
    for var in "${MISSING_IN_DOTENV[@]}"; do
        echo "   - $var"
    done
fi

# Existing check: Check for secrets in Supabase NOT present in .env.staging
echo "🔍 Checking for secrets currently in Supabase NOT present in $ENV_FILE..."
SUPABASE_SECRETS_JSON=$(npx supabase secrets list --project-ref "$PROJECT_REF" --output json)

# Get keys from local env (ignoring comments and empty lines)
# Using awk to handle potential spaces around '=' if any, though dotenvx usually formats them
LOCAL_KEYS=$(grep -v '^#' "$TEMP_ENV" | grep '=' | cut -d'=' -f1 | sort)

# Get keys from Supabase
REMOTE_KEYS=$(echo "$SUPABASE_SECRETS_JSON" | jq -r '.[].name' | sort)

MISSING_LOCALLY=()

for remote_key in $REMOTE_KEYS; do
    if ! grep -q "^$remote_key=" "$TEMP_ENV"; then
        MISSING_LOCALLY+=("$remote_key")
    fi
done

if [ ${#MISSING_LOCALLY[@]} -eq 0 ]; then
    echo "✅ All remote secrets are present in $ENV_FILE."
else
    echo "⚠️  The following secrets exist in Supabase but are MISSING from $ENV_FILE:"
    for key in "${MISSING_LOCALLY[@]}"; do
        echo "   - $key"
    done
fi

rm "$TEMP_ENV"
