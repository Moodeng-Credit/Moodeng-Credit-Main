// Thai translations for on-screen English found by the full-code scan (round two), keyed by
// the exact English text. Loaded on demand with the rest of this locale's coverage (see ./index.ts).
export const thaiCoverageG: Record<string, string> = {
   // src/views/account/AvatarUploadModal.tsx
   'Please select an image file (PNG, JPG, or WEBP).': 'โปรดเลือกไฟล์รูปภาพ (PNG, JPG หรือ WEBP)',
   'Image must be under 5 MB.': 'รูปภาพต้องมีขนาดไม่เกิน 5 MB',
   'Could not load the image. Please try a different file.': 'โหลดรูปภาพไม่ได้ โปรดลองใช้ไฟล์อื่น',
   'Canvas not supported in this browser.': 'เบราว์เซอร์นี้ไม่รองรับ Canvas',
   'Failed to process the image. Please try again.': 'ประมวลผลรูปภาพไม่สำเร็จ โปรดลองอีกครั้ง',
   'Background updated': 'อัปเดตพื้นหลังแล้ว',
   'Your profile background has been changed.': 'เปลี่ยนพื้นหลังโปรไฟล์ของคุณแล้ว',
   'Change Profile Photo': 'เปลี่ยนรูปโปรไฟล์',
   'Crop Photo': 'ครอบตัดรูปภาพ',
   'Saving…': 'กำลังบันทึก…',
   'Save Background': 'บันทึกพื้นหลัง',
   'or drag and drop': 'หรือลากแล้ววาง',
   'Save Photo': 'บันทึกรูปภาพ',

   // src/views/account/BaseNetworkSheet.tsx
   'Base is an Ethereum "layer 2" built by Coinbase. Loans fund and repayments settle in seconds for a fraction of a cent — so more of every peso reaches the person, not the network.':
      'Base คือเครือข่าย "layer 2" ของ Ethereum ที่สร้างโดย Coinbase การปล่อยกู้และการชำระคืนเสร็จสิ้นภายในไม่กี่วินาทีด้วยค่าธรรมเนียมเพียงเศษเสี้ยวของเซนต์ เงินทุกเปโซจึงถึงมือผู้รับมากขึ้น แทนที่จะหมดไปกับค่าเครือข่าย',

   // src/views/account/EditBioInfoModal.tsx
   'Bio info saved': 'บันทึกข้อมูลส่วนตัวแล้ว',
   'Your income and budget details have been updated.': 'อัปเดตรายละเอียดรายได้และงบประมาณของคุณแล้ว',
   'Failed to save bio info. Please try again.': 'บันทึกข้อมูลส่วนตัวไม่สำเร็จ โปรดลองอีกครั้ง',
   'e.g. teacher, nurse, market vendor, driver': 'เช่น ครู พยาบาล แม่ค้าในตลาด คนขับรถ',
   'e.g. tutoring, delivery, market trading': 'เช่น สอนพิเศษ ส่งของ ค้าขายในตลาด',
   'Save bio info': 'บันทึกข้อมูลส่วนตัว',

   // src/views/account/ExportInstantWalletKey.tsx
   'Your face check just cleared. Tap to reveal your key.': 'การตรวจสอบใบหน้าของคุณผ่านแล้ว แตะเพื่อแสดงคีย์ของคุณ',
   "Couldn't export key": 'ส่งออกคีย์ไม่สำเร็จ',
   'Private key copied. Store it somewhere safe and never share it.': 'คัดลอกคีย์ส่วนตัวแล้ว เก็บไว้ในที่ปลอดภัยและอย่าแชร์ให้ใคร',
   'Select the key and copy it manually.': 'เลือกคีย์แล้วคัดลอกด้วยตนเอง',
   "I've saved it": 'ฉันบันทึกไว้แล้ว',
   'This reveals the private key to your Instant Wallet so you can import it into another wallet app like MetaMask or Trust. Make sure no one is looking at your screen.':
      'ขั้นตอนนี้จะแสดงคีย์ส่วนตัวของ Instant Wallet ของคุณ เพื่อให้คุณนำเข้าไปยังแอปกระเป๋าเงินอื่น เช่น MetaMask หรือ Trust ได้ ตรวจสอบให้แน่ใจว่าไม่มีใครมองหน้าจอของคุณอยู่',
   'Revealing…': 'กำลังแสดง…',
   'Reveal key': 'แสดงคีย์',

   // src/views/account/TwoFactorSettings.tsx
   'Authenticator app enabled': 'เปิดใช้แอปยืนยันตัวตนแล้ว',
   "You'll need a code from it to sign in from now on.": 'นับจากนี้ คุณจะต้องใช้รหัสจากแอปนี้เพื่อเข้าสู่ระบบ',
   'Setting up authenticator app...': 'กำลังตั้งค่าแอปยืนยันตัวตน...',
   'Confirm and enable': 'ยืนยันและเปิดใช้',
   Remove: 'ลบ',
   'Removing...': 'กำลังลบ...',
   'Remove authenticator app': 'ลบแอปยืนยันตัวตน',
   'Remove passkey': 'ลบพาสคีย์',
   'authenticator app removed': 'ลบแอปยืนยันตัวตนแล้ว',
   passkey: 'พาสคีย์',
   "You won't be asked for this the next time you sign in. You can set it up again anytime.":
      'ครั้งถัดไปที่คุณเข้าสู่ระบบ ระบบจะไม่ขอรหัสนี้อีก คุณตั้งค่าใหม่ได้ทุกเมื่อ',
   'This removes the passkey from your account. Your password still works, and you can set one up again anytime.':
      'การดำเนินการนี้จะลบพาสคีย์ออกจากบัญชีของคุณ รหัสผ่านของคุณยังใช้ได้ตามเดิม และคุณตั้งค่าพาสคีย์ใหม่ได้ทุกเมื่อ',
   'Passkey added': 'เพิ่มพาสคีย์แล้ว',
   'You can now sign in with it instead of your password.': 'ตอนนี้คุณเข้าสู่ระบบด้วยพาสคีย์แทนรหัสผ่านได้แล้ว',
   'It will no longer be asked for at sign-in.': 'ระบบจะไม่ขอสิ่งนี้อีกเมื่อเข้าสู่ระบบ',
   'Passkey removed': 'ลบพาสคีย์แล้ว',
   'You can set one up again anytime.': 'คุณตั้งค่าใหม่ได้ทุกเมื่อ',
   Enabled: 'เปิดใช้อยู่',
   'Not set up': 'ยังไม่ได้ตั้งค่า',
   'authenticator app': 'แอปยืนยันตัวตน',
   'Disable authenticator app': 'ปิดใช้แอปยืนยันตัวตน',
   'Enable authenticator app': 'เปิดใช้แอปยืนยันตัวตน',
   'Waiting for your device...': 'กำลังรออุปกรณ์ของคุณ...',
   'Face ID, Touch ID, or a security key': 'Face ID, Touch ID หรือคีย์ความปลอดภัย',
   'Disable passkey': 'ปิดใช้พาสคีย์',
   'Enable passkey': 'เปิดใช้พาสคีย์',

   // src/views/account/WalletAccountInsights.tsx
   'Loan received': 'ได้รับเงินกู้แล้ว',
   'Repayment sent': 'ส่งการชำระคืนแล้ว',
   'Repayment received': 'ได้รับการชำระคืนแล้ว',
   'USDC sent': 'ส่ง USDC แล้ว',
   'Show wallet history': 'แสดงประวัติกระเป๋าเงิน',
   'We could not load this wallet’s USDC balance.': 'เราโหลดยอด USDC ของกระเป๋าเงินนี้ไม่ได้',
   'No USDC in this wallet on Base.': 'กระเป๋าเงินนี้ไม่มี USDC บน Base',
   'Only this wallet’s USDC balance on Base is shown.': 'แสดงเฉพาะยอด USDC บน Base ของกระเป๋าเงินนี้',
   'Wallet connected': 'เชื่อมต่อกระเป๋าเงินแล้ว',
   'Current wallet recorded': 'บันทึกกระเป๋าเงินปัจจุบันแล้ว',
   'Previously used': 'เคยใช้ก่อนหน้านี้',
   'Hide wallet history': 'ซ่อนประวัติกระเป๋าเงิน',

   // src/views/creditLevelingGuide/CreditLevelingGuide.tsx
   'Level 3': 'ระดับ 3',
   'Level 4': 'ระดับ 4',
   'Level 5': 'ระดับ 5',
   'Level 6': 'ระดับ 6',
   'Level 7': 'ระดับ 7',
   'Level 8': 'ระดับ 8',

   // src/views/dashboard-v2/DashboardV2Rewards.tsx
   'a friend': 'เพื่อน',
   'your friend': 'เพื่อนของคุณ',

   // src/views/dashboard-v2/components/DashboardV2Hero.tsx
   'Rising Moodeng (not reached yet)': 'Rising Moodeng (ยังไปไม่ถึง)',
   'Prime Moodeng (not reached yet)': 'Prime Moodeng (ยังไปไม่ถึง)',
   'Apex Moodeng (not reached yet)': 'Apex Moodeng (ยังไปไม่ถึง)',

   // src/views/dashboard-v2/components/DashboardV2Sections.tsx
   'Rising tier voucher': 'บัตรกำนัลระดับ Rising',
   'Prime tier voucher': 'บัตรกำนัลระดับ Prime',
   'Apex tier voucher': 'บัตรกำนัลระดับ Apex',

   // src/views/dashboard-v2/dashboardV2Model.ts
   'left to LV.1': 'ก่อนถึง LV.1',
   'Repay a full-limit loan': 'ชำระคืนเงินกู้เต็มวงเงิน',

   // src/views/dashboard-v2/useDashboardV2Model.ts
   'a lender': 'ผู้ให้กู้',

   // src/views/dashboard/components/LenderDiversitySection.tsx
   'Unique Lender': 'ผู้ให้กู้ที่ไม่ซ้ำกัน',
   'Unique Lenders': 'ผู้ให้กู้ที่ไม่ซ้ำกัน',

   // src/views/dashboard/components/MilestoneSheets.tsx
   'Close milestone detail': 'ปิดรายละเอียดหมุดหมาย',
   'Close milestone help': 'ปิดความช่วยเหลือเรื่องหมุดหมาย',

   // src/views/dashboard/RequestBoard.tsx
   'This looks low-effort. Requests that appear to have no real effort may be deleted — submit again to post anyway. Tap “Make Your Request” again to post it anyway.':
      'เหตุผลนี้ดูเขียนอย่างลวก ๆ คำขอที่ดูไม่ตั้งใจอาจถูกลบ — แตะ “ส่งคำขอของคุณ” อีกครั้งหากต้องการโพสต์ต่อ',

   // src/views/dashboard/components/UserCard.tsx
   'You funded $': 'คุณปล่อยกู้ $',

   // src/views/dashboard/components/connectKit.tsx
   Confirmed: 'ยืนยันแล้ว',

   // src/views/dashboard/dashboardHelpers.ts
   'Your account can request borrower credit.': 'บัญชีของคุณขอสินเชื่อในฐานะผู้ยืมได้แล้ว',
   'Unlock borrowing and start building your public trust record.': 'ปลดล็อกการกู้ยืมและเริ่มสร้างประวัติความน่าเชื่อถือสาธารณะของคุณ',
   'Borrowing unlocked': 'ปลดล็อกการกู้ยืมแล้ว',
   'Verified profile': 'โปรไฟล์ที่ยืนยันแล้ว',
   'Verify now': 'ยืนยันเลย',
   'Account ready': 'บัญชีพร้อมใช้งาน',
   'Ask for a small amount with a clear reason and due date.': 'ขอจำนวนเล็กน้อย พร้อมเหตุผลและวันครบกำหนดที่ชัดเจน',
   'Visible to lenders': 'ผู้ให้กู้มองเห็นได้',
   'Request live': 'คำขอเผยแพร่แล้ว',
   'A lender accepts your request and trusts you with your first loan.': 'ผู้ให้กู้ตอบรับคำขอของคุณและไว้วางใจปล่อยเงินกู้ครั้งแรกให้คุณ',
   'First lender signal': 'สัญญาณแรกจากผู้ให้กู้',
   'Lender signal gained': 'ได้รับสัญญาณจากผู้ให้กู้แล้ว',
   'History started': 'เริ่มสร้างประวัติแล้ว',
   'View requests': 'ดูคำขอ',
   'Pay the full amount before the due date to start your repayment record.':
      'ชำระเต็มจำนวนก่อนวันครบกำหนดเพื่อเริ่มสร้างประวัติการชำระคืนของคุณ',
   'Limit progress': 'ความคืบหน้าวงเงิน',
   'Pay loans': 'ชำระเงินกู้',
   'Show lenders that your repayment reliability is repeatable.': 'แสดงให้ผู้ให้กู้เห็นว่าคุณชำระคืนได้อย่างน่าเชื่อถือเป็นประจำ',
   'Stronger lender confidence': 'ผู้ให้กู้มั่นใจมากขึ้น',
   'Reliability improved': 'ความน่าเชื่อถือดีขึ้น',
   'Stronger profile': 'โปรไฟล์แข็งแกร่งขึ้น',
   'Use your current Credit Level amount and repay it on time.': 'กู้เต็มวงเงินตามระดับเครดิตปัจจุบันของคุณ แล้วชำระคืนให้ตรงเวลา',
   'Credit Level progress': 'ความคืบหน้าระดับเครดิต',
   'Level progress': 'ความคืบหน้าระดับ',
   'Higher limit path': 'เส้นทางสู่วงเงินที่สูงขึ้น',
   'Learn levels': 'เรียนรู้เรื่องระดับ',
   'Build a reputation that does not depend on just one lender.': 'สร้างความน่าเชื่อถือที่ไม่ได้ขึ้นอยู่กับผู้ให้กู้เพียงรายเดียว',
   'Lender diversity signal': 'สัญญาณความหลากหลายของผู้ให้กู้',
   'Diversity improved': 'ความหลากหลายดีขึ้น',
   'Broader trust': 'ความน่าเชื่อถือในวงกว้างขึ้น',
   'Grow from starter loans into a real repayment history.': 'เติบโตจากเงินกู้เริ่มต้นสู่ประวัติการชำระคืนที่แท้จริง',
   'Volume trust signal': 'สัญญาณความน่าเชื่อถือจากยอดชำระ',
   'Volume signal': 'สัญญาณยอดชำระ',
   '$100 repaid': 'ชำระคืนแล้ว $100',
   'Unlock a higher borrowing limit through verified on-time repayment.':
      'ปลดล็อกวงเงินกู้ที่สูงขึ้นผ่านการชำระคืนตรงเวลาที่ได้รับการยืนยัน',
   'Higher borrowing power': 'กู้ได้มากขึ้น',
   'Higher limit unlocked': 'ปลดล็อกวงเงินที่สูงขึ้นแล้ว',
   'View guide': 'ดูคู่มือ',
   'Complete 5 on-time repayments, use 3 lenders, and keep defaults resolved.':
      'ชำระคืนตรงเวลาให้ครบ 5 ครั้ง กู้จากผู้ให้กู้ 3 ราย และไม่มีการผิดนัดชำระค้างอยู่',
   'Future top-user perks': 'สิทธิพิเศษสำหรับผู้ใช้ชั้นนำในอนาคต',
   'Priority signal': 'สัญญาณลำดับความสำคัญ',
   'Review ready': 'พร้อมรับการพิจารณา',
   'Top milestone': 'หมุดหมายสูงสุด',
   'Up to $15': 'สูงสุด $15',
   'Pandesal points earned · up to $15': 'แต้ม Pandesal ที่ได้รับ · สูงสุด $15',
   'Up to $20': 'สูงสุด $20',
   'Pandesal points earned · up to $20': 'แต้ม Pandesal ที่ได้รับ · สูงสุด $20',
   'Up to $40': 'สูงสุด $40',
   'Pandesal points earned · up to $40': 'แต้ม Pandesal ที่ได้รับ · สูงสุด $40',
   'Up to $60': 'สูงสุด $60',
   'Pandesal points earned · up to $60': 'แต้ม Pandesal ที่ได้รับ · สูงสุด $60',
   'Up to $80': 'สูงสุด $80',
   'Pandesal points earned · up to $80': 'แต้ม Pandesal ที่ได้รับ · สูงสุด $80',
   'Up to $100': 'สูงสุด $100',
   'Pandesal points earned · up to $100': 'แต้ม Pandesal ที่ได้รับ · สูงสุด $100',
   'Up to $120': 'สูงสุด $120',
   'Pandesal points earned · up to $120': 'แต้ม Pandesal ที่ได้รับ · สูงสุด $120',
   'Up to $140': 'สูงสุด $140',
   'Pandesal points earned · up to $140': 'แต้ม Pandesal ที่ได้รับ · สูงสุด $140',
   '+10 Pandesal points': '+10 แต้ม Pandesal',
   'Reward: +10 Pandesal points': 'รางวัล: +10 แต้ม Pandesal',
   '+15 Pandesal points': '+15 แต้ม Pandesal',
   'Reward: +15 Pandesal points': 'รางวัล: +15 แต้ม Pandesal',
   '+20 Pandesal points': '+20 แต้ม Pandesal',
   'Reward: +20 Pandesal points': 'รางวัล: +20 แต้ม Pandesal',
   '+25 Pandesal points': '+25 แต้ม Pandesal',
   'Reward: +25 Pandesal points': 'รางวัล: +25 แต้ม Pandesal',
   '+30 Pandesal points': '+30 แต้ม Pandesal',
   'Reward: +30 Pandesal points': 'รางวัล: +30 แต้ม Pandesal',
   '+40 Pandesal points': '+40 แต้ม Pandesal',
   'Reward: +40 Pandesal points': 'รางวัล: +40 แต้ม Pandesal',
   '+50 Pandesal points': '+50 แต้ม Pandesal',
   'Reward: +50 Pandesal points': 'รางวัล: +50 แต้ม Pandesal',
   '+75 Pandesal points': '+75 แต้ม Pandesal',
   'Reward: +75 Pandesal points': 'รางวัล: +75 แต้ม Pandesal',
   'Earned +10 Pandesal points · Verified profile': 'ได้รับ +10 แต้ม Pandesal · โปรไฟล์ที่ยืนยันแล้ว',
   'Earned +10 Pandesal points · Request live': 'ได้รับ +10 แต้ม Pandesal · คำขอเผยแพร่แล้ว',
   'Earned +15 Pandesal points · History started': 'ได้รับ +15 แต้ม Pandesal · เริ่มสร้างประวัติแล้ว',
   'Earned +25 Pandesal points · Stronger profile': 'ได้รับ +25 แต้ม Pandesal · โปรไฟล์แข็งแกร่งขึ้น',
   'Earned +30 Pandesal points · Higher limit path': 'ได้รับ +30 แต้ม Pandesal · เส้นทางสู่วงเงินที่สูงขึ้น',
   'Earned +30 Pandesal points · Broader trust': 'ได้รับ +30 แต้ม Pandesal · ความน่าเชื่อถือในวงกว้างขึ้น',
   'Earned +40 Pandesal points · $100 repaid': 'ได้รับ +40 แต้ม Pandesal · ชำระคืนแล้ว $100',
   'Earned +50 Pandesal points · Level 3': 'ได้รับ +50 แต้ม Pandesal · ระดับ 3',
   'Earned +75 Pandesal points · Review ready': 'ได้รับ +75 แต้ม Pandesal · พร้อมรับการพิจารณา',
   'Earned +20 Pandesal points · Limit progress': 'ได้รับ +20 แต้ม Pandesal · ความคืบหน้าวงเงิน',
   'Earned +20 Pandesal points · Up to $15': 'ได้รับ +20 แต้ม Pandesal · สูงสุด $15',
   'Earned +20 Pandesal points · Up to $20': 'ได้รับ +20 แต้ม Pandesal · สูงสุด $20',
   'Earned +20 Pandesal points · Up to $40': 'ได้รับ +20 แต้ม Pandesal · สูงสุด $40',
   'Earned +20 Pandesal points · Up to $60': 'ได้รับ +20 แต้ม Pandesal · สูงสุด $60',
   'Earned +20 Pandesal points · Up to $80': 'ได้รับ +20 แต้ม Pandesal · สูงสุด $80',
   'Earned +20 Pandesal points · Up to $100': 'ได้รับ +20 แต้ม Pandesal · สูงสุด $100',
   'Earned +20 Pandesal points · Up to $120': 'ได้รับ +20 แต้ม Pandesal · สูงสุด $120',
   'Earned +20 Pandesal points · Up to $140': 'ได้รับ +20 แต้ม Pandesal · สูงสุด $140',

   // src/views/dashboard/trustPointRewards.ts
   'Silver avatar ring': 'กรอบรูปโปรไฟล์สีเงิน',
   'A clean profile ring around your avatar.': 'กรอบเรียบ ๆ รอบรูปโปรไฟล์ของคุณ',
   'Gold avatar ring': 'กรอบรูปโปรไฟล์สีทอง',
   'A stronger profile ring for repeat borrowers.': 'กรอบรูปโปรไฟล์ที่โดดเด่นขึ้นสำหรับผู้ยืมที่กลับมากู้ซ้ำ',
   'Trusted profile badge': 'ตราโปรไฟล์ที่น่าเชื่อถือ',
   'A visible badge on your borrower profile.': 'ตราที่มองเห็นได้บนโปรไฟล์ผู้ยืมของคุณ',
   'Top borrower award': 'รางวัลผู้ยืมชั้นยอด',
   'A collectible profile award for long-term history.': 'รางวัลโปรไฟล์สะสมสำหรับประวัติระยะยาว',
   'Founding Lucky Cat': 'แมวกวักนำโชครุ่นบุกเบิก',
   'A lucky cat for being one of the first Moodeng borrowers.': 'แมวกวักนำโชคสำหรับผู้ที่เป็นหนึ่งในผู้ยืมกลุ่มแรกของ Moodeng',
   'First-time user': 'ผู้ใช้ครั้งแรก',

   // src/views/fund/FundWalletSheet.tsx
   '. Stripe handles ID checks and payment — USDC lands on Base.': '· Stripe ดูแลการตรวจสอบตัวตนและการชำระเงิน — USDC จะเข้าบัญชีบน Base',

   // src/views/lender/dashboard/LenderDashboard.tsx
   'vs previous period': 'เมื่อเทียบกับช่วงก่อนหน้า',
   "You haven't funded any loans yet.": 'คุณยังไม่ได้ปล่อยกู้เลย',
   'No transactions match your search or filters.': 'ไม่มีธุรกรรมที่ตรงกับการค้นหาหรือตัวกรองของคุณ',

   // src/views/lender/loanNote/LenderFundLoanModal.tsx
   '’s loan. If they repay, the repayment is automatically sent to your wallet.':
      'แล้ว หากผู้ยืมชำระคืน เงินที่ชำระคืนจะถูกส่งเข้ากระเป๋าเงินของคุณโดยอัตโนมัติ',

   // src/views/lender/loanNote/LoanNotePurchase.tsx
   'Due date': 'วันครบกำหนด',

   // src/views/lender/loanNote/useBuyLoanNote.ts
   Cancelled: 'ยกเลิกแล้ว',
   'You cancelled the transaction in your wallet.': 'คุณยกเลิกธุรกรรมในกระเป๋าเงินของคุณแล้ว',
   'Not enough ETH for gas': 'ETH ไม่พอสำหรับค่า gas',
   'You need a little ETH on Base for the network fee.': 'คุณต้องมี ETH บน Base เล็กน้อยสำหรับค่าธรรมเนียมเครือข่าย',
   'No longer available': 'ไม่พร้อมให้บริการแล้ว',
   'This loan was just funded by someone else.': 'เงินกู้นี้เพิ่งมีผู้อื่นปล่อยกู้ไปแล้ว',
   'Switch your wallet to Base, then try again.': 'สลับกระเป๋าเงินของคุณไปที่ Base แล้วลองอีกครั้ง',
   'Purchase failed': 'ซื้อไม่สำเร็จ',
   'Something went wrong before the payment. Nothing was charged — please try again.':
      'เกิดข้อผิดพลาดก่อนการชำระเงิน ยังไม่มีการเรียกเก็บเงินใด ๆ — โปรดลองอีกครั้ง',
   Unavailable: 'ไม่พร้อมใช้งาน',
   'This loan does not have a sellable Loan Note.': 'เงินกู้นี้ไม่มี Loan Note ที่ขายได้',
   'Not enough USDC': 'USDC ไม่พอ',

   // src/views/lenderBenefits/config/mostNeededConfig.ts
   'Korea, Taiwan, Japan': 'เกาหลี ไต้หวัน ญี่ปุ่น',
   Singapore: 'สิงคโปร์',

   // src/views/milestones/Milestones.tsx
   'Unlocks at 50 Pandesal points': 'ปลดล็อกเมื่อมี 50 แต้ม Pandesal',
   'Unlocked at 50 Pandesal points': 'ปลดล็อกแล้วเมื่อมี 50 แต้ม Pandesal',
   'Unlocks at 120 Pandesal points': 'ปลดล็อกเมื่อมี 120 แต้ม Pandesal',
   'Unlocked at 120 Pandesal points': 'ปลดล็อกแล้วเมื่อมี 120 แต้ม Pandesal',
   'Unlocks at 250 Pandesal points': 'ปลดล็อกเมื่อมี 250 แต้ม Pandesal',
   'Unlocked at 250 Pandesal points': 'ปลดล็อกแล้วเมื่อมี 250 แต้ม Pandesal',
   'Unlocks at 500 Pandesal points': 'ปลดล็อกเมื่อมี 500 แต้ม Pandesal',
   'Unlocked at 500 Pandesal points': 'ปลดล็อกแล้วเมื่อมี 500 แต้ม Pandesal',

   // src/views/profile/components/Card.tsx
   Payback: 'ยอดชำระคืน',

   // src/views/profile/components/settings/ProfileSettings.tsx
   Update: 'อัปเดต',

   // src/views/profile/components/tabs/useDashboardData.ts
   'Verify World ID to start borrowing': 'ยืนยันด้วย World ID เพื่อเริ่มกู้ยืม',
   'Fully repay $15 total on time to unlock this level': 'ชำระคืนให้ครบ $15 ตรงเวลาเพื่อปลดล็อกระดับนี้',
   'Fully repay $20 total on time to unlock this level': 'ชำระคืนให้ครบ $20 ตรงเวลาเพื่อปลดล็อกระดับนี้',
   'Fully repay $40 total on time to unlock this level': 'ชำระคืนให้ครบ $40 ตรงเวลาเพื่อปลดล็อกระดับนี้',
   'Fully repay $60 total on time to unlock this level': 'ชำระคืนให้ครบ $60 ตรงเวลาเพื่อปลดล็อกระดับนี้',
   'Fully repay $80 total on time to unlock this level': 'ชำระคืนให้ครบ $80 ตรงเวลาเพื่อปลดล็อกระดับนี้',
   'Fully repay $100 total on time to unlock this level': 'ชำระคืนให้ครบ $100 ตรงเวลาเพื่อปลดล็อกระดับนี้',
   'Fully repay $120 total on time to unlock this level': 'ชำระคืนให้ครบ $120 ตรงเวลาเพื่อปลดล็อกระดับนี้',
   'Fully repay $140 total on time to unlock this level': 'ชำระคืนให้ครบ $140 ตรงเวลาเพื่อปลดล็อกระดับนี้',

   // src/views/profile/config/transactionColumns.tsx
   Transaction: 'ธุรกรรม',
   'Funded Amount': 'จำนวนที่ปล่อยกู้',
   'Borrowed Amount': 'จำนวนที่ยืม',
   'Date Funded': 'วันที่ปล่อยกู้',
   'Date Borrowed': 'วันที่ยืม',
   'Returned Amount': 'จำนวนที่ได้รับคืน',
   Returned: 'ได้รับคืนแล้ว',
   'Date Returned': 'วันที่ได้รับคืน',
   "Borrower's Name": 'ชื่อผู้ยืม',
   "Lender's Name": 'ชื่อผู้ให้กู้',
   Name: 'ชื่อ',

   // src/views/repay/Repay.tsx
   'overdue now': 'เกินกำหนดแล้ว',
   'your loan': 'เงินกู้ของคุณ',

   // src/views/signin/SignInPage.tsx
   'Moodeng Mascot': 'มาสคอต Moodeng',
   'Forgot password?': 'ลืมรหัสผ่าน?',

   // src/views/support/HowCreditLevelsWork.tsx
   'Verify, then make your first request': 'ยืนยันตัวตน แล้วส่งคำขอแรกของคุณ',
   'Repay your $15 loan on time': 'ชำระคืนเงินกู้ $15 ของคุณตรงเวลา',
   'Repay your $20 loan on time': 'ชำระคืนเงินกู้ $20 ของคุณตรงเวลา',
   'Repay your $40 loan on time': 'ชำระคืนเงินกู้ $40 ของคุณตรงเวลา',
   'Repay your $60 loan on time': 'ชำระคืนเงินกู้ $60 ของคุณตรงเวลา',
   'Repay your $80 loan on time': 'ชำระคืนเงินกู้ $80 ของคุณตรงเวลา',
   'Repay your $100 loan on time': 'ชำระคืนเงินกู้ $100 ของคุณตรงเวลา',
   'Repay your $120 loan on time': 'ชำระคืนเงินกู้ $120 ของคุณตรงเวลา',
   'Limits step up $15 → $20 → $40 → $60 → $80 → $100 → $120 → $140.':
      'วงเงินเพิ่มขึ้นทีละขั้น $15 → $20 → $40 → $60 → $80 → $100 → $120 → $140',
   'you need a smaller amount, or want to build trust first.': 'คุณต้องการเงินจำนวนน้อยกว่า หรืออยากสร้างความน่าเชื่อถือก่อน',
   'also called a Credit Growth Loan': 'หรือที่เรียกว่า Credit Growth Loan',
   'you’re ready to grow your limit and sure you can repay on time.': 'คุณพร้อมจะเพิ่มวงเงินและมั่นใจว่าชำระคืนได้ตรงเวลา',
   'How reliable repayment becomes a portable reputation lenders trust.':
      'การชำระคืนอย่างสม่ำเสมอกลายเป็นความน่าเชื่อถือที่ติดตัวคุณไปได้และผู้ให้กู้ไว้วางใจได้อย่างไร',
   'The difference between the two loan types and when to use each.': 'ความแตกต่างระหว่างเงินกู้สองประเภท และควรใช้แต่ละแบบเมื่อใด',
   'Exactly how on-time, partial, and late repayments are scored.': 'การชำระคืนตรงเวลา ชำระบางส่วน และชำระล่าช้าถูกนำมาคิดคะแนนอย่างไร',
   'Any small loan': 'เงินกู้จำนวนน้อยแบบใดก็ได้',
   'A full-limit Credit-Building Loan': 'Credit-Building Loan แบบเต็มวงเงิน',
   'Paying a fee': 'การจ่ายค่าธรรมเนียม',
   'Logging in daily': 'การเข้าสู่ระบบทุกวัน',
   'You jump to $40': 'คุณข้ามไปที่ $40 ทันที',
   'Limit stays $20, trust grows': 'วงเงินยังเป็น $20 แต่ความน่าเชื่อถือเพิ่มขึ้น',
   'You drop to $15': 'คุณถูกลดลงไปที่ $15',
   'Nothing, ever': 'ไม่มีผลอะไรเลย',
   'Yes, pay 4× up front': 'ได้ จ่าย 4× ล่วงหน้า',
   'No — one level at a time': 'ไม่ได้ — ทีละระดับเท่านั้น',
   'Only on weekends': 'ได้เฉพาะวันหยุดสุดสัปดาห์',
   'Yes, with a coupon': 'ได้ ถ้ามีคูปอง',
   'Repaying early': 'การชำระคืนก่อนกำหนด',
   'A late or missed repayment': 'การชำระคืนล่าช้าหรือไม่ได้ชำระ',
   'Borrowing your full limit': 'การกู้เต็มวงเงิน',
   'Asking questions': 'การถามคำถาม',
   'Flawless run. You could teach the hippos.': 'ไร้ที่ติ คุณสอนฮิปโปได้เลย',
   'Solid! You’ve basically got this down.': 'เยี่ยม! คุณเข้าใจเรื่องนี้แล้วเกือบทั้งหมด',
   'No worries — scroll back up and you’ll ace the rematch.': 'ไม่เป็นไร — เลื่อนกลับขึ้นไปอ่านอีกรอบ แล้วรอบหน้าคุณจะทำได้ดีแน่นอน',
   'See my score': 'ดูคะแนนของฉัน',
   Guides: 'คู่มือ',
   'Updated Jun 2026 · 5 min read': 'อัปเดต มิ.ย. 2026 · อ่าน 5 นาที',
   'Read guide →': 'อ่านคู่มือ →',

   // src/views/support/PublicGuide.tsx
   'By the Moodeng Team · Updated': 'โดยทีม Moodeng · อัปเดตเมื่อ',

   // src/views/support/Updates.tsx
   Updates: 'อัปเดต',

   // src/views/support/WhyUsdc.tsx
   'Real-world use': 'การใช้งานในชีวิตจริง',
   'Payments & money movement': 'การชำระเงินและการโอนเงิน',
   'Send money to family abroad in seconds': 'ส่งเงินให้ครอบครัวในต่างประเทศได้ในไม่กี่วินาที',
   'Pay a merchant that accepts stablecoins': 'จ่ายเงินให้ร้านค้าที่รับสเตเบิลคอยน์',
   'Cash out to a bank or exchange': 'ถอนเป็นเงินสดไปยังธนาคารหรือแพลตฟอร์มแลกเปลี่ยนคริปโต',
   'On Moodeng, this is how loans work: a lender sends you USDC, and you repay in USDC.':
      'บน Moodeng เงินกู้ทำงานแบบนี้: ผู้ให้กู้ส่ง USDC ให้คุณ แล้วคุณชำระคืนเป็น USDC',
   'DeFi use': 'การใช้งานใน DeFi',
   'DeFi means "decentralized finance" — financial apps that run on smart contracts instead of a bank. You can lend, borrow, or swap USDC directly from your wallet.':
      'DeFi ย่อมาจาก "decentralized finance" (การเงินแบบกระจายศูนย์) — แอปการเงินที่ทำงานบนสมาร์ตคอนแทรกต์แทนธนาคาร คุณสามารถให้กู้ กู้ยืม หรือแลกเปลี่ยน USDC ได้โดยตรงจากกระเป๋าเงินของคุณ',
   'Lend USDC to earn yield': 'ให้กู้ USDC เพื่อรับผลตอบแทน',
   'Provide liquidity to a trading pool': 'เพิ่มสภาพคล่องให้กับพูลการซื้อขาย',
   'Borrow against crypto you already hold': 'กู้ยืมโดยใช้คริปโตที่คุณถืออยู่เป็นหลักประกัน',
   'Moodeng is community lending, not a DeFi yield product — but USDC lets it plug into this wider ecosystem.':
      'Moodeng คือการให้กู้ยืมในชุมชน ไม่ใช่ผลิตภัณฑ์หาผลตอบแทนแบบ DeFi — แต่ USDC ช่วยให้ Moodeng เชื่อมต่อกับระบบนิเวศที่กว้างขึ้นนี้ได้',
   'A cryptocurrency designed to hold a steady value. USDC is pegged 1:1 to the US dollar, so it does not swing like Bitcoin.':
      'คริปโตเคอร์เรนซีที่ออกแบบมาให้มูลค่าคงที่ USDC ผูกค่า 1:1 กับดอลลาร์สหรัฐ จึงไม่ผันผวนเหมือน Bitcoin',
   'Wallet-to-wallet transfer': 'การโอนจากกระเป๋าเงินถึงกระเป๋าเงิน',
   'Sending funds straight from one crypto wallet to another, with no bank or payment processor sitting in the middle.':
      'การส่งเงินตรงจากกระเป๋าเงินคริปโตใบหนึ่งไปยังอีกใบ โดยไม่มีธนาคารหรือผู้ให้บริการชำระเงินเป็นตัวกลาง',
   'Gas (and “gasless”)': 'Gas (และ “gasless”)',
   'Gas is the small network fee to move crypto. On Base, USDC transfers are sponsored, so they feel gasless — you pay nothing.':
      'Gas คือค่าธรรมเนียมเครือข่ายเล็กน้อยสำหรับการโอนคริปโต บน Base การโอน USDC ได้รับการสนับสนุนค่า gas จึงเหมือนไม่มีค่า gas — คุณไม่ต้องจ่ายอะไรเลย',
   'Spending or sending USDC like ordinary money: payments, remittances, and cashing out to local currency.':
      'การใช้จ่ายหรือส่ง USDC เหมือนเงินทั่วไป: ชำระเงิน ส่งเงินกลับบ้าน และถอนเป็นเงินสดสกุลท้องถิ่น',
   'Decentralized finance — lending, borrowing, and trading run by smart contracts on a blockchain instead of a bank.':
      'การเงินแบบกระจายศูนย์ — การให้กู้ การกู้ยืม และการซื้อขายที่ดำเนินการโดยสมาร์ตคอนแทรกต์บนบล็อกเชนแทนธนาคาร',
   Staking: 'การ Staking',
   'Locking up a crypto token to help secure a proof-of-stake blockchain, earning rewards in return. USDC is not a staking token.':
      'การล็อกโทเคนคริปโตไว้เพื่อช่วยรักษาความปลอดภัยของบล็อกเชนแบบ proof-of-stake และได้รับผลตอบแทนเป็นการแลกเปลี่ยน USDC ไม่ใช่โทเคนสำหรับ staking',
   Yield: 'ผลตอบแทน (Yield)',
   'The return you earn by putting USDC to work — for example, lending it out in DeFi. Yield is a payout, not network security.':
      'ผลตอบแทนที่คุณได้รับจากการนำ USDC ไปใช้ให้เกิดประโยชน์ เช่น ปล่อยกู้ใน DeFi ผลตอบแทนคือเงินที่จ่ายให้คุณ ไม่ใช่การรักษาความปลอดภัยของเครือข่าย',
   'Does Moodeng offer USDC staking or yield?': 'Moodeng มีบริการ staking หรือผลตอบแทนจาก USDC หรือไม่?',
   'A quick guide to how USDC is used for loans and repayments in the app.':
      'คู่มือฉบับย่อว่า USDC ถูกใช้ในการกู้และการชำระคืนในแอปอย่างไร',
   'Your Instant Wallet is set up from your login (or connect a Base Account) — then send your first request.':
      'Instant Wallet ของคุณถูกตั้งค่าจากการเข้าสู่ระบบ (หรือเชื่อมต่อ Base Account) — จากนั้นส่งคำขอแรกของคุณ',
   'How your borrowing limit grows $15 → $20 → $40 → $60 as you repay.':
      'วงเงินกู้ของคุณเพิ่มขึ้น $15 → $20 → $40 → $60 เมื่อคุณชำระคืนอย่างไร',
   'Why Moodeng uses USDC': 'ทำไม Moodeng จึงใช้ USDC',
   'Updated Jul 2026 · 6 min read': 'อัปเดต ก.ค. 2026 · อ่าน 6 นาที',
   'One USDC always equals one US dollar': '1 USDC มีค่าเท่ากับ 1 ดอลลาร์สหรัฐเสมอ',
   stablecoin: 'สเตเบิลคอยน์',
   ': a cryptocurrency built to stay worth exactly one US dollar. It is issued by Circle, backed fully by cash and short-term US Treasuries, and its reserves are attested by independent accounting firms every month. Because it lives on a blockchain, it can move between wallets in seconds — while staying as steady as the dollar it tracks.':
      ': คริปโตเคอร์เรนซีที่สร้างมาให้มีมูลค่าเท่ากับหนึ่งดอลลาร์สหรัฐพอดี ออกโดย Circle มีเงินสดและพันธบัตรรัฐบาลสหรัฐระยะสั้นหนุนหลังเต็มจำนวน และทุนสำรองได้รับการรับรองโดยบริษัทบัญชีอิสระทุกเดือน เพราะอยู่บนบล็อกเชน จึงโอนระหว่างกระเป๋าเงินได้ในไม่กี่วินาที — ในขณะที่มูลค่ายังคงมั่นคงเท่ากับดอลลาร์ที่ผูกไว้',
   'Four reasons we chose USDC': 'สี่เหตุผลที่เราเลือก USDC',
   'Real-world use vs DeFi use': 'การใช้งานในชีวิตจริง vs การใช้งานใน DeFi',
   'Staking vs yield, side by side:': 'เปรียบเทียบ Staking กับผลตอบแทน (Yield):',
   'USDC, answered': 'ตอบทุกคำถามเรื่อง USDC',

   // src/views/support/data/updates.ts
   'Live Filters & Cleaner Borrowing Flow': 'ตัวกรองแบบเรียลไทม์และขั้นตอนการกู้ที่เรียบง่ายขึ้น',
   'Request Board and history filters now update as you tap': 'ตัวกรองในกระดานคำขอและประวัติจะอัปเดตทันทีที่คุณแตะ',
   'May 24, 2026': '24 พ.ค. 2026',
   'Latest May 2026 update': 'อัปเดตล่าสุด พ.ค. 2026',
   'Base Wallet & World ID Onboarding': 'การเริ่มต้นใช้งาน Base Wallet และ World ID',
   'Clearer wallet handoff • Stronger human verification flow':
      'ส่งต่อไปยังกระเป๋าเงินได้ชัดเจนขึ้น • ขั้นตอนยืนยันความเป็นมนุษย์ที่รัดกุมขึ้น',
   'May 23, 2026': '23 พ.ค. 2026',
   'Borrower onboarding has been tightened so each step leads naturally into the next. The Base Wallet screen is simpler, the connected-wallet success screen now uses the final success mark, and World ID actions are easier to understand from the Request Board and onboarding flow. This update also improves duplicate World ID handling and keeps borrowers moving through the right next step after wallet connection, verification, or a request-board action.':
      'ขั้นตอนเริ่มต้นใช้งานของผู้ยืมได้รับการปรับให้กระชับขึ้น เพื่อให้แต่ละขั้นต่อเนื่องไปยังขั้นถัดไปอย่างเป็นธรรมชาติ หน้าจอ Base Wallet เรียบง่ายขึ้น หน้าจอเชื่อมต่อกระเป๋าเงินสำเร็จใช้เครื่องหมายสำเร็จแบบใหม่ และการดำเนินการเกี่ยวกับ World ID เข้าใจง่ายขึ้นทั้งจากกระดานคำขอและขั้นตอนเริ่มต้นใช้งาน อัปเดตนี้ยังปรับปรุงการจัดการ World ID ที่ซ้ำกัน และช่วยพาผู้ยืมไปยังขั้นตอนถัดไปที่ถูกต้องหลังจากเชื่อมต่อกระเป๋าเงิน ยืนยันตัวตน หรือดำเนินการบนกระดานคำขอ',
   'Clearer Loan & Repay States': 'สถานะเงินกู้และการชำระคืนที่ชัดเจนขึ้น',
   'Pending funding, repayment, and navigation are easier to trust': 'สถานะรอการปล่อยกู้ การชำระคืน และการนำทางน่าเชื่อถือยิ่งขึ้น',
   'May 22, 2026': '22 พ.ค. 2026',
   'Loan screens now do a better job showing what is actually happening. Pending requests are clearer before they are funded, repayment screens avoid misleading action states, and bottom navigation between Request Board, Repay, Dashboard, History, and Account is more reliable. These changes are designed to make the app feel calmer when money is involved: the screen should say whether a loan is waiting, active, repaid, or unavailable without making you guess.':
      'ตอนนี้หน้าจอเงินกู้แสดงสิ่งที่เกิดขึ้นจริงได้ดีขึ้น คำขอที่รอดำเนินการชัดเจนขึ้นก่อนได้รับการปล่อยกู้ หน้าจอการชำระคืนไม่แสดงสถานะปุ่มที่ทำให้เข้าใจผิด และแถบนำทางด้านล่างระหว่างกระดานคำขอ ชำระคืน แดชบอร์ด ประวัติ และบัญชีทำงานได้เสถียรขึ้น การเปลี่ยนแปลงเหล่านี้ช่วยให้แอปดูสงบและวางใจได้เมื่อเกี่ยวข้องกับเงิน หน้าจอควรบอกได้ว่าเงินกู้กำลังรอ กำลังดำเนินอยู่ ชำระคืนแล้ว หรือไม่พร้อมใช้งาน โดยไม่ต้องให้คุณเดา',
   'Trust System & Admin Readiness': 'ระบบความน่าเชื่อถือและความพร้อมของระบบผู้ดูแล',
   'Cleaner IOU rules • Better account status and recovery controls': 'กฎแต้ม IOU ที่ชัดเจนขึ้น • การควบคุมสถานะบัญชีและการกู้คืนที่ดีขึ้น',
   'May 20, 2026': '20 พ.ค. 2026',
   'The trust layer behind Moodeng has been made more consistent. Lender IOU point rules are now easier to reason about, admin status controls are closer to the real account state, and recovery workflows have more reliable data to work from. Most of this work sits behind the scenes, but it matters: borrower records, lender incentives, overdue loans, and account restrictions need to line up before the product can scale safely.':
      'ระบบความน่าเชื่อถือเบื้องหลัง Moodeng มีความสอดคล้องกันมากขึ้น กฎแต้ม IOU ของผู้ให้กู้เข้าใจง่ายขึ้น การควบคุมสถานะโดยผู้ดูแลตรงกับสถานะบัญชีจริงมากขึ้น และขั้นตอนการกู้คืนมีข้อมูลที่เชื่อถือได้มากขึ้น งานส่วนใหญ่เกิดขึ้นเบื้องหลัง แต่มีความสำคัญ: ประวัติผู้ยืม สิ่งจูงใจของผู้ให้กู้ เงินกู้ที่เกินกำหนด และข้อจำกัดของบัญชีต้องสอดคล้องกันก่อนที่ผลิตภัณฑ์จะขยายได้อย่างปลอดภัย',
   'Support Library & Credit Education': 'คลังความช่วยเหลือและความรู้ด้านเครดิต',
   'Repayment guides • Credit leveling • Borrower safety content':
      'คู่มือการชำระคืน • การเพิ่มระดับเครดิต • เนื้อหาความปลอดภัยสำหรับผู้ยืม',
   'May 16, 2026': '16 พ.ค. 2026',
   'The support area has been refreshed around the questions borrowers and lenders actually ask. Guides now explain repayment, Pandesal points, credit leveling, World ID, Base Wallet setup, and borrower safety in clearer language. We also added more educational content around portable repayment history and safer alternatives to predatory lending, so new users can understand what Moodeng is building before they request or fund a loan.':
      'ส่วนช่วยเหลือได้รับการปรับปรุงใหม่โดยยึดตามคำถามที่ผู้ยืมและผู้ให้กู้ถามจริง ตอนนี้คู่มืออธิบายเรื่องการชำระคืน แต้ม Pandesal การเพิ่มระดับเครดิต World ID การตั้งค่า Base Wallet และความปลอดภัยของผู้ยืมด้วยภาษาที่ชัดเจนขึ้น เรายังเพิ่มเนื้อหาความรู้เกี่ยวกับประวัติการชำระคืนที่ติดตัวไปได้ และทางเลือกที่ปลอดภัยกว่าการกู้เงินนอกระบบที่เอารัดเอาเปรียบ เพื่อให้ผู้ใช้ใหม่เข้าใจสิ่งที่ Moodeng กำลังสร้างก่อนจะขอกู้หรือปล่อยกู้',

   // src/views/transactions/TransactionDetail.tsx
   'Not funded yet': 'ยังไม่ได้รับการปล่อยกู้',
   'If applicable': 'หากมี',
   'Available after funding': 'ดูได้หลังการปล่อยกู้',
   Refunded: 'คืนเงินแล้ว',
   'Waiting for lender': 'รอผู้ให้กู้',
   'Repayment schedule': 'กำหนดการชำระคืน',
   'Partial repayment': 'การชำระคืนบางส่วน',
   'Interest returned': 'คืนดอกเบี้ยแล้ว',
   'paid back in full': 'ชำระคืนครบแล้ว',
   'Returning to': 'กำลังคืนให้',
   'Recording your gift — hang tight.': 'กำลังบันทึกของขวัญของคุณ — รอสักครู่',
   'You returned': 'คุณคืน',
   '. That was kind of you.': 'แล้ว ใจดีมากเลย',
   'Gift from your lender': 'ของขวัญจากผู้ให้กู้ของคุณ',
   'You returned the interest': 'คุณคืนดอกเบี้ยแล้ว',
   'Interest returned!': 'ได้รับดอกเบี้ยคืนแล้ว!',
   'Cannot return interest': 'คืนดอกเบี้ยไม่ได้',
   'Borrower wallet address is unavailable.': 'ไม่พบที่อยู่กระเป๋าเงินของผู้ยืม',
   'Lender has not accepted yet': 'ผู้ให้กู้ยังไม่ได้ตอบรับ',
   'Not active': 'ยังไม่เริ่ม',
   'Requested on': 'ขอเมื่อ',
   'This repayment was sent to the wallet you funded this loan from:': 'การชำระคืนนี้ถูกส่งไปยังกระเป๋าเงินที่คุณใช้ปล่อยกู้รายการนี้:',
   'When repaid, funds return to the wallet you funded this loan from:':
      'เมื่อมีการชำระคืน เงินจะกลับเข้าสู่กระเป๋าเงินที่คุณใช้ปล่อยกู้รายการนี้:',
   'This differs from the wallet you have connected now (': 'กระเป๋าเงินนี้ไม่ใช่กระเป๋าเงินที่คุณเชื่อมต่ออยู่ตอนนี้ (',
   '). That is expected — repayments go to the wallet used to fund each loan, not your current one. Open':
      ') ซึ่งเป็นเรื่องปกติ — การชำระคืนจะเข้ากระเป๋าเงินที่ใช้ปล่อยกู้แต่ละรายการ ไม่ใช่กระเป๋าเงินปัจจุบันของคุณ เปิด',
   'to find these funds.': 'เพื่อดูเงินเหล่านี้',

   // src/views/transactions/TransactionHistory.tsx
   'Awaiting lender': 'รอผู้ให้กู้',
   'out of': 'จาก',

   // src/views/user-profile/LenderDiversityHistory.tsx
   'Unknown lender': 'ผู้ให้กู้ที่ไม่ทราบชื่อ',
   'Switch lender diversity to light mode': 'สลับความหลากหลายของผู้ให้กู้เป็นโหมดสว่าง',
   'Switch lender diversity to dark mode': 'สลับความหลากหลายของผู้ให้กู้เป็นโหมดมืด',
   Unique: 'ราย',
   Lenders: 'ผู้ให้กู้',
   'Shows how': 'แสดงว่าประวัติเงินกู้ที่ได้รับการปล่อยกู้ของ',
   "'s funded loan history is spread across lenders.": 'กระจายไปยังผู้ให้กู้แต่ละรายอย่างไร',

   // src/views/user-profile/ProgressHistory.tsx
   Milestone: 'หมุดหมาย',
   'New borrower': 'ผู้ยืมใหม่',
   'Credit Building Loan Funded': 'ได้รับการปล่อยกู้ Credit-Building Loan แล้ว',
   'Trust Building Loan Funded': 'ได้รับการปล่อยกู้ Trust-Building Loan แล้ว',
   Activity: 'กิจกรรม',
   'Loan Repaid Early': 'ชำระคืนเงินกู้ก่อนกำหนด',
   'Loan Repaid Late': 'ชำระคืนเงินกู้ล่าช้า',
   'Credit Building Loan Repaid': 'ชำระคืน Credit-Building Loan แล้ว',
   'Trust Building Loan Repaid': 'ชำระคืน Trust-Building Loan แล้ว',
   'Credit Building loan closed before due date.': 'ปิด Credit-Building Loan ก่อนวันครบกำหนด',
   'Trust Building loan closed before due date.': 'ปิด Trust-Building Loan ก่อนวันครบกำหนด',
   'Remaining balance repaid on time.': 'ชำระยอดคงเหลือคืนตรงเวลาแล้ว',
   'Early Repayment': 'ชำระคืนก่อนกำหนด',
   Late: 'ล่าช้า',
   'Unlocked Level 1 with full level credit available.': 'ปลดล็อกระดับ 1 พร้อมวงเงินเต็มระดับ',
   'Unlocked Level 2 with full level credit available.': 'ปลดล็อกระดับ 2 พร้อมวงเงินเต็มระดับ',
   'Unlocked Level 3 with full level credit available.': 'ปลดล็อกระดับ 3 พร้อมวงเงินเต็มระดับ',
   'Unlocked Level 4 with full level credit available.': 'ปลดล็อกระดับ 4 พร้อมวงเงินเต็มระดับ',
   'Unlocked Level 5 with full level credit available.': 'ปลดล็อกระดับ 5 พร้อมวงเงินเต็มระดับ',
   'Unlocked Level 6 with full level credit available.': 'ปลดล็อกระดับ 6 พร้อมวงเงินเต็มระดับ',
   'Unlocked Level 7 with full level credit available.': 'ปลดล็อกระดับ 7 พร้อมวงเงินเต็มระดับ',
   'Unlocked Level 8 with full level credit available.': 'ปลดล็อกระดับ 8 พร้อมวงเงินเต็มระดับ',
   'Level Up': 'เลื่อนระดับ',
   Insight: 'ข้อมูลเชิงลึก',
   'Switch progress history to light mode': 'สลับประวัติความคืบหน้าเป็นโหมดสว่าง',
   'Switch progress history to dark mode': 'สลับประวัติความคืบหน้าเป็นโหมดมืด',
   'Defaults Present': 'มีการผิดนัดชำระ',

   // src/views/user-profile/UserProfile.tsx
   'No loan mix yet': 'ยังไม่มีสัดส่วนเงินกู้',
   'More Credit-Building Loans': 'Credit-Building Loan มากกว่า',
   'Balanced Loan Mix': 'สัดส่วนเงินกู้สมดุล',
   'Lender Insights': 'ข้อมูลเชิงลึกของผู้ให้กู้',
   'Lender Account': 'บัญชีผู้ให้กู้',
   'Switch borrower insights to light mode': 'สลับข้อมูลเชิงลึกของผู้ยืมเป็นโหมดสว่าง',
   'Switch borrower insights to dark mode': 'สลับข้อมูลเชิงลึกของผู้ยืมเป็นโหมดมืด',
   'Verified borrower': 'ผู้ยืมที่ยืนยันตัวตนแล้ว',
   'Not verified': 'ยังไม่ได้ยืนยันตัวตน',
   'Repaid Back': 'ชำระคืนแล้ว',
   Expected: 'ที่คาดว่าจะได้รับ',
   'funded more than once': 'ได้รับการปล่อยกู้มากกว่าหนึ่งครั้ง',
   'Progress history ›': 'ประวัติความคืบหน้า ›',
   'milestones hit': 'หมุดหมายที่ทำสำเร็จ',
   'View all ›': 'ดูทั้งหมด ›',
   'Repay a loan on time to start a streak': 'ชำระคืนเงินกู้ตรงเวลาเพื่อเริ่มสถิติต่อเนื่อง',
   'Earned from your first on-time repayment': 'ได้รับจากการชำระคืนตรงเวลาครั้งแรกของคุณ',
   'Claimed: we’re sending your code': 'รับสิทธิ์แล้ว: เรากำลังส่งโค้ดให้คุณ',
   'Sent to your mobile': 'ส่งไปยังมือถือของคุณแล้ว',
   'Repay your first loan on time to unlock it': 'ชำระคืนเงินกู้ครั้งแรกตรงเวลาเพื่อปลดล็อก',
   Defaults: 'ครั้งที่ผิดนัดชำระ',
   '0 Defaults': 'ผิดนัดชำระ 0 ครั้ง',
   'Borrowed: $': 'ยืม: $',
   'fully repaid': 'ชำระคืนครบแล้ว',
   'Partial repayments': 'การชำระคืนบางส่วน',
   'Loan fully repaid': 'ชำระคืนเงินกู้ครบแล้ว',
   'Partial repayment made': 'ชำระคืนบางส่วนแล้ว',
   'Repaid: $': 'ชำระคืนแล้ว: $',
   Level: 'ระดับ',
   "Checks whether one lender funded most of the borrower's history.":
      'ตรวจสอบว่ามีผู้ให้กู้รายเดียวปล่อยกู้ส่วนใหญ่ในประวัติของผู้ยืมหรือไม่',
   'This borrower does not have enough loan history for a loan mix yet.': 'ผู้ยืมรายนี้ยังมีประวัติเงินกู้ไม่มากพอที่จะแสดงสัดส่วนเงินกู้',
   'Repayment-history signal': 'สัญญาณจากประวัติการชำระคืน',
   'repays $': 'ชำระคืน $',

   // src/views/withdraw/Withdraw.tsx
   ". A different coin or network can't be recovered.": ' เท่านั้น — หากเป็นเหรียญหรือเครือข่ายอื่นจะกู้คืนไม่ได้',
   '· Repay': '· ชำระคืน',
   by: 'ภายใน',
   'Continue with': 'ดำเนินการต่อด้วย',
   'USDC to': 'USDC ไปยัง',
   'USDC to Binance': 'USDC ไปยัง Binance',
   'USDC is on its way — arriving in a few minutes.': 'USDC กำลังส่งไป — จะถึงภายในไม่กี่นาที',
   'USDC is on its way to': 'USDC กำลังส่งไปยัง',
   'How to transfer to': 'วิธีโอนไปยัง',
   'transfer address': 'ที่อยู่สำหรับโอน',
   'Complete Moneybees KYC': 'ทำ KYC กับ Moneybees ให้เสร็จ',
   'A one-time ID check on their secure page.': 'ตรวจสอบบัตรประชาชนครั้งเดียวบนหน้าเว็บที่ปลอดภัยของพวกเขา',
   'Via Telegram, Viber, or WhatsApp.': 'ผ่าน Telegram, Viber หรือ WhatsApp',
   'They lock in the rate and payout method.': 'พวกเขาจะล็อกอัตราแลกเปลี่ยนและวิธีการจ่ายเงินให้',
   'Send USDC only once Moneybees confirms the details.': 'ส่ง USDC หลังจาก Moneybees ยืนยันรายละเอียดแล้วเท่านั้น',
   'Moneybees will message you on your chosen chat app to confirm the rate and complete your':
      'Moneybees จะส่งข้อความหาคุณทางแอปแชทที่คุณเลือก เพื่อยืนยันอัตราแลกเปลี่ยนและดำเนินการถอนเงินสด',
   'USDC cash-out.': 'USDC ของคุณให้เสร็จสิ้น',
   "I've completed Moneybees KYC": 'ฉันทำ KYC กับ Moneybees เสร็จแล้ว',
   'I already have Moneybees KYC': 'ฉันทำ KYC กับ Moneybees แล้ว',
   Ref: 'เลขอ้างอิง',
   // src/views/dashboard/components/ContactsStep.tsx (Messenger recovery, #1001)
   'Not confirmed yet?': 'ยังไม่ได้รับการยืนยันใช่ไหม',
   '. Now that our chat is open, the second try usually works.': ' เมื่อแชทของเราเปิดอยู่แล้ว การลองครั้งที่สองมักจะสำเร็จ',
   'Or send this code to': 'หรือส่งรหัสนี้ไปที่',
   "Still stuck? We'll email you, and our team will help you finish.":
      'ยังติดปัญหาอยู่ใช่ไหม เราจะส่งอีเมลถึงคุณ และทีมงานของเราจะช่วยให้คุณทำสำเร็จ',
   // Added 2026-10-01: English that changed after the translation pass (full-limit rule, Coins.ph pause).
   "Repay a full-limit loan to unlock the next level.": "ชำระคืนเงินกู้เต็มวงเงินเพื่อปลดล็อกเลเวลถัดไป",
   "left to repay for LV.2": "ที่เหลือต้องชำระเพื่อไป LV.2",
   "full-limit loan unlocks LV.2": "เงินกู้เต็มวงเงินจะปลดล็อก LV.2",
   "left to repay for LV.3": "ที่เหลือต้องชำระเพื่อไป LV.3",
   "full-limit loan unlocks LV.3": "เงินกู้เต็มวงเงินจะปลดล็อก LV.3",
   "left to repay for LV.4": "ที่เหลือต้องชำระเพื่อไป LV.4",
   "full-limit loan unlocks LV.4": "เงินกู้เต็มวงเงินจะปลดล็อก LV.4",
   "left to repay for LV.5": "ที่เหลือต้องชำระเพื่อไป LV.5",
   "full-limit loan unlocks LV.5": "เงินกู้เต็มวงเงินจะปลดล็อก LV.5",
   "left to repay for LV.6": "ที่เหลือต้องชำระเพื่อไป LV.6",
   "full-limit loan unlocks LV.6": "เงินกู้เต็มวงเงินจะปลดล็อก LV.6",
   "left to repay for LV.7": "ที่เหลือต้องชำระเพื่อไป LV.7",
   "full-limit loan unlocks LV.7": "เงินกู้เต็มวงเงินจะปลดล็อก LV.7",
   "left to repay for LV.8": "ที่เหลือต้องชำระเพื่อไป LV.8",
   "full-limit loan unlocks LV.8": "เงินกู้เต็มวงเงินจะปลดล็อก LV.8",
   "Coins.ph is temporarily paused": "Coins.ph ระงับชั่วคราว",
   "Coins.ph has been temporarily suspended by the Philippine government, so cash-ins and cash-outs there aren't working right now. It'll be back — we'll update this as soon as it is. Until then, please use PDAX or GCrypto (GCash).": "Coins.ph ถูกรัฐบาลฟิลิปปินส์ระงับการให้บริการชั่วคราว จึงยังเติมเงินและถอนเงินผ่าน Coins.ph ไม่ได้ในขณะนี้ บริการจะกลับมา และเราจะแจ้งให้ทราบทันทีที่กลับมา ระหว่างนี้โปรดใช้ PDAX หรือ GCrypto (GCash)",
   "Temporarily paused": "ระงับชั่วคราว",
   "Coins.ph (temporarily paused)": "Coins.ph (ระงับชั่วคราว)",
   "Temporarily suspended by the Philippine government — use PDAX or GCrypto for now. Buy USDC with PHP, then Send Crypto → External Wallet → Base network.": "ถูกรัฐบาลฟิลิปปินส์ระงับชั่วคราว ระหว่างนี้ใช้ PDAX หรือ GCrypto ไปก่อน ซื้อ USDC ด้วย PHP แล้วไปที่ Send Crypto → External Wallet → เครือข่าย Base",
   "Temporarily suspended by the Philippine government — use PDAX or GCrypto for now. Deposit USDC, convert to PHP, and cash out to your bank or GCash.": "ถูกรัฐบาลฟิลิปปินส์ระงับชั่วคราว ระหว่างนี้ใช้ PDAX หรือ GCrypto ไปก่อน ฝาก USDC แปลงเป็น PHP แล้วถอนเข้าบัญชีธนาคารหรือ GCash ของคุณ",
   "Temporarily suspended by the Philippine government — use PDAX or GCrypto for now. Buy USDC with PHP, then use Send Crypto → External Wallet → Base network.": "ถูกรัฐบาลฟิลิปปินส์ระงับชั่วคราว ระหว่างนี้ใช้ PDAX หรือ GCrypto ไปก่อน ซื้อ USDC ด้วย PHP แล้วใช้ Send Crypto → External Wallet → เครือข่าย Base",

   // Pre-KYC gate + KYC tries (ConnectStep kyc copy, KycDeclinedNotifier, /verify, dashboard banners)
   "Before you verify your ID, we meet every borrower on a quick 15-min video call.": "ก่อนยืนยันตัวตน เราจะคุยกับผู้กู้ทุกคนผ่านวิดีโอคอลสั้น ๆ 15 นาที",
   "Verify your ID right after the call": "ยืนยันตัวตนได้ทันทีหลังคอล",
   "The team is unlocking your ID verification — we’ll message you the moment it’s ready.": "ทีมกำลังเปิดการยืนยันตัวตนให้คุณ — เราจะส่งข้อความหาคุณทันทีที่พร้อม",
   "You’re booked! Tap “I’ll be there” so we keep your spot — you can verify your ID right after the call.": "จองแล้ว! แตะ “I’ll be there” เพื่อให้เราเก็บที่ไว้ให้ — คุณยืนยันตัวตนได้ทันทีหลังคอล",
   "Thank you for confirming! You can verify your ID right after the call.": "ขอบคุณที่ยืนยัน! คุณยืนยันตัวตนได้ทันทีหลังคอล",
   "Look around meanwhile": "ระหว่างนี้ลองดูรอบ ๆ ก่อน",
   "Your ID check didn't go through": "การตรวจสอบบัตรของคุณไม่ผ่าน",
   "That happens — let's sort it out together. Connect Messenger and the team will message you to help.": "เกิดขึ้นได้ — มาแก้ไขด้วยกัน เชื่อมต่อ Messenger แล้วทีมจะส่งข้อความไปช่วยคุณ",
   "Let's sort it out together. Connect Messenger and the team will message you to help.": "มาแก้ไขด้วยกัน เชื่อมต่อ Messenger แล้วทีมจะส่งข้อความไปช่วยคุณ",
   "Connect Messenger": "เชื่อมต่อ Messenger",
   "Later": "ไว้ทีหลัง",
   "Let's verify you together": "มายืนยันตัวตนด้วยกัน",
   "Your ID check didn't pass 3 times, so the team will help you directly. Message us on Messenger and we'll sort it out with you.": "การตรวจสอบบัตรของคุณไม่ผ่าน 3 ครั้ง ทีมจึงจะช่วยคุณโดยตรง ส่งข้อความหาเราทาง Messenger แล้วเราจะช่วยแก้ไขให้",
   "Message us on Messenger": "ส่งข้อความหาเราทาง Messenger",
   "1 of 3 tries left": "เหลือ 1 จาก 3 ครั้ง",
   "2 of 3 tries left": "เหลือ 2 จาก 3 ครั้ง",
   "Meet the team": "พบกับทีม",
   "A quick 15-min call, then you can verify your ID and borrow.": "คอลสั้น ๆ 15 นาที แล้วคุณยืนยันตัวตนและกู้ได้",
   "Right after it, you can verify your ID and borrow.": "หลังจากนั้นคุณยืนยันตัวตนและกู้ได้ทันที",
   "Book": "จอง",
   "View": "ดู",
   "Connect": "เชื่อมต่อ",
   "Meet the team >": "พบกับทีม >"
};
