// Thai translations for on-screen English copy that has no entry in screenTranslations.ts,
// keyed by the exact English text. Loaded on demand by LocalizationDomBridge (see ./index.ts).
export const thaiCoverageC: Record<string, string> = {
   // src/views/lender/loanNote/LoanNotePurchase.tsx
   'Loan not found': 'ไม่พบเงินกู้',
   'This support link is invalid or the loan is no longer available.': 'ลิงก์นี้ไม่ถูกต้อง หรือเงินกู้นี้ไม่เปิดให้ปล่อยกู้แล้ว',
   'Amount funded': 'ยอดที่ปล่อยกู้',
   'Will repay': 'ยอดที่จะชำระคืน',
   'You already own this Loan Note.': 'คุณเป็นเจ้าของ Loan Note นี้อยู่แล้ว',
   'You’ll be asked to sign in or sign up, then returned here to complete your support.':
      'ระบบจะให้คุณเข้าสู่ระบบหรือสมัครสมาชิก แล้วพากลับมาที่นี่เพื่อปล่อยกู้ให้เสร็จ',
   'Your purchase is confirmed on-chain (you own the Loan Note). We’re still syncing it to your dashboard — it’ll appear shortly. Your funds and IOU points are safe.':
      'การซื้อของคุณได้รับการยืนยันบนเชนแล้ว (คุณเป็นเจ้าของ Loan Note นี้) เรากำลังซิงก์ข้อมูลไปยังแดชบอร์ดของคุณ และจะแสดงในไม่ช้า เงินและแต้ม IOU ของคุณปลอดภัย',
   'Remaining owed': 'ยอดคงเหลือที่ต้องชำระ',
   'IOU points reward': 'แต้ม IOU ที่จะได้รับ',
   'Purchase amount': 'ยอดซื้อ',
   'this borrower': 'ผู้ยืมรายนี้',
   'Checking balance…': 'กำลังตรวจสอบยอดเงิน…',
   'Approving USDC…': 'กำลังอนุมัติ USDC…',
   'Confirming purchase…': 'กำลังยืนยันการซื้อ…',
   'Finalizing…': 'กำลังดำเนินการให้เสร็จ…',
   'Processing…': 'กำลังดำเนินการ…',
   'Fund this loan and receive the repayment if': 'ปล่อยกู้รายการนี้ และรับเงินชำระคืนเมื่อ',
   'pays back.': 'ชำระคืน',
   'Trust level': 'ระดับเครดิต',
   If: 'หาก',
   'repays, the repayment is automatically sent to your wallet — you don’t need to claim anything.':
      'ชำระคืน เงินจะถูกส่งเข้ากระเป๋าเงินของคุณโดยอัตโนมัติ โดยไม่ต้องกดรับ',
   'Not available for purchase': 'ไม่เปิดให้ซื้อ',
   'You funded': 'คุณปล่อยกู้ให้',
   '’s loan. If they repay, the repayment is sent straight to your wallet — no claim needed.':
      'แล้ว เมื่อผู้ยืมชำระคืน เงินจะถูกส่งตรงเข้ากระเป๋าเงินของคุณ โดยไม่ต้องกดรับ',

   // src/views/lender/performance/LenderPerformance.tsx
   'Performance Insights': 'ข้อมูลเชิงลึกผลการดำเนินงาน',
   'No transactions yet': 'ยังไม่มีธุรกรรม',
   'Your transactions will appear here once you start lending.': 'ธุรกรรมของคุณจะแสดงที่นี่เมื่อคุณเริ่มปล่อยกู้',
   'Go to Request Board': 'ไปที่กระดานคำขอ',
   'Total Lent': 'ยอดปล่อยกู้รวม',
   higher: 'สูงกว่า',
   lower: 'ต่ำกว่า',
   'vs. previous period': 'เทียบกับช่วงก่อนหน้า',
   'Hello,': 'สวัสดี',
   there: 'คุณ',
   'View IOU point history': 'ดูประวัติแต้ม IOU',
   'Member since': 'สมาชิกตั้งแต่',

   // src/views/lender/supported/SupportedLoans.tsx
   'My Funded Loans': 'เงินกู้ที่ฉันปล่อยกู้',
   'Repayments are automatically sent to your wallet when the borrower repays.':
      'เมื่อผู้ยืมชำระคืน เงินจะถูกส่งเข้ากระเป๋าเงินของคุณโดยอัตโนมัติ',
   'You haven’t funded any loans yet. Funding links are shared directly with you.':
      'คุณยังไม่ได้ปล่อยกู้ ลิงก์สำหรับปล่อยกู้จะถูกส่งถึงคุณโดยตรง',
   'Amount paid': 'ยอดที่ชำระแล้ว',
   'Borrower owes': 'ยอดที่ผู้ยืมค้างชำระ',
   'Released to you': 'โอนถึงคุณแล้ว',
   'Held in contract': 'พักไว้ในสัญญา',
   'Repayment destination': 'ปลายทางเงินชำระคืน',
   'IOU earned': 'IOU ที่ได้รับ',
   pts: 'แต้ม',
   'Repayments are sent to your wallet automatically — when': 'เงินชำระคืนจะถูกส่งเข้ากระเป๋าเงินของคุณโดยอัตโนมัติ เมื่อ',
   'fully repays, or on the due date for whatever has been paid so far. No claim needed.':
      'ชำระคืนครบ หรือในวันครบกำหนดสำหรับยอดที่ชำระมาแล้ว โดยไม่ต้องกดรับ',

   // src/views/lenderBenefits/LenderBenefits.tsx
   'Why Lend on Moodeng | Moodeng Credit': 'ทำไมต้องปล่อยกู้กับ Moodeng | Moodeng Credit',
   'Why lend on Moodeng Credit: meet verified borrowers, see how we verify identity, and learn the incentives for funding small USDC loans.':
      'ทำไมต้องปล่อยกู้กับ Moodeng Credit: รู้จักผู้ยืมที่ยืนยันตัวตนแล้ว ดูว่าเรายืนยันตัวตนอย่างไร และเรียนรู้สิทธิประโยชน์ของการปล่อยกู้ USDC จำนวนเล็กน้อย',

   // src/views/lenderBenefits/sections/CommunityHeroSection.tsx
   'Why lend': 'ทำไมต้องปล่อยกู้',
   'Fund verified workers building credit abroad.': 'ปล่อยกู้ให้แรงงานที่ยืนยันตัวตนแล้ว ซึ่งกำลังสร้างเครดิตในต่างแดน',
   'We are starting with Filipinos and Southeast Asians overseas in places where World ID verification is available. Small loans can cover urgent gaps and help borrowers build credit independently.':
      'เราเริ่มจากชาวฟิลิปปินส์และชาวเอเชียตะวันออกเฉียงใต้ในต่างแดน ในพื้นที่ที่มีบริการยืนยันตัวตนด้วย World ID เงินกู้จำนวนเล็กน้อยช่วยอุดช่องว่างเร่งด่วน และช่วยให้ผู้ยืมสร้างเครดิตได้ด้วยตัวเอง',
   'Start with verified USDC microloans in real worker corridors.':
      'เริ่มต้นกับสินเชื่อรายย่อย USDC ที่ผ่านการยืนยันตัวตน ในเส้นทางที่แรงงานเดินทางไปทำงานจริง',
   'Community information': 'ข้อมูลชุมชน',

   // src/views/lenderBenefits/sections/FeaturesSection.tsx
   Features: 'ฟีเจอร์',
   TradFi: 'การเงินแบบดั้งเดิม',
   'Moodeng vs. TradFi lending': 'Moodeng เทียบกับการให้กู้แบบดั้งเดิม',

   // src/views/lenderBenefits/sections/HowWeVerifySection.tsx
   'World ID verification': 'การยืนยันตัวตนด้วย World ID',
   'Verified humans, clearer lending signals.': 'ยืนยันว่าเป็นคนจริง สัญญาณการปล่อยกู้ก็ชัดเจนขึ้น',
   'Borrowers verify with World ID before they can request loans. That gives lenders a real-person signal without asking borrowers to hand over private documents to Moodeng.':
      'ผู้ยืมต้องยืนยันตัวตนด้วย World ID ก่อนจึงจะขอเงินกู้ได้ ผู้ให้กู้จึงมั่นใจได้ว่าเป็นคนจริง โดยที่ผู้ยืมไม่ต้องส่งเอกสารส่วนตัวให้ Moodeng',
   'Unique person': 'หนึ่งคนจริง',
   'One account': 'หนึ่งบัญชี',
   'Less bot risk': 'ลดความเสี่ยงจากบอต',
   'Verified with': 'ยืนยันด้วย',
   'Borrowers prove uniqueness through World App and Orb availability in the markets we support first.':
      'ผู้ยืมพิสูจน์ว่าเป็นบุคคลเพียงคนเดียวผ่าน World App และ Orb ที่มีให้บริการในตลาดแรกที่เรารองรับ',

   // src/views/lenderBenefits/sections/LendingIncentivesSection.tsx
   'Lender terms': 'เงื่อนไขผู้ให้กู้',

   // src/views/lenderBenefits/sections/MeetYourFutureBorrowersSection.tsx
   'First borrower communities': 'ชุมชนผู้ยืมกลุ่มแรก',
   'Meet overseas Filipinos and Southeast Asians building credit abroad.':
      'รู้จักชาวฟิลิปปินส์และชาวเอเชียตะวันออกเฉียงใต้ที่กำลังสร้างเครดิตในต่างแดน',
   'We are starting with workers and migrants in places where World ID verification is practical, including South Korea, Taiwan, Japan, Singapore, and other Orb-supported cities.':
      'เราเริ่มจากแรงงานและผู้ย้ายถิ่นในพื้นที่ที่ยืนยันตัวตนด้วย World ID ได้สะดวก เช่น เกาหลีใต้ ไต้หวัน ญี่ปุ่น สิงคโปร์ และเมืองอื่น ๆ ที่มี Orb ให้บริการ',
   'Filipino workers': 'แรงงานฟิลิปปินส์',
   'SEA migrants': 'ผู้ย้ายถิ่นจากเอเชียตะวันออกเฉียงใต้',
   'Orb verified': 'ยืนยันด้วย Orb',
   'USDC microloans': 'สินเชื่อรายย่อย USDC',
   'Borrower community illustration': 'ภาพประกอบชุมชนผู้ยืม',

   // src/views/lenderBenefits/sections/MostNeededSection.tsx
   'First markets': 'ตลาดแรก',

   // src/views/lenderBenefits/sections/ProblemSection.tsx
   'A global dilemma': 'ปัญหาระดับโลก',
   'Help workers build credit away from home.': 'ช่วยแรงงานสร้างเครดิตแม้อยู่ไกลบ้าน',
   'Overseas borrowers often need modest emergency money while their local credit history stays trapped somewhere else. Moodeng helps repayment become a record they can keep building.':
      'ผู้ยืมในต่างแดนมักต้องการเงินฉุกเฉินจำนวนไม่มาก ขณะที่ประวัติเครดิตในประเทศของพวกเขายังติดอยู่ที่อื่น Moodeng ช่วยให้การชำระคืนกลายเป็นประวัติที่สร้างต่อยอดได้',
   'Traditional credit: starts over at zero': 'เครดิตแบบดั้งเดิม: ต้องเริ่มจากศูนย์ใหม่',
   'The problem': 'ปัญหา',
   'Good repayment rarely travels.': 'ประวัติชำระคืนที่ดีแทบไม่เคยติดตัวไปด้วย',
   'That creates a trust gap for borrowers and a missed opportunity for lenders.':
      'สิ่งนี้ทำให้ผู้ยืมขาดความน่าเชื่อถือ และผู้ให้กู้พลาดโอกาส',
   'Credit gets reset': 'เครดิตถูกรีเซ็ต',
   'A Filipino or SEA worker can repay responsibly abroad and still have no useful credit record.':
      'แรงงานฟิลิปปินส์หรือจากเอเชียตะวันออกเฉียงใต้อาจชำระคืนอย่างรับผิดชอบในต่างแดน แต่ก็ยังไม่มีประวัติเครดิตที่นำไปใช้ได้',
   'Good borrowers disappear': 'ผู้ยืมที่ดีถูกมองข้าม',
   'Lenders cannot easily see the trust signals that should matter for a small emergency loan.':
      'ผู้ให้กู้มองไม่เห็นสัญญาณความน่าเชื่อถือที่ควรใช้พิจารณาเงินกู้ฉุกเฉินจำนวนเล็กน้อยได้ง่าย ๆ',
   'Bad options fill the gap': 'ทางเลือกที่แย่เข้ามาแทนที่',
   'Quick-loan apps step in with pressure, high costs, and little long-term upside.':
      'แอปเงินกู้ด่วนเข้ามาพร้อมการกดดัน ค่าใช้จ่ายสูง และแทบไม่มีประโยชน์ในระยะยาว',
   'A group of people held together in a circular illustration': 'ภาพประกอบกลุ่มคนที่รวมตัวกันเป็นวงกลม',

   // src/views/lenderBenefits/sections/VerifyIdentitySection.tsx
   'Identity layer': 'ชั้นการยืนยันตัวตน',
   'World ID is a trust signal, not a loan guarantee.': 'World ID เป็นสัญญาณความน่าเชื่อถือ ไม่ใช่การรับประกันเงินกู้',
   'Verification makes the borrower harder to fake. The credit signal still comes from transparent terms, small USDC loans, and repayment behavior over time.':
      'การยืนยันตัวตนทำให้ปลอมเป็นผู้ยืมได้ยากขึ้น แต่สัญญาณด้านเครดิตยังมาจากเงื่อนไขที่โปร่งใส เงินกู้ USDC จำนวนเล็กน้อย และพฤติกรรมการชำระคืนในระยะยาว',
   'World ID helps confirm one real person behind each borrower account.':
      'World ID ช่วยยืนยันว่ามีคนจริงหนึ่งคนอยู่เบื้องหลังบัญชีผู้ยืมแต่ละบัญชี',
   'Moodeng can show verification status without storing passport-style documents.':
      'Moodeng แสดงสถานะการยืนยันตัวตนได้ โดยไม่ต้องจัดเก็บเอกสารอย่างหนังสือเดินทาง',
   'Lenders still evaluate loan terms, history, and repayment behavior before funding.':
      'ผู้ให้กู้ยังคงพิจารณาเงื่อนไขเงินกู้ ประวัติ และพฤติกรรมการชำระคืนก่อนปล่อยกู้',
   'World ID first': 'เริ่มจาก World ID',

   // src/views/lenderBenefits/sections/Web3WalletSection.tsx
   'Our solution': 'ทางออกของเรา',
   'Credit history that can move with a wallet.': 'ประวัติเครดิตที่ติดตัวไปกับกระเป๋าเงิน',
   'Moodeng turns small, transparent repayments into a portable credit record borrowers can keep building, even while working abroad.':
      'Moodeng เปลี่ยนการชำระคืนจำนวนเล็กน้อยที่โปร่งใสให้เป็นประวัติเครดิตที่พกพาได้ ผู้ยืมจึงสร้างต่อยอดได้เรื่อย ๆ แม้ทำงานอยู่ต่างแดน',
   'Portable wallet history': 'ประวัติที่ติดไปกับกระเป๋าเงิน',
   'Repayment activity can travel with overseas workers through their wallet.':
      'ประวัติการชำระคืนติดตัวแรงงานในต่างแดนไปได้ผ่านกระเป๋าเงินของพวกเขา',
   'Transparent loan behavior': 'พฤติกรรมการกู้ที่โปร่งใส',
   'Lenders can review onchain repayment signals instead of starting from zero.':
      'ผู้ให้กู้ดูสัญญาณการชำระคืนแบบออนเชนได้ แทนที่จะต้องเริ่มจากศูนย์',
   'Small loans, real signal': 'เงินกู้เล็ก สัญญาณจริง',
   'Microloans create a practical path for borrowers to build proof over time.':
      'สินเชื่อรายย่อยเป็นเส้นทางที่ใช้ได้จริง ให้ผู้ยืมสร้างหลักฐานความน่าเชื่อถือได้ทีละขั้น',
   'Moodeng Credit wallet illustration': 'ภาพประกอบกระเป๋าเงิน Moodeng Credit',

   // src/views/onboarding/WalletFaceCheck.tsx
   'A short liveness scan keeps Instant Wallets to one per person, which is what lets us cover the network fees. We never store your photo, and it is only needed to create the wallet — not to sign in, send or repay.':
      'การสแกนใบหน้าสั้นๆ ช่วยให้แต่ละคนมี Instant Wallet ได้เพียงหนึ่งกระเป๋า ซึ่งทำให้เราช่วยจ่ายค่าธรรมเนียมเครือข่ายให้ได้ เราไม่เก็บรูปของคุณ และต้องสแกนเฉพาะตอนสร้างกระเป๋าเท่านั้น — ไม่ต้องใช้ตอนเข้าสู่ระบบ ส่งเงิน หรือชำระคืน',
   'This is taking longer than usual. Your scan is safe — check again in a moment.':
      'ใช้เวลานานกว่าปกติ ผลการสแกนของคุณปลอดภัย — ลองตรวจสอบอีกครั้งในอีกสักครู่',
   'Instant Wallets are one per person, so we ask for a ten-second scan before creating yours. You will not need it again.':
      'แต่ละคนมี Instant Wallet ได้เพียงหนึ่งกระเป๋า เราจึงขอให้สแกนใบหน้า 10 วินาทีก่อนสร้างกระเป๋าของคุณ คุณจะไม่ต้องสแกนอีก',

   // src/views/onboarding/Welcome.tsx (the id copy block renders for id; this English title is a fallback)

   // src/views/onboarding/walletPickerOptions.tsx
   Universal: 'Universal',

   // src/views/profile/components/Calendar.tsx

   // src/views/profile/components/Card.tsx
   'Are you sure you want to delete this loan request? This action cannot be undone.':
      'คุณแน่ใจหรือไม่ว่าต้องการลบคำขอสินเชื่อนี้? การดำเนินการนี้ไม่สามารถย้อนกลับได้',

   // src/views/profile/components/navigation/MobileNav.tsx

   // src/views/profile/components/navigation/Sidebar.tsx
   Menu: 'Menu',
   Upcoming: 'ถัดไป',
   'Close rewards help': 'ปิดคำอธิบายรางวัล',
   'pts left': 'แต้มก่อนปลดล็อก',
   'Unlocks at': 'ปลดล็อกเมื่อครบ',
   'Unlocked at': 'ปลดล็อกแล้วเมื่อครบ',
   'all preview rewards': 'รางวัลตัวอย่างทั้งหมด',
   '· You won this': '· คุณได้รับรางวัลนี้',
   'Start setup': 'เริ่มตั้งค่า',
   'Add a wallet': 'เพิ่มกระเป๋าเงิน',
   'Finish setup with identity verification and your wallet (an Instant Wallet, or a Base Account if you prefer) to unlock borrowing and start building your public trust record.':
      'ตั้งค่าให้เสร็จด้วยการยืนยันตัวตนและกระเป๋าเงินของคุณ (Instant Wallet หรือ Base Account หากคุณต้องการ) เพื่อปลดล็อกการยืมและเริ่มสร้างประวัติความน่าเชื่อถือแบบสาธารณะ',
   'Set up your Instant Wallet (or connect a Base Account) to unlock borrowing and start building your public trust record.':
      'ตั้งค่า Instant Wallet ของคุณ (หรือเชื่อมต่อ Base Account) เพื่อปลดล็อกการยืมและเริ่มสร้างประวัติความน่าเชื่อถือแบบสาธารณะ',
   'Verify your identity to unlock borrowing and start building your public trust record.':
      'ยืนยันตัวตนเพื่อปลดล็อกการยืมและเริ่มสร้างประวัติความน่าเชื่อถือแบบสาธารณะ',
   'Your reputation milestones will appear here as you repay loans on time.':
      'หมุดหมายความน่าเชื่อถือของคุณจะแสดงที่นี่เมื่อคุณชำระคืนเงินกู้ตรงเวลา',

   // src/views/onboarding/Congratulations.tsx
   'Moodeng celebrating': 'Moodeng กำลังฉลอง',
   'Moodeng community hippo': 'ฮิปโปชุมชน Moodeng',

   // src/views/onboarding/ConnectWallet.tsx
   'Create your Instant Wallet': 'สร้าง Instant Wallet ของคุณ',
   'Your loan lands here — created from your Moodeng login, no app needed. Earn Pandesal points too.':
      'เงินกู้ของคุณจะเข้ามาที่นี่ สร้างจากบัญชีที่ใช้เข้าสู่ระบบ Moodeng โดยไม่ต้องติดตั้งแอป และยังได้รับแต้ม Pandesal ด้วย',
   'Setting up your wallet — this takes a few seconds. Keep this screen open.':
      'กำลังตั้งค่ากระเป๋าเงินของคุณ ใช้เวลาเพียงไม่กี่วินาที โปรดเปิดหน้านี้ค้างไว้',
   'Connect Your Base Wallet': 'เชื่อมต่อกระเป๋า Base ของคุณ',
   'Connect Your Wallet': 'เชื่อมต่อกระเป๋าเงินของคุณ',
   'Think of this as your digital checking account.': 'เปรียบเสมือนบัญชีเงินฝากกระแสรายวันแบบดิจิทัลของคุณ',
   'Instant Wallet': 'Instant Wallet',
   'No app needed': 'ไม่ต้องใช้แอป',
   'Created from your Moodeng login in seconds. Fully yours — export the key anytime.':
      'สร้างจากบัญชีที่ใช้เข้าสู่ระบบ Moodeng ได้ในไม่กี่วินาที เป็นของคุณเต็มที่ และส่งออกคีย์ได้ทุกเมื่อ',
   'All wallets support gasless transactions on Base network': 'กระเป๋าเงินทุกแบบรองรับธุรกรรมแบบไม่เสียค่า gas บนเครือข่าย Base',
   'Create Your Instant Wallet': 'สร้าง Instant Wallet ของคุณ',
   'Moodeng wallet': 'กระเป๋าเงิน Moodeng',
   'Add Base Wallet': 'เพิ่มกระเป๋า Base',
   'Connecting your wallet lets Moodeng read your on-chain activity to award Pandesal points and send USDC loans directly to you. We never ask for your private keys or seed phrase.':
      'การเชื่อมต่อกระเป๋าเงินช่วยให้ Moodeng อ่านกิจกรรมออนเชนของคุณเพื่อมอบแต้ม Pandesal และส่งเงินกู้ USDC ถึงคุณโดยตรง เราไม่เคยขอคีย์ส่วนตัวหรือวลีกู้คืน (seed phrase) ของคุณ',
   'Wallet unavailable': 'ใช้กระเป๋าเงินนี้ไม่ได้',
   'is not available right now.': 'ไม่พร้อมใช้งานในขณะนี้',
   'Connection failed': 'เชื่อมต่อไม่สำเร็จ',
   'Could not connect wallet. Please try again.': 'เชื่อมต่อกระเป๋าเงินไม่สำเร็จ โปรดลองอีกครั้ง',
   'Prefer a Base Account? Connect it instead': 'อยากใช้ Base Account? เชื่อมต่อแทนได้',
   'Creating your wallet…': 'กำลังสร้างกระเป๋าเงิน…',
   'Create Instant Wallet': 'สร้าง Instant Wallet',
   'Connect Base Wallet': 'เชื่อมต่อกระเป๋า Base',
   'Select a wallet above': 'เลือกกระเป๋าเงินด้านบน',
   'or connect a Base Account or another wallet': 'หรือเชื่อมต่อ Base Account หรือกระเป๋าเงินอื่น',
   'Trust, Rainbow, Argent & more supported wallets': 'Trust, Rainbow, Argent และกระเป๋าเงินอื่น ๆ ที่รองรับ',

   // src/views/onboarding/WalletAlreadyLinked.tsx
   'This wallet is already in use': 'กระเป๋าเงินนี้ถูกใช้งานอยู่แล้ว',
   'This wallet is already linked to another Moodeng account. To keep lending fair and prevent self-lending, each wallet can belong to only one account.':
      'กระเป๋าเงินนี้ผูกกับบัญชี Moodeng อื่นอยู่แล้ว เพื่อให้การปล่อยกู้เป็นธรรมและป้องกันการปล่อยกู้ให้ตัวเอง กระเป๋าเงินแต่ละใบจึงผูกได้กับบัญชีเดียวเท่านั้น',
   'What you can do': 'สิ่งที่คุณทำได้',
   'Connect a different wallet address to this lender account.': 'เชื่อมต่อที่อยู่กระเป๋าเงินอื่นกับบัญชีผู้ให้กู้นี้',
   'If you created a borrower account by mistake, remove this wallet from it first — or ask us to delete that account or switch its role.':
      'หากคุณสร้างบัญชีผู้ยืมโดยไม่ตั้งใจ ให้นำกระเป๋าเงินนี้ออกจากบัญชีนั้นก่อน หรือแจ้งให้เราลบบัญชีนั้นหรือเปลี่ยนบทบาทให้',
   "Not sure what happened? Message us and we'll help.": 'ไม่แน่ใจว่าเกิดอะไรขึ้น? ส่งข้อความหาเรา แล้วเราจะช่วยคุณ',
   'Wallet In Use': 'กระเป๋าเงินถูกใช้งานแล้ว',

   // src/views/onboarding/WalletConnectHelp.tsx
   'Trouble connecting?': 'เชื่อมต่อไม่ได้ใช่ไหม?',
   'Use the popup that opens when you tap Connect.': 'ใช้หน้าต่างป๊อปอัปที่เปิดขึ้นเมื่อคุณแตะ "เชื่อมต่อ"',
   "You don't need to download a separate Base app from the app store — creating an account there won't connect here.":
      'คุณไม่ต้องดาวน์โหลดแอป Base แยกจาก App Store เพราะบัญชีที่สร้างในแอปนั้นจะไม่เชื่อมต่อกับที่นี่',
   'Seeing a “connection is not private” warning?': 'เห็นคำเตือนว่า “การเชื่อมต่อไม่เป็นส่วนตัว” ใช่ไหม?',
   "Your phone's clock is probably off. In Settings, set date & time to automatic, then tap Connect again.":
      'นาฬิกาในโทรศัพท์ของคุณอาจไม่ตรง ให้ไปที่การตั้งค่า ตั้งวันที่และเวลาเป็นอัตโนมัติ แล้วแตะ "เชื่อมต่อ" อีกครั้ง',
   'Still stuck?': 'ยังติดปัญหาอยู่ใช่ไหม?',
   'Switch between Wi‑Fi and mobile data, make sure your browser is up to date, and reconnect.':
      'ลองสลับระหว่าง Wi‑Fi กับอินเทอร์เน็ตมือถือ ตรวจสอบว่าเบราว์เซอร์เป็นเวอร์ชันล่าสุด แล้วเชื่อมต่อใหม่',

   // src/views/onboarding/WalletConnected.tsx
   'Use Your Instant Wallet or a Base Account': 'ใช้ Instant Wallet หรือ Base Account ของคุณ',
   'Borrowers use the Moodeng Instant Wallet, created from your login — or you can connect a Base Account instead. Other wallet connectors cannot be locked for Moodeng borrowing.':
      'ผู้ยืมใช้ Instant Wallet ของ Moodeng ซึ่งสร้างจากบัญชีที่คุณใช้เข้าสู่ระบบ หรือจะเชื่อมต่อ Base Account แทนก็ได้ กระเป๋าเงินแบบอื่นไม่สามารถล็อกไว้ใช้สำหรับการยืมกับ Moodeng ได้',
   'Confirm Saved Base Account': 'ยืนยัน Base Account ที่บันทึกไว้',
   'Confirm Your Base Account': 'ยืนยัน Base Account ของคุณ',
   "We couldn't detect a wallet. Set up your Instant Wallet (or connect a Base Account if you prefer) to continue.":
      'เราตรวจไม่พบกระเป๋าเงิน โปรดตั้งค่า Instant Wallet ของคุณ (หรือเชื่อมต่อ Base Account หากต้องการ) เพื่อดำเนินการต่อ',
   'Your Instant Wallet Is Ready': 'Instant Wallet ของคุณพร้อมแล้ว',
   'Wallet Connected': 'เชื่อมต่อกระเป๋าเงินแล้ว',
   'Loans you receive land right in the app — no other app needed. It also earns you Pandesal points.':
      'เงินกู้ที่คุณได้รับจะเข้ามาในแอปโดยตรง ไม่ต้องใช้แอปอื่น และยังช่วยให้คุณได้รับแต้ม Pandesal ด้วย',
   'Continue Application': 'ดำเนินการสมัครต่อ',
   Next: 'ถัดไป',

   // src/views/onboarding/WalletFaceCheck.tsx
   'Try the scan again': 'สแกนอีกครั้ง',
   'Connect a wallet instead': 'เชื่อมต่อกระเป๋าเงินแทน',
   'Still checking': 'ยังตรวจสอบอยู่',
   'This is taking longer than usual. Your scan is safe — check again in a moment.':
      'ขั้นตอนนี้ใช้เวลานานกว่าปกติ ผลการสแกนของคุณยังปลอดภัยอยู่ โปรดตรวจสอบอีกครั้งในอีกสักครู่',
   'Start a new scan': 'เริ่มสแกนใหม่',
   'One quick face check': 'สแกนใบหน้าสั้น ๆ หนึ่งครั้ง',
   'Instant Wallets are one per person, so we ask for a ten-second scan before creating yours. You will not need it again.':
      'Instant Wallet จำกัดหนึ่งใบต่อหนึ่งคน เราจึงขอให้สแกนใบหน้า 10 วินาทีก่อนสร้างกระเป๋าเงินของคุณ และไม่ต้องสแกนอีก',
   'Connect a wallet I already own': 'เชื่อมต่อกระเป๋าเงินที่ฉันมีอยู่แล้ว',
   'Could not start the face check. Please try again.': 'เริ่มการสแกนใบหน้าไม่สำเร็จ โปรดลองอีกครั้ง',
   'Quick face check': 'สแกนใบหน้าสั้น ๆ',
   'A short liveness scan keeps Instant Wallets to one per person, which is what lets us cover the network fees. We never store your photo, and it is only needed to create the wallet — not to sign in, send or repay.':
      'การสแกนตรวจสอบบุคคลจริงสั้น ๆ ช่วยจำกัด Instant Wallet ให้มีหนึ่งใบต่อหนึ่งคน ซึ่งทำให้เราออกค่าธรรมเนียมเครือข่ายให้ได้ เราไม่จัดเก็บรูปภาพของคุณ และใช้เพียงตอนสร้างกระเป๋าเงินเท่านั้น ไม่ต้องใช้ตอนเข้าสู่ระบบ ส่งเงิน หรือชำระคืน',
   "We couldn't finish creating your wallet. Please try again.": 'เราสร้างกระเป๋าเงินของคุณไม่สำเร็จ โปรดลองอีกครั้ง',
   'Creating your wallet': 'กำลังสร้างกระเป๋าเงินของคุณ',
   'This takes a few seconds. Keep this screen open.': 'ใช้เวลาเพียงไม่กี่วินาที โปรดเปิดหน้านี้ค้างไว้',
   'Starting…': 'กำลังเริ่ม…',
   'Start face check': 'เริ่มสแกนใบหน้า',

   // src/views/onboarding/walletPickerOptions.tsx
   'Top Pick': 'แนะนำ',
   Popular: 'ยอดนิยม',
   'Zero fees': 'ไม่มีค่าธรรมเนียม',
   'Best for beginners': 'เหมาะสำหรับมือใหม่',
   'Sleek UI': 'หน้าตาใช้งานง่าย',
   'Simple & secure': 'ง่ายและปลอดภัย',
   Universal: 'ใช้ได้ทั่วไป',
   'Widely Used': 'มีผู้ใช้มาก',

   // src/views/profile/components/Calendar.tsx
   'Loan Insights': 'ข้อมูลเชิงลึกเงินกู้',

   // src/views/profile/components/Card.tsx
   'You Funded': 'คุณปล่อยกู้',
   'Due on': 'ครบกำหนดวันที่',
   'Repayment Progress': 'ความคืบหน้าการชำระคืน',
   'Borrow Insight': 'ข้อมูลผู้ยืม',
   Asking: 'ยอดที่ขอ',
   'Delete Loan Request?': 'ลบคำขอเงินกู้ใช่ไหม?',
   'Are you sure you want to delete this loan request? This action cannot be undone.':
      'คุณแน่ใจหรือไม่ว่าต้องการลบคำขอเงินกู้นี้? การดำเนินการนี้ย้อนกลับไม่ได้',
   Lent: 'ปล่อยกู้แล้ว',
   to: 'ให้',
   'Fully Repaid': 'ชำระคืนครบแล้ว',
   'Days Left': 'วันก่อนครบกำหนด',
   'Day Left': 'วันก่อนครบกำหนด',
   'Hours Left': 'ชั่วโมงก่อนครบกำหนด',
   'Hour Left': 'ชั่วโมงก่อนครบกำหนด',
   'Remaining for Complete Payback': 'ที่เหลือจนกว่าจะชำระคืนครบ',
   'posted on': 'โพสต์เมื่อ',
   'Waiting for Funding': 'รอการปล่อยกู้',
   'Partially Repaid': 'ชำระคืนแล้วบางส่วน',
   'Due in': 'ครบกำหนดใน',
   'Delete Request': 'ลบคำขอ',

   // src/views/profile/components/navigation/MobileNav.tsx
   'Toggle menu': 'เปิดหรือปิดเมนู',

   // src/views/profile/components/navigation/Sidebar.tsx
   'View more': 'ดูเพิ่มเติม',
   Menu: 'เมนู',

   // src/views/profile/components/settings/NotificationSettings.tsx
   'Push notifications on this device': 'การแจ้งเตือนแบบพุชบนอุปกรณ์นี้',
   'Get a notification the moment a repayment is due, or when a borrower who already repaid you asks again. Applies to this device only.':
      'รับการแจ้งเตือนทันทีเมื่อถึงกำหนดชำระคืน หรือเมื่อผู้ยืมที่เคยชำระคืนให้คุณแล้วส่งคำขอใหม่ ใช้กับอุปกรณ์นี้เท่านั้น',
   Notification: 'การแจ้งเตือน',
   'Transaction Activity': 'กิจกรรมธุรกรรม',
   'Get important notifications about your transactions': 'รับการแจ้งเตือนสำคัญเกี่ยวกับธุรกรรมของคุณ',
   'Turn off': 'ปิด',
   'Working…': 'กำลังดำเนินการ…',
   'Notifications are blocked in your browser settings. Allow them there, then come back.':
      'การแจ้งเตือนถูกบล็อกในการตั้งค่าเบราว์เซอร์ของคุณ โปรดอนุญาตในการตั้งค่านั้น แล้วกลับมาที่นี่',
   'This browser cannot show push notifications. Try Chrome, or add Moodeng to your home screen.':
      'เบราว์เซอร์นี้แสดงการแจ้งเตือนแบบพุชไม่ได้ ลองใช้ Chrome หรือเพิ่ม Moodeng ไว้ที่หน้าจอหลัก',
   "Get important notifications about you or activity you've missed": 'รับการแจ้งเตือนสำคัญเกี่ยวกับคุณหรือกิจกรรมที่คุณพลาดไป',

   // src/views/profile/components/settings/ProfileSettings.tsx
   'Having an up-to-date email address attached to your account is a great step towards improving account security.':
      'การผูกอีเมลที่เป็นปัจจุบันไว้กับบัญชีเป็นก้าวสำคัญในการเพิ่มความปลอดภัยของบัญชี',
   'You can also opt to receive notifications via Telegram or WhatsApp to stay informed of any account changes.':
      'คุณยังเลือกรับการแจ้งเตือนผ่าน Telegram หรือ WhatsApp เพื่อติดตามการเปลี่ยนแปลงของบัญชีได้',
   'Test Email': 'อีเมลทดสอบ',
   'Send a test email to verify your email configuration': 'ส่งอีเมลทดสอบเพื่อตรวจสอบการตั้งค่าอีเมลของคุณ',
   'Connect your telegram to get the latest updates': 'เชื่อมต่อ Telegram เพื่อรับข่าวสารล่าสุด',
   'Connect your WhatsApp to get the latest updates': 'เชื่อมต่อ WhatsApp เพื่อรับข่าวสารล่าสุด',
   Username: 'ชื่อผู้ใช้',
   'Change Username': 'เปลี่ยนชื่อผู้ใช้',
   'Change Email': 'เปลี่ยนอีเมล',
   'Development mode only: Send a test email to': 'เฉพาะโหมดพัฒนา: ส่งอีเมลทดสอบไปที่',
   'Send Test Email': 'ส่งอีเมลทดสอบ',

   // src/views/profile/components/settings/SecuritySettings.tsx
   'This information will be shown publicly so be careful what information you provide':
      'ข้อมูลนี้จะแสดงต่อสาธารณะ โปรดระมัดระวังข้อมูลที่คุณให้',
   'Wrong network': 'เครือข่ายไม่ถูกต้อง',
   Disconnect: 'ยกเลิกการเชื่อมต่อ',
   'New Password': 'รหัสผ่านใหม่',

   // src/views/profile/components/shared/LoadMoreButton.tsx
   'Load More...': 'โหลดเพิ่มเติม...',

   // src/views/profile/components/shared/TelegramModal.tsx
   'Connect Telegram.': 'เชื่อมต่อ Telegram',

   // src/views/profile/components/tabs/CreditLevelCard.tsx
   'Max Credit': 'วงเงินสูงสุด',
   'Unlocked!': 'ปลดล็อกแล้ว!',
   'Request Loan': 'ขอเงินกู้',
   'Progression Paused (Late Repayment)': 'หยุดเลื่อนระดับชั่วคราว (ชำระคืนล่าช้า)',
   'Unlocked on': 'ปลดล็อกเมื่อ',
   'Max Credit Unlocked!': 'ปลดล็อกวงเงินสูงสุดแล้ว!',
   'Credit Unlocked on': 'ปลดล็อกวงเงินเมื่อ',
   'Credit Unlocked': 'ปลดล็อกวงเงินแล้ว',
   LOCKED: 'ล็อกอยู่',

   // src/views/profile/components/tabs/DashboardTab.tsx
   'PAY LOANS NOW': 'ชำระเงินกู้เลย',
   Points: 'แต้ม',

   // src/views/profile/components/tabs/SettingsTab.tsx
   'Revert Changes': 'ยกเลิกการเปลี่ยนแปลง',
   'Save Changes': 'บันทึกการเปลี่ยนแปลง',

   // src/views/profile/components/tabs/SupportTab.tsx
   'Support content coming soon...': 'เนื้อหาช่วยเหลือจะมาเร็ว ๆ นี้...',

   // src/views/repay/Repay.tsx
   'Taking you to pay now…': 'กำลังพาคุณไปชำระเงิน…',
   Free: 'ฟรี',
   'Small fee': 'ค่าธรรมเนียมเล็กน้อย',
   'Loan repaid': 'ชำระคืนเงินกู้แล้ว',
   'Paid in full': 'ชำระครบเต็มจำนวน',
   'New borrowing limit': 'วงเงินกู้ใหม่',
   Loan: 'เงินกู้',
   'View repayment history': 'ดูประวัติการชำระคืน',
   'Choose a loan and enter an amount.': 'เลือกเงินกู้และกรอกจำนวนเงิน',
   'Watch how to repay': 'ดูวิธีชำระคืน',
   'Pick a loan': 'เลือกเงินกู้',
   Remaining: 'คงเหลือ',
   'Not yet paid': 'ยังไม่ได้ชำระ',
   'Add funds to repay': 'เติมเงินเพื่อชำระคืน',
   'You have': 'คุณมี',
   'Choose your source': 'เลือกช่องทางของคุณ',
   'Loading your options…': 'กำลังโหลดตัวเลือก…',
   'Copy your wallet address': 'คัดลอกที่อยู่กระเป๋าเงินของคุณ',
   "This is the same wallet your loan was sent to. Copy it — you'll share it with Moneybees so they send your USDC here.":
      'นี่คือกระเป๋าเงินเดียวกับที่ใช้รับเงินกู้ของคุณ คัดลอกไว้เพื่อแจ้ง Moneybees ให้ส่ง USDC ของคุณมาที่นี่',
   'Copied!': 'คัดลอกแล้ว!',
   Select: 'เลือก',
   'Look for': 'มองหา',
   'Moodeng fee': 'ค่าธรรมเนียม Moodeng',
   'Checking your balance…': 'กำลังตรวจสอบยอดเงินของคุณ…',
   'Funds ready': 'เงินพร้อมแล้ว',
   'Watching for your transfer': 'กำลังรอรับยอดโอนของคุณ',
   'Detects automatically — usually under a minute': 'ตรวจพบโดยอัตโนมัติ ปกติใช้เวลาไม่ถึงหนึ่งนาที',
   "You're paying": 'คุณกำลังชำระ',
   'Clears this loan ✓': 'ปิดเงินกู้นี้ได้ ✓',
   'Verify yourself and set up your wallet (an Instant Wallet, or a Base Account if you prefer) before requesting loans. Repayments will show here after a lender funds your first loan.':
      'ยืนยันตัวตนและตั้งค่ากระเป๋าเงินของคุณ (Instant Wallet หรือ Base Account หากคุณต้องการ) ก่อนขอเงินกู้ การชำระคืนจะแสดงที่นี่หลังจากผู้ให้กู้ปล่อยกู้ครั้งแรกให้คุณ',
   'Finish setup to start borrowing': 'ตั้งค่าให้เสร็จเพื่อเริ่มยืม',
   'Your wallet is added. Complete verification before requesting loans. Repayments will show here after funding.':
      'เพิ่มกระเป๋าเงินแล้ว โปรดยืนยันตัวตนให้เสร็จก่อนขอเงินกู้ การชำระคืนจะแสดงที่นี่หลังได้รับการปล่อยกู้',
   'Verify yourself to borrow': 'ยืนยันตัวตนเพื่อยืม',
   'You are verified. Set up your Instant Wallet (or connect a Base Account) so loans and repayments can stay tied to your Moodeng account.':
      'คุณยืนยันตัวตนแล้ว โปรดตั้งค่า Instant Wallet (หรือเชื่อมต่อ Base Account) เพื่อให้เงินกู้และการชำระคืนผูกอยู่กับบัญชี Moodeng ของคุณ',
   'Add a wallet to borrow': 'เพิ่มกระเป๋าเงินเพื่อยืม',
   'Your repayment activity will appear here once a lender funds your first loan.':
      'กิจกรรมการชำระคืนของคุณจะแสดงที่นี่เมื่อผู้ให้กู้ปล่อยกู้ครั้งแรกให้คุณ',
   'No repayments yet': 'ยังไม่มีการชำระคืน',
   'How to withdraw USDC from PDAX to your wallet': 'วิธีถอน USDC จาก PDAX เข้ากระเป๋าเงินของคุณ',
   'Repay amount': 'จำนวนเงินที่ชำระคืน',
   'Adjust repay amount': 'ปรับจำนวนเงินที่ชำระคืน',
   'How to repay': 'วิธีชำระคืน',
   'Close video': 'ปิดวิดีโอ',
   'How to repay a Moodeng loan': 'วิธีชำระคืนเงินกู้ Moodeng',
   'Open Coins.ph': 'เปิด Coins.ph',
   'Visit Moneybees': 'ไปที่ Moneybees',
   'Open GCrypto': 'เปิด GCrypto',
   'Open PDAX': 'เปิด PDAX',
   'Open Binance': 'เปิด Binance',
   'Recommended · lowest fees · buy USDC with PHP, cash out to bank or GCash':
      'แนะนำ · ค่าธรรมเนียมต่ำสุด · ซื้อ USDC ด้วยเงินเปโซ ถอนเข้าบัญชีธนาคารหรือ GCash ได้',
   "External option · you follow Moneybees' own process": 'ตัวเลือกภายนอก · ทำตามขั้นตอนของ Moneybees เอง',
   'Visit moneybees.ph → follow their own process → share your wallet address → pay only after they confirm':
      'ไปที่ moneybees.ph → ทำตามขั้นตอนของพวกเขา → แชร์ที่อยู่กระเป๋าเงินของคุณ → ชำระเงินหลังจากพวกเขายืนยันแล้วเท่านั้น',
   'Transfer → Send Crypto → USDC → External Wallet → paste address → Base network → confirm':
      'Transfer → Send Crypto → USDC → External Wallet → วางที่อยู่ → เครือข่าย Base → ยืนยัน',
   'Wallet → USDCBASE → Withdraw → Paste wallet address': 'Wallet → USDCBASE → Withdraw → วางที่อยู่กระเป๋าเงิน',
   'Wallet → Withdraw → USDC → Network: Base → Paste wallet address': 'Wallet → Withdraw → USDC → Network: Base → วางที่อยู่กระเป๋าเงิน',
   'Medical appointment': 'นัดพบแพทย์',
   'Vaccination bills': 'ค่าฉีดวัคซีน',
   'Received $': 'ได้รับ $',
   'Enter an amount greater than 0.': 'กรอกจำนวนเงินที่มากกว่า 0',
   'Start Setup': 'เริ่มตั้งค่า',
   'Add Wallet': 'เพิ่มกระเป๋าเงิน',
   'Copy failed': 'คัดลอกไม่สำเร็จ',
   'Could not copy your wallet address. Copy it manually.': 'คัดลอกที่อยู่กระเป๋าเงินไม่สำเร็จ โปรดคัดลอกด้วยตนเอง',
   'Still confirming': 'ยังยืนยันอยู่',
   'Your payment was sent and is taking a moment to confirm. This will update automatically.':
      'ส่งการชำระเงินของคุณแล้ว และกำลังรอการยืนยันสักครู่ หน้านี้จะอัปเดตโดยอัตโนมัติ',
   'Payment Sent, Still Recording': 'ส่งเงินแล้ว กำลังบันทึก',
   'Your payment went through but we could not record it yet. We will keep retrying automatically — contact support if it does not update.':
      'การชำระเงินของคุณสำเร็จแล้ว แต่เรายังบันทึกไม่ได้ ระบบจะลองใหม่โดยอัตโนมัติ หากยังไม่อัปเดต โปรดติดต่อฝ่ายช่วยเหลือ',
   Connecting: 'กำลังเชื่อมต่อ',
   'Pandesal points +': 'แต้ม Pandesal +',
   unlocked: 'ปลดล็อกแล้ว',
   limit: 'วงเงิน',
   'Hide repayment details': 'ซ่อนรายละเอียดการชำระคืน',
   'Show repayment details': 'แสดงรายละเอียดการชำระคืน',
   'Repay next loan': 'ชำระคืนเงินกู้ถัดไป',
   'Active loan': 'เงินกู้ที่กำลังดำเนินอยู่',
   '% paid': '% ชำระแล้ว',
   '— still need': '— ยังขาดอีก',
   more: 'จึงจะครบ',
   'You need': 'คุณยังต้องมีอีก',
   'more USDC': 'USDC',
   'to repay.': 'จึงจะชำระคืนได้',
   "Pick where you'll buy or withdraw USDC.": 'เลือกแหล่งที่คุณจะซื้อหรือถอน USDC',
   'works well for most people': 'เหมาะกับคนส่วนใหญ่',
   "— and works the same whether you're in the Philippines or traveling.":
      '— และใช้งานได้เหมือนกันไม่ว่าคุณจะอยู่ในฟิลิปปินส์หรือกำลังเดินทาง',
   'is also available under "Other options".': 'ก็มีให้เลือกใน "ตัวเลือกอื่น"',
   'Fewer options': 'ตัวเลือกน้อยลง',
   'Other options': 'ตัวเลือกอื่น',
   'You can repay from a wallet, an exchange, a P2P platform, or a local crypto service — whatever is available in your country.':
      'คุณชำระคืนได้จากกระเป๋าเงิน แพลตฟอร์มแลกเปลี่ยนคริปโต แพลตฟอร์ม P2P หรือบริการคริปโตในประเทศ แล้วแต่ว่าในประเทศของคุณมีช่องทางใด',
   "This is the same wallet your loan was sent to. Copy it — you'll paste it into":
      'นี่คือกระเป๋าเงินเดียวกับที่ใช้รับเงินกู้ของคุณ คัดลอกไว้แล้วนำไปวางใน',
   'as the destination.': 'เป็นปลายทาง',
   'Tap to copy your wallet address': 'แตะเพื่อคัดลอกที่อยู่กระเป๋าเงินของคุณ',
   'Now open Moneybees below →': 'จากนั้นเปิด Moneybees ด้านล่าง →',
   'Now paste it into the app below →': 'จากนั้นวางในแอปด้านล่าง →',
   '⚠️ Send on the BASE network only': '⚠️ ส่งบนเครือข่าย BASE เท่านั้น',
   'USDC sent on Ethereum, Polygon, or any other network goes to this address on the wrong chain and is lost forever — it cannot be recovered. When':
      'USDC ที่ส่งบน Ethereum Polygon หรือเครือข่ายอื่นจะไปถึงที่อยู่นี้บนเชนที่ผิด และสูญหายถาวรโดยกู้คืนไม่ได้ เมื่อ',
   'asks which network, choose': 'ถามว่าจะใช้เครือข่ายใด ให้เลือก',
   'Visit moneybees.ph and follow their own process': 'ไปที่ moneybees.ph และทำตามขั้นตอนของพวกเขา',
   'They handle ID checks and the rate directly with you': 'Moneybees จะตรวจสอบตัวตนและตกลงอัตราแลกเปลี่ยนกับคุณโดยตรง',
   'Share your address —': 'แชร์ที่อยู่ของคุณ —',
   'copy it here': 'คัดลอกที่นี่',
   '· pay only after they confirm': '· ชำระเงินหลังจากพวกเขายืนยันแล้วเท่านั้น',
   'Moneybees is an external service — you transact with them directly; Moodeng isn’t part of the transaction.':
      'Moneybees เป็นบริการภายนอก คุณทำธุรกรรมกับพวกเขาโดยตรง และ Moodeng ไม่ได้เป็นส่วนหนึ่งของธุรกรรมนี้',
   In: 'ใน',
   'network — not Ethereum or Polygon': 'เป็นเครือข่าย — ไม่ใช่ Ethereum หรือ Polygon',
   '— not USDC or other tokens': '— ไม่ใช่ USDC หรือโทเคนอื่น',
   "'s fee": ': ค่าธรรมเนียม',
   'Free ✓': 'ฟรี ✓',
   'Send a little extra to cover': 'โปรดส่งเพิ่มเล็กน้อยเพื่อครอบคลุมค่าธรรมเนียมของ',
   "'s fee — Moodeng never charges to repay.": '— Moodeng ไม่เคยเก็บค่าธรรมเนียมในการชำระคืน',
   'USDC received': 'USDC ได้รับแล้ว',
   needed: 'ที่ต้องใช้',
   Tap: 'แตะ',
   'Pay $': 'ชำระ $',
   'below to pay now, or keep waiting for the rest to arrive.': 'ด้านล่างเพื่อชำระตอนนี้ หรือรอให้ยอดที่เหลือเข้ามาก่อน',
   'Confirming on Base…': 'กำลังยืนยันบน Base…',
   'Sending payment…': 'กำลังส่งการชำระเงิน…',
   'Recording your repayment — hang tight.': 'กำลังบันทึกการชำระคืนของคุณ โปรดรอสักครู่',
   'Sending from your Instant Wallet — no confirmation needed.': 'กำลังส่งจาก Instant Wallet ของคุณ ไม่ต้องยืนยันเพิ่มเติม',
   'Approve the transaction in your wallet.': 'อนุมัติธุรกรรมในกระเป๋าเงินของคุณ',
   'Paid $': 'ชำระแล้ว $',
   'to go.': 'คงเหลือ',
   'Paying less than the full $': 'การชำระน้อยกว่ายอดเต็ม $',
   'reduces what you owe, but your account stays restricted until this loan is fully repaid.':
      'จะช่วยลดยอดที่คุณค้างชำระ แต่บัญชีของคุณจะยังถูกจำกัดจนกว่าจะชำระคืนเงินกู้นี้ครบ',
   'of $': 'จาก $',
   remaining: 'ที่ยังค้างอยู่',
   leaves: 'จะเหลือ',
   'Past due': 'เกินกำหนด',

   // src/views/signin/SignInPage.tsx
   'Welcome back to Moodeng': 'ยินดีต้อนรับกลับสู่ Moodeng',
   'Sign in to access your account.': 'เข้าสู่ระบบเพื่อเข้าใช้บัญชีของคุณ',
   'Remember Me': 'จดจำฉันไว้',
   'Sign In to Moodeng': 'เข้าสู่ระบบ Moodeng',
   'Take a tour first': 'ดูทัวร์ก่อน',
   'Authentication failed': 'ยืนยันตัวตนเพื่อเข้าสู่ระบบไม่สำเร็จ',
   'Email Address': 'ที่อยู่อีเมล',
   'Enter your email address': 'กรอกที่อยู่อีเมลของคุณ',
   'Enter your password': 'กรอกรหัสผ่านของคุณ',
   'This account has been closed. If you think this is a mistake, contact support on Telegram.':
      'บัญชีนี้ถูกปิดแล้ว หากคุณคิดว่าเกิดข้อผิดพลาด โปรดติดต่อฝ่ายช่วยเหลือทาง Telegram',
   OR: 'หรือ',
   'Too many attempts detected': 'พยายามเข้าสู่ระบบหลายครั้งเกินไป',
   'New account needed': 'ต้องสร้างบัญชีใหม่',
   'Email not found': 'ไม่พบอีเมลนี้',
   'Incorrect credentials': 'อีเมลหรือรหัสผ่านไม่ถูกต้อง',
   "Don't have an account?": 'ยังไม่มีบัญชีใช่ไหม?',

   // src/views/signup/SignUpPage.tsx
   'Welcome to Moodeng Credit': 'ยินดีต้อนรับสู่ Moodeng Credit',
   'It takes just a few minutes to get started.': 'ใช้เวลาเพียงไม่กี่นาทีก็เริ่มต้นได้',
   'Sign Up with Email': 'สมัครสมาชิกด้วยอีเมล',
   'Choose a username': 'ตั้งชื่อผู้ใช้',
   'Account already exists': 'มีบัญชีนี้อยู่แล้ว',
   'Logging you in…': 'กำลังเข้าสู่ระบบให้คุณ…',
   'Could not reach the server. Check your connection and try again.': 'เชื่อมต่อเซิร์ฟเวอร์ไม่ได้ โปรดตรวจสอบการเชื่อมต่อแล้วลองอีกครั้ง',
   'Already have an account?': 'มีบัญชีอยู่แล้วใช่ไหม?',
   'Already linked': 'เชื่อมโยงแล้ว',
   'Already registered': 'ลงทะเบียนแล้ว',
   'Email address taken': 'อีเมลนี้ถูกใช้แล้ว',
   'Password too weak': 'รหัสผ่านคาดเดาง่ายเกินไป',

   // src/views/support/FAQ.tsx
   'Frequently Asked Questions | Moodeng Credit': 'คำถามที่พบบ่อย | Moodeng Credit',
   'Frequently Asked Questions': 'คำถามที่พบบ่อย',
   'Answers about how Moodeng Credit works — borrowing in USDC, Pandesal points, Credit Levels, the Instant Wallet (and Base Accounts), fees, and staying safe from loan sharks.':
      'คำตอบเกี่ยวกับวิธีการทำงานของ Moodeng Credit ทั้งการยืมเป็น USDC แต้ม Pandesal ระดับเครดิต Instant Wallet (และ Base Account) ค่าธรรมเนียม และการป้องกันตัวจากเงินกู้นอกระบบ',
   General: 'ทั่วไป',
   Borrowing: 'การยืม',
   All: 'ทั้งหมด',
   'Search FAQs': 'ค้นหาคำถามที่พบบ่อย',
   'No questions match your search.': 'ไม่พบคำถามที่ตรงกับการค้นหาของคุณ',
   'FAQ categories': 'หมวดหมู่คำถามที่พบบ่อย',

   // src/views/support/GettingStarted.tsx
   'See how Moodeng works': 'ดูว่า Moodeng ทำงานอย่างไร',
   'Take the interactive tour': 'ลองทัวร์แบบอินเทอร์แอกทีฟ',
   'A 2-minute walkthrough: choose a role, verify, request or fund a loan, repay and build credit.':
      'ทัวร์ 2 นาที: เลือกบทบาท ยืนยันตัวตน ขอหรือปล่อยกู้ ชำระคืน และสร้างเครดิต',
   'Getting Started | Moodeng Credit': 'เริ่มต้นใช้งาน | Moodeng Credit',
   'Learn the Moodeng basics: browse guides and benefits, see how USDC works, understand credit leveling, and explore the Academy and blog.':
      'เรียนรู้พื้นฐานของ Moodeng: ดูคู่มือและสิทธิประโยชน์ ดูว่า USDC ทำงานอย่างไร ทำความเข้าใจการเพิ่มระดับเครดิต และสำรวจอะคาเดมีกับบล็อก',

   // src/views/support/Guides.tsx
   'Guide categories': 'หมวดหมู่คู่มือ',

   // src/views/support/HowCreditLevelsWork.tsx
   'Play again': 'เล่นอีกครั้ง',
   'Your credit': 'เครดิตของคุณ',
   'Level 1': 'ระดับ 1',
   'Apply for loan': 'ขอเงินกู้',
   'Repayment complete': 'ชำระคืนเรียบร้อย',
   'Level 2 unlocked': 'ปลดล็อกระดับ 2 แล้ว',
   'How Credit Levels work': 'ระดับเครดิตทำงานอย่างไร',
   'Your Credit Level is your borrowing limit. Everyone starts at $15 — and it grows each time you repay a full-limit loan on time.':
      'ระดับเครดิตของคุณคือวงเงินกู้ของคุณ ทุกคนเริ่มต้นที่ $15 และวงเงินจะเพิ่มขึ้นทุกครั้งที่คุณชำระคืนเงินกู้เต็มวงเงินตรงเวลา',
   'Deep dive': 'เจาะลึก',
   'Credit limit climbing across four levels': 'วงเงินกู้ที่เพิ่มขึ้นตลอดสี่ระดับ',
   'Each Credit-Building Loan repaid on time steps your limit up to the next level.':
      'ทุกครั้งที่ชำระคืน Credit-Building Loan ตรงเวลา วงเงินของคุณจะขยับขึ้นสู่ระดับถัดไป',
   'The basics': 'พื้นฐาน',
   'Three things to know': 'สามสิ่งที่ควรรู้',
   'Credit Levels reward one clear pattern: borrow your full limit, repay it on time, unlock the next limit.':
      'ระดับเครดิตให้รางวัลกับรูปแบบเดียวที่ชัดเจน: ยืมเต็มวงเงิน ชำระคืนตรงเวลา แล้วปลดล็อกวงเงินถัดไป',
   'The ladder': 'บันไดสู่ระดับถัดไป',
   'Everyone starts at Level 1. Each successful Credit-Building Loan unlocks the next borrowing limit.':
      'ทุกคนเริ่มต้นที่ระดับ 1 ทุกครั้งที่ Credit-Building Loan สำเร็จ จะปลดล็อกวงเงินกู้ถัดไป',
   'Repay on time, and the next level unlocks itself.': 'ชำระคืนตรงเวลา แล้วระดับถัดไปจะปลดล็อกเอง',
   'Request a loan, repay it by the due date, and your limit steps up automatically — your borrowing power compounds with every clean repayment.':
      'ขอเงินกู้ ชำระคืนภายในกำหนด แล้ววงเงินของคุณจะขยับขึ้นโดยอัตโนมัติ — ความสามารถในการกู้ยืมของคุณจะเพิ่มขึ้นทุกครั้งที่ชำระคืนได้อย่างราบรื่น',
   'Two kinds of loan': 'เงินกู้สองประเภท',
   'Trust-Building vs Credit-Building': 'Trust-Building Loan เทียบกับ Credit-Building Loan',
   'Moodeng has two loan types. Both earn you Pandesal points — but only a full-limit Credit-Building Loan raises your borrowing limit.':
      'Moodeng มีเงินกู้สองประเภท ทั้งสองแบบได้แต้ม Pandesal แต่มีเพียง Credit-Building Loan แบบเต็มวงเงินเท่านั้นที่จะเพิ่มวงเงินกู้ของคุณ',
   'Your limit': 'วงเงินของคุณ',
   'Use it when:': 'ใช้เมื่อ:',
   'Most borrowers use both — trust loans to stay active, credit loans to climb.':
      'ผู้ยืมส่วนใหญ่ใช้ทั้งสองแบบ — ใช้เงินกู้สร้างความน่าเชื่อถือเพื่อคงความเคลื่อนไหว และใช้เงินกู้เพิ่มระดับเครดิตเพื่อไต่ระดับ',
   'Trust is the currency before the credit.': 'ความน่าเชื่อถือคือสิ่งที่ต้องมีก่อนเครดิต',
   'Every loan you repay cleanly — even a small Trust-Building Loan — deposits reputation that lenders can see. That trust is what gets your next request funded faster.':
      'ทุกเงินกู้ที่คุณชำระคืนอย่างราบรื่น แม้จะเป็น Trust-Building Loan จำนวนน้อย ก็สร้างความน่าเชื่อถือที่ผู้ให้กู้มองเห็นได้ ความน่าเชื่อถือนี้เองที่ทำให้คำขอครั้งถัดไปของคุณได้รับเงินกู้เร็วขึ้น',
   'Level up faster': 'เพิ่มระดับได้เร็วขึ้น',
   'Do this, not that': 'ควรทำสิ่งนี้ ไม่ใช่สิ่งนั้น',
   'A few habits keep your climb steady and protect the Pandesal points you are earning.':
      'นิสัยเล็ก ๆ น้อย ๆ เหล่านี้จะช่วยให้การไต่ระดับของคุณมั่นคง และปกป้องแต้ม Pandesal ที่คุณกำลังสะสม',
   'Credit Levels, answered': 'ไขข้อสงสัยเรื่องระดับเครดิต',
   'Quick answers to the questions borrowers ask most about levelling up.':
      'คำตอบสั้น ๆ สำหรับคำถามที่ผู้ยืมถามบ่อยที่สุดเกี่ยวกับการเพิ่มระดับ',
   'Keep learning': 'เรียนรู้เพิ่มเติม',
   'Related guides': 'คู่มือที่เกี่ยวข้อง',
   'Credit Levels work hand in hand with your Pandesal points and repayment history.':
      'ระดับเครดิตทำงานควบคู่ไปกับแต้ม Pandesal และประวัติการชำระคืนของคุณ',
   'Pop quiz': 'แบบทดสอบสั้น ๆ',
   'Are you a Credit Level pro?': 'คุณเชี่ยวชาญเรื่องระดับเครดิตแค่ไหน?',
   'Five quick questions. No pressure — your hippo believes in you.': 'ห้าคำถามสั้น ๆ ไม่ต้องกดดัน ฮิปโปของคุณเชื่อมั่นในตัวคุณ',
   'Ready to grow your limit?': 'พร้อมเพิ่มวงเงินของคุณหรือยัง?',
   'Only request your full limit when you are confident you can repay on time. Smaller loans still build trust.':
      'ขอเต็มวงเงินเมื่อคุณมั่นใจว่าจะชำระคืนตรงเวลาได้เท่านั้น เงินกู้จำนวนน้อยกว่าก็ยังช่วยสร้างความน่าเชื่อถือได้',
   'What it is': 'คืออะไร',
   'A level is a limit': 'ระดับคือวงเงิน',
   'Your level sets the most you can borrow at once.': 'ระดับของคุณกำหนดจำนวนสูงสุดที่คุณกู้ได้ในครั้งเดียว',
   'Level 1 unlocks $15 — small on purpose, since you have no history yet.':
      'ระดับ 1 ปลดล็อกวงเงิน $15 ซึ่งตั้งใจให้น้อย เพราะคุณยังไม่มีประวัติ',
   'How you grow': 'วิธีเพิ่มระดับ',
   'Repay your full limit': 'ชำระคืนเต็มวงเงินของคุณ',
   'A full-limit loan repaid on time raises your cap.': 'เงินกู้เต็มวงเงินที่ชำระคืนตรงเวลาจะเพิ่มเพดานวงเงินของคุณ',
   'That single clean repayment is what moves you up — nothing else does.':
      'การชำระคืนอย่างราบรื่นเพียงครั้งเดียวนี้เองที่ทำให้คุณขยับขึ้น ไม่มีอะไรอื่นที่ทำได้',
   'The pace': 'จังหวะการเพิ่มระดับ',
   'One level at a time': 'ทีละระดับ',
   'No skipping or buying ahead — each level is earned from the one before.':
      'ไม่สามารถข้ามหรือซื้อระดับล่วงหน้าได้ — แต่ละระดับต้องได้มาจากระดับก่อนหน้า',
   'Below your current limit': 'ต่ำกว่าวงเงินปัจจุบันของคุณ',
   'A loan for less than your current limit.': 'เงินกู้ที่น้อยกว่าวงเงินปัจจุบันของคุณ',
   'Stays the same': 'คงเดิม',
   'Goes up': 'เพิ่มขึ้น',
   'Your full current limit': 'เต็มวงเงินปัจจุบันของคุณ',
   'A loan for your full current limit. The level-up loan.': 'เงินกู้เต็มวงเงินปัจจุบันของคุณ เงินกู้สำหรับเพิ่มระดับ',
   'Unlocks the next level': 'ปลดล็อกระดับถัดไป',
   'Request your full current limit only when you are confident you can repay it.':
      'ขอเต็มวงเงินปัจจุบันเมื่อคุณมั่นใจว่าจะชำระคืนได้เท่านั้น',
   'Pick a repayment date you can comfortably hit. Repaying early is always fine.':
      'เลือกวันชำระคืนที่คุณทำได้อย่างสบาย ๆ การชำระคืนก่อนกำหนดทำได้เสมอ',
   'Do not take a full-limit loan you are unsure about — one missed repayment pauses your progress.':
      'อย่ากู้เต็มวงเงินหากคุณไม่มั่นใจ — การชำระคืนที่พลาดเพียงครั้งเดียวจะหยุดความก้าวหน้าของคุณ',
   'Do not expect extra or early payments to skip a level. Growth is always one step at a time.':
      'อย่าคาดหวังว่าการชำระเพิ่มหรือชำระก่อนกำหนดจะข้ามระดับได้ การเพิ่มระดับจะเป็นไปทีละขั้นเสมอ',
   'Understanding your Pandesal points': 'ทำความเข้าใจแต้ม Pandesal ของคุณ',
   'Trust-Building vs Credit-Building loans': 'Trust-Building Loan เทียบกับ Credit-Building Loan',
   'How repayments affect your Pandesal points': 'การชำระคืนส่งผลต่อแต้ม Pandesal ของคุณอย่างไร',
   'What is a Credit Level on Moodeng?': 'ระดับเครดิตบน Moodeng คืออะไร?',
   'A Credit Level is your borrowing limit. Everyone starts at Level 1 with a $15 limit, and the limit grows as you complete Credit-Building Loans.':
      'ระดับเครดิตคือวงเงินกู้ของคุณ ทุกคนเริ่มต้นที่ระดับ 1 ด้วยวงเงิน $15 และวงเงินจะเพิ่มขึ้นเมื่อคุณทำ Credit-Building Loan สำเร็จ',
   'How do I move to the next level?': 'ฉันจะไปสู่ระดับถัดไปได้อย่างไร?',
   'Take a Credit-Building Loan at your full current limit and repay it in full and on time. A clean repayment unlocks the next limit — $15 → $20 → $40 → $60 → $80 → $100 → $120 → $140.':
      'กู้ Credit-Building Loan เต็มวงเงินปัจจุบันของคุณ แล้วชำระคืนให้ครบและตรงเวลา การชำระคืนที่ราบรื่นจะปลดล็อกวงเงินถัดไป — $15 → $20 → $40 → $60 → $80 → $100 → $120 → $140',
   'Does borrowing a small amount level me up?': 'การยืมจำนวนน้อยจะทำให้ฉันเพิ่มระดับหรือไม่?',
   'No. Borrowing below your limit is a Trust-Building Loan. It improves your reputation with lenders but does not raise your Credit Level. Only a full-limit Credit-Building Loan advances you.':
      'ไม่ การยืมต่ำกว่าวงเงินของคุณคือ Trust-Building Loan ซึ่งช่วยเพิ่มความน่าเชื่อถือกับผู้ให้กู้ แต่ไม่เพิ่มระดับเครดิตของคุณ มีเพียง Credit-Building Loan แบบเต็มวงเงินเท่านั้นที่จะทำให้คุณก้าวหน้า',
   'Can I skip levels by repaying early or paying extra?': 'ฉันสามารถข้ามระดับได้หรือไม่ด้วยการชำระคืนก่อนกำหนดหรือชำระเพิ่ม?',
   'No. Moodeng advances one level at a time. Paying extra or repaying early does not skip a step — each new limit is earned by repaying the level before it.':
      'ไม่ได้ Moodeng จะเพิ่มระดับทีละขั้นเท่านั้น การชำระเพิ่มหรือชำระก่อนกำหนดจะไม่ข้ามขั้นตอนใด ๆ — วงเงินใหม่แต่ละระดับต้องได้มาจากการชำระคืนระดับก่อนหน้า',
   'Why does the limit start at only $15?': 'ทำไมวงเงินเริ่มต้นเพียง $15?',
   'Small starting limits keep risk low for the lenders funding someone with no track record yet. As you prove reliable repayment, your limit and lender confidence grow together.':
      'วงเงินเริ่มต้นที่น้อยช่วยลดความเสี่ยงให้ผู้ให้กู้ที่ปล่อยกู้ให้กับผู้ที่ยังไม่มีประวัติ เมื่อคุณพิสูจน์ได้ว่าชำระคืนได้อย่างน่าเชื่อถือ วงเงินและความมั่นใจของผู้ให้กู้จะเพิ่มขึ้นไปพร้อมกัน',
   'How long does it take to reach the $60 level?': 'ต้องใช้เวลานานแค่ไหนถึงจะถึงระดับวงเงิน $60?',
   'There is no fixed timeline. Each level needs one full-limit loan repaid on time, so the pace depends on how quickly you borrow and repay. Borrowers who repay cleanly can climb in just a few loan cycles.':
      'ไม่มีระยะเวลาที่แน่นอน แต่ละระดับต้องการเงินกู้เต็มวงเงินที่ชำระคืนตรงเวลาหนึ่งครั้ง ดังนั้นความเร็วจึงขึ้นอยู่กับว่าคุณยืมและชำระคืนเร็วแค่ไหน ผู้ยืมที่ชำระคืนได้อย่างราบรื่นสามารถไต่ระดับได้ภายในไม่กี่รอบการกู้',
   'What happens if I miss a repayment?': 'จะเกิดอะไรขึ้นถ้าฉันพลาดการชำระคืน?',
   'A late or missed repayment reduces your Pandesal points and can pause your progress. Lenders weigh the missed repayment heavily, so keeping payments on time matters more than borrowing size.':
      'การชำระคืนล่าช้าหรือพลาดจะลดแต้ม Pandesal ของคุณ และอาจหยุดความก้าวหน้าของคุณ ผู้ให้กู้ให้ความสำคัญกับการชำระคืนที่พลาดค่อนข้างมาก ดังนั้นการชำระตรงเวลาจึงสำคัญกว่าจำนวนเงินที่ยืม',
   'Does my Credit Level ever reset?': 'ระดับเครดิตของฉันจะรีเซ็ตหรือไม่?',
   'Your progress is tied to your wallet and repayment history, so it travels with you. Missed repayments do not erase your level, but they reduce your Pandesal points and can slow further growth.':
      'ความก้าวหน้าของคุณผูกติดกับกระเป๋าเงินและประวัติการชำระคืน จึงติดตัวคุณไปด้วยเสมอ การชำระคืนที่พลาดจะไม่ลบล้างระดับของคุณ แต่จะลดแต้ม Pandesal และอาจทำให้การเติบโตช้าลง',
   'What borrowing limit does everyone start with?': 'ทุกคนเริ่มต้นด้วยวงเงินกู้เท่าไร?',
   'Yep — everyone starts at $15. Small, but the climb begins here.':
      'ใช่แล้ว — ทุกคนเริ่มต้นที่ $15 น้อยก็จริง แต่การไต่ระดับเริ่มต้นที่นี่',
   'Close, but no. Level 1 starts everyone at a $15 limit.': 'ใกล้เคียงแต่ไม่ถูกต้อง ระดับ 1 เริ่มต้นทุกคนด้วยวงเงิน $15',
   'Which loan actually levels you up?': 'เงินกู้แบบไหนที่ช่วยเพิ่มระดับของคุณจริง ๆ?',
   'Exactly — only a full-limit Credit-Building Loan, repaid on time, bumps your cap.':
      'ถูกต้อง — มีเพียง Credit-Building Loan แบบเต็มวงเงินที่ชำระคืนตรงเวลาเท่านั้นที่จะเพิ่มเพดานวงเงินของคุณ',
   'Nice try! Only a full-limit Credit-Building Loan raises your level.':
      'เกือบถูกแล้ว! มีเพียง Credit-Building Loan แบบเต็มวงเงินเท่านั้นที่เพิ่มระดับของคุณ',
   'Your limit is $20. You borrow $10 and repay on time. What happens?': 'วงเงินของคุณคือ $20 คุณยืม $10 และชำระคืนตรงเวลา จะเกิดอะไรขึ้น?',
   'Right! Small loans build trust — they just don’t raise your limit.':
      'ถูกต้อง! เงินกู้จำนวนน้อยช่วยสร้างความน่าเชื่อถือ แต่ไม่ได้เพิ่มวงเงินของคุณ',
   'Not quite — a sub-limit loan builds trust but keeps your limit at $20.':
      'ยังไม่ถูกต้อง — เงินกู้ที่ต่ำกว่าวงเงินช่วยสร้างความน่าเชื่อถือ แต่วงเงินของคุณยังคงอยู่ที่ $20',
   'Can you skip from $15 straight to $60?': 'คุณสามารถข้ามจาก $15 ไปที่ $60 ได้โดยตรงหรือไม่?',
   'Correct — Moodeng climbs one level at a time. No shortcuts.': 'ถูกต้อง — Moodeng ไต่ระดับทีละขั้นเท่านั้น ไม่มีทางลัด',
   'Nope — there are no shortcuts. It’s one level at a time.': 'ไม่ถูกต้อง — ไม่มีทางลัด ต้องไต่ระดับทีละขั้น',
   'What slows your climb the most?': 'อะไรที่ทำให้การไต่ระดับของคุณช้าลงมากที่สุด?',
   'You got it — a missed repayment pauses progress and dents your Pandesal points.':
      'ถูกต้อง — การชำระคืนที่พลาดจะหยุดความก้าวหน้าและลดแต้ม Pandesal ของคุณ',
   'Actually it’s a late or missed repayment — that’s what pauses your climb.':
      'ที่จริงแล้วคือการชำระคืนล่าช้าหรือพลาด — นั่นคือสิ่งที่หยุดการไต่ระดับของคุณ',
   'Credit Level Legend': 'ตำนานระดับเครดิต',
   'Rising Star': 'ดาวรุ่งพุ่งแรง',
   'Just getting started': 'เพิ่งเริ่มต้น',
   'Answer choices': 'ตัวเลือกคำตอบ',
   'See your credit limit on the request board': 'ดูวงเงินกู้ของคุณบนกระดานคำขอ',
   'Apply for a loan on the request board': 'ขอเงินกู้บนกระดานคำขอ',
   'See live requests on the request board': 'ดูคำขอแบบเรียลไทม์บนกระดานคำขอ',
   'Credit limit growing from fifteen to sixty dollars': 'วงเงินกู้ที่เพิ่มขึ้นจากสิบห้าเป็นหกสิบดอลลาร์',
   'A borrower hippo at a Moodeng kiosk following the credit-building flow: request, repay on time, then level up':
      'ฮิปโปผู้ยืมที่คีออสก์ Moodeng ทำตามขั้นตอนการเพิ่มระดับเครดิต: ขอเงินกู้ ชำระคืนตรงเวลา แล้วเพิ่มระดับ',
   'A borrower hippo and a squirrel building trust with a lender at the Moodeng lending desk':
      'ฮิปโปผู้ยืมและกระรอกกำลังสร้างความน่าเชื่อถือกับผู้ให้กู้ที่เคาน์เตอร์ปล่อยกู้ของ Moodeng',

   // src/views/support/PublicGuide.tsx
   'More guides': 'คู่มือเพิ่มเติม',

   // src/views/support/PublicGuidesIndex.tsx
   'Everything you need to borrow with confidence — how Credit Levels grow, what your Pandesal points mean, and how USDC loans work.':
      'ทุกสิ่งที่คุณต้องรู้เพื่อยืมเงินได้อย่างมั่นใจ — ระดับเครดิตเติบโตอย่างไร แต้ม Pandesal ของคุณหมายถึงอะไร และเงินกู้ USDC ทำงานอย่างไร',

   // src/views/support/UpdateDetail.tsx
   "What's New": 'มีอะไรใหม่',
   'Published on': 'เผยแพร่เมื่อ',

   // src/views/support/Updates.tsx
   Latest: 'ล่าสุด',
   'Previous Updates': 'อัปเดตก่อนหน้า',

   // src/views/support/WhyUsdc.tsx
   'Why we use USDC': 'ทำไมเราถึงใช้ USDC',
   'Every loan on Moodeng is sent and repaid in USDC — a regulated digital dollar pegged 1:1 to the US dollar. Here is what that means, and why it makes small loans faster, cheaper, and safer.':
      'ทุกเงินกู้บน Moodeng ถูกส่งและชำระคืนเป็น USDC ซึ่งเป็นดอลลาร์ดิจิทัลที่อยู่ภายใต้การกำกับดูแลและผูกมูลค่ากับดอลลาร์สหรัฐในอัตรา 1:1 นี่คือความหมายของสิ่งนั้น และเหตุผลที่ทำให้เงินกู้จำนวนน้อยเร็วขึ้น ถูกลง และปลอดภัยขึ้น',
   'See the definitions': 'ดูคำนิยาม',
   'What is USDC?': 'USDC คืออะไร?',
   'USDC (USD Coin) is a': 'USDC (USD Coin) คือ',
   'The reasons': 'เหตุผล',
   'Free transfers, solid technology, real security, and a value that never drifts.':
      'โอนฟรี เทคโนโลยีมั่นคง ความปลอดภัยจริง และมูลค่าที่ไม่มีวันเปลี่ยนแปลง',
   'Where it is used': 'ที่ใช้งาน',
   'USDC works in two worlds. Here is which is which — and where Moodeng fits.':
      'USDC ทำงานได้ในสองโลก นี่คือความแตกต่างระหว่างทั้งสอง และตำแหน่งของ Moodeng ในนั้น',
   'On Moodeng:': 'บน Moodeng:',
   Definitions: 'คำนิยาม',
   'The words, in plain English': 'คำศัพท์อธิบายง่าย ๆ',
   'Staking and yield get mixed up a lot — so do payments and DeFi. Here is what each one really means.':
      'Staking และ yield มักถูกเข้าใจสับสน เช่นเดียวกับการชำระเงินและ DeFi นี่คือความหมายที่แท้จริงของแต่ละคำ',
   'Staking secures a blockchain and pays rewards for doing so — you cannot stake USDC that way. Yield is simply the return for lending or supplying USDC in DeFi. Moodeng does neither: it uses USDC to fund and repay community loans.':
      'Staking ช่วยรักษาความปลอดภัยของบล็อกเชนและให้ผลตอบแทนสำหรับการทำเช่นนั้น คุณไม่สามารถ stake USDC ในลักษณะนั้นได้ ส่วน yield คือผลตอบแทนจากการให้กู้ยืมหรือจ่าย USDC เข้าระบบ DeFi Moodeng ไม่ได้ทำทั้งสองอย่าง แต่ใช้ USDC เพื่อปล่อยกู้และรับชำระคืนเงินกู้ของชุมชน',
   'Quick answers to what borrowers ask most about the dollar behind their loans.':
      'คำตอบสั้น ๆ สำหรับคำถามที่ผู้ยืมถามบ่อยที่สุดเกี่ยวกับดอลลาร์เบื้องหลังเงินกู้ของพวกเขา',
   'USDC is the money layer under everything you do on Moodeng.': 'USDC คือชั้นเงินตราที่อยู่เบื้องหลังทุกสิ่งที่คุณทำบน Moodeng',
   'Ready to borrow in stable dollars?': 'พร้อมยืมเป็นดอลลาร์ที่มีเสถียรภาพหรือยัง?',
   'Your loan arrives as USDC and you repay in USDC — gasless on Base, and always worth what it says.':
      'เงินกู้ของคุณจะมาในรูปแบบ USDC และคุณชำระคืนเป็น USDC เช่นกัน โดยไม่มีค่าธรรมเนียมเครือข่ายบน Base และมีมูลค่าตรงตามที่ระบุเสมอ',
   'Wallet to wallet': 'กระเป๋าเงินสู่กระเป๋าเงิน',
   'Free transfers, no middleman': 'โอนฟรี ไม่มีตัวกลาง',
   'USDC moves directly between two wallets — no bank in between.':
      'USDC เคลื่อนย้ายโดยตรงระหว่างกระเป๋าเงินสองใบ โดยไม่มีธนาคารเข้ามาเกี่ยวข้อง',
   'On Base, sending USDC is gasless, so a $20 loan arrives as $20. No wire fees, no cut taken along the way.':
      'บน Base การส่ง USDC ไม่มีค่าธรรมเนียมเครือข่าย ดังนั้นเงินกู้ $20 จะมาถึงครบ $20 ไม่มีค่าธรรมเนียมโอนเงิน ไม่มีการหักระหว่างทาง',
   Technology: 'เทคโนโลยี',
   'Programmable, always-on money': 'เงินที่ตั้งโปรแกรมได้ และพร้อมใช้งานตลอดเวลา',
   'USDC is a digital dollar that settles on a blockchain in seconds, 24/7.':
      'USDC คือดอลลาร์ดิจิทัลที่ยืนยันธุรกรรมบนบล็อกเชนภายในไม่กี่วินาที ตลอด 24 ชั่วโมงทุกวัน',
   'It runs on open networks (Moodeng uses Base) and can move across chains — so value travels as easily as a message.':
      'มันทำงานบนเครือข่ายแบบเปิด (Moodeng ใช้ Base) และสามารถเคลื่อนย้ายข้ามเชนได้ ทำให้มูลค่าเดินทางได้ง่ายพอ ๆ กับการส่งข้อความ',
   'Regulated and fully backed': 'อยู่ภายใต้การกำกับดูแลและมีหลักประกันเต็มจำนวน',
   'Every USDC is backed 1:1 by cash and short-term US Treasuries.':
      'USDC ทุกหน่วยมีหลักประกันในอัตรา 1:1 ด้วยเงินสดและพันธบัตรรัฐบาลสหรัฐระยะสั้น',
   'Circle, its issuer, publishes independent monthly reserve attestations. Balances are also verifiable on-chain by anyone.':
      'Circle ผู้ออก USDC เผยแพร่รายงานรับรองทุนสำรองรายเดือนโดยหน่วยงานอิสระ และยอดคงเหลือสามารถตรวจสอบได้บนบล็อกเชนโดยทุกคน',
   Usability: 'การใช้งานจริง',
   'A dollar that holds its value': 'ดอลลาร์ที่รักษามูลค่าไว้ได้',
   'One USDC is always worth one dollar, so loan amounts never drift.':
      '1 USDC มีมูลค่าเท่ากับ 1 ดอลลาร์เสมอ ดังนั้นจำนวนเงินกู้จะไม่มีวันเปลี่ยนแปลง',
   'You can hold, send, and receive it from almost anywhere without relying on a traditional bank account.':
      'คุณสามารถถือ ส่ง และรับได้จากเกือบทุกที่ โดยไม่ต้องพึ่งพาบัญชีธนาคารแบบดั้งเดิม',
   'The everyday economy': 'เศรษฐกิจในชีวิตประจำวัน',
   'Using USDC the way you use cash or a bank transfer — paying people, sending money across borders, or cashing out to your local currency.':
      'ใช้ USDC เหมือนที่คุณใช้เงินสดหรือโอนเงินผ่านธนาคาร ไม่ว่าจะจ่ายให้คนอื่น ส่งเงินข้ามประเทศ หรือถอนเป็นสกุลเงินท้องถิ่น',
   'On-chain finance': 'การเงินบนเชน',
   'Decentralized finance': 'การเงินแบบกระจายศูนย์',
   'USDC is a regulated stablecoin — a digital dollar issued by Circle and pegged 1:1 to the US dollar. Each USDC is backed by cash and short-term US Treasuries, with independent monthly reserve attestations.':
      'USDC คือสเตเบิลคอยน์ที่อยู่ภายใต้การกำกับดูแล เป็นดอลลาร์ดิจิทัลที่ออกโดย Circle และผูกมูลค่ากับดอลลาร์สหรัฐในอัตรา 1:1 USDC แต่ละหน่วยมีหลักประกันเป็นเงินสดและพันธบัตรรัฐบาลสหรัฐระยะสั้น พร้อมรายงานรับรองทุนสำรองรายเดือนจากหน่วยงานอิสระ',
   'Why does Moodeng use USDC instead of regular money?': 'ทำไม Moodeng ถึงใช้ USDC แทนเงินทั่วไป?',
   'USDC keeps loan values stable, moves wallet-to-wallet in seconds, and is gasless on Base — so a $20 loan is still exactly $20 when you repay it, with no bank fees eating into it.':
      'USDC รักษามูลค่าเงินกู้ให้คงที่ เคลื่อนย้ายจากกระเป๋าเงินสู่กระเป๋าเงินได้ภายในไม่กี่วินาที และไม่มีค่าธรรมเนียมเครือข่ายบน Base ดังนั้นเงินกู้ $20 จะยังคงเป็น $20 เท่าเดิมเมื่อคุณชำระคืน โดยไม่มีค่าธรรมเนียมธนาคารมาหักออก',
   'Is USDC safe?': 'USDC ปลอดภัยหรือไม่?',
   'USDC is issued by the most licensed stablecoin company in the world and is backed 1:1 by highly liquid reserves. Those reserves are attested monthly by independent accounting firms, and every balance is verifiable on-chain.':
      'USDC ออกโดยบริษัทสเตเบิลคอยน์ที่ได้รับใบอนุญาตมากที่สุดในโลก และมีหลักประกันในอัตรา 1:1 ด้วยทุนสำรองที่มีสภาพคล่องสูง ทุนสำรองเหล่านี้ได้รับการรับรองทุกเดือนโดยบริษัทบัญชีอิสระ และยอดคงเหลือทุกบัญชีสามารถตรวจสอบได้บนบล็อกเชน',
   'What is the difference between staking and yield?': 'Staking กับ yield ต่างกันอย่างไร?',
   'Staking means locking a token to help secure a proof-of-stake blockchain in exchange for rewards. Yield is the return you earn by lending or supplying USDC in DeFi. USDC is not a staking token, but it can earn yield.':
      'Staking หมายถึงการล็อกโทเคนไว้เพื่อช่วยรักษาความปลอดภัยของบล็อกเชนแบบ proof-of-stake เพื่อแลกกับผลตอบแทน ส่วน yield คือผลตอบแทนที่คุณได้รับจากการให้กู้ยืมหรือจ่าย USDC เข้าระบบ DeFi USDC ไม่ใช่โทเคนสำหรับ staking แต่สามารถสร้าง yield ได้',
   'What is the difference between real-world use and DeFi use?': 'การใช้งานในโลกจริงกับการใช้งานใน DeFi ต่างกันอย่างไร?',
   'Real-world use is spending or sending USDC like cash — payments, remittances, cashing out. DeFi use is putting USDC into smart-contract apps to lend, borrow, or swap without a bank. Moodeng loans are real-world use.':
      'การใช้งานในโลกจริงคือการใช้จ่ายหรือส่ง USDC เหมือนเงินสด เช่น การจ่ายเงิน การโอนเงินข้ามประเทศ หรือการถอนเงิน ส่วนการใช้งานใน DeFi คือการนำ USDC เข้าสู่แอปสมาร์ตคอนแทร็กต์เพื่อให้กู้ ยืม หรือแลกเปลี่ยนโดยไม่ผ่านธนาคาร เงินกู้ของ Moodeng เป็นการใช้งานในโลกจริง',
   'Do I pay fees to send USDC on Moodeng?': 'ฉันต้องเสียค่าธรรมเนียมในการส่ง USDC บน Moodeng หรือไม่?',
   'No. Moodeng uses your Instant Wallet (or a Base Account, if you prefer) on Base, where USDC transfers are gasless. You do not pay network fees to receive a loan or make a repayment.':
      'ไม่ Moodeng ใช้ Instant Wallet ของคุณ (หรือ Base Account หากคุณต้องการ) บน Base ซึ่งการโอน USDC ไม่มีค่าธรรมเนียมเครือข่าย คุณไม่ต้องจ่ายค่าธรรมเนียมเครือข่ายเพื่อรับเงินกู้หรือชำระคืน',
   'No. Moodeng is community lending — USDC is used to fund and repay loans. Staking and yield live in the wider crypto ecosystem, not inside Moodeng.':
      'ไม่ Moodeng คือการปล่อยกู้ในชุมชน โดยใช้ USDC ในการปล่อยกู้และรับชำระคืน ส่วน staking และ yield อยู่ในระบบนิเวศคริปโตที่กว้างขึ้น ไม่ได้อยู่ภายใน Moodeng',
   'Using USDC on Moodeng Credit': 'การใช้ USDC บน Moodeng Credit',

   // src/views/support/components/NeedMoreHelp.tsx
   'Message the team and a real person will reply — here and by email.':
      'ส่งข้อความถึงทีมงาน แล้วคนจริง ๆ จะตอบกลับคุณ ทั้งที่นี่และทางอีเมล',
   'Get In Touch': 'ติดต่อเรา',
   'Meet the Moodeng Credit Team': 'รู้จักทีมงาน Moodeng Credit',
   'See the people building borrower trust.': 'ดูทีมงานที่สร้างความน่าเชื่อถือให้ผู้ยืม',

   // src/views/transactions/TransactionDetail.tsx
   Due: 'ครบกำหนด',
   'Optional Gift': 'ของขวัญ (ไม่บังคับ)',
   'Would you like to return the interest as a gift?': 'คุณต้องการคืนดอกเบี้ยเป็นของขวัญหรือไม่?',
   'Interest to return': 'ดอกเบี้ยที่จะคืน',
   'Return interest?': 'คืนดอกเบี้ยหรือไม่?',
   "This is a voluntary gift — once sent, it can't be reversed.": 'นี่คือของขวัญโดยสมัครใจ เมื่อส่งแล้วจะไม่สามารถย้อนกลับได้',
   'Hide — this keeps going on its own': 'ซ่อน — รายการนี้จะดำเนินต่อไปเอง',
   'Sent successfully!': 'ส่งสำเร็จแล้ว!',
   'Waiting for lender acceptance': 'รอผู้ให้กู้ยอมรับ',
   'This loan is not funded yet. Repayment starts only after a lender accepts.':
      'เงินกู้นี้ยังไม่ได้รับการปล่อยกู้ การชำระคืนจะเริ่มก็ต่อเมื่อผู้ให้กู้ยอมรับแล้วเท่านั้น',
   'View on explorer': 'ดูบน explorer',

   // src/views/transactions/TransactionHistory.tsx
   'Your loan activity will appear here once you start borrowing.': 'กิจกรรมเงินกู้ของคุณจะปรากฏที่นี่เมื่อคุณเริ่มยืมเงิน',
   'Interest can be returned': 'สามารถคืนดอกเบี้ยได้',
   'All Transactions': 'ธุรกรรมทั้งหมด',
   Completed: 'เสร็จสิ้น',
   'Search transaction history': 'ค้นหาประวัติธุรกรรม',

   // src/views/user-profile/LenderDiversityHistory.tsx
   'Lender Diversity': 'ความหลากหลายของผู้ให้กู้',
   'Need at least 2 funded loans': 'ต้องมีเงินกู้ที่ได้รับการปล่อยกู้อย่างน้อย 2 รายการ',
   'A lender diversity score appears once there is enough borrower history to compare.':
      'คะแนนความหลากหลายของผู้ให้กู้จะปรากฏเมื่อมีประวัติผู้ยืมเพียงพอสำหรับการเปรียบเทียบ',
   'Lender Distribution': 'การกระจายตัวของผู้ให้กู้',
   'No lender history yet': 'ยังไม่มีประวัติผู้ให้กู้',
   'Once this borrower receives funded loans, the lender distribution will appear here.':
      'เมื่อผู้ยืมรายนี้ได้รับเงินกู้ที่ปล่อยกู้แล้ว การกระจายตัวของผู้ให้กู้จะปรากฏที่นี่',

   // src/views/user-profile/ProgressHistory.tsx
   'Progress History': 'ประวัติความก้าวหน้า',
   'Borrower Timeline': 'ไทม์ไลน์ผู้ยืม',
   'Complete history of milestones and loan activity': 'ประวัติที่สมบูรณ์ของหมุดหมายและกิจกรรมเงินกู้',
   'Started at Level 0': 'เริ่มต้นที่ระดับ 0',
   'Borrower account created and credit journey started.': 'สร้างบัญชีผู้ยืมแล้ว และเริ่มต้นเส้นทางเครดิต',
   'Identity verification completed.': 'ยืนยันตัวตนเสร็จสมบูรณ์แล้ว',
   'No loan activity yet': 'ยังไม่มีกิจกรรมเงินกู้',
   'No funded loans have been recorded for this borrower yet.': 'ยังไม่มีการบันทึกเงินกู้ที่ปล่อยกู้ให้ผู้ยืมรายนี้',
   'Repeat Lender Relationship': 'ความสัมพันธ์กับผู้ให้กู้ซ้ำ',
   'Borrowed again from an existing lender.': 'ยืมอีกครั้งจากผู้ให้กู้รายเดิม',
   'Partial Repayment Made': 'ชำระคืนบางส่วนแล้ว',
   'Credit Limit Unlocked': 'ปลดล็อกวงเงินกู้แล้ว',
   'Defaulted Loan': 'เงินกู้ผิดนัดชำระ',
   'Loan remains unpaid past the due date.': 'เงินกู้ยังไม่ได้ชำระคืนเกินกำหนดวันครบกำหนด',
   'More Trust-Building Loans': 'มี Trust-Building Loan มากกว่า',
   'This borrower has more smaller trust-building loans than full-limit credit-building loans. These help show repayment history, but they do not raise credit level.':
      'ผู้ยืมรายนี้มี Trust-Building Loan จำนวนน้อยมากกว่า Credit-Building Loan แบบเต็มวงเงิน ซึ่งช่วยแสดงประวัติการชำระคืน แต่ไม่เพิ่มระดับเครดิต',

   // src/views/user-profile/UserProfile.tsx
   'Borrower context': 'บริบทผู้ยืม',
   'This account is a lender': 'บัญชีนี้คือผู้ให้กู้',
   'Lenders fund loans rather than borrow, so there is no borrowing history to show here.':
      'ผู้ให้กู้ปล่อยกู้แทนที่จะยืม จึงไม่มีประวัติการยืมให้แสดงที่นี่',
   'Lending Summary': 'สรุปการปล่อยกู้',
   'No Defaults': 'ไม่มีการผิดนัดชำระ',
   'Borrowers Backed': 'ผู้ยืมที่สนับสนุน',
   'No loans funded yet': 'ยังไม่มีการปล่อยกู้',
   'This lender has not funded a loan yet, so there is nothing to summarise.': 'ผู้ให้กู้รายนี้ยังไม่ได้ปล่อยกู้ จึงยังไม่มีข้อมูลให้สรุป',
   'Lending Patterns': 'รูปแบบการปล่อยกู้',
   'Loans Funded': 'เงินกู้ที่ปล่อยแล้ว',
   'Who this lender has backed and the status of each loan.': 'ผู้ที่ผู้ให้กู้รายนี้สนับสนุน และสถานะของแต่ละเงินกู้',
   'Loan / borrower': 'เงินกู้ / ผู้ยืม',
   'Verify to unlock LV.1': 'ยืนยันตัวตนเพื่อปลดล็อก LV.1',
   'Only you can see this': 'มีเพียงคุณเท่านั้นที่เห็นสิ่งนี้',
   'Good standing': 'สถานะดี',
   'View loan mix': 'ดูสัดส่วนเงินกู้',
   'Your score appears after at least 2 funded loans from different lenders.':
      'คะแนนของคุณจะปรากฏหลังจากมีเงินกู้ที่ได้รับการปล่อยกู้จากผู้ให้กู้ต่างรายอย่างน้อย 2 รายการ',
   'Borrower patterns': 'รูปแบบผู้ยืม',
   'Recent Loans': 'เงินกู้ล่าสุด',
   'View who has funded this borrower and the status of each loan.': 'ดูว่าใครปล่อยกู้ให้ผู้ยืมรายนี้ และสถานะของแต่ละเงินกู้',
   'Loan / lender': 'เงินกู้ / ผู้ให้กู้',
   'No funded loans yet': 'ยังไม่มีเงินกู้ที่ได้รับการปล่อยกู้',
   'Not enough loan history yet': 'ยังมีประวัติเงินกู้ไม่เพียงพอ',
   "Once this borrower completes more loans, you'll see repayment timing, usual loan size, repeat lenders, and borrowing patterns here.":
      'เมื่อผู้ยืมรายนี้ทำเงินกู้เสร็จสิ้นมากขึ้น คุณจะเห็นจังหวะการชำระคืน ขนาดเงินกู้ทั่วไป ผู้ให้กู้ที่ยืมซ้ำ และรูปแบบการยืมที่นี่',
   'Default History': 'ประวัติการผิดนัดชำระ',
   'Missed repayments on this borrower’s past loans.': 'การชำระคืนที่พลาดในเงินกู้ที่ผ่านมาของผู้ยืมรายนี้',
   'A default happens when a repayment deadline passes without full repayment.':
      'การผิดนัดชำระเกิดขึ้นเมื่อกำหนดเวลาชำระคืนผ่านไปโดยยังไม่ได้ชำระคืนครบถ้วน',
   'Loan defaulted': 'เงินกู้ผิดนัดชำระ',
   Unresolved: 'ยังไม่ได้แก้ไข',
   'Defaults may signal repayment risk. Lenders should review the borrower’s full history, not just credit level.':
      'การผิดนัดชำระอาจบ่งชี้ความเสี่ยงในการชำระคืน ผู้ให้กู้ควรตรวจสอบประวัติทั้งหมดของผู้ยืม ไม่ใช่แค่ระดับเครดิตเท่านั้น',
   'Repayment History': 'ประวัติการชำระคืน',
   'Money this borrower has already paid back across funded loans.':
      'จำนวนเงินที่ผู้ยืมรายนี้ชำระคืนแล้วในเงินกู้ที่ได้รับการปล่อยกู้ทั้งหมด',
   'Fully repaid': 'ชำระคืนครบแล้ว',
   'Completed repayments show this borrower has returned funds before. Partial repayments can still be useful context, but lenders should compare them with due dates and remaining balances.':
      'การชำระคืนที่เสร็จสมบูรณ์แสดงว่าผู้ยืมรายนี้เคยคืนเงินมาก่อน การชำระคืนบางส่วนก็ยังเป็นข้อมูลที่เป็นประโยชน์ แต่ผู้ให้กู้ควรเปรียบเทียบกับวันครบกำหนดและยอดคงเหลือ',
   'How Credit Level Works': 'ระดับเครดิตทำงานอย่างไร',
   'Credit Level shows the borrower’s current borrowing tier.': 'ระดับเครดิตแสดงระดับการยืมปัจจุบันของผู้ยืม',
   'Borrowers level up by taking a Credit Building loan at their current limit and repaying it successfully.':
      'ผู้ยืมจะเพิ่มระดับได้โดยการกู้ Credit-Building Loan เต็มวงเงินปัจจุบัน แล้วชำระคืนสำเร็จ',
   'Credit Levels': 'ระดับเครดิต',
   'Credit limit': 'วงเงินกู้',
   'How Lender Diversity Works': 'ความหลากหลายของผู้ให้กู้ทำงานอย่างไร',
   'This score belongs to the borrower. It measures the quality of the people who have lent to them.':
      'คะแนนนี้เป็นของผู้ยืม โดยวัดคุณภาพของผู้ที่ปล่อยกู้ให้พวกเขา',
   'What a high score means': 'คะแนนสูงหมายถึงอะไร',
   'Lenders look independent, established, and natural. They are not all new accounts, not all funding at once, and not overly concentrated in one lender.':
      'ผู้ให้กู้ดูเป็นอิสระ มีความน่าเชื่อถือ และเป็นธรรมชาติ ไม่ใช่บัญชีใหม่ทั้งหมด ไม่ได้ปล่อยกู้พร้อมกันทั้งหมด และไม่กระจุกตัวอยู่ที่ผู้ให้กู้รายเดียวมากเกินไป',
   'What it is trying to catch': 'สิ่งที่พยายามตรวจจับ',
   'A borrower could look trustworthy by using fake lender accounts to fund small loans, then ask for a larger real loan. This score looks for that kind of coordinated lender history.':
      'ผู้ยืมอาจดูน่าเชื่อถือได้โดยใช้บัญชีผู้ให้กู้ปลอมเพื่อปล่อยกู้จำนวนน้อย แล้วจึงขอเงินกู้จริงจำนวนมากขึ้น คะแนนนี้จะตรวจจับประวัติผู้ให้กู้ที่ร่วมมือกันในลักษณะนี้',
   'Score bands': 'ช่วงคะแนน',
   "This does not judge the borrower directly. It tells lenders whether the borrower's lender network looks organic or suspicious.":
      'คะแนนนี้ไม่ได้ตัดสินตัวผู้ยืมโดยตรง แต่บอกผู้ให้กู้ว่าเครือข่ายผู้ให้กู้ของผู้ยืมดูเป็นธรรมชาติหรือน่าสงสัย',
   'Read the full docs': 'อ่านเอกสารฉบับเต็ม',
   'Lender Diversity Score documentation': 'เอกสารคะแนนความหลากหลายของผู้ให้กู้',
   'Why lenders care': 'ทำไมผู้ให้กู้ถึงให้ความสำคัญ',
   'Loan mix shows whether this borrower is mostly building repayment history with smaller loans, or raising their credit level with full-limit repayments.':
      'สัดส่วนเงินกู้แสดงว่าผู้ยืมรายนี้ส่วนใหญ่สร้างประวัติการชำระคืนด้วยเงินกู้จำนวนน้อย หรือเพิ่มระดับเครดิตด้วยการชำระคืนเต็มวงเงิน',
   'A healthy borrower can have both: smaller loans for repayment history and full-limit loans for higher future limits.':
      'ผู้ยืมที่มีสุขภาพทางการเงินดีสามารถมีทั้งสองแบบได้ คือเงินกู้จำนวนน้อยเพื่อสร้างประวัติการชำระคืน และเงินกู้เต็มวงเงินเพื่อเพิ่มวงเงินในอนาคต',
   'Start with who they are': 'เริ่มต้นด้วยการดูว่าพวกเขาเป็นใคร',
   'Read the borrower context first — whether they are a verified human, how long they have been a member, and how they earn and repay. It frames every number below and tells you whether their reason to borrow fits their situation.':
      'อ่านบริบทผู้ยืมก่อน — ว่าพวกเขาเป็นมนุษย์ที่ผ่านการยืนยันตัวตนแล้วหรือไม่ เป็นสมาชิกมานานแค่ไหน และหารายได้และชำระคืนอย่างไร ข้อมูลนี้จะช่วยกำหนดกรอบตัวเลขทั้งหมดด้านล่าง และบอกว่าเหตุผลในการยืมของพวกเขาเหมาะสมกับสถานการณ์หรือไม่',
   'Check Credit Level': 'ตรวจสอบระดับเครดิต',
   'Credit Level is the borrower tier. It helps you understand how much trust they have already unlocked through prior behavior.':
      'ระดับเครดิตคือระดับชั้นของผู้ยืม ช่วยให้คุณเข้าใจว่าพวกเขาได้ปลดล็อกความน่าเชื่อถือไปมากแค่ไหนจากพฤติกรรมที่ผ่านมา',
   'Read the loan summary': 'อ่านสรุปเงินกู้',
   'Look at total borrowed, total loans, repayments, defaults, and standing. Good Standing means there are no unresolved defaults.':
      'ดูยอดยืมทั้งหมด จำนวนเงินกู้ทั้งหมด การชำระคืน การผิดนัดชำระ และสถานะ สถานะดีหมายถึงไม่มีการผิดนัดชำระที่ยังไม่ได้แก้ไข',
   'Look at lender diversity': 'ดูความหลากหลายของผู้ให้กู้',
   'This shows whether the borrower has earned trust from multiple lenders, not just one repeated relationship.':
      'สิ่งนี้แสดงว่าผู้ยืมได้รับความไว้วางใจจากผู้ให้กู้หลายรายหรือไม่ ไม่ใช่แค่ความสัมพันธ์ซ้ำกับรายเดียว',
   'Use behavior patterns': 'ใช้รูปแบบพฤติกรรม',
   'These patterns help you judge risk: how often they borrow, how fast they usually repay, typical loan size, loan term, and repeat lenders.':
      'รูปแบบเหล่านี้ช่วยให้คุณประเมินความเสี่ยง เช่น พวกเขายืมบ่อยแค่ไหน ชำระคืนเร็วแค่ไหนโดยทั่วไป ขนาดเงินกู้ทั่วไป ระยะเวลาเงินกู้ และผู้ให้กู้ที่ยืมซ้ำ',
   'Review recent loans': 'ตรวจสอบเงินกู้ล่าสุด',
   'Use the recent loan table to confirm the borrower has a repayment history that matches the request you are thinking about funding.':
      'ใช้ตารางเงินกู้ล่าสุดเพื่อยืนยันว่าผู้ยืมมีประวัติการชำระคืนที่สอดคล้องกับคำขอที่คุณกำลังพิจารณาปล่อยกู้',
   'Change reading mode': 'เปลี่ยนโหมดการอ่าน',
   'Optional: switch to dark mode if it makes this profile easier to read. It changes nothing about the borrower data or your lending decision.':
      'ทางเลือกเสริม: สลับเป็นโหมดมืดหากช่วยให้อ่านโปรไฟล์นี้ง่ายขึ้น การเปลี่ยนแปลงนี้ไม่ส่งผลต่อข้อมูลผู้ยืมหรือการตัดสินใจปล่อยกู้ของคุณ',
   'Moodeng with trophy': 'ฮิปโป Moodeng ถือถ้วยรางวัล',
   'Usual amount funded': 'จำนวนเงินที่ปล่อยกู้ตามปกติ',
   'Typical time to be repaid': 'ระยะเวลาปกติในการได้รับชำระคืน',
   'Repeat borrowers': 'ผู้ยืมซ้ำ',
   'Overdue against them': 'ยอดค้างชำระต่อพวกเขา',
   'How Credit Level works': 'ระดับเครดิตทำงานอย่างไร',
   'Total Borrowed': 'ยอดที่ยืมทั้งหมด',
   'Total Loans': 'จำนวนเงินกู้ทั้งหมด',
   'How Lender Diversity Score works': 'คะแนนความหลากหลายของผู้ให้กู้ทำงานอย่างไร',
   'Avg days between loans': 'จำนวนวันเฉลี่ยระหว่างเงินกู้แต่ละครั้ง',
   'Typical loan term': 'ระยะเวลาเงินกู้ทั่วไป',
   'Repeat lenders': 'ผู้ให้กู้ที่ยืมซ้ำ',
   'Close default history': 'ปิดประวัติการผิดนัดชำระ',
   'Close repayment history': 'ปิดประวัติการชำระคืน',
   'Close credit level explanation': 'ปิดคำอธิบายระดับเครดิต',
   'Close lender diversity explanation': 'ปิดคำอธิบายความหลากหลายของผู้ให้กู้',
   'Amount concentration': 'ความกระจุกตัวของจำนวนเงิน',
   'Lender newness': 'ความใหม่ของผู้ให้กู้',
   'New or inactive wallets count as riskier than established wallets with real on-chain activity.':
      'กระเป๋าเงินใหม่หรือไม่มีความเคลื่อนไหวถือว่ามีความเสี่ยงมากกว่ากระเป๋าเงินที่มีกิจกรรมออนเชนจริงมาอย่างยาวนาน',
   'Timing patterns': 'รูปแบบช่วงเวลา',
   'Looks for loans arriving in suspicious clusters instead of normal lending intervals.':
      'ตรวจหาการปล่อยกู้ที่มาเป็นกลุ่มน่าสงสัย แทนที่จะเป็นช่วงเวลาการปล่อยกู้ปกติ',
   'Recent suspicious patterns matter more. Older clean history fades over time.':
      'รูปแบบน่าสงสัยล่าสุดมีน้ำหนักมากกว่า ส่วนประวัติที่สะอาดในอดีตจะมีน้ำหนักลดลงตามเวลา',
   'Group coordination': 'การร่วมมือกันเป็นกลุ่ม',
   'Checks whether many lenders appeared around the same time, which can suggest a recruited group.':
      'ตรวจสอบว่ามีผู้ให้กู้จำนวนมากปรากฏขึ้นในช่วงเวลาใกล้เคียงกันหรือไม่ ซึ่งอาจบ่งชี้ถึงกลุ่มที่ถูกจัดตั้งขึ้น',
   Excellent: 'ยอดเยี่ยม',
   Good: 'ดี',
   Fair: 'ปานกลาง',
   Low: 'ต่ำ',
   'Very Low': 'ต่ำมาก',
   'Close loan mix explanation': 'ปิดคำอธิบายสัดส่วนเงินกู้',
   'Trust loans': 'เงินกู้สร้างความน่าเชื่อถือ',
   'Credit loans': 'เงินกู้เพิ่มระดับเครดิต',
   'Smaller loans below the current limit. They help show the borrower can repay, but they do not raise credit level.':
      'เงินกู้จำนวนน้อยกว่าวงเงินปัจจุบัน ช่วยแสดงว่าผู้ยืมสามารถชำระคืนได้ แต่ไม่เพิ่มระดับเครดิต',
   'Credit-level signal': 'สัญญาณระดับเครดิต',
   'A full-limit loan. If it is repaid successfully, it can unlock the borrower’s next credit level.':
      'เงินกู้เต็มวงเงิน หากชำระคืนสำเร็จ จะสามารถปลดล็อกระดับเครดิตถัดไปของผู้ยืมได้',

   // src/views/withdraw/CashoutFaceCheck.tsx
   'Back to withdraw': 'กลับไปหน้าถอนเงิน',
   'Checking your scan': 'กำลังตรวจสอบการสแกนของคุณ',
   'This usually takes a few seconds. Keep this screen open.': 'โดยปกติจะใช้เวลาไม่กี่วินาที กรุณาเปิดหน้านี้ค้างไว้',
   "Since this is your first cash-out, we ask for a ten-second scan to confirm it's really you before sending any money out.":
      'เนื่องจากนี่คือการถอนเงินครั้งแรกของคุณ เราจึงขอให้สแกนใบหน้าสิบวินาทีเพื่อยืนยันว่าเป็นคุณจริง ๆ ก่อนส่งเงินออกไป',

   // src/views/withdraw/Withdraw.tsx
   "You're sending": 'คุณกำลังส่ง',
   "You'll receive": 'คุณจะได้รับ',
   'How this works': 'วิธีการทำงาน',
   'Show me how': 'แสดงวิธีทำ',
   'Video guide coming soon': 'วิดีโอคู่มือเร็ว ๆ นี้',
   'Send only': 'ส่งเฉพาะ',
   'Verify Base first': 'ยืนยัน Base ก่อน',
   'How would you like to cash out?': 'คุณต้องการถอนเงินด้วยวิธีใด?',
   'Your loan funds are in your wallet. Withdraw or convert them using an exchange, P2P platform, or a supported local crypto service.':
      'เงินกู้ของคุณอยู่ในกระเป๋าเงินของคุณแล้ว คุณสามารถถอนหรือแปลงเงินได้โดยใช้แพลตฟอร์มแลกเปลี่ยน แพลตฟอร์ม P2P หรือบริการคริปโตท้องถิ่นที่รองรับ',
   'Learn more about withdrawal options': 'เรียนรู้เพิ่มเติมเกี่ยวกับตัวเลือกการถอนเงิน',
   "I'll do this later": 'ไว้ทำภายหลัง',
   'Contact support': 'ติดต่อฝ่ายช่วยเหลือ',
   'Sent!': 'ส่งแล้ว!',
   'Cashing out…': 'กำลังถอนเงิน…',
   'This can take a couple of minutes the first time. Keep this screen open.': 'ครั้งแรกอาจใช้เวลาสองสามนาที กรุณาเปิดหน้านี้ค้างไว้',
   'Payout to': 'จ่ายเงินไปยัง',
   "Doesn't look like a valid wallet address.": 'ดูเหมือนจะไม่ใช่ที่อยู่กระเป๋าเงินที่ถูกต้อง',
   Max: 'สูงสุด',
   "That's more than your available balance.": 'จำนวนนี้มากกว่ายอดคงเหลือที่ใช้ได้ของคุณ',
   Withdraw: 'ถอนเงิน',
   Sent: 'ส่งแล้ว',
   Bank: 'ธนาคาร',
   'Your cash-out steps': 'ขั้นตอนการถอนเงินของคุณ',
   "You're all set": 'คุณพร้อมแล้ว',
   'Paste it below': 'วางที่นี่ด้านล่าง'
};
