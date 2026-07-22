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

1. **Switch Wi-Fi ↔ mobile data.** If one network blocks it, the other often works (e.g. PLDT Wi-Fi blocks it but mobile data doesn't, or the other way around).
2. **Install the free "1.1.1.1" app by Cloudflare** — no sign-up needed. Open it, turn it **On**, then go back to **https://account.base.app** and try again. This safely reroutes around the block and is the quickest fix for most people.
3. **Or use a free VPN.** **Proton VPN** is a good, reputable free option. Turn it on, connect to any nearby location (e.g. Singapore, Japan, or the US), then reopen Moodeng and connect your wallet. Turn the VPN on **before** opening the sign-in page.
4. **Keep your Base Account** — don't switch to a different wallet. The block only affects reaching Base's sign-in service, not the wallet itself, so once you route around it everything works normally.

Safety: only use a well-known VPN (like Proton VPN) or the official **1.1.1.1** app. A VPN just changes how your connection is routed — it never touches your funds, and Moodeng or Base will **never** ask for your seed or recovery phrase.

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

- New users can enter a **referral code** during sign-up / in their account to get the referral bonus.
- If someone wants to **share their own** code, they can do that once their account is active and verified — point them to their referral link in the app.

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
