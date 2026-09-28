// Vietnamese translations for on-screen English found by the full-code scan (round two), keyed by
// the exact English text. Loaded on demand with the rest of this locale's coverage (see ./index.ts).
export const vietnameseCoverageF: Record<string, string> = {
   // src/app/account-restricted/page.tsx
   'Repay $': 'Trả nợ $',
   'to continue.': 'để tiếp tục.',

   // src/app/auth/verify-code/page.tsx
   'Resend in': 'Gửi lại sau',

   // src/app/forgot-password/page.tsx
   'A code is already on the way. Enter it below, or request a new one in':
      'Mã đã được gửi đi. Hãy nhập mã bên dưới, hoặc yêu cầu mã mới sau',
   'Resend code in': 'Gửi lại mã sau',

   // src/app/verify/page.tsx
   "We weren't able to verify your identity. Reason:": 'Chúng tôi chưa thể xác minh danh tính của bạn. Lý do:',
   '. A few things that usually fix it:': '. Một vài cách thường giúp khắc phục:',

   // src/components/BasePaymentReconciler.tsx
   'Your $': 'Khoản $',
   'funding just confirmed. Thank you!': 'tiền cấp vốn của bạn vừa được xác nhận. Cảm ơn bạn!',

   // src/components/auth/AuthFooter.tsx
   '© 2026 Moodeng Credit All Rights Reserved': '© 2026 Moodeng Credit. Bảo lưu mọi quyền',

   // src/components/filters/DatePicker.tsx
   Su: 'CN',
   Mo: 'T2',
   Tu: 'T3',
   We: 'T4',
   Th: 'T5',
   Fr: 'T6',
   Sa: 'T7',

   // src/components/mecha/mechaCopy.ts
   Helpful: 'Hữu ích',

   // src/constants/loanOptions.ts
   '0% to 5%': '0% đến 5%',
   '5% to 10%': '5% đến 10%',
   '10% to 20%': '10% đến 20%',
   'Next Week': 'Tuần tới',
   'Next 30 Days': '30 ngày tới',
   'Next 60 Days': '60 ngày tới',
   'After 90 Days+': 'Sau 90 ngày+',
   'Beginner Borrower': 'Người vay mới',

   // src/hooks/useDefaultedBorrowerSupport.ts
   'Unable to check overdue loans.': 'Không thể kiểm tra các khoản vay quá hạn.',

   // src/hooks/useWalletSync.ts
   'Successfully connected to': 'Đã kết nối thành công với',
   'This account is saved to your locked wallet. Switch back to that wallet, or update the saved wallet from Account Settings.':
      'Tài khoản này được gắn với ví đã khóa của bạn. Hãy chuyển lại sang ví đó, hoặc cập nhật ví đã lưu trong Cài đặt tài khoản.',

   // src/lib/loanNotes/api.ts
   'A Moodeng borrower': 'Một người vay trên Moodeng',
   'Failed to record funding': 'Không ghi nhận được khoản cấp vốn',
   'Failed to record purchase': 'Không ghi nhận được giao dịch mua',
   Listed: 'Đang rao bán',
   Sold: 'Đã bán',

   // src/lib/supabase/avatarStorage.ts
   'You must be signed in to upload an avatar.': 'Bạn cần đăng nhập để tải lên ảnh đại diện.',
   'Upload failed:': 'Tải lên không thành công:',

   // src/lib/verificationUiState.ts
   Declined: 'Bị từ chối',
   Blocked: 'Bị chặn',
   'View status': 'Xem trạng thái',
   'View details': 'Xem chi tiết',

   // src/lib/web3/openfort/errors.ts
   'Instant Wallet isn’t available right now. Please try again in a little while.':
      'Instant Wallet hiện chưa sẵn sàng. Vui lòng thử lại sau ít phút.',
   "We couldn't reach the wallet service. Check your internet and try again.":
      'Chúng tôi không kết nối được với dịch vụ ví. Hãy kiểm tra kết nối Internet rồi thử lại.',
   'Please sign in again, then try creating your wallet.': 'Vui lòng đăng nhập lại, rồi thử tạo ví của bạn.',

   // src/lib/withTimeout.ts
   'Wallet did not respond in time': 'Ví không phản hồi kịp thời',

   // src/lib/worldIdVerificationLabel.ts
   'Verified Lender': 'Người cho vay đã xác minh',

   // src/types/loanTypes.ts
   Unpaid: 'Chưa trả',
   Partial: 'Trả một phần',

   // src/views/academy/AcademyGuide.tsx
   'Score 4+ to earn Academy score. Each correct answer is 2 points.':
      'Đúng từ 4 câu trở lên để nhận điểm Học viện. Mỗi câu trả lời đúng được 2 điểm.',
   'You scored 4 of 5. Log in and finish the borrower flow to keep going.':
      'Bạn trả lời đúng 4/5 câu. Đăng nhập và hoàn tất quy trình dành cho người vay để tiếp tục.',
   'You scored 4 of 5. Log in and finish the lender flow to keep going.':
      'Bạn trả lời đúng 4/5 câu. Đăng nhập và hoàn tất quy trình dành cho người cho vay để tiếp tục.',
   'You scored 5 of 5. Log in and finish the borrower flow to keep going.':
      'Bạn trả lời đúng 5/5 câu. Đăng nhập và hoàn tất quy trình dành cho người vay để tiếp tục.',
   'You scored 5 of 5. Log in and finish the lender flow to keep going.':
      'Bạn trả lời đúng 5/5 câu. Đăng nhập và hoàn tất quy trình dành cho người cho vay để tiếp tục.',
   'You scored 0 of 5. Score 4 of 5 to unlock Academy score.': 'Bạn trả lời đúng 0/5 câu. Cần đúng 4/5 câu để mở khóa điểm Học viện.',
   'You scored 1 of 5. Score 4 of 5 to unlock Academy score.': 'Bạn trả lời đúng 1/5 câu. Cần đúng 4/5 câu để mở khóa điểm Học viện.',
   'You scored 2 of 5. Score 4 of 5 to unlock Academy score.': 'Bạn trả lời đúng 2/5 câu. Cần đúng 4/5 câu để mở khóa điểm Học viện.',
   'You scored 3 of 5. Score 4 of 5 to unlock Academy score.': 'Bạn trả lời đúng 3/5 câu. Cần đúng 4/5 câu để mở khóa điểm Học viện.',

   // src/views/academy/moneyGuideTopics.tsx
   'Always repay before the due date — on-time repayment builds your Pandesal points, and repaying a full-limit loan on time unlocks the next Credit Level. And always choose Base as the network.':
      'Luôn trả nợ trước ngày đến hạn — trả đúng hạn giúp bạn tích điểm Pandesal, và trả đúng hạn một khoản vay bằng toàn bộ hạn mức sẽ mở khóa Hạng tín dụng tiếp theo. Và luôn chọn mạng Base.',

   // src/views/account/Account.tsx
   User: 'Người dùng',

   // src/lib/borrowerContextFit.ts
   'First time trusting this community': 'Lần đầu vay trong cộng đồng',
   'Already repaid 1 loan — they follow through': 'Đã trả xong 1 khoản vay — người này nói là làm',
   'Repaid 2 loans and always came back': 'Đã trả xong 2 khoản vay và luôn giữ chữ tín',
   'Repaid 3 loans and always came back': 'Đã trả xong 3 khoản vay và luôn giữ chữ tín',
   'Repaid 4 loans and always came back': 'Đã trả xong 4 khoản vay và luôn giữ chữ tín',
   "loans repaid — one of the community's reliable borrowers":
      'khoản vay đã trả xong — một trong những người vay đáng tin cậy của cộng đồng',
   '· Identity verified': '· Đã xác minh danh tính',
   '· due today': '· đến hạn hôm nay',
   '· due tomorrow': '· đến hạn ngày mai',
   'unclear date': 'chưa rõ ngày',
   'no income shared': 'chưa chia sẻ thu nhập',
   'full-time, mid-month pay': 'toàn thời gian, lương giữa tháng',
   'full-time, end-of-month pay': 'toàn thời gian, lương cuối tháng',
   'full-time, weekly pay': 'toàn thời gian, lương hằng tuần',
   'full-time, irregular pay': 'toàn thời gian, lương không cố định',
   'part-time, mid-month pay': 'bán thời gian, lương giữa tháng',
   'part-time, end-of-month pay': 'bán thời gian, lương cuối tháng',
   'part-time, weekly pay': 'bán thời gian, lương hằng tuần',
   'part-time, irregular pay': 'bán thời gian, lương không cố định',
   'freelance, mid-month pay': 'làm tự do, lương giữa tháng',
   'freelance, end-of-month pay': 'làm tự do, lương cuối tháng',
   'freelance, weekly pay': 'làm tự do, lương hằng tuần',
   'freelance, irregular pay': 'làm tự do, lương không cố định',
   '1-day loan': 'khoản vay 1 ngày',
   '2-day loan': 'khoản vay 2 ngày',
   '3-day loan': 'khoản vay 3 ngày',
   '4-day loan': 'khoản vay 4 ngày',
   '5-day loan': 'khoản vay 5 ngày',
   '6-day loan': 'khoản vay 6 ngày',
   '7-day loan': 'khoản vay 7 ngày',
   '8-day loan': 'khoản vay 8 ngày',
   '9-day loan': 'khoản vay 9 ngày',
   '10-day loan': 'khoản vay 10 ngày',
   '11-day loan': 'khoản vay 11 ngày',
   '12-day loan': 'khoản vay 12 ngày',
   '13-day loan': 'khoản vay 13 ngày',
   '14-day loan': 'khoản vay 14 ngày',
   '15-day loan': 'khoản vay 15 ngày',
   '16-day loan': 'khoản vay 16 ngày',
   '17-day loan': 'khoản vay 17 ngày',
   '18-day loan': 'khoản vay 18 ngày',
   '19-day loan': 'khoản vay 19 ngày',
   '20-day loan': 'khoản vay 20 ngày',
   '21-day loan': 'khoản vay 21 ngày',
   '22-day loan': 'khoản vay 22 ngày',
   '23-day loan': 'khoản vay 23 ngày',
   '24-day loan': 'khoản vay 24 ngày',
   '25-day loan': 'khoản vay 25 ngày',
   '26-day loan': 'khoản vay 26 ngày',
   '27-day loan': 'khoản vay 27 ngày',
   '28-day loan': 'khoản vay 28 ngày',
   '29-day loan': 'khoản vay 29 ngày',
   '30-day loan': 'khoản vay 30 ngày',
   '31-day loan': 'khoản vay 31 ngày',
   '0-day gap': 'lệch 0 ngày',
   '1-day gap': 'lệch 1 ngày',
   '2-day gap': 'lệch 2 ngày',
   '3-day gap': 'lệch 3 ngày',
   '4-day gap': 'lệch 4 ngày',
   '5-day gap': 'lệch 5 ngày',
   '6-day gap': 'lệch 6 ngày',
   '7-day gap': 'lệch 7 ngày',
   '8-day gap': 'lệch 8 ngày',
   '9-day gap': 'lệch 9 ngày',
   '10-day gap': 'lệch 10 ngày',
   '11-day gap': 'lệch 11 ngày',
   '12-day gap': 'lệch 12 ngày',
   '13-day gap': 'lệch 13 ngày',
   '14-day gap': 'lệch 14 ngày',
   '15-day gap': 'lệch 15 ngày',
   '16-day gap': 'lệch 16 ngày',
   '17-day gap': 'lệch 17 ngày',
   '18-day gap': 'lệch 18 ngày',
   '19-day gap': 'lệch 19 ngày',
   '20-day gap': 'lệch 20 ngày',
   '21-day gap': 'lệch 21 ngày',
   '22-day gap': 'lệch 22 ngày',
   '23-day gap': 'lệch 23 ngày',
   '24-day gap': 'lệch 24 ngày',
   '25-day gap': 'lệch 25 ngày',
   '26-day gap': 'lệch 26 ngày',
   '27-day gap': 'lệch 27 ngày',
   '28-day gap': 'lệch 28 ngày',
   '29-day gap': 'lệch 29 ngày',
   '30-day gap': 'lệch 30 ngày',
   '31-day gap': 'lệch 31 ngày',

   // src/lib/loanRequestRepostStatus.ts
   'You can make another loan request in about 1 minute.': 'Bạn có thể tạo yêu cầu vay mới sau khoảng 1 phút.',
   'You can make another loan request in about 2 minutes.': 'Bạn có thể tạo yêu cầu vay mới sau khoảng 2 phút.',
   'You can make another loan request in about 3 minutes.': 'Bạn có thể tạo yêu cầu vay mới sau khoảng 3 phút.',
   'You can make another loan request in about 4 minutes.': 'Bạn có thể tạo yêu cầu vay mới sau khoảng 4 phút.',
   'You can make another loan request in about 5 minutes.': 'Bạn có thể tạo yêu cầu vay mới sau khoảng 5 phút.',
   'You can make another loan request in about 6 minutes.': 'Bạn có thể tạo yêu cầu vay mới sau khoảng 6 phút.',
   'You can make another loan request in about 7 minutes.': 'Bạn có thể tạo yêu cầu vay mới sau khoảng 7 phút.',
   'You can make another loan request in about 8 minutes.': 'Bạn có thể tạo yêu cầu vay mới sau khoảng 8 phút.',
   'You can make another loan request in about 9 minutes.': 'Bạn có thể tạo yêu cầu vay mới sau khoảng 9 phút.',
   'You can make another loan request in about 10 minutes.': 'Bạn có thể tạo yêu cầu vay mới sau khoảng 10 phút.',
   'You can make another loan request in about 11 minutes.': 'Bạn có thể tạo yêu cầu vay mới sau khoảng 11 phút.',
   'You can make another loan request in about 12 minutes.': 'Bạn có thể tạo yêu cầu vay mới sau khoảng 12 phút.',
   'You can make another loan request in about 13 minutes.': 'Bạn có thể tạo yêu cầu vay mới sau khoảng 13 phút.',
   'You can make another loan request in about 14 minutes.': 'Bạn có thể tạo yêu cầu vay mới sau khoảng 14 phút.',
   'You can make another loan request in about 15 minutes.': 'Bạn có thể tạo yêu cầu vay mới sau khoảng 15 phút.',
   'You can make another loan request in about 16 minutes.': 'Bạn có thể tạo yêu cầu vay mới sau khoảng 16 phút.',
   'You can make another loan request in about 17 minutes.': 'Bạn có thể tạo yêu cầu vay mới sau khoảng 17 phút.',
   'You can make another loan request in about 18 minutes.': 'Bạn có thể tạo yêu cầu vay mới sau khoảng 18 phút.',
   'You can make another loan request in about 19 minutes.': 'Bạn có thể tạo yêu cầu vay mới sau khoảng 19 phút.',
   'You can make another loan request in about 20 minutes.': 'Bạn có thể tạo yêu cầu vay mới sau khoảng 20 phút.',
   'You can make another loan request in about 21 minutes.': 'Bạn có thể tạo yêu cầu vay mới sau khoảng 21 phút.',
   'You can make another loan request in about 22 minutes.': 'Bạn có thể tạo yêu cầu vay mới sau khoảng 22 phút.',
   'You can make another loan request in about 23 minutes.': 'Bạn có thể tạo yêu cầu vay mới sau khoảng 23 phút.',
   'You can make another loan request in about 24 minutes.': 'Bạn có thể tạo yêu cầu vay mới sau khoảng 24 phút.',
   'You can make another loan request in about 25 minutes.': 'Bạn có thể tạo yêu cầu vay mới sau khoảng 25 phút.',
   'You can make another loan request in about 26 minutes.': 'Bạn có thể tạo yêu cầu vay mới sau khoảng 26 phút.',
   'You can make another loan request in about 27 minutes.': 'Bạn có thể tạo yêu cầu vay mới sau khoảng 27 phút.',
   'You can make another loan request in about 28 minutes.': 'Bạn có thể tạo yêu cầu vay mới sau khoảng 28 phút.',
   'You can make another loan request in about 29 minutes.': 'Bạn có thể tạo yêu cầu vay mới sau khoảng 29 phút.',
   'You can make another loan request in about 30 minutes.': 'Bạn có thể tạo yêu cầu vay mới sau khoảng 30 phút.',

   // src/views/account/AccountSettings.tsx
   'We sent a new verification code to': 'Chúng tôi đã gửi mã xác minh mới đến',
   '. Enter it below to confirm the change.': '. Hãy nhập mã bên dưới để xác nhận thay đổi.',
   'or, no wallet app?': 'hoặc chưa có ứng dụng ví?',
   Add: 'Thêm',
   View: 'Xem',
   'Light mode': 'Chế độ sáng',
   '0 of 3 preferences enabled': 'Đã bật 0/3 tùy chọn',
   '1 of 3 preferences enabled': 'Đã bật 1/3 tùy chọn',
   '2 of 3 preferences enabled': 'Đã bật 2/3 tùy chọn',
   '3 of 3 preferences enabled': 'Đã bật 3/3 tùy chọn',
   "You have 1 active loan still to repay. You can't change your wallet until it's fully repaid — this is the wallet your loan and repayments are tied to.":
      'Bạn còn 1 khoản vay đang hoạt động chưa trả xong. Bạn không thể đổi ví cho đến khi trả hết — đây là ví gắn với khoản vay và các khoản trả nợ của bạn.',
   "You have 1 active loan still to repay. You can't disconnect your wallet until it's fully repaid — this is the wallet your loan and repayments are tied to.":
      'Bạn còn 1 khoản vay đang hoạt động chưa trả xong. Bạn không thể ngắt kết nối ví cho đến khi trả hết — đây là ví gắn với khoản vay và các khoản trả nợ của bạn.',
   "You have 2 active loans still to repay. You can't change your wallet until it's fully repaid — this is the wallet your loan and repayments are tied to.":
      'Bạn còn 2 khoản vay đang hoạt động chưa trả xong. Bạn không thể đổi ví cho đến khi trả hết — đây là ví gắn với khoản vay và các khoản trả nợ của bạn.',
   "You have 2 active loans still to repay. You can't disconnect your wallet until it's fully repaid — this is the wallet your loan and repayments are tied to.":
      'Bạn còn 2 khoản vay đang hoạt động chưa trả xong. Bạn không thể ngắt kết nối ví cho đến khi trả hết — đây là ví gắn với khoản vay và các khoản trả nợ của bạn.',
   "You have 3 active loans still to repay. You can't change your wallet until it's fully repaid — this is the wallet your loan and repayments are tied to.":
      'Bạn còn 3 khoản vay đang hoạt động chưa trả xong. Bạn không thể đổi ví cho đến khi trả hết — đây là ví gắn với khoản vay và các khoản trả nợ của bạn.',
   "You have 3 active loans still to repay. You can't disconnect your wallet until it's fully repaid — this is the wallet your loan and repayments are tied to.":
      'Bạn còn 3 khoản vay đang hoạt động chưa trả xong. Bạn không thể ngắt kết nối ví cho đến khi trả hết — đây là ví gắn với khoản vay và các khoản trả nợ của bạn.',
   'You have 1 active loan being repaid. Repayments will still arrive at the wallet you funded each loan from, not the wallet you connect here. Changing your wallet here is safe. It only affects loans you fund from now on.':
      'Bạn có 1 khoản vay đang được trả nợ. Khoản trả nợ vẫn sẽ về ví mà bạn đã dùng để cấp vốn cho từng khoản vay, không phải ví bạn kết nối tại đây. Đổi ví tại đây vẫn an toàn, và chỉ ảnh hưởng đến các khoản vay bạn cấp vốn từ bây giờ.',
   'You have 1 active loan being repaid. Repayments will still arrive at the wallet you funded each loan from, not the wallet you connect here. Disconnecting your wallet here is safe. It only affects loans you fund from now on.':
      'Bạn có 1 khoản vay đang được trả nợ. Khoản trả nợ vẫn sẽ về ví mà bạn đã dùng để cấp vốn cho từng khoản vay, không phải ví bạn kết nối tại đây. Ngắt kết nối ví tại đây vẫn an toàn, và chỉ ảnh hưởng đến các khoản vay bạn cấp vốn từ bây giờ.',
   'You have 2 active loans being repaid. Repayments will still arrive at the wallet you funded each loan from, not the wallet you connect here. Changing your wallet here is safe. It only affects loans you fund from now on.':
      'Bạn có 2 khoản vay đang được trả nợ. Khoản trả nợ vẫn sẽ về ví mà bạn đã dùng để cấp vốn cho từng khoản vay, không phải ví bạn kết nối tại đây. Đổi ví tại đây vẫn an toàn, và chỉ ảnh hưởng đến các khoản vay bạn cấp vốn từ bây giờ.',
   'You have 2 active loans being repaid. Repayments will still arrive at the wallet you funded each loan from, not the wallet you connect here. Disconnecting your wallet here is safe. It only affects loans you fund from now on.':
      'Bạn có 2 khoản vay đang được trả nợ. Khoản trả nợ vẫn sẽ về ví mà bạn đã dùng để cấp vốn cho từng khoản vay, không phải ví bạn kết nối tại đây. Ngắt kết nối ví tại đây vẫn an toàn, và chỉ ảnh hưởng đến các khoản vay bạn cấp vốn từ bây giờ.',
   'You have 3 active loans being repaid. Repayments will still arrive at the wallet you funded each loan from, not the wallet you connect here. Changing your wallet here is safe. It only affects loans you fund from now on.':
      'Bạn có 3 khoản vay đang được trả nợ. Khoản trả nợ vẫn sẽ về ví mà bạn đã dùng để cấp vốn cho từng khoản vay, không phải ví bạn kết nối tại đây. Đổi ví tại đây vẫn an toàn, và chỉ ảnh hưởng đến các khoản vay bạn cấp vốn từ bây giờ.',
   'You have 3 active loans being repaid. Repayments will still arrive at the wallet you funded each loan from, not the wallet you connect here. Disconnecting your wallet here is safe. It only affects loans you fund from now on.':
      'Bạn có 3 khoản vay đang được trả nợ. Khoản trả nợ vẫn sẽ về ví mà bạn đã dùng để cấp vốn cho từng khoản vay, không phải ví bạn kết nối tại đây. Ngắt kết nối ví tại đây vẫn an toàn, và chỉ ảnh hưởng đến các khoản vay bạn cấp vốn từ bây giờ.',
   'Your account is using Argent. Switch to your Instant Wallet or a Base Account so loans and repayments use the right wallet.':
      'Tài khoản của bạn đang dùng Argent. Hãy chuyển sang Instant Wallet hoặc Base Account để khoản vay và khoản trả nợ dùng đúng ví.',
   'Your account is using MetaMask. Switch to your Instant Wallet or a Base Account so loans and repayments use the right wallet.':
      'Tài khoản của bạn đang dùng MetaMask. Hãy chuyển sang Instant Wallet hoặc Base Account để khoản vay và khoản trả nợ dùng đúng ví.',
   'Your account is using Phantom. Switch to your Instant Wallet or a Base Account so loans and repayments use the right wallet.':
      'Tài khoản của bạn đang dùng Phantom. Hãy chuyển sang Instant Wallet hoặc Base Account để khoản vay và khoản trả nợ dùng đúng ví.',
   'Your account is using Rainbow. Switch to your Instant Wallet or a Base Account so loans and repayments use the right wallet.':
      'Tài khoản của bạn đang dùng Rainbow. Hãy chuyển sang Instant Wallet hoặc Base Account để khoản vay và khoản trả nợ dùng đúng ví.',
   'Your account is using Trust Wallet. Switch to your Instant Wallet or a Base Account so loans and repayments use the right wallet.':
      'Tài khoản của bạn đang dùng Trust Wallet. Hãy chuyển sang Instant Wallet hoặc Base Account để khoản vay và khoản trả nợ dùng đúng ví.',
   'Your account is using WalletConnect. Switch to your Instant Wallet or a Base Account so loans and repayments use the right wallet.':
      'Tài khoản của bạn đang dùng WalletConnect. Hãy chuyển sang Instant Wallet hoặc Base Account để khoản vay và khoản trả nợ dùng đúng ví.',
   'Your account is using Wallet. Switch to your Instant Wallet or a Base Account so loans and repayments use the right wallet.':
      'Tài khoản của bạn đang dùng một ví khác. Hãy chuyển sang Instant Wallet hoặc Base Account để khoản vay và khoản trả nợ dùng đúng ví.'
};
