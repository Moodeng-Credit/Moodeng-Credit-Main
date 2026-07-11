# Moodeng Landing — prototype workshop

⚠️ **The live page moved to [`public/landing/index.html`](../../public/landing/index.html)** — it deploys with the app and is served at `moodeng.app/` via the root route in `vercel.json`. Iterate on THAT file. This directory keeps the plan, drafts, and tooling.

See [PLAN.md](PLAN.md) for the full design/copy direction (trust spine, rejected copy, moment-card spec, peso decisions).

## ⏭️ NEXT STEPS — /for-lenders Percent-style rebuild (handoff, 2026-07-11)

**State right now:** [`public/landing/for-lenders.html`](../../public/landing/for-lenders.html) was fully rebuilt on percent.com's information architecture (their IA + component vocabulary, our brand/Tilt skin). Lives on PR **#603** (`feat/landing-honest-proof-lender-page`, commit `faa46321c`), **unmerged**. Preview: `https://moodeng-credit-main-git-feat-landin-d5f15e-snak2etechs-projects.vercel.app/for-lenders` — verified rendering (all 11 sections, count-ups, quiz logic, images).

What the page is: hero ("Lending to people. Simplified." + 3 value bullets + "How risk works ↓") → payback-comparison chart ($18 Moodeng vs ~$21+ loan-app vs ~$33 street at 54%/wk, with source line) → count-up proof chips stamped "as of July 2026" → "What is payday-gap lending?" 01–04 explainer → real repaid-loan cards pulled from the production loans table (reasons verbatim) → honesty-gate quiz ("Could you lose $15 without it changing your week?") → 6 feature rows → borrower-insights phone frame → dark risk disclosures at `#risk` → Louis FAQ → CTA. Deliberate omission: **no APY/pool/vault language anywhere** — per-loan flat numbers only.

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
