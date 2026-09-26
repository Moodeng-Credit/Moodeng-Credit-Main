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
   'Repayments are automatically sent to your wallet when the borrower repays.': 'เมื่อผู้ยืมชำระคืน เงินจะถูกส่งเข้ากระเป๋าเงินของคุณโดยอัตโนมัติ',
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
   'Start with verified USDC microloans in real worker corridors.': 'เริ่มต้นกับสินเชื่อรายย่อย USDC ที่ผ่านการยืนยันตัวตน ในเส้นทางที่แรงงานเดินทางไปทำงานจริง',
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
   'Meet overseas Filipinos and Southeast Asians building credit abroad.': 'รู้จักชาวฟิลิปปินส์และชาวเอเชียตะวันออกเฉียงใต้ที่กำลังสร้างเครดิตในต่างแดน',
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
   'That creates a trust gap for borrowers and a missed opportunity for lenders.': 'สิ่งนี้ทำให้ผู้ยืมขาดความน่าเชื่อถือ และผู้ให้กู้พลาดโอกาส',
   'Credit gets reset': 'เครดิตถูกรีเซ็ต',
   'A Filipino or SEA worker can repay responsibly abroad and still have no useful credit record.':
      'แรงงานฟิลิปปินส์หรือจากเอเชียตะวันออกเฉียงใต้อาจชำระคืนอย่างรับผิดชอบในต่างแดน แต่ก็ยังไม่มีประวัติเครดิตที่นำไปใช้ได้',
   'Good borrowers disappear': 'ผู้ยืมที่ดีถูกมองข้าม',
   'Lenders cannot easily see the trust signals that should matter for a small emergency loan.':
      'ผู้ให้กู้มองไม่เห็นสัญญาณความน่าเชื่อถือที่ควรใช้พิจารณาเงินกู้ฉุกเฉินจำนวนเล็กน้อยได้ง่าย ๆ',
   'Bad options fill the gap': 'ทางเลือกที่แย่เข้ามาแทนที่',
   'Quick-loan apps step in with pressure, high costs, and little long-term upside.': 'แอปเงินกู้ด่วนเข้ามาพร้อมการกดดัน ค่าใช้จ่ายสูง และแทบไม่มีประโยชน์ในระยะยาว',
   'A group of people held together in a circular illustration': 'ภาพประกอบกลุ่มคนที่รวมตัวกันเป็นวงกลม',

   // src/views/lenderBenefits/sections/VerifyIdentitySection.tsx
   'Identity layer': 'ชั้นการยืนยันตัวตน',
   'World ID is a trust signal, not a loan guarantee.': 'World ID เป็นสัญญาณความน่าเชื่อถือ ไม่ใช่การรับประกันเงินกู้',
   'Verification makes the borrower harder to fake. The credit signal still comes from transparent terms, small USDC loans, and repayment behavior over time.':
      'การยืนยันตัวตนทำให้ปลอมเป็นผู้ยืมได้ยากขึ้น แต่สัญญาณด้านเครดิตยังมาจากเงื่อนไขที่โปร่งใส เงินกู้ USDC จำนวนเล็กน้อย และพฤติกรรมการชำระคืนในระยะยาว',
   'World ID helps confirm one real person behind each borrower account.': 'World ID ช่วยยืนยันว่ามีคนจริงหนึ่งคนอยู่เบื้องหลังบัญชีผู้ยืมแต่ละบัญชี',
   'Moodeng can show verification status without storing passport-style documents.': 'Moodeng แสดงสถานะการยืนยันตัวตนได้ โดยไม่ต้องจัดเก็บเอกสารอย่างหนังสือเดินทาง',
   'Lenders still evaluate loan terms, history, and repayment behavior before funding.': 'ผู้ให้กู้ยังคงพิจารณาเงื่อนไขเงินกู้ ประวัติ และพฤติกรรมการชำระคืนก่อนปล่อยกู้',
   'World ID first': 'เริ่มจาก World ID',

   // src/views/lenderBenefits/sections/Web3WalletSection.tsx
   'Our solution': 'ทางออกของเรา',
   'Credit history that can move with a wallet.': 'ประวัติเครดิตที่ติดตัวไปกับกระเป๋าเงิน',
   'Moodeng turns small, transparent repayments into a portable credit record borrowers can keep building, even while working abroad.':
      'Moodeng เปลี่ยนการชำระคืนจำนวนเล็กน้อยที่โปร่งใสให้เป็นประวัติเครดิตที่พกพาได้ ผู้ยืมจึงสร้างต่อยอดได้เรื่อย ๆ แม้ทำงานอยู่ต่างแดน',
   'Portable wallet history': 'ประวัติที่ติดไปกับกระเป๋าเงิน',
   'Repayment activity can travel with overseas workers through their wallet.': 'ประวัติการชำระคืนติดตัวแรงงานในต่างแดนไปได้ผ่านกระเป๋าเงินของพวกเขา',
   'Transparent loan behavior': 'พฤติกรรมการกู้ที่โปร่งใส',
   'Lenders can review onchain repayment signals instead of starting from zero.': 'ผู้ให้กู้ดูสัญญาณการชำระคืนแบบออนเชนได้ แทนที่จะต้องเริ่มจากศูนย์',
   'Small loans, real signal': 'เงินกู้เล็ก สัญญาณจริง',
   'Microloans create a practical path for borrowers to build proof over time.': 'สินเชื่อรายย่อยเป็นเส้นทางที่ใช้ได้จริง ให้ผู้ยืมสร้างหลักฐานความน่าเชื่อถือได้ทีละขั้น',
   'Moodeng Credit wallet illustration': 'ภาพประกอบกระเป๋าเงิน Moodeng Credit'
};
