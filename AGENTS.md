# AI Agent Instructions

These instructions apply to the entire repository. Agents should also refer to:
- [docs/CODING_STANDARDS.md](docs/CODING_STANDARDS.md) for detailed coding rules.
- [docs/SYSTEM_DESIGN.md](docs/SYSTEM_DESIGN.md) for architecture overview.

## Working Agreements
- Preferred IDE: **VSCode**.
- Coding agents in use: **OpenAI Codex** (web/CLI/Linear) and **GitHub Copilot** (VSCode + Coding Agent).
- Use **TypeScript** and React best practices for any new code.
- Do not introduce `try/catch` blocks around imports.
- Prefer **absolute imports** via `@/` instead of relative paths for files in `src/`.
- Keep changes focused and avoid unrelated refactors.

## Project Commands (use pnpm)
- Install: `pnpm install`
- Dev (staging env): `pnpm run dev`
- Dev (local env): `pnpm run dev:local`
- Build: `pnpm run build`
- Lint: `pnpm run lint`
- Type check: `pnpm run type-check`
- Format: `pnpm run format`
- Tests: `pnpm test` | `pnpm test:e2e`

## Environment
- Environment files are managed via **dotenvx**. Obtain `.env.keys` from the team to decrypt secrets.
- Default dev server runs on **http://localhost:3000**.

## Where to Look
- UI and routes: `src/app/`
- Reusable UI: `src/components/`
- State management: `src/store/`
- API and services: `src/lib/`
- Supabase edge functions/migrations: `supabase/`
