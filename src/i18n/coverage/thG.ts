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

   // src/views/dashboard/components/ConnectStep.tsx

   // src/views/dashboard/components/CreditLevelSection.tsx

   // src/views/dashboard/components/LenderDiversitySection.tsx
   'Unique Lender': 'ผู้ให้กู้ที่ไม่ซ้ำกัน',
   'Unique Lenders': 'ผู้ให้กู้ที่ไม่ซ้ำกัน',

   // src/views/dashboard/components/LoanRequestModal.tsx
   'more character': 'ตัวอักษร',
   'to go': 'ที่ยังต้องพิมพ์เพิ่ม',

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
   'First-time user': 'ผู้ใช้ครั้งแรก'
};
