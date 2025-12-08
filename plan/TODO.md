# Moodeng Credit - Critical TODO Items

> **Note**: This list contains only critical issues and major missing features that directly impact core functionality. Lower priority items (testing, documentation, analytics, UI polish) have been excluded for focus.

---

## 🔴 Critical Issues (Must Fix Immediately)

### 1. Transaction Confirmation Handling
**Status**: ❌ Broken  
**Location**: `src/hooks/useWallet.ts`  
**Issue**: USDC transfers execute but don't wait for blockchain confirmation before updating database.

**Current Problem**:
```typescript
const hash = await writeContractAsync({...});
// No confirmation wait - loan status may not update
return hash;
```

**Fix Needed**:
- [ ] Import `waitForTransactionReceipt` from `wagmi/actions`
- [ ] Wait for transaction confirmation before returning
- [ ] Handle failed transactions gracefully
- [ ] Update database only after confirmed success

**Estimated Effort**: 2-3 hours

---

### 2. Automatic Loan Status Updates
**Status**: ❌ Missing  
**Location**: `src/components/UserPay.tsx`, `src/components/UserNetwork.tsx`  
**Issue**: Loan status doesn't update automatically after successful on-chain transfers. Users must manually submit transaction hashes.

**Fix Needed**:
- [ ] Add automatic status update after transaction confirmation
- [ ] Remove manual hash submission requirement
- [ ] Implement proper error recovery if DB update fails

**Estimated Effort**: 3-4 hours

---

### 3. Chain Switching Error Handling
**Status**: ⚠️ Incomplete  
**Location**: `src/hooks/useWallet.ts:49`  
**Issue**: `switchChain` is called synchronously without waiting or error handling.

```typescript
switchChain({ chainId: targetChainId }); // No await!
// Immediately tries transfer - may fail if switch pending
```

**Fix Needed**:
- [ ] Use `switchChainAsync` instead
- [ ] Add try-catch for chain switch failures
- [ ] Add delay/wait for chain switch confirmation
- [ ] Display user-friendly error messages

**Estimated Effort**: 1-2 hours

---

## 🟡 Major Features Missing

### 4. On-Chain Event Monitoring
**Status**: ❌ Not Implemented  
**Issue**: No webhook or polling to automatically detect USDC transfers and update loan status.

**What's Needed**:
- [ ] Set up event listeners for ERC20 Transfer events
- [ ] Create backend job to poll for transfers
- [ ] Match transaction hashes to loan records
- [ ] Auto-update loan status when transfers detected
- [ ] Consider using services like Alchemy Notify or Moralis Streams

**Estimated Effort**: 8-12 hours

---

### 5. Balance Validation
**Status**: ❌ Not Implemented  
**Location**: Before `Transfer` calls  
**Issue**: No check if user has sufficient USDC balance before attempting transfer.

**Fix Needed**:
- [ ] Add `balanceOf` check using ERC20 ABI
- [ ] Display balance to user before transfer
- [ ] Prevent transfer if insufficient balance
- [ ] Show clear error message

**Estimated Effort**: 2-3 hours

---

### 6. Gas Estimation
**Status**: ❌ Not Implemented  
**Issue**: No gas estimation before transactions, leading to potential failures.

**Fix Needed**:
- [ ] Use `estimateGas` before transactions
- [ ] Display estimated gas cost to user
- [ ] Allow user to adjust gas price
- [ ] Handle insufficient gas errors

**Estimated Effort**: 3-4 hours

---

### 7. Transaction Retry Logic
**Status**: ❌ Not Implemented  
**Issue**: Failed transactions due to network issues aren't retried automatically.

**Fix Needed**:
- [ ] Implement exponential backoff retry
- [ ] Store pending transactions in database
- [ ] Add transaction queue system
- [ ] Allow manual retry from UI

**Estimated Effort**: 6-8 hours

---

### 8. Email Notifications Reliability
**Status**: ⚠️ Incomplete  
**Location**: `src/lib/services/email.ts`  
**Issue**: Email sending has timeouts and connection issues. Development-only test email feature.

**Current Issues**:
- Gmail OAuth2 token refresh sometimes fails
- Connection timeouts (30s configured)
- Test email feature only works in development mode

**Fix Needed**:
- [ ] Implement email queue system (Redis + Bull)
- [ ] Add retry logic for failed emails
- [ ] Better token refresh handling
- [ ] Production-ready email service (SendGrid, AWS SES)
- [ ] Email templates for different notifications

**Estimated Effort**: 8-10 hours

---

### 9. Telegram Bot Webhook Reliability
**Status**: ⚠️ Incomplete  
**Location**: `src/app/api/webhook/route.ts`, `src/lib/services/telegram.ts`  
**Issue**: Telegram notifications may fail without retry.

**Fix Needed**:
- [ ] Add message queue for Telegram notifications
- [ ] Implement retry logic
- [ ] Handle bot token expiry
- [ ] Better error logging
- [ ] Fallback notification methods

**Estimated Effort**: 4-6 hours

---

## 🟢 Authentication & Security Gaps

### 10. World ID Verification Edge Cases
**Status**: ⚠️ Incomplete  
**Location**: `src/app/api/auth/verify/route.ts`  
**Issue**: World ID verification works but lacks edge case handling.

**Missing**:
- [ ] Handle duplicate nullifier hashes
- [ ] Add verification level enforcement (Orb vs Device)
- [ ] Implement 90-day re-verification reminders
- [ ] Track verification history
- [ ] Add grace period for expired verifications

**Estimated Effort**: 4-5 hours

---

### 11. Telegram Authentication Custom Implementation
**Status**: ⚠️ Functional but hacky  
**Location**: `src/lib/utils/oauth.ts`, `src/app/api/auth/login/route.ts`  
**Issue**: Telegram auth works but uses workaround since Supabase doesn't support it natively.

**When Migrating to Supabase**:
- [ ] Implement Supabase Admin API user creation
- [ ] Link Telegram ID to Supabase auth users
- [ ] Handle session generation manually
- [ ] Add proper error handling

**Estimated Effort**: 6-8 hours (during Supabase migration)

---

### 12. Wallet Authentication (SIWE)
**Status**: ❌ Not Implemented  
**Issue**: Users can connect wallets but can't use them for authentication (Sign-In with Ethereum).

**What's Needed**:
- [ ] Implement SIWE message signing
- [ ] Verify signatures server-side
- [ ] Create/link user accounts to wallet addresses
- [ ] Handle wallet disconnection/reconnection
- [ ] Add nonce generation and validation

**Estimated Effort**: 8-10 hours

---

## 🟣 Database & Backend

### 18. Database Migrations to Supabase
**Status**: 📋 Planned (see MIGRATION_PLAN.md)  
**Issue**: Currently using Prisma + PostgreSQL, planned migration to Supabase.

**Checklist**:
- [ ] Complete items in MIGRATION_PLAN.md
- [ ] Migrate existing user data
- [ ] Migrate existing loan data
- [ ] Update all 15+ API routes
- [ ] Test auth flows
- [ ] Update Redux slices

**Estimated Effort**: 20-30 hours

---

### 19. API Rate Limiting
**Status**: ❌ Not Implemented  
**Issue**: No rate limiting on API endpoints, vulnerable to abuse.

**What's Needed**:
- [ ] Implement rate limiting middleware
- [ ] Add per-user request limits
- [ ] Add IP-based limits
- [ ] Return proper 429 status codes

**Estimated Effort**: 4-6 hours

---

## 📝 Summary

**Total Items**: 12 critical and major features  
**Total Estimated Effort**: ~80-110 hours (approximately 2-3 weeks for one developer)

### Recommended Priority Order

**Week 1**: Fix transaction issues that break lending
1. Transaction Confirmation Handling (#1)
2. Automatic Loan Status Updates (#2)
3. Chain Switching Error Handling (#3)
4. Balance Validation (#5)

**Week 2**: Improve reliability and user experience
5. Gas Estimation (#6)
6. Email Notifications Reliability (#8)
7. Telegram Bot Webhook Reliability (#9)

**Week 3**: Add missing security features
8. World ID Verification Edge Cases (#10)
9. Wallet Authentication (SIWE) (#12)
10. API Rate Limiting (#19)

**Later**: As platform grows
11. On-Chain Event Monitoring (#4)
12. Transaction Retry Logic (#7)
13. Database Migrations to Supabase (#18)
14. Telegram Auth for Supabase (#11)
