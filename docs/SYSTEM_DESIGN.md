# System Design / Infrastructure Overview

This document summarizes the current architecture and infrastructure used by Moodeng Credit.

## High-Level Architecture
- **Frontend**: React + Vite single-page application.
- **State**: Redux Toolkit (client state) + React Query (server state).
- **Backend services**: Supabase (PostgreSQL + Auth + Edge Functions).
- **Web3**: RainbowKit + Wagmi + Viem with WalletConnect and Alchemy.
- **Identity**: World ID (Worldcoin) verification.
- **Notifications**: Email (Gmail OAuth2 via Nodemailer) and Telegram Bot.

## Runtime Flow
1. **Client** renders UI via React/Vite.
2. **API calls** are made to Supabase REST endpoints or Edge Functions.
3. **Auth** uses Supabase Auth (JWT tokens) with optional Google OAuth and World ID verification.
4. **Web3** wallet connections are handled client-side via RainbowKit/Wagmi.
5. **Notifications** are sent from Edge Functions using Gmail OAuth2 or Telegram Bot tokens.

## Infrastructure Components
- **Supabase**
  - Postgres database
  - Auth (JWT)
  - Edge Functions (`supabase/functions/`)
  - Migrations (`supabase/migrations/`)
- **Vercel**
  - SPA rewrites to `index.html` (`vercel.json`)
- **Local Development**
  - `dotenvx` loads `.env.*` files
  - Default dev server: `http://localhost:3000`

## Environment Configuration
See `env.example` for required variables. Key categories:
- Supabase URL + publishable key
- Google OAuth client ID
- Telegram bot username/token
- WalletConnect/Alchemy IDs
- World ID app/action IDs

## Repository Layout (Key Areas)
- `src/app/`: routes and pages
- `src/components/`: shared UI components
- `src/lib/`: service clients and integrations
- `src/store/`: Redux store
- `supabase/`: edge functions, config, and migrations
