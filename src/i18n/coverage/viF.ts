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
   User: 'Người dùng'
};
