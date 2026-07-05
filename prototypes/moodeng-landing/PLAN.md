# Moodeng Landing Page — Build Plan (handoff doc)

## NEXT UP (George approved, 2026-07-05 afternoon — build in this order)

1. **Footer (missing entirely — biggest credibility gap).** MAKE-style honest footer: company identity, contact channels a human answers (Facebook page, Telegram/email — George: "our team is talkable, very responsive"), privacy policy + terms links. No footer = scam signal to loan-app-burned Filipinos.
2. **SEC registration line in footer — ONLY IF TRUE.** PH users are trained by the SEC's anti-predatory-app campaigns to check registration. Slot goes in the footer as an HTML comment placeholder; George must verify whether Moodeng has PH registration/legal entity before any claim ships. NEVER fabricate this.
3. **Team-face strip.** Small "built by a real team — message us, a human answers" moment; anonymous fintech = loan-shark pattern. Optionally real faces later.
4. **Section hippos (the spine always specced them; only party.png is placed).** community.png → real-people section; hippo-friendly-lock → dark section; borrower-insights-trophy → ladder; hero hippo-on-cloud waits for George's hero. Cards stay hippo-free (George's rule) — these are SECTION-level mascots.

Also open (not in this batch): swap proof-section videos → MAKE-style picture quote cards (George leaning yes, not confirmed); upgrade peso strip → full "cash out to GCash" moment card (agreed strongest 4th card, not scheduled); real quotes into proof section; peso-strip + $0-fees copy strawmen need George's sign-off; CTA links still `#`; dark-section bubble copy is APPROVED (matches George's "we'll figure it out" instinct — keep, don't promise late repayment is OK).

Status (2026-07-05): design direction locked, **copy direction locked to the TRUST SPINE below**. Built so far in `index.html`: **hero (card-led v2), Q1 real-person (Moment Card 2 funded state), Q2 clear-terms (Tilt claim tiles), level-up (ladder + Moment Card 3)**. Still to build: dark safety section (Q3), testimonials, final CTA, pesos-in/out strip, zero-fees point.

**George's course-corrections while building (binding):**
- **The current top block is NOT the hero (George, 2026-07-05).** George has his own ideas for the hero — slot stays open. The card-led "Sudden expense?" block is the FIRST BELOW-HERO section (like Tilt: hero is its own thing, the product phone-card sections come after). Don't design a hero without George; build the below-hero area first. Within that area the rules hold: show-don't-tell, compact text, CTA below the card.
- **No naked text lists — every claim gets a staged visual.** Tilt tile anatomy: tinted panel → staged white stat-card inside → italic-accent headline below ("*No* rollover", mirroring Tilt's "*Yes* when you repay") → 2-line gray caption. The ✓-bullet version was rejected.
- **The page must demo the PRODUCT, not just argue trust** — Tilt shows its products doing things for you. Our one product has three powers, each gets its moment: borrow (hero card) / funded-by-people (Card 2: "3 people said yes", avatars, Funded ✓) / grows-with-you (ladder $15→$20→$40→$60+ + Card 3 level-up).
- **No hippos on the moment cards for now** — placement to be figured out later.
- **No emojis as icons — George is making real 3D assets.** Emojis on the cards/tiles read amateurish. A 13-slot asset list was agreed (see "Asset list" below); George generates them Tilt-style (3D clay/toy, transparent PNG) and they get swapped into the already-built slots.
- **Unlock section placement (George decided):** "You've unlocked your next level" card sits DIRECTLY BELOW the first card block ("Real people can fund you"), as product moment #2 — consistent with the moment-card family but deliberately different weather (upright centered phone in an airy MAKE-sky panel with clouds, vs Card 1's tilted phone on flat lavender). Down-page level-up section keeps ONLY the ladder (Card 3 was removed as duplicate).
- **Cards must be text-light like Tilt's (George, after comparing side-by-side):** Tilt's unlock card is ~80% whitespace — one object, one short statement, a quiet meter in a soft gray group-box, one spaced-caps button ("ACCEPT OFFER"). Section text lives ABOVE the card, never inside it. Our first unlock version was rejected as "amateurish, too much text": no tinted inner sub-card, no chatty button copy, no caption line inside the phone. Current index.html has the corrected version (statement + meter-box w/ overlapping +$5 chip + "ACCEPT NEW LIMIT" caps pill); **not yet visually verified** — next session: screenshot it first.
- Tilt build detail worth copying (from George's devtools screenshot): their panel texture is a `textured-bg.webp` background-image over a flat chartreuse div, `rounded-3xl`, phone constrained to a max-width inside — i.e. texture is an IMAGE overlay, not CSS-generated.

**Proof section (Trust Q5) — BUILT AS A MOCK (2026-07-05, George: "ignore reality, show the objective"):** sits between the ladder and final CTA. MAKE-style: centered header → 5 gold stars → "4.8 from borrowers / rated after they repaid — on our Facebook page" → 3 white stat pills (1,200+ loans · 96% on time · ₱2.1M+) → scroll-snap quote carousel (navy/white alternating, receipt-style quotes, initial-circle avatars) → 2 REAL borrower video testimonials (YouTube Shorts `2ZmuK7Vq40k`, `t8dnE2h4mNk`, from `src/views/borrowerBenefits/sections/WhatPeopleSaySection.tsx`) as tap-to-play poster cards. ⚠️ **The rating, all 3 stats, and all 4 text quotes are ASPIRATIONAL PLACEHOLDERS — do not ship until each is real.** The honest path to the real versions: (1) in-app "rate us" prompt after successful repayment → Facebook page reviews (verifiable, PH-native platform; we're a web app so App Store stars are impossible); (2) stat pills from real DB counts, small-but-true beats big-and-vague; (3) text quotes from the other real testimonials George says exist (not yet collected into the repo).

## Asset list — 3D icons George is making (Tilt-style: clay/toy render, ¾ view, top-left light, transparent PNG ~800px, lavender #8336F0/#C9A8F5 + gold for money)

Priority: **#1 coins, #6 closed padlock, #12 open padlock** carry the page; then 5, 7, 9; rest garnish.

1. Moment Card 1, overlapping tinted card's top edge (where Tilt puts coins): **stack of 3–4 gold coins, slightly toppled**
2. Moment Card 1 reason row (replaces 🏥): **small first-aid kit / medicine bottle, white + lavender cross**
3. Real-people avatars (optional; CSS circles OK): 3 head-blobs, different colors
4. Real-people funded state: **3D green checkmark badge**
5. Peso strip: **two coins side by side — $ coin and ₱ coin, gold**
6. "No rollover" tile (replaces 🔒): **closed padlock, lavender** — hero asset of tiles section
7. "No overnight penalty" tile (replaces 🌙/☀️): **small crescent moon + sun pair**
8. "No fine print" dark tile (optional): **receipt/paper scroll with one line, floating**
9. "$0 fees" tile: **blank price tag** (or tag being cut)
10. Dark "never call contacts": **phone lying face-down, peaceful**
11. Dark "not for sale": **folder/box with shield, lavender on dark**
12. Unlock card (replaces inline SVG placeholder): **OPEN padlock, shackle popped — same design as #6 but open** (locked terms / unlocked credit visual rhyme)
13. Ladder top $60+ rung (optional): **small trophy or flag**

Drop finished assets in `~/Downloads`, they get copied into `assets/` and swapped into the built slots.

**Asset placement rules (MEASURED from Tilt's saved source assets, 2026-07-05 — George twice rejected bigger sizing, so these are exact):** measured `earned-higher-offer.webp`, `cash-advance-eligible.webp`, `demo-line-of-credit.webp` in `~/Downloads/...Tilt_files/`. The invariant is **object HEIGHT ≈ 28% of the width of the card it decorates** (so tall objects like the lock end up only ~18% of card width; wide objects like coins may reach ~33%). Position: **dead-centered on the card's top edge, ~55% floating above / 45% dipping on**, with a clear gap ≈5% of card width before the first text (add card `padding-top` when it has a label). In-phone hero objects (unlock lock) run slightly bigger: ~20% of phone width. First pass at 35–40% width and second at 20–25% were both too big — don't regress. Delivered assets so far (5): `assets/icons/` lock-closed, lock-open, moon-sun, price-tag, usd-php-coins — George's exports had the checkerboard baked in as pixels; backgrounds were stripped via edge flood-fill (bg = near-gray + light, flood from borders) and files trimmed/resized to ≤480px (~100KB each). Still missing: #1 gold coin stack (Moment Card 1 hero object) and #2 medicine kit (🏥 emoji still on both reason rows).

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
