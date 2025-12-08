# Moodeng Monolith - Next.js TypeScript Application

This is a monolithic Next.js TypeScript application that combines the previously separate backend (Express.js) and frontend (React) repositories into a single, unified codebase.

## 🏗️ Architecture

### Backend API Routes ( `/src/app/api/` )

* **Auth**: `/api/auth/` - User authentication (login, register, logout, update)
* **Users**: `/api/users/` - User profile management
* **Loans**: `/api/loans/` - Loan creation, management, and fetching
* **Webhook**: `/api/webhook` - Telegram bot webhook integration

### Frontend ( `/src/app/` & `/src/components/` )

* **Next.js 15** with App Router
* **TypeScript** for type safety
* **Tailwind CSS** for styling
* **RainbowKit + Wagmi** for Web3 integration
* **Redux Toolkit** for state management

### Database & Services ( `/src/lib/` )

* **PostGresSql** with Prisma ORM
* **Email Service** using Gmail OAuth2
* **Telegram Bot** integration
* **Authentication** with JWT tokens

## 🚀 Getting Started

### Prerequisites

* Node.js 22+
* PostGresSQL
* Gmail account for email services
* Telegram bot token (optional)

### Installation

1. **Clone and install dependencies:**

```bash
cd monolith-app
npm install
```

2. **Environment Setup:**
Copy `env.example` to `.env.local` and fill in your values:

```bash
cp env.example .env.local
```

Required environment variables:
* `DATABASE_URL` - Your PostGresDql connection string
* `JWT_SECRET` - Secret for JWT token signing
* `CLIENT_ID` & `CLIENT_SECRET` - Google OAuth credentials
* `EMAIL_USER` & `REFRESH_TOKEN` - Gmail API credentials
* `TELEGRAM_API_TOKEN` & `TELEGRAM_API_URL` - Telegram bot (optional)
* `NEXT_PUBLIC_WALLET_CONNECT_PROJECT_ID` - WalletConnect project ID

3. **Run the development server:**

```bash
npm run dev
```

## Build and Run Scripts

Our project includes several utility scripts to streamline the build and run processes. These scripts are located in the `scripts/` folder and can be executed using npm commands.

NOTE: using the clean scripts will remove node_modules, npm_cache, package-lock.json, yarn.lock and require a full install of all dependencies.

### Available Scripts

Used for Pipelines, formats, installs, and builds the project.

* `npm run format_build`

or

* `yarn format_build`

Cleans the project, removing build artifacts, node modules, caches and temporary files. Removes node_modules, npm_cache, package-lock.json, yarn.lock. Removes Zone. Identifier files if copying files from windows to WSL.

* `npm run clean`

or

* `yarn clean`

Cleans Everything and then builds the project.

* `npm run clean_build`

or

* `yarn clean_build`

Cleans, builds, and runs the project in development mode.

*`npm run clean_build_run`**HTTP**
*`npm run clean_build_run_local`**HTTPS**

or

* `yarn clean_build_run`

Cleans, builds, and runs the project in production mode.

* `npm run clean_build_run_prd`

or

* `yarn clean_build_run_prd`

Cleans next data, builds, and runs the project in development mode. Does NOT remove node_modules, npm_cache, package-lock.json, yarn.lock.

*  `npm run clean_build_run_next`       **HTTP**
*  `npm run clean_build_run_next_local` **HTTPS**

   or

* `yarn clean_build_run_next`

Cleans, builds, and runs the Next.js project in production mode.

* `npm run clean_build_run_next_prd`

or

* `yarn clean_build_run_next_prd`

Open [http://localhost:3000](http://localhost:3000) in your browser.

## 📁 Project Structure

```
src/
├── app/                    # Next.js App Router
│   ├── api/               # API routes
│   │   ├── auth/         # Authentication endpoints
│   │   │   ├── login/    # Login endpoint
│   │   │   ├── logout/   # Logout endpoint
│   │   │   ├── register/ # Registration endpoint
│   │   │   ├── verify/   # World ID verification
│   │   │   ├── update/   # User update
│   │   │   └── test-unverify/ # Testing endpoint
│   │   ├── users/        # User management
│   │   │   ├── me/       # Current user info
│   │   │   ├── profile/  # User profile
│   │   │   └── update/   # User updates
│   │   ├── loans/        # Loan management
│   │   │   ├── create/   # Create loan
│   │   │   ├── delete/   # Delete loan
│   │   │   ├── edit/     # Edit loan
│   │   │   ├── fetch/    # Fetch loans
│   │   │   ├── get/      # Get specific loan
│   │   │   ├── hash/     # Loan hashing
│   │   │   └── update/   # Update loan
│   │   └── webhook/      # Telegram webhook
│   ├── benefits/         # Benefits page
│   ├── dashboard/        # User dashboard
│   ├── guide/           # User guide
│   ├── login/           # Login page
│   ├── profile/         # User profile page
│   ├── simple/          # Simple page
│   ├── test/            # Test page
│   ├── user/[username]/ # Dynamic user pages
│   ├── ut/              # Utility page
│   ├── whylend/         # Why lend page
│   ├── globals.css      # Global styles
│   ├── layout.tsx       # Root layout
│   └── page.tsx         # Home page
├── components/            # React components
│   ├── board/           # Board-related components
│   │   ├── Board.tsx    # Main board component
│   │   ├── BorrowerDashboard.tsx # Borrower dashboard
│   │   ├── Card.tsx     # Card component
│   │   ├── Dash.tsx     # Dashboard component
│   │   ├── LoanRequestModal.tsx # Loan request modal
│   │   ├── Log.tsx      # Log component
│   │   ├── UserCard.tsx # User card component
│   │   ├── UserNetwork.tsx # User network component
│   │   ├── UserNot.tsx  # User notification component
│   │   └── UserPay.tsx  # User payment component
│   ├── ToastSystem/     # Toast notification system
│   │   ├── config/      # Toast configuration
│   │   ├── contexts/    # Toast contexts
│   │   ├── hooks/       # Toast hooks
│   │   ├── Toast.tsx    # Toast component
│   │   ├── ToastContainer.tsx # Toast container
│   │   ├── ToastDemo.tsx # Toast demo
│   │   ├── ToastInitializer.tsx # Toast initializer
│   │   └── types.ts     # Toast types
│   ├── ui/              # UI components
│   │   ├── ActionButton.tsx # Action button
│   │   └── PartnerLogo.tsx # Partner logo
│   ├── worldId/         # World ID components
│   │   ├── WorldIDVerification.tsx # World ID verification
│   │   └── WorldIDVerificationStatus.tsx # Verification status
│   ├── loading/         # Loading components
│   ├── Footer.tsx       # Footer component
│   ├── Header.tsx       # Header component
│   ├── Loading.tsx      # Loading component
│   └── providers.tsx    # App providers (Redux, Wagmi, etc.)
├── config/               # Configuration files
│   ├── apiEndpoints.ts  # API endpoint configurations
│   ├── buttonConfig.ts  # Button configurations
│   └── wagmiConfig.tsx  # Wagmi/Web3 configuration
├── features/             # Feature modules (currently empty)
│   ├── auth/            # Authentication features
│   ├── loans/           # Loan features
│   └── wagmi/           # Web3 features
├── hooks/                # Custom React hooks
│   └── useWallet.ts     # Wallet hook
├── lib/                  # Core libraries
│   ├── config/          # Library configurations
│   │   └── wagmi.ts     # Wagmi config export
│   ├── models/          # PostGresSQL models
│   │   ├── Loan.ts      # Loan model
│   │   └── User.ts      # User model
│   ├── services/        # External services
│   │   ├── email.ts     # Email service
│   │   └── telegram.ts  # Telegram service
│   ├── utils/           # Utility functions
│   │   ├── auth.ts      # Authentication utilities
│   │   └── cors.ts      # CORS utilities
│   ├── apiHandler.ts    # API handler
│   ├── axios.ts         # Axios configuration
│   ├── database.ts      # Database connection
│   └── startup.ts       # Startup utilities
├── store/               # Redux store
│   ├── slices/         # Redux slices
│   │   ├── authSlice.ts # Authentication slice
│   │   ├── loanSlice.ts # Loan slice
│   │   └── wagmiSlice.ts # Wagmi slice
│   └── store.ts        # Store configuration
├── types/               # TypeScript type definitions
│   ├── actionButtonTypes.ts # Action button types
│   ├── apiTypes.ts      # API types
│   ├── authTypes.ts     # Authentication types
│   ├── loanTypes.ts     # Loan types
│   └── wagmiTypes.ts    # Wagmi types
├── views/               # Page views and sections
│   ├── about/           # About page
│   │   ├── sections/    # About page sections
│   │   └── styles/      # About page styles
│   ├── borrowerBenefits/ # Borrower benefits page
│   │   ├── sections/    # Borrower benefits sections
│   │   └── styles/      # Borrower benefits styles
│   ├── landing/         # Landing page
│   │   ├── config/      # Landing page config
│   │   ├── sections/    # Landing page sections
│   │   ├── styles/      # Landing page styles
│   │   └── types.ts     # Landing page types
│   └── lenderBenefits/  # Lender benefits page
│       ├── config/      # Lender benefits config
│       ├── sections/    # Lender benefits sections
│       └── styles/      # Lender benefits styles
└── middleware.ts        # Next.js middleware
```

## 🔒 Authentication

The app uses JWT tokens stored in HTTP-only cookies for authentication. The middleware automatically protects routes and injects user information into API requests.

## 🌐 Web3 Integration

* **RainbowKit** for wallet connection UI
* **Wagmi** for Web3 hooks and chain interactions
* **Viem** for low-level blockchain interactions
* Support for multiple chains: Ethereum, Polygon, Base, Arbitrum, etc.

## Test World Id App

[moobeng-worldid.up.railway.app](https://moobeng-worldid.up.railway.app/)

 * every new user is marked as not verified
 * click on a 'Verify' button (apply loan modal or profile -> settings) or link (dashboard message)
 * choose qr code!
 * click the QR code to copy the link
 * paste the link into the simulator: https://simulator.worldcoin.org/id/0x0f73f138
 * choose verify by ORB to pass
 * choose any other method to fail
 * go back to the app and check for toasts
 * un verify in profile -> settings (test only)

## 📧 Email & Notifications

* **Gmail OAuth2** for sending emails
* **Telegram Bot** for push notifications
* Automatic notifications for loan events

## 🚀 Deployment

The app is ready for deployment on Vercel, Netlify, or any Node.js hosting platform.

### Environment Variables for Production:

Make sure to set all required environment variables in your hosting platform.

## 🤝 Contributing

1. The original repositories remain intact
2. This monolith can be developed independently
3. Future features should be added to this unified codebase

## 📝 License

MIT License - see the original repositories for details.
