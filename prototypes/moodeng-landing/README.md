# Moodeng Landing — prototype workshop

⚠️ **The live page moved to [`public/landing/index.html`](../../public/landing/index.html)** — it deploys with the app and is served at `moodeng.app/` via the root route in `vercel.json`. Iterate on THAT file. This directory keeps the plan, drafts, and tooling.

See [PLAN.md](PLAN.md) for the full design/copy direction (trust spine, rejected copy, moment-card spec, peso decisions).

## ✅ BUILT — Fruitful "01–04" step explainer + story shrinks to 3 beats (planned + confirmed + BUILT 2026-07-12, PR #619 merged)

**Status:** shipped exactly per the spec below (kept for reference). Verified at 375w: steps 01–04 with moved cards, Coins.ph caption truth-checked against the app's withdraw picker, compact checkmarks+CTA closer, 3-beat story pin with rail. ⚠️ One open check: the verification browser had Reduce Motion ON (George's Mac), so the staggered reveals + scrubbed rails render as the finished state there — eyeball the motion once on a non-RM device/phone after deploy.

**George's call:** the deal-panel ("How it works" white box under the sudden-expense phone) is "long and boring", and the 6-beat scroll story below is too long. Split the mechanism out of both: a **Fruitful-style numbered step explainer (01–04)** goes between the sudden-expense stage and the beat scroll, the **beat scroll shrinks to 3 claim beats**. Order on the page: hero → sudden-expense H2 + money-moment phone (coins slide-in stays) → **01–04 steps** → checkmarks + CTA → **3-beat scroll story** → demo video → …

**What Fruitful actually does there (autopsied from George's saved capture `~/Downloads/Fruitful - Your money, finally figured out.html`):** their 01–04 explainer is **normal document flow, NOT a pinned beat scroll** — each step is a full block (staged visual on top → grey `01` number → display headline → caption, with a green rail on the left that fills as the block crosses the viewport), revealed as you scroll. So it's our `.reveal` IntersectionObserver pattern — but a bare single-fade `.reveal` is exactly what "we tried before and it didn't work / felt cheap." What makes Fruitful's version feel alive (all three required):
1. **Staggered child reveals** — visual first, then number, then headline, then caption (per-child `transition-delay` ~0/.06/.14/.22s off one `.in` class), not one flat fade of the whole block.
2. **Scrubbed rail** — the left rail fill is tied to scroll progress (scaleY of a per-block `--sp` var, same cheap pattern as the coins' `--p` and the story rail's `--story-p`; one shared passive scroll listener, no rAF), NOT a one-shot animation.
3. **Big air** — generous vertical rhythm between blocks (~90–120px), display-size headlines. Fruitful's blocks breathe; cramped blocks kill the effect.

**The 4 steps and where their visuals come from (MOVE, don't copy — no card appears twice on the page):**
- **01 Ask** — visual = the existing money-moment phone + sliding coin stack (`#expenseStage`), which already sits right above; the "01" text block starts under it. No new visual.
- **02 Real people say yes** — visual = the funded card ("3 people said yes", avatars, Funded ✓) **moved out of story beat 1**.
- **03 Money arrives** — visual = the GCash cash-out card **moved from story beat 2** (keep `.phone.tall.compact`). Caption gains George's ask: lands ready for GCash — **or choose another way, like Coins.ph** (brand names in TEXT are fine; never third-party logos). ⚠️ Truth-check the provider list against the app's withdraw picker (`/withdraw-preview`) before naming names.
- **04 Repay & level up** — visual = the level-up/unlock card **moved from story beat 6** ($15 → new limit $20 → goal $60+). No new card needed.

**What's left of the scroll story (3 beats):** *You know everything before you borrow* ($18 magnifier, dark) → *No rollover* (due-date ledger) → *No fees from our side* ($0 tag). The pin gets ~3×68vh shorter, which roughly pays for the taller steps section. This also resolves the panel-vs-story redundancy question for good: **steps own the mechanism, story owns the promises.**

**Implementation notes for whoever builds it:**
- The deal-panel's `<ol class="steps">` is replaced by the step blocks; the `.deal-list` checkmarks ($18-before-confirm + USDC) and the CTA/reassure stay as the section closer (compact, after step 04).
- Moved cards keep their markup verbatim (`.stage`/`.stage-panel` anatomy); re-key their micro-animations from `.story-screen.is-active .…` to the step block's `.in` class (they originally ran on `reveal.in` before the story merge, so this is a return, not a rewrite). Beat 1's avatar pops/progress/funded-badge selectors and beat 6's lock/meter/chip selectors all need re-scoping; beat 2's coin-badge/arrow too. `unlockPop` now has opacity keyframes — keep it that way (elements gated at `opacity:0` need the animation to animate opacity).
- Story driver: `--beats` is set from the live screen count by JS, so shrinking = deleting the 3 beat `<div class="story-screen">`s + their 3 `<li>` titles. Delete the now-dead micro-anim CSS for moved beats or re-scope it with the cards. Beat-count invariant (5–6 max) is trivially satisfied at 3.
- Reveal/no-JS/reduced-motion conventions (house rules): default every `--sp` to 1 and gate initial-hidden states on a JS-added class, so no-JS and Reduce Motion render the finished state (George's Mac has Reduce Motion ON system-wide — never gate the mechanism on it, only soften motion).
- Peso hints on moved cards (`data-peso`) keep working — `paintPesos()` is global, runs once at load, position-independent.
- Verify: screenshot each step block at 375w; scroll the staggering; confirm the 3-beat story still pins/taps/rails correctly; hard-refresh moodeng.app after merge (deploys lag a couple minutes).

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

### 🔴 NEXT PASS — George's 2nd UX critique on the product-demo rebuild (2026-07-11, NOT yet applied)

George reviewed commit `1f71c7cef` and said the **information architecture is ~80% right — do NOT rearrange the page again.** The next pass is polish + sizing, not restructure. Verdict on the whole rebuild: hero headline is far clearer than "Lending to people. Simplified."; mission → available requests → process sequence is strong; the **defaulted-loan card is especially valuable** (showing a negative outcome makes the transparency claim believable); risk section + "One request. One person. Your decision." fit well.

**Biggest issue: everything is physically too small to read.** A lender shouldn't have to zoom in to read the numbers. Looks fine as a full-page screenshot, but the core product objects (hero request card, open-request cards, 4-step flow, borrower screenshot, completed-loan cards, risk copy, captions) are all too small. **Enlarge the core product objects ~30–50% and show FEWER things at once — one clear request card beats three miniatures.**

Specific changes, in George's order:

1. **Enlarge the hero request card — make it the centerpiece, not a decorative phone beside the headline.** The four values must be instantly readable: Needs · Expected back · Expected date · Approx. duration. Keep beneath it: *"Example request. Terms vary. Repayment is not guaranteed."* (Note: this slightly walks back the desktop side-by-side split — George wants the card to dominate, not sit secondary. Consider a bigger card, fewer competing elements.)
2. **Open-requests section — cards too small/dense.** Switch to either (a) one featured full request + partial previews of the next cards peeking, or (b) a horizontal mobile carousel with ONE full card visible at a time. Same hierarchy every card: Reason → Borrower identity/status → Needs / Expected back / Expected by / Duration / Record (e.g. "3 of 3 repaid") → "View request →".
3. **Change the "your choice" headline.** "There is no fixed investment plan" sounds alarming / makes the product sound undefined. Replace with **"Every request has its own clear terms."** Sub: "Amounts, expected paybacks, and repayment dates vary. You see the complete terms before deciding whether to fund." The 3 chips become: *Typical request size: currently $15–$40* / *Expected duration: often 2–4 weeks* / *Terms: shown before funding.* ⚠️ **Only use those ranges if they reflect CURRENT live requests — ideally generate from real marketplace data, don't hard-code a guess.**
4. **Add the missing 2nd half of the mission — "your loan helps twice."** The page explains replacing an expensive loan but not what happens AFTER repayment. Add to mission (this is one of Moodeng's most distinctive ideas, don't bury it): *"Your loan helps twice: it covers today's emergency, and a successful repayment becomes part of the borrower's credit record."* Ideally a two-part visual — **Today:** replace an expensive emergency loan. **Tomorrow:** help the borrower build a repayment record and stronger Credit Level. Links to [[trust-points-self-facing-only]] / credit-level system.
5. **Make the money mechanics explicit** — one plain sentence under "From request to repayment": *"Fund in USDC. When the borrower repays, the repayment returns directly to your wallet. The expected date varies by request and is not guaranteed."* Answers the unspoken lender questions (what currency? where does money go? where does repayment arrive? does Moodeng hold my money?) without making the page feel like a crypto exchange.
6. **Enlarge the borrower-record section.** The insights screenshot is too small to prove anything — make the phone **~2× larger**, with only FOUR annotations: Verified identity / Previous repayments / Current borrowing / Credit Level. Drop the scattered 8-item tiny checklist (it weakens the impact).
7. **Make completed-outcome cards more useful — show expected vs ACTUAL.** Every card: Amount funded / Expected back / Amount actually repaid / Expected duration / **Actual duration** / status (on-time, late, or defaulted). e.g. "Medicine before payday — Funded $15, Expected back $18, Expected 21 days, Actual 24 days, **Repaid three days late**." Directly answers "when does money actually come back?". ⚠️ Needs real per-loan actual-vs-expected timing data — currently we only have aggregate 94%-on-time; ask George for real late/default examples (the current defaults card is aggregate as a placeholder).

**One visual concern:** the "bold headline + one purple italic phrase" pattern is used in almost every section — starts to feel formulaic. **Keep it only for the strongest moments** ("A small loan can replace a much worse one.", "See more than a name and a promise.", "The expected date is not a guarantee.", "One request. One person. Your decision.") and use simpler headings elsewhere.

**George also noted:** "I liked this section u deleted in terms of graphically design" — attached the **dark 3-approach-cards** "WHY THIS EXISTS / The loans banks *won't make*" section (₱900 needed-before-payday / ~54%/week street rate / 94%-repay, each as a white stat-mini floating on a lavender/rose/mint gradient card). That was cut in the product-demo rebuild — **George wants that graphic treatment brought back** (either restored as its own section or its visual style reused elsewhere). Screenshot of it was in this message.

Summary of the next pass (George's words): larger product details · clearly explain variable amounts & repayment timing · show expected vs actual repayment duration · connect repayment to the borrower's future credit record · explain wallet-to-wallet money movement in one sentence · bring back the deleted dark-cards graphic style.

## UX-critique pass on `index.html` (2026-07-11)

Applied all 5 findings from George's external UX review (`~/Downloads/moodeng-ux-critique.pdf`, "Trust & Clarity — first-time borrower") to the live borrower page:

1. **Hero speed signal (Critical):** hero reassure line "Not instant. Not pushy. Not a trap." → *"Funded by real people, usually within a few hours — no bank review, no waiting on hold."* The final-CTA line was re-phrased to match ("A real person has to say yes — usually within a few hours"). ⚠️ **"usually within a few hours" is a factual claim George must verify against real funding times before this ships.**
2. **USDC disclosed on the loan card (Critical):** `.usdc-note` under Moment Card 1's foot — "Funds arrive as USDC — a digital dollar built to stay worth $1." + "What's USDC?" linking to `#faq-usdc` (JS opens the `<details>` on arrival). Was FAQ-only before. (Wording note: NOT "worth exactly/always $1" — that's the overclaim PR #603 removed; "built to stay worth" is the approved framing.)
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
