# Openfort embedded wallet (PH escape hatch)

An additive, self-custodial embedded-wallet rail for borrowers whose ISP blocks
`keys.coinbase.com` (PLDT/Smart in the Philippines), which dead-ends Base Account.
A borrower creates a wallet from their existing Moodeng login — no app, no seed phrase —
and it sends USDC **gaslessly** (Openfort's paymaster) on `api.openfort.io`, which is not
subject to the block.

It never touches the wagmi / RainbowKit / Base-Account stack. When the env vars below are
unset, `isOpenfortConfigured()` is false and nothing about the app changes.

## What was built

| Piece | File |
| --- | --- |
| Config + enablement gate | `config.ts` |
| SDK singleton (Supabase third-party auth) | `client.ts` |
| Shield encryption-session client | `shieldSession.ts` |
| Embedded-wallet ops (provision, send, export) | `embeddedWallet.ts` |
| React context + `useOpenfort()` | `OpenfortContext.tsx` |
| Shield session backend | `supabase/functions/openfort-shield-session/` |
| Connect UX (instant-first when blocked) | `src/views/onboarding/ConnectWallet.tsx` |
| Sponsored send rail (`method: 'openfort'`) | `src/hooks/useWallet.ts` + repay/withdraw sites |
| Wallet-lock (openfort address as borrower lock) | `src/lib/walletProvider.ts`, `OpenfortContext` |
| Key export UI | `src/views/account/ExportInstantWalletKey.tsx` |

## Required configuration

### Frontend env (`.env.staging` / `.env.production`) — publishable, client-safe

| Var | Value |
| --- | --- |
| `VITE_OPENFORT_PUBLISHABLE_KEY` | `pk_test_…` / `pk_live_…` (Openfort dashboard → API keys) |
| `VITE_OPENFORT_SHIELD_PUBLISHABLE_KEY` | Shield publishable key (dashboard → Shield) |
| `VITE_OPENFORT_POLICY_ID` | `ply_…` gas policy id (see below) — **required**, or the rail stays disabled |
| `VITE_OPENFORT_CHAIN_ID` | optional; defaults to the app's allowed chain (Base `8453`) |
| `VITE_OPENFORT_SHIELD_SESSION_URL` | optional; defaults to `${VITE_SUPABASE_URL}/functions/v1/openfort-shield-session` |

### Edge-function secrets — server-only, never in the client bundle

```bash
supabase secrets set \
  OPENFORT_SHIELD_PUBLISHABLE_KEY=... \
  OPENFORT_SHIELD_SECRET_KEY=... \
  OPENFORT_SHIELD_ENCRYPTION_SHARE=...
supabase functions deploy openfort-shield-session
```

## Openfort dashboard setup (one-time)

1. **Third-party auth** → add **Supabase** as the provider so Openfort trusts Moodeng's
   Supabase JWTs (point it at the project's JWKS / issuer). The SDK sends the user's live
   Supabase access token automatically — no second login.
2. **Gas policy** → create (or reuse) a policy that **sponsors all EVM transactions on Base**,
   so repay, withdraw, *and* the first send (which also deploys the smart account) are gasless.
   Put its `ply_…` id in `VITE_OPENFORT_POLICY_ID`. Set a per-policy **spend cap / rate limit** —
   instant wallets are trivially creatable, so cap sponsored spend to blunt abuse.
3. **Shield** → copy the publishable key, secret key, and encryption share into the vars above.

## Known live-verification point

The send path maps `openfort → wallet` at settlement, so the `confirm-loan-payment` function
verifies it via `eth_getTransactionReceipt` (by tx hash). This assumes Openfort's EIP-1193
`eth_sendTransaction` resolves to a **transaction hash** (its documented behaviour). Confirm this
on the first real sponsored send against a live policy; if it returns a userOp hash instead, add
an `openfort` branch to `verifyPayment` that reads Openfort's userOp receipt.
