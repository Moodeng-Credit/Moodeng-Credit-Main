# Moodeng Landing Page — Build Plan (handoff doc)

Status: content + design direction agreed with George; assets copied; **build not started yet**.
Next step: build hero + one content section as a taste test, screenshot it, iterate, then fill in all nine sections.

## Concept

**The vibe test (George, 2026-07-05): a Filipino visitor should instantly think "this looks like a Southeast Asian fintech" (MAKE/GCash/Maya-familiar: friendly mascot, soft sky colors, rounded cards, approachable) — but with a Gen-Z edge from Tilt (huge confident type, italic-serif accent words, dark sections, bold attitude).** SEA-fintech is the first impression; Tilt is the seasoning, not the base.

"Tilt's skeleton and voice, MAKE by KBank's skin and weather, Moodeng's cast of characters."

- **Tilt** (tilt.com, saved in `~/Downloads/Cash Advances & Credit Cards—Powered by Your Potential _ Tilt.html` + `_files/`): section structure, huge bold display type with italic-serif accent words, alternating light/dark sections, small-caps label above headlines, pill CTA buttons, stacked ❌/✔ checklists, app-moment mockup chips.
- **MAKE by KBank** (saved in `~/Downloads/MAKE by KBank...html` + `_files/`, desktop + mobile versions): soft sky gradient world, parallax cloud SVGs, floating bobbing mascot on clouds, pastel rounded pocket-cards with amounts, star-rating + quote carousel.
- **Moodeng**: hippo mascots as the stars (NOT phone screenshots), lavender palette replaces Tilt's chartreuse and MAKE's teal.

## Rules (from Emma's FigJam feedback + repo memory)

- Copy source of truth: **Version 3** on the FigJam board "Landing Page Content References"
  (figma.com/board/2eAdonDKOrOpc0R3b4eKBf, sections at x≈416: HERO / OUR SERVICES / OUR APPROACH / OUR MISSION / VALUE PROP / HOW IT WORKS / SOCIAL PROOF / SECURITY & TRUST / LENDERS' TRUST / FINAL CTA).
- Short copy; stack the "No X" lines vertically.
- ZERO jargon in user copy: no "stablecoin", "borderless", "on-chain", "World ID", "KYC" in headlines. Say "verify you're a real person". Avoid the word "lending" where possible ("too scammy") — prefer "real people fund you".
- Playful, not corporate. Filipino audience; KAPWA = borrowing as a relationship, not a trap.
- **Low bandwidth** (PH users): decorations are SVG/CSS only, hippos are the only PNGs, no video, no heavy JS libs. Scroll effects = CSS + small IntersectionObserver.
- **This page is for BORROWERS ONLY** (George, 2026-07-05). No lender section — the FigJam board's lender content (LENDERS' TRUST, "Earn yield...", governance tokens) is for a separate future page. Don't mention earning yield anywhere on this page.
- One palette: Moodeng lavender (`#F3E8FF` bg → `#c8a6f8` → white; primary `#8336F0`, deep `#6010D2`, heading `#040033` — full tokens in repo `DESIGN.md`). Dark sections use near-black with cloud silhouettes so it stays in the same world.

## Section map (8 sections — borrower-only)

1. **Hero** — sky gradient + parallax clouds + `welcome.png` hippo bobbing on a cloud. H1 "Get a fair, stress-free loan." Stacked: No hidden fees / No rollovers / No data theft. Sub: "Just real lenders helping real people." CTA pill APPLY LOAN NOW. Trust strip: "Not instant. Not pushy. Not a trap."
2. **Here's what you can do** — Tilt-style 3 cards: Borrow Small From Real People (from $15) / You Set Your Own Terms / Your History Is YOURS. Hippos: `thumb-up-right`, `hippo-debit-card`, `journal-hippo` (journal one is in `public/hippos/`, not yet copied). Tag: "Real lenders. Fair terms. Zero traps."
3. **Level-Up system** — "The World's First 'Level-Up' Borrowing System": ascending MAKE-style cloud-pocket cards $15 → $20 → $40 → $60+, `borrower-insights-trophy` at top. "Repay. Level Up. Repeat."
4. **Why we're different** — comparison table Local Loans (✗ collateral, rolling fees, surprise charges, company owns your history) vs Moodeng (✓ global funders in $, no collateral, fair rates, no hidden fees, you own your history). `thinking.png`.
5. **How it works** — 4 numbered steps: Verify you're a real person → Connect your wallet → Post your loan request (amount, interest, payback date) → Repay & level up. `hippo-with-id-card`. App-moment chips (e.g. "You leveled up: $15 → $20") drawn as styled divs, Tilt-mockup style.
6. **Safety is the foundation** (DARK section) — "Safety isn't a feature. It's the foundation." ✔ verified real humans (one person = one account, biometric converted to non-reversible code, raw biometrics never stored) ✔ stay anonymous ✔ no harassment / contact scraping ✔ no data selling, ever ✔ your history belongs to you. `hippo-friendly-lock`. Dark cloud silhouettes.
7. **Testimonials** — MAKE-style quote carousel, realistic examples: "Short-term medical expense. Borrow $15 → repay $18 within 14–21 days. Clear expectations = peace of mind." Verified-human check badges. The "real people fund you" trust angle can live here (community.png) — framed as who's behind your loan, NOT as a pitch to become a lender.
8. **Final CTA** — "Start your first $15 loan today." / "Borrow small. Build trust. Unlock your future." GET STARTED NOW + `party.png` + logo. Balloons drift up.

## What exists already

- `prototypes/moodeng-landing/assets/` — hippos (12 PNGs), `clouds/` (cloud-1/2/3, cloud, paperplane SVGs from MAKE), `brand/` (moodeng logos).
- More hippos available in repo `public/hippos/`; icons in `public/icons/`.
- Sibling prototype `prototypes/withdrawal-flow/` shows the repo's prototype convention (Vite+React+Tailwind4), but this landing can be a single self-contained `index.html` for lightness — that was the working intent.
- Reference design tokens: Tilt fonts = ABC Gravity condensed / Suisse Intl / EmpowerSerif italic (we substitute: Archivo Black or similar condensed + system sans + serif italic via Google Fonts, or system stack for zero-load). Tilt chartreuse #e4e24e NOT used. MAKE font = IBM Plex Thai (not needed, EN copy).

## Verify

Serve `prototypes/moodeng-landing/` (e.g. vite or `python3 -m http.server`), screenshot every section after changes (George always wants visual proof), test at 375px mobile — mobile-first matters for PH audience.
