# Moodeng Credit - Peer-to-Peer Lending Platform

## 📋 Project Summary

**Moodeng Credit** is a decentralized peer-to-peer lending platform built as a monolithic Next.js 15 application. The platform connects borrowers with lenders, enabling trustless loan transactions with Web3 wallet integration and World ID verification for enhanced security and identity verification.

## 🎯 Core Purpose

- **Borrowers** can request loans and manage their borrowing activities
- **Lenders** can browse loan requests and fund borrowers
- **Identity Verification** through World ID ensures user authenticity
- **Web3 Integration** enables cryptocurrency wallet connections for secure transactions

## 🛠️ Tech Stack

| Category | Technology |
|----------|------------|
| **Framework** | Next.js 15 (App Router) |
| **Language** | TypeScript |
| **Database** | PostgreSQL with Prisma ORM |
| **Styling** | Tailwind CSS |
| **State Management** | Redux Toolkit |
| **Web3** | RainbowKit, Wagmi, Viem |
| **Authentication** | JWT Tokens, World ID, Google OAuth |
| **Notifications** | Gmail OAuth2, Telegram Bot |

## 🌟 Key Features

- **User Authentication** - Register, login, and secure session management with JWT
- **World ID Verification** - Proof-of-personhood verification via Worldcoin
- **Loan Management** - Create, edit, fund, and track loans
- **Multi-chain Support** - Ethereum, Polygon, Base, Arbitrum, and more
- **Real-time Notifications** - Email and Telegram alerts for loan events
- **Responsive Dashboard** - Comprehensive borrower and lender dashboards
- **Credit Tiers** - Tiered credit system for borrowers

## 📁 Architecture Overview

```
src/
├── app/api/          # Backend API routes (Auth, Users, Loans, Webhooks)
├── app/              # Frontend pages (Dashboard, Profile, Benefits, FAQ)
├── components/       # Reusable UI components
├── lib/              # Core services (Database, Email, Telegram)
├── store/            # Redux state management
├── hooks/            # Custom React hooks
├── types/            # TypeScript definitions
└── views/            # Page-specific views and sections
```

## 🚀 Quick Start

```bash
# Install dependencies
npm install

# Set up environment variables
cp env.example .env.local

# Run development server
npm run dev
```

Visit [http://localhost:3000](http://localhost:3000) to access the application.

## 📄 License

MIT License
