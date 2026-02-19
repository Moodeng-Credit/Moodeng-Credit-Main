# Frontend

This is the React + Vite frontend for the Moodeng Credit platform.

## Local Development (without Docker)

```bash
# Install dependencies
pnpm install

# Run development server
pnpm run dev

# Run with local environment
pnpm run dev:local
```

## Docker Development

See the root `docker-dev.sh` script for Docker-based development.

## Project Structure

```
src/
├── app/              # Routes and page views
├── components/       # Reusable UI components
├── config/           # App configuration and constants
├── hooks/            # Custom React hooks
├── lib/              # Core services (Supabase, API handlers)
├── store/            # Redux state management
├── types/            # TypeScript definitions
└── utils/            # Helper functions
```

## Scripts

- `pnpm run dev` - Start development server (staging env)
- `pnpm run dev:local` - Start development server (local env)
- `pnpm run build` - Build for production
- `pnpm run lint` - Lint code
- `pnpm run type-check` - Type check
- `pnpm run format` - Format code
- `pnpm test` - Run unit tests
- `pnpm test:e2e` - Run E2E tests
