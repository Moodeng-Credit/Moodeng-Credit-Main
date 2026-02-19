# Moodeng Credit - Peer-to-Peer Lending Platform

> 💡 **New**: The project is now organized into separate Frontend and Backend folders with Docker support. See [DOCKER_SETUP.md](./DOCKER_SETUP.md) for Docker development instructions.

## 📋 Project Summary

**Moodeng Credit** is a decentralized peer-to-peer lending platform built with **React and Vite**. The platform connects borrowers with lenders, enabling trustless loan transactions with Web3 wallet integration and World ID verification for enhanced security and identity verification.

## 🎯 Core Purpose

- **Borrowers** can request loans and manage their borrowing activities
- **Lenders** can browse loan requests and fund borrowers
- **Identity Verification** through World ID ensures user authenticity
- **Web3 Integration** enables cryptocurrency wallet connections for secure transactions

## 🛠️ Tech Stack

| Category | Technology |
|----------|------------|
| **Framework** | React + Vite |
| **Language** | TypeScript |
| **Database** | PostgreSQL (Supabase) |
| **Styling** | Tailwind CSS |
| **State Management** | Redux Toolkit & React Query |
| **Web3** | RainbowKit, Wagmi, Viem |
| **Authentication** | JWT, World ID, Google OAuth, Telegram |
| **Testing** | Vitest, MSW, Playwright |

## 📁 Architecture Overview

```
frontend/
├── src/
│   ├── app/              # Routes and page views
│   ├── components/       # Reusable UI components
│   ├── config/           # App configuration and constants
│   ├── hooks/            # Custom React hooks
│   ├── lib/              # Core services (Supabase, API handlers)
│   ├── store/            # Redux state management
│   ├── types/            # TypeScript definitions
│   └── utils/            # Helper functions
└── Dockerfile.dev        # Docker config for frontend

backend/
├── supabase/
│   ├── functions/        # Edge functions
│   └── migrations/       # Database migrations
└── Dockerfile.dev        # Docker config for backend
```

## 🚀 Local Development

### Prerequisites

- **Node.js**: >= 24.0.0
- **pnpm**: >= 10.0.0
- **dotenvx**: `npm install -g @dotenvx/dotenvx` (optional, or use via `pnpm`)
- **Docker & Docker Compose**: For containerized development (recommended)

### Option 1: Docker Development Setup (Recommended)

Run both frontend and backend with hot reloading using Docker Compose.

#### Quick Start

```bash
# Start services in background
./docker-dev.sh up-d

# View logs
./docker-dev.sh logs

# Stop services
./docker-dev.sh down

# Rebuild containers
./docker-dev.sh rebuild
```

#### Services

- **Frontend (frontend-new)**: http://localhost:3000 (hot reload enabled)
- **Backend**: http://localhost:8000 (hot reload enabled)

#### Commands

- `./docker-dev.sh up` - Start in foreground
- `./docker-dev.sh up-d` - Start in background
- `./docker-dev.sh down` - Stop services
- `./docker-dev.sh logs` - View logs (add service name for specific logs)
- `./docker-dev.sh build` - Build containers
- `./docker-dev.sh rebuild` - Rebuild and start

#### After adding new npm dependencies (e.g. `@react-oauth/google`)

The frontend container runs `npm install` on startup, so new deps in `package.json` are installed automatically. If you still see "Module not found" for a new package:

1. **Restart the frontend** so it runs `npm install` again:
   ```bash
   docker-compose -f docker-compose.dev.yml restart frontend
   ```

2. If that doesn't fix it, **remove volumes and rebuild** (clears cached `node_modules`):
   ```bash
   docker-compose -f docker-compose.dev.yml down -v
   docker-compose -f docker-compose.dev.yml build frontend --no-cache
   ./docker-dev.sh up-d
   ```

#### Prerequisites for Docker Setup

- Docker and Docker Compose installed
- Backend files: `sakey.json` and `config.json` in `backend/` (if needed)
- Docker Desktop file sharing enabled for `/Users` (macOS)

### Option 2: Local Development (Without Docker)

#### Installation

1. **Clone and Install**
   ```bash
   git clone <repo-url>
   cd Moodeng-Credit-Main/frontend
   pnpm install
   ```
   *Note: `pnpm install` will automatically install Playwright browsers.*

2. **Environment Variables**
   - This project uses **dotenvx** for environment variable management.
   - You **must** obtain the `.env.keys` file from an existing developer to decrypt the secrets.
   - Without `.env.keys`, the app will not have access to the necessary API keys.

#### Running the App

- **Standard Development**:
  ```bash
  cd frontend
  pnpm run dev
  ```
- **Local Development (with local environment and HTTPS)**:
  ```bash
  cd frontend
  pnpm run dev:local
  ```

Visit [http://localhost:3000](http://localhost:3000) (or `https://localhost:3000` for local dev) to access the application.

## ✅ Quality Control

### Running Tests

```bash
# Navigate to frontend directory
cd frontend

# Unit tests (Vitest + MSW)
pnpm test

# Coverage report
pnpm test:coverage

# End-to-end tests (Playwright)
pnpm test:e2e
```

### Linting and Formatting

```bash
# Navigate to frontend directory
cd frontend

# Check for lint issues
pnpm run lint

# Check types
pnpm run type-check

# Format code
pnpm run format
```

## 📄 License

MIT License

## 📚 Additional Documentation

- [DOCKER_SETUP.md](./DOCKER_SETUP.md) - Comprehensive Docker development guide
- [AGENTS.md](./AGENTS.md) - AI agent instructions and guidelines
- [docs/CODING_STANDARDS.md](./docs/CODING_STANDARDS.md) - Coding standards and best practices
- [docs/SYSTEM_DESIGN.md](./docs/SYSTEM_DESIGN.md) - System architecture overview

