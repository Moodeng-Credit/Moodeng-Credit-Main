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

## The Instant Wallet (the default wallet for borrowers)

**What it is:** Moodeng's own wallet, and the **default wallet for borrowers**. Moodeng sets it up from the user's existing Moodeng login — no app to download and no seed phrase to write down. Borrowers receive loans in it; a **Base Account** is still supported as an optional alternative for borrowers who prefer one.

**Lenders:** lenders are usually outside the Philippines, and for them a **Base Account** is the recommended wallet (it's the **Top Pick** in the lender wallet picker). Lenders can also use an Instant Wallet, or another wallet like MetaMask — it just isn't their default.

**Where it shows up:** on the wallet screen. Borrowers see **Create your Instant Wallet** with a **Create Instant Wallet** button, plus a smaller **"Prefer a Base Account? Connect it instead"** link for anyone who wants to use a Base Account. Lenders see an **Instant Wallet** card with **Create Instant Wallet** at the top, then **"or connect a Base Account or another wallet"** above the wallet picker.

**Should a user use it?** For borrowers, yes — it's the quickest path, and it also works when Base Account sign-in is blocked (it doesn't use `keys.coinbase.com`, so the PLDT/Smart block below doesn't affect it). If a borrower already has a Base Account that works and prefers it, they can connect that instead. For lenders, suggest a Base Account first; the Instant Wallet is a fine option if they don't want to set one up.

**How it works / is it safe:**
- It's a **real self-custodial wallet** on Base — it receives USDC loans and earns Pandesal points exactly like any other wallet.
- **Gasless:** Moodeng covers the network fees, so the borrower doesn't need ETH to repay or cash out.
- **You fully own it.** You can reveal and export its private key anytime from **Account → Account Settings → Wallet → "Export wallet key"** and import it into MetaMask, Trust, or any wallet app — then you're free to leave Moodeng entirely.
- Moodeng never asks for (and the user should never share) their private key. The export screen is the only place the key is shown, and only when the user taps to reveal it.

**If creating it fails:** they'll see a message saying what went wrong (usually "check your internet and try again", or "sign in again"). Have them retry; if it keeps failing, offer to connect them with the team.

**Cashing out:** same as any wallet — send the USDC to an exchange deposit address (GCrypto, Coins.ph, etc.), or use the withdraw flow. The send is gasless from the Instant Wallet too.

## Coinbase app vs Base Account (a common mix-up)

Many new users download the **Coinbase app** and get stuck, because they think that's what Moodeng uses. It isn't.

- By default, borrowers use the **Instant Wallet**, created from the user's Moodeng login — no app needed (see above).
- Borrowers who prefer a Base Account can connect one instead, and lenders are recommended to use one. A **Base Account** is created at **https://account.base.app**.
- Base is a network built *by* Coinbase, but the **Coinbase app is a different thing** — you do **not** need it to use Moodeng.
- If someone shows a Coinbase screen and asks "is this the one?" — gently redirect them: "You don't need the Coinbase app. Your Moodeng Instant Wallet is set up from your Moodeng login. If you'd rather use a Base Account, go to account.base.app and sign in with your email."
- A Base Account is **passwordless and seedless** — you sign in with email or a passkey. There is no 12-word recovery phrase to write down or lose.

## Can't create a Base Account / the page won't load

If a user is stuck creating their Base Account, the simplest fix is to use the **Instant Wallet** instead (see above). If they specifically want a Base Account:

1. **Switch from Wi-Fi to mobile data** (or the other way around). Some Wi-Fi networks block the sign-in. This fixes it surprisingly often.
2. Make sure they're using a **real browser — Chrome or Safari** — not a browser inside another app (see next section).
3. Try once more at **https://account.base.app**.
4. If it still fails, it may be your network blocking Base — see the next section.

## Base won't load in the Philippines (network/ISP blocking) — use 1.1.1.1 or a VPN

Some Philippine networks (notably **PLDT** and **Smart**) block the sign-in service that Base uses (`keys.coinbase.com`). When that happens, **account.base.app won't load, or connecting your wallet dead-ends** — sometimes with a "your connection is not private" / security or certificate warning — even though everything else on the internet works fine. This is not your phone or your account; the network is just blocking one address.

Fixes, easiest first:

1. **Use the Instant Wallet instead (easiest — nothing to install).** On the wallet screen, tap **Create Instant Wallet**. No app, no seed phrase, and network fees are covered for you. See "The Instant Wallet" section above. This is the recommended fix.
2. **Switch Wi-Fi ↔ mobile data.** If one network blocks it, the other often works (e.g. PLDT Wi-Fi blocks it but mobile data doesn't, or the other way around).
3. **Install the free "1.1.1.1" app by Cloudflare** — no sign-up needed. Open it, turn it **On**, then go back to **https://account.base.app** and try again. This safely reroutes around the block. Choose this if you specifically want to keep using your Base Account.
4. **Or use a free VPN.** **Proton VPN** is a good, reputable free option. Turn it on, connect to any nearby location (e.g. Singapore, Japan, or the US), then reopen Moodeng and connect your wallet. Turn the VPN on **before** opening the sign-in page.

Safety: the Instant Wallet is a real self-custodial wallet you fully own (you can export its key anytime). Only use a well-known VPN (like Proton VPN) or the official **1.1.1.1** app. A VPN just changes how your connection is routed — it never touches your funds, and Moodeng will **never** ask for your seed or recovery phrase.

## "Open in browser" — the in-app browser problem

If a user opened Moodeng by tapping a link **inside Facebook, Messenger, Instagram, or LINE**, they're in that app's built-in mini-browser. Sign-in and wallet pop-ups often **fail silently** there ("cannot open", nothing happens, or a 403 error).

Fix — tell them to open Moodeng in a **real browser**:
- Tap the **three dots (⋯)** in the corner and choose **"Open in Chrome" / "Open in Safari" / "Open in external browser."**
- Or copy the link and paste it into Chrome or Safari directly.
- Then sign in and connect the wallet again from there.

## Wallet won't connect to my Moodeng account

This applies to connecting a Base Account or another outside wallet. If the user doesn't specifically need one, the **Instant Wallet** is simpler — nothing to connect (see "The Instant Wallet" above).

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

## My reason says "write it in English" / it won't let me continue

Lenders on Moodeng are in the US and Europe, so a loan reason has to be written in English — a request they can't read doesn't get funded. Tagalog, Taglish and Bisaya are the usual cause; the form stops there until it's rewritten.

- Offer to translate it. Mecha can do this directly — there's an **"Ask Mecha to write this in English"** link right under the field, or paste what they wrote and translate it for them.
- A borrowed word inside an English sentence is fine ("buying gamot for my mother"). It's whole sentences in another language that stop the form.
- The same applies to **Describe your situation** in the bio step. The job title itself can stay local ("sari-sari store owner", "jeepney driver").

## My reason is in English but it still says it's too vague

That's a different check — the reason names nothing specific ("for personal use", "for my needs"). It's a nudge, not a block: the field says what to add, and tapping **Make Your Request** a second time posts it anyway. Better to help them say what the money is actually for and when they get paid — specific reasons get funded more.

## "Make Your Request" does nothing when I tap it

They aren't verified yet. Tapping the greyed button now shakes it and highlights a note above it explaining why, with a **Verify Yourself** button attached. Verification is the last step before a request can be sent — see "I signed up but I'm still not verified" above.

## Where do I put a referral code?

- Referral codes are entered at the **start of the loan application**: from the Request Board, tap to apply for a loan, and the first step asks for a referral code — type it and tap **Apply code**. (The step only appears for verified borrowers.)
- What a code does: a valid referral code adds **+$5 to your starting credit limit**. So a new borrower who normally starts at $15 would start at $20 with a valid code.
- If a user doesn't have a code, they just tap **Continue to application** — the code is optional and there's no penalty for skipping it.

## Cashing out my loan to GCash / a bank (off-ramp)

Users borrow **USDC on the Base network**. To turn it into pesos (or local currency):
1. Send the USDC to an exchange or local service — **GCrypto (GCash), Coins.ph, PDAX, Binance P2P**, and others.
2. **Always choose "Base" as the network** when sending — picking the wrong network can lose the funds. This is the single most important detail.
3. Sell the USDC there and withdraw local currency to the bank or e-wallet.

## Adding money / buying USDC to repay (on-ramp)

If a user doesn't hold USDC yet and needs to repay:
1. Buy USDC on **Binance P2P, Coins.ph, PDAX, or GCrypto**.
2. Send it **on the Base network** to the repayment address shown on the **Repay** screen.
3. Repay **before the due date** — on-time repayment earns Pandesal points and unlocks higher credit levels.

## Can I have more than one loan at a time?

Yes — you can have more than one active loan at the same time, as long as the new amount fits within your **available credit limit**. Your available limit is your level's limit (from $15 up to $140) minus what you already owe on any active loans. So if your current loans already use up your whole limit, you'll need to repay (fully or partly) before you can request more. (Some accounts may also have a cap on how many loans can be active at once — if the app says you've reached your maximum number of active loans, repay one first.)

## Paying in parts (some now, some later)

You can repay in parts — the Repay screen has **25% / 50% / 75% / Full** buttons or a custom amount, and the loan stays active until it's fully paid. Paying part of it on time still helps: partial on-time payments earn some Pandesal points (about 7 for 75% paid, 5 for 50%, 3 for 25%), and a full on-time payment earns the most (10). If part of the payment lands **after** the due date, that late part earns 0 Pandesal points and counts as late on your record — but the amount you owe still never grows (no late fees, no rollover). So paying as much as you can before the due date is always better than nothing.

## How much does cashing out cost?

Moodeng itself charges **$0** — the only cost is the exchange's own conversion fee. **Coins.ph is the cheapest route we've found in the Philippines: about 0.70% for a full round trip.** For a $15 loan taken out and repaid, the all-in cost through Coins.ph is roughly **₱6.50 (about $0.10)** — that covers the small trading fee each way, a free PESONet bank cash-out, and the tiny network fee. If you want the pesos instantly instead of same/next-day, InstaPay adds a flat ₱5 (round trip ≈ ₱11.50, about $0.19). Other services (like Moneybees) build their margin into the rate, so they usually cost more.

## Defaulting / a loan that goes unpaid

If a loan isn't repaid it can go into **default**. A default is a **permanent public mark** on the borrower's record, and the account is **frozen from new borrowing** until things are resolved — a defaulted or overdue borrower is sent to an account-support screen with a **Repay Now** option when they sign in. The amount owed still never grows (no late fees or rollover), and Moodeng never contacts family, friends, or coworkers. If someone's account is frozen and they think it's a mistake, offer to connect them with the team.

## Safety reminders (always true, repeat when relevant)

- **Moodeng never holds or moves your money.** Loans go wallet-to-wallet directly between lender and borrower.
- **Always send USDC on the Base network.** Wrong network = lost funds.
- The Instant Wallet and Base Accounts are both **seedless** — Moodeng will never ask for a "seed phrase" or "recovery phrase," and no legitimate helper ever will.
- When unsure, it's always safe to **wait and ask** rather than guess — especially before sending funds.
