// Vietnamese translations for the public landing, about and benefits pages, keyed by the exact
// English text. Loaded on demand with the rest of this locale's coverage (see ./index.ts).
export const vietnameseCoverageLanding: Record<string, string> = {
   // src/views/borrowerBenefits/BorrowerBenefits.tsx
   'Borrower Benefits | Moodeng Credit': 'Lợi ích cho người vay | Moodeng Credit',

   // src/views/borrowerBenefits/sections/HeroSection.tsx
   // Rendered as "<b>Moodeng</b> connects ..."; the text node keeps its own leading space.
   'connects borrowers directly with people willing to lend. There is no escrow desk and no middle-man setting the rules: you request, a lender funds, and your repayment record grows from there.':
      'kết nối trực tiếp người vay với những người sẵn sàng cho vay. Không có bàn ký quỹ, không có bên trung gian đặt luật: bạn gửi yêu cầu, người cho vay cấp vốn, và hồ sơ trả nợ của bạn lớn dần từ đó.',

   // src/views/borrowerBenefits/sections/FastGlobalAccessSection.tsx
   'Why borrowing feels different': 'Vì sao vay ở đây lại khác biệt',
   'Funded in your wallet': 'Tiền về thẳng ví của bạn',
   'Terms shown upfront': 'Điều khoản rõ ràng ngay từ đầu',

   // src/views/borrowerBenefits/sections/OurMissionSection.tsx
   // Rendered as "By using <b>Moodeng</b>, you're building ...".
   'By using': 'Khi dùng',
   ", you're building a fairer financial world. Say goodbye to predatory apps that overcharge. We're restoring trust in personal finance, one transaction at a time.":
      ', bạn đang góp phần xây dựng một thế giới tài chính công bằng hơn. Tạm biệt những ứng dụng cho vay cắt cổ, thu phí quá tay. Chúng tôi đang khôi phục niềm tin vào tài chính cá nhân, từng giao dịch một.',

   // src/views/lenderBenefits/config/lendingIncentivesConfig.ts
   'Back real requests with USDC': 'Hỗ trợ những yêu cầu thật bằng USDC',
   'Every request is settled in USDC, so terms stay simple.': 'Mọi yêu cầu đều được thanh toán bằng USDC, nên điều khoản luôn đơn giản.',
   'Borrowers set the repayment offer before posting.': 'Người vay tự đặt mức trả nợ trước khi đăng yêu cầu.',
   'You review the story, timeline, and return before choosing to help.':
      'Bạn xem câu chuyện, thời hạn và lợi nhuận trước khi quyết định giúp đỡ.',
   'Flexible Investment Strategy': 'Chiến lược đầu tư linh hoạt',
   'Get Tokens called:': 'Nhận token có tên:',
   'Get up to 25 IOU tokens for lending to first-time borrowers, plus 1 IOU token for every $1 lent!':
      'Nhận tối đa 25 token IOU khi cho người vay lần đầu vay, cộng thêm 1 token IOU cho mỗi $1 bạn cho vay!',
   'Lend to 2nd-time borrowers, get 20 IOU tokens, etc.': 'Cho người vay lần thứ 2 vay, nhận 20 token IOU, v.v.',
   'Lend 5 times, be invited to the Moodeng Credit DAO.': 'Cho vay 5 lần để được mời vào Moodeng Credit DAO.',
   'These show as IOU points for now. When the airdrop happens, those points help determine token rewards.':
      'Hiện tại, chúng được hiển thị dưới dạng điểm IOU. Khi đợt airdrop diễn ra, số điểm này sẽ góp phần quyết định phần thưởng token.',
   'Read IOU docs': 'Đọc tài liệu IOU',
   'IOU Tokens': 'Token IOU',
   'Focused Social Impact': 'Tác động xã hội đúng chỗ',
   'You can fund people worldwide to access what they need for their businesses and communities, creating lasting impact where it matters most.':
      'Bạn có thể cấp vốn cho mọi người trên khắp thế giới để họ có được những gì cần cho công việc kinh doanh và cộng đồng của mình, tạo ra tác động lâu dài ở nơi cần nhất.',
   'Social Impact': 'Tác động xã hội',

   // src/views/lenderBenefits/config/mostNeededConfig.ts
   // Card headings render as "{mainNumber} {subtitle}". Vietnamese puts the adjective after the
   // noun, so "First" + "market" is rendered as "Thị trường" + "đầu tiên". "First" is only used
   // on this card.
   'first corridor': 'tuyến đầu tiên',
   'Overseas Filipino workers': 'Lao động Philippines ở nước ngoài',
   First: 'Thị trường',
   market: 'đầu tiên',
   'Working abroad': 'Làm việc ở nước ngoài',
   'Filipinos and Southeast Asians often earn away from home in Korea, Taiwan, Japan, Singapore, and beyond.':
      'Người Philippines và người Đông Nam Á thường làm việc xa quê ở Hàn Quốc, Đài Loan, Nhật Bản, Singapore và nhiều nơi khác.',
   'Small urgent gaps': 'Những khoản thiếu hụt nhỏ, cấp bách',
   'A loan may be for a bill, transport, family support, or a short emergency before payday.':
      'Khoản vay có thể dùng để trả hóa đơn, đi lại, gửi về cho gia đình hoặc lo việc gấp trước ngày lĩnh lương.',
   'Credit does not follow': 'Tín dụng không theo họ',
   'Repayment discipline abroad rarely becomes a portable credit record they can use later.':
      'Việc trả nợ đều đặn ở nước ngoài hiếm khi trở thành hồ sơ tín dụng mà họ mang theo và dùng lại được sau này.',
   'What lenders fund': 'Người cho vay cấp vốn cho gì',
   'Small amounts with transparent borrower-proposed terms.': 'Số tiền nhỏ, với điều khoản minh bạch do người vay đề xuất.',
   'Real repayment history': 'Lịch sử trả nợ thật',
   'Each repayment helps create a record the borrower can keep building.':
      'Mỗi lần trả nợ giúp tạo nên hồ sơ mà người vay có thể tiếp tục xây dựng.',
   abroad: 'ở nước ngoài',
   'Orb-ready corridors': 'Những tuyến đã có Orb',
   'World ID access first': 'Ưu tiên nơi dùng được World ID',
   'We focus where borrowers can verify with World ID through nearby Orb locations.':
      'Chúng tôi tập trung vào những nơi người vay có thể xác minh bằng World ID tại các điểm Orb gần đó.',
   'Early borrower communities are likely to be in East and Southeast Asian worker hubs.':
      'Những cộng đồng người vay đầu tiên nhiều khả năng sẽ ở các trung tâm lao động tại Đông Á và Đông Nam Á.',
   'Singapore and beyond': 'Singapore và nhiều nơi khác',
   'Orb availability helps us start with users who can prove they are unique, real borrowers.':
      'Nhờ có Orb, chúng tôi có thể bắt đầu với những người dùng chứng minh được mình là người vay thật và không trùng lặp.',
   'Why this matters': 'Vì sao điều này quan trọng',
   'Lower trust friction': 'Dễ tin nhau hơn',
   'Verification helps lenders evaluate people they have never met.': 'Xác minh giúp người cho vay đánh giá những người họ chưa từng gặp.',
   'Better than quick-loan apps': 'Tốt hơn ứng dụng vay nhanh',
   'Transparent loans can help borrowers avoid predatory emergency options.':
      'Khoản vay minh bạch giúp người vay tránh những lựa chọn cho vay nặng lãi lúc khẩn cấp.',
   'small emergency loans': 'khoản vay khẩn cấp nhỏ',
   'Portable credit builders': 'Người xây dựng tín dụng mang theo được',
   Small: 'Nhỏ',
   steps: 'mà chắc',
   'Not huge money': 'Không phải số tiền lớn',
   'The first loans are intentionally small, useful, and easier to repay responsibly.':
      'Những khoản vay đầu tiên được cố ý giữ ở mức nhỏ, thiết thực và dễ trả nợ có trách nhiệm hơn.',
   'Emergency plus progress': 'Vừa lo việc gấp, vừa tiến bộ',
   'A borrower can solve a near-term problem while building a repayment record.':
      'Người vay có thể giải quyết việc trước mắt, đồng thời xây dựng hồ sơ trả nợ.',
   'Independent credit': 'Tín dụng độc lập',
   'The long-term goal is credit the borrower owns, not a score trapped in one country.':
      'Mục tiêu lâu dài là tín dụng thuộc về chính người vay, không phải một điểm số bị kẹt ở một quốc gia.',
   'Lender upside': 'Lợi ích cho người cho vay',
   'Fund useful moments': 'Cấp vốn cho những lúc thật sự cần',
   'Support real needs without pretending every loan is life-changing.':
      'Hỗ trợ nhu cầu thật mà không cần tô vẽ rằng khoản vay nào cũng thay đổi cuộc đời.',
   'Back repeat borrowers': 'Đồng hành cùng người vay quay lại',
   'Good repayment can become a signal for better future access.': 'Trả nợ tốt có thể trở thành tín hiệu để được tiếp cận tốt hơn về sau.',

   // src/views/lenderBenefits/sections/HowWeVerifySection.tsx
   'Unique person': 'Người thật, không trùng lặp',
   'Less bot risk': 'Giảm rủi ro bot',

   // src/views/lenderBenefits/config/verifyStatsConfig.ts
   'World ID verified': 'Đã xác minh bằng World ID',
   'Real-person signal': 'Tín hiệu người thật',
   'Borrowers prove they are a unique human through World ID before they can request funding.':
      'Người vay chứng minh mình là người thật, không trùng lặp qua World ID trước khi có thể yêu cầu cấp vốn.',
   'Orb-first markets': 'Thị trường ưu tiên Orb',
   'SEA worker corridors': 'Các tuyến lao động Đông Nam Á',
   'We start where Orb access is practical, including South Korea, Taiwan, Japan, Singapore, and nearby hubs.':
      'Chúng tôi bắt đầu ở những nơi dễ tiếp cận Orb, gồm Hàn Quốc, Đài Loan, Nhật Bản, Singapore và các trung tâm lân cận.',
   'One borrower record': 'Một người vay, một hồ sơ',
   'Less repeat-account risk': 'Giảm rủi ro tài khoản trùng lặp',
   'A verified borrower can build repayment history around one account instead of restarting with every new loan.':
      'Người vay đã xác minh có thể xây dựng lịch sử trả nợ trên một tài khoản, thay vì làm lại từ đầu với mỗi khoản vay mới.',

   // src/views/lenderBenefits/sections/FeaturesSection.tsx, FeatureRow.tsx
   TradFi: 'Truyền thống',

   // src/views/lenderBenefits/config/featuresConfig.ts
   'Anonymous Lending': 'Cho vay ẩn danh',
   'Wallet-based lending with usernames keeps your real identity private.':
      'Cho vay qua ví với tên người dùng giúp giữ kín danh tính thật của bạn.',
   'No Fees for Lenders, Ever': 'Người cho vay không bao giờ mất phí',
   "Unlike other platforms, we don't charge lenders any commissions or monthly fees.":
      'Khác với các nền tảng khác, chúng tôi không thu hoa hồng hay phí hằng tháng của người cho vay.',
   'Advanced Security': 'Bảo mật nâng cao',
   'Protection against VPN-users, scammers, and other malicious actors.':
      'Bảo vệ trước người dùng VPN, kẻ lừa đảo và các đối tượng xấu khác.',
   'Borrower Transaction History 100% Transparent': 'Lịch sử giao dịch của người vay minh bạch 100%',
   'See all past and current loans that borrowers have.': 'Xem tất cả khoản vay trước đây và hiện tại của người vay.',
   'Recurring Verification to Prove Borrower is Real': 'Xác minh định kỳ để chứng minh người vay là người thật',
   'Unlike Tradfi apps where accounts are borrowed/shared/sold to family/friends, here there is constant verification of the borrower.':
      'Khác với ứng dụng tài chính truyền thống, nơi tài khoản có thể bị cho mượn, chia sẻ hoặc bán lại cho người thân và bạn bè, ở đây người vay được xác minh liên tục.',
   'Data Protected': 'Dữ liệu được bảo vệ',
   'Web3 wallet-based lending ensures privacy: Your identity stays secure. No cookies, data selling, or spam. Just anonymous transactions.':
      'Cho vay qua ví Web3 đảm bảo quyền riêng tư: danh tính của bạn luôn an toàn. Không cookie, không bán dữ liệu, không spam. Chỉ có giao dịch ẩn danh.',
   // src/views/lenderBenefits (verification copy corrected to ID + selfie / World ID)
   'Identity verified': 'Đã xác minh danh tính',
   'Borrowers pass a quick ID + selfie check, or verify with World ID, before they can request funding.':
      'Người vay hoàn tất bước kiểm tra giấy tờ tùy thân + ảnh selfie nhanh, hoặc xác minh bằng World ID, trước khi có thể yêu cầu cấp vốn.',
   'Worker hubs first': 'Ưu tiên các trung tâm lao động',
   'We start with overseas worker hubs, including South Korea, Taiwan, Japan, Singapore, and nearby cities.':
      'Chúng tôi bắt đầu từ các trung tâm lao động ở nước ngoài, gồm Hàn Quốc, Đài Loan, Nhật Bản, Singapore và các thành phố lân cận.',
   'Worker corridors': 'Các tuyến lao động',
   'Verified borrowers first': 'Ưu tiên người vay đã xác minh',
   'Every borrower completes a one-time identity check before requesting a loan.':
      'Mỗi người vay đều hoàn tất bước xác minh danh tính một lần trước khi yêu cầu vay.',
   'Identity checks help us start with users who can prove they are unique, real borrowers.':
      'Bước xác minh danh tính giúp chúng tôi bắt đầu với những người dùng chứng minh được mình là người vay thật và không trùng lặp.',
   'Identity verification helps confirm one real person behind each borrower account.':
      'Xác minh danh tính giúp đảm bảo mỗi tài khoản người vay thuộc về đúng một người thật.',
   'Verification is a trust signal, not a loan guarantee.': 'Xác minh là tín hiệu tin cậy, không phải bảo đảm khoản vay.',
   'Verified first': 'Xác minh trước',
   'Borrowers complete a quick ID + selfie check, or verify with World ID, before they can request loans. That gives lenders a real-person signal, and the ID is checked by our verification partner, never stored by Moodeng.':
      'Người vay hoàn tất bước kiểm tra giấy tờ tùy thân + ảnh selfie nhanh, hoặc xác minh bằng World ID, trước khi có thể yêu cầu vay. Nhờ đó người cho vay biết đây là người thật, còn giấy tờ được đối tác xác minh của chúng tôi kiểm tra và Moodeng không bao giờ lưu trữ.',
   'Borrowers who already use World App can verify with World ID instead of the ID + selfie check.':
      'Người vay đã dùng World App có thể xác minh bằng World ID thay cho bước kiểm tra giấy tờ tùy thân + ảnh selfie.',
   'We are starting with Filipinos and Southeast Asians working overseas. Small loans can cover urgent gaps and help borrowers build credit independently.':
      'Chúng tôi bắt đầu với người Philippines và người Đông Nam Á đang làm việc ở nước ngoài. Khoản vay nhỏ có thể giúp những lúc cần tiền gấp và giúp người vay tự xây dựng tín dụng.',
   'We are starting with workers and migrants in hubs such as South Korea, Taiwan, Japan, Singapore, and other nearby cities.':
      'Chúng tôi bắt đầu với người lao động và người di cư tại các trung tâm như Hàn Quốc, Đài Loan, Nhật Bản, Singapore và các thành phố lân cận khác.',
   'ID verified': 'Đã xác minh giấy tờ'
};
