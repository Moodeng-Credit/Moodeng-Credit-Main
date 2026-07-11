# Moodeng Landing — prototype workshop

⚠️ **The live page moved to [`public/landing/index.html`](../../public/landing/index.html)** — it deploys with the app and is served at `moodeng.app/` via the root route in `vercel.json`. Iterate on THAT file. This directory keeps the plan, drafts, and tooling.

See [PLAN.md](PLAN.md) for the full design/copy direction (trust spine, rejected copy, moment-card spec, peso decisions).

## ⏭️ NEXT STEPS — /for-lenders Percent-style rebuild (handoff, 2026-07-11)

**State right now:** [`public/landing/for-lenders.html`](../../public/landing/for-lenders.html) was fully rebuilt (2026-07-11, commit `1f71c7cef`) to **George's own outline — the page demonstrates the product instead of pitching it**. Lives on PR **#603** (`feat/landing-honest-proof-lender-page`), **unmerged**. Preview: `https://moodeng-credit-main-git-feat-landin-d5f15e-snak2etechs-projects.vercel.app/for-lenders` — verified at mobile + 1280px (all sections, rotator, count-ups, step screenshots).

Structure (11 sections): **Klarna hero** ("Small loans. Clear terms. *Real people.*" — clip-path panel reveal + word-stagger h1, and a **complete rotating request card** as the device: Ana $20→$22, Joel $10→$12, Maria $5→$10, 5s crossfade, NOTHING cropped, "Terms vary / not guaranteed" on the card itself) → **mission** ("A small loan can replace a much worse one" + payback chart + "another option *before the loan shark*" + count-up stats) → **open requests** (Percent-style consistent sample cards, Needs/Expected back/Duration/Record) → **how it works** (4 steps with real app screenshots: step2-board-cards / lender-insights / lender-board / repay-slider) → **your choice** (dark; "There is no fixed investment plan", 3 vary-chips) → **the record** (insights screenshot + 8-item record checklist) → **recorded outcomes** (real repaid loans + a dark "Not every loan comes back" defaults card) → **borrower videos** → **risk** (two columns: what you know vs what can still happen; "Expected back is the borrower's agreed amount, not a promise from Moodeng") → **FAQ** → **final CTA** ("One request. One person. Your decision."). Cut: honesty quiz, thesis cards, feature rows, 01–04 education, 67.8M panel.

Language rules baked in: every figure is **"expected", never promised**; never "invest $15 and get $18 back"; card terms come from **real funded requests** (names changed, dates illustrative — labeled on-page and in the footer); no APY/pool/vault language. Rotator + hero animations respect `prefers-reduced-motion` (static first card).

**To do, in order:**

1. **George confirms the public figures** (blocking merge): 102 verified borrowers · 94% repaid on time · 2.2x referrals · $2,030 lent, "as of July 2026". Also: are the real loan reasons OK to show verbatim on a public page ("Emergency medicine for my lil sister" $5→$10, "Family expenses in the Philippines" $20→$22, "My car broke down" $10→$12, allowance $20→$25, dental $15→$30)? They're from the public loans feed (already public by design) but this is louder placement.
2. **Louis reviews the FAQ answers** — his questions (track record, what do I earn, what happens on non-repayment, timing) are answered in the FAQ + numbers sections; sanity-check the answers match reality.
3. **Merge PR #603** once 1–2 are confirmed. It also carries the earlier honest-proof section + lender-page assets commits.
4. **Post-merge follow-ups** (nice-to-have, separate PRs):
   - Recent-loans section could pull live from the public loans feed instead of hard-coded cards (feed is public by design — George's call, don't re-flag).
   - Mobile was verified; do a desktop-width pass too (chart bar labels were the one collision found + fixed at mobile width).
   - Stats need a refresh cadence — they're hard-coded with a date stamp; bump them when the date stamp goes stale.
   - Consider porting Percent patterns (date-stamped numbers, disclosure lines under every figure) back to the main landing `index.html`.

Rules that bind this page: truth-only figures (no invented stats), no insider language (no "KYC"/"Didit"/"liveness" in user copy), stars/Facebook rating don't exist yet — don't add them. The 12–18% APY story stays in the deck, never on the page.

## UX-critique pass on `index.html` (2026-07-11)

Applied all 5 findings from George's external UX review (`~/Downloads/moodeng-ux-critique.pdf`, "Trust & Clarity — first-time borrower") to the live borrower page:

1. **Hero speed signal (Critical):** hero reassure line "Not instant. Not pushy. Not a trap." → *"Funded by real people, usually within a few hours — no bank review, no waiting on hold."* The final-CTA line was re-phrased to match ("A real person has to say yes — usually within a few hours"). ⚠️ **"usually within a few hours" is a factual claim George must verify against real funding times before this ships.**
2. **USDC disclosed on the loan card (Critical):** `.usdc-note` under Moment Card 1's foot — "Funds arrive as USDC, a digital dollar worth exactly $1." + "What's USDC?" linking to `#faq-usdc` (JS opens the `<details>` on arrival). Was FAQ-only before.
3. **Mechanism steps (High):** `.steps` 3-card strip (Ask → Real people say yes → Money arrives) between Moment Card 1 and its CTA — the "real person" claim is now demonstrated, not asserted.
4. **Verification named (Medium):** verify-note now says *"one quick ID check… Funders see the ✓, never your documents"* — replaces the vaguer "nothing about you is stored" (which was also an overclaim). NOT "World ID" — Emma's zero-jargon rule bans it in landing copy.
5. **CTA commitment preview (Medium):** `.cta-note` "Takes about 2 minutes · no paperwork" under the hero CTA and the final CTA.

## How to run

Static, no build step:

```bash
python3 -m http.server 4322 --directory public   # from repo root
# then open http://localhost:4322/landing/
```

(The `landing-prototype` config in `.claude/launch.json` does the same for the preview panel. The page is also visible on the app dev server at `localhost:3000/landing/index.html`.)

- `../../public/landing/index.html` — the **working / current** version. This is what gets iterated on.
- `../../public/landing/assets/` — hippos, clouds, brand logos, icons, hero video, tips cards.

## Named drafts (so we never lose a version we liked)

Every version George explicitly likes gets frozen here as a dated snapshot, so "I liked it — do you still have the code?" always has an answer. `index.html` keeps moving; these don't.

| Name | File | Date | What it is |
|------|------|------|------------|
| **First draft idea on Tilt cards** | [drafts/tilt-cards-v1__first-draft-idea.html](drafts/tilt-cards-v1__first-draft-idea.html) | 2026-07-05 | First taste test George approved. Hero (trust-spine H1, drifting clouds, black pill CTA, "Not instant. Not pushy. Not a trap.") + **Moment Card 1** in the locked phone-frame anatomy (textured lavender panel → rotated white phone → `thinking.png` hippo peeking → "Real people can fund you $15" → Get back/Due chips w/ `≈ ₱` peso hint → black "Continue with $15" → terms-before-confirm line) + **Trust Q2 "Clear terms"** section (✓ No rollover / No overnight penalty / No fine print). Peso hints geo-gated (hide for non-PH), fallback rate ₱57/$. Display font = Archivo Black stand-in. Only 2 of 7 sections — the taste test, not the full page. |

To view a frozen draft: open its file directly, or serve it — `python3 -m http.server 4322 --directory .` then visit `/drafts/<file>`.
