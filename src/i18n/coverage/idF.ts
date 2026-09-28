// Indonesian translations for on-screen English found by the full-code scan (round two), keyed by
// the exact English text. Loaded on demand with the rest of this locale's coverage (see ./index.ts).
export const indonesianCoverageF: Record<string, string> = {
   // src/app/account-restricted/page.tsx
   'Repay $': 'Bayar $',
   'to continue.': 'untuk melanjutkan.',

   // src/app/auth/line/callback/page.tsx
   'Missing LINE authorization code. Please try again.': 'Kode otorisasi LINE tidak ditemukan. Silakan coba lagi.',
   'LINE login state mismatch. Please try again.': 'Status login LINE tidak cocok. Silakan coba lagi.',
   'LINE login failed.': 'Login LINE gagal.',
   'Unexpected error during LINE login.': 'Terjadi kesalahan tak terduga saat login LINE.',
   'LINE login failed': 'Login LINE gagal',

   // src/app/auth/verify-code/page.tsx
   'Resend in': 'Kirim ulang dalam',
   'Enter the 8-digit code we sent to': 'Masukkan kode 8 digit yang kami kirim ke',

   // src/app/forgot-password/page.tsx
   'A code is already on the way. Enter it below, or request a new one in':
      'Kode sudah dalam perjalanan. Masukkan di bawah, atau minta kode baru dalam',
   'Resend code in': 'Kirim ulang kode dalam',

   // src/app/verify/page.tsx
   "Then you'll submit your national ID.": 'Setelah itu, kamu akan mengirim kartu identitasmu.',
   "Then you'll verify with World ID.": 'Setelah itu, kamu akan verifikasi dengan World ID.',
   "Tap the button to start the face scan — you'll be brought back here automatically when it's done.":
      'Ketuk tombol untuk memulai pemindaian wajah — kamu akan otomatis kembali ke sini setelah selesai.',
   'Tap the button to open the face scan in a new tab. Keep this page open — it will update automatically when done.':
      'Ketuk tombol untuk membuka pemindaian wajah di tab baru. Biarkan halaman ini tetap terbuka — halaman akan diperbarui otomatis setelah selesai.',
   'A quick ID + selfie check — about 3 minutes.': 'Cek ID + selfie yang cepat — sekitar 3 menit.',
   'Your ID is checked by our secure verification partner and is never stored by Moodeng.':
      'ID kamu dicek oleh mitra verifikasi kami yang aman dan tidak pernah disimpan oleh Moodeng.',
   "You'll be brought back here automatically when it's done.": 'Kamu akan otomatis kembali ke sini setelah selesai.',
   "We weren't able to verify your identity. Reason:": 'Kami tidak bisa memverifikasi identitasmu. Alasan:',
   '. A few things that usually fix it:': '. Beberapa hal yang biasanya bisa mengatasinya:',

   // src/components/BasePaymentReconciler.tsx
   'Loan Funded': 'Pinjaman Didanai',
   'Your $': 'Pendanaan $',
   'funding just confirmed. Thank you!': 'kamu baru saja terkonfirmasi. Terima kasih!',
   'Repayment Confirmed': 'Pembayaran Kembali Terkonfirmasi',
   'Your repayment just confirmed on-chain.': 'Pembayaran kembali kamu baru saja terkonfirmasi on-chain.',
   'Interest Returned': 'Bunga Dikembalikan',
   'Your interest payment just confirmed on-chain.': 'Pembayaran bungamu baru saja terkonfirmasi on-chain.',

   // src/components/ExpiredLoanRequestNotifier.tsx
   'Loan request expired': 'Permintaan pinjaman kedaluwarsa',
   'Loan requests expired': 'Permintaan pinjaman kedaluwarsa',
   'request expired before it was funded. Contact support if you need help connecting with a lender or deciding whether to post again.':
      'kamu kedaluwarsa sebelum didanai. Hubungi dukungan jika kamu butuh bantuan untuk terhubung dengan pemberi pinjaman atau memutuskan apakah akan memposting lagi.',
   'loan requests expired before they were funded. Contact support if you need help connecting with a lender or deciding whether to post again.':
      'permintaan pinjaman kedaluwarsa sebelum didanai. Hubungi dukungan jika kamu butuh bantuan untuk terhubung dengan pemberi pinjaman atau memutuskan apakah akan memposting lagi.',

   // src/components/InAppBrowserNotice.tsx
   'Opened Moodeng inside': 'Membuka Moodeng di dalam',
   '— sign-in / wallet not working': '— masuk / dompet tidak berfungsi',

   // src/components/LineLoginButton.tsx
   'Sign Up with LINE': 'Daftar dengan LINE',
   'Sign In with LINE': 'Masuk dengan LINE',

   // src/components/RepayInAppBrowserGate.tsx
   "Can't repay inside": 'Tidak bisa bayar kembali di dalam',
   '— needs to open in a real browser': '— perlu dibuka di browser biasa',

   // src/components/TelegramAuthButton.tsx
   'Loading Telegram...': 'Memuat Telegram...',

   // src/components/ThemeToggle.tsx
   'Switch to light mode': 'Beralih ke mode terang',
   'Switch to dark mode': 'Beralih ke mode gelap',

   // src/components/ToastSystem/config/toastConfig.ts
   'Funding Successful!': 'Pendanaan Berhasil!',
   'Review Funding Details': 'Lihat Detail Pendanaan',
   'Repayment Successful!': 'Pembayaran Kembali Berhasil!',
   'Review Repayment Details': 'Lihat Detail Pembayaran',
   'Verification Successful!': 'Verifikasi Berhasil!',
   'Congratulations for Verifying.': 'Selamat, kamu sudah terverifikasi.',
   'Continue Loan Request': 'Lanjutkan Permintaan Pinjaman',
   'Loan Request Created!': 'Permintaan Pinjaman Dibuat!',
   'Your request is now live for lenders to review.': 'Permintaanmu sekarang sudah tayang dan bisa ditinjau pemberi pinjaman.',
   'View Active Loans': 'Lihat Pinjaman Aktif',
   "It's awkward 😅": 'Waduh, canggung nih 😅',
   'We were unable to process payment for your funding.': 'Kami tidak bisa memproses pembayaran untuk pendanaanmu.',
   'Try Again?': 'Coba Lagi?',
   'Network Error!': 'Kesalahan Jaringan!',
   'Please check your Internet Connection': 'Periksa koneksi internetmu',
   'You Earned IOU Points!': 'Kamu Dapat Poin IOU!',
   "You've received": 'Kamu menerima',
   'IOU Points!': 'poin IOU!',
   'Check IOU Points Balance': 'Cek Saldo Poin IOU',
   'Insufficient Funds': 'Dana Tidak Cukup',
   'Transaction declined due to insufficient funds.': 'Transaksi ditolak karena dana tidak cukup.',
   'Change Funding Source': 'Ganti Sumber Dana',
   'Transaction Error': 'Kesalahan Transaksi',
   'An error occurred during the transaction. Please try again.': 'Terjadi kesalahan saat transaksi. Silakan coba lagi.',
   'Try again?': 'Coba lagi?',
   'Transaction Declined': 'Transaksi Ditolak',
   'You declined the transaction in your wallet. No funds were moved.':
      'Kamu menolak transaksi di dompetmu. Tidak ada dana yang dipindahkan.',
   'Wrong Network': 'Jaringan Salah',
   'Your wallet is connected to the wrong network. Switch networks and try again.':
      'Dompetmu terhubung ke jaringan yang salah. Ganti jaringan lalu coba lagi.',
   'Verification Failed!': 'Verifikasi Gagal!',
   'Account verification failed. Please try again.': 'Verifikasi akun gagal. Silakan coba lagi.',
   'Server Error!': 'Kesalahan Server!',
   'An error occurred on the server. Please try again later.': 'Terjadi kesalahan di server. Silakan coba lagi nanti.',
   'We were unable to process your loan request.': 'Kami tidak bisa memproses permintaan pinjamanmu.',
   'Login Failed': 'Gagal Masuk',
   'Unable to log in. Please try again.': 'Tidak bisa masuk. Silakan coba lagi.',
   'Registration Failed': 'Pendaftaran Gagal',
   'Unable to register. Please try again.': 'Tidak bisa mendaftar. Silakan coba lagi.',
   'Email Already Registered': 'Email Sudah Terdaftar',
   'An account already exists with this email. Please sign in or reset your password if you forgot it.':
      'Sudah ada akun dengan email ini. Silakan masuk, atau atur ulang kata sandimu jika kamu lupa.',
   'Weak Password': 'Kata Sandi Lemah',
   'Password does not meet strength requirements.': 'Kata sandi belum memenuhi syarat keamanan.',
   'WorldId Verification Required': 'Verifikasi World ID Diperlukan',
   'Please verify your WorldId ID to create a loan request.': 'Verifikasi World ID kamu dulu untuk membuat permintaan pinjaman.',
   'World ID Verified!': 'World ID Terverifikasi!',
   'Your World ID has been successfully verified.': 'World ID kamu berhasil diverifikasi.',
   'Reset Link Sent': 'Tautan Atur Ulang Terkirim',
   'A password reset link has been sent to your email.': 'Tautan untuk mengatur ulang kata sandi sudah dikirim ke emailmu.',
   'Network Selection Required': 'Pilih Jaringan Dulu',
   'Please select a network and coin type.': 'Silakan pilih jaringan dan jenis koin.',
   'Invalid Amount': 'Jumlah Tidak Valid',
   'Please enter a valid loan amount greater than 0.': 'Masukkan jumlah pinjaman yang valid dan lebih dari 0.',
   'Amount Exceeds Limit': 'Jumlah Melebihi Limit',
   'The loan amount exceeds your available credit limit.': 'Jumlah pinjaman melebihi limit kredit yang tersedia.',
   'View Credit Limit': 'Lihat Limit Kredit',
   'Repayment Too Low': 'Pembayaran Kembali Terlalu Rendah',
   'Repayment must be at least $1 more than the amount you borrow.':
      'Pembayaran kembali harus setidaknya $1 lebih besar dari jumlah yang kamu pinjam.',
   'Loan Limit Reached': 'Batas Pinjaman Tercapai',
   'You have reached your maximum number of active loans.': 'Kamu sudah mencapai jumlah maksimum pinjaman aktif.',
   'View Profile': 'Lihat Profil',
   'Profile Updated!': 'Profil Diperbarui!',
   'Your profile has been updated successfully.': 'Profilmu berhasil diperbarui.',
   'Update Successful!': 'Pembaruan Berhasil!',
   'User information updated successfully.': 'Informasi pengguna berhasil diperbarui.',
   'Update Failed': 'Pembaruan Gagal',
   'Failed to update user information.': 'Gagal memperbarui informasi pengguna.',
   'Loan Updated!': 'Pinjaman Diperbarui!',
   'Loan has been updated successfully.': 'Pinjaman berhasil diperbarui.',
   'View Loans': 'Lihat Pinjaman',
   'Failed to update loan.': 'Gagal memperbarui pinjaman.',
   'Loan Edited!': 'Pinjaman Diedit!',
   'Loan has been edited successfully.': 'Pinjaman berhasil diedit.',
   'Edit Failed': 'Edit Gagal',
   'Failed to edit loan.': 'Gagal mengedit pinjaman.',
   'Loan Deleted!': 'Pinjaman Dihapus!',
   'Loan has been deleted successfully.': 'Pinjaman berhasil dihapus.',
   'Delete Failed': 'Hapus Gagal',
   'Failed to delete loan.': 'Gagal menghapus pinjaman.',
   'Session Expired': 'Sesi Berakhir',
   'Your session has expired. Please log in again.': 'Sesimu sudah berakhir. Silakan masuk lagi.',
   Unauthorised: 'Tidak Diizinkan',
   'You are not authorized. Please log in.': 'Kamu tidak punya akses. Silakan masuk.',
   'Duplicate Account Not Allowed': 'Akun Ganda Tidak Diizinkan',
   'We do not allow duplicate accounts. This World ID is already connected to an existing Moodeng account.':
      'Kami tidak mengizinkan akun ganda. World ID ini sudah terhubung ke akun Moodeng lain.',
   'Please connect your wallet to continue.': 'Hubungkan dompetmu untuk melanjutkan.',
   'Wallet Not Responding': 'Dompet Tidak Merespons',
   "We couldn't reach your wallet on this device. Approve on the device where it's connected, or reconnect here.":
      'Kami tidak bisa menjangkau dompetmu di perangkat ini. Setujui di perangkat tempat dompet terhubung, atau hubungkan ulang di sini.',
   'Verification Not Completed': 'Verifikasi Belum Selesai',
   'You did not complete World ID verification. You can try again anytime.':
      'Kamu belum menyelesaikan verifikasi World ID. Kamu bisa mencoba lagi kapan saja.',
   'Cannot Lend to Yourself': 'Tidak Bisa Meminjamkan ke Diri Sendiri',
   'You cannot lend to your own loan request. Please lend to other users.':
      'Kamu tidak bisa mendanai permintaan pinjamanmu sendiri. Silakan danai pengguna lain.',
   'View Other Loans': 'Lihat Pinjaman Lain',

   // src/components/support/LiveChatHost.tsx
   'Message from Moodeng Support': 'Pesan dari Moodeng Support',
   'The team replied to your chat. Tap to read it.': 'Tim sudah membalas chat kamu. Ketuk untuk membacanya.',
   'Open chat': 'Buka chat',

   // src/components/tables/DataTable.tsx
   'No data available': 'Belum ada data',

   // src/components/verification/VerifyYourselfModal.tsx
   '🇹🇼 Taiwan': '🇹🇼 Taiwan',
   '🇲🇾 Malaysia': '🇲🇾 Malaysia',
   '🇨🇷 Costa Rica': '🇨🇷 Kosta Rika',
   '🇵🇦 Panama': '🇵🇦 Panama',
   '🇦🇷 Argentina': '🇦🇷 Argentina',
   '🇹🇭 Thailand': '🇹🇭 Thailand',
   '🇬🇹 Guatemala': '🇬🇹 Guatemala',
   '🇵🇪 Peru': '🇵🇪 Peru',

   // src/components/worldId/WorldIdVerificationOverlays.tsx
   'Everything is ready. Tap "Open World App" to': 'Semua sudah siap. Ketuk "Buka World App" untuk',
   ". If you don't have World App yet, you'll be guided to install it — then return here to finish.":
      '. Kalau belum punya World App, kamu akan dipandu untuk memasangnya — lalu kembali ke sini untuk menyelesaikan.',
   'World App will open to': 'World App akan terbuka untuk',
   ". Keep this screen open — you'll come back here to finish.":
      '. Biarkan layar ini tetap terbuka — kamu akan kembali ke sini untuk menyelesaikan.',

   // src/components/worldId/useWorldIdVerification.ts
   'You must be logged in to verify your World ID.': 'Kamu harus masuk dulu untuk memverifikasi World ID kamu.',
   'World ID verification was accepted, but the account status did not update.':
      'Verifikasi World ID diterima, tetapi status akun belum diperbarui.',
   'Failed to prepare World ID verification.': 'Gagal menyiapkan verifikasi World ID.',
   'I had a problem with verification': 'Saya mengalami masalah dengan verifikasi',
   'Verification failed.': 'Verifikasi gagal.',
   'Opening World ID': 'Membuka World ID',

   // src/components/mecha/mechaCopy.ts
   'Moodeng Support Officer': 'Petugas Dukungan Moodeng',
   'Ask me anything about Moodeng…': 'Tanya apa saja tentang Moodeng…',
   Send: 'Kirim',
   "Hi, I'm Mecha 🤖 — ask me anything about Moodeng: verifying, wallets, borrowing, or cashing out.":
      'Hai, aku Mecha 🤖 — tanya apa saja tentang Moodeng: verifikasi, dompet, meminjam, atau mencairkan dana.',
   'Try asking': 'Coba tanyakan',
   'Talk to the team': 'Bicara dengan tim',
   'Want a real person? I can pass this chat to the Moodeng team.':
      'Mau bicara dengan orang sungguhan? Aku bisa meneruskan chat ini ke tim Moodeng.',
   'Connect me with the team': 'Hubungkan aku dengan tim',
   'Sent! The team has your question and will follow up. You can keep chatting with me too.':
      'Terkirim! Tim sudah menerima pertanyaanmu dan akan menindaklanjutinya. Kamu juga tetap bisa chat denganku.',
   'How can the team reach you? (optional)': 'Bagaimana tim bisa menghubungimu? (opsional)',
   'Something went wrong on my end. Please try again, or I can connect you with the team.':
      'Ada masalah di sisiku. Silakan coba lagi, atau aku bisa menghubungkanmu dengan tim.',
   'Chat with Mecha': 'Chat dengan Mecha',
   'Close chat': 'Tutup chat',
   'Ask Mecha anything, or browse the popular guides below.': 'Tanya Mecha apa saja, atau lihat panduan populer di bawah.',
   'Popular right now': 'Populer saat ini',
   'Mecha answers from Moodeng’s help docs.': 'Mecha menjawab berdasarkan dokumen bantuan Moodeng.',
   'Browse all FAQs & guides →': 'Lihat semua FAQ & panduan →',
   'Mecha is typing': 'Mecha sedang mengetik',
   Helpful: 'Membantu',
   'Not helpful': 'Tidak membantu',
   'Thanks for the feedback!': 'Terima kasih atas masukannya!',

   // src/config/avatarBackgrounds.ts (aria-label `${name} avatar background`)
   'Purple avatar background': 'Latar avatar ungu',
   'Mint avatar background': 'Latar avatar hijau mint',
   'Sky avatar background': 'Latar avatar biru langit',
   'Peach avatar background': 'Latar avatar persik',
   'Rose avatar background': 'Latar avatar merah muda',
   'Lemon avatar background': 'Latar avatar kuning lemon',
   'Stone avatar background': 'Latar avatar abu-abu',
   'Night avatar background': 'Latar avatar gelap',

   // src/config/stripeOnrampConfig.ts
   'US (excl. Hawaii) and EU only': 'Hanya AS (kecuali Hawaii) dan UE',

   // src/constants/dates.ts
   January: 'Januari',
   February: 'Februari',
   March: 'Maret',
   April: 'April',
   May: 'Mei',
   June: 'Juni',
   July: 'Juli',
   August: 'Agustus',
   September: 'September',
   October: 'Oktober',
   November: 'November',
   December: 'Desember',
   Aug: 'Agu',
   Oct: 'Okt',
   Dec: 'Des',

   // src/constants/errorMessages.ts
   'We encountered an unexpected error. Please try again or contact support if the problem persists.':
      'Terjadi kesalahan tak terduga. Silakan coba lagi atau hubungi dukungan jika masalahnya berlanjut.',
   'Go to Dashboard': 'Ke Dasbor',

   // src/constants/loanOptions.ts
   '0% to 5%': '0% hingga 5%',
   '5% to 10%': '5% hingga 10%',
   '10% to 20%': '10% hingga 20%',
   'Next Week': 'Minggu depan',
   'Next 30 Days': '30 hari ke depan',
   'Next 60 Days': '60 hari ke depan',
   'After 90 Days+': 'Setelah 90+ hari',
   'Beginner Borrower': 'Peminjam Pemula',

   // src/hooks/useDefaultedBorrowerSupport.ts
   'Unable to check overdue loans.': 'Tidak bisa memeriksa pinjaman yang terlambat.',

   // src/hooks/useLoanData.ts
   'Failed to fetch loans': 'Gagal memuat pinjaman',

   // src/hooks/useWallet.ts
   'I had a problem with a wallet transaction': 'Saya mengalami masalah dengan transaksi dompet',

   // src/hooks/useWalletSync.ts
   'Successfully connected to': 'Berhasil terhubung ke',
   'Use your Instant Wallet or a Base Account': 'Gunakan Instant Wallet atau Base Account kamu',
   'Borrowers use their Instant Wallet (or a Base Account, if they prefer) so loans and repayments stay tied to one public record.':
      'Peminjam memakai Instant Wallet (atau Base Account, jika lebih suka) agar pinjaman dan pembayaran kembali tetap terikat pada satu catatan publik.',
   'Saved wallet mismatch': 'Dompet tersimpan tidak cocok',
   'This account is saved to': 'Akun ini tersimpan ke',
   '. Switch back to that wallet, or update the saved wallet from Account Settings.':
      '. Beralih kembali ke dompet itu, atau perbarui dompet tersimpan dari Pengaturan akun.',
   'We could not save the new wallet. Your previous wallet is still saved. Please try again.':
      'Kami tidak bisa menyimpan dompet baru. Dompet sebelumnya masih tersimpan. Silakan coba lagi.',
   'Wallet Already Attached': 'Dompet Sudah Terhubung',
   'This wallet is already connected to another account. Please use a different wallet or disconnect it from the other account first.':
      'Dompet ini sudah terhubung ke akun lain. Gunakan dompet lain, atau putuskan dulu koneksinya dari akun tersebut.',
   'Sign in again': 'Masuk lagi',
   'Your login session expired before Moodeng could lock this wallet. Please sign in again, then connect your wallet.':
      'Sesi login kamu berakhir sebelum Moodeng bisa mengunci dompet ini. Silakan masuk lagi, lalu hubungkan dompetmu.',
   'Failed to Connect Wallet': 'Gagal Menghubungkan Dompet',
   'Could not save wallet connection. This might occur if the wallet is already in use. Error:':
      'Tidak bisa menyimpan koneksi dompet. Ini bisa terjadi jika dompet sudah dipakai. Kesalahan:',

   // src/lib/basePay.ts
   'Payment failed': 'Pembayaran gagal',
   'Payment status unavailable': 'Status pembayaran tidak tersedia',
   'Payment failed on-chain': 'Pembayaran gagal on-chain',
   'Payment was not confirmed in time': 'Pembayaran tidak terkonfirmasi tepat waktu',

   // src/lib/borrowerContextFit.ts (profile paragraph and timing chips on the request board)
   'under $200': 'di bawah $200',
   'over $700': 'di atas $700',
   'under $50': 'di bawah $50',
   'over $300': 'di atas $300',
   'family needs': 'kebutuhan keluarga',
   'emergency costs': 'biaya darurat',
   'work supplies': 'perlengkapan kerja',
   'no income shared': 'penghasilan tidak dibagikan',
   'unclear date': 'tanggal belum jelas',
   '(paid weekly)': '(gajian mingguan)',
   '(paid end of the month)': '(gajian akhir bulan)',
   'from being': 'dari pekerjaan sebagai',
   'as main source of income': 'sebagai sumber penghasilan utama',
   'as other source of income': 'sebagai sumber penghasilan lain',
   'on the side': 'sebagai sampingan',
   'a month on': 'per bulan untuk',
   'each month.': 'setiap bulan.',
   'cover essentials': 'menutup kebutuhan pokok',
   'this cycle.': 'untuk siklus ini.',
   'This borrower': 'Peminjam ini',
   'First time trusting this community': 'Pertama kali memercayai komunitas ini',
   'Already repaid 1 loan — they follow through': 'Sudah melunasi 1 pinjaman — terbukti menepati janji',
   'loans and always came back': 'pinjaman dan selalu kembali',
   'Repaid 2 loans and always came back': 'Sudah melunasi 2 pinjaman dan selalu kembali',
   'Repaid 3 loans and always came back': 'Sudah melunasi 3 pinjaman dan selalu kembali',
   'Repaid 4 loans and always came back': 'Sudah melunasi 4 pinjaman dan selalu kembali',
   "loans repaid — one of the community's reliable borrowers": 'pinjaman lunas — salah satu peminjam andal di komunitas ini',
   '· Identity verified': '· Identitas terverifikasi',
   '· due today': '· jatuh tempo hari ini',
   '· due tomorrow': '· jatuh tempo besok',

   // src/lib/borrowerCreditUsage.ts
   'Less than a day': 'Kurang dari sehari',
   '1 day': '1 hari',
   Posted: 'Diposting',
   'left on the board': 'tersisa di papan',
   'days left on the board': 'hari tersisa di papan',

   // src/lib/loanNotes/api.ts
   'A Moodeng borrower': 'Seorang peminjam Moodeng',
   'Failed to record funding': 'Gagal mencatat pendanaan',
   'Failed to record purchase': 'Gagal mencatat pembelian',

   // src/lib/loanRequestRepostStatus.ts
   'You can make another loan request in about 1 minute.': 'Kamu bisa membuat permintaan pinjaman lagi dalam sekitar 1 menit.',
   'You can make another loan request in about 2 minutes.': 'Kamu bisa membuat permintaan pinjaman lagi dalam sekitar 2 menit.',
   'You can make another loan request in about 3 minutes.': 'Kamu bisa membuat permintaan pinjaman lagi dalam sekitar 3 menit.',
   'You can make another loan request in about 4 minutes.': 'Kamu bisa membuat permintaan pinjaman lagi dalam sekitar 4 menit.',
   'You can make another loan request in about 5 minutes.': 'Kamu bisa membuat permintaan pinjaman lagi dalam sekitar 5 menit.',
   'You can make another loan request in about 6 minutes.': 'Kamu bisa membuat permintaan pinjaman lagi dalam sekitar 6 menit.',
   'You can make another loan request in about 7 minutes.': 'Kamu bisa membuat permintaan pinjaman lagi dalam sekitar 7 menit.',
   'You can make another loan request in about 8 minutes.': 'Kamu bisa membuat permintaan pinjaman lagi dalam sekitar 8 menit.',
   'You can make another loan request in about 9 minutes.': 'Kamu bisa membuat permintaan pinjaman lagi dalam sekitar 9 menit.',
   'You can make another loan request in about 10 minutes.': 'Kamu bisa membuat permintaan pinjaman lagi dalam sekitar 10 menit.',
   'You can make another loan request in about 11 minutes.': 'Kamu bisa membuat permintaan pinjaman lagi dalam sekitar 11 menit.',
   'You can make another loan request in about 12 minutes.': 'Kamu bisa membuat permintaan pinjaman lagi dalam sekitar 12 menit.',
   'You can make another loan request in about 13 minutes.': 'Kamu bisa membuat permintaan pinjaman lagi dalam sekitar 13 menit.',
   'You can make another loan request in about 14 minutes.': 'Kamu bisa membuat permintaan pinjaman lagi dalam sekitar 14 menit.',
   'You can make another loan request in about 15 minutes.': 'Kamu bisa membuat permintaan pinjaman lagi dalam sekitar 15 menit.',
   'You can make another loan request in about 16 minutes.': 'Kamu bisa membuat permintaan pinjaman lagi dalam sekitar 16 menit.',
   'You can make another loan request in about 17 minutes.': 'Kamu bisa membuat permintaan pinjaman lagi dalam sekitar 17 menit.',
   'You can make another loan request in about 18 minutes.': 'Kamu bisa membuat permintaan pinjaman lagi dalam sekitar 18 menit.',
   'You can make another loan request in about 19 minutes.': 'Kamu bisa membuat permintaan pinjaman lagi dalam sekitar 19 menit.',
   'You can make another loan request in about 20 minutes.': 'Kamu bisa membuat permintaan pinjaman lagi dalam sekitar 20 menit.',
   'You can make another loan request in about 21 minutes.': 'Kamu bisa membuat permintaan pinjaman lagi dalam sekitar 21 menit.',
   'You can make another loan request in about 22 minutes.': 'Kamu bisa membuat permintaan pinjaman lagi dalam sekitar 22 menit.',
   'You can make another loan request in about 23 minutes.': 'Kamu bisa membuat permintaan pinjaman lagi dalam sekitar 23 menit.',
   'You can make another loan request in about 24 minutes.': 'Kamu bisa membuat permintaan pinjaman lagi dalam sekitar 24 menit.',
   'You can make another loan request in about 25 minutes.': 'Kamu bisa membuat permintaan pinjaman lagi dalam sekitar 25 menit.',
   'You can make another loan request in about 26 minutes.': 'Kamu bisa membuat permintaan pinjaman lagi dalam sekitar 26 menit.',
   'You can make another loan request in about 27 minutes.': 'Kamu bisa membuat permintaan pinjaman lagi dalam sekitar 27 menit.',
   'You can make another loan request in about 28 minutes.': 'Kamu bisa membuat permintaan pinjaman lagi dalam sekitar 28 menit.',
   'You can make another loan request in about 29 minutes.': 'Kamu bisa membuat permintaan pinjaman lagi dalam sekitar 29 menit.',
   'You can make another loan request in about 30 minutes.': 'Kamu bisa membuat permintaan pinjaman lagi dalam sekitar 30 menit.',

   // src/lib/reasonQuality.ts
   'Please write your reason in English — the lenders reading it don’t speak Tagalog.':
      'Tulis alasanmu dalam bahasa Inggris — pemberi pinjaman yang membacanya tidak bisa bahasa Tagalog.',
   'Write it as a sentence — what the money is for and when you get paid.':
      'Tulis dalam bentuk kalimat — untuk apa uangnya dan kapan kamu gajian.',
   "This doesn't look like real words yet — tell lenders what the loan is for.":
      'Ini belum terlihat seperti kata-kata yang jelas — beri tahu pemberi pinjaman untuk apa pinjamannya.',
   'Try saying it once, clearly — repeating words does not help lenders.':
      'Coba sampaikan sekali saja dengan jelas — mengulang kata tidak membantu pemberi pinjaman.',

   // src/lib/supabase/avatarStorage.ts
   'You must be signed in to upload an avatar.': 'Kamu harus masuk dulu untuk mengunggah avatar.',
   'Upload failed:': 'Unggahan gagal:',

   // src/lib/walletProvider.ts
   'your locked wallet': 'dompet terkuncimu',

   // src/lib/web3/openfort/errors.ts
   'Instant Wallet isn’t available right now. Please try again in a little while.':
      'Instant Wallet sedang tidak tersedia. Silakan coba lagi sebentar lagi.',
   "We couldn't reach the wallet service. Check your internet and try again.":
      'Kami tidak bisa menjangkau layanan dompet. Periksa internetmu lalu coba lagi.',
   'Please sign in again, then try creating your wallet.': 'Silakan masuk lagi, lalu coba buat dompetmu.',

   // src/lib/web3/openfort/shieldSession.ts
   'You need to be signed in to create your Instant Wallet.': 'Kamu perlu masuk dulu untuk membuat Instant Wallet.',
   'A quick face check is needed before we can create your Instant Wallet.':
      'Perlu pemeriksaan wajah singkat sebelum kami bisa membuat Instant Wallet kamu.',
   'Could not start wallet recovery session (': 'Tidak bisa memulai sesi pemulihan dompet (',

   // src/lib/web3/openfort/walletFaceGate.ts
   'This face already has a wallet': 'Wajah ini sudah punya dompet',
   'Each person can have one Moodeng Instant Wallet. If you already have a Moodeng account, sign in to that one — or connect a Base Account instead.':
      'Setiap orang hanya bisa punya satu Moodeng Instant Wallet. Jika kamu sudah punya akun Moodeng, masuk ke akun itu — atau hubungkan Base Account saja.',
   "That doesn't match your verified ID": 'Ini tidak cocok dengan ID terverifikasimu',
   'This account was verified with a different face. For your security we can only create the wallet for the verified account holder. Please scan again as the account holder, or contact support.':
      'Akun ini diverifikasi dengan wajah yang berbeda. Demi keamananmu, kami hanya bisa membuat dompet untuk pemilik akun yang terverifikasi. Silakan pindai ulang sebagai pemilik akun, atau hubungi dukungan.',
   "We couldn't complete the scan": 'Kami tidak bisa menyelesaikan pemindaian',
   'Find good, even lighting, remove hats or sunglasses, and hold your phone at eye level. Then try again.':
      'Cari pencahayaan yang terang dan merata, lepas topi atau kacamata hitam, dan pegang ponsel sejajar mata. Lalu coba lagi.',
   'This usually takes a few seconds.': 'Biasanya ini hanya butuh beberapa detik.',
   'A quick face check': 'Pemeriksaan wajah singkat',
   "It takes about ten seconds and keeps wallets to one per person. We don't store your photo.":
      'Hanya sekitar sepuluh detik dan memastikan satu dompet per orang. Kami tidak menyimpan fotomu.',
   'Already have a wallet.': 'Sudah punya dompet.',

   // src/lib/withTimeout.ts
   'Wallet did not respond in time': 'Dompet tidak merespons tepat waktu',

   // src/lib/withdraw/cashoutFaceGate.ts
   "This doesn't match the account holder": 'Ini tidak cocok dengan pemilik akun',
   'For your protection we could not confirm this is the person who verified this account. This cash-out has been held and our team has been notified. Please contact support.':
      'Demi perlindunganmu, kami tidak bisa memastikan bahwa ini orang yang memverifikasi akun ini. Pencairan dana ini ditahan dan tim kami sudah diberi tahu. Silakan hubungi dukungan.',
   'We need to verify you manually': 'Kami perlu memverifikasimu secara manual',
   "We couldn't find a reference photo on file to check against. Please contact support to complete this cash-out.":
      'Kami tidak menemukan foto rujukan untuk dicocokkan. Silakan hubungi dukungan untuk menyelesaikan pencairan dana ini.',
   'Quick check before you cash out': 'Pemeriksaan singkat sebelum mencairkan dana',
   "Since this is your first cash-out, we need a quick face check to confirm it's really you. It takes about ten seconds.":
      'Karena ini pencairan dana pertamamu, kami perlu pemeriksaan wajah singkat untuk memastikan ini benar-benar kamu. Hanya sekitar sepuluh detik.',

   // src/lib/worldIdVerificationLabel.ts
   'Verified Lender': 'Pemberi pinjaman terverifikasi',

   // src/shared/points.ts (milestone and point-event titles in the points history)
   'Build a 2-loan on-time streak': 'Lunasi 2 pinjaman tepat waktu berturut-turut',
   'Repay a full-limit credit-builder': 'Lunasi Credit-Building Loan senilai limit penuh',
   'Borrow from 2 different lenders': 'Pinjam dari 2 pemberi pinjaman berbeda',
   'Reach Credit Level 3': 'Capai Level Kredit 3',
   'Become a trusted borrower candidate': 'Jadi kandidat peminjam tepercaya',
   'Loan funded': 'Pinjaman didanai',
   'Academy quiz': 'Kuis Academy',

   // src/store/slices/authSlice.ts
   'An account with this email already exists. Sign in instead, or reset your password if you need to regain access.':
      'Sudah ada akun dengan email ini. Masuk saja, atau atur ulang kata sandimu jika perlu mendapatkan akses kembali.',
   'User profile not found': 'Profil pengguna tidak ditemukan',
   'Please verify your email before signing in. Check your inbox or request a new verification email.':
      'Verifikasi emailmu dulu sebelum masuk. Cek kotak masuk atau minta email verifikasi baru.',
   'Please verify your email before signing in. A verification email has been sent to your inbox.':
      'Verifikasi emailmu dulu sebelum masuk. Email verifikasi sudah dikirim ke kotak masukmu.',
   'Not authenticated': 'Belum masuk',
   'Failed to save borrower context': 'Gagal menyimpan info peminjam',
   'Failed to update user role': 'Gagal memperbarui peran pengguna',

   // src/store/slices/loanSlice.ts
   'Payment is not confirmed on-chain yet': 'Pembayaran belum terkonfirmasi on-chain',
   'Failed to create loan': 'Gagal membuat pinjaman',
   'Failed to fetch user loans': 'Gagal memuat pinjaman pengguna',
   'Failed to update loan': 'Gagal memperbarui pinjaman',
   'Failed to confirm loan payment': 'Gagal mengonfirmasi pembayaran pinjaman',
   'Failed to delete loan': 'Gagal menghapus pinjaman',
   'Could not load loan before updating it': 'Tidak bisa memuat pinjaman sebelum memperbaruinya',
   'This loan request has expired. Ask the borrower to post a new request.':
      'Permintaan pinjaman ini sudah kedaluwarsa. Minta peminjam untuk memposting permintaan baru.',
   'Loan request was not deleted': 'Permintaan pinjaman tidak terhapus',

   // src/types/loanTypes.ts (loan and repayment status in the transactions table)
   Lent: 'Didanai',
   Unpaid: 'Belum dibayar',
   Partial: 'Sebagian'
};
