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
   'View Other Loans': 'ดูคำขอเงินกู้อื่น',

   // src/components/UserPay.tsx
   Partial: 'ชำระบางส่วน',

   // src/components/WalletNetworkBlockNotice.tsx
   'app fixes it — install it, switch it on, then reconnect. It works on WiFi and mobile data.':
      'ช่วยแก้ปัญหานี้ได้ ติดตั้งแอป เปิดใช้งาน แล้วเชื่อมต่อใหม่ ใช้ได้ทั้งกับ WiFi และอินเทอร์เน็ตมือถือ',
   "I've turned it on — Retry": 'เปิดแล้ว — ลองอีกครั้ง',

   // src/components/auth/AuthErrorAlert.tsx
   'that provider': 'ผู้ให้บริการนั้น',
   '. This is usually temporary — please try again.': ' ปัญหานี้มักเกิดขึ้นชั่วคราว โปรดลองอีกครั้ง',
   'reset your password': 'รีเซ็ตรหัสผ่าน',
   "if you've forgotten it.": 'หากคุณลืมรหัสผ่าน',

   // src/components/auth/AuthFooter.tsx
   '© 2026 Moodeng Credit All Rights Reserved': '© 2026 Moodeng Credit สงวนลิขสิทธิ์',

   // src/components/auth/AuthInputField.tsx
   'Hide password': 'ซ่อนรหัสผ่าน',
   'Show password': 'แสดงรหัสผ่าน',

   // src/components/auth/SignUpFormErrorAlert.tsx
   'This email is already linked to a Google account. Use a different email address or':
      'อีเมลนี้เชื่อมโยงกับบัญชี Google อยู่แล้ว โปรดใช้อีเมลอื่น หรือ',
   'instead.': 'แทน',

   // src/components/auth/SocialAuthButtons.tsx
   'Sign Up with Google': 'สมัครสมาชิกด้วย Google',
   'Facebook sign-in coming soon': 'การเข้าสู่ระบบด้วย Facebook จะเปิดให้ใช้เร็ว ๆ นี้',

   // src/components/filters/FilterSidebar.tsx
   'Payback %': 'อัตราชำระคืน %',

   // src/components/mecha/mechaCopy.ts
   'Moodeng Support Officer': 'เจ้าหน้าที่ฝ่ายช่วยเหลือของ Moodeng',
   'Ask me anything about Moodeng…': 'ถามอะไรก็ได้เกี่ยวกับ Moodeng…',
   Send: 'ส่ง',
   "Hi, I'm Mecha 🤖 — ask me anything about Moodeng: verifying, wallets, borrowing, or cashing out.":
      'สวัสดี ฉันคือ Mecha 🤖 ถามอะไรก็ได้เกี่ยวกับ Moodeng ไม่ว่าจะเป็นการยืนยันตัวตน กระเป๋าเงิน การกู้ยืม หรือการถอนเป็นเงินสด',
   'Try asking': 'ลองถามดู',
   'Talk to the team': 'คุยกับทีมงาน',
   'Want a real person? I can pass this chat to the Moodeng team.': 'อยากคุยกับเจ้าหน้าที่จริงไหม ฉันส่งต่อแชทนี้ให้ทีม Moodeng ได้',
   'Connect me with the team': 'ติดต่อทีมงาน',
   'Sent! The team has your question and will follow up. You can keep chatting with me too.':
      'ส่งแล้ว! ทีมงานได้รับคำถามของคุณแล้วและจะติดต่อกลับ คุณยังคุยกับฉันต่อได้เช่นกัน',
   'How can the team reach you? (optional)': 'ทีมงานจะติดต่อคุณได้ทางไหน (ไม่บังคับ)',
   'Something went wrong on my end. Please try again, or I can connect you with the team.':
      'เกิดข้อผิดพลาดจากฝั่งฉัน โปรดลองอีกครั้ง หรือให้ฉันส่งต่อคุณให้ทีมงาน',
   'Chat with Mecha': 'แชทกับ Mecha',
   'Close chat': 'ปิดแชท',
   'Ask Mecha anything, or browse the popular guides below.': 'ถาม Mecha ได้ทุกเรื่อง หรือดูคู่มือยอดนิยมด้านล่าง',
   'Popular right now': 'ยอดนิยมตอนนี้',
   'Mecha answers from Moodeng’s help docs.': 'Mecha ตอบจากเอกสารช่วยเหลือของ Moodeng',
   'Browse all FAQs & guides →': 'ดูคำถามที่พบบ่อยและคู่มือทั้งหมด →',
   'Mecha is typing': 'Mecha กำลังพิมพ์',
   Helpful: 'มีประโยชน์',
   'Not helpful': 'ไม่มีประโยชน์',
   'Thanks for the feedback!': 'ขอบคุณสำหรับความคิดเห็น!',

   // src/components/support/LiveChatHost.tsx
   'Message from Moodeng Support': 'ข้อความจากฝ่ายช่วยเหลือ Moodeng',
   'The team replied to your chat. Tap to read it.': 'ทีมงานตอบกลับแชทของคุณแล้ว แตะเพื่ออ่าน',
   'Open chat': 'เปิดแชท',

   // src/components/tables/DataTable.tsx
   'No data available': 'ไม่มีข้อมูล',

   // src/components/verification/VerificationUnsuccessfulModal.tsx
   'your ID': 'บัตรประชาชนของคุณ',
   'or get help from our team': 'หรือขอความช่วยเหลือจากทีมของเรา',

   // src/components/verification/VerifyYourselfModal.tsx
   '🇺🇸 United States': '🇺🇸 สหรัฐอเมริกา',
   '🇬🇧 United Kingdom': '🇬🇧 สหราชอาณาจักร',
   '🇯🇵 Japan': '🇯🇵 ญี่ปุ่น',
   '🇰🇷 South Korea': '🇰🇷 เกาหลีใต้',
   '🇹🇼 Taiwan': '🇹🇼 ไต้หวัน',
   '🇲🇾 Malaysia': '🇲🇾 มาเลเซีย',
   '🇲🇽 Mexico': '🇲🇽 เม็กซิโก',
   '🇨🇷 Costa Rica': '🇨🇷 คอสตาริกา',
   '🇵🇦 Panama': '🇵🇦 ปานามา',
   '🇨🇴 Colombia': '🇨🇴 โคลอมเบีย',
   '🇨🇱 Chile': '🇨🇱 ชิลี',
   '🇦🇷 Argentina': '🇦🇷 อาร์เจนตินา',
   '🇸🇬 Singapore': '🇸🇬 สิงคโปร์',
   '🇹🇭 Thailand': '🇹🇭 ไทย',
   '🇵🇭 Philippines': '🇵🇭 ฟิลิปปินส์',
   '🇩🇪 Germany': '🇩🇪 เยอรมนี',
   '🇦🇹 Austria': '🇦🇹 ออสเตรีย',
   '🇵🇱 Poland': '🇵🇱 โปแลนด์',
   '🇬🇹 Guatemala': '🇬🇹 กัวเตมาลา',
   '🇪🇨 Ecuador': '🇪🇨 เอกวาดอร์',
   '🇵🇪 Peru': '🇵🇪 เปรู',
   '🇧🇷 Brazil': '🇧🇷 บราซิล',
   'NFC-enabled (biometric) passport': 'หนังสือเดินทางที่รองรับ NFC (หนังสือเดินทางไบโอเมตริกซ์)',
   'Availability changes —': 'พื้นที่ให้บริการอาจเปลี่ยนแปลงได้ —',
   'check the live map': 'ดูแผนที่ล่าสุด',
   'for exact locations.': 'เพื่อตรวจสอบตำแหน่งที่แน่นอน',

   // src/components/worldId/useWorldIdVerification.ts
   'You must be logged in to verify your World ID.': 'คุณต้องเข้าสู่ระบบก่อนจึงจะยืนยัน World ID ได้',
   'World ID verification was accepted, but the account status did not update.': 'การยืนยัน World ID ผ่านแล้ว แต่สถานะบัญชียังไม่อัปเดต',
   'Failed to prepare World ID verification.': 'เตรียมการยืนยัน World ID ไม่สำเร็จ',
   'Verification failed.': 'การยืนยันตัวตนไม่สำเร็จ',

   // src/config/stripeOnrampConfig.ts
   'US (excl. Hawaii) and EU only': 'เฉพาะสหรัฐอเมริกา (ยกเว้นฮาวาย) และสหภาพยุโรป',

   // src/constants/errorMessages.ts
   'We encountered an unexpected error. Please try again or contact support if the problem persists.':
      'เกิดข้อผิดพลาดที่ไม่คาดคิด โปรดลองอีกครั้ง หรือติดต่อฝ่ายช่วยเหลือหากยังพบปัญหาอยู่',
   'Go to Dashboard': 'ไปที่แดชบอร์ด',

   // src/constants/loanOptions.ts
   '0% to 5%': '0% ถึง 5%',
   '5% to 10%': '5% ถึง 10%',
   '10% to 20%': '10% ถึง 20%',
   'Next Week': 'สัปดาห์หน้า',
   'Next 30 Days': '30 วันข้างหน้า',
   'Next 60 Days': '60 วันข้างหน้า',
   'After 90 Days+': 'หลัง 90 วันขึ้นไป',
   'Beginner Borrower': 'ผู้ยืมมือใหม่'
};
