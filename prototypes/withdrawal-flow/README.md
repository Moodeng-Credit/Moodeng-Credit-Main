# Withdrawal flow prototype

A standalone (Figma Make–origin) Vite + React + Tailwind prototype of the borrower
**"You've been funded" → withdraw** flow. It is **not wired into the main app** — it's a
design/UX sandbox for iterating on the funded + withdrawal screens before porting them
into Moodeng proper.

The single source file is [`src/app/App.tsx`](src/app/App.tsx).

## What it covers
- **Funded celebration** sheet (received vs. repay, provider logos, withdraw CTA).
- **Withdraw location gate** — Philippines vs. International.
- **PH paths:** Moneybees (assisted OTC + one-time KYC gate), GCash GCrypto, PDAX —
  GCash/PDAX share the reusable `AppFlow` (numbered timeline, USDC→Base, paste/scan
  address, sell-to-PHP). Coins.ph was removed (it does not support USDC on Base).
- **International:** Binance (timeline + Binance P2P cash-out guide).
- **"Show me how"** per-step guides with embedded YouTube candidates / official help-doc
  links / GIF-video placeholders.

## What's functional vs. simulated
Because this is a standalone sandbox (no backend, no wallet connection), interactions
are split into two kinds:

- **Actually functional (no backend needed):**
  - **QR scanner** — real camera scan decoded with `jsQR` (works in Safari, Firefox and
    Chrome, not just Chromium), extracts the `0x…` address; falls back to a "paste
    manually" message if the camera is unavailable/denied.
  - **Live FX rate** — `You'll receive` is computed from a live USDC→PHP/USD rate
    (CoinGecko free endpoint), and falls back to an approximate fixed rate (marked
    "est.") if the fetch is blocked, so an estimate always shows. Moneybees intentionally
    shows no rate (it's confirmed at cash-out).
  - **Send flow** — the review sheet runs a `review → sending → sent` sequence with a
    generated tx hash + copy-to-clipboard. Copy buttons show a "Copied" confirmation.
  - **Moneybees** — consent gating, "Learn more" expander, and the KYC handoff
    (`Continue → pending → all set`, plus "I already have KYC") all drive real state.

- **Simulated (needs the real app to be real):** the on-chain USDC transfer (no wallet
  signing — the "sent" state is faked), the loan amounts/due date (hardcoded), and
  Moneybees KYC/chat (the chat icons are illustrative, not deep-links).

## Theming
Light + dark are driven by palette tokens in `src/styles/theme.css` (`:root` for light,
`.dark` for dark). Inline colors in `App.tsx` reference those tokens via
`var(--token)`, so dark mode is a single `.dark` class on the phone wrapper. The toggle
(top-right) flips it; the initial value follows the OS `prefers-color-scheme`. Brand/logo
colors (Binance gold, USDC blue, PDAX green, GCash tile, flags) are intentionally fixed
across both themes.

Design + off-ramp reasoning lives in the repo's `DESIGN.md` and the agent memory note
`withdrawal-offramp-options`.

## Run it
```bash
cd prototypes/withdrawal-flow
pnpm install
pnpm exec vite --port 4321
```
Open http://localhost:4321.

> On Apple Silicon, if Vite errors about a missing native binary (rollup / esbuild /
> lightningcss / @tailwindcss/oxide), install the matching `*-darwin-arm64` package for
> that dependency's version, e.g. `pnpm add -D @esbuild/darwin-arm64@<esbuild version>`.
> These platform packages are already pinned in `package.json`.

Or, from the repo root, the Claude Code preview config **`withdrawal-prototype`**
(in `.claude/launch.json`) launches it on port 4321.
