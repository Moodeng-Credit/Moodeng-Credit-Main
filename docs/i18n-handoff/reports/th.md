# Thai (th) localization audit: Moodeng Credit (wt-seo checkout)

I only read files. Nothing was edited.

**Scope.** I reviewed every entry in the three sources you named:
- `thaiTranslations` in `src/i18n/translations.ts` (lines 332-427)
- `thaiScreenTranslations` in `src/i18n/screenTranslations.ts` (lines 1220-1374)
- all 11 inline `th:` blocks in components

I also found Thai text in three data files your grep pattern misses, because they switch on `locale === 'th'` instead of a `th:` key. They carry the most money-related text, so I reviewed them too:
- `src/views/support/data/faqs.ts` (THAI_FAQS, lines 280-357)
- `src/views/support/data/guides.ts` (THAI_GUIDES, lines 513-618)
- `src/views/account/data/accountFaqs.ts` (THAI_* arrays, lines 347-444)

## Summary

- **HIGH: 5. MEDIUM: 34. LOW: 24.**
- Placeholders are all preserved (`{language}`, `{points}`, `${name}`). Only one number conflicts with the English (H3).

**Top recurring problems**
1. **Stale or outdated content in the long-form Thai text.** The verification guides still describe the old World ID / Orb-only flow and promise a Worldcoin reward. Three money-handling guides have no Thai version at all.
2. **Heavy shortening of FAQ answers.** Numbers, the point-scoring table, the fee and business-model paragraph, and the "trust-building loans earn more points" point are all dropped.
3. **Inconsistent product terms:**
   - "Pandesal points" (English) vs "แต้ม Pandesal" vs "คะแนน"
   - "กระเป๋า" vs "กระเป๋าเงิน"
   - "ภาพรวม" vs "แดชบอร์ด"
   - "Credit Growth Loan" vs "Credit-Building Loan"
4. **Calques that read like machine translation:**
   - "ชื่อเสียง" used for reputation (it means fame)
   - "ให้ทุน" used for "fund" (should be ปล่อยกู้)
   - "จับเงิน", "ค่าเริ่มต้น" (means "default value"), "มัน"
5. **English left in Thai values:** Microloan, onchain, exchange, fraud, settle, network fee, trust loans / credit loans, Lender Dashboard.

---

## HIGH

**H1. `guides.ts:531-535`, guide "how-to-request-your-first-loan"**
- **English (steps 5-6):** "tap 'Verify Yourself' and complete the quick ID + selfie check ('Verify Your ID') — about 3 minutes. Already a World App user? You can choose 'Verify with World ID' instead."
- **Thai:** "ขั้นตอนที่ 5: ยืนยันตัวตน ดาวน์โหลด World App และยืนยันตัวตนมนุษย์ที่ World Orb จริง / ขั้นตอนที่ 6: เชื่อม World ID …" (seven steps against six in English)
- **Problem:** Stale flow. It tells Thai users they must download World App and go to a physical Orb, when the recommended path is a 3-minute ID + selfie check in the app. Users may give up or travel for nothing.
- **Fix:** "ขั้นตอนที่ 5: ยืนยันตัวตน — แตะ "ยืนยันตัวตน" แล้วเลือก "ยืนยันด้วยบัตรประชาชน" ถ่ายรูปบัตรประชาชนและเซลฟี่ ใช้เวลาประมาณ 3 นาที หากใช้ World App อยู่แล้ว สามารถเลือก "ยืนยันด้วย World ID" แทนได้". Then merge steps 6 and 7 back into six steps.

**H2. `guides.ts:602-609`, guide "verification-and-why-its-required"**
- **English:** ID + selfie is recommended; a human review takes at most 1 business day; "Your ID … is never stored by Moodeng"; World ID is the alternative.
- **Thai:** "…ยืนยันตัวตนมนุษย์ที่ไม่ซ้ำกันผ่าน World ID" and "รางวัล: ผู้ใช้ใหม่อาจรับรางวัล Worldcoin ได้หลังยืนยันสำเร็จ" and "ดาวน์โหลด World App ค้นหา Orb ใกล้คุณ…"
- **Problems:**
  - It promises a Worldcoin reward that the English no longer offers.
  - It says World ID / Orb is the only way to verify.
  - It leaves out the ID-not-stored privacy assurance and the review-time commitment.
  - "fraud" is left in English (line 605).
- **Fix:** Re-translate from the current English. Delete the reward bullet. Use "การฉ้อโกง" for fraud.

**H3. `faqs.ts:309`, FAQ "what-is-a-credit-level"**
- **English:** "…$120 → $140, which is the current maximum."
- **Thai:** "…$120 -> $140 และต่อไป"
- **Problem:** "และต่อไป" means "and onward", which tells users the limit keeps rising past $140. That is the opposite of the English.
- **Fix:** "…$120 → $140 ซึ่งเป็นวงเงินสูงสุดในขณะนี้". Also use → instead of -> and "ระดับ 1" instead of "Level 1".

**H4. `guides.ts`, three guides missing from THAI_GUIDES (lines 513-618)**
- **Missing guides:** `repaying-your-loan`, `adding-funds-to-your-wallet`, `withdrawing-to-your-bank`.
- **Problem:** `getGuidesForLocale` falls back to English, so Thai users read these in English. That includes the key warning: "always select Base as the network … Using the wrong network can result in lost funds."
- **Fix:** Add Thai versions, and localize the services for Thailand (for example Bitkub or Binance TH instead of GCash, Coins.ph, PDAX). At minimum, translate the warning: "สำคัญ: เลือกเครือข่าย Base ทุกครั้งเมื่อส่ง USDC หากเลือกเครือข่ายผิด เงินอาจสูญหายได้".

**H5 (please verify). `WalletBalanceCard.tsx:122-123`**
- **English:** "Buy USDC in GCash (GCrypto), Coins.ph, or the exchange you use." / "…choose the Base network."
- **Thai:** "ซื้อ USDC ในแอปแลกเปลี่ยนที่คุณใช้ (เช่น Bitkub)" / "…เลือกเครือข่าย Base"
- **Problem:** Localizing the example to Bitkub is a good idea. But if Bitkub does not support USDC withdrawals on the Base network, the named example steers users toward a wrong-network transfer and lost funds. I could not confirm Bitkub's Base support.
- **Fix:** Confirm with the team. If it isn't supported, name an exchange that is, or add "ตรวจสอบว่าแอปรองรับการถอน USDC บนเครือข่าย Base ก่อนส่ง".

---

## MEDIUM

### Terminology and consistency

**M1. "Pandesal points" left in English, and "คะแนน" used for points**
- The canonical term is "แต้ม Pandesal" (`screenTranslations.ts:1359-1360`, `Guides.tsx:58`, `accountFaqs.ts:388,397`).
- English "Pandesal points" still appears in:
  - `Account.tsx:184`, signOutBody. The same sentence in `screenTranslations.ts:1373` already says "แต้ม Pandesal".
  - `Support.tsx:148`
  - `GettingStarted.tsx:130`
  - `faqs.ts:283, 288, 299, 300`
- Points are also called "คะแนน" in `faqs.ts:302` and `guides.ts:550, 579`.
- **Fix:** Use "แต้ม Pandesal" everywhere, and "แต้ม" in follow-up references.

**M2. "ชื่อเสียง" used for reputation**
- **Where:**
  - `Welcome.tsx:66` "สร้างชื่อเสียงที่กระเป๋าของคุณพาไปได้ทุกที่"
  - `faqs.ts:288, 300` ("สัญญาณชื่อเสียง"), `faqs.ts:348`
  - `guides.ts:577`
  - `accountFaqs.ts:412` ("คะแนนชื่อเสียง")
  - `screenTranslations.ts:1363` "Reputation Milestones" → "เป้าหมายชื่อเสียง"
- **Problem:** ชื่อเสียง means fame or renown, which reads oddly in a credit context.
- **Fix:** Use "ความน่าเชื่อถือ" or "ประวัติเครดิต". For example:
  - `Welcome.tsx:66`: "คุณกำลังสร้างประวัติความน่าเชื่อถือที่ติดตัวไปกับกระเป๋าเงินได้ทุกที่"
  - `faqs.ts:300`: "…คือตัวชี้วัดความน่าเชื่อถือ…"
  - `screenTranslations.ts:1363`: "เป้าหมายความน่าเชื่อถือ"

**M3. Wallet term inconsistent**
- "กระเป๋า" in `screenTranslations.ts:1230, 1232, 1259, 1260, 1370`, `Welcome.tsx:66`, `Congratulations.tsx:113`, `faqs.ts:295, 314`, `guides.ts:525-529`, `accountFaqs.ts:353`.
- "กระเป๋าเงิน" in `screenTranslations.ts:1369`, `Account.tsx`, `WalletBalanceCard.tsx`, `Guides.tsx`.
- **Fix:** Standardize on "กระเป๋าเงิน", for example "เชื่อมต่อกระเป๋าเงิน" and "ยังไม่ได้เพิ่มกระเป๋าเงิน".

**M4. Dashboard term inconsistent**
- "ภาพรวม" in `translations.ts:351` and `screenTranslations.ts:1265`.
- "แดชบอร์ด" in `translations.ts:376`.
- English "Lender Dashboard" in `accountFaqs.ts:442`.
- **Fix:** Pick one. I suggest "แดชบอร์ด", so the FAQ reads "แดชบอร์ดผู้ให้กู้".

**M5. Loan-type names inconsistent (`guides.ts:561, 572`)**
- Line 561 uses "Credit Growth Loan", while everywhere else says "Credit-Building Loan".
- Line 572 leaves "trust loans" / "credit loans" in English lowercase, and translates "keep activity healthy" as "รักษาประวัติให้แข็งแรง", which is odd.
- **Fix:**
  - Line 561: "…ด้วย Credit-Building Loan เท่านั้น…"
  - Line 572: "…ใช้ Trust-Building Loan เพื่อรักษาความต่อเนื่องของประวัติการชำระ และใช้ Credit-Building Loan เพื่อเพิ่มวงเงินไปเรื่อย ๆ"
- The English source is inconsistent too (`guides.ts:56` says "Credit Growth Loan").

**M6. "Microloan" untranslated (`translations.ts:406`, `screenTranslations.ts:1298`)**
- **Current:** "กระดานคำขอ Microloan"
- **Fix:** "กระดานคำขอสินเชื่อรายย่อย" or "กระดานคำขอเงินกู้รายย่อย"

**M7. "Academy" inconsistent (`GettingStarted.tsx:130`)**
- **Current:** "เรียนรู้เพิ่มเติมที่ Academy", while `translations.ts:368` uses "อะคาเดมี".
- **Fix:** Use one form in both places.

**M8. "onchain" and "exchange" left in English**
- `Welcome.tsx:65` "รับผลตอบแทน onchain ด้วย Base" → "รับผลตอบแทนแบบออนเชนบน Base"
- `accountFaqs.ts:377, 386` "exchange" → "ศูนย์ซื้อขายคริปโต" or "แพลตฟอร์มแลกเปลี่ยน"
- `translations.ts:357` "บนเชน": align it with the same term.

### Wording that could confuse about money or status

**M9. Active (`screenTranslations.ts:1225-1227, 1306`)**
- **Current:** "ใช้งานอยู่" / "เงินกู้ที่ใช้งานอยู่"
- **Problem:** "In use" is unnatural for a loan.
- **Fix:** "กำลังดำเนินอยู่" / "เงินกู้ที่ยังไม่ปิด". For the status badge, use "อยู่ระหว่างกู้".

**M10. Funded (`screenTranslations.ts:1339`)**
- **Current:** "ได้รับเงินแล้ว"
- **Problem:** It is used in the loan timeline that both sides see. For a lender, "received money" is misleading.
- **Fix:** A neutral "ปล่อยกู้แล้ว" or "ได้รับการสนับสนุนเงินแล้ว".

**M11. Outstanding (`screenTranslations.ts:1313`)**
- **Current:** "ยอดค้างชำระ"
- **Problem:** Thai users often read this as arrears or overdue.
- **Fix:** "ยอดคงเหลือที่ต้องชำระ"

**M12. "ให้ทุน" used for "fund" (awkward calque)**
- **Where:** `role-selection/page.tsx:67` ("ให้ทุนคำขอเงินกู้"), `faqs.ts:295, 302, 330, 355`, `accountFaqs.ts:412, 432, 440`.
- **Fix:** Use "ปล่อยกู้" or "สนับสนุนเงินกู้". For example:
  - `role-selection/page.tsx:67`: "ปล่อยกู้ตามคำขอและรับผลตอบแทนจากการสนับสนุนผู้ยืมที่น่าเชื่อถือ"
  - `accountFaqs.ts:432`: "ฉันจะปล่อยกู้ได้อย่างไร?"

**M13. "ค่าเริ่มต้น" and related fee wording (`faqs.ts:330, 355`)**
- **English:** "no setup costs" / "no monthly subscriptions"
- **Current:** "ไม่มีค่าเริ่มต้น" / "ค่าสมัครรายเดือน"
- **Problem:** "ค่าเริ่มต้น" means "default value" in Thai UI language, so it doesn't read as a fee.
- **Fix:** "ไม่มีค่าธรรมเนียมแรกเข้า" / "ไม่มีค่าสมาชิกรายเดือน". Also at line 332, change "ค่า network fee หรือ gas" to "ค่าธรรมเนียมเครือข่าย (ค่า gas)".

**M14. `accountFaqs.ts:350`, "Does Moodeng touch my money?"**
- **Current:** "Moodeng จับเงินของฉันไหม?"
- **Problem:** A literal "physically touch", which is confusing. Line 351 also has "ไม่ย้ายเงิน".
- **Fix:** "Moodeng เข้าถึงหรือถือเงินของฉันไหม?" and "ไม่ Moodeng ไม่ได้ถือ เก็บรักษา หรือโอนเงินของผู้ใช้แทนคุณ".

**M15. Philippine services shown to Thai users (`accountFaqs.ts:377, 386`)**
- **Current:** Coins.ph, PDAX, GCrypto (GCash).
- **Problem:** This conflicts with `WalletBalanceCard`, which already localizes to Bitkub.
- **Fix:** Localize to services available in Thailand.

### Omissions against the English

**M16. `faqs.ts:330-332` (fees).** The whole paragraph about the business model is missing ("We don't take a cut… IOU token… airdrop to active lenders… fully fee-free"). The bare "ไม่" at the start of the answer should be "ไม่มี".

**M17. `faqs.ts:324-326` (USDC).**
- Missing: "$20 loan today is still $20", bank transfers taking days, the 10–20% volatility, and exchange examples. The added line "รับ ถือ แปลงเป็นเงินท้องถิ่น" is fine.
- Line 322 question "ทำไม Moodeng ใช้มัน?" uses the informal "มัน". Fix: "ทำไม Moodeng จึงใช้ USDC?"

**M18. `faqs.ts:337-339` (loan sharks).**
- Missing: "20–100% weekly interest", "$15–$60 at Credit Levels 1–4", "accepted (or passed on)", and paragraphs 3 and 4.
- "ยอมรับโดยผู้ให้กู้" is a passive calque. Fix: "ผู้ยืมเป็นผู้กำหนดอัตราดอกเบี้ย และผู้ให้กู้เลือกได้ว่าจะรับหรือไม่".

**M19. `faqs.ts:344-348` (credit-building loan).** Missing the advice sentence ("if your goal is to build credit… take out and repay full-limit Credit-Building Loans") and the paragraph saying Moodeng does not report to a credit bureau.

**M20. `faqs.ts:353-355` (small loan).**
- Missing "bridging gaps before payday" and the final paragraph on the $15 → $140 progression and maximum.
- "คือสิ่งที่ Moodeng สร้างมาเพื่อทำ" is an awkward calque. Fix: "Moodeng ถูกออกแบบมาเพื่อเงินกู้ขนาดเล็กโดยเฉพาะ".

**M21. `faqs.ts:295`, "on or before the agreed date"**
- **Current:** "ชำระคืนในหรือก่อนวันที่ตกลง"
- **Fix:** "ชำระคืนภายในวันที่ตกลงกันไว้"

**M22. `guides.ts:577-579` (how repayments affect points).**
- The scoring numbers are missing: 10 points maximum; 75% = 7, 50% = 5, 25% = 3; late payment = 0.
- The "small loans repaid cleanly are more valuable…" line is also dropped.
- **Fix:** Restore the full breakdown.

**M23. `guides.ts:584-588` (benefits of on-time repayment).**
- The scoring breakdown and the "Successfully Repaid" status are missing.
- "เมื่อ USDC settle แล้ว" should be "เมื่อการโอน USDC เสร็จสมบูรณ์".

**M24. `accountFaqs.ts:395-397` (borrow below limit).**
- The Thai drops the claim that Trust-Building Loans earn *more* Pandesal points than borrowing the maximum. It also drops the parenthetical on how to level up and the closing line. This weakens the difference between trust-building and credit-building loans.
- **Fix:** "…แต่ช่วยสร้างประวัติการชำระคืน และได้แต้ม Pandesal มากกว่าการยืมเต็มวงเงิน (หากต้องการเลื่อนระดับ ต้องยืมเต็มวงเงินและชำระคืนตรงเวลา)".

**M25. `accountFaqs.ts:402-404` (increase credit limit).**
- The progression "$15 → $20 → $40 → $60…" and "borrow your max, repay on time, repeat" are missing.
- "ชำระดีมาก" should be "ชำระครบถ้วนตรงเวลา".

**M26. `accountFaqs.ts:412-414` (IOU Points).**
- Missing "Holding IOU will unlock additional benefits" and the whole "IOU is for lenders only — borrowers build Pandesal points and Credit Level instead" paragraph.
- "สถานะผู้ยืม" for "borrower-stage" should be "ระดับขั้นของผู้ยืม".

**M27. `accountFaqs.ts:428` (lender FAQ on how borrowers increase their limit).** The Trust-Building Loan paragraph is missing entirely.

### Button labels, register and coverage

**M28. English button labels in `guides.ts:523, 529, 538`**
- The guide says "Apply for a Loan", "Connect Wallet" and "Explore the Request Board", but the Thai UI shows "ขอเงินกู้" (`screenTranslations.ts:1229`), "เชื่อมต่อกระเป๋า" (`screenTranslations.ts:1259`) and "สำรวจกระดานคำขอ" (`Congratulations.tsx:124`).
- The same applies to "Verify Yourself" / "Verify Your ID" in `accountFaqs.ts:365, 367` and "Fund" in `accountFaqs.ts:435`, if those buttons are localized.
- **Fix:** Quote the Thai labels.

**M29. `Congratulations.tsx:104`, "What's Next?"**
- **Current:** "ต่อไปคืออะไร?" (machine-translation phrasing)
- **Fix:** "ขั้นตอนต่อไป"

**M30. "Milestones" (`screenTranslations.ts:1299, 1364-1365`)**
- **Current:** "เป้าหมาย", which means goals or targets.
- **Fix:** "หมุดหมาย" or "ภารกิจ", used the same way in all three entries.

**M31. `translations.ts:411`, Guest User**
- **Current:** "ผู้ใช้ทั่วไป" (general user)
- **Fix:** "ผู้เยี่ยมชม"

**M32. `guides.ts:552` and `faqs.ts:322`.** Informal "มัน" for things in help text. Fix line 552: "…จึงติดตัวคุณไปได้…"

**M33. Coverage gap.** `thaiScreenTranslations` has about 150 entries, while Filipino has about 1,060. Many screens fall back to English for Thai users, for example the IOU explainers (Filipino at `screenTranslations.ts:799-805` has no Thai counterpart).

**M34. `guides.ts:550`.** "สัญญาณเร็ว ๆ" is too colloquial. Fix: "ตัวชี้วัดเบื้องต้น".

---

## LOW

**L1. `translations.ts:395` / `screenTranslations.ts:1239`**
- "Borrow USDC to build trust. Unlock higher levels." → "ยืม USDC และปลดล็อกระดับที่สูงขึ้น" drops "build trust".
- Fix: "ยืม USDC สร้างความน่าเชื่อถือ ปลดล็อกระดับที่สูงขึ้น"

**L2. `translations.ts:396` / `screenTranslations.ts:1240`.** "คำขอล่าสุด" drops "Browse". Fix: "ดูคำขอล่าสุด"

**L3. `translations.ts:347` / `screenTranslations.ts:1348, 1350`.** "สมัคร" should be "สมัครสมาชิก" (and "กำลังสมัครสมาชิก...").

**L4. `translations.ts:338` and `Welcome.tsx:76`.** "ดูวิธีทำงาน" / "เรียนรู้วิธีทำงาน" should be "ดูวิธีการทำงาน" / "เรียนรู้วิธีการทำงาน".

**L5. `screenTranslations.ts:1282, 1355` and `translations.ts:386`.** Help and Support are both "ช่วยเหลือ". Fix: Support → "ฝ่ายช่วยเหลือ"

**L6. `screenTranslations.ts:1268`.** Defaulted "ผิดนัด" → "ผิดนัดชำระ"

**L7. `screenTranslations.ts:1278`.** Failed "ล้มเหลว" → "ไม่สำเร็จ"

**L8. Repay wording**
- `screenTranslations.ts:1315, 1330`: Paid and Repaid are both "ชำระแล้ว". Fix: Repaid → "ชำระคืนแล้ว"
- `screenTranslations.ts:1329` / `translations.ts:354`: Repay "ชำระ" → "ชำระคืน"
- `screenTranslations.ts:1333`: "ชำระตอนนี้" → "ชำระเลย"

**L9. `screenTranslations.ts:1317`.** "จำนวนที่ต้องชำระคืน" → "ยอดที่ต้องชำระคืน"

**L10. `guides.ts:543, 546, 552, 575, 577, 607`.** A stray space before "แต้ม Pandesal" (search-and-replace leftover), e.g. "ทำความเข้าใจ แต้ม Pandesal", "ต่อ แต้ม Pandesal". Also "ได้ 0 แต้ม สำหรับ" at line 579.

**L11. Punctuation**
- `Support.tsx:134`: "สวัสดี, ${name}" → "สวัสดีคุณ ${name}"
- `Support.tsx:148`, `GettingStarted.tsx:130`, `accountFaqs.ts:386`: English-style commas in Thai lists should be spaces or "และ".

**L12. `Account.tsx:174, 176`.** getInTouch and contact are both "ติดต่อเรา" (a heading and an item under it). Fix: heading → "ช่องทางติดต่อ"

**L13. `Account.tsx:183`.** "ออกจากระบบ?" → "ต้องการออกจากระบบใช่ไหม?"

**L14. `WalletBalanceCard.tsx:125`.** "มีเพียงคุณเท่านั้นที่ย้ายเงินนี้ได้" → "มีเพียงคุณเท่านั้นที่โอนหรือถอนเงินนี้ได้"

**L15. `Welcome.tsx`**
- Line 64: "ให้กู้กับคนจริง" → "ปล่อยกู้ให้คนจริง"
- Lines 75-76: "อัตรา" → "อัตราดอกเบี้ย"
- Line 67: "ปลดล็อกเพิ่มขึ้น" is vague → "ปลดล็อกวงเงินที่สูงขึ้น"

**L16. `role-selection/page.tsx:62`.** "ชำระคืนอย่างชัดเจน" is literal and odd. Fix: "ชำระคืนอย่างโปร่งใส"

**L17. `faqs.ts:309, 346` and `guides.ts:559`.** "Level 1" → "ระดับ 1"

**L18. `faqs.ts:314-316`**
- "ถูก" (cheap) can also read as "correct". Fix: "ค่าธรรมเนียมต่ำ"
- "export key" → "ส่งออกคีย์"
- "ไม่มี seed phrase": the English says there is no seed phrase *to write down*. Fix: "ไม่ต้องจด seed phrase"

**L19. `faqs.ts:330` and `accountFaqs.ts:351`.** A bare "ไม่" at the start of the answer reads curt. Fix: "ไม่มี" or "ไม่เลย"

**L20. `guides.ts` THAI_GUIDES `lastUpdated`.** "Jun 9, 2026" is not localized. Fix: "9 มิ.ย. 2026" (or 2569 in the Buddhist calendar).

**L21. `guides.ts:517`.** The YouTube walkthrough link from the English is missing.

**L22. `guides.ts:579`.** "เครื่องหมายถาวร" → "ประวัติผิดนัดชำระถาวร"

**L23. `Congratulations.tsx:113`.** "การฝาก" → "การฝากเงิน"

**L24. `accountFaqs.ts` minor omissions and redundancy**
- Line 358: the fiat-conversion paragraph is missing.
- Line 421: the "banned users can't return" line is missing.
- Line 435: "immediately / no middleman" and the dashboard paragraph are missing.
- Line 440: "วันครบกำหนดถูกกำหนดโดยผู้ยืม" repeats กำหนด. Fix: "ผู้ยืมเป็นผู้ตั้งวันครบกำหนด…"

---

## Problems in the English source (not Thai)

- `faqs.ts:72` says "no government ID … required", which contradicts the ID + selfie verification.
- `guides.ts:56` uses "Credit Growth Loan" while everything else says "Credit-Building Loan".
- The copyright year is 2025 in `translations.ts:62` and 2026 in `role-selection/page.tsx:27`.