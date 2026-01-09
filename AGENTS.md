# AI Agent Instructions

These instructions apply to the entire repository.

## Working Agreements
- Preferred IDE: **VSCode**.
- Coding agents in use: **OpenAI Codex** (web/CLI/Linear) and **GitHub Copilot** (VSCode + Coding Agent).
- Use **TypeScript** and React best practices for any new code.
- Do not introduce `try/catch` blocks around imports.
- Prefer **absolute imports** via `@/` instead of relative paths for files in `src/`.
- Keep changes focused and avoid unrelated refactors.

## Project Commands
- Install: `npm install`
- Dev (staging env): `npm run dev`
- Dev (local env): `npm run dev:local`
- Build: `npm run build`
- Lint: `npm run lint`
- Type check: `npm run type-check`
- Format: `npm run format`

## Environment
- Environment files are loaded via `dotenvx`. See `env.example` for required variables.
- Default dev server runs on **http://localhost:3000**.

## Where to Look
- UI and routes: `src/app/`
- Reusable UI: `src/components/`
- State management: `src/store/`
- API and services: `src/lib/`
- Supabase edge functions/migrations: `supabase/`
