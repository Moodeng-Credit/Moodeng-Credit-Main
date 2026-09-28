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
   'Moodeng Credit wallet illustration': 'ภาพประกอบกระเป๋าเงิน Moodeng Credit',

   // src/views/onboarding/WalletFaceCheck.tsx
   "We couldn't finish creating your wallet. Please try again.": 'Kami belum berhasil membuat dompet kamu. Silakan coba lagi.',
   'Could not start the face check. Please try again.': 'Tidak bisa memulai cek wajah. Silakan coba lagi.',
   'Quick face check': 'Cek wajah singkat',
   'A short liveness scan keeps Instant Wallets to one per person, which is what lets us cover the network fees. We never store your photo, and it is only needed to create the wallet — not to sign in, send or repay.':
      'Pemindaian liveness singkat memastikan setiap orang hanya punya satu Instant Wallet, dan karena itulah kami bisa menanggung biaya jaringan. Kami tidak pernah menyimpan fotomu, dan pemindaian ini hanya diperlukan untuk membuat dompet — bukan untuk masuk, mengirim, atau membayar kembali.',
   'Try the scan again': 'Coba pindai lagi',
   'Connect a wallet instead': 'Hubungkan dompet lain saja',
   'Creating your wallet': 'Membuat dompet kamu',
   'This takes a few seconds. Keep this screen open.': 'Ini butuh beberapa detik. Jangan tutup layar ini.',
   'Still checking': 'Masih memeriksa',
   'This is taking longer than usual. Your scan is safe — check again in a moment.':
      'Prosesnya lebih lama dari biasanya. Hasil pindaianmu aman — cek lagi sebentar lagi.',
   'Start a new scan': 'Mulai pindai baru',
   'One quick face check': 'Satu cek wajah singkat',
   'Instant Wallets are one per person, so we ask for a ten-second scan before creating yours. You will not need it again.':
      'Setiap orang hanya bisa punya satu Instant Wallet, jadi kami minta pemindaian sepuluh detik sebelum membuat dompetmu. Kamu tidak perlu melakukannya lagi.',
   'Starting…': 'Memulai…',
   'Start face check': 'Mulai cek wajah',
   'Connect a wallet I already own': 'Hubungkan dompet yang sudah saya punya',

   // src/views/onboarding/Welcome.tsx (the id copy block renders for id; this English title is a fallback)
   Onboarding: 'Mulai',

   // src/views/onboarding/walletPickerOptions.tsx
   'Top Pick': 'Pilihan utama',
   'Zero fees': 'Tanpa biaya',
   'Best for beginners': 'Terbaik untuk pemula',
   'Sleek UI': 'Tampilan rapi',
   'Simple & secure': 'Simpel & aman',
   Popular: 'Populer',
   Universal: 'Universal',
   'Widely Used': 'Banyak dipakai',

   // src/views/profile/components/Calendar.tsx
   'Loan Insights': 'Wawasan pinjaman',

   // src/views/profile/components/Card.tsx
   'You Funded': 'Kamu mendanai',
   'Due on': 'Jatuh tempo',
   'Fully Repaid': 'Lunas',
   'Repayment Progress': 'Progres pembayaran kembali',
   'Remaining for Complete Payback': 'lagi hingga lunas',
   'Borrow Insight': 'Detail peminjam',
   'posted on': 'diposting pada',
   'Waiting for Funding': 'Menunggu pendanaan',
   Asking: 'Diminta',
   'Delete Loan Request?': 'Hapus permintaan pinjaman?',
   'Are you sure you want to delete this loan request? This action cannot be undone.':
      'Yakin mau menghapus permintaan pinjaman ini? Tindakan ini tidak bisa dibatalkan.',
   'Delete Request': 'Hapus permintaan',

   // src/views/profile/components/navigation/MobileNav.tsx
   'Toggle menu': 'Buka/tutup menu',

   // src/views/profile/components/navigation/Sidebar.tsx
   'View more': 'Lihat selengkapnya',
   Menu: 'Menu',
สะสม',
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
   'Your reputation milestones will appear here as you repay loans on time.': 'หมุดหมายความน่าเชื่อถือของคุณจะแสดงที่นี่เมื่อคุณชำระคืนเงินกู้ตรงเวลา',

   // src/views/onboarding/Congratulations.tsx
   'Moodeng celebrating': 'Moodeng กำลังฉลอง',
   'Moodeng community hippo': 'ฮิปโปชุมชน Moodeng',

   // src/views/onboarding/ConnectWallet.tsx
   'Create your Instant Wallet': 'สร้าง Instant Wallet ของคุณ',
   'Your loan lands here — created from your Moodeng login, no app needed. Earn Pandesal points too.':
      'เงินกู้ของคุณจะเข้ามาที่นี่ สร้างจากบัญชีที่ใช้เข้าสู่ระบบ Moodeng โดยไม่ต้องติดตั้งแอป และยังได้รับแต้ม Pandesal ด้วย',
   'Setting up your wallet — this takes a few seconds. Keep this screen open.': 'กำลังตั้งค่ากระเป๋าเงินของคุณ ใช้เวลาเพียงไม่กี่วินาที โปรดเปิดหน้านี้ค้างไว้',
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
   'This is taking longer than usual. Your scan is safe — check again in a moment.': 'ขั้นตอนนี้ใช้เวลานานกว่าปกติ ผลการสแกนของคุณยังปลอดภัยอยู่ โปรดตรวจสอบอีกครั้งในอีกสักครู่',
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
   'Are you sure you want to delete this loan request? This action cannot be undone.': 'คุณแน่ใจหรือไม่ว่าต้องการลบคำขอเงินกู้นี้? การดำเนินการนี้ย้อนกลับไม่ได้',
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
   'This information will be shown publicly so be careful what information you provide': 'ข้อมูลนี้จะแสดงต่อสาธารณะ โปรดระมัดระวังข้อมูลที่คุณให้',
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
   'Your repayment activity will appear here once a lender funds your first loan.': 'กิจกรรมการชำระคืนของคุณจะแสดงที่นี่เมื่อผู้ให้กู้ปล่อยกู้ครั้งแรกให้คุณ',
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
   'Recommended · lowest fees · buy USDC with PHP, cash out to bank or GCash': 'แนะนำ · ค่าธรรมเนียมต่ำสุด · ซื้อ USDC ด้วยเงินเปโซ ถอนเข้าบัญชีธนาคารหรือ GCash ได้',
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
   "— and works the same whether you're in the Philippines or traveling.": '— และใช้งานได้เหมือนกันไม่ว่าคุณจะอยู่ในฟิลิปปินส์หรือกำลังเดินทาง',
   'is also available under "Other options".': 'ก็มีให้เลือกใน "ตัวเลือกอื่น"',
   'Fewer options': 'ตัวเลือกน้อยลง',
   'Other options': 'ตัวเลือกอื่น',
   'You can repay from a wallet, an exchange, a P2P platform, or a local crypto service — whatever is available in your country.':
      'คุณชำระคืนได้จากกระเป๋าเงิน แพลตฟอร์มแลกเปลี่ยนคริปโต แพลตฟอร์ม P2P หรือบริการคริปโตในประเทศ แล้วแต่ว่าในประเทศของคุณมีช่องทางใด',
   "This is the same wallet your loan was sent to. Copy it — you'll paste it into": 'นี่คือกระเป๋าเงินเดียวกับที่ใช้รับเงินกู้ของคุณ คัดลอกไว้แล้วนำไปวางใน',
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
};
