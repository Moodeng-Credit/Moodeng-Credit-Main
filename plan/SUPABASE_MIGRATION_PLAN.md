# Supabase Migration Plan

## 🎯 Migration Goal

Replace the current **Prisma + PostgreSQL + Custom Auth** backend with **Supabase** while keeping **Next.js** as the frontend framework.

---

## 📐 Architecture Overview

### Current Stack
```
Next.js 15 (Frontend + API Routes)
    ↓
Custom JWT Auth + Prisma ORM
    ↓
PostgreSQL Database
```

### Target Stack
```
Next.js 15 (Frontend + Minimal API Routes)
    ↓
Supabase Auth + Supabase Client
    ↓
Supabase PostgreSQL (with Row Level Security)
```

---

## ✅ Why Keep Next.js?

| Reason | Explanation |
|--------|-------------|
| **Already Built** | Frontend is complete, no need to rewrite |
| **API Routes** | Keep 3 custom routes for World ID, Telegram, Email |
| **SSR Support** | Server-side rendering for SEO and performance |
| **Middleware** | Route protection with Supabase sessions |
| **Ecosystem** | Vercel deployment, Image optimization, etc. |

---

## 🗑️ API Routes Analysis

### Routes to REMOVE (Supabase handles these)

| Route | Replacement |
|-------|-------------|
| `src/app/api/auth/login/route.ts` | `supabase.auth.signInWithPassword()` / `signInWithOAuth()` |
| `src/app/api/auth/register/route.ts` | `supabase.auth.signUp()` |
| `src/app/api/auth/logout/route.ts` | `supabase.auth.signOut()` |
| `src/app/api/auth/me/route.ts` | `supabase.auth.getUser()` |
| `src/app/api/users/profile/route.ts` | Direct Supabase query with RLS |
| `src/app/api/loans/create/route.ts` | `supabase.from('loans').insert()` |
| `src/app/api/loans/fetch/route.ts` | `supabase.from('loans').select()` |
| `src/app/api/loans/get/route.ts` | `supabase.from('loans').select().eq()` |
| `src/app/api/loans/update/route.ts` | `supabase.from('loans').update()` |
| `src/app/api/loans/delete/route.ts` | `supabase.from('loans').delete()` |
| `src/app/api/forgot-password/route.ts` | `supabase.auth.resetPasswordForEmail()` |
| `src/app/api/reset-password/route.ts` | `supabase.auth.updateUser()` |

### Routes to KEEP (Custom logic required)

| Route | Reason |
|-------|--------|
| `src/app/api/auth/verify/route.ts` | World ID cloud proof verification |
| `src/app/api/webhook/route.ts` | Telegram bot webhook handling |
| `src/app/api/auth/test-email/route.ts` | Gmail OAuth2 email sending |

---

## 📋 Migration Phases

### Phase 1: Database Migration (Prisma → Supabase)

#### Files to Remove
```
prisma/
├── schema.prisma          # DELETE - Replace with Supabase schema
├── migrations/            # DELETE - Supabase handles migrations
├── config.ts              # DELETE
prisma.config.ts           # DELETE
```

#### Files to Modify

| File | Changes Required |
|------|------------------|
| `src/lib/database.ts` | Replace Prisma client with Supabase client |
| `src/lib/startup.ts` | Remove Prisma initialization |
| `package.json` | Remove `prisma`, `@prisma/client`, `@prisma/adapter-pg` |

#### New Files to Create
```
src/lib/supabase/
├── client.ts              # Supabase browser client
├── server.ts              # Supabase server client (for API routes)
└── admin.ts               # Supabase admin client (service role)
```

#### Database Client Replacement

**REMOVE** - `src/lib/database.ts`:
```typescript
// Old Prisma code
import { PrismaClient } from '@prisma/client';
export const prisma = new PrismaClient();
```

**CREATE** - `src/lib/supabase/client.ts`:
```typescript
import { createBrowserClient } from '@supabase/ssr';

export const supabase = createBrowserClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);
```

**CREATE** - `src/lib/supabase/server.ts`:
```typescript
import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';

export async function createSupabaseServerClient() {
  const cookieStore = await cookies();
  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() { return cookieStore.getAll(); },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value, options }) =>
            cookieStore.set(name, value, options)
          );
        },
      },
    }
  );
}
```

---

### Phase 2: Authentication Migration

#### Current Auth System (Files to Modify)

| File | Current | Migration Action |
|------|---------|------------------|
| `src/app/api/auth/login/route.ts` | Custom JWT | Use Supabase Auth |
| `src/app/api/auth/register/route.ts` | Custom registration | Use Supabase Auth |
| `src/app/api/auth/logout/route.ts` | Custom logout | Use Supabase `signOut()` |
| `src/lib/utils/auth.ts` | JWT verification | Replace with Supabase session |
| `src/middleware.ts` | Custom JWT middleware | Use Supabase middleware |

#### Auth Provider Changes

**Google OAuth** - ✅ Supported natively by Supabase
```typescript
// New Google login
const { data, error } = await supabase.auth.signInWithOAuth({
  provider: 'google',
  options: { redirectTo: `${window.location.origin}/auth/callback` }
});
```

**Wallet Auth (RainbowKit/Wagmi)** - ⚠️ Custom implementation required
```typescript
// Keep existing wallet connection, link to Supabase user
// After wallet signs message, create/link Supabase user
const { data, error } = await supabase.auth.signInWithPassword({
  email: `${walletAddress}@wallet.local`,
  password: signedMessage
});
```

---

### Phase 3: API Routes Migration

#### Routes to DELETE (Replace with client-side Supabase calls)

These routes become unnecessary because Supabase handles them directly from the frontend:

```
src/app/api/auth/login/          # DELETE
src/app/api/auth/register/       # DELETE
src/app/api/auth/logout/         # DELETE
src/app/api/auth/me/             # DELETE
src/app/api/auth/update/         # DELETE
src/app/api/users/profile/       # DELETE
src/app/api/users/update/        # DELETE
src/app/api/loans/create/        # DELETE
src/app/api/loans/fetch/         # DELETE
src/app/api/loans/get/           # DELETE
src/app/api/loans/update/        # DELETE
src/app/api/loans/delete/        # DELETE
src/app/api/loans/hash/          # DELETE
src/app/api/forgot-password/     # DELETE
src/app/api/reset-password/      # DELETE
```

#### Routes to KEEP (Update to use Supabase for DB calls)

```
src/app/api/auth/verify/         # KEEP - World ID verification
src/app/api/webhook/             # KEEP - Telegram webhook
src/app/api/auth/test-email/     # KEEP - Email sending
src/app/api/auth/test-unverify/  # KEEP - Testing only
```

#### Frontend Changes (Replace API calls with Supabase)

**Before (API call):**
```typescript
// src/store/slices/authSlice.ts
const response = await apiHandler.post('/api/auth/login', { email, password });
```

**After (Supabase direct):**
```typescript
// src/store/slices/authSlice.ts
const { data, error } = await supabase.auth.signInWithPassword({ email, password });
```

**Before (Loan fetch):**
```typescript
// src/store/slices/loanSlice.ts
const response = await apiHandler.get('/api/loans/fetch');
```

**After (Supabase direct):**
```typescript
// src/store/slices/loanSlice.ts
const { data, error } = await supabase
  .from('loans')
  .select('*')
  .order('created_at', { ascending: false });
```

---

### Phase 4: Environment Variables

#### Remove
```env
DATABASE_URL=postgresql://...
```

#### Add
```env
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJ...
SUPABASE_SERVICE_ROLE_KEY=eyJ...  # Server-side only, never expose
```

---

### Phase 5: Database Schema Recreation

Create these tables in Supabase Dashboard or via SQL:

```sql
-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- World ID Status enum
CREATE TYPE world_id_status AS ENUM ('INACTIVE', 'ACTIVE');

-- Loan Status enum
CREATE TYPE loan_status AS ENUM ('Requested', 'Lent');

-- Repayment Status enum
CREATE TYPE repayment_status AS ENUM ('Unpaid', 'Partial', 'Paid');

-- Users table (linked to Supabase Auth)
CREATE TABLE users (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  wallet_address TEXT UNIQUE,
  username TEXT UNIQUE NOT NULL,
  email TEXT UNIQUE NOT NULL,
  google_id TEXT UNIQUE,
  telegram_id BIGINT UNIQUE,
  telegram_username TEXT UNIQUE,
  chat_id BIGINT UNIQUE,
  is_world_id world_id_status DEFAULT 'INACTIVE',
  nullifier_hash TEXT UNIQUE,
  mal INTEGER DEFAULT 3,           -- max active loans
  nal INTEGER DEFAULT 0,           -- number active loans
  cs INTEGER DEFAULT 15,           -- credit score
  reset_token TEXT UNIQUE,
  reset_token_expiry TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Loans table
CREATE TABLE loans (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  tracking_id TEXT UNIQUE NOT NULL,
  borrower_wallet TEXT,
  lender_wallet TEXT,
  borrower_user TEXT REFERENCES users(username),
  lender_user TEXT REFERENCES users(username),
  loan_amount DECIMAL(18, 6) NOT NULL,
  repaid_amount DECIMAL(18, 6) DEFAULT 0,
  total_repayment_amount DECIMAL(18, 6) NOT NULL,
  reason TEXT NOT NULL,
  loan_status loan_status DEFAULT 'Requested',
  repayment_status repayment_status DEFAULT 'Unpaid',
  days INTEGER NOT NULL,
  block TEXT NOT NULL,
  coin TEXT NOT NULL,
  hash TEXT[] DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes for performance
CREATE INDEX idx_loans_borrower_user ON loans(borrower_user);
CREATE INDEX idx_loans_lender_user ON loans(lender_user);
CREATE INDEX idx_loans_status ON loans(loan_status);
CREATE INDEX idx_loans_repayment ON loans(repayment_status);
CREATE INDEX idx_loans_created ON loans(created_at);

-- Enable Row Level Security
ALTER TABLE users ENABLE ROW LEVEL SECURITY;
ALTER TABLE loans ENABLE ROW LEVEL SECURITY;

-- RLS Policies for Users
CREATE POLICY "Users can read own data" ON users
  FOR SELECT USING (auth.uid() = id);

CREATE POLICY "Users can update own data" ON users
  FOR UPDATE USING (auth.uid() = id);

CREATE POLICY "Public profiles are viewable" ON users
  FOR SELECT USING (true);

-- RLS Policies for Loans
CREATE POLICY "Anyone can read loans" ON loans
  FOR SELECT TO authenticated USING (true);

CREATE POLICY "Authenticated users can create loans" ON loans
  FOR INSERT TO authenticated 
  WITH CHECK (borrower_user = (SELECT username FROM users WHERE id = auth.uid()));

CREATE POLICY "Borrowers can update their loans" ON loans
  FOR UPDATE TO authenticated
  USING (borrower_user = (SELECT username FROM users WHERE id = auth.uid()));

CREATE POLICY "Lenders can update loans they fund" ON loans
  FOR UPDATE TO authenticated
  USING (lender_user = (SELECT username FROM users WHERE id = auth.uid()) 
         OR lender_user IS NULL);

CREATE POLICY "Borrowers can delete their pending loans" ON loans
  FOR DELETE TO authenticated
  USING (borrower_user = (SELECT username FROM users WHERE id = auth.uid()) 
         AND loan_status = 'Requested');

-- Function to auto-update updated_at
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ language 'plpgsql';

-- Triggers for updated_at
CREATE TRIGGER update_users_updated_at BEFORE UPDATE ON users
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_loans_updated_at BEFORE UPDATE ON loans
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
```

---

## ❌ What Won't Work / Requires Custom Implementation

### 1. Telegram Authentication
**Status:** ❌ NOT SUPPORTED BY SUPABASE

**Current Implementation:** `src/lib/utils/oauth.ts`

**Workaround Required:**
```typescript
// Keep custom Telegram verification
// After verifying, create Supabase user manually
async function handleTelegramAuth(telegramData: TelegramAuthData) {
  // 1. Verify Telegram hash (keep existing logic)
  const isValid = verifyTelegramAuth(telegramData);
  
  // 2. Create/get Supabase user with service role
  const supabaseAdmin = createClient(url, SERVICE_ROLE_KEY);
  
  const { data: user } = await supabaseAdmin.auth.admin.createUser({
    email: `${telegramData.id}@telegram.moodeng.local`,
    email_confirm: true,
    user_metadata: {
      telegram_id: telegramData.id,
      telegram_username: telegramData.username
    }
  });
  
  // 3. Generate session manually
  const { data: session } = await supabaseAdmin.auth.admin.generateLink({
    type: 'magiclink',
    email: user.email
  });
}
```

### 2. World ID Verification
**Status:** ⚠️ PARTIAL - Custom logic required

**Current:** `src/app/api/auth/verify/route.ts`

**Migration:** Keep World ID verification logic, update database calls to Supabase

```typescript
// World ID verification stays the same
const verifyRes = await verifyCloudProof(proof, app_id, action);

// Update user in Supabase instead of Prisma
const { error } = await supabase
  .from('users')
  .update({ 
    is_world_id_verified: true,
    world_id_hash: verifyRes.nullifier_hash 
  })
  .eq('id', userId);
```

### 3. Web3 Wallet Authentication
**Status:** ⚠️ CUSTOM IMPLEMENTATION NEEDED

Supabase doesn't support SIWE (Sign-In with Ethereum) natively.

**Workaround:**
```typescript
// 1. User signs message with wallet
// 2. Verify signature server-side
// 3. Create Supabase user linked to wallet address

async function walletAuth(address: string, signature: string, message: string) {
  // Verify signature
  const isValid = await verifyMessage({ address, message, signature });
  
  if (!isValid) throw new Error('Invalid signature');
  
  // Upsert user in Supabase
  const { data, error } = await supabaseAdmin.auth.admin.createUser({
    email: `${address.toLowerCase()}@wallet.moodeng.local`,
    email_confirm: true,
    user_metadata: { wallet_address: address }
  });
}
```

### 4. Custom JWT Tokens
**Status:** ❌ REPLACED

Current custom JWT in `src/lib/utils/auth.ts` will be replaced by Supabase session tokens.

**Impact:** 
- Remove `JWT_SECRET` from env
- Update all `verifyToken()` calls to use Supabase `getUser()`

### 5. Prisma Relations/Joins
**Status:** ⚠️ SYNTAX CHANGE

**Before (Prisma):**
```typescript
const loan = await prisma.loan.findUnique({
  where: { id },
  include: { borrower: true, lender: true }
});
```

**After (Supabase):**
```typescript
const { data: loan } = await supabase
  .from('loans')
  .select(`
    *,
    borrower:users!borrower_id(*),
    lender:users!lender_id(*)
  `)
  .eq('id', id)
  .single();
```

---

## 📦 Package Changes

### Remove
```json
{
  "dependencies": {
    "@prisma/client": "REMOVE",
    "@prisma/adapter-pg": "REMOVE",
    "pg": "REMOVE",
    "jsonwebtoken": "REMOVE (optional, if using Supabase auth fully)"
  },
  "devDependencies": {
    "prisma": "REMOVE"
  }
}
```

### Add
```json
{
  "dependencies": {
    "@supabase/supabase-js": "^2.x",
    "@supabase/ssr": "^0.x"
  }
}
```

---

## 📝 Migration Checklist

### Phase 1: Setup
- [ ] Create Supabase project at [supabase.com](https://supabase.com)
- [ ] Copy Supabase URL and anon key to `.env.local`
- [ ] Copy service role key (server-side only)
- [ ] Run SQL schema in Supabase SQL Editor

### Phase 2: Install Dependencies
- [ ] `npm install @supabase/supabase-js @supabase/ssr`
- [ ] `npm uninstall prisma @prisma/client @prisma/adapter-pg pg`
- [ ] Remove `jsonwebtoken` if fully using Supabase auth

### Phase 3: Create Supabase Clients
- [ ] Create `src/lib/supabase/client.ts` (browser)
- [ ] Create `src/lib/supabase/server.ts` (server components)
- [ ] Create `src/lib/supabase/admin.ts` (service role)

### Phase 4: Auth Migration
- [ ] Enable Google OAuth in Supabase Dashboard
- [ ] Create `/auth/callback` route for OAuth redirect
- [ ] Update `GoogleAuthButton.tsx` to use Supabase
- [ ] Implement Telegram auth workaround
- [ ] Update middleware to use Supabase sessions

### Phase 5: Delete Unnecessary API Routes
- [ ] Delete `src/app/api/auth/login/`
- [ ] Delete `src/app/api/auth/register/`
- [ ] Delete `src/app/api/auth/logout/`
- [ ] Delete `src/app/api/auth/me/`
- [ ] Delete `src/app/api/auth/update/`
- [ ] Delete `src/app/api/users/profile/`
- [ ] Delete `src/app/api/users/update/`
- [ ] Delete `src/app/api/loans/create/`
- [ ] Delete `src/app/api/loans/fetch/`
- [ ] Delete `src/app/api/loans/get/`
- [ ] Delete `src/app/api/loans/update/`
- [ ] Delete `src/app/api/loans/delete/`
- [ ] Delete `src/app/api/loans/hash/`

### Phase 6: Update Kept API Routes
- [ ] Update `src/app/api/auth/verify/route.ts` (World ID) to use Supabase
- [ ] Update `src/app/api/webhook/route.ts` (Telegram) to use Supabase
- [ ] Keep email routes as-is (Gmail OAuth2)

### Phase 7: Update Redux Slices
- [ ] Rewrite `src/store/slices/authSlice.ts` to use Supabase Auth
- [ ] Rewrite `src/store/slices/loanSlice.ts` to use Supabase queries

### Phase 8: Cleanup
- [ ] Delete `prisma/` directory
- [ ] Delete `prisma.config.ts`
- [ ] Delete `src/lib/database.ts`
- [ ] Delete `src/generated/prisma/`
- [ ] Remove `DATABASE_URL` from `.env`
- [ ] Update `package.json` scripts (remove prisma commands)

### Phase 9: Testing
- [ ] Test Google OAuth login
- [ ] Test Telegram login
- [ ] Test World ID verification
- [ ] Test loan create/read/update/delete
- [ ] Test user profile updates
- [ ] Test email notifications
- [ ] Test wallet linking

---

## ⏱️ Estimated Effort

| Task | Time Estimate |
|------|---------------|
| Supabase setup & schema | 2-3 hours |
| Create Supabase clients | 1-2 hours |
| Auth migration (Google) | 2-3 hours |
| Custom Telegram auth | 4-6 hours |
| Delete & update API routes | 2-3 hours |
| Update Redux slices | 3-4 hours |
| Update kept routes (World ID, Webhook) | 2-3 hours |
| Testing & debugging | 4-6 hours |
| **Total** | **20-30 hours** |

---

## 🚨 Risks & Considerations

1. **Telegram Auth Complexity** - No native support means maintaining custom verification code
2. **Wallet Auth Complexity** - SIWE not supported, requires custom implementation
3. **Data Migration** - Existing users/loans need to be migrated to new Supabase tables
4. **Session Management** - Different from current JWT approach, may affect existing logged-in users
5. **RLS Policies** - Need careful configuration to match current authorization logic
6. **Supabase Limits** - Free tier has limits on database size, API calls, and auth users

---

## 🔄 Data Migration Script

If you have existing data, run this after schema creation:

```sql
-- Migrate existing users (example)
-- You'll need to export from old PostgreSQL and import

-- Create auth users first via Supabase Admin API
-- Then insert into public.users table

-- Migrate loans
INSERT INTO loans (
  tracking_id, borrower_user, lender_user, loan_amount, 
  total_repayment_amount, reason, loan_status, repayment_status,
  days, block, coin, created_at
)
SELECT 
  tracking_id, borrower_user, lender_user, loan_amount,
  total_repayment_amount, reason, loan_status::loan_status, 
  repayment_status::repayment_status, days, block, coin, created_at
FROM old_database.loans;
```

---

## 📚 Helpful Resources

- [Supabase + Next.js Guide](https://supabase.com/docs/guides/getting-started/quickstarts/nextjs)
- [Supabase Auth Helpers](https://supabase.com/docs/guides/auth/server-side/nextjs)
- [Row Level Security](https://supabase.com/docs/guides/auth/row-level-security)
- [Supabase JavaScript Client](https://supabase.com/docs/reference/javascript/introduction)