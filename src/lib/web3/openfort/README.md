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

## Security review

Risks specific to running this rail, and how each is handled.

1. **Sponsored-gas abuse (HIGHEST — needs a dashboard action).** The gas policy
   `pol_532f044b-…72ac` sponsors *all* EVM transactions ("App pays"). Because embedded wallets are
   cheap to create, an attacker could try to burn the gas budget with junk transactions.
   Mitigations in place: (a) server-side **borrower-only gate** on the Shield session endpoint —
   non-borrowers can't even provision a wallet; (b) each Supabase user maps to exactly one
   deterministic smart account, so it's one-wallet-per-account, not unlimited.
   **Still required (George, Openfort dashboard):** set a **per-policy spend cap + rate limit**, and
   ideally scope the policy to USDC transfers rather than "all EVM transactions". This is the real
   ceiling on abuse and only you can set the numbers (daily $ of sponsored gas, per-wallet rate).

2. **Shield session endpoint abuse (LOW–MED).** `openfort-shield-session` is POST-only, gated by a
   valid Supabase JWT (`verify_jwt=true`) *and* re-verified in-function, *and* now borrower-only.
   Residual: a signed-in borrower could call it repeatedly (one Shield session per call). Normal use
   is one call per provision, so impact is small; if Shield billing/quota ever spikes, add a
   per-user rate limit (e.g. a `wallet_provision_attempts` table check).

3. **Private-key export (MED).** `exportPrivateKey()` reveals the key in the browser. It requires an
   explicit tap, is shown only in a modal, is cleared from state on close, and is never logged. The
   copy-to-clipboard leaves the key in the clipboard — the modal warns the user; consider a
   clipboard auto-clear later. XSS would be able to call it, but that's inherent to any embedded
   wallet and is bounded by the app's general XSS posture.

4. **Custody nuance of AUTOMATIC recovery (DECISION — confirm the copy is honest).** We use
   `RecoveryMethod.AUTOMATIC` (no user password) for lowest friction. This means the key is
   reconstructable from the Shield share + the project — so it is *self-custodial with export* (the
   user can always leave), but the infrastructure has more control than PASSWORD/PASSKEY recovery
   would give. Onboarding copy only says "we never ask for your private keys or seed phrase", which
   stays true. If you want stricter self-custody, switch to PASSWORD/PASSKEY recovery (more friction).

5. **Supabase token → Openfort (LOW, by design).** The user's live Supabase access token is handed
   to the Openfort SDK for third-party auth; Openfort verifies it against the configured Supabase
   JWKS. Standard OIDC third-party flow; the token is short-lived and scoped.

6. **Wallet-lock (LOW, not new).** The smart-account address is written through the existing
   `updateUser` path (the user's own row, under the same RLS/checks as every other wallet). The
   address is deterministic from the SDK, so there's nothing new to forge here.

No secrets ship to the client: only publishable keys (`pk_test`, Shield publishable, policy id) are
in the bundle; the Shield secret + encryption share live only in Supabase edge-function secrets.
