
# Filipino localization audit: long-form data and inline component copy

This was a read-only review. I changed no files. Checkout: `/tmp/claude-0/-home-user-Moodeng-Credit-Main/acfa23e1-eaed-5486-85f3-b2a5d6da87fd/scratchpad/wt-seo`. All paths below are relative to that checkout.

## Summary

- **Counts:** 9 HIGH, 20 MEDIUM, 34 LOW. There are also 8 missing or untranslated areas and 15 problems in the English source.
- **Top recurring problems:**
  1. **Stale verification copy in Filipino.** It still describes World ID / Orb only, offers a $10 Worldcoin reward, and says no documents are uploaded. This is in the `how-to-request-your-first-loan` and `verification-and-why-its-required` guides.
  2. **Credit limit "at pataas pa" ("and beyond").** Filipino says this where English says $140 is the current maximum (faqs ×2 and a guide). The English account FAQ has the same "and beyond" bug.
  3. **The three money-movement guides have no Filipino version** (repay, add funds, withdraw). These are the PH-specific guides about Coins.ph, GCrypto, PDAX and the Base network warning, and Filipino users see English.
  4. **Inconsistent terms.** "Credit Level" appears as "antas ng kredito" / "Credit Level" / "Antas ng kredito". The Repay screen is "Magbayad screen" in one place and "Repay screen" in another. "Verified" is written as "Beripikado" / "verified".
  5. **English claims copied faithfully that are wrong.** "Every on-time repayment unlocks a higher limit." "No government ID needed, just World ID." "Credit Growth Loan." Fix the English first, then the Filipino.
- `src/views/support/data/updates.ts` has no Filipino at all.
- The inline copy in DashboardV2 and `VerifyYourselfModal` is mostly English-only.

---

## HIGH

**H1. `src/views/support/data/guides.ts:244-248`** (how-to-request-your-first-loan, Filipino steps 5–6)
- **English (L29-30):** Step 5 is "tap 'Verify Yourself' and complete the quick ID + selfie check ('Verify Your ID') — about 3 minutes. Already a World App user? You can choose 'Verify with World ID' instead." English has 6 steps.
- **Filipino:** "i-download ang World App at kumpletuhin ang human identity verification sa physical World Orb location", plus an extra "Step 6: I-link ang World ID … Pagkatapos mag-verify sa Orb…". That makes 7 steps.
- **Problem:** stale, Orb-only verification. It sends users to a physical Orb.
- **Fix:** "Step 5: I-verify ang identity mo\nPara mapanatiling safe ang community, i-tap ang "Verify Yourself" at kumpletuhin ang mabilis na ID + selfie check ("Verify Your ID") — mga 3 minuto lang. Gumagamit ka na ng World App? Puwede mong piliin ang "Verify with World ID" sa halip."
  - Delete the old Step 6 and renumber Step 7 as Step 6.
  - Also remove the double blank line at L239-240.

**H2. `guides.ts:256-260`** (same guide, the "Important notes tungkol sa credit limit mo" block)
- **English:** this block does not exist. English ends after the Step 6 bullet list.
- **Filipino:** an extra section including "…$120 → $140 at pataas", "Isang credit-building loan request lang ang puwedeng active at a time", and a confusing example: "$12 trust-building loan… at nagbayad ka ng $15".
- **Problem:** stale content that says the limit goes beyond $140. The example is also confusing about money.
- **Fix:** delete the block so it matches English. If you keep it, change "at pataas" to "(ang kasalukuyang maximum)" and fix the example.

**H3. `guides.ts:335-358`** (verification-and-why-its-required, entire Filipino body)
- **English (L198-213):** one-time identity check. Recommended path is Verify Your ID (national ID + selfie, good lighting, about 3 min; human review within at most 1 business day). The ID is checked by a partner and never stored by Moodeng. World ID is the alternative.
- **Filipino:**
  - Says World ID is required, "nang hindi ka pinapa-upload ng sensitive personal documents".
  - Has a bullet: "Rewards: Puwedeng mag-claim ang new users ng humigit-kumulang $10 sa Worldcoin rewards".
  - Has a 4-step Orb guide ("Humanap ng Orb…").
  - Has stray spaces before periods: "sa iyo ." and "eligibility mo .".
- **Problem:** wrong on every point. It promises a reward that isn't offered, says no documents are needed (false now), and omits the ID + selfie flow.
- **Fix (full replacement):**
  > Para mapanatiling safe at patas ang Moodeng, lahat ng borrowers ay dumadaan sa maikli at one-time na identity verification. Pinoprotektahan nito ang community laban sa fake at duplicate accounts, at ito ang dahilan kung bakit napagkakatiwalaan ng lenders ang mga request na pinopondohan nila.
  >
  > Bakit kailangan mag-verify?
  > - Security: sinisiguro na galing sa totoo at iisang tao ang bawat request, para maiwasan ang fraud.
  > - Access: kapag tapos ang verification, puwede ka nang mag-request ng loan at magsisimula na ang Pandesal points mo.
  >
  > Ang inirerekomendang paraan: Verify Your ID
  > 1. I-tap ang "Verify Yourself" sa app at piliin ang "Verify Your ID".
  > 2. Ihanda ang physical national ID mo at pumuwesto sa maliwanag at pantay na ilaw.
  > 3. Kumpletuhin ang mabilis na ID photo + selfie check — mga 3 minuto lang.
  > 4. Karamihan ng checks ay tapos sa loob ng ilang minuto. Kung kailangan ng review ng tao, aabisuhan ka namin agad kapag tapos na (kadalasan sa loob ng ilang oras, pinakamatagal na ang 1 business day).
  >
  > Sinusuri ang ID mo ng secure na verification partner namin at hindi ito kailanman iniimbak ng Moodeng.
  >
  > Alternatibo: Verify with World ID
  > Kung gumagamit ka na ng World App — na-verify nang personal sa isang Orb o gamit ang biometric passport — puwede mong piliin ang "Verify with World ID" at kumpirmahin sa World App.

**H4. `src/views/support/data/faqs.ts:127`** (what-is-a-credit-level)
- **English:** "… → $140, which is the current maximum."
- **Filipino:** "… -> $140, at pataas pa."
- **Problem:** says the limit keeps rising past the maximum.
- **Fix:** "… → $140, na siyang kasalukuyang maximum."

**H5. `faqs.ts:185`** (small-loan)
- Same problem as H4.
- **Fix:** "…$15 → $20 → $40 → $60 → $80 → $100 → $120 → $140, na siyang kasalukuyang maximum."

**H6. `src/views/account/data/accountFaqs.ts:188`** (increase-credit-limit)
- **Filipino:** "$15 -> $20 -> $40 -> $60, at pataas pa."
- This faithfully mirrors the English "and beyond" at L76, but both are wrong.
- **Fix:** "Ang progression ay $15 → $20 → $40 → $60 → … → $140, ang kasalukuyang maximum." Fix the English too.

**H7. `faqs.ts:163` and `faqs.ts:176`** (fight-loan-sharks, what-is-credit-building-loan)
- **English:** L72 "no government ID … just a verified World ID"; L85 "tied to your wallet and World ID".
- **Filipino:** "Walang collateral, walang government ID… Verified World ID at wallet … lang"; "naka-link sa wallet at World ID mo".
- **Problem:** contradicts the current verification, where the recommended path requires a national ID. Stale in both languages.
- **Fix:** "Walang collateral at walang bank account na kailangan — mabilis na identity check lang (ID + selfie, o World ID) at wallet…". Replace "naka-link sa wallet at World ID mo" with "naka-link sa wallet at verified identity mo".

**H8. Limit-progression claims that are misleading** (mirrors of wrong English)
- **Where:**
  - `src/views/help/helpTopics.ts:611`: "Ang on-time na bayad ay may Pandesal points na nagtataas ng level mo"
  - `helpTopics.ts:114`: "Bawat on-time na bayad … nagbubukas ng mas mataas na limit"
  - `helpTopics.ts:174`: "Bawat on-time na bayad ay pinapalaki ang limit"
  - `helpTopics.ts:462` and `accountFaqs.ts:168`: "…nag-u-unlock ng mas mataas na antas ng kredito"
  - `faqs.ts:185`: "Bawat successful repayment ay nagpapalaki ng limit mo"
- **Problem:** only a full-limit Credit-Building Loan repaid on time raises the level. Pandesal points and trust-building loans do not.
- **Fix:** rewrite the English first. Then, for example, L611: "Magbayad on time. Ang on-time na bayad ay nagdadagdag ng Pandesal points (reputasyon mo sa lenders)." The level-up rule is already stated in the next step.

**H9. Filipino guides missing for repay, add funds and withdraw.** See "Missing Filipino entries" #1. It is listed here because this is the highest-risk gap: the network-choice and fund-loss warnings are in English only.

---

## MEDIUM

**M1. Credit Level terminology is inconsistent.** "antas ng kredito" appears in:
- guides.ts:272, 274, 287
- faqs.ts:104, 124, 125, 161, 170, 172, 174, 183
- accountFaqs.ts:168, 177, 200
- Account.tsx:122 (creditGuide)
- Congratulations.tsx:62
- GettingStarted.tsx:97-98
- Support.tsx:80
- support/FAQ.tsx category label
- Guides.tsx:41

"Credit Level" appears in helpTopics.ts:586-617. The helpTopics link label "Paano gumagana ang Credit Levels" opens a guide titled "Paano gumagana ang mga antas ng kredito".
- **Fix:** use "Credit Level" (it's a product term) everywhere.

**M2. The Repay screen has different names.**
- accountFaqs.ts:166 says "Buksan ang Magbayad screen". This matches the fil bottom nav, `bottomNav.repay: 'Magbayad'`.
- helpTopics.ts:444, 454, 457, 502 say "Repay screen" / "Repay address".
- **Fix:** use the fil UI label everywhere, e.g. "Magbayad screen" and "repayment address".

**M3. `helpTopics.ts:256` "kami ang sa network fees" and `:341` "kami na ang sa network fees"**
- **English:** "Moodeng covers the network fees" / "network fees are covered for you".
- **Problem:** the verb is missing, so the sentence is ungrammatical.
- **Fix:** "kami na ang bahala sa network fees" (or "sagot namin ang network fees").

**M4. `helpTopics.ts:574`** "kung gaano ka kaaasahan sa pagbayad … bumababa sa huli o default"
- **Problem:** "kaaasahan" is non-standard, and "huli" is ambiguous (it can mean "last").
- **Fix:** "kung gaano ka maaasahan sa pagbabayad. Tumataas ito kapag on time at buo ang bayad, at bumababa kapag late ka o nag-default."

**M5. `accountFaqs.ts:131`** "Tinutulungan lang ng Moodeng ang request board, verification, repayment status, at record keeping"
- **English:** "Moodeng helps with the request board…"
- **Problem:** the Filipino means "Moodeng only helps the request board".
- **Fix:** "Ang ibinibigay lang ng Moodeng ay ang request board, verification, repayment status, at record keeping para malinaw…"

**M6. `faqs.ts:145`** "Gumagana ito nasa Manila, Lagos, Mumbai, o kahit saan ka man."
- **Problem:** ungrammatical.
- **Fix:** "Gumagana ito nasa Manila, Lagos, o Mumbai ka man."

**M7. `helpTopics.ts:688, 692, 696`** (reason-in-english topic)
- L688 title "Sabi "write it in English"": change to 'Nakalagay na "write it in English"'.
- L692 "Sabi ng dahilan ko isulat sa English" is garbled. Change to "Sinasabi ng form na isulat sa English ang dahilan ng loan ko — ano ang gagawin ko?"
- L696 "Tagalog, Taglish, at Bisaya ang karaniwang dahilan" uses "dahilan" (the loan reason) to mean "cause". Change to "Kadalasan, ito ay dahil nakasulat sa Tagalog, Taglish, o Bisaya".
- L696 "humihinto sa form": change to "nagpapahinto sa form".

**M8. `helpTopics.ts:760`** "walang lehitimong katulong ang hihingi nito"
- **Problem:** "katulong" reads as "housemaid".
- **Fix:** "walang lehitimong support o helper ang hihingi nito".
- Also change "ang maling network ay nawawalang pera" to "puwedeng mawala ang pera kapag mali ang network".

**M9. `helpTopics.ts:747`** "at na-freeze ang account mo sa bagong paghiram"
- **Problem:** past tense. It reads as "your account has been frozen".
- **Fix:** "at mafe-freeze ang account mo sa bagong paghiram hangga't hindi naaayos".

**M10. `src/views/profile/components/settings/NotificationSettings.tsx:37-38`**
- **English:** "the moment a repayment is due, or when a borrower who already repaid you asks again".
- **Filipino:** "kapag malapit nang mag-due ang bayad mo, o kapag humiram ulit ang borrower…"
- **Problems:**
  - The timing changed from "is due" to "about to be due".
  - "bayad mo" assumes the reader is a borrower, but the text is also for lenders.
  - "humiram" (borrowed) is not "asks" (requests).
- **Fix:** "Makakatanggap ka ng abiso sa mismong oras na due na ang repayment, o kapag nag-request ulit ang borrower na nakabayad na sa iyo. Sa device na ito lang."

**M11. `src/views/dashboard/components/UpcomingLoanDues.tsx:29-30,67-68`**
- `dueIn` + `today` renders "Kailangang bayaran sa loob ng ngayong araw", which is ungrammatical. English "Due in today" is broken too.
- `daysRemaining <= 0` also covers overdue loans, which then show "today".
- **Fix:** add separate strings: "Due ngayong araw" / "Lampas na sa due date nang {n} araw".

**M12. `src/views/dashboard-v2/DashboardV2Rewards.tsx:287-289`** (placeholder mismatch)
- **English:** `Free meal for both of us! Join Moodeng Credit with my code ${code}:`
- **Filipino:** 'Libreng pagkain para sa ating dalawa! Sumali sa Moodeng Credit gamit ang code ko:', with no `${code}`.
- **Fix:** use a template literal: `…gamit ang code ko na ${code}:`

**M13. `src/views/account/Account.tsx:130`** signingOut "Nag-sign out..."
- **Problem:** past tense for a progress state.
- **Fix:** "Nagsa-sign out..."

**M14. "Verified" is spelled differently across screens.**
- Account.tsx:123-124: "Beripikado" / "Hindi beripikado"
- BorrowerVerificationBadge.tsx:18-19: "Beripikadong humihiram" / "Hindi verified"
- Everywhere else: "verified"
- **Fix:** "Verified" / "Hindi pa verified" / "Verified na borrower".

**M15. `faqs.ts:159`**
- **Filipino:** "nagkukulong sa tao sa cycle ng utang … nauuwi sila sa pagbabayad ng maraming beses ng orihinal nilang hiniram". This is awkward and drops "over and over".
- **Fix:** "…at ikinukulong ang mga tao sa paulit-ulit na utang. … kaya paulit-ulit silang nagbabayad nang ilang beses na mas malaki kaysa sa hiniram nila."

**M16. `helpTopics.ts:649`** "malalaking loan na palpak"
- **English:** "large loans repaid sloppily".
- **Problem:** the Filipino says the loans themselves failed.
- **Fix:** "malalaking loan na palpak ang pagbabayad".

**M17. `guides.ts:278`** "Credit Growth Loan"
- This mirrors the English at L56. Everywhere else the term is "Credit-Building Loan".
- **Fix:** use "Credit-Building Loan" in both languages.

**M18. `helpTopics.ts:331`** "dede-dead-end ang pag-connect ng wallet"
- **Fix:** "hindi natutuloy ang pag-connect ng wallet". Also change "Network ito, hindi ang phone o account mo" to "Sa network ang problema, hindi sa phone o account mo."

**M19. `src/app/role-selection/page.tsx:34`**
- **Filipino:** "Humiling ng panandaliang pautang, magbayad nang malinaw…"
- **Problem:** "magbayad nang malinaw" is a literal rendering of "repay clearly" and sounds odd. "panandaliang pautang" is a formal register that clashes with the app's Taglish.
- **Fix:** "Humiram ng short-term loan, magbayad nang on time at malinaw, at bumuo ng tiwala habang tumatagal."

**M20. `faqs.ts:145` (USDC)**
- It lists Coinbase and Kraken as off-ramps, which is of little use to PH users.
- **Fix:** in both English and Filipino, add the local ramps: "…Binance, Coins.ph, PDAX, o iba pang local on/off-ramps".

---

## LOW

**L1. English clause left inside Filipino text.**
- faqs.ts:113 "on or before the agreed date"
- guides.ts:298, 309 "on or before the (scheduled) deadline / due date"
- helpTopics.ts:114 "on or before ang petsang itinakda mo"
- **Fix:** "sa o bago ang napagkasunduang petsa".

**L2.** guides.ts:276: "fully nagbabayad" should be "nagbabayad nang buo".

**L3.** guides.ts:315
- **English:** "significantly streamlining the funding process".
- **Filipino:** "mas madali nilang ma-review".
- **Fix:** "kaya mas mabilis mapondohan ang mga susunod mong request".

**L4.** guides.ts:319
- **English:** "determine your future funding success".
- **Filipino:** "tumutulong sa" (helps).
- **Fix:** "nagtatakda ng".

**L5.** faqs.ts:154: "Hanggang doon" should be "Hanggang sa panahong iyon".

**L6.** faqs.ts:127, 185 and accountFaqs.ts:188 use "->" where English uses "→".

**L7.** accountFaqs.ts:144: "Paano ako ma-ve-verify?" should be "Paano ako magpa-verify?" This also matches stepContext.ts:98.

**L8.** accountFaqs.ts:166
- **English:** "exact amount due".
- **Filipino:** "eksaktong halaga".
- **Fix:** "eksaktong halagang dapat bayaran".

**L9.** accountFaqs.ts:207: "iisang totoong individual" should be "iisang totoong tao".

**L10.** accountFaqs.ts:131 mixes "nagpapahiram" and "lender" in the same answer.

**L11.** accountFaqs.ts:140 drops "almost anywhere". faqs.ts:145 drops "in seconds".

**L12.** helpTopics.ts:55
- **English:** "Fund your wallet…"
- **Filipino:** "Lagyan ng pondo at bayaran ang loan" (drops "wallet").
- **Fix:** "Lagyan ng pondo ang wallet mo at bayaran ang loan".

**L13.** helpTopics.ts:110: "nagpapalaki ng kredito" should be "bumubuo ng credit mo".

**L14.** helpTopics.ts:198: "pinakamatagal 1 business day" should be "pinakamatagal na ang 1 business day".

**L15.** helpTopics.ts:314
- The cross-reference "Ayaw mag-load ng Base sa Pilipinas" doesn't match the real topic title "Ayaw mag-load ng Base (PLDT / Smart)".
- English L308 has the same mismatch.

**L16.** helpTopics.ts:342: "madalas gumagana ang isa" should be "madalas gumagana ang kabila".

**L17.** helpTopics.ts:365: "tahimik na nabi-bigo" should be "madalas pumapalya nang walang lumalabas na error".

**L18.** helpTopics.ts:421: "ng dalawang beses" should be "nang dalawang beses". L418 already uses "nang".

**L19.** helpTopics.ts:444: "Magpadala ng USDC sa Base sa Repay address" should be "Magpadala ng USDC (Base network) sa repayment address".

**L20.** helpTopics.ts:498: "Konti ngayon, konti mamaya" should be "Kaunti ngayon, kaunti sa susunod". "mamaya" means later today.

**L21.** helpTopics.ts:502: "Mas mabuti ang bayad nang kaya mo … kaysa wala" should be "Mas mabuti nang magbayad ng kaya mo bago ang due date kaysa wala."

**L22.** helpTopics.ts:516
- Drops "some or all".
- "kung sabi ng app" should be "kung sinabi ng app".
- "humiling ng iba" should be "humiling ng panibago".

**L23.** helpTopics.ts:542: "ang bayad lang ay sa exchange mismo" should be "ang tanging bayad ay ang fee ng exchange".

**L24.** helpTopics.ts:559: "Ang ibang serbisyo ay nasa rate na ang margin nila" should be "Sa ibang serbisyo, kasama na sa rate ang margin nila". The numbers match English.

**L25.** helpTopics.ts:632
- "trust loans para aktibo" should be "para manatiling healthy ang activity mo".
- "kahit anong mas maliit sa limit mo" should be "kahit anong loan na mas mababa sa limit mo".

**L26.** "Paano tumaas ang credit limit ko?" should be "Paano ko mapapataas ang credit limit ko?"
- Appears at helpTopics.ts:602 and src/components/mecha/stepContext.ts:98, 117.

**L27.** src/components/mecha/mechaCopy.ts
- L69: "verify, wallet, panghihiram, o pag-cash out" should be "pag-verify, wallet, paghiram, o pag-cash out".
- L77: "May nangyaring mali sa akin" should be "Nagka-problema sa side ko".
- L106 uses the label 'Tagalog'/'TL', while the app calls it "Filipino".

**L28.** src/views/account/WalletBalanceCard.tsx
- L91: "Hindi na-copy" should be "Hindi nakopya".
- L80 writes "GCash (GCrypto)"; every other file uses "GCrypto (GCash)".

**L29.** Account.tsx:125: "Ikonek" vs "ikonekta" elsewhere. "Kanselahin" is stiff; "Huwag na" or "Cancel" would read more naturally.

**L30.** NotificationSettings.tsx:83-93
- "Activity ng account" vs "Aktibidad ng transaksyon" spell the same word differently.
- "Makatanggap ng updates" vs "Makakatanggap ka".

**L31.** Guides.tsx:42, 44: "Repayment" and "Security" are left in English while the sibling labels are translated. Use "Pagbabayad" / "Seguridad", or keep all in English.

**L32.** src/views/dashboard/components/DashboardHeader.tsx:11
- "Buksan ang Tulong at Suporta Center" should be "Buksan ang Sentro ng Tulong at Suporta", which matches Support.tsx.
- "Buod" for Dashboard is inconsistent with "Lender Dashboard" elsewhere.

**L33.** The same English source is translated two ways:
- GettingStarted.tsx:94, 97 vs Congratulations.tsx:51, 63: "Quick start para sa bagong users" / "Mabilisang simula para sa bagong gumagamit", and "bumuo ng trust" / "bumuo ng tiwala".
- "Getting started" is "Magsimula" in some places and "Pagsisimula" in others.

**L34.** World ID modal and nearby UI
- ModalHeader.tsx:26 and VerificationModalHeader.tsx:24: "I-verify na tao ka" should be "Patunayang totoong tao ka".
- HowItWorksSection.tsx:31: "I-click" should be "I-tap".
- HelpTopicCard.tsx:126: "Dalhin ang tanong na ito sa isang tao" should be "Itanong ito sa totoong tao sa team namin — babalikan ka namin."
- role-selection page.tsx:41: "Pribasiya" should be "Privacy".
- src/views/FAQ.tsx:14: the subtitle is almost entirely English.

---

## Missing Filipino entries

1. **guides.ts: no Filipino for `repaying-your-loan`, `adding-funds-to-your-wallet`, `withdrawing-to-your-bank`.** `getGuidesForLocale` falls back to English. HelpTopics links to them with Filipino labels ("Mga paraan ng pagbayad" and similar), and the link opens an English page. These guides carry the Base-network and lost-funds warnings plus the Coins.ph, GCrypto, PDAX and Moneybees steps. **Highest priority.**
2. **faqs.ts and accountFaqs.ts:** every id is present in Filipino.
3. **`src/views/support/data/updates.ts`:** no localization at all (5 changelog entries). Low priority.
4. **`src/components/verification/VerifyYourselfModal.tsx`:** the main "Verify Yourself" chooser (ID vs World ID / passport / Orb) has no locale support. It is fully English.
5. **DashboardV2 (preview-only route), English-only copy:**
   - `DashboardV2Popups.tsx`: MilestonePopup ("Repay on time, eat on us.", "A GrabFood voucher…", ₱50, CTAs) and VerifyPopup ("Verify My Identity… about 3 minutes", "Most used", "Verify with World ID"). `WEEKDAY_LETTERS` "SMTWTFS" should be "L L M M H B S".
   - `DashboardV2Banners.tsx`: WithdrawBanner ("Withdraw your USDC / Cash out your funded loan…"), plus the alt text on the verify and connect-wallet banners.
   - `DashboardV2.tsx:43-60`: the tour steps.
   - `DashboardV2Rewards.tsx`: "Copy/Copied/Share/Unavailable right now/Loading…".
6. **mechaCopy:** the Filipino object spreads the English one. That is fine, because every user-facing key is overridden.

---

## Exchange and service names, and USDC-on-Base claims

- **Filipino users see:** Binance P2P, Coins.ph, PDAX, GCrypto (GCash) in helpTopics, accountFaqs and WalletBalanceCard. Order and parentheses vary; see L28.
- **Moneybees** appears only in the untranslated English guides.
- **"Always choose Base"** is consistent everywhere.
- **GCrypto is described inconsistently.** The repay and add-funds guides (L123, L144) say "withdraw via USDCBASE". The withdraw guide (L174) only says "receive supported crypto and convert inside GCash". helpTopics cash-out (L530) tells users to send USDC on Base to GCrypto. Confirm that GCrypto accepts USDC-on-Base deposits and state it the same way everywhere.
- **Gas claims are not consistent.**
  - The FAQs and guides say transfers are "gasless / no network fees" with the Instant Wallet or a Base Account.
  - helpTopics instant-wallet says "Moodeng covers the network fees".
  - helpTopics cash-out-cost (L558) includes "the tiny network fee".
  - Reconcile these (likely that exchange withdrawal fees differ from on-Base transfers).
- **PDAX is called "BSP-regulated"** in English only (guides.ts:168).

---

## English source problems

1. **faqs.ts:72** "no government ID … just a verified World ID", and L72/L85 "linked to your wallet and World ID". Stale; the recommended verification uses a national ID. **HIGH.**
2. **accountFaqs.ts:76** "$15 → $20 → $40 → $60 — and beyond". It should say up to $140, the current maximum. **HIGH.**
3. **Wrong limit progression.**
   - helpTopics.ts:605 "On-time repayment earns Pandesal points, which move you up the levels" is wrong.
   - Also misleading: helpTopics.ts:113 "Every on-time repayment … unlocks a higher credit limit", L173 "Each on-time repayment grows your limit", L461, faqs.ts:94 "Each successful repayment grows your limit", accountFaqs.ts:56.
   - Only full-limit Credit-Building Loans raise the level. **HIGH.**
4. **guides.ts:56** "Credit Growth Loan" is a different term from "Credit-Building Loan", which is used everywhere else.
5. **accountFaqs.ts:65** says Trust-Building Loans "earn you more Pandesal points than borrowing your maximum would". The scoring gives 10 points per full on-time repayment regardless of size, so explain why (e.g. more loans repaid).
6. **helpTopics.ts:608, 677** say a referral code gives a $20 starting limit, but elsewhere "Everyone starts at Level 1 with a $15 limit". Add a caveat.
7. **UpcomingLoanDues.tsx:48, 67-68** render "Due in today", and overdue loans (negative days) also display "today". This is misleading about the deadline.
8. **guides.ts:96** "Verified Lending History" on a borrower-facing page should be "Repayment history".
9. **helpTopics.ts:308** cross-references "Base won't load in the Philippines", but the topic is titled "Base won't load (PLDT / Smart)".
10. **GCrypto is described differently across guides** (L123/L144 vs L174), and the gasless vs "tiny network fee" statements conflict. See the section above.
11. **faqs.ts:54** names Coinbase and Kraken as off-ramps, which is of limited use to PH users. Consider adding Coins.ph and PDAX.
12. **Capitalization:** guide titles mix "Pandesal points" (L40) and "Pandesal Points" (L72).
13. **DashboardV2.tsx:45-46** tour: "Trust & Pandesal" / "grow your trust" is borderline leftover "Trust" wording.
14. **role-selection page.tsx:28:** the copyright line is missing a period ("Moodeng Credit All Rights Reserved").
15. **Non-user-facing leftovers:** `Guides.tsx:17` still has the internal key 'Trust Score', and `GUIDE_CATEGORY_BY_SLUG` (L75-85) has no category for the three new money guides. They may not show up when a category filter is applied.
