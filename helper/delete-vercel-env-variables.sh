# Set your target environment (e.g., production, preview, development)
TARGET_ENV="preview"
# Example: TARGET_ENV="preview"

# Set your project name (Optional, but good for safety)
# You can often omit this if you are in the project directory
PROJECT_NAME="Moodeng"

echo "Listing all environment variables for '$TARGET_ENV' on project '$PROJECT_NAME'..."

# Check if we can list env vars (ensures project is linked and accessible)
if ! vercel env ls $TARGET_ENV >/dev/null 2>&1; then
  echo "Error: Unable to list environment variables. Ensure the project is linked with 'vercel link' and you have access to the '$TARGET_ENV' environment."
  exit 1
fi

# List the variables for the environment, skip header, extract the KEY (first column), and remove them
vercel env ls $TARGET_ENV | tail -n +2 | awk '{print $1}' | \
  while IFS= read -r key; do
    if [ ! -z "$key" ]; then
      echo "Deleting variable: $key for environment: $TARGET_ENV"
      # The --yes flag bypasses the confirmation prompt
      vercel env rm "$key" $TARGET_ENV --yes
    fi
  done

echo "Cleanup complete."