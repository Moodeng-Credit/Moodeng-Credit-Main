// Thai translations for the public landing, about and benefits pages, keyed by the exact
// English text. Loaded on demand with the rest of this locale's coverage (see ./index.ts).
export const thaiCoverageLanding: Record<string, string> = {
   // src/components/marketing/MarketingPageShell.tsx
   'Toggle benefits menu': 'เปิด/ปิดเมนู',

   // src/views/borrowerBenefits/BorrowerBenefits.tsx
   'Borrower Benefits | Moodeng Credit': 'ประโยชน์สำหรับผู้ยืม | Moodeng Credit',

   // src/views/borrowerBenefits/sections/HeroSection.tsx
   // Rendered as "<b>Moodeng</b> connects ..."; the text node keeps its own leading space.
   'connects borrowers directly with people willing to lend. There is no escrow desk and no middle-man setting the rules: you request, a lender funds, and your repayment record grows from there.':
      'เชื่อมผู้ยืมเข้ากับผู้ที่พร้อมให้กู้โดยตรง ไม่มีโต๊ะ escrow และไม่มีคนกลางคอยตั้งกฎ คุณส่งคำขอ ผู้ให้กู้ปล่อยกู้ แล้วประวัติการชำระคืนของคุณก็จะเติบโตต่อจากตรงนั้น',

   // src/views/borrowerBenefits/sections/FastGlobalAccessSection.tsx
   'Funded in your wallet': 'รับเงินเข้ากระเป๋าเงินของคุณ',

   // src/views/borrowerBenefits/sections/OurMissionSection.tsx
   // Rendered as "By using <b>Moodeng</b>, you're building ...".
   'By using': 'เมื่อใช้',
   ", you're building a fairer financial world. Say goodbye to predatory apps that overcharge. We're restoring trust in personal finance, one transaction at a time.":
      ' คุณก็กำลังร่วมสร้างโลกการเงินที่เป็นธรรมมากขึ้น บอกลาแอปเงินกู้ที่เอาเปรียบและคิดค่าบริการเกินจริง เรากำลังฟื้นความเชื่อมั่นในการเงินส่วนบุคคล ทีละธุรกรรม',

   // src/views/lenderBenefits/config/lendingIncentivesConfig.ts
   'Back real requests with USDC': 'สนับสนุนคำขอจริงด้วย USDC',
   'Every request is settled in USDC, so terms stay simple.': 'ทุกคำขอชำระกันเป็น USDC เงื่อนไขจึงเรียบง่าย',
   'Borrowers set the repayment offer before posting.': 'ผู้ยืมกำหนดข้อเสนอการชำระคืนเองก่อนโพสต์คำขอ',
   'You review the story, timeline, and return before choosing to help.': 'คุณดูเรื่องราว ระยะเวลา และผลตอบแทนได้ก่อนตัดสินใจช่วย',
   'Flexible Investment Strategy': 'กลยุทธ์การลงทุนที่ยืดหยุ่น',
   'Get Tokens called:': 'รับโทเคนที่ชื่อว่า',
   'Get up to 25 IOU tokens for lending to first-time borrowers, plus 1 IOU token for every $1 lent!':
      'รับสูงสุด 25 โทเคน IOU เมื่อปล่อยกู้ให้ผู้ยืมครั้งแรก และรับเพิ่ม 1 โทเคน IOU ทุก $1 ที่ปล่อยกู้!',
   'Lend to 2nd-time borrowers, get 20 IOU tokens, etc.': 'ปล่อยกู้ให้ผู้ยืมที่ยืมเป็นครั้งที่ 2 รับ 20 โทเคน IOU และอื่น ๆ',
   'Lend 5 times, be invited to the Moodeng Credit DAO.': 'ปล่อยกู้ครบ 5 ครั้ง รับคำเชิญเข้าร่วม Moodeng Credit DAO',
   'These show as IOU points for now. When the airdrop happens, those points help determine token rewards.':
      'ตอนนี้จะแสดงเป็นแต้ม IOU ไปก่อน เมื่อมีการแจก airdrop แต้มเหล่านี้จะช่วยกำหนดรางวัลโทเคนที่คุณได้รับ',
   'Read IOU docs': 'อ่านเอกสาร IOU',
   'IOU Tokens': 'โทเคน IOU',
   'Focused Social Impact': 'สร้างผลลัพธ์ต่อสังคมอย่างตรงจุด',
   'You can fund people worldwide to access what they need for their businesses and communities, creating lasting impact where it matters most.':
      'คุณปล่อยกู้ให้ผู้คนทั่วโลกได้ เพื่อให้พวกเขาได้สิ่งที่จำเป็นต่อธุรกิจและชุมชน และสร้างผลลัพธ์ที่ยั่งยืนในที่ที่สำคัญที่สุด',
   'Social Impact': 'ผลลัพธ์ต่อสังคม',

   // src/views/lenderBenefits/config/mostNeededConfig.ts
   // Card headings render as "{mainNumber} {subtitle}", e.g. "First market", "SEA abroad", "Small steps".
   'first corridor': 'เส้นทางแรก',
   'Overseas Filipino workers': 'แรงงานฟิลิปปินส์ในต่างแดน',
   First: 'อันดับแรก',
   market: 'ที่เราเริ่ม',
   'Working abroad': 'ทำงานในต่างแดน',
   'Filipinos and Southeast Asians often earn away from home in Korea, Taiwan, Japan, Singapore, and beyond.':
      'ชาวฟิลิปปินส์และชาวเอเชียตะวันออกเฉียงใต้จำนวนมากทำงานไกลบ้าน ทั้งในเกาหลี ไต้หวัน ญี่ปุ่น สิงคโปร์ และที่อื่น ๆ',
   'Small urgent gaps': 'ความจำเป็นเร่งด่วนเล็ก ๆ',
   'A loan may be for a bill, transport, family support, or a short emergency before payday.':
      'เงินกู้อาจใช้จ่ายค่าบิล ค่าเดินทาง ส่งให้ครอบครัว หรือเหตุฉุกเฉินสั้น ๆ ก่อนเงินเดือนออก',
   'Credit does not follow': 'เครดิตไม่ติดตัวไปด้วย',
   'Repayment discipline abroad rarely becomes a portable credit record they can use later.':
      'วินัยการชำระคืนในต่างแดนแทบไม่เคยกลายเป็นประวัติเครดิตที่พกติดตัวไปใช้ต่อได้',
   'What lenders fund': 'สิ่งที่ผู้ให้กู้ปล่อยกู้',
   'Small amounts with transparent borrower-proposed terms.': 'จำนวนเงินไม่มาก พร้อมเงื่อนไขโปร่งใสที่ผู้ยืมเสนอเอง',
   'Real repayment history': 'ประวัติการชำระคืนจริง',
   'Each repayment helps create a record the borrower can keep building.': 'การชำระคืนแต่ละครั้งช่วยสร้างประวัติที่ผู้ยืมต่อยอดได้เรื่อย ๆ',
   abroad: 'ในต่างแดน',
   'Orb-ready corridors': 'เส้นทางที่มี Orb พร้อมให้บริการ',
   'World ID access first': 'เริ่มจากพื้นที่ที่ใช้ World ID ได้',
   'We focus where borrowers can verify with World ID through nearby Orb locations.':
      'เราโฟกัสพื้นที่ที่ผู้ยืมยืนยันตัวตนด้วย World ID ได้ผ่านจุดให้บริการ Orb ใกล้บ้าน',
   'Early borrower communities are likely to be in East and Southeast Asian worker hubs.':
      'ชุมชนผู้ยืมกลุ่มแรกน่าจะอยู่ในศูนย์กลางแรงงานของเอเชียตะวันออกและเอเชียตะวันออกเฉียงใต้',
   'Singapore and beyond': 'สิงคโปร์และที่อื่น ๆ',
   'Orb availability helps us start with users who can prove they are unique, real borrowers.':
      'การมี Orb ให้บริการช่วยให้เราเริ่มต้นกับผู้ใช้ที่พิสูจน์ได้ว่าเป็นผู้ยืมตัวจริงและไม่ซ้ำกับใคร',
   'Why this matters': 'ทำไมเรื่องนี้จึงสำคัญ',
   'Lower trust friction': 'สร้างความไว้วางใจได้ง่ายขึ้น',
   'Verification helps lenders evaluate people they have never met.': 'การยืนยันตัวตนช่วยให้ผู้ให้กู้ประเมินคนที่ไม่เคยพบหน้ากันได้',
   'Better than quick-loan apps': 'ดีกว่าแอปเงินกู้ด่วน',
   'Transparent loans can help borrowers avoid predatory emergency options.':
      'เงินกู้ที่โปร่งใสช่วยให้ผู้ยืมไม่ต้องพึ่งทางเลือกฉุกเฉินที่เอาเปรียบ',
   'small emergency loans': 'เงินกู้ฉุกเฉินจำนวนเล็กน้อย',
   'Portable credit builders': 'ผู้สร้างเครดิตที่พกติดตัวได้',
   Small: 'เล็ก ๆ',
   steps: 'ทีละขั้น',
   'Not huge money': 'ไม่ใช่เงินก้อนใหญ่',
   'The first loans are intentionally small, useful, and easier to repay responsibly.':
      'เงินกู้ครั้งแรก ๆ ตั้งใจให้มีขนาดเล็ก ใช้ประโยชน์ได้จริง และชำระคืนอย่างรับผิดชอบได้ง่ายกว่า',
   'Emergency plus progress': 'แก้ปัญหาฉุกเฉินไปพร้อมกับก้าวหน้า',
   'A borrower can solve a near-term problem while building a repayment record.':
      'ผู้ยืมแก้ปัญหาเฉพาะหน้าได้ ขณะเดียวกันก็สร้างประวัติการชำระคืนไปด้วย',
   'Independent credit': 'เครดิตที่เป็นของตัวเอง',
   'The long-term goal is credit the borrower owns, not a score trapped in one country.':
      'เป้าหมายระยะยาวคือเครดิตที่ผู้ยืมเป็นเจ้าของเอง ไม่ใช่คะแนนที่ติดอยู่ในประเทศเดียว',
   'Lender upside': 'ประโยชน์สำหรับผู้ให้กู้',
   'Fund useful moments': 'ปล่อยกู้ในจังหวะที่มีความหมาย',
   'Support real needs without pretending every loan is life-changing.':
      'ช่วยตอบความต้องการจริง โดยไม่ต้องทำเหมือนว่าเงินกู้ทุกก้อนจะเปลี่ยนชีวิต',
   'Back repeat borrowers': 'สนับสนุนผู้ยืมที่กลับมาอีก',
   'Good repayment can become a signal for better future access.': 'การชำระคืนที่ดีเป็นสัญญาณที่ช่วยให้เข้าถึงเงินกู้ได้ดีขึ้นในอนาคต',

   // src/views/lenderBenefits/sections/HowWeVerifySection.tsx
   'Unique person': 'คนจริง ไม่ซ้ำใคร',

   // src/views/lenderBenefits/config/verifyStatsConfig.ts
   'World ID verified': 'ยืนยันด้วย World ID แล้ว',
   'Real-person signal': 'สัญญาณว่าเป็นคนจริง',
   'Borrowers prove they are a unique human through World ID before they can request funding.':
      'ผู้ยืมต้องพิสูจน์ผ่าน World ID ว่าเป็นมนุษย์จริงที่ไม่ซ้ำกับใคร ก่อนจึงจะขอเงินกู้ได้',
   'Orb-first markets': 'ตลาดที่เริ่มจาก Orb',
   'SEA worker corridors': 'เส้นทางแรงงานเอเชียตะวันออกเฉียงใต้',
   'We start where Orb access is practical, including South Korea, Taiwan, Japan, Singapore, and nearby hubs.':
      'เราเริ่มจากพื้นที่ที่เข้าถึง Orb ได้สะดวก เช่น เกาหลีใต้ ไต้หวัน ญี่ปุ่น สิงคโปร์ และศูนย์กลางใกล้เคียง',
   'One borrower record': 'หนึ่งผู้ยืม หนึ่งประวัติ',
   'Less repeat-account risk': 'ลดความเสี่ยงจากการเปิดบัญชีซ้ำ',
   'A verified borrower can build repayment history around one account instead of restarting with every new loan.':
      'ผู้ยืมที่ยืนยันตัวตนแล้วสร้างประวัติการชำระคืนในบัญชีเดียวได้ ไม่ต้องเริ่มใหม่ทุกครั้งที่กู้',

   // src/views/lenderBenefits/config/featuresConfig.ts
   'Anonymous Lending': 'ปล่อยกู้แบบไม่เปิดเผยตัวตน',
   'Wallet-based lending with usernames keeps your real identity private.':
      'การปล่อยกู้ผ่านกระเป๋าเงินและชื่อผู้ใช้ช่วยให้ตัวตนจริงของคุณเป็นความลับ',
   'No Fees for Lenders, Ever': 'ผู้ให้กู้ไม่มีค่าธรรมเนียม ตลอดไป',
   "Unlike other platforms, we don't charge lenders any commissions or monthly fees.":
      'ต่างจากแพลตฟอร์มอื่น เราไม่เก็บค่าคอมมิชชันหรือค่าธรรมเนียมรายเดือนจากผู้ให้กู้',
   'Advanced Security': 'ความปลอดภัยขั้นสูง',
   'Protection against VPN-users, scammers, and other malicious actors.': 'ป้องกันผู้ใช้ VPN มิจฉาชีพ และผู้ไม่หวังดีอื่น ๆ',
   'Borrower Transaction History 100% Transparent': 'ประวัติธุรกรรมของผู้ยืมโปร่งใส 100%',
   'See all past and current loans that borrowers have.': 'ดูเงินกู้ทั้งหมดของผู้ยืม ทั้งที่ผ่านมาและที่ยังดำเนินอยู่',
   'Recurring Verification to Prove Borrower is Real': 'ยืนยันตัวตนซ้ำเป็นระยะ เพื่อพิสูจน์ว่าผู้ยืมเป็นคนจริง',
   'Unlike Tradfi apps where accounts are borrowed/shared/sold to family/friends, here there is constant verification of the borrower.':
      'ต่างจากแอปการเงินแบบดั้งเดิมที่บัญชีอาจถูกยืม แชร์ หรือขายต่อให้ครอบครัวและเพื่อน ที่นี่มีการยืนยันตัวตนผู้ยืมอย่างต่อเนื่อง',
   'Data Protected': 'ปกป้องข้อมูล',
   'Web3 wallet-based lending ensures privacy: Your identity stays secure. No cookies, data selling, or spam. Just anonymous transactions.':
      'การปล่อยกู้ผ่านกระเป๋าเงิน Web3 ช่วยรักษาความเป็นส่วนตัว ตัวตนของคุณปลอดภัย ไม่มีคุกกี้ ไม่มีการขายข้อมูล และไม่มีสแปม มีแค่ธุรกรรมแบบไม่เปิดเผยตัวตน',
   // src/views/lenderBenefits (verification copy corrected to ID + selfie / World ID)
   'Identity verified': 'ยืนยันตัวตนแล้ว',
   'Borrowers pass a quick ID + selfie check, or verify with World ID, before they can request funding.':
      'ผู้ยืมต้องผ่านการตรวจบัตรประชาชนและเซลฟี่อย่างรวดเร็ว หรือยืนยันด้วย World ID ก่อนจึงจะขอรับเงินกู้ได้',
   'Worker hubs first': 'เริ่มจากศูนย์กลางแรงงาน',
   'We start with overseas worker hubs, including South Korea, Taiwan, Japan, Singapore, and nearby cities.':
      'เราเริ่มจากศูนย์กลางแรงงานในต่างแดน เช่น เกาหลีใต้ ไต้หวัน ญี่ปุ่น สิงคโปร์ และเมืองใกล้เคียง',
   'Worker corridors': 'เส้นทางแรงงาน',
   'Verified borrowers first': 'ผู้ยืมที่ยืนยันตัวตนแล้วมาก่อน',
   'Every borrower completes a one-time identity check before requesting a loan.': 'ผู้ยืมทุกคนต้องยืนยันตัวตนหนึ่งครั้งก่อนขอเงินกู้',
   'Identity checks help us start with users who can prove they are unique, real borrowers.':
      'การยืนยันตัวตนช่วยให้เราเริ่มต้นกับผู้ใช้ที่พิสูจน์ได้ว่าเป็นผู้ยืมตัวจริงและไม่ซ้ำกัน',
   'Identity verification helps confirm one real person behind each borrower account.':
      'การยืนยันตัวตนช่วยยืนยันว่ามีคนจริงเพียงหนึ่งคนอยู่เบื้องหลังบัญชีผู้ยืมแต่ละบัญชี',
   'Verification is a trust signal, not a loan guarantee.': 'การยืนยันตัวตนคือสัญญาณความน่าเชื่อถือ ไม่ใช่การรับประกันเงินกู้',
   'Verified first': 'ยืนยันตัวตนก่อน',
   'Borrowers complete a quick ID + selfie check, or verify with World ID, before they can request loans. That gives lenders a real-person signal, and the ID is checked by our verification partner, never stored by Moodeng.':
      'ผู้ยืมต้องผ่านการตรวจบัตรประชาชนและเซลฟี่อย่างรวดเร็ว หรือยืนยันด้วย World ID ก่อนจึงจะขอเงินกู้ได้ ผู้ให้กู้จึงมั่นใจได้ว่าเป็นคนจริง โดยบัตรจะได้รับการตรวจสอบจากพาร์ทเนอร์ด้านการยืนยันตัวตนของเรา และ Moodeng จะไม่จัดเก็บไว้',
   'Borrowers who already use World App can verify with World ID instead of the ID + selfie check.':
      'ผู้ยืมที่ใช้ World App อยู่แล้วสามารถยืนยันด้วย World ID แทนการตรวจบัตรประชาชนและเซลฟี่ได้',
   'We are starting with Filipinos and Southeast Asians working overseas. Small loans can cover urgent gaps and help borrowers build credit independently.':
      'เราเริ่มต้นกับชาวฟิลิปปินส์และชาวเอเชียตะวันออกเฉียงใต้ที่ทำงานในต่างประเทศ เงินกู้ขนาดเล็กช่วยอุดช่องว่างเมื่อจำเป็นเร่งด่วน และช่วยให้ผู้ยืมสร้างเครดิตได้ด้วยตัวเอง',
   'We are starting with workers and migrants in hubs such as South Korea, Taiwan, Japan, Singapore, and other nearby cities.':
      'เราเริ่มต้นกับแรงงานและผู้ย้ายถิ่นในศูนย์กลางอย่างเกาหลีใต้ ไต้หวัน ญี่ปุ่น สิงคโปร์ และเมืองใกล้เคียงอื่น ๆ',
   'ID verified': 'ยืนยันบัตรแล้ว'
};
