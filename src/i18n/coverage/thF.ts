// Thai translations for on-screen English found by the full-code scan (round two), keyed by
// the exact English text. Loaded on demand with the rest of this locale's coverage (see ./index.ts).
export const thaiCoverageF: Record<string, string> = {
   // src/app/account-restricted/page.tsx
   'Repay $': 'ชำระคืน $',
   'to continue.': 'เพื่อดำเนินการต่อ',

   // src/app/auth/line/callback/page.tsx
   'Missing LINE authorization code. Please try again.': 'ไม่พบรหัสยืนยันสิทธิ์จาก LINE โปรดลองอีกครั้ง',
   'LINE login state mismatch. Please try again.': 'สถานะการเข้าสู่ระบบด้วย LINE ไม่ตรงกัน โปรดลองอีกครั้ง',
   'LINE login failed.': 'เข้าสู่ระบบด้วย LINE ไม่สำเร็จ',
   'Unexpected error during LINE login.': 'เกิดข้อผิดพลาดที่ไม่คาดคิดระหว่างเข้าสู่ระบบด้วย LINE',
   'LINE login failed': 'เข้าสู่ระบบด้วย LINE ไม่สำเร็จ',

   // src/app/auth/verify-code/page.tsx
   'Resend in': 'ส่งอีกครั้งใน',

   // src/app/forgot-password/page.tsx
   'A code is already on the way. Enter it below, or request a new one in': 'รหัสกำลังส่งไปหาคุณแล้ว กรอกรหัสด้านล่าง หรือขอรหัสใหม่ได้ใน',
   'Resend code in': 'ส่งรหัสอีกครั้งใน',

   // src/components/BasePaymentReconciler.tsx
   'Loan Funded': 'ปล่อยกู้สำเร็จแล้ว',
   'Your $': 'การปล่อยกู้ $',
   'funding just confirmed. Thank you!': 'ของคุณได้รับการยืนยันแล้ว ขอบคุณ!',
   'Repayment Confirmed': 'ยืนยันการชำระคืนแล้ว',
   'Your repayment just confirmed on-chain.': 'การชำระคืนของคุณได้รับการยืนยันแบบออนเชนแล้ว',
   'Interest Returned': 'ชำระดอกเบี้ยคืนแล้ว',
   'Your interest payment just confirmed on-chain.': 'การชำระดอกเบี้ยของคุณได้รับการยืนยันแบบออนเชนแล้ว',

   // src/components/ExpiredLoanRequestNotifier.tsx
   'Loan request expired': 'คำขอเงินกู้หมดอายุแล้ว',
   'Loan requests expired': 'คำขอเงินกู้หมดอายุแล้ว',

   // src/components/LineLoginButton.tsx
   'Sign Up with LINE': 'สมัครสมาชิกด้วย LINE',
   'Sign In with LINE': 'เข้าสู่ระบบด้วย LINE',

   // src/components/TelegramAuthButton.tsx
   'Loading Telegram...': 'กำลังโหลด Telegram...',

   // src/components/ThemeToggle.tsx
   'Switch to light mode': 'เปลี่ยนเป็นโหมดสว่าง',
   'Switch to dark mode': 'เปลี่ยนเป็นโหมดมืด',

   // src/components/ToastSystem/config/toastConfig.ts
   'Funding Successful!': 'ปล่อยกู้สำเร็จ!',
   'Review Funding Details': 'ดูรายละเอียดการปล่อยกู้',
   'Repayment Successful!': 'ชำระคืนสำเร็จ!',
   'Review Repayment Details': 'ดูรายละเอียดการชำระคืน',
   'Verification Successful!': 'ยืนยันตัวตนสำเร็จ!',
   'Congratulations for Verifying.': 'ยินดีด้วย คุณยืนยันตัวตนเรียบร้อยแล้ว',
   'Continue Loan Request': 'ส่งคำขอเงินกู้ต่อ',
   'Loan Request Created!': 'สร้างคำขอเงินกู้แล้ว!',
   'Your request is now live for lenders to review.': 'คำขอของคุณเผยแพร่แล้ว ผู้ให้กู้สามารถเข้ามาดูได้',
   'View Active Loans': 'ดูเงินกู้ที่กำลังดำเนินอยู่',
   "It's awkward 😅": 'อุ๊ย ขออภัย 😅',
   'We were unable to process payment for your funding.': 'เราไม่สามารถดำเนินการชำระเงินสำหรับการปล่อยกู้ของคุณได้',
   'Try Again?': 'ลองอีกครั้งไหม',
   'Network Error!': 'เครือข่ายขัดข้อง!',
   'Please check your Internet Connection': 'โปรดตรวจสอบการเชื่อมต่ออินเทอร์เน็ตของคุณ',
   'You Earned IOU Points!': 'คุณได้รับแต้ม IOU!',
   "You've received": 'คุณได้รับ',
   'IOU Points!': 'แต้ม IOU!',
   'Check IOU Points Balance': 'ดูยอดแต้ม IOU',
   'Insufficient Funds': 'ยอดเงินไม่เพียงพอ',
   'Transaction declined due to insufficient funds.': 'ธุรกรรมถูกปฏิเสธเนื่องจากยอดเงินไม่เพียงพอ',
   'Change Funding Source': 'เปลี่ยนแหล่งเงิน',
   'Transaction Error': 'ธุรกรรมผิดพลาด',
   'An error occurred during the transaction. Please try again.': 'เกิดข้อผิดพลาดระหว่างทำธุรกรรม โปรดลองอีกครั้ง',
   'Try again?': 'ลองอีกครั้งไหม',
   'Transaction Declined': 'ธุรกรรมถูกปฏิเสธ',
   'You declined the transaction in your wallet. No funds were moved.': 'คุณปฏิเสธธุรกรรมในกระเป๋าเงินของคุณ จึงไม่มีการโอนเงินใด ๆ',
   'Wrong Network': 'เครือข่ายไม่ถูกต้อง',
   'Your wallet is connected to the wrong network. Switch networks and try again.':
      'กระเป๋าเงินของคุณเชื่อมต่อกับเครือข่ายที่ไม่ถูกต้อง โปรดเปลี่ยนเครือข่ายแล้วลองอีกครั้ง',
   'Verification Failed!': 'ยืนยันตัวตนไม่สำเร็จ!',
   'Account verification failed. Please try again.': 'การยืนยันบัญชีไม่สำเร็จ โปรดลองอีกครั้ง',
   'Server Error!': 'เซิร์ฟเวอร์ขัดข้อง!',
   'An error occurred on the server. Please try again later.': 'เกิดข้อผิดพลาดที่เซิร์ฟเวอร์ โปรดลองอีกครั้งในภายหลัง',
   'We were unable to process your loan request.': 'เราไม่สามารถดำเนินการคำขอเงินกู้ของคุณได้',
   'Login Failed': 'เข้าสู่ระบบไม่สำเร็จ',
   'Unable to log in. Please try again.': 'ไม่สามารถเข้าสู่ระบบได้ โปรดลองอีกครั้ง',
   'Registration Failed': 'สมัครสมาชิกไม่สำเร็จ',
   'Unable to register. Please try again.': 'ไม่สามารถสมัครสมาชิกได้ โปรดลองอีกครั้ง',
   'Email Already Registered': 'อีเมลนี้ลงทะเบียนแล้ว',
   'An account already exists with this email. Please sign in or reset your password if you forgot it.':
      'มีบัญชีที่ใช้อีเมลนี้อยู่แล้ว โปรดเข้าสู่ระบบ หรือรีเซ็ตรหัสผ่านหากคุณลืม',
   'Weak Password': 'รหัสผ่านไม่ปลอดภัย',
   'Password does not meet strength requirements.': 'รหัสผ่านไม่ตรงตามข้อกำหนดด้านความปลอดภัย',
   'WorldId Verification Required': 'ต้องยืนยันด้วย World ID',
   'Please verify your WorldId ID to create a loan request.': 'โปรดยืนยันด้วย World ID เพื่อสร้างคำขอเงินกู้',
   'World ID Verified!': 'ยืนยัน World ID แล้ว!',
   'Your World ID has been successfully verified.': 'ยืนยัน World ID ของคุณสำเร็จแล้ว',
   'Reset Link Sent': 'ส่งลิงก์รีเซ็ตแล้ว',
   'A password reset link has been sent to your email.': 'เราได้ส่งลิงก์รีเซ็ตรหัสผ่านไปที่อีเมลของคุณแล้ว',
   'Network Selection Required': 'โปรดเลือกเครือข่าย',
   'Please select a network and coin type.': 'โปรดเลือกเครือข่ายและประเภทเหรียญ',
   'Invalid Amount': 'จำนวนเงินไม่ถูกต้อง',
   'Please enter a valid loan amount greater than 0.': 'โปรดกรอกจำนวนเงินกู้ที่ถูกต้องและมากกว่า 0',
   'Amount Exceeds Limit': 'จำนวนเงินเกินวงเงิน',
   'The loan amount exceeds your available credit limit.': 'จำนวนเงินกู้เกินวงเงินที่คุณใช้ได้',
   'View Credit Limit': 'ดูวงเงินกู้',
   'Repayment Too Low': 'ยอดชำระคืนต่ำเกินไป',
   'Repayment must be at least $1 more than the amount you borrow.': 'ยอดชำระคืนต้องมากกว่าจำนวนเงินที่คุณกู้อย่างน้อย $1',
   'Loan Limit Reached': 'มีเงินกู้ครบจำนวนสูงสุดแล้ว',
   'You have reached your maximum number of active loans.': 'คุณมีเงินกู้ที่กำลังดำเนินอยู่ครบจำนวนสูงสุดแล้ว',
   'View Profile': 'ดูโปรไฟล์',
   'Profile Updated!': 'อัปเดตโปรไฟล์แล้ว!',
   'Your profile has been updated successfully.': 'อัปเดตโปรไฟล์ของคุณเรียบร้อยแล้ว',
   'Update Successful!': 'อัปเดตสำเร็จ!',
   'User information updated successfully.': 'อัปเดตข้อมูลผู้ใช้เรียบร้อยแล้ว',
   'Update Failed': 'อัปเดตไม่สำเร็จ',
   'Failed to update user information.': 'อัปเดตข้อมูลผู้ใช้ไม่สำเร็จ',
   'Loan Updated!': 'อัปเดตเงินกู้แล้ว!',
   'Loan has been updated successfully.': 'อัปเดตเงินกู้เรียบร้อยแล้ว',
   'View Loans': 'ดูเงินกู้',
   'Failed to update loan.': 'อัปเดตเงินกู้ไม่สำเร็จ',
   'Loan Edited!': 'แก้ไขเงินกู้แล้ว!',
   'Loan has been edited successfully.': 'แก้ไขเงินกู้เรียบร้อยแล้ว',
   'Edit Failed': 'แก้ไขไม่สำเร็จ',
   'Failed to edit loan.': 'แก้ไขเงินกู้ไม่สำเร็จ',
   'Loan Deleted!': 'ลบเงินกู้แล้ว!',
   'Loan has been deleted successfully.': 'ลบเงินกู้เรียบร้อยแล้ว',
   'Delete Failed': 'ลบไม่สำเร็จ',
   'Failed to delete loan.': 'ลบเงินกู้ไม่สำเร็จ',
   'Session Expired': 'เซสชันหมดอายุ',
   'Your session has expired. Please log in again.': 'เซสชันของคุณหมดอายุแล้ว โปรดเข้าสู่ระบบอีกครั้ง',
   Unauthorised: 'ไม่มีสิทธิ์เข้าถึง',
   'You are not authorized. Please log in.': 'คุณไม่มีสิทธิ์เข้าถึง โปรดเข้าสู่ระบบ',
   'Duplicate Account Not Allowed': 'ไม่อนุญาตให้มีบัญชีซ้ำ',
   'We do not allow duplicate accounts. This World ID is already connected to an existing Moodeng account.':
      'เราไม่อนุญาตให้มีบัญชีซ้ำ World ID นี้เชื่อมต่อกับบัญชี Moodeng ที่มีอยู่แล้ว',
   'Please connect your wallet to continue.': 'โปรดเชื่อมต่อกระเป๋าเงินของคุณเพื่อดำเนินการต่อ',
   'Wallet Not Responding': 'กระเป๋าเงินไม่ตอบสนอง',
   "We couldn't reach your wallet on this device. Approve on the device where it's connected, or reconnect here.":
      'เราไม่สามารถติดต่อกระเป๋าเงินของคุณบนอุปกรณ์นี้ได้ โปรดอนุมัติบนอุปกรณ์ที่เชื่อมต่อกระเป๋าเงินไว้ หรือเชื่อมต่อใหม่ที่นี่',
   'Verification Not Completed': 'ยืนยันตัวตนยังไม่เสร็จ',
   'You did not complete World ID verification. You can try again anytime.': 'คุณยังยืนยันด้วย World ID ไม่เสร็จ ลองใหม่ได้ทุกเมื่อ',
   'Cannot Lend to Yourself': 'ปล่อยกู้ให้ตัวเองไม่ได้',
   'You cannot lend to your own loan request. Please lend to other users.':
      'คุณไม่สามารถปล่อยกู้ให้คำขอเงินกู้ของตัวเองได้ โปรดปล่อยกู้ให้ผู้ใช้คนอื่น',
   'View Other Loans': 'ดูคำขอเงินกู้อื่น'
};
