#!/bin/bash

# Script to sync secrets from .env.production to Supabase Edge Functions

# Instructions:
# 1. Ensure you have supabase CLI and dotenvx installed.
# 2. Run this script from the project root.

# Note: The file is .env.production in the workspace.
ENV_FILE=".env.production"

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

echo "🚀 Production Project Ref: $PROJECT_REF"

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

rm "$TEMP_ENV"
echo "Done."
