# Moodeng Landing Page — Build Plan (handoff doc)

Status (2026-07-05): design direction locked, **copy direction locked to the TRUST SPINE below**. Built so far in `index.html`: **hero (card-led v2), Q1 real-person (Moment Card 2 funded state), Q2 clear-terms (Tilt claim tiles), level-up (ladder + Moment Card 3)**. Still to build: dark safety section (Q3), testimonials, final CTA, pesos-in/out strip, zero-fees point.

**George's course-corrections while building (binding):**
- **Hero = card-led, show-don't-tell.** Compact text (label + headline + one line), Moment Card in the first viewport, CTA *below* the card (see terms → then the button; reverse of Tilt, that's our trust move). No SaaS text-stack heroes.
- **No naked text lists — every claim gets a staged visual.** Tilt tile anatomy: tinted panel → staged white stat-card inside → italic-accent headline below ("*No* rollover", mirroring Tilt's "*Yes* when you repay") → 2-line gray caption. The ✓-bullet version was rejected.
- **The page must demo the PRODUCT, not just argue trust** — Tilt shows its products doing things for you. Our one product has three powers, each gets its moment: borrow (hero card) / funded-by-people (Card 2: "3 people said yes", avatars, Funded ✓) / grows-with-you (ladder $15→$20→$40→$60+ + Card 3 level-up).
- **No hippos on the moment cards for now** — placement to be figured out later.

**Named drafts** are frozen in `drafts/` and cataloged in `README.md` — every version George explicitly likes gets snapshotted there so we never lose it. First one: `drafts/tilt-cards-v1__first-draft-idea.html` ("First draft idea on Tilt cards"). `index.html` is the moving/working version.

## Concept

**The vibe test (George): a Filipino visitor should instantly think "this looks like a Southeast Asian fintech" (MAKE/GCash/Maya-familiar: friendly mascot, soft sky colors, rounded cards, approachable) — but with a Gen-Z edge from Tilt (huge confident type, italic-serif accent words, dark sections, bold attitude).** SEA-fintech is the first impression; Tilt is the seasoning, not the base.

"Tilt's skeleton and voice, MAKE by KBank's skin and weather, Moodeng's cast of characters."

- **Tilt** (tilt.com, saved in `~/Downloads/Cash Advances & Credit Cards—Powered by Your Potential _ Tilt.html` + `_files/`): section structure, huge bold display type with italic-serif accent words, alternating light/dark sections, small-caps label above headlines, pill CTA buttons, stacked ❌/✔ checklists, and the "moment cards" pattern (see below).
- **MAKE by KBank** (saved in `~/Downloads/MAKE by KBank...html` + `_files/`, desktop + mobile versions): soft sky gradient world, parallax cloud SVGs, floating bobbing mascot on clouds, pastel rounded pocket-cards with amounts, star-rating + quote carousel.
- **Moodeng**: hippo mascots as the stars (NOT phone screenshots), lavender palette replaces Tilt's chartreuse and MAKE's teal.

## THE ORGANIZING PRINCIPLE (George, 2026-07-05 — this overrides everything)

The page is NOT a product tour. It exists to answer one question a scared borrower asks:
**"If I borrow from you, will I regret it?"**

Context: the target user is a Filipino with an EMERGENCY cash need (medicine, tuition, gap until sahod/payday) who has been burned or scared by predatory loan apps (contact scraping, harassment, fees that balloon overnight). The page revolves around: **emergency needs → a community that actually cares → dignity/trust.** Every section is an answer to a trust question, in the order a scared person asks them.

## Copy history — what was REJECTED and why (do not regress)

1. ❌ Polished FigJam V3 copy ("Borrow small. Build trust. Unlock your future.", "Safety isn't a feature. It's the foundation.", "The World's First Level-Up Borrowing System", "reimagine", "here's what you can do") — George: sounds AI-generated, same as what the designers produced (their Figma landing design at figma.com/design/JmL5RnaELclTSnkkVaZvhC node 2634:11168 uses this copy — do NOT copy it). Tells to avoid: rule-of-three slogans, "X isn't a feature it's Y" inversions, "world's first" claims, "real people, not apps" X-not-Y constructions.
2. ❌ Ultra-simple feature copy ("Start with $15. Sent straight to your wallet.") — too mechanical, and "connect your wallet" is OUR plumbing, not the user's action. Never say "connect wallet" / "wallet" in copy.
3. ❌ Verb-first YC-style product-journey copy ("Ask for what you need / Get funded by real people / Repay and grow") — better but still mechanism-focused; George: describes the machine, not the trust.
4. ✅ What stuck: **the trust spine** (below). Write simply (MAKE/Tilt simplicity: headline ≤ 6 words, subline = one plain fact), but every section answers a trust question. Use Emma's phrasing where possible — her lines tested well ("Not instant. Not pushy. Not a trap.", the $15→$18 medicine example).

## Section map — THE TRUST SPINE (borrower-only)

Each section = one trust question, answered:

1. **Hero — meet them in the emergency, no shame.**
   H1: "Sudden expense? There are people who want to help."
   Sub: Borrow small — from $15 — for the moment you can't wait for payday. You'll know exactly what you'll repay, and when, before you say yes.
   CTA pill; directly under it, small: "Not instant. Not pushy. Not a trap." (Emma's line)
   Visual: sky gradient + parallax clouds + `welcome.png` hippo on a cloud + Moment Card 1.
2. **Trust Q1: "WHO is giving me this money?"**
   "Your loan comes from a real person." Not a company. Not an algorithm. A real person read your request and chose to help. (KAPWA section — `community.png`.) Visual: Moment Card 2 (funded state).
3. **Trust Q2: "Will the price change on me?"**
   "You know everything before you borrow." Show Moment Card 1 large: Medicine · Borrow $15 → Get back $18 · Due Jul 30. "That number never changes. No rollover. No penalty that appears overnight."
4. **Trust Q3: "What will you do to me if things go wrong?" (DARK section)**
   "We treat you like a person." We never call your contacts. We never sell your information. We never shame you. `hippo-friendly-lock`. Dark cloud silhouettes. Includes the verification reassurance: you prove you're one real person once (nothing about you stored) — that's why funders trust you fast.
5. **Trust Q4: "What's in it for me long-term?" (Level-Up = what you can ACHIEVE)**
   "Today it's $15. Next time you're covered for more." Every on-time repayment raises your limit — ascending MAKE-style cloud-pocket cards $15 → $20 → $40 → $60+, `borrower-insights-trophy`. Visual: Moment Card 3. (Product really has credit levels — see `src/views/support/HowCreditLevelsWork.tsx`.)
6. **Trust Q5: "Says who?" — testimonials.**
   "People like you, who've done it." MAKE-style quote carousel; realistic examples in Emma's format ("Short-term medical expense. Borrowed $15, repaid $18 in two weeks. No surprises."). Filipinos trust word of mouth over ads. OPEN QUESTION for George: real testimonials or illustrative (if illustrative, label honestly).
7. **Final CTA**
   "Next time you're short, you have somewhere to turn." / "Start with your first small loan." + `party.png` + logo. Balloons drift up.

(The old comparison-table section is folded into Q2/Q3 as short ✕ lines; don't resurrect it as a table unless George asks.)

## The "Moment Cards" system (agreed 2026-07-05)

Tilt's phone cards are NOT screenshots — they're staged, simplified recreations of app moments (3–4 elements, giant type, no nav clutter) inside rounded colored panels. We do the same, based on the REAL request-board card (`src/views/dashboard/components/UserCard.tsx`, fields: reason, Borrowing USDC, Get back USDC, Due On, Good Standing, Funded).

**LOCKED ANATOMY (George approved a rendered preview, 2026-07-05): use Tilt's full PHONE-FRAME treatment, not a flat card.** Recipe per card:
textured lavender panel (painterly grain over #C9A8F5-ish, like Tilt's brushstroke chartreuse) → white rounded phone frame, slightly rotated → app header (back arrow + spaced-caps title e.g. "YOUR LOAN") → hippo PNG overlapping the top edge of a tinted inner card (#F7F0FE) where Tilt puts the 3D coins → giant statement + amount in a bright lavender pill (ours: **"Real people can fund you" [$15]** — subject is PEOPLE, not algorithm eligibility) → stacked option pills ($15 selected w/ lavender border, $10, $5) → black pill CTA "CONTINUE WITH $15" → and the Moodeng twist Tilt doesn't have: terms line under the CTA, **"You'd give back $18 on Jul 30 — shown before you confirm."** (Tilt hides terms behind the button; we put them on the marketing card — that's the trust pitch.)

- **Moment 1 — clear terms** (hero + section 3): 🏥 Medicine · Borrow **$15** → Get back **$18** · Due **Jul 30**.
- **Moment 2 — funded by real people** (section 2): same card, progress bar full, "Funded ✓", three small avatars.
- **Moment 3 — level up** (section 5): 🔓 "You've leveled up!" $15 ▸ **$20**, progress bar toward $60 (homage to Tilt's line-increase card).

Build as hand-coded HTML/CSS with DESIGN.md tokens (zero-weight, crisp, editable) and style them to match the real in-app request card, so the app's first screen looks like what the landing promised (promise-kept = trust signal).

## Rules (Emma's FigJam feedback + repo memory — still binding)

- ZERO jargon: no "stablecoin", "borderless", "on-chain", "World ID", "KYC", "wallet", "crypto", "USDC" in copy (product may show USDC; landing says "$"). Avoid the word "lending" ("too scammy") — say "real people fund you".
- Headline ≤ ~6 words; subline = one plain fact. Stack "No X" lines vertically.
- Playful, not corporate. KAPWA = borrowing as a relationship, not a trap.
- **Low bandwidth** (PH users): decorations SVG/CSS only, hippos the only PNGs, no video, no heavy JS. Scroll effects = CSS + small IntersectionObserver.
- **BORROWERS ONLY.** No lender section, no yield pitch anywhere (board's lender content = separate future page).
- One palette: Moodeng lavender (`#F3E8FF` bg → `#c8a6f8` → white; primary `#8336F0`, deep `#6010D2`, heading `#040033` — full tokens in `DESIGN.md`). Dark section = near-black with dark cloud silhouettes, same world.
- PRODUCT.md bans: crypto-terminal look, payday-shark look, neon Web3, glassmorphism, gradient orbs, generic SaaS hero. Also mobile-first, strong contrast, large tap targets.

## Sources

- FigJam content board (raw material, NOT copy source anymore): figma.com/board/2eAdonDKOrOpc0R3b4eKBf — Emma's stickies are the valuable part.
- Designers' Figma landing design (visual reference only, copy rejected): figma.com/design/JmL5RnaELclTSnkkVaZvhC node 2634:11168.
- Saved reference sites in `~/Downloads/` (Tilt + MAKE desktop & mobile, complete with assets).

## What exists already

- `prototypes/moodeng-landing/assets/` — hippos (12 PNGs), `clouds/` (cloud-1/2/3, cloud, paperplane SVGs from MAKE), `brand/` (moodeng logos).
- More hippos in repo `public/hippos/`; icons in `public/icons/`.
- Sibling prototype `prototypes/withdrawal-flow/` shows the repo prototype convention (Vite+React+Tailwind4), but this landing can be a single self-contained `index.html` for lightness — that was the working intent.
- Font subs for Tilt's (ABC Gravity/Suisse/EmpowerSerif): condensed black display (e.g. Archivo Black) + system sans + serif italic accent, or system stack for zero-load. Tilt chartreuse #e4e24e NOT used.

## Peso context (George, 2026-07-05 — DECIDED, build it)

1. **Show ₱ equivalents next to $ amounts.** Loans are in USDC/$ but the page should geo-detect (IP check — e.g. a free geo API or CDN country header; graceful fallback to $-only) and show approximate peso values: "$15 ≈ ₱850" style hints on the moment cards and amount mentions. Approximate is fine — label it "≈" so it's honest. Static fallback rate baked in if the lookup fails; never block render on it.
2. **Add a copy moment about moving money to pesos and back.** Somewhere on the page (likely inside "How it works" get-the-money step, or its own small strip) say plainly that it's easy to turn the loan into pesos and back when repaying — jargon-free, no exchange/crypto words. Real cash-out rails exist (GCash via Coins.ph etc. — see repo memory withdrawal-offramp-options); don't overpromise "instant", just "easy". Copy TBD with George.

## Open questions for George

1. Testimonials: real or illustrative (label honestly if illustrative)?
2. Where does the CTA link — app signup URL?

## Verify

Serve `prototypes/moodeng-landing/` (vite or `python3 -m http.server`), screenshot every section after changes (George always wants visual proof), test at 375px mobile — mobile-first for PH audience.
