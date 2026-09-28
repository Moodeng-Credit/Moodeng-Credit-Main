# Filipino (fil) localization audit: translations.ts and screenTranslations.ts

This was a read-only review. I read every `filipinoTranslations` entry (translations.ts:137-232) and every entry in `filipinoScreenTranslations` (screenTranslations.ts:1-1061). I checked each stale key against current source with grep, and checked how the lookup works in `src/i18n/LocalizationDomBridge.tsx`. No files were changed.

## Summary

- **Counts:** HIGH 3 · MEDIUM 17 · LOW 22. There are also 126 stale keys (tabled below) and about 45 untranslated values worth fixing.
- **Placeholders and numbers:** a scripted check found no `{points}`, `{language}`, `$` or percentage mismatches between English and Filipino. The number problems are in stale keys, where the English copy has changed since the translation was written (password length 6→8, IOU earn rate 2→1 per $1).
- **Recurring problems:**
  1. **"Credit Level" is translated as "antas ng kredito"** in 11 places, even though it is a product term. Everywhere else the app uses Taglish "credit".
  2. **Role words are inconsistent.** It is "Humihiram" / "Nagpapahiram" / "Beripikado" in some entries and "borrower" / "lender" / "verified" in most others.
  3. **The keyed file and the screen map give different Filipino for the same English** (8 cases). The bottom-nav labels "Ako" (Account), "Buod" (Dashboard) and "Mga Request" (Request Board) are odd choices.
  4. **Partial word-by-word translation garbles screens.** When a whole string has no entry, `translateKnownPhrases` (LocalizationDomBridge.tsx:54-69) swaps in short single-word entries inside English sentences. This produces mixed text on the Repay and filter screens.
  5. **Many live strings are untranslated** because the key only exists with old casing or a curly apostrophe (e.g. "Forgot password?", "It's awkward 😅", "Already have an account?", "Log In", "Check your email").
- **Outdated English (not counted as findings):** several source strings still describe verification as World ID only. Examples: screenTranslations.ts:876-887, :900-906, :448-451 and the `site.footerBlurb` key. "Wallet-based lending with usernames means no one knows your identity" (:911) conflicts with the ID + selfie check. The live Academy quiz text still says "trust-points balance" (AcademyGuide.tsx:838). The Filipino follows the English faithfully in all of these, so the fix belongs in the English source.

---

## HIGH

**H1. screenTranslations.ts:1011-1012** (live, AcademyGuide.tsx:69)
- **English:** "If your request is below your credit limit, it is trust-building. If it is above your credit limit, it is credit-building."
- **Current fil:** "…Kung lampas sa credit limit mo, credit-building ito."
- **Problem:** Wrong about limits, in both English and Filipino. A credit-building loan is a loan for the *full* limit; nobody can borrow above their limit. The Filipino repeats the English error.
- **Suggested fix:** Correct the English, then use: "Kung mas mababa sa credit limit mo ang request, trust-building loan ito. Kung eksaktong katumbas ng buong credit limit mo, credit-building loan ito."

**H2. screenTranslations.ts:329 and :343** (stale)
- **English:** "Use at least 6 characters." and "Use at least 6 characters for your new password."
- **Problem:** The live strings now say **8**: reset-password/page.tsx:169 "Use at least 8 characters for your new password." and :368 "Use at least 8 characters." Both are untranslated. Anyone who just re-keys the old Filipino will tell users the wrong minimum, and their password will be rejected.
- **Suggested fix:** Add "Use at least 8 characters." → "Gumamit ng hindi bababa sa 8 characters." and the "…for your new password." version → "Gumamit ng hindi bababa sa 8 characters para sa bagong password mo." Delete the 6-character keys.

**H3. screenTranslations.ts:799-802** (stale)
- **English:** "In Year 1, get 2 IOU points for every $1 funded…" and "Borrower-stage bonuses are +25, +20, +15, then +10…"
- **Problem:** The live lender copy has **different numbers**. lendingIncentivesConfig.ts:38 says "Get up to 25 IOU tokens for lending to first-time borrowers, plus 1 IOU token for every $1 lent!" and :39 says "Lend to 2nd-time borrowers, get 20 IOU tokens, etc." Both are untranslated. Porting the old Filipino would misstate lender rewards.
- **Suggested fix:**
  - "Makakuha ng hanggang 25 IOU tokens sa pagpapahiram sa first-time borrowers, plus 1 IOU token sa bawat $1 na ipinahiram!"
  - "Magpahiram sa 2nd-time borrowers at makakuha ng 20 IOU tokens, at iba pa."

---

## MEDIUM

**M1. LocalizationDomBridge.tsx:54-69 (partial word-by-word translation)**
Text up to 96 characters with no full entry gets single words replaced from the map. Confirmed live results:

| Where | English | What users see |
|---|---|---|
| Repay.tsx:1306 | "Not yet paid" | "Not yet nabayaran" (`paid` :546) |
| Repay.tsx:1084 | "Paid in full" | "Bayad na in full" (`Paid` :195) |
| Repay.tsx:448/483/1653 | "Small fee" | "Maliit fee" (`Small` :856) |
| LendingIncentivesSection:16 | "Lender terms" | "Nagpapahiram terms" (`Lender` :142) |
| FilterSidebar:239 | "Payback Amount" | "Payback Halaga" |
| FilterSidebar:256 | "Repayment Date" | "Repayment Petsa" |
| FilterSidebar:271 | "Borrow Type" | "Humiram Type" |

Add full keys for these:
- 'Not yet paid': 'Hindi pa bayad'
- 'Paid in full': 'Bayad na nang buo'
- 'Small fee': 'Maliit na fee'
- 'Lender terms': 'Terms para sa lender'
- 'Payback Amount': 'Halagang ibabalik'
- 'Repayment Date': 'Petsa ng pagbabayad'
- 'Borrow Type': 'Uri ng borrower'
- 'Filters': 'Mga filter'

**M2. "Credit Level" → "antas ng kredito"** at screenTranslations.ts:351, :491, :518, :528, :549, :608, :621, :623, :633, :669, :1003.
- **Problem:** It is a product term that should stay in English. The formal "kredito" also clashes with "credit" used everywhere else ("Credit Limit", "credit-building", "Level 1").
- **Suggested fix:** "Credit Level", e.g. :518 "Ano ang Credit Level?", :491 "Alamin ang Credit Leveling System", :621 "Paano i-unlock ang susunod mong Credit Level", :608 "Panoorin ang Credit Levelling Guide namin", :623/:633 "Ang Credit Leveling ay…".

**M3. Role labels**
- **Entries:** :40 Borrower→"Humihiram", :41 "Benepisyo ng humihiram", :142 Lender→"Nagpapahiram", :604 "Beripikadong humihiram", :605 "Beripikadong nagpapahiram".
- **Problem:** Inconsistent with "Mga borrower" (:965), "Mga lender" (:979), "Benepisyo ng lender" (:575) and hundreds of "borrowers/lenders" uses. "Humihiram" is a verb form ("is borrowing"), not a role noun. Because of M1 it also gets injected into other English text.
- **Suggested fix:** "Borrower", "Lender", "Benepisyo ng borrower", "Verified na borrower", "Verified na lender".

**M4. Verified vs beripikado**
- **Entries:** :186/:187 "Hindi beripikado", :291 "Beripikado", :604/:605.
- **Problem:** Other entries use "verified" (:28, :384, :762, :881, :884).
- **Suggested fix:** "Verified" and "Hindi pa verified". The "pa" (not yet) signals a pending step rather than a rejection.

**M5. History vs Kasaysayan**
- **Entries:** translations.ts:157 and screen :129 "Kasaysayan", :590, :601, :606.
- **Problem:** Other entries use "history" (:298, :299, :355, :357, :360, keyed :228-229). "Kasaysayan" reads like national history.
- **Suggested fix:** "History", "Transaction history", "Tingnan ang loan transaction history".

**M6. Keyed file and screen map disagree for the same English.** Which one users see depends on whether the component calls `t()` or relies on the page-text lookup.
- 'See Request Board': translations.ts:145 "Request Board" vs screen :235 "Tingnan ang Request Board"
- 'Account': :154 "Ako" vs :14 "Account"
- 'Request Board': :160 "Mga Request" vs :222 "Request Board"
- 'Dashboard': :156 "Buod" / :181 "Dashboard" vs :95 "Buod"
- 'Account Settings': :213 vs :18
- 'Notifications': :222 vs :188
- 'View Lending History': :228 vs :298
- 'View Loan History': :229 vs :299

Use one value each: "Account", "Dashboard" (not "Buod", which means "summary"), "Request Board", "Tingnan ang Request Board", "Mga setting ng account", "Mga notification", "Tingnan ang lending history", "Tingnan ang loan history".

**M7. translations.ts:211 and screen :162**
- **English:** "Microloan Request Board"
- **Current fil:** "Board ng Microloan Requests"
- **Problem:** Awkward, and inconsistent with "Request Board" kept in English everywhere else.
- **Suggested fix:** "Microloan Request Board"

**M8. translations.ts:212 and screen :253-254**
- **English:** "…for borrowers building credit abroad."
- **Current fil:** "…para sa borrowers abroad."
- **Problem:** Drops "building credit", which is the core promise.
- **Suggested fix:** "…para sa mga borrower na bumubuo ng credit sa abroad."

**M9. Overdue wording (screen :586, :193, :612)**
- **Problem:** :586 "Past due" → "Lagpas due" is ungrammatical. :193 "Overdue" is untranslated. :612 "overdue na ngayon" is fine but inconsistent with the other two.
- **Suggested fix:** "Lampas na sa due date" for "Past due" and "Overdue na" for "Overdue".

**M10. screen :364**
- **English:** "Later" (roadmap phase: Now / Next / Later)
- **Current fil:** "Mamaya"
- **Problem:** "Mamaya" means later today.
- **Suggested fix:** "Sa hinaharap"

**M11. screen :475-476**
- **English:** "…lenders can trust that your request is tied to one real borrower."
- **Current fil:** "…mas makakatiwala ang lenders…"
- **Problem:** "Makakatiwala" is the wrong verb form, and "mas" adds a "more" that is not in the source.
- **Suggested fix:** "Mag-verify nang isang beses para mapatunayang unique ka. Pagkatapos noon, makakasiguro ang mga lender na nakatali ang request mo sa iisang totoong borrower."

**M12. screen :934-938**
- **English:** "10/9/8/7/6 min read"
- **Current fil:** "10 min basahin"
- **Problem:** "basahin" is an imperative ("read it").
- **Suggested fix:** "10 minutong basa", etc. Also add the live "11 min read" and "18 min read".

**M13. Live strings missing because the key uses different casing or a curly apostrophe**
- "Forgot password?" (SignInPage:260): "Nakalimutan ang password?"
- "It's awkward 😅" (toastConfig:89/165): "Medyo awkward 😅"
- "Already have an account?" + "Log In" (SignUpPage:243-245): "May account ka na?" + "Mag-log in"
- "Check your email": "Tingnan ang email mo"
- "Confirm your email": "I-confirm ang email mo"
- "Email confirmed": "Confirmed na ang email"
- "START BUILDING CREDIT": "MAGSIMULANG BUMUO NG CREDIT"
- "Microloans with USDC to BUILD YOUR CREDIT": "Microloans sa USDC para BUMUO NG CREDIT MO"
- "Create account": "Gumawa ng account"
- "Change wallet": "Palitan ang wallet"
- "Repayment Progress": "Progreso ng bayad"
- "Progress history ›": "History ng progress ›"

**M14. Verification header missing**
- **English:** "Prove you're a real person with World ID" (verificationModalConfig:65, VerificationModalHeader:18)
- **Problem:** No entry. The existing keys :448-451 include an extra sentence, so they never match.
- **Suggested fix:** "Patunayan na totoong tao ka gamit ang World ID"

**M15. Repay subtitle missing**
- **English:** "Choose a loan and enter an amount." (Repay.tsx:1234)
- **Problem:** No entry. The stale key :452 has ", and confirm".
- **Suggested fix:** "Pumili ng loan at ilagay ang halaga."

**M16. Request Board card text missing**
- **English:** "Borrow USDC to build trust and" / "unlock higher loan levels." (RequestBoard.tsx:2016-2018)
- **Problem:** The sentence is split by a `<br/>`, so the full-sentence key :47 never matches.
- **Suggested fix:** Add "Humiram ng USDC para bumuo ng tiwala at" + "mag-unlock ng mas mataas na loan levels." Also add "Browse requests publicly." (RequestBoard.tsx:1954) → "Tingnan ang requests nang publiko."

**M17. Duration filter label**
- **Entry:** screen :179 "Next 120 Days+" is stale.
- **Problem:** The live label is "After 90 Days+" (loanOptions.ts:28) and is untranslated. The old Filipino "Susunod na 120 araw+" would state a different range.
- **Suggested fix:** "Pagkalipas ng 90+ araw"

---

## LOW

- translations.ts:144 'See More Benefits' → "Mga Benepisyo" drops "more". Use "Iba pang benepisyo".
- translations.ts:145 'See Request Board' → "Request Board" drops "See". See M6.
- translations.ts:147 / screen :258 'Start Lending' → "Magpahiram" is identical to "Lend". Use "Simulang magpahiram".
- translations.ts:179 'Contact' → "Kontak" is odd. Use "Makipag-ugnayan".
- translations.ts:200 / screen :49 "Borrow USDC to build trust. Unlock higher levels." → the Filipino drops "build trust". Use "Humiram ng USDC para bumuo ng tiwala. Mag-unlock ng mas mataas na levels."
- translations.ts:225 / screen :215 "Repay Loans" → "Magbayad ng Loans". Use "Bayaran ang mga loan".
- screen :31 / translations.ts:197 "Apply for a loan" → "Mag-apply". Use "Mag-apply ng loan".
- screen :34 "Bad options fill the gap" → "Masamang options ang pumupuno sa gap" is a stiff calque. Use "Mga delikadong opsyon ang sumasalo sa kakulangan".
- screen :57 "Build toward a credit passport" → "Bumuo patungo sa…" is a calque. Use "Unti-unting bumuo ng credit passport".
- screen :75 "I-confirm" vs :452 "kumpirmahin". Pick one ("I-confirm").
- screen :104 "Done" → "Tapos". Use "Tapos na".
- screen :292 "Verification code" → "Code sa verification". Use "Verification code", which matches :308.
- screen :423 "© 2026 Moodeng Credit All Rights Reserved" is untranslated, while footer.copyright uses "Nakareserba ang lahat ng karapatan". Use "© 2026 Moodeng Credit. Nakareserba ang lahat ng karapatan."
- screen :561 "Getting started" (section heading) → "Magsimula" (verb). Use "Pagsisimula".
- screen :583 'out of' → "mula sa", :664-665 "$10 mula sa $15", and :1024 'of' → "sa" are inconsistent. Use "sa" throughout ("$10 sa $15").
- screen :584 "Pay Now" → "Magbayad" drops "now". Use "Magbayad ngayon", which matches :216.
- screen :602 "today" → "ngayon" means "now". Use "ngayong araw".
- screen :603 "Unknown" → "hindi kilala" is lowercase and means an unknown person. Use "Hindi alam".
- screen :674 "Late or missed repayment" → "…hindi nabayarang repayment" is redundant. Use "Huli o hindi nagawang bayad".
- screen :679 "The clean version" → "Ang malinaw na version". The source means the short, plain summary, so use "Ang maikling bersyon".
- screen :680-690 use "trust" while :629/:642 use "tiwala" for the same concept. Pick "tiwala".
- screen :796 "…story, timeline, at return…": "return" may be misread. Use "kita (return)".
- Minor article drops at :748, :945 and :984 ("Ang sinasabi ng mga tao", "Ang sinasabi ng artikulong ito", "Ang $15 loans ay…").
- screen :696-697: after the separate "Moodeng" span this renders "Moodeng ay direktang kumokonekta sa borrowers at sa mga taong…", which shifts the meaning. Use "ay direktang nagkokonekta sa mga borrower at sa mga taong handang magpahiram."

---

## Stale keys → current English

"(exists)" means the replacement key is already in the map, so the stale key can simply be deleted. **MISSING** means the live English has no Filipino entry.

| Stale key (line) | Current English / status |
|---|---|
| ACCOUNT ACCESS :16 | "Account access" (exists; uppercase is CSS only) |
| Already have a Base wallet? Connect it here. :27 | "Prefer a Base Account? Connect it instead" (ConnectWallet:306), **MISSING** → "Mas gusto ang Base Account? Ikonek ito sa halip" |
| Back to login :32, Back to Login :435 | "Back to sign in" (exists) |
| Borrower testimonial one :42 | "Borrower testimonial" (WhatPeopleSaySection:5), **MISSING** |
| Borrower Tips :44 | removed from app |
| Borrowers can start with small, transparent… :45 | removed from app |
| Borrow USDC to build trust and unlock higher loan levels. :47 | now split into 2 text nodes, see M16 (**MISSING**) |
| Browse real requests, see how Moodeng works… :51 | "Browse requests publicly." (RequestBoard:1954), **MISSING** |
| Check Your Email :65 | "Check your email", **MISSING** |
| Choose your role :68 | removed ("Choose role" exists) |
| Continue with Google :91 | "Sign In with Google" / "Sign Up with Google" (exist) |
| Enter the 8-digit code from your email. :110 | **live** (template `${CODE_LENGTH}`), false positive, keep |
| Failed to update email :122 | removed from app |
| How We Verify / How we verify :132-133 | removed (only in an SEO description) |
| It’s awkward 😅 :140 | "It's awkward 😅" (straight apostrophe), **MISSING** |
| Lender Performance :144 | "Performance Insights" (LenderPerformance:255), **MISSING** |
| Lenders can fund loans to this wallet… :147 | removed from app |
| Need one? Choose the Base Account option… :169 | removed from app |
| Next 90 Days :178 | removed |
| Next 120 Days+ :179 | "After 90 Days+", **MISSING** (M17) |
| Quick tour :209, Take a quick tour :265 | "Want a quick tour?" (GuidedTourPreview:365), **MISSING** → "Gusto mo ng quick tour?" |
| Repayment % :218 | "Payback Amount" (FilterSidebar:239), **MISSING** |
| Request Board Preview :223 | removed from app |
| SIGN UP :248 | "Sign up" / "Sign Up" (exist) |
| Signing in... / Signing up... :249-250 | removed from app |
| Start Building Credit :257 | "START BUILDING CREDIT", **MISSING** |
| We sent a verification code to your email… :308 | "Enter the 8-digit code from the latest Moodeng email to finish setting up your account.", **MISSING** |
| Enter your email and Moodeng will send a secure reset link… :312 | "Enter your email and Moodeng will send an 8-digit code to reset your password.", **MISSING** |
| Send reset link :314 | "Send reset code", **MISSING** |
| Send a new link :315 | removed ("Request a new link" exists) |
| Could not send a reset link… :320 | "Could not send a reset code. Try again in a moment.", **MISSING** |
| Check your email for the reset link… :321 | "If an account exists for that email, an 8-digit code is on its way. Enter it below to continue.", **MISSING** |
| Reset emails can land in spam… :323 | "If the email is hard to find, check spam or promotions and open the latest Moodeng email.", **MISSING** |
| NEW PASSWORD :326 | "New password" (exists) |
| Use at least 6 characters. :329 | "Use at least 8 characters.", **MISSING** (H2) |
| Request a fresh link if this screen… :333 | "Reset links can only be used once and expire quickly. Tap below to send yourself a fresh link, then open the newest Moodeng email.", **MISSING** |
| This link is ready. Set your new password below. :335 | "This reset link is ready. Enter matching passwords to continue.", **MISSING** |
| Use at least 6 characters for your new password. :343 | "Use at least 8 characters for your new password.", **MISSING** (H2) |
| Password updated. You can sign in… :347 | "Password updated. Taking you to your dashboard now.", **MISSING** |
| View Progress History :352 | "Progress history ›", **MISSING** |
| What’s Next? :380 | straight-apostrophe version (exists) |
| You can change it later… :387 | removed from app |
| You’re building a reputation… :390 | straight-apostrophe version (exists; Welcome.tsx also has its own inline Filipino) |
| Your Base wallet is part of your borrower record… :392 | removed from app |
| Your Moodeng account is fully set up… :394 | straight-apostrophe version; Congratulations.tsx has its own Filipino, delete |
| Your Capital, Your Growth :399 | "Start Small. Grow by Repaying." (exists) |
| Forgot Password / Forgot Password? :408-409 | "Forgot password?", **MISSING** |
| Don't have an account? Sign Up :419 | split into "Don't have an account?" + "Sign Up" (both exist) |
| Don't have an account? :420 | **live** (JSX `&apos;`), false positive, keep |
| Privacy · Terms · Docs :422 | split into "Privacy" / "Terms" / "Docs" (exist) |
| Already have an account? Log In :429 | split into "Already have an account?" + "Log In", both **MISSING** |
| Verify Your Email :431 | "Confirm your email", **MISSING** |
| Link Your Account :432 | removed from app |
| Email Confirmed :433 | "Email confirmed", **MISSING** |
| An account with this email already exists (likely via Google)… :436 | "An account with this email already exists. Sign in instead, or reset your password if you need to regain access." (authSlice:92), **MISSING** |
| Loans are sent to this wallet… :444 | rewritten: "Your loan lands here — created from your Moodeng login, no app needed. Earn Pandesal points too.", **MISSING** |
| Verify You’re Human :446 | straight version (exists) |
| Prove you’re / you're a real person with World ID. This is a one-time step. :448-451 | "Prove you're a real person with World ID", **MISSING** (M14) |
| Choose a loan, enter an amount, and confirm. :452 | "Choose a loan and enter an amount.", **MISSING** |
| YOU’RE PAYING / YOU'RE PAYING :455-456 | "You're paying" (exists) |
| Time left :457 | removed from app |
| Select an amount or enter your own. :460 | removed from app |
| Repayment progress :461 | "Repayment Progress", **MISSING** |
| CREATE ACCOUNT :470 | "Create account" (AuthErrorAlert:107), **MISSING** |
| Base Wallet Locked In :477 | removed from app |
| Change Base wallet :479 | "Change wallet", **MISSING** |
| MICROLOANS WITH USDC TO BUILD YOUR CREDIT :500 | "Microloans with USDC to BUILD YOUR CREDIT" (landing Hero:17), **MISSING** |
| Moodeng connects borrowers directly… :501 | split into "Moodeng" + "connects borrowers…" (exists :696) |
| 01 / NO COLLATERAL … 04 / PORTABILITY :504-507 | mixed-case versions (exist) |
| LIVE ADMIN PANEL :531 | "Live admin panel" (admin only), **MISSING** |
| George admin, Preview data, Design preview only. No writes., Borrower-only source of truth…, We do not have a borrower trust-points balance… :532-539 | removed or rewritten (admin panel) |
| We've sent a verification email… :540 | removed from app |
| Didn't receive the email?… :542 | removed from app |
| Our support team is available 24/7… :582 | removed from app |
| Paid so far :585 | removed from app |
| See Why It’s Worth It :593 | straight version (exists) |
| remaining after this payment :613 | removed from app |
| You’re paying :614 | straight version (exists) |
| Dr. Muhammad Yunus… (curly) :718 | straight version (exists :720) |
| By using Moodeng, you're building… :725 | split into "By using" + ", you're building…" (exist :722-723) |
| Lending terms :792 | "Lender terms", **MISSING** (see M1) |
| In Year 1, get 2 IOU points… :799 | "Get up to 25 IOU tokens for lending to first-time borrowers, plus 1 IOU token for every $1 lent!", **MISSING** (H3) |
| Borrower-stage bonuses are +25… :801 | "Lend to 2nd-time borrowers, get 20 IOU tokens, etc.", **MISSING** (H3) |
| Listen on Spotify :932 | "Open Spotify" (exists) |
| Credit infrastructure :933 | removed (no longer a category) |
| 10 min read :934 | now "11 min read" and "18 min read", **MISSING** |
| What oil pipelines teach us about predatory credit :939 | "What oil pipelines teach us about credit" (exists) |
| A book about steel, states, and oil routes… :940 | "A book about oil routes has a useful lesson…" (exists) |
| From the loan shark research notes :952 | removed from app |
| Beyond guides and FAQs :963 | "More essays to explore" (MoodengBlogs:107), **MISSING** |
| For millions of informal workers, the first lender… :966 | rewritten in the blogPosts.ts post data (other reviewer's scope) |
| App-store trust / The app-store costume… / The most dangerous lending apps… :969-973 | post removed; the new post "Loan sharks didn't begin with apps" and the categories "Predatory credit history" and "Borrower guide" are **MISSING** |
| Finish the quick check. Score 4 of 5 or better and continue… :1019 | now split JSX; fragments "Finish the quick check. Score" and "of" exist |
| or better and continue the :1025 | "or better to pass. This is a learning score today, not a live IOU or trust-points balance.", **MISSING** → "o mas mataas para pumasa. Learning score lang ito ngayon, hindi live na IOU o Pandesal points balance." (the English also needs the Pandesal wording) |
| setup flow. :1026 | removed |
| Check your Academy score :1022 | "Earn your Academy reward", **MISSING** |
| Repayment can change a borrower credit limit… (full + 4 fragments) :1038-1044 | rewritten (admin): "Milestone completions write borrower Pandesal points events into Supabase…" |
| On-time fully repaid loans…, See what borrower actions…, This is the borrower credit-limit field…, IOU balances come from…, These are borrower repayment…, Borrower trust points are a product concept…, If we want actual trust-point balances…, This guide only describes borrower trust points… :1045-1060 | removed or rewritten (admin trust-points guide) |

---

## Untranslated values (Filipino identical to English) that should change

**Keyed file (translations.ts):**
- :213 Account Settings → "Mga setting ng account"
- :222 Notifications → "Mga notification"
- :216 Guest User → "Guest" / "Bisita"
- :181 nav.dashboard is fine as "Dashboard", but fix :156 to match it (M6)

The language names, Academy/Blog/Docs/FAQ, the legal page names, App/Profile/Network and `IOU {points}` are fine to leave in English.

**Screen map (screenTranslations.ts):**
- :193 Overdue → "Overdue na"
- :98 Defaulted → "Nag-default"; :97 DEFAULT → "NAG-DEFAULT"
- :194 PARTIAL → "BAHAGYANG BAYAD"
- :121 Failed → "Hindi nagtagumpay"
- :263 Success → "Tagumpay!"
- :303 Warning → "Babala"
- :115 Error → "May error"
- :172 Network Error! → "Error sa network!"
- :276 Transaction Error → "Error sa transaksyon"
- :240 Settings → "Mga setting"
- :232 Security → "Seguridad"
- :350 Member since → "Miyembro mula"
- :280 Type → "Uri"
- :651 Current → "Kasalukuyan"
- :217 Repayments → "Mga bayad"
- :35 Beginner → "Baguhan"; :36 Beginner Borrower → "Baguhang borrower"
- :226 Recommended → "Inirerekomenda" (matches the inline Welcome.tsx)
- :43 Borrower testimonial two → "Testimonial ng borrower #2" (and the missing "Borrower testimonial" → "Testimonial ng borrower")
- :1021 Final quiz → "Huling quiz"
- :288 Users → "Mga user"
- :423 © 2026 … All Rights Reserved → see LOW
- Admin-only strings, low priority: :161 Manual resolution → "Manu-manong resolusyon"; :212 Recovery funding review → "Review ng recovery funding"; :219 Repayment support update → "Update sa repayment support"

**Acceptable in English (Taglish or product terms), no change needed:**
- Account, Wallet, Password, Status, Home, Email, Credit Limit, IOU points
- Trust-building loan / Credit-building loan
- Level 1-4, Milestones, Popular, Top Pick, Request / Request Board
- World ID verification / verified, Orb verified, TradFi
- Podcast / Book review titles, Privacy / Terms, Lender Dashboard
- Tutorial Video / Video walkthrough, percentage chips, Goal, abroad / market fragments
