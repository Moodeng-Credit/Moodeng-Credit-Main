# Moodeng Credit - Platform Features

## 🎯 Core Platform Features

### User Management
- **User Registration** - Create accounts with email, username, and password
- **User Authentication** - Secure login with JWT tokens stored in HTTP-only cookies
- **Google OAuth** - Sign in with Google account
- **Telegram Authentication** - Sign in via Telegram bot
- **Profile Management** - Update username, email, wallet address, and Telegram username
- **Password Reset** - Forgot password flow with email reset tokens

### Identity Verification
- **World ID Integration** - Proof-of-personhood verification via Worldcoin
- **Recurring Verification** - Ensures the borrower is always the real account owner
- **Anti-Fraud Protection** - Protection against VPN users, scammers, and malicious actors

### Web3 Wallet Integration
- **RainbowKit** - Wallet connection UI for seamless Web3 onboarding
- **Wagmi Hooks** - Web3 state management and chain interactions
- **Multi-Chain Support** - Ethereum, Polygon, Base, Arbitrum, and more
- **Wallet Linking** - Connect wallet address to user profile

---

## 💰 Loan Management Features

### For Borrowers
- **Apply for Loans** - Submit loan requests with amount, repayment terms, and reason
- **Credit Tiers** - Progressive credit limit system (increments of $20)
  - Starting limit: $20
  - Unlocks higher tiers by successfully repaying loans
- **Track Loan Status** - Monitor pending, active, and completed loans
- **Repayment Tracking** - View repayment progress and remaining balance
- **Global Credit History** - Blockchain-based credit score accessible worldwide

### For Lenders
- **Browse Loan Requests** - View all pending loan requests from borrowers
- **Fund Loans** - Provide capital to borrowers
- **Anonymous Lending** - Wallet-based transactions protect lender identity
- **No Fees** - Zero commissions or monthly fees for lenders
- **Borrower Transparency** - View complete loan history of borrowers before funding
- **Transaction Hash Tracking** - Record blockchain transaction hashes for loans

### Loan Properties
| Field | Description |
|-------|-------------|
| `loanAmount` | Principal loan amount |
| `totalRepaymentAmount` | Amount including interest |
| `days` | Loan duration in days |
| `reason` | Purpose of the loan |
| `block` | Blockchain network (Ethereum, Polygon, etc.) |
| `coin` | Currency (USDC, etc.) |
| `loanStatus` | Requested, Lent |
| `repaymentStatus` | Unpaid, Partial, Paid |

---

## 📊 Dashboard Features

### Borrower Dashboard
- **Active Loans** - View current outstanding loans
- **Pending Requests** - Track loan requests awaiting lenders
- **Repayment History** - See all completed loan repayments
- **Defaulted Loans** - View overdue loans
- **Credit Level Progress** - Track progress to next credit tier

### Lender Dashboard
- **Funded Loans** - View loans you've provided
- **Pending Payments** - Track loans awaiting repayment
- **Repayment Stats** - See repayment rates and history
- **Lender Diversity Score** - Track unique borrowers funded

### Dashboard Tools
- **Search & Filter** - Find loans by amount, rate, date, network
- **Sort Options** - Order by date, amount, or status
- **Pagination** - Load more results efficiently
- **Role Switcher** - Toggle between Borrower and Lender views

---

## 🔔 Notifications

### Email Notifications (Gmail OAuth2)
- **Loan Request Alerts** - Notify when loan is requested
- **Funding Confirmations** - Notify when loan is funded
- **Repayment Reminders** - Alert for upcoming/overdue payments
- **Test Email** - Verify email configuration

### Telegram Bot Notifications
- **Real-time Alerts** - Push notifications via Telegram
- **Loan Event Updates** - Instant updates on loan status changes
- **Webhook Integration** - Automated message delivery

---

## 🔐 Security Features

- **JWT Authentication** - Secure token-based sessions
- **HTTP-Only Cookies** - Protected token storage
- **Route Protection** - Middleware guards protected pages
- **World ID Verification** - Sybil-resistant identity verification
- **CORS Handling** - Secure cross-origin request handling
- **Input Validation** - Zod schema validation on all API endpoints
- **Data Privacy** - No cookies, no data selling, no spam

---

## 📱 User Interface Features

### Pages
- **Landing Page** - Platform introduction and benefits
- **Dashboard** - Main loan browsing and management
- **Profile** - User settings and account management
- **Benefits Pages** - Separate pages for borrower and lender benefits
- **FAQ** - Frequently asked questions
- **User Profile** - Public profile view for any user

### UI Components
- **Toast Notifications** - Real-time feedback system
- **Loading States** - Skeleton loaders and spinners
- **Responsive Design** - Mobile-friendly layouts
- **Modal Dialogs** - Loan request and confirmation modals
- **Filter Sidebar** - Advanced loan filtering
- **YouTube Lightbox** - Tutorial video integration

---

## 🌍 Platform Values (Borrower Benefits)

| Feature | Description |
|---------|-------------|
| **Empower You** | Build global credit score on blockchain |
| **Data Security** | Privacy-first blockchain app |
| **Borderless Credit** | Financial reputation not tied to any country |
| **No Loan Sharks** | Fair lending alternative |
| **Fast Global Access** | Own credit, Global use, Full control |

---

## 🏆 Platform Values (Lender Benefits)

| Feature | Description |
|---------|-------------|
| **Anonymous Lending** | Wallet-based lending protects identity |
| **No Fees for Lenders** | No commissions or monthly fees |
| **Advanced Security** | Protection against scammers |
| **100% Transparent History** | See all borrower past/current loans |
| **Recurring Verification** | Constant proof borrower is real |
| **Data Protected** | Web3 ensures privacy |

---

## 🔗 API Endpoints

### Authentication
- `POST /api/auth/register` - User registration
- `POST /api/auth/login` - User login (Email, Google, Telegram)
- `POST /api/auth/logout` - User logout
- `POST /api/auth/verify` - World ID verification
- `POST /api/auth/update` - Update user credentials

### Users
- `GET /api/auth/me` - Get current user
- `POST /api/auth/profile` - Get user profile
- `POST /api/users/update` - Update user data

### Loans
- `POST /api/loans/create` - Create loan request
- `POST /api/loans/fetch` - Fetch all loans
- `POST /api/loans/get` - Get user's loans
- `POST /api/loans/update` - Update loan (fund, repay)
- `POST /api/loans/delete` - Delete loan
- `POST /api/loans/hash` - Add transaction hash

### Webhooks
- `POST /api/webhook` - Telegram bot webhook

---

## 📐 Database Schema

### User Model
```
- id (cuid)
- walletAddress (unique)
- username (unique)
- email (unique)
- password
- googleId
- telegramId / telegramUsername / chatId
- isWorldId (ACTIVE/INACTIVE)
- nullifierHash (World ID)
- mal (max active loans - default 3)
- nal (number active loans - default 0)
- cs (credit score - default 15)
- resetToken / resetTokenExpiry
- createdAt / updatedAt
```

### Loan Model
```
- id (cuid)
- trackingId (unique)
- borrowerWallet / lenderWallet
- borrowerUser / lenderUser
- loanAmount / repaidAmount / totalRepaymentAmount
- reason
- loanStatus (Requested/Lent)
- repaymentStatus (Unpaid/Partial/Paid)
- days
- block / coin
- hash[] (transaction hashes)
- createdAt / updatedAt
```
