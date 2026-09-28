I reviewed every Bahasa Indonesia (`id`) string, read-only; no files were changed. Repo: `/tmp/claude-0/-home-user-Moodeng-Credit-Main/acfa23e1-eaed-5486-85f3-b2a5d6da87fd/scratchpad/wt-seo`

**Scope covered**
- All 97 keys of `indonesianTranslations` (`src/i18n/translations.ts`).
- All 150 entries of `indonesianScreenTranslations` (`src/i18n/screenTranslations.ts:1063-1218`).
- Every translated `id:` block that the grep found in components: worldId modal ×5, `BorrowerVerificationBadge`, `NotificationSettings`, `WalletBalanceCard`, `WalletActivity`, `Account`, `role-selection`, `Support`, `GettingStarted`, `Guides`, `GuideDetail`, `Welcome`, `Congratulations`, `OnboardingHeader`.
- Other Indonesian content the grep misses, because it is chosen with `locale === 'id'`:
  - `INDONESIAN_FAQS` in `src/views/support/data/faqs.ts`
  - `INDONESIAN_*_FAQS` in `src/views/account/data/accountFaqs.ts`
  - `INDONESIAN_GUIDES` in `src/views/support/data/guides.ts`
  - `UpcomingLoanDues`, `DashboardHeader`, `FAQ.tsx`, `views/FAQ.tsx`

## Summary
- **Counts:** 7 HIGH, 24 MEDIUM, 22 LOW.
- **Register:** consistently "kamu", and "Anda" appears nowhere. Questions in the FAQs are written as "saya" (the user speaking), which is normal. There is no mixed register to fix.
- **Placeholders:** `{language}`, `{points}` and `${name}` are all kept. Percentages, point values and `$` amounts match English, except the credit-limit maximum (HIGH-1).

**Top recurring problems**
1. **Stale guide content.** The Indonesian guides still describe the old flow: World ID at an Orb only, no document upload, and a ~$10 Worldcoin reward. English now uses "Verify Your ID" (ID photo + selfie).
2. **"$140 is the current maximum" became "dan seterusnya" ("and so on").** This tells users limits keep rising past the maximum. It happens in 3 places.
3. **The Pandesal term is spelled two ways.** "Pandesal points" and "Poin Pandesal" are mixed across screens. The same English sentence is even translated both ways.
4. **Credit Level / Credit Limit / wallet terms are inconsistent.** Examples: "Level kredit" vs "Level Kredit" vs "credit level"; "Credit Limit" vs "credit limit"; "wallet" vs "dompet"; "Base Account" vs "Akun Base".
5. **English left inside Indonesian text.** Examples: role, borrower, lender, Guest User, Home, ceiling, withdraw, rate bunga. Guides also quote button labels in English ("Apply for a Loan", "Connect Wallet") that no longer match the Indonesian UI.
6. **Coverage gaps.** These fall back to English for `id` users:
   - The screen map has only 150 entries against 885 for Filipino.
   - The /help centre (`src/views/help/helpTopics.ts`) and the mecha assistant (`src/components/mecha/stepContext.ts`, `pickText` supports en/fil only) have no Indonesian at all.
   - Three money-critical guides have no Indonesian version (HIGH-6).

---

## HIGH

**H1. `src/views/support/data/faqs.ts:218`** (what-is-a-credit-level)
- EN: "…$120 → $140, which is the current maximum."
- ID: "…-> $140, dan seterusnya."
- Problem: says limits keep going past $140. Wrong and misleading about credit.
- Fix: "…-> $140, yang saat ini merupakan limit maksimum."

**H2. `src/views/support/data/faqs.ts:276`** (small-loan)
- EN: "…→ $140, which is the current maximum."
- ID: "…$140, dan seterusnya."
- Problem and fix: same as H1.

**H3. `src/views/support/data/guides.ts:400-404`** (how-to-request-your-first-loan, section "Catatan penting tentang credit limit")
- This whole section has no English source. It says "$140 dan seterusnya", which contradicts the maximum.
- It states rules that English does not: "hanya boleh memiliki satu permintaan credit-building loan aktif" (only one active credit-building request) and "boleh memiliki beberapa trust-building loan aktif selama totalnya tetap di bawah limit" (several trust-building loans allowed while under the limit).
- Its example is confusing: "meminta trust-building loan $12 lalu membayar $15" (request a $12 loan, then repay $15).
- Fix: remove the section to match the current English guide, or have product confirm the rules and fix the example.

**H4. `src/views/support/data/guides.ts:388-392`** (first-loan steps 5-6)
- EN step 5: tap "Verify Yourself" and do the quick ID + selfie check ("Verify Your ID", about 3 min); World ID is optional. English has 6 steps.
- ID: step 5 says "download World App dan selesaikan verifikasi … di lokasi World Orb fisik" (verify in person at an Orb). An extra step 6 links World ID. Indonesian has 7 steps.
- Problem: stale flow that sends users to a physical Orb.
- Fix: translate the current step 5, for example: "Langkah 5: Verifikasi identitas — Agar komunitas tetap aman, tap "Verify Yourself" dan selesaikan pemeriksaan singkat foto ID + selfie ("Verify Your ID"), sekitar 3 menit. Sudah memakai World App? Kamu bisa memilih "Verify with World ID"." Then renumber step 7 to step 6.

**H5. `src/views/support/data/guides.ts:482-502`** (verification-and-why-its-required)
- The whole article is stale compared with English lines 198-213.
- It claims verification is "lewat World ID" (World ID only) and "tanpa meminta kamu mengunggah dokumen pribadi sensitif" (no document upload). That is false: the recommended path is an ID photo + selfie.
- It promises "sekitar $10 dalam reward Worldcoin" (about $10 in Worldcoin rewards). English has no such promise, so this is a misleading money claim.
- It leaves out the human-review timing (up to 1 business day) and that "ID is never stored by Moodeng".
- Its step text references old buttons ("Find an Orb", "Connect World ID").
- Fix: retranslate from the current English article.

**H6. `src/views/support/data/guides.ts:369-511`** (missing slugs)
- There is no Indonesian for `repaying-your-loan`, `adding-funds-to-your-wallet` or `withdrawing-to-your-bank`.
- `getGuidesForLocale` falls back to English, so the "always select Base … wrong network can result in lost funds" warning appears only in English.
- Fix: add Indonesian versions and keep the Base-network warning prominent, e.g. "Selalu pilih jaringan Base. Jaringan yang salah bisa membuat dana hilang."

**H7. `src/views/account/WalletBalanceCard.tsx:101-102`** (please verify)
- EN: "Buy USDC in GCash (GCrypto), Coins.ph, or the exchange you use." then "…choose the Base network."
- ID: "Beli USDC di exchange yang kamu pakai (mis. Indodax, Tokocrypto)." then "pilih jaringan Base".
- Localising the exchanges is good. But I could not confirm that Indodax or Tokocrypto offer USDC withdrawals on Base. If they don't, a user following these steps may pick another network and lose funds.
- Fix: confirm Base support, or name only exchanges verified to support USDC on Base.

## MEDIUM

**M1. The same English sentence has two translations.**
- EN: "…Your Pandesal points stay with your wallet."
- `screenTranslations.ts:1217`: "Poin Pandesal tetap bersama wallet kamu."
- `src/views/account/Account.tsx:157`: "Pandesal points tetap bersama wallet kamu."
- Fix: choose one term and use it everywhere. I recommend "poin Pandesal".

**M2. Pandesal term mixed across files.**
- "Pandesal points":
  - `faqs.ts:193,197,208,209`
  - `Support.tsx:114`
  - `GettingStarted.tsx:114`
  - `Account.tsx:157`
- "Poin Pandesal" / "poin Pandesal":
  - `screenTranslations.ts:1203-1204`
  - `Guides.tsx:49`
  - `FAQ.tsx:86`
  - `accountFaqs.ts:279,288,311`
  - `guides.ts` throughout
- Fix: standardise on one.

**M3. `src/views/support/data/guides.ts:411`** (stale "score" wording)
- ID: "Skor ini naik… memakai skor ini…"
- Problem: leftover Trust Score wording.
- Fix: "Poin ini naik… memakai poin ini…"
- Also consider "Rincian skor" at lines 440 and 461 → "Rincian poin".

**M4. Credit Level term is inconsistent.**
- "Level kredit": `screenTranslations.ts:1205`, `Guides.tsx:50`
- "Level Kredit": `FAQ.tsx:87`
- "credit level berikutnya": `guides.ts:458`
- "level kredit" in running text elsewhere.
- The brief says "Credit Level" is a product term. Either keep "Credit Level" everywhere, or use "Level Kredit" consistently.

**M5. `src/i18n/translations.ts:278` vs `:253` and `screenTranslations.ts:1109`**
- EN: "Dashboard"
- ID: `nav.dashboard` = "Dashboard", but `bottomNav.dashboard` and the screen map = "Ringkasan".
- Fix: choose one. "Dasbor" or "Ringkasan" both work.

**M6. `screenTranslations.ts:1074` vs `:1102`**
- EN: "Base Account"
- ID: "Akun Base" in one entry, "Hubungkan Base Account" in the other.
- Base Account is a product name. Fix: "Base Account" in both.

**M7. "wallet" vs "dompet".**
- `WalletBalanceCard.tsx:98,102,106,108,109` uses "dompet".
- The screen map (`screenTranslations.ts:1073,1103,1104,1213,1214`), `Account.tsx:153`, the FAQs and the guides use "wallet".
- `Account.tsx:153-154` mixes both side by side: "Hubungkan wallet" / "Siapkan dompet".
- Fix: pick one. "wallet" is used most widely.

**M8. `src/views/account/WalletBalanceCard.tsx:96`**
- EN: "When a lender funds you…"
- ID: "Saat lender mendanaimu…"
- Problem: English word left in.
- Fix: "Saat pemberi pinjaman mendanaimu, uangnya muncul di sini."

**M9. `src/i18n/translations.ts:309-310`** (`site.footerBlurb`)
- ID: "…untuk borrower yang membangun kredit…"
- Fix: "…untuk peminjam yang membangun kredit di luar negeri."

**M10. `src/i18n/translations.ts:314`** (`user.guest`)
- EN: "Guest User"; ID: "Guest User" (untranslated).
- Fix: "Pengguna Tamu"

**M11. "role" left in English.**
- Locations:
  - `translations.ts:252` "Pilih role dulu"
  - `translations.ts:304` "Pilih role saat…"
  - `screenTranslations.ts:1094` "Pilih role"
  - `screenTranslations.ts:1095` "Pilih role kamu"
  - `app/role-selection/page.tsx:46` "Role kamu gagal disimpan"
- Fix: use "peran": "Pilih peran dulu", "Pilih peran kamu", "Peran kamu gagal disimpan."

**M12. `translations.ts:306` and `screenTranslations.ts:1146`**
- EN: "Need short-term support?"
- ID: "Butuh dukungan jangka pendek?"
- Problem: too literal and unclear. In this context "support" means money.
- Fix: "Butuh dana jangka pendek?"

**M13. `screenTranslations.ts:1164`**
- EN: "Pending Loans"
- ID: "Pinjaman tertunda"
- Problem: "tertunda" reads as delayed or postponed, which can suggest a problem.
- Fix: "Pinjaman menunggu" or "Menunggu pendanaan".

**M14. `screenTranslations.ts:1161`**
- EN: "Payback Amount"
- ID: "Jumlah pembayaran"
- Problem: ambiguous, and identical to how "Repayments" is translated. The field means the total owed (principal + interest).
- Fix: "Jumlah pengembalian" or "Total yang harus dibayar".

**M15. `src/views/support/data/guides.ts:378`**
- EN: "Start Your Loan Application"
- ID: "Mulai aplikasi pinjaman"
- Problem: "aplikasi" means "app" in everyday Indonesian.
- Fix: "Mulai pengajuan pinjaman"

**M16. English button names quoted in the guides.**
- In `guides.ts:376,379,386,395,453` the guides quote "Create Account", "Apply for a Loan", "Connect Wallet", "Explore the Request Board" and "Successfully Repaid".
- The Indonesian UI shows "Ajukan pinjaman", "Hubungkan wallet", "Jelajahi Papan Permintaan", and so on, so users won't find the labels the guide names.
- Fix: quote the Indonesian UI labels.

**M17. `src/views/account/data/accountFaqs.ts:239`**
- EN: "Does Moodeng touch my money?"
- ID: "Apakah Moodeng menyentuh uang saya?"
- Problem: too literal; "menyentuh" means physically touching.
- Fix: "Apakah Moodeng memegang uang saya?"

**M18. `accountFaqs.ts:268` and `:277`** (Philippine services for Indonesian users)
- The FAQs recommend Coins.ph, PDAX and GCrypto (GCash), which only operate in the Philippines. `WalletBalanceCard` already localises these to Indonesian exchanges, so the two screens disagree.
- Fix: list services available in Indonesia (verified for USDC on Base), or say "exchange atau layanan lokal yang mendukung USDC di jaringan Base".
- The same applies to the guide fallbacks in H6.

**M19. `accountFaqs.ts:297`**
- ID: "…sebelum menaikkan ceiling."
- Fix: "…sebelum menaikkan batasnya."
- Also on line 299, "Progression berjalan…" → "Urutannya: $15 -> …"

**M20. `faqs.ts:202, 243, 252, 274` and `Welcome.tsx:58-59`**
- ID: "rate bunga" / "rate" (mixed English).
- Fix: "suku bunga" in the FAQs. For the Welcome items, "Lihat suku bunga" / "bandingkan suku bunga".

**M21. `src/views/profile/components/settings/NotificationSettings.tsx:48`**
- EN: "…when a borrower who already repaid you asks again."
- ID: "…saat peminjam yang sudah melunasi ke kamu mengajukan lagi."
- Problem: ungrammatical ("melunasi ke kamu").
- Fix: "…atau saat peminjam yang sudah melunasi pinjamanmu mengajukan pinjaman lagi."

**M22. `src/views/support/data/guides.ts:422`**
- EN and ID both say "Credit Growth Loan", while everywhere else says "Credit-Building Loan".
- This is an English source issue, but the Indonesian copies it and so confuses the two loan concepts.
- Fix: "Credit-Building Loan" in both.

**M23. English source contradiction, reproduced in `faqs.ts:254`**
- EN (`faqs.ts:72`): "no government ID … required — just a verified World ID".
- ID: "Tidak perlu agunan, ID pemerintah…"
- This conflicts with the current ID + selfie verification.
- Fix: correct the English first, then the Indonesian.

**M24. `screenTranslations.ts:1128`**
- EN: "Home"; ID: "Home" (untranslated).
- Fix: "Beranda"

## LOW

1. **`translations.ts:297` and `screenTranslations.ts:1083`**
   - EN: "Borrow USDC to build trust. Unlock higher levels."
   - ID: "Pinjam USDC dan buka level yang lebih tinggi."
   - Drops "build trust". Fix: "Pinjam USDC untuk membangun kepercayaan. Buka level lebih tinggi."
2. **`screenTranslations.ts:1087` vs `translations.ts:303`**: the same English string is translated as "ajukan saat siap" and as "ajukan pinjaman saat siap". Unify.
3. **`translations.ts:308` and `screenTranslations.ts:1142`**: "Papan Permintaan Microloan" → "Papan Permintaan Pinjaman Mikro".
4. **`translations.ts:328`**: "Apa itu IOU Points?" → "Apa itu poin IOU?" The same applies at `accountFaqs.ts:306-307`, including "base IOU points" → "poin IOU dasar".
5. **`translations.ts:263-264`**: "Thailand" / "Vietnam" are country names. Use the language names "Thai" / "Vietnam", or "Bahasa Thai" / "Bahasa Vietnam".
6. **`translations.ts:269`**: "Tentang" → "Tentang kami"
7. **`translations.ts:291`**: "Kenapa memberi pinjaman" → "Mengapa Memberi Pinjaman". Elsewhere the copy uses "Mengapa" and title case.
8. **Mixed capitalisation in labels**: title case in `translations.ts:240-244, 316, 326-327` ("Lihat Cara Kerjanya", "Lihat Riwayat Pemberian Pinjaman") vs sentence case in `:311, 313, 323` ("Pengaturan akun", "Bayar pinjaman"). Also `screenTranslations.ts:1197` "Mulai Bangun Kredit". Pick one style.
9. **`screenTranslations.ts:1197`**: "Mulai Bangun Kredit" → "Mulai Membangun Kredit"
10. **`screenTranslations.ts:1194`**: "Sedang daftar..." → "Sedang mendaftar..."
11. **`screenTranslations.ts:1195`** and **`role-selection/page.tsx:45`**: "Ada yang salah(!)" → "Terjadi kesalahan(!)"
12. **`Account.tsx:158`**: "Keluar..." (Signing Out...) → "Sedang keluar..."
13. **`Account.tsx:147` and `:145`**: `getInTouch` and `contact` are both "Hubungi kami", so the section header repeats its own item. Make the header "Hubungi kami" and the item "Kontak kami", or similar.
14. **`screenTranslations.ts:1159` vs `:1174`**: "Paid" and "Repaid" are both "Sudah dibayar". "Lunas" is clearer for Repaid.
15. **Untranslated UI words**: `screenTranslations.ts:1143` "Milestone" (→ "Pencapaian"), `:1201` "Timeline" (→ "Linimasa"), `:1119` "Error" (→ "Kesalahan"), `:1154` and `translations.ts:247` "Buka app" (→ "Buka aplikasi"), `:1172` "Baca Docs" (→ "Baca Dokumentasi").
16. **`Congratulations.tsx:73, 76`**: "Kamu siap!" → "Semua sudah siap!"; "Berikutnya apa?" → "Apa selanjutnya?"
17. **`GettingStarted.tsx:111`**: "Lihat mengapa ini berguna" (See Why It's Worth It) → "Lihat kenapa ini sepadan"
18. **`accountFaqs.ts:251`**: "kamu bisa memakai on-chain" (object missing) → "kamu bisa memakainya secara on-chain"
19. **`accountFaqs.ts:268`**: "withdraw mata uang lokal" → "tarik mata uang lokal". **`accountFaqs.ts:288`** adds "selalu" ("daripada selalu meminjam maksimum"), which isn't in English. **`accountFaqs.ts:336, 343`**: "Lender Dashboard" → "Dashboard pemberi pinjaman".
20. **`faqs.ts:236`** leaves out "It works whether you're in Manila, Lagos, or Mumbai" and "every major exchange". **`faqs.ts:267`**: "credit bureau" → "biro kredit". **`faqs.ts:274`**: "biaya setup … tidak ada fee" (English mixed in) → "biaya awal … tidak ada biaya".
21. **`guides.ts:372, 408, 417, …`**: `lastUpdated` uses the English date format "Jun 9, 2026" → "9 Jun 2026". **`guides.ts:384`** has a double blank line. **`guides.ts:496, 502`** have a stray space before the full stop ("terdekat .", "kamu .").
22. **`Welcome.tsx:46-47`**: the English onboarding title "Onboarding" became "Mulai", the same label as "Getting started". That's acceptable, but the two are now indistinguishable. "Persiapan akun" would be one alternative.

No problems found in: the worldId modal copy, `BorrowerVerificationBadge`, `WalletActivity`, `GuideDetail`, `OnboardingHeader`, `UpcomingLoanDues`, `DashboardHeader`, the role-selection body copy, or the scoring numbers (10 / 7 / 5 / 3 points, 75 / 50 / 25%).
