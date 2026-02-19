# Backend

This is the backend for the Moodeng Credit platform.

## Structure

```
backend/
├── supabase/         # Supabase edge functions and config
│   ├── functions/    # Edge functions (Deno)
│   └── migrations/   # Database migrations
└── server.js         # Simple Node.js server for Docker dev
```

## Docker Development

The backend runs as a Docker container with a simple Node.js server for development.

For production, the actual backend logic is in Supabase Edge Functions (Deno runtime).

## Local Development

For local development with Supabase functions, **run all Supabase commands from the `backend/` directory** (so the CLI finds `supabase/config.toml` and `supabase/migrations/`):

```bash
# Install Supabase CLI
npm install -g supabase

cd backend
supabase start

# Serve functions locally
supabase functions serve
```

## Running migrations

Migrations live in `backend/supabase/migrations/`. Run them as follows.

**Local (Supabase running via CLI):**

```bash
cd backend
supabase start          # First time: starts DB and runs all migrations
```

If you added a new migration (e.g. `transactions`) after Supabase was already running, the new migration will **not** run automatically. Re-apply all migrations with:

```bash
cd backend
supabase db reset       # Resets local DB and runs every migration (including new ones)
```

Then confirm the table exists, e.g. in Supabase Studio (URL printed by `supabase start`) → Table Editor → `transactions`.

**Remote (hosted Supabase project, e.g. [Dev] Moodeng):**

1. Link the project (once):
   ```bash
   cd backend
   supabase link --project-ref YOUR_PROJECT_REF
   ```
   `YOUR_PROJECT_REF` is the project ID (e.g. `qplmmxynzxzkfxtayoqr`). You’ll be prompted for the DB password (Supabase Dashboard → Settings → Database).

2. Push migrations:
   ```bash
   supabase db push
   ```

To run a single migration or inspect status, use `supabase migration list` and `supabase db push` (pushes all pending).

## Docker Container

The Docker container runs a simple Node.js server on port 8000 with:
- `/health` - Health check endpoint
- `/api` - API information endpoint

This is primarily for demonstrating the Docker setup. Production backend uses Supabase Edge Functions.
