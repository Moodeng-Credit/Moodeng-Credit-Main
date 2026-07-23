# Moodeng Credit — Common Confusions & Troubleshooting

<!--
  HAND-MAINTAINED. This is the single place to capture the real problems users
  hit that AREN'T covered by the in-app FAQ/guides. George & Emma: add a new
  section here whenever a confusion keeps coming up in Messenger/Telegram.
  The support chatbot reads this verbatim, so write it the way you'd explain
  it to a confused borrower — plain, warm, step-by-step.

  COPY RULES (keep the bot on-brand):
  - Never say "KYC", "Didit", "liveness", or "eID" to a user. The ID check is
    always called "Verify Your ID".
  - We are not a financial advisor. Help with how-to and product questions.
    Never tell a user whether to hold/sell crypto or give investment advice.
-->

## Coinbase app vs Base Account (the #1 mix-up)

Many new users download the **Coinbase app** and get stuck, because they think that's what Moodeng uses. It isn't.

- Moodeng uses a **Base Account**, created at **https://account.base.app**.
- Base is a network built *by* Coinbase, but the **Coinbase app is a different thing** — you do **not** need it to use Moodeng.
- If someone shows a Coinbase screen and asks "is this the one?" — gently redirect them: "You don't need the Coinbase app. What we use is a Base Account. Go to account.base.app and sign in with your email."
- A Base Account is **passwordless and seedless** — you sign in with email or a passkey. There is no 12-word recovery phrase to write down or lose.

## Can't create a Base Account / the page won't load

If a user is stuck creating their Base Account:

1. **Switch from Wi-Fi to mobile data** (or the other way around). Some Wi-Fi networks block the sign-in. This fixes it surprisingly often.
2. Make sure they're using a **real browser — Chrome or Safari** — not a browser inside another app (see next section).
3. Try once more at **https://account.base.app**.
4. If it still fails, it may be your network blocking Base — see the next section.

## Base won't load in the Philippines (network/ISP blocking) — use 1.1.1.1 or a VPN

Some Philippine networks (notably **PLDT** and **Smart**) block the sign-in service that Base uses (`keys.coinbase.com`). When that happens, **account.base.app won't load, or connecting your wallet dead-ends** — sometimes with a "your connection is not private" / security or certificate warning — even though everything else on the internet works fine. This is not your phone or your account; the network is just blocking one address.

Fixes, easiest first:

1. **Create an instant wallet instead (easiest — nothing to install).** For borrowers, Moodeng can set up a wallet for you straight from your login. When we detect the block (or Base won't connect), the wallet screen shows **"Create your wallet instantly"** — just tap **Create my wallet**. No app, no seed phrase, and network fees are covered for you. See the "Instant wallet" section below. This is now the recommended fix for blocked borrowers.
2. **Switch Wi-Fi ↔ mobile data.** If one network blocks it, the other often works (e.g. PLDT Wi-Fi blocks it but mobile data doesn't, or the other way around).
3. **Install the free "1.1.1.1" app by Cloudflare** — no sign-up needed. Open it, turn it **On**, then go back to **https://account.base.app** and try again. This safely reroutes around the block. Choose this if you specifically want to keep using your Base Account.
4. **Or use a free VPN.** **Proton VPN** is a good, reputable free option. Turn it on, connect to any nearby location (e.g. Singapore, Japan, or the US), then reopen Moodeng and connect your wallet. Turn the VPN on **before** opening the sign-in page.

Safety: the instant wallet is a real self-custodial wallet you fully own (you can export its key anytime). Only use a well-known VPN (like Proton VPN) or the official **1.1.1.1** app. A VPN just changes how your connection is routed — it never touches your funds, and Moodeng will **never** ask for your seed or recovery phrase.

## The instant wallet (create a wallet without Base)

**What it is:** a wallet Moodeng sets up for the borrower from their existing Moodeng login — no app to download and no seed phrase to write down. It's the escape hatch for people who can't use a Base Account (most often the PLDT/Smart block above).

**When it shows up:** only for **borrowers**, and only when Moodeng is set up for it. On the wallet screen it appears automatically as the main option (**"Create your wallet instantly" → Create my wallet**) when we detect the network block or after a Base connection fails. Otherwise it's offered as a smaller **"Can't connect? Create an instant wallet"** link under the Base button, so anyone who's stuck can still use it. Lenders don't get this — they use the normal wallet picker.

**Should a user use it?** If they're a borrower and Base won't connect (blocked network, "page won't load", certificate warning), yes — it's the quickest path and avoids the block entirely (it doesn't use `keys.coinbase.com`). If their Base Account already works, they can keep using it; the instant wallet is there for when Base is the problem.

**How it works / is it safe:**
- It's a **real self-custodial wallet** on Base — it receives USDC loans and builds Trust Score exactly like any other wallet.
- **Gasless:** Moodeng covers the network fees, so the borrower doesn't need ETH to repay or cash out.
- **You fully own it.** You can reveal and export its private key anytime from **Account → Account Settings → Wallet → "Export wallet key"** and import it into MetaMask, Trust, or any wallet app — then you're free to leave Moodeng entirely.
- Moodeng never asks for (and the user should never share) their private key. The export screen is the only place the key is shown, and only when the user taps to reveal it.

**If creating it fails:** they'll see a message saying what went wrong (usually "check your internet and try again", or "sign in again"). Have them retry; if it keeps failing, offer to connect them with the team.

**Cashing out:** same as any wallet — send the USDC to an exchange deposit address (GCrypto, Coins.ph, etc.), or use the withdraw flow. The send is gasless from the instant wallet too.

## "Open in browser" — the in-app browser problem

If a user opened Moodeng by tapping a link **inside Facebook, Messenger, Instagram, or LINE**, they're in that app's built-in mini-browser. Sign-in and wallet pop-ups often **fail silently** there ("cannot open", nothing happens, or a 403 error).

Fix — tell them to open Moodeng in a **real browser**:
- Tap the **three dots (⋯)** in the corner and choose **"Open in Chrome" / "Open in Safari" / "Open in external browser."**
- Or copy the link and paste it into Chrome or Safari directly.
- Then sign in and connect the wallet again from there.

## Wallet won't connect to my Moodeng account

The reliable reset sequence (works for most "connect" failures):

1. **Close all tabs** where the Moodeng site is open.
2. Open the **wallet app** and **disconnect** the Moodeng site if it shows as connected.
3. **Close the browser completely and reopen it.**
4. Open the site again in **Chrome or Safari** (not an in-app browser).
5. Press **Apply for a Loan / Connect Wallet** again and **approve** the wallet request when it appears.
6. If it still doesn't work, offer a quick call to sort it out together.

## "Try again" keeps popping up / I have to tap twice

For returning users the wallet approval sometimes needs a fresh tap. Ask them to:
- Tap the connect/approve button **directly** (not wait for it to happen automatically), and
- Approve the pop-up when it appears. If nothing appears, redo the "wallet won't connect" reset above.

## I signed up but I'm still not verified

Signing up and getting verified are two separate steps. To verify:
1. In the app tap **"Verify Yourself."**
2. Choose **"Verify Your ID"** — a quick national ID photo + selfie check, about 3 minutes, in supported countries.
3. Already a World App user? They can choose **"Verify with World ID"** instead.
- Most checks finish within minutes. If it's stuck, have them retry in a real browser (not an in-app browser) and make sure the photo is clear and well-lit.

## Where do I put a referral code?

- Referral codes are entered at the **start of the loan application**: from the Request Board, tap to apply for a loan, and the first step asks for a referral code — type it and tap **Apply code**. (The step only appears for verified borrowers.)
- If a user doesn't have a code, they just tap **Continue to application** — the code is optional.

## Cashing out my loan to GCash / a bank (off-ramp)

Users borrow **USDC on the Base network**. To turn it into pesos (or local currency):
1. Send the USDC to an exchange or local service — **GCrypto (GCash), Coins.ph, PDAX, Binance P2P**, and others.
2. **Always choose "Base" as the network** when sending — picking the wrong network can lose the funds. This is the single most important detail.
3. Sell the USDC there and withdraw local currency to the bank or e-wallet.

## Adding money / buying USDC to repay (on-ramp)

If a user doesn't hold USDC yet and needs to repay:
1. Buy USDC on **Binance P2P, Coins.ph, PDAX, or GCrypto**.
2. Send it **on the Base network** to the repayment address shown on the **Repay** screen.
3. Repay **before the due date** — on-time repayment builds Trust Score and unlocks higher credit levels.

## Safety reminders (always true, repeat when relevant)

- **Moodeng never holds or moves your money.** Loans go wallet-to-wallet directly between lender and borrower.
- **Always send USDC on the Base network.** Wrong network = lost funds.
- A Base Account is **seedless** — Moodeng will never ask for a "seed phrase" or "recovery phrase," and no legitimate helper ever will.
- When unsure, it's always safe to **wait and ask** rather than guess — especially before sending funds.
