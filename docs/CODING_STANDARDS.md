# Coding Standards & Guidelines

These standards are intended for both human contributors and AI coding agents (Codex/Copilot).

## Language & Frameworks
- **TypeScript** for all application code.
- **React + Vite** for the front-end runtime.
- **Tailwind CSS** (plus `clsx`) for styling.
- **Redux Toolkit** for global state; **React Query** for server state.

## Imports
- Prefer absolute imports using `@/` (configured in `vite.config.ts`).
- Avoid new relative imports like `../` or `./` for `src/` modules.
- Do not wrap imports in `try/catch`.

## Formatting & Linting
- Formatting is enforced by **Prettier**.
- Linting is enforced by **ESLint** (see `eslint.config.js`).
- Run before committing:
  - `npm run lint`
  - `npm run type-check`
  - `npm run format`

## React Practices
- Use functional components and hooks.
- Follow hook rules (`react-hooks/rules-of-hooks`).
- Avoid array indexes as React keys.
- Keep components small and focused; extract reusable UI to `src/components/`.

## State & Data
- Client state: **Redux Toolkit** (`src/store/`).
- Server state: **React Query** hooks for data fetching/caching.
- Prefer explicit types; avoid `any`.

## Styling
- Tailwind classes are preferred over custom CSS where possible.
- Keep class lists readable; use `clsx` when conditional classes are required.

## Error Handling
- Handle errors in async workflows (React Query, service layers), not at import-time.
- Prefer user-safe messages and logging via existing patterns.

## File Organization
- Pages and routes: `src/app/`
- Components: `src/components/`
- Services, API clients: `src/lib/`
- Hooks: `src/hooks/`
- Types: `src/types/`
