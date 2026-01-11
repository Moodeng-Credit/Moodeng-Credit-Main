# Moodeng Credit - Peer-to-Peer Lending Platform

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

## 🚀 Local Development

### Prerequisites

- **Node.js**: >= 24.0.0
- **pnpm**: >= 10.0.0
- **dotenvx**: `npm install -g @dotenvx/dotenvx` (optional, or use via `pnpm`)

### Installation

1. **Clone and Install**
   ```bash
   git clone <repo-url>
   cd Moodeng-Credit-Main
   pnpm install
   ```
   *Note: `pnpm install` will automatically install Playwright browsers.*

2. **Environment Variables**
   - This project uses **dotenvx** for environment variable management.
   - You **must** obtain the `.env.keys` file from an existing developer to decrypt the secrets.
   - Without `.env.keys`, the app will not have access to the necessary API keys.

### Running the App

- **Standard Development**:
  ```bash
  pnpm run dev
  ```
- **Local Development (with local environment and HTTPS)**:
  ```bash
  pnpm run dev:local
  ```

Visit [http://localhost:3000](http://localhost:3000) (or `https://localhost:3000` for local dev) to access the application.

## ✅ Quality Control

### Running Tests

```bash
# Unit tests (Vitest + MSW)
pnpm test

# Coverage report
pnpm test:coverage

# End-to-end tests (Playwright)
pnpm test:e2e
```

### Linting and Formatting

```bash
# Check for lint issues
pnpm run lint

# Check types
pnpm run type-check

# Format code
pnpm run format
```

## 📄 License

MIT License

