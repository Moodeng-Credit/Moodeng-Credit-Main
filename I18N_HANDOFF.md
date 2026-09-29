# Moodeng translation work: full summary and handoff

This is the complete record of the language work for Filipino (`fil`), Indonesian (`id`), Thai (`th`) and Vietnamese (`vi`). It also covers one open design question (the country used for money moves, "money country") to decide later. Use it to pick the work up from any account or chat.

## Where everything is

| What                                                                           | Where                                                         | State                                            |
| ------------------------------------------------------------------------------ | ------------------------------------------------------------- | ------------------------------------------------ |
| All translation and copy fixes                                                 | PR **#981**, branch `claude/i18n-fix-all` → `staging`         | Open, **not merged** (owner wants PRs only)      |
| Language picker in onboarding, header language menu, location-based suggestion | PR **#987**, branch `claude/i18n-language-choice` → `staging` | Open, **not merged**                             |
| This document, glossaries, audit reports, scripts                              | `docs/i18n-handoff/` on the #981 branch                       | Working material. **Delete before merging #981** |

**Owner's rules for this work:**

- Change language only. Never remove or alter technical things: KYC / ID verification (Didit, World ID), routes, logic, config or features.
- Open PRs, but don't merge until the owner says so.
- Local exchanges per country are parked (see the design question below).

---

## 1. How translation works in this app

The page's text is translated in three layers. A fourth piece, code-built sentences, is new in #981.

1. **Keyed strings:** `src/i18n/translations.ts`, one object per locale, read with `t('key')`.
2. **Screen phrase map:** `src/i18n/screenTranslations.ts`. Maps the exact English UI text to its translation. `LocalizationDomBridge.tsx` and `phraseTranslation.ts` walk the rendered page (text nodes plus the `aria-label`, `title`, `alt` and `placeholder` attributes) and swap each exact match.
   - Changing an English string, even its capitalization or a curly vs straight apostrophe, silently breaks its translation.
   - Text split by `{values}` or by tags such as `<strong>` becomes separate pieces, so each piece needs its own key.
3. **Coverage maps (new in #981):** `src/i18n/coverage/<locale>{A,B,C,D,E,F,G,Landing}.ts`. The same kind of exact-English → translation map, for all the screens that had no translation.
   - They are merged in `coverage/<locale>.ts`.
   - They are **lazy-loaded** by `coverage/index.ts`, only when someone picks that language. The chunks are about 310 KB (fil), 400 KB (id), 665 KB (th) and 460 KB (vi).
   - English visitors download nothing extra.
   - Where both define the same string, `screenTranslations.ts` wins.
4. **Code-built sentences (new in #981):** sentences the app assembles in code from a number, name or wallet list. Exact-text lookup can never match these, so each locale has its own wording in code:
   - `src/i18n/sentences.ts` (rendered through `SentenceLabels.tsx`): "{n} Unique Lenders", "{n} more characters (to go)", "Fund {name}'s loan", "You funded {name}'s loan…", "Your {exchange} transfer address", and the Academy quiz-restart confirm.
   - `src/views/account/walletSafetyCopy.ts`: the Account settings wallet change/disconnect warnings and "Your account is using {wallet}".
   - `DashboardV2Sections.tsx`: "Due in N days" / "Overdue N days" / "Due today".
   - `src/utils/dateFormatters.ts` → `currentDateLocale()`: dates follow the app language.
      - Thai keeps the Gregorian year (2026).
      - Money amounts stay in US format ($1,234.50).

Long-form content is switched by locale in data files:

- `src/views/support/data/guides.ts`
- `src/views/support/data/faqs.ts`
- `src/views/account/data/accountFaqs.ts`
- `src/views/help/helpTopics.ts` (en/fil inline; other locales go through the coverage maps)

---

## 2. What was done

### a) Audit (the original request: "check every language, make a long list")

Each language was audited line by line. The reports are in `reports/` here.

| Language   | High | Medium | Low                |
| ---------- | ---- | ------ | ------------------ |
| Vietnamese | 4    | 26     | 20                 |
| Indonesian | 7    | 24     | 22                 |
| Thai       | 5    | 34     | 24                 |
| Filipino   | 12   | 37     | 56 (two reviewers) |

The worst problems in every language were:

- **Out-of-date verification guides.** They described an Orb-only World ID flow and promised a Worldcoin reward. The real flow is an ID + selfie check, with World ID as the alternative, and there is no reward.
- **"$140 and beyond".** $140 is the maximum limit.
- **Three money guides missing.** Repay, add funds and withdraw had no translation, including the "always use the Base network or you can lose funds" warning.
- **Philippine exchanges shown to Indonesian, Thai and Vietnamese users.**
- **Inconsistent terms**, stiff word-for-word phrasing, and English left inside translations.

### b) English source corrections

These feed every language:

- **Verification:** FAQ, `/whylend`, footer, social/SEO descriptions, the unlock text and a toast now say "ID + selfie check, or World ID". Nothing says World ID or an Orb is the only way. The toast typo "WorldId" is gone.
- **Level-up rule:** only a **full-limit** loan repaid on time raises the Credit Level. This was fixed in the FAQs, the help center, the Academy (including a quiz that asked about a "$20 request" on a $15 limit), the money guide, the loan-request tooltip and the old about page.
- **$140** is the stated maximum everywhere.
- **Naming:** "Credit Growth Loan" is now "Credit-Building Loan". "trust loans / credit loans" is now "Trust-Building / Credit-Building Loans". "Trust Score" is now Pandesal points.
- **Small copy fixes:**
   - the low-effort request toast repeated a line
   - "repaid 1 days after the due date"
   - "All Transaction" → "All Transactions"
   - "Unauthorised" → "Unauthorized"
   - "1 more characters"
   - a "Trust level" badge that shows the Credit Level
   - a truncated milestone title
   - copyright 2026

### c) Per-language fixes

In each language:

- Every audit item was fixed.
- All FAQs, account FAQs and guides were retranslated from the current English, and the three money guides added.
- Outdated screen-map entries were moved to the current English or deleted. This includes the password minimum and the new IOU reward rates.
- Button names quoted in guides match what the app actually shows.

### d) Full screen translation

Two rounds found the English text still on screen:

- **Round one** used a text-pattern scan. It missed a lot.
- **Round two** used a full TypeScript scan of every file.

Final coverage entries: **fil ≈ 3,270, id ≈ 4,200, th ≈ 4,160, vi ≈ 4,330**.

This covers Account settings and two-factor settings, all toasts and errors, the Why USDC and Credit Levels pages (including quiz answers), withdraw/cash-out, add funds, the loan request form, transactions, profiles and progress history, the lender screens, milestones and rewards, the help center, the Mecha chat, the verify flow, and the landing, `/benefits` and `/whylend` pages.

### e) Readability review

A fresh reviewer per language re-read everything for natural wording, accuracy, and one consistent glossary (`glossary/`). Example decisions:

- **Vietnamese:** "Nhấn" for tap, "Hạng tín dụng" for Credit Level.
- **Filipino:** Taglish, "gabay" for guide, "mga X" for plurals, English kept for Credit Level / borrower / lender / verified.
- **Thai:** ความน่าเชื่อถือ for reputation (never ชื่อเสียง), ปล่อยกู้ for fund.
- **Indonesian:** "kamu", dompet, Dasbor.

### f) Language choice (PR #987)

- **Onboarding Welcome** now starts with a "Choose your language" card. Every language is written in its own script, and tapping one switches the app at once.
- **Header menu:** a globe menu (🌐 TH ▾) is in the app header and the marketing header. Before this, visitors could change language only in Account settings.
- **Location guess:** `src/i18n/region.ts` guesses PH / ID / TH / VN from the phone's language region, then its time zone. That country's language is marked "Suggested", but the app **never switches automatically**, because many Filipinos prefer English.

### g) Checks on the final #981 branch

- Type-check passes.
- Full test suite passes: 66 files, 574 tests.
- Production build passes, with per-language chunks.
- No duplicate keys.
- Every coverage file holds only its own language and keeps placeholders intact.
- Lint has no new errors. One `hook-use-state` error in `LocalizationProvider` already exists on staging.

---

## 3. Still open

### Known gaps (need code changes, not just translation)

- The borrower-profile paragraph on the lender's card (`src/lib/borrowerContextFit.ts`) is built from many small English sentence parts.
- The withdraw line "Send only [USDC icon] USDC on Base" has an icon in the middle of the sentence.
- A few long toasts with amounts inside, e.g. "You successfully funded $X to {name}".
- Legacy screens that no route reaches anymore (old dashboard sections) are untranslated. Nobody sees them.
- Kept in English on purpose: admin screens, legal pages (privacy and terms), blog essays, and the unrouted old landing/about views. Their wrong claims were still corrected.

### Decisions for the owner

1. **Local exchanges.** See the design question below.
2. **GCrypto.** Does GCash GCrypto accept USDC on the Base network? The Filipino guides describe it two different ways.
3. **Thai year.** Keep 2026, or use the Buddhist-calendar year 2569?
4. **Password minimum.** The app says at least 6 characters in some places and at least 8 in others. Pick one, then change the validation and the messages together. This is logic, so it was not touched.
5. **World ID widget text.** "Verify a borrower… with your passport" mixes up who it addresses. It's part of the World ID configuration, so it has to be changed there and in the code together.

---

## 4. Design question to think about: "money country"

**The problem.** Language, where someone lives, and where their money goes are three different things. For example, a Filipino working in Korea might:

- use the app in Filipino
- repay from a Korean exchange
- cash out to GCash in the Philippines

Today the exchange examples follow the language, so Indonesian, Thai and Vietnamese users used to see Philippine exchanges. #981 made that text neutral everywhere except Filipino.

**Agreed so far:**

- **Language is asked first, in onboarding.** Done in #987.
- **The money country is a separate question, asked later**, when money actually moves.

**Proposed flow (not built yet):**

1. **First repay or first add-funds:** "Where are you sending money from?"
2. **First withdraw:** "Where do you want to receive your money?" This is a separate answer, because it often differs (the Korea → GCash case).
3. **Pre-fill a best guess** so it's one tap. Use the country from the ID check if available, otherwise the location guess from #987 (`region.ts`). It reads as "Sending from Philippines? · Change".
4. **Show only that country's options,** plus global ones (e.g. Binance P2P). Include a small line, "Showing options for South Korea · Change".
5. **Save both answers and make them editable** in Settings, under "Money & exchanges".
6. **It's a preference, not an identity check.** It never blocks anything; it only chooses which exchange list is shown.

**Still to decide:**

- **Where to store it.** Two options:
   - On the user's profile. This follows them to a new phone, but it needs two new columns on the users table. Supabase is production, so this would be a reviewed migration.
   - In the browser first, moving to the profile later.
- **The exchange list per country.** List an exchange only after someone confirms, with a small real test, that it supports USDC deposits and withdrawals on Base. Candidates to test:
   - Philippines: Coins.ph, PDAX, GCash GCrypto
   - Indonesia: Indodax, Tokocrypto, Pintu
   - Thailand: Bitkub, Binance TH
   - Vietnam: mostly Binance, OKX, Bybit P2P
- **Whether the first-repay question could slow down someone repaying under time pressure.** Keeping it to one tap with a pre-filled guess should avoid that.

---

## 5. Lessons if this work continues

- **Don't run a dozen agents at once.** The usage limit was hit six times. One or two at a time, each committing after every file, loses nothing when a cutoff hits.
- **Agents must run git inside their own worktree.** Several ran `git pull --rebase` in the main checkout by accident and rewrote the session branch. It was restored each time, and nothing was lost.
- **After any cutoff, check the translation files for:**
   - half-written lines
   - wrong-language values (once, Indonesian text landed in the Thai file)
   - duplicate keys (eslint `no-dupe-keys` catches these; type-check doesn't)
- **Changing English text breaks its translations.** After any English copy change, add the new key's translations in every language.
- **Avoid one-word keys** like "to", "If" or "Your". They apply to every screen. Three risky Filipino ones were removed.

## Useful files here

- `glossary/common.md`: product facts, and the terms kept in English.
- `glossary/<locale>.md`: the term decisions for each language.
- `reports/`: the original audit reports.
- `scripts/remaining.sh`: the round-one text-pattern scan. It is less complete than the round-two scan; the round-two TypeScript scanner was run from a local scratch folder and is not included here.
