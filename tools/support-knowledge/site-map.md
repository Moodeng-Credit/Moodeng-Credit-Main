# Moodeng Credit — Site Map (the public website & content, beyond the core app flows)

<!--
  HAND-MAINTAINED. Ground truth for everything on the public/marketing side of
  Moodeng Credit and its education/legal content — the parts app-map.md doesn't
  cover (which is core in-app screens and navigation). If a page or fact isn't
  written here, the bot says it isn't sure instead of inventing one. Admin
  screens are deliberately excluded. Keep in sync with the real pages.

  COPY RULES (same as app-map.md and troubleshooting.md):
  - Never say "KYC", "Didit", "liveness", "eID", or "Openfort" to a user.
    The ID check is "Verify Your ID"; the embedded wallet is the "instant wallet".
  - Use exact on-screen labels, bolded.
  - Numbers change over time — treat stats below as "as of" the date given,
    and if a user needs the current number, say to check the live page rather
    than guessing it's still exactly this.
-->

## Marketing / landing pages

The marketing site (`public/landing/`) explains Moodeng before someone signs up. Desktop visitors land on the main page; mobile visitors land on a mobile-optimized version. Both cover the same offer:

- **First loan is $15.** You choose the amount you'll pay back and the due date before you ask — nothing changes after the request goes live. Example: borrow $15, agree to pay back $18 (the extra $3 is the lender's "thank you," not a Moodeng fee).
- **Moodeng charges $0** — no service fee, no processing fee, no hidden charges, no APR, no rollover. If a payment is late, the amount owed does not grow ("$18 stays $18") — it just becomes part of your record.
- **Four honest promises:** Moodeng never digs through your phone (no contacts/photos/messages access), never sells your information, never shames you (reminders stay private, nothing posted publicly), and never makes you prove yourself twice (one ID check proves you're one person; lenders see your verification status, never your documents).
- **Funding is not automatic** — a real person on the Request Board decides to fund each request; if nobody funds it before it expires, you owe nothing.
- Loans settle in **USDC** and land in your **Base Account**; cashing out to pesos goes through an external provider you choose (Coins.ph, GCrypto, PDAX, Binance, or Moneybees) — Moodeng adds no fee for this, though the provider might have its own.
- Credit limit grows over time with on-time repayment — the $15 first limit can grow to $20, then higher, the more full-limit loans you repay on time (see "How Credit Levels work" below for the exact ladder).

There are dedicated marketing pages walking through **how it works** (four steps: ask → a real person decides → the loan lands as USDC in your Base Account → repay in parts or in full), **how to cash out** (choosing a provider, always Base network, Coins.ph is the recommended route in the Philippines), **how to repay** (pick the loan, add USDC, choose 25/50/75/Full or a custom amount), a **for lenders** page (browse requests, review a borrower's record before funding, only fund what you can afford to lose — repayment is never guaranteed), and an **about/our story** page (why Moodeng exists, told through the founders' own reasons for building it).

A separate in-app **Benefits** page (for borrowers) and **Why Lend** page (for lenders) make the same case in the signed-in app, and a **Team** page introduces the people behind Moodeng.

**IOU rewards for lenders (the specifics shown on the Why Lend page):** lending earns IOU — up to **25 IOU** for funding a first-time borrower, plus **1 IOU for every $1 lent**. Lend to a 2nd-time borrower and you earn 20 IOU, and so on. Lend **5 times** and you're invited to the Moodeng Credit DAO. For now these show as IOU points; when the IOU token airdrop happens, your points help determine your token reward. IOU is for lenders only — borrowers build a Trust Score and Credit Level instead.

## Moodeng Academy (`/academy`)

An interactive, illustrated walkthrough of how to use the app, with a short tutorial video and a quiz at the end. It walks through: creating an account, verifying (to prove you're a real, unique person), adding a Base Account, understanding that your requested amount decides whether a loan is "trust-building" (below your limit) or "credit-building" (at your full limit), submitting a request, getting matched on the Request Board, repaying clearly and on time, and growing your next credit limit.

### Academy → Money & getting started (`/academy/money`)

Four short guides, each about the practical mechanics of using USDC on Base:

- **Verify your identity** — a one-time check, about 3 minutes: tap **Verify Yourself**, choose **Verify Your ID**, have your national ID ready in good lighting, complete the ID-photo-and-selfie check. Most people finish in minutes; human review is usually done within a few hours.
- **Add funds to your wallet** — buying or sending USDC on Base via Binance P2P, Coins.ph, PDAX, GCrypto (GCash), Moneybees, or from another wallet/exchange you already use. Always choose the **Base** network — sending on the wrong network can lose funds.
- **Withdraw to your bank** — selling USDC on an exchange and moving the cash to a bank or e-wallet, via the same list of providers.
- **Repay your loan** — sending the exact USDC amount shown on the Repay screen to the address shown there, always on Base; buy USDC first if you don't already hold it.

## Learning about credit levels and USDC (`/learn`)

Two in-depth articles live here (plus the same guide library also reachable from Support → Guides):

- **How Credit Levels work** — the ladder is **Level 1 = $15 → Level 2 = $20 → Level 3 = $40 → Level 4 = $60**. You start at Level 1. Only repaying a **full-limit loan** (a "Credit-Building" or "Credit Growth" loan) on time unlocks the next level — borrowing less than your limit ("Trust-Building") grows your Trust Score but not your limit. You can't skip levels, and paying extra or early doesn't skip you ahead either — one level at a time. Missing a repayment pauses progress and lowers your Trust Score, but your level itself never resets.
- **Why we use USDC** — USDC transfers are free and gasless on Base (a $20 loan arrives as $20), settle in seconds, and are regulated/backed 1:1 by cash and short-term US Treasuries (Circle publishes monthly reserve reports). It holds a stable $1 value, unlike volatile crypto. Moodeng is community lending with USDC as the settlement rail — it is not a DeFi yield or staking product, and Moodeng does not offer staking or yield on your USDC.

## Blogs (`/blogs`)

Longer editorial pieces on predatory lending, borrower dignity, and fair credit — for example, on why a first credit record shouldn't come from a loan-shark app, the history of predatory lending and contact-list abuse, what lenders actually need to know about a borrower (work rhythm and repayment history, not personal document oversharing), and why small loans are meaningful infrastructure rather than a gimmick. These are opinion/context pieces, not product instructions — if a user's question is really "how do I use the app," point them to the Academy or Guides instead.

## Credit Leveling Guide (`/credit-leveling-guide`)

A dedicated page spelling out the same ladder as "How Credit Levels work": **$15 → $20 → $40 → $60**. The rule in one line: **full limit + on-time repayment = next level.** Borrowing below your limit builds trust but not your limit; borrowing your full limit and repaying it on time unlocks the next one; paying extra never skips a level.

## Reputation Milestones / Trust Points (`/milestones`)

**Borrower-only** — lenders never see this page. It shows your progress toward reputation milestones like getting verified, your first request, your first funded loan, your first on-time repayment, building a repayment streak, and reaching higher credit levels — each worth a number of Trust Points. Trust Points unlock cosmetic profile rewards as you cross point thresholds:

- **Silver avatar ring** at **50** Trust Points
- **Gold avatar ring** at **120** Trust Points
- **Trusted profile badge** at **250** Trust Points
- **Top borrower award** at **500** Trust Points

(There are also one-off collectibles, like a Founding Lucky Cat for early borrowers.) Important: **Trust Points unlock profile rewards — they do not guarantee funding**, and they are self-facing (only you see them, not lenders).

## Support Hub (`/support`)

The Help & Support Center, with four sections:

- **Getting started** — a hub of links into the Academy, Benefits/Why-Lend pages, the USDC and Credit Levels articles, and the Blogs.
- **Guides** — a searchable library of short how-to articles (categories: Getting Started, Trust Score, Credit Level, Repayment, Wallet, Security) covering things like requesting your first loan, how your Trust Score is calculated and how repayments affect it, the difference between trust-building and credit-building loans, ways to repay and ways to add funds, withdrawing to a bank (with Coins.ph typically the cheapest round-trip route in the Philippines), what fees you'll pay (Moodeng charges none — the only cost is the exchange's own conversion fee), and managing your account/security settings. (The Trust Score guides are borrower-specific and not shown to lenders.)
- **FAQs** (`/support/faq`, also reachable at `/faq`) — the standard question list: what Moodeng is, how borrowing works, what a Trust Score and Credit Level are, what a Base wallet is and why borrowers need one, why USDC, whether Moodeng charges fees (no), what a credit-building loan is, and whether new borrowers can get a small loan (yes, starting at $15, no minimums or setup fees).
- **Updates** — a changelog of recent product improvements (filters on the Request Board, wallet/verification onboarding polish, clearer loan states, etc.).

## Help Hub (`/help`)

The **Help** tab's destination — a chat-first page where you can talk to **Mecha** directly, plus quick topic chips for the most common questions (verifying your ID, cashing out, wallet connection trouble, how to repay, growing your credit limit, Coinbase vs. Base) and a **Browse everything** button into the full FAQ. This page also works for people who aren't signed in yet — it's the link shared in the community group.

## Legal pages

- **Terms of Service** (`/terms`) — using Moodeng honestly, reviewing loan terms before accepting funds, keeping your wallet secure. Notes that Moodeng cannot reverse blockchain transactions, recover a lost wallet, or guarantee a lender will fund a request.
- **Privacy Policy** — there are two versions: a short summary at `/privacy` (what's collected: email, display name, role, wallet address, borrower context, loan/repayment records, support messages), and a fuller, more detailed policy at `/privacy-policy` (also mirrored as a static page) that additionally covers identity-verification data, financial/bank-linked data, and how data may be shared with verification, banking, and legal partners. If someone asks exactly what data Moodeng collects, the fuller `/privacy-policy` is the complete answer — the short `/privacy` page is a simplified summary of the same policy.
- **Data Deletion** (`/data-deletion`) — to delete your data, email **privacy@moodeng.credit** with the subject "Data deletion request" from the email on your account, including your account email or wallet address and which sign-in method you use. Verified requests are completed within about 30 days. Some records (financial/legal recordkeeping requirements, and anything already recorded on the blockchain) can't be deleted.

## Signing up and signing in

- **Sign up** (`/sign-up`) and **Sign in** (`/sign-in`) both support: **Google**, **Telegram**, **LINE**, and email + password. **Facebook sign-in is not live yet** ("coming soon"). Email passwords need to be at least 8 characters.
- **Forgot your password?** (`/forgot-password`) — Moodeng emails an **8-digit code** (not a magic link) to reset your password; enter it on the next screen, then choose a new password at `/reset-password`.
- Email confirmation also uses an 8-digit code sent by email, entered at the confirm-email screen.
- If an account is blocked, banned, or has an overdue loan, signing in leads to an account-support screen explaining why, with a way to message support (and, for an overdue loan, a direct **Repay Now** button).

## What this file does NOT cover

Admin-only screens and tools are intentionally left out of this knowledge base — they're not something a borrower or lender needs, and the bot should never describe them.
