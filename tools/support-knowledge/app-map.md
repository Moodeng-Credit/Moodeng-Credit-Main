# Moodeng Credit — App Map (where everything is in the app)

## Shareable links you can put in a reply

You can include a tappable link to any of these pages using markdown, e.g. `[browse all guides](/support/guides)`. The chat turns these into buttons that open the page in the app. ONLY use links from this exact list — never invent a path, and don't link to anything not listed here.

- Help & Support Center — `/support`
- All step-by-step guides — `/support/guides`
- FAQs — `/support/faq`
- Getting started — `/support/getting-started`
- The Academy (tutorial video + quiz) — `/academy`
- How Credit Levels work — `/learn/how-credit-levels-work`
- Why we use USDC — `/learn/why-we-use-usdc`
- Credit leveling guide — `/credit-leveling-guide`
- Moodeng blog — `/blogs`
- Reputation Milestones / Trust Points (borrowers) — `/milestones`
- Borrower benefits — `/benefits`
- Why lend (for lenders) — `/whylend`
- The Request Board — `/request-board`

For actions that live on a bottom-nav tab (Repay, Withdraw-from-Dashboard, Account Settings, etc.), describe the tab/step as usual — those aren't in this link list. Prefer a link when you're pointing someone to one of the pages above; keep describing the tab when it's an in-app action.


<!--
  HAND-MAINTAINED. This is the bot's ground truth for in-app navigation.
  The support chatbot must ONLY describe menu paths that are written here —
  if a screen or path isn't listed, the bot says it isn't sure instead of
  inventing one. Keep this in sync with the real UI: update it whenever a
  screen, tab, or button is renamed or moved. Admin screens are deliberately
  excluded — this file is only for what a borrower or lender can see.

  COPY RULES (same as troubleshooting.md and site-map.md):
  - Never say "KYC", "Didit", "liveness", "eID", or "Openfort" to a user.
    The ID check is "Verify Your ID"; the embedded wallet is the "instant wallet".
  - Use the exact on-screen labels, bolded, so users can match what they see.
-->

## The bottom navigation

Moodeng is a mobile-first web app. The bar at the bottom of the screen is how you move around. It only appears once signed in.

**Borrowers** see six tabs: **Request Board**, **Repay**, **Dashboard**, **History**, **Account**, **Help**.

**Lenders** see five tabs: **Request Board**, **Dashboard**, **History**, **Account**, **Help**.

If some tabs look greyed out, the user hasn't chosen a role yet — tapping them sends them to choose borrower or lender first (**How would you like to use Moodeng Credit?** — **I am a Borrower** / **I am a Lender**, then **Confirm**).

There is **no Withdraw tab** — cashing out is only reached from a card on the Dashboard (see below). On the **Repay** screen, the center of the bottom nav turns into a raised **Pay Now** button (shows the amount once entered, e.g. **Pay $12.00**).

## Where do I find my wallet address?

Two places show your own wallet address:

1. **Account → Account Settings**, in the **Wallet** section under **Connected Wallet**. The address is shown shortened (like 0x12…34ab) — tap the address or the copy icon next to it to copy the full address.
2. On the **Repay** screen, when you're short on USDC an add-funds card appears with your address to **copy** (tap it → shows "Copied"). It's there so you can send USDC to yourself from an exchange before paying.

Important: if the user hasn't added a wallet yet, there is no address to show. The **Account** page will show an **Add Base Wallet** button (borrowers) or **Connect Wallet** (lenders) instead — they need to set up their wallet first, and after that the address appears in Account Settings.

## Borrower Dashboard (Dashboard tab)

Top to bottom: a score card with **Trust Score** and **Credit Level** (shows current limit and how much is used; unverified users see a "verify to unlock" action); a **Withdraw your USDC** card — only appears once at least one loan is funded, subtitle "Cash out your funded loan to local currency," taps through to the Withdraw flow; a **Milestones** (Reputation Milestones) section; a verification prompt if not yet verified; a **Loan Summary** (repayments / active / defaulted / pending); a **Lender Diversity** section; and an **Upcoming Loan Dues** list.

## The Account tab

The **Account** tab (bottom navigation) shows the username and verification badge at the top (lenders see an IOU points chip instead), plus:

- **Account Settings** — profile, security, wallet, and notification settings (see below).
- **View Loan Transaction History** — the same loan history as the History tab.
- **Get in Touch** — **Join Our Community** (Facebook group), **Get Help** (Facebook page), **Contact Us** (Telegram).
- Common questions (FAQ accordion, **View More** → the Support hub), a credit guide video (borrowers), and **Sign Out** at the bottom (asks "Sign out?" to confirm).

## Account Settings (Account → Account Settings)

Everything here, section by section:

- **Basic Information** — your **Display Name** (edit it right at the top of Account Settings, next to your avatar), your **Email Address** (change/verify), and for borrowers **Bio Info** ("Work, income, and what you need help with" — the same bio collected on your first loan application; edit it here any time).
- **Preferences** — **Dark Mode** toggle and app **language** switcher.
- **Security & Verification** — two read-only rows, **World ID** and **ID Verification**, each showing **Verified** or **Not Verified**. Email/password users also see a **Password** row with **Change**.
- **Wallet** — **Connected Wallet** (address shown shortened; tap or the copy icon to copy), buttons **Change wallet** and **Disconnect wallet** (asks "Disconnect wallet?" to confirm), and a **Network** row showing **Base**. Borrowers with an active loan see their wallet marked **locked** — that's intentional, so the loan and repayment history stay tied to one wallet. Borrowers who still need a Base wallet see a **Confirm your Base Account** prompt here instead.
- **Notifications** — **Telegram Alerts** (**Connect**), **WhatsApp** and **LINE** (both "Coming soon"), plus toggles for **Account Activity**, **Transaction Activity**, and **Moodeng Blogs**.

Users with an **instant wallet** also see an **Export wallet key** link in the Wallet section. Tapping it opens a confirm sheet ("Export your wallet key," for importing into MetaMask/Trust) with **Cancel** / **Reveal key**; the key is then shown as copyable text with **Copy key** and **I've saved it**. The key is only fetched when you tap Reveal and is cleared again once you close the sheet.

## Repaying (the Repay tab)

The **Repay** tab lists your active (funded, unpaid) loans, soonest due first.

- If you haven't finished setup yet, you'll see one of: **Finish setup to start borrowing** (**Start Setup**), **Verify yourself to borrow** (**Verify Yourself**), **Add Base Wallet to borrow** (**Add Base Wallet**), or, with nothing due, **No repayments yet** (**Request a loan**).
- If your USDC balance is short of what you owe, an add-funds card appears automatically with your wallet address to copy and a list of places to buy/send USDC on Base — in the Philippines it leads with **Coins.ph** (with **Moneybees**, **GCrypto**, **PDAX** as other options, **Show more** to see the rest); outside the Philippines it leads with **Binance**. It updates live and shows **Received $X USDC** once funds land.
- To pay: pick the loan (defaults to the one due soonest), enter an amount or tap **25%**, **50%**, **75%**, or **Full**, then tap the **Pay Now** button that appears in the bottom nav. With a Base Account or instant wallet the payment is gasless and goes straight to the lender.
- Paying off a loan in full shows a **Loan fully repaid** screen with Trust Points earned and, if it unlocks the next level, a **Credit Level unlocked** panel. A partial payment just shows an inline confirmation and the loan stays active.

## Cashing out (Withdraw)

Reached only from the Dashboard's **Withdraw your USDC** card (not a nav tab). First screen asks **How would you like to cash out?** with provider choices tailored to your country — in the Philippines: **Coins.ph** (marked Recommended), **GCrypto**, **PDAX**, **Binance**, **Moneybees**; outside the Philippines, **Binance** is usually the recommended one. Always **USDC on Base**. Picking a provider opens a guided send form: how much you're sending vs. receiving, numbered steps for that specific provider (with a **Show me how** guide on most steps), a field to paste your receiving address at that provider, an amount field with **Max**, and a **Send {amount} USDC to {provider}** button.

## Requesting a loan

From the **Request Board** tab, tap **Apply For A Loan** to open the application.

1. Eligible verified borrowers first see a **Referral Boost** step — **Have a referral code?** field with **Apply code**, or **Continue to application** if you don't have one. A valid referral code adds **+$5 to your starting credit limit**. It's optional — no code just means no boost.
2. If you're not verified yet, you'll be prompted to **Verify Yourself** first.
3. Then **Set Your Own Terms**: **Borrow Amount** (up to your **Current Limit**), **Set Repayment Amount**, **Set Repayment Date** (up to 120 days out), and **Reason For Borrowing** (at least 40 characters — Mecha can help you word it if it's too vague). Submit with **Make Your Request**.
4. First-time borrowers also fill in a short bio (friendly name, optional photo, work type, payday window, income/expenses) — this is the same **Bio Info** editable later from Account Settings.

## Getting verified

Tap **"Verify Yourself"** wherever the app prompts it (Dashboard, Repay, the loan application, or Account). This opens a chooser:

- **Verify Your ID** (marked Recommended) — a quick national-ID-and-selfie check, available in select countries; takes about 3 minutes.
- **Verify with World ID** — for people who already use World App; choose **I've been verified at an Orb** or **I'll verify with my passport**, with links to download World App or find a nearby Orb.

Check your verification status any time in **Account → Account Settings → Security & Verification** (the **World ID** and **ID Verification** rows).

## The Help tab

The **Help** tab opens the Help Hub: chat with **Mecha** (that's you!) in English or Tagalog, plus popular topic chips — **Verify your ID**, **Cash out to a bank**, **Wallet won't connect**, **How to repay**, **Grow my credit limit**, **Coinbase vs Base** — and a **Browse everything** button that goes to the full FAQ.

## Lender screens

- **Dashboard** (lender) — display name, IOU points chip, a **Power Lender** badge for top lenders, stat cards (**Total Earnings**, **Total Loans Lent out**, **Total Loss**, **Total Loans Funded**, **Active Loans**), and a **Funding Transactions** section with search/filter and **View All Transactions**.
- **Request Board** — browse open borrower requests; tap **Send Your Help** on a card to fund it (a funded card then shows **Help Received**).
- **My Funded Loans** (`/lender/supported`) — the loans a lender has funded; repayments route back to their wallet automatically, no claim step needed.
- **Lender Performance** — a stats view of funding performance over time.
- **History** — a lender's past funding transactions, same tab as borrower History.
- Lenders add funds to their wallet via a **Fund your wallet** flow — buy USDC with a card (Coinbase Onramp) or bridge USDC in from another chain.

## History / Transactions

The **History** tab (shared borrower + lender) shows **Transaction History** (borrower) or **Funding Transactions** (lender), with tabs **All Transactions** / **Active Loans** / **Completed**, a search field, and filters (sort by amount or date; status: Pending, Active, Repaid, Default). Tapping a row opens its Transaction Detail.

## Profile

`/profile` is your own signed-in profile, with Dashboard / Loan Summary / Transaction History / Settings / Support tabs. A public borrower profile is also visible at `/user/:username` — this is what a lender sees before funding a request (verification status, credit level, repayment history) — it never shows ID documents, contacts, or private messages.

**Lenders are anonymous.** A lender is identified only by a username tied to their wallet — there is no public lender profile, and borrowers cannot see who a lender is. (Only borrowers have a public profile, so lenders can review a request before funding it.)
