# Vietnamese (vi) localization audit: Moodeng Credit (wt-seo checkout)

I only read files. Nothing was edited.

## Summary
- **Scope.** I reviewed all 95 keys in `vietnameseTranslations` and all 152 entries in `vietnameseScreenTranslations`, plus the inline `vi:` blocks in 11 components.
- **Extra files.** The grep also led to Vietnamese content blocks that the requested sources don't cover. I reviewed those too:
  - `src/views/support/data/guides.ts` (`VIETNAMESE_GUIDES`)
  - `src/views/support/data/faqs.ts` (`VIETNAMESE_FAQS`)
  - `src/views/account/data/accountFaqs.ts` (`VIETNAMESE_*_FAQS`)
  
  Most serious problems are in these three files.
- **Counts:** HIGH 4, MEDIUM 26, LOW 20.
- **What is clean:** No placeholder mismatches (`{language}`, `{points}` and `${name}` are all intact). No diacritic or spelling errors. No stale "Trust Score" or "Điểm tin cậy" text: the `'Trust Score'` key correctly maps to "Điểm Pandesal". The bạn register is consistent.

**Top recurring problems:**
1. **Stale or diverged long-form content.** The Vietnamese guides and FAQs are older, condensed versions of the English. The verification flow is outdated (World Orb only), they promise a Worldcoin reward, one says the $140 limit keeps rising "and continues", and scoring numbers are missing.
2. **Credit Level has no single term.** It appears as "Cấp tín dụng", "Hạng tín dụng", "Level 1", "hạng tín dụng 1" and "cấp".
3. **Pandesal points has two forms.** Some places say "Pandesal points", others "điểm Pandesal". The same English sentence is translated both ways.
4. **English left in the Vietnamese text.** Examples: "Credit Growth Loan", "trust loans / credit loans", "full-limit", "settle", "Microloan", "Dashboard", "Lender Dashboard", "Level 1". Guide text also quotes English button labels that don't match the Vietnamese UI.
5. **Whole guides not translated.** Three money-movement guides and the "How Credit Levels work" page fall back to English.

---

## HIGH

**H1. guides.ts:636-645** (`how-to-request-your-first-loan`, steps 5–7)
- **EN:** Step 5 says "tap 'Verify Yourself' and complete the quick ID + selfie check ('Verify Your ID') — about 3 minutes. Already a World App user? You can choose 'Verify with World ID'". The guide has 6 steps.
- **VI:** "Bước 5: Tải World App và hoàn tất xác minh người thật tại địa điểm World Orb." Then "Bước 6: … bấm 'Verify with World ID' và quét QR code", then a Step 7.
- **Problem:** This is the old flow. It tells users they must visit an Orb, which is no longer the default, and the step count differs. There is also an added "Lưu ý về hạn mức tín dụng" block that isn't in the English, and the video link is missing.
- **Fix:** Retranslate from the current English: "Bước 5: Xác minh danh tính — Để đảm bảo an toàn cho cộng đồng, bấm «Xác minh danh tính» và hoàn tất bước chụp giấy tờ tùy thân + selfie (khoảng 3 phút). Đã dùng World App? Bạn có thể chọn «Xác minh bằng World ID».", then "Bước 6: Gửi yêu cầu…".

**H2. guides.ts:707-716** (`verification-and-why-its-required`)
- **EN:** Recommends ID + selfie (about 3 min; human review within at most 1 business day; the ID is never stored by Moodeng), with World ID as the alternative. There is no reward bullet.
- **VI:** Describes World ID and Orb only, and adds "- Phần thưởng: người dùng mới có thể nhận phần thưởng Worldcoin sau khi xác minh thành công."
- **Problem:** It promises a financial reward the product no longer describes. It also gives the wrong process and leaves out the privacy statement and the review times.
- **Fix:** Retranslate the full current English and remove the Worldcoin reward bullet.

**H3. faqs.ts:388** (`what-is-a-credit-level`)
- **EN:** "…$120 → $140, which is the current maximum."
- **VI:** "…$120 -> $140, và tiếp tục."
- **Problem:** "và tiếp tục" means "and it continues", so it tells borrowers the limit rises past $140. That's wrong about their borrowing limit.
- **Fix:** "…$120 → $140 — đây là mức tối đa hiện tại."

**H4. guides.ts:620-725** (three guides missing from `VIETNAMESE_GUIDES`)
- **Missing slugs:** `repaying-your-loan`, `adding-funds-to-your-wallet`, `withdrawing-to-your-bank`.
- **Problem:** Vietnamese users see these in English. These are the step-by-step instructions for moving money, including the warning "Using the wrong network can result in lost funds."
- **Fix:** Add translations. At minimum, translate the "luôn chọn mạng Base… chọn sai mạng có thể khiến bạn mất tiền" warnings.

---

## MEDIUM

**Terminology and consistency**

**M1. Credit Level has several translations.**
- "Cấp tín dụng": screenTranslations.ts:1517.
- "Hạng tín dụng": Guides.tsx:68, Support.tsx:182, GettingStarted.tsx:145-146, Congratulations.tsx:149, guides.ts:662/666, faqs.ts:365/384, accountFaqs.ts:489.
- "Level 1": guides.ts:666, faqs.ts:388.
- "hạng tín dụng 1": faqs.ts:425.
- "cấp" / "cấp vay": translations.ts:491, screenTranslations.ts:1394/1521.
- **Fix:** Use "Hạng tín dụng" everywhere, "Hạng 1" for levels, and "hạng vay cao hơn" for "higher loan levels". Or keep "Credit Level" untranslated throughout.

**M2. Pandesal points appears in two forms.**
- "Pandesal points": Account.tsx:211, Support.tsx:182, GettingStarted.tsx:146, faqs.ts:361/367/378/379.
- "điểm Pandesal": screenTranslations.ts:1515-1529, guides.ts, accountFaqs.ts.
- **Same sentence, two translations:** "You can sign back in anytime. Your Pandesal points stay with your wallet."
  - screenTranslations.ts:1529: "Điểm Pandesal vẫn đi cùng ví của bạn"
  - Account.tsx:211: "Pandesal points vẫn đi cùng ví của bạn"
- **Fix:** Use "điểm Pandesal" everywhere. That matches the id and th pattern.

**M3. Loan-type names left in English, and inconsistent.**
- guides.ts:668: "Credit Growth Loan". It should be the same term as "Credit-Building Loan"; the English source is inconsistent too.
- guides.ts:679: "trust loans … credit loans".
- accountFaqs.ts:527: "khoản full-limit".
- **Why it matters:** Trust-building and credit-building are separate concepts, so the terms need to stay fixed.
- **Fix:** On first use, write "khoản vay xây dựng tín dụng (Credit-Building Loan)" and "khoản vay xây dựng niềm tin (Trust-Building Loan)", then use those forms consistently. Replace "full-limit" with "vay đủ hạn mức".

**M4. Guide text quotes English button labels that don't match the Vietnamese UI.**
- guides.ts:630 "Apply for a Loan": the UI shows "Yêu cầu khoản vay".
- guides.ts:634 "Connect Wallet": the UI shows "Kết nối ví".
- guides.ts:645 "Explore the Request Board": the UI shows "Khám phá Bảng yêu cầu".
- accountFaqs.ts:534 "bấm Fund".
- accountFaqs.ts:464/466 "Verify Your ID" / "Verify Yourself": only a problem if those screens are localized.
- **Fix:** Quote the Vietnamese labels.

**M5. Dashboard is inconsistent.**
- translations.ts:473 `nav.dashboard` is "Dashboard".
- `bottomNav.dashboard` and screenTranslations.ts:1421 use "Tổng quan".
- accountFaqs.ts:541 has "Lender Dashboard".
- **Fix:** Use "Tổng quan" everywhere; "Tổng quan người cho vay" for the lender version.

**M6. "Microloan" untranslated.**
- translations.ts:503 and screenTranslations.ts:1454: "Bảng yêu cầu Microloan".
- **Fix:** "Bảng yêu cầu vay nhỏ" (or "vay vi mô").

**M7. HowCreditLevelsWork.tsx is not localized.**
- GuideDetail.tsx renders this component for `how-credit-levels-work`, so Vietnamese users see English.
- The Vietnamese body at guides.ts:662-668 is never shown.

**Omissions and meaning drift in long-form text**

**M8. guides.ts:682-686** (`how-repayments-affect-your-trust-score`)
- Leaves out the scoring numbers (on-time full = 10 points; 75% = 7, 50% = 5, 25% = 3) and the point that "small loans repaid cleanly are more valuable".
- The title "Khoản trả ảnh hưởng điểm Pandesal như thế nào" is awkward.
- **Fix:** Retitle as "Việc trả nợ ảnh hưởng đến điểm Pandesal như thế nào" and add the breakdown.

**M9. guides.ts:692-695** (`what-happens-when-you-repay-a-loan-on-time`)
- "khi chuyển USDC settle" leaves English in place. Use "khi giao dịch USDC hoàn tất".
- Leaves out the "Successfully Repaid" status name, the $15 → $20 example, and the whole scoring breakdown.

**M10. guides.ts:655 and faqs.ts:379**
- "phản ánh bạn trả các khoản vay … đáng tin cậy đến mức nào" is an unnatural calque.
- **Fix:** "Điểm Pandesal phản ánh mức độ đáng tin cậy trong việc trả nợ của bạn trên Moodeng Credit."

**M11. faqs.ts:402-405** (`what-is-usdc`)
- Drops "regulated US financial company", the comparison with bank transfers, the "Bitcoin/ETH swing 10–20%" point, and the exchange list.
- Adds a sentence that isn't in the English.
- **Fix:** Retranslate in full.

**M12. faqs.ts:409-411** (`does-moodeng-charge-fees`)
- Leaves out the whole third paragraph about the IOU token business model.
- "gói tháng" is unclear; use "phí thuê bao hàng tháng".
- "100% tiền người cho vay cấp đến người vay" is awkward; use "được chuyển đến".

**M13. faqs.ts:416-418** (`fight-loan-sharks`)
- Leaves out "20–100% weekly interest", "$15–$60 at Credit Levels 1–4", the whole paragraph on "no collateral…, phone…, reputation travels", and the closing paragraph.

**M14. faqs.ts:421-427** (`what-is-credit-building-loan`)
- Leaves out "the progression keeps going", the "if your goal is to build credit…" guidance, and the paragraph about not reporting to a credit bureau and being tracked on-chain.
- "hạn mức hạng tín dụng hiện tại" is clumsy; use "toàn bộ hạn mức hiện tại".

**M15. faqs.ts:432-435** (`small-loan`)
- Leaves out the third paragraph: the $15 → … → $140 maximum progression and the "start small" advice.

**M16. faqs.ts:393/397** (`what-is-a-base-wallet`)
- "xuất key" should be "xuất khóa riêng (private key)".
- "Bạn có thể kết nối nó thay thế" is a calque; use "Bạn có thể kết nối Base Account thay cho Instant Wallet".
- Leaves out "12-word recovery phrase / sign in with email or passkey" and "the lender gets every cent back".

**M17. accountFaqs.ts:449**
- "Moodeng có chạm vào tiền của tôi không?" translates "touch" literally.
- **Fix:** "Moodeng có nắm giữ tiền của tôi không?"

**M18. accountFaqs.ts:456-459** (`why-usdc`)
- "phí mạng ăn vào khoản trả" is a calque of "eat into". Use "không có phí mạng nào bị trừ vào khoản trả của bạn".
- Leaves out "Issued by Circle, a regulated…", the lines "100% of what you send reaches your lender" and "not take on currency risk", and the whole third paragraph (fiat conversion).

**M19. accountFaqs.ts:494-496** (`borrow-below-limit`)
- **EN:** "…earn you more Pandesal points than borrowing your maximum would", plus the parenthetical "(for that, you need to borrow your full limit and repay on time)".
- **VI:** "giúp bạn kiếm nhiều điểm Pandesal hơn". The comparison and the level-up rule are both gone, so the reader can't tell what "more" is compared with.
- Also missing: the last paragraph ("If you want to grow your reputation quickly…").
- "chúng tôi thật sự khuyến nghị" should be "chúng tôi còn khuyến khích".

**M20. accountFaqs.ts:501-503** (`increase-credit-limit`)
- Leaves out "Progression goes $15 → $20 → $40 → $60 — and beyond. …borrow your max, repay on time, repeat."
- "trả hoàn hảo" should be "trả đầy đủ, đúng hạn". "nâng trần" should be "nâng hạn mức".

**M21. accountFaqs.ts:511-513** (`what-are-iou-points`)
- Leaves out "They track who's actively supporting the community", "Holding IOU will unlock additional benefits", and the whole paragraph "IOU is for lenders only — borrowers build Pandesal points and Credit Level…".
- "mô hình năm 1" should be "mô hình Năm thứ nhất". "bonus theo giai đoạn người vay" should be "điểm thưởng theo giai đoạn của người vay".

**M22. accountFaqs.ts:527** (`how-borrowers-increase-credit-limit`)
- Leaves out the second paragraph (a below-limit loan is a Trust-Building Loan, does not level up, but builds the repayment record). This is the distinction between the two loan types.
- "lấy Credit-Building Loan" should be "thực hiện khoản vay xây dựng tín dụng".

**Short UI strings**

**M23. translations.ts:492 and screenTranslations.ts:1395**
- **EN:** "Borrow USDC to build trust. Unlock higher levels."
- **VI:** "Vay USDC và mở khóa cấp cao hơn."
- **Problem:** "build trust" is dropped. The long version (line 491) keeps it.
- **Fix:** "Vay USDC để xây dựng niềm tin. Mở khóa hạng cao hơn."

**M24. screenTranslations.ts:1436** `Full` → "Đầy đủ"
- This is the repay quick-select next to 25% / 50% / 75% (Repay.tsx:55). "Đầy đủ" reads as "complete / detailed".
- **Fix:** "Toàn bộ" (or "Trả hết").

**M25. screenTranslations.ts:1491** `Repayments` → "Khoản trả"
- A fragment; this is the dashboard summary label.
- **Fix:** "Trả nợ" or "Các lần trả nợ".

**M26. translations.ts:504-505** (`site.footerBlurb`)
- "…lịch sử trả nợ có thể mang theo cho người vay xây dựng tín dụng ở nước ngoài" is ambiguous; it can be read as "carry for the borrower".
- **Fix:** "…và lịch sử trả nợ mang theo được, dành cho người vay đang xây dựng tín dụng ở nước ngoài."

---

## LOW

- **L1.** translations.ts:493 / screenTranslations.ts:1396: "Browse Latest Requests" → "Yêu cầu mới nhất" has no verb. Use "Xem yêu cầu mới nhất".
- **L2.** translations.ts:502 `takeTour` / screenTranslations.ts:1483 "Quick tour" → "Xem nhanh". Use "Tham quan nhanh".
- **L3.** translations.ts:510 / screenTranslations.ts:1441: "Cách xác minh?" is terse. Use "Làm sao để được xác minh?"
- **L4.** translations.ts:509 "Người dùng khách" → "Khách".
- **L5.** translations.ts:453 "Copyright © 2025…" → "Bản quyền © 2025 Moodeng Credit | Bảo lưu mọi quyền".
- **L6.** screenTranslations.ts:1447: "Lent by" → "Cho vay bởi" is a passive calque. Use "Người cho vay:".
- **L7.** faqs.ts:388 uses ASCII "->"; everywhere else uses "→".
- **L8.** guides.ts, every `lastUpdated` value: "Jun 9, 2026" is an English date format. Use "09/06/2026" or "9 thg 6, 2026".
- **L9.** Congratulations.tsx:154: "với sự tự tin" is a calque. Use "…và tự tin bắt đầu hành trình của mình."
- **L10.** accountFaqs.ts:466: "Hầu hết hoàn tất trong vài phút" has no subject. Use "Hầu hết lượt xác minh hoàn tất trong vài phút". Also "app" and "ứng dụng" are mixed; use "ứng dụng".
- **L11.** accountFaqs.ts:538: "Khi nào tôi được trả?" → "Khi nào tôi nhận được tiền trả nợ?"
- **L12.** accountFaqs.ts:518: "phát hiện trùng khuôn mặt" is narrower than the English "duplicate detection"; use "phát hiện trùng lặp". It also leaves out "banned users can't return with a new account" (line 520).
- **L13.** accountFaqs.ts:450: "tiền của người dùng thay bạn" mixes người dùng and bạn. Use "Moodeng không giữ, lưu ký hoặc chuyển tiền thay bạn."
- **L14.** WalletBalanceCard.tsx:143: the English names GCash (GCrypto) / Coins.ph, while the Vietnamese says "ví dụ Binance". This may be a deliberate local choice; please confirm. By contrast, accountFaqs.ts:476/485 still list Philippine services (Coins.ph, PDAX, GCash) to Vietnamese users.
- **L15.** translations.ts:477 `nav.faq` and Support.tsx:187 use "FAQ", while other places use "Câu hỏi thường gặp". Pick one.
- **L16.** translations.ts:465 `nav.academy` is "Học viện", but GettingStarted.tsx:146 says "Academy". Pick one.
- **L17.** "IOU Points" (translations.ts:523, accountFaqs.ts:510-511) and "điểm IOU" (accountFaqs.ts:511) are mixed. Pick one.
- **L18.** Welcome.tsx:83: "Earn onchain — powered by Base" → "Kiếm lợi suất onchain với Base". "lợi suất" (yield) is more specific than the English. Use "Kiếm tiền onchain — vận hành trên Base".
- **L19.** translations.ts:489 / screenTranslations.ts:1385: "Apply for a loan" → "Yêu cầu khoản vay", but "apply when you are ready" becomes "đăng ký". Consider "Đăng ký vay" for consistency.
- **L20.** screenTranslations.ts:1471/1486: "Paid" and "Repaid" both become "Đã trả". If both appear as separate statuses, use "Đã thanh toán" and "Đã trả xong".

## Files
- /tmp/claude-0/-home-user-Moodeng-Credit-Main/acfa23e1-eaed-5486-85f3-b2a5d6da87fd/scratchpad/wt-seo/src/i18n/translations.ts
- /tmp/claude-0/-home-user-Moodeng-Credit-Main/acfa23e1-eaed-5486-85f3-b2a5d6da87fd/scratchpad/wt-seo/src/i18n/screenTranslations.ts
- /tmp/claude-0/-home-user-Moodeng-Credit-Main/acfa23e1-eaed-5486-85f3-b2a5d6da87fd/scratchpad/wt-seo/src/views/support/data/guides.ts
- /tmp/claude-0/-home-user-Moodeng-Credit-Main/acfa23e1-eaed-5486-85f3-b2a5d6da87fd/scratchpad/wt-seo/src/views/support/data/faqs.ts
- /tmp/claude-0/-home-user-Moodeng-Credit-Main/acfa23e1-eaed-5486-85f3-b2a5d6da87fd/scratchpad/wt-seo/src/views/account/data/accountFaqs.ts
- /tmp/claude-0/-home-user-Moodeng-Credit-Main/acfa23e1-eaed-5486-85f3-b2a5d6da87fd/scratchpad/wt-seo/src/views/account/Account.tsx
- /tmp/claude-0/-home-user-Moodeng-Credit-Main/acfa23e1-eaed-5486-85f3-b2a5d6da87fd/scratchpad/wt-seo/src/views/account/WalletBalanceCard.tsx
- /tmp/claude-0/-home-user-Moodeng-Credit-Main/acfa23e1-eaed-5486-85f3-b2a5d6da87fd/scratchpad/wt-seo/src/views/support/Support.tsx
- /tmp/claude-0/-home-user-Moodeng-Credit-Main/acfa23e1-eaed-5486-85f3-b2a5d6da87fd/scratchpad/wt-seo/src/views/support/GettingStarted.tsx
- /tmp/claude-0/-home-user-Moodeng-Credit-Main/acfa23e1-eaed-5486-85f3-b2a5d6da87fd/scratchpad/wt-seo/src/views/support/Guides.tsx
- /tmp/claude-0/-home-user-Moodeng-Credit-Main/acfa23e1-eaed-5486-85f3-b2a5d6da87fd/scratchpad/wt-seo/src/views/support/HowCreditLevelsWork.tsx
- /tmp/claude-0/-home-user-Moodeng-Credit-Main/acfa23e1-eaed-5486-85f3-b2a5d6da87fd/scratchpad/wt-seo/src/views/onboarding/Congratulations.tsx
- /tmp/claude-0/-home-user-Moodeng-Credit-Main/acfa23e1-eaed-5486-85f3-b2a5d6da87fd/scratchpad/wt-seo/src/views/onboarding/Welcome.tsx

These components had no issues: WalletActivity.tsx, GuideDetail.tsx, OnboardingHeader.tsx, role-selection/page.tsx.