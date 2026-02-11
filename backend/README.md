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

For local development with Supabase functions:

```bash
# Install Supabase CLI
npm install -g supabase

# Start Supabase locally
supabase start

# Serve functions locally
supabase functions serve
```

## Docker Container

The Docker container runs a simple Node.js server on port 8000 with:
- `/health` - Health check endpoint
- `/api` - API information endpoint

This is primarily for demonstrating the Docker setup. Production backend uses Supabase Edge Functions.
