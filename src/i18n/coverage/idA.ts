// Indonesian translations for on-screen English copy that has no entry in screenTranslations.ts,
// keyed by the exact English text. Loaded on demand by LocalizationDomBridge (see ./index.ts).
export const indonesianCoverageA: Record<string, string> = {
   // src/app/account-restricted/page.tsx
   'Account support': 'Dukungan akun',
   'Repay Now': 'Bayar Sekarang',
   'Message Support': 'Chat Dukungan',
   'Loading account support': 'Memuat dukungan akun',
   'Sign in to view account support': 'Masuk untuk melihat dukungan akun',
   'We could not confirm your account status.': 'Kami tidak bisa memastikan status akunmu.',
   'Your session is not active in this browser. Sign in again, or message Moodeng Credit support if you need help.':
      'Sesimu tidak aktif di browser ini. Masuk lagi, atau hubungi dukungan Moodeng Credit jika kamu butuh bantuan.',
   'We could not load the repayment details for this account. Message Moodeng Credit support so we can review it.':
      'Kami tidak bisa memuat detail pembayaran kembali untuk akun ini. Hubungi dukungan Moodeng Credit agar kami bisa memeriksanya.',
   'Borrowing is paused while this loan is overdue. You are still signed in, and you can repay now or message support for help.':
      'Fitur meminjam dijeda selama pinjaman ini terlambat. Kamu tetap masuk, dan kamu bisa bayar sekarang atau hubungi dukungan untuk bantuan.',
   'If you think this is a mistake, message Moodeng Credit support on Messenger. We can review your account from there.':
      'Jika menurutmu ini keliru, hubungi dukungan Moodeng Credit lewat Messenger. Kami bisa memeriksa akunmu dari sana.',
   'Your account is currently banned.': 'Akunmu saat ini diblokir permanen.',
   'Your account is currently blocked.': 'Akunmu saat ini diblokir.',
   'Signing out...': 'Sedang keluar...',
   'Log out': 'Keluar',

   // src/app/auth-success/page.tsx
   'Your account has been created': 'Akunmu sudah dibuat',
   'Your wallet is used to earn Pandesal points and receive USDC loans.':
      'Dompetmu dipakai untuk mengumpulkan poin Pandesal dan menerima pinjaman USDC.',
   'Open the latest Moodeng email.': 'Buka email terbaru dari Moodeng.',
   'Sent to': 'Dikirim ke',
   Tap: 'Ketuk',
   'inside that email to finish setup.': 'di email tersebut untuk menyelesaikan pendaftaran.',
   'Enter reset code': 'Masukkan kode reset',
   'Enter the code from your email': 'Masukkan kode dari email',
   'If the email is hard to find, check spam or promotions and open the latest Moodeng email.':
      'Jika email sulit ditemukan, cek folder spam atau promosi, lalu buka email terbaru dari Moodeng.',
   'Check your email': 'Cek email kamu',
   'Email confirmed': 'Email terkonfirmasi',
   'Enter the 8-digit code from the latest Moodeng email to set a password for this account.':
      'Masukkan kode 8 digit dari email terbaru Moodeng untuk membuat kata sandi akun ini.',
   'Your email link was accepted. Sign in to continue if Moodeng did not open your account automatically.':
      'Link email kamu diterima. Masuk untuk melanjutkan jika Moodeng tidak membuka akunmu secara otomatis.',
   'Confirm Email': 'Konfirmasi Email',

   // src/app/auth/confirm/page.tsx
   'Account access': 'Akses akun',
   'This account can’t sign in': 'Akun ini tidak bisa masuk',
   'It has been suspended. If you think this is a mistake, email us and we’ll look into it.':
      'Akun ini ditangguhkan. Jika menurutmu ini keliru, kirim email ke kami dan kami akan memeriksanya.',
   'Email support@moodeng.app': 'Kirim email ke support@moodeng.app',
   'Back to sign in': 'Kembali ke halaman masuk',
   'This link did not work': 'Link ini tidak berfungsi',
   'Moodeng holding a lock': 'Moodeng memegang gembok',
   'We could not finish checking your email session. Please sign in again.':
      'Kami tidak bisa menyelesaikan pengecekan sesi email kamu. Silakan masuk lagi.',
   'Reset links can be opened only once and expire quickly. Request a fresh 8-digit code and enter it directly — no link needed.':
      'Link reset hanya bisa dibuka sekali dan cepat kedaluwarsa. Minta kode 8 digit yang baru lalu masukkan langsung — tanpa perlu link.',
   'Open the latest Moodeng email and enter the 8-digit code below to finish confirming your account.':
      'Buka email terbaru dari Moodeng lalu masukkan kode 8 digit di bawah untuk menyelesaikan konfirmasi akunmu.',
   'Open the latest Moodeng email and try again, or sign in to request a new link.':
      'Buka email terbaru dari Moodeng lalu coba lagi, atau masuk untuk meminta link baru.',
   'Request a new reset code': 'Minta kode reset baru',

   // src/app/auth/telegram/callback/page.tsx
   'Telegram login failed': 'Login Telegram gagal',
   'Telegram login failed.': 'Login Telegram gagal.',
   'Missing Telegram auth data. Please try again.': 'Data login Telegram tidak ditemukan. Silakan coba lagi.',
   'Unexpected error during Telegram login.': 'Terjadi error tak terduga saat login Telegram.',

   // src/app/auth/verify-code/page.tsx
   'Welcome to Moodeng': 'Selamat datang di Moodeng',
   'Confirm your email': 'Konfirmasi email kamu',
   'Enter the 8-digit code from the latest Moodeng email to finish setting up your account.':
      'Masukkan kode 8 digit dari email terbaru Moodeng untuk menyelesaikan pembuatan akunmu.',
   'Verification code': 'Kode verifikasi',
   'Verify email': 'Verifikasi email',
   'Already verified? Log in': 'Sudah terverifikasi? Masuk',
   'Back to sign up': 'Kembali ke pendaftaran',
   'Moodeng holding an envelope': 'Moodeng memegang amplop',
   'Enter the email address you used to sign up.': 'Masukkan alamat email yang kamu pakai untuk mendaftar.',
   'Email verification is not configured in this local app.': 'Verifikasi email belum diatur di aplikasi lokal ini.',
   'That code did not work. Check the latest email from Moodeng and try again.':
      'Kode itu tidak berhasil. Cek email terbaru dari Moodeng lalu coba lagi.',
   'Enter your email first, then resend the code.': 'Masukkan email kamu dulu, lalu kirim ulang kodenya.',
   'Could not resend the code. Try again in a moment.': 'Kode gagal dikirim ulang. Coba lagi sebentar lagi.',
   'New code sent. Use the latest email from Moodeng.': 'Kode baru sudah dikirim. Gunakan email terbaru dari Moodeng.',
   'Enter the 8-digit code from your email.': 'Masukkan kode 8 digit dari email kamu.',
   'Resend code': 'Kirim ulang kode',

   // src/app/data-deletion/page.tsx
   Overview: 'Ringkasan',
   'Moodeng Credit ("Moodeng", "we", "our", or "us") lets you request deletion of the personal information associated with your account, including data obtained when you sign in with a third-party provider such as Facebook, Google, LINE, or Telegram.':
      'Moodeng Credit ("Moodeng" atau "kami") memungkinkan kamu meminta penghapusan informasi pribadi yang terkait dengan akunmu, termasuk data yang diperoleh saat kamu masuk lewat penyedia pihak ketiga seperti Facebook, Google, LINE, atau Telegram.',
   'This page explains how to submit a deletion request and what to expect after you do.':
      'Halaman ini menjelaskan cara mengajukan permintaan penghapusan dan apa yang terjadi setelahnya.',
   'How to request deletion': 'Cara meminta penghapusan',
   'from the email address on your account, with the subject line': 'dari alamat email yang terdaftar di akunmu, dengan subjek',
   '. To help us locate your records, please include:': '. Agar kami bisa menemukan datamu, sertakan:',
   'The email address or wallet address associated with your account': 'Alamat email atau alamat dompet yang terkait dengan akunmu',
   'The login method you used (Facebook, Google, LINE, Telegram, or email)':
      'Metode login yang kamu pakai (Facebook, Google, LINE, Telegram, atau email)',
   'Confirmation that you want your personal data deleted': 'Konfirmasi bahwa kamu ingin data pribadimu dihapus',
   'We will confirm receipt and verify your identity before processing the request.':
      'Kami akan mengonfirmasi penerimaan dan memverifikasi identitasmu sebelum memproses permintaan.',
   'What gets deleted': 'Apa yang dihapus',
   'We delete the personal information we hold about you, including your profile, contact details, and the identifiers received from your login provider. We aim to complete verified requests within 30 days.':
      'Kami menghapus informasi pribadi tentangmu yang kami simpan, termasuk profil, detail kontak, dan pengenal yang kami terima dari penyedia login. Kami berupaya menyelesaikan permintaan yang sudah diverifikasi dalam 30 hari.',
   'What we may retain': 'Apa yang mungkin tetap kami simpan',
   'Some information may be retained where we are legally required or permitted to keep it — for example, to comply with financial, anti-fraud, anti-money-laundering, tax, or recordkeeping obligations, or to resolve disputes and enforce agreements.':
      'Sebagian informasi mungkin tetap disimpan jika hukum mewajibkan atau mengizinkan kami menyimpannya — misalnya untuk memenuhi kewajiban keuangan, antipenipuan, antipencucian uang, pajak, atau pencatatan, atau untuk menyelesaikan sengketa dan menegakkan perjanjian.',
   'In addition, certain repayment history, trust metrics, and transaction records may have been recorded on public blockchain networks. Blockchain records are publicly visible and generally cannot be modified or deleted after publication.':
      'Selain itu, sebagian riwayat pembayaran kembali, metrik kepercayaan, dan catatan transaksi mungkin sudah tercatat di jaringan blockchain publik. Catatan blockchain bisa dilihat publik dan umumnya tidak bisa diubah atau dihapus setelah dipublikasikan.',
   'Data deletion and privacy requests:': 'Permintaan penghapusan data dan privasi:',
   'General support:': 'Dukungan umum:',
   'Data Deletion Instructions | Moodeng Credit': 'Petunjuk Penghapusan Data | Moodeng Credit',
   'How to request deletion of the personal data tied to your Moodeng Credit account, what gets deleted, and what we may retain for legal reasons.':
      'Cara meminta penghapusan data pribadi yang terkait dengan akun Moodeng Credit kamu, apa yang dihapus, dan apa yang mungkin tetap kami simpan karena alasan hukum.',
   '← Back to Moodeng Credit': '← Kembali ke Moodeng Credit',
   'Data Deletion Instructions': 'Petunjuk Penghapusan Data',
   'The short version: email': 'Singkatnya: kirim email ke',
   "and we'll delete the personal data tied to your account, subject to legal retention requirements.":
      'dan kami akan menghapus data pribadi yang terkait dengan akunmu, sesuai ketentuan penyimpanan data yang diwajibkan hukum.',
   'Last updated: June 2026': 'Terakhir diperbarui: Juni 2026',
   'Looking for our Privacy Policy?': 'Mencari Kebijakan Privasi kami?',
   'View Privacy Policy →': 'Lihat Kebijakan Privasi →',
   '"Data deletion request"': '"Data deletion request" (permintaan penghapusan data)',

   // src/app/forgot-password/page.tsx
   'Could not send a reset code. Try again in a moment.': 'Kode reset gagal dikirim. Coba lagi sebentar lagi.',
   'Could not verify that code. Try again in a moment.': 'Kode itu gagal diverifikasi. Coba lagi sebentar lagi.',
   'Password reset is not configured in this local app.': 'Reset kata sandi belum diatur di aplikasi lokal ini.',
   'Enter the email address on your Moodeng account.': 'Masukkan alamat email akun Moodeng kamu.',
   'If an account exists for that email, an 8-digit code is on its way. Enter it below to continue.':
      'Jika ada akun dengan email itu, kode 8 digit sedang dikirim. Masukkan di bawah untuk melanjutkan.',
   'That code is invalid or expired. Check the latest email or request a new code.':
      'Kode itu tidak valid atau sudah kedaluwarsa. Cek email terbaru atau minta kode baru.',
   'A new code is on its way. Use the latest email from Moodeng.': 'Kode baru sedang dikirim. Gunakan email terbaru dari Moodeng.',
   'Back to email entry': 'Kembali ke pengisian email',
   'Enter your code': 'Masukkan kodemu',
   'Reset your password': 'Reset kata sandi',
   'Enter your email and Moodeng will send an 8-digit code to reset your password.':
      'Masukkan email kamu dan Moodeng akan mengirim kode 8 digit untuk mereset kata sandimu.',
   'Verify code': 'Verifikasi kode',
   'Send reset code': 'Kirim kode reset',

   // src/app/lender/request-board/page.tsx
   'Lender Request Board': 'Papan Permintaan Pemberi Pinjaman',

   // src/app/mfa-challenge/page.tsx
   'That code did not work. Try again.': 'Kode itu tidak berhasil. Coba lagi.',
   "Verify it's you": 'Verifikasi bahwa ini kamu',
   'Enter the code from your authenticator app to finish signing in.':
      'Masukkan kode dari aplikasi autentikator untuk menyelesaikan proses masuk.',
   'Lost access to your authenticator app? Contact support': 'Tidak bisa mengakses aplikasi autentikator? Hubungi dukungan',
   'Enter the 6-digit code from your authenticator app': 'Masukkan kode 6 digit dari aplikasi autentikator',
   'Two-factor authentication': 'Autentikasi dua faktor',
   'Not you? Sign out': 'Bukan kamu? Keluar',

   // src/app/reset-password/page.tsx
   'The reset link is invalid or expired. Request a new one and use the latest email from Moodeng.':
      'Link reset tidak valid atau sudah kedaluwarsa. Minta link baru dan gunakan email terbaru dari Moodeng.',
   'Open the reset link from your email, or request a new password reset link.':
      'Buka link reset dari email kamu, atau minta link reset kata sandi yang baru.',
   'Could not open this reset link. Request a new one.': 'Link reset ini tidak bisa dibuka. Minta link baru.',
   'Passwords do not match.': 'Kata sandi tidak cocok.',
   'Use at least 8 characters for your new password.': 'Gunakan minimal 8 karakter untuk kata sandi barumu.',
   'Open the reset link from your email before setting a new password.': 'Buka link reset dari email kamu sebelum membuat kata sandi baru.',
   'Could not update your password. Try again in a moment.': 'Kata sandi gagal diperbarui. Coba lagi sebentar lagi.',
   'Password updated': 'Kata sandi diperbarui',
   'Your account is secure now.': 'Akunmu sekarang sudah aman.',
   'Password updated. Taking you to your dashboard now.': 'Kata sandi diperbarui. Mengarahkanmu ke dasbor sekarang.',
   'Hide passwords': 'Sembunyikan kata sandi',
   'Show passwords': 'Tampilkan kata sandi',
   'New password': 'Kata sandi baru',
   'Secure your account': 'Amankan akunmu',
   'Choose a new password for your Moodeng account.': 'Buat kata sandi baru untuk akun Moodeng kamu.',
   'Reset links can only be used once and expire quickly. Tap below to send yourself a fresh link, then open the newest Moodeng email.':
      'Link reset hanya bisa dipakai sekali dan cepat kedaluwarsa. Ketuk di bawah untuk mengirim link baru, lalu buka email terbaru dari Moodeng.',
   'Request a new link': 'Minta link baru',
   'This reset link is ready. Enter matching passwords to continue.':
      'Link reset ini siap dipakai. Masukkan kata sandi yang sama dua kali untuk melanjutkan.',
   'Enter new password': 'Masukkan kata sandi baru',
   'Use at least 8 characters.': 'Gunakan minimal 8 karakter.',
   'Confirm password': 'Konfirmasi kata sandi',
   'Re-enter new password': 'Masukkan ulang kata sandi baru',
   'Updating…': 'Memperbarui…',
   'Update password': 'Perbarui kata sandi',

   // src/app/role-selection/page.tsx
   'Moodeng hippo': 'Kuda nil Moodeng',

   // src/app/simple/page.tsx
   'Simple Page - CSS and Navigation working!': 'Halaman Sederhana - CSS dan navigasi berfungsi!',

   // src/app/team/page.tsx
   'Project Co-Lead': 'Co-Lead Proyek',
   'Repeat founder and product builder working to help people build credit through practical systems that are clear, fair, and useful in real life.':
      'Pendiri berpengalaman dan pembangun produk yang membantu orang membangun kredit lewat sistem praktis yang jelas, adil, dan berguna di kehidupan nyata.',
   'Ex-UNHCR Data Team Lead': 'Mantan Ketua Tim Data UNHCR',
   'Former Portfolio Manager': 'Mantan Manajer Portofolio',
   '1 Exit': '1 Exit',
   '2 Prior Startups': '2 Startup Sebelumnya',
   'Leads growth and community storytelling for Moodeng Credit, turning borrower education, social content, and campaign feedback into clearer trust-building moments.':
      'Memimpin pertumbuhan dan storytelling komunitas untuk Moodeng Credit, mengubah edukasi peminjam, konten media sosial, dan masukan kampanye menjadi momen membangun kepercayaan yang lebih jelas.',
   'Growth Marketing': 'Growth Marketing',
   'Borrower Education': 'Edukasi Peminjam',
   'Community Campaigns': 'Kampanye Komunitas',
   'Member of Technical Team': 'Anggota Tim Teknis',
   'Backend engineer building scalable APIs, cloud systems, and product flows for Moodeng Credit.':
      'Backend engineer yang membangun API yang skalabel, sistem cloud, dan alur produk untuk Moodeng Credit.',
   'Backend Engineer': 'Backend Engineer',
   'App Flows': 'Alur Aplikasi',
   'Working on Partnerships': 'Mengurus Kemitraan',
   'Supports Moodeng Credit with partnerships, lender outreach, and growth channels, while also working at':
      'Mendukung Moodeng Credit dalam kemitraan, penjangkauan pemberi pinjaman, dan kanal pertumbuhan, sambil juga bekerja di',
   'helping teams connect with blockchain data infrastructure.': 'yang membantu tim terhubung dengan infrastruktur data blockchain.',
   'Head of Growth': 'Kepala Pertumbuhan',
   'Growth Hacking': 'Growth Hacking',
   'Blockchain Analysis': 'Analisis Blockchain',
   'Digital Marketing': 'Pemasaran Digital',
   'Marketing Automation': 'Otomasi Pemasaran',
   'Working on Building Community': 'Mengurus Pembangunan Komunitas',
   'Builds stories and visual direction for Moodeng Credit, helping turn community ideas into growth narratives people can understand, share, and rally around.':
      'Membangun cerita dan arahan visual untuk Moodeng Credit, membantu mengubah ide komunitas menjadi narasi pertumbuhan yang mudah dipahami, dibagikan, dan didukung banyak orang.',
   Storytelling: 'Storytelling',
   'Visual Direction': 'Arahan Visual',
   'Narrative Setting': 'Penyusunan Narasi',
   Advisor: 'Penasihat',
   'US Army Officer, Mercury Labs founder, and sports/Web3 operator advising Moodeng Credit on investor strategy, brand positioning, and disciplined growth.':
      'Perwira Angkatan Darat AS, pendiri Mercury Labs, dan operator di bidang olahraga/Web3 yang menjadi penasihat Moodeng Credit untuk strategi investor, positioning merek, dan pertumbuhan yang disiplin.',
   'US Army Officer': 'Perwira Angkatan Darat AS',
   Sports: 'Olahraga',
   Writer: 'Penulis',
   Management: 'Manajemen',
   Marketing: 'Pemasaran',
   'LinkedIn Profile': 'Profil LinkedIn',
   'Our Team | Moodeng Credit': 'Tim Kami | Moodeng Credit',
   'Meet the people building Moodeng Credit — co-founders George and Emma, the founding team, and advisors working on fair, portable credit.':
      'Kenali orang-orang di balik Moodeng Credit — co-founder George dan Emma, tim pendiri, serta para penasihat yang mengupayakan kredit yang adil dan portabel.',
   'Co-Founders': 'Co-Founder',
   'Building a portable trust layer for borrowers who deserve fair credit and lenders who want transparent impact.':
      'Membangun lapisan kepercayaan portabel untuk peminjam yang layak mendapat kredit adil dan pemberi pinjaman yang menginginkan dampak yang transparan.',
   'Additional team members': 'Anggota tim lainnya',
   Website: 'Situs web',
   Advisors: 'Penasihat',

   // src/app/verify-world-id/page.tsx
   'Verify Your Identity': 'Verifikasi Identitas Kamu',
   'To keep Moodeng safe and prevent fake or duplicate accounts, borrowers complete a short one-time identity check.':
      'Agar Moodeng tetap aman dan bebas dari akun palsu atau ganda, peminjam menyelesaikan pengecekan identitas singkat satu kali.',
   'Verify Your ID': 'Verifikasi ID Kamu',
   Recommended: 'Disarankan',
   'Quick national ID & selfie check — available in select countries.': 'Cek cepat kartu identitas & selfie — tersedia di negara tertentu.',
   'Supported countries': 'Negara yang didukung',
   'Not in a supported country?': 'Negaramu tidak didukung?',
   'Verify with World ID': 'Verifikasi dengan World ID',
   'For World App users — verified at an Orb or with a passport.': 'Untuk pengguna World App — terverifikasi di Orb atau dengan paspor.',

   // src/app/verify/page.tsx
   'Retake in bright, even light — no glare or shadows on the ID':
      'Foto ulang di cahaya terang dan merata — tanpa silau atau bayangan di ID',
   'Lay the ID flat and fill the frame; make sure all text is sharp':
      'Letakkan ID secara datar hingga memenuhi bingkai; pastikan semua tulisan terbaca jelas',
   'Use a currently valid (not expired) ID document': 'Gunakan dokumen ID yang masih berlaku (belum kedaluwarsa)',
   'Remove hats, glasses and masks for the selfie': 'Lepas topi, kacamata, dan masker saat selfie',
   'Face the camera straight on, with your whole face visible': 'Hadap lurus ke kamera, dengan seluruh wajah terlihat',
   'Capture the entire ID — all four corners must be visible': 'Foto seluruh ID — keempat sudutnya harus terlihat',
   'Use a government-issued national ID or passport': 'Gunakan kartu identitas resmi dari pemerintah atau paspor',
   'Retake photos in bright, even light': 'Foto ulang di cahaya terang dan merata',
   'Lay the ID flat with all four corners visible': 'Letakkan ID secara datar dengan keempat sudut terlihat',
   'Remove hats and glasses for the selfie': 'Lepas topi dan kacamata saat selfie',
   'Could not start the face scan. Please try again.': 'Pemindaian wajah gagal dimulai. Silakan coba lagi.',
   'Something went wrong. Please try again.': 'Terjadi kesalahan. Silakan coba lagi.',
   'Could not start verification. Please try again.': 'Verifikasi gagal dimulai. Silakan coba lagi.',
   "Tap the button to start the face scan — you'll be brought back here automatically when it's done. Then you'll submit your national ID.":
      'Ketuk tombol untuk memulai pemindaian wajah — kamu akan otomatis kembali ke sini setelah selesai. Setelah itu, kamu akan mengirim kartu identitasmu.',
   "Tap the button to start the face scan — you'll be brought back here automatically when it's done. Then you'll verify with World ID.":
      'Ketuk tombol untuk memulai pemindaian wajah — kamu akan otomatis kembali ke sini setelah selesai. Setelah itu, kamu akan verifikasi dengan World ID.',
   "Tap the button to open the face scan in a new tab. Keep this page open — it will update automatically when done. Then you'll submit your national ID.":
      'Ketuk tombol untuk membuka pemindaian wajah di tab baru. Biarkan halaman ini tetap terbuka — halaman akan diperbarui otomatis setelah selesai. Setelah itu, kamu akan mengirim kartu identitasmu.',
   "Tap the button to open the face scan in a new tab. Keep this page open — it will update automatically when done. Then you'll verify with World ID.":
      'Ketuk tombol untuk membuka pemindaian wajah di tab baru. Biarkan halaman ini tetap terbuka — halaman akan diperbarui otomatis setelah selesai. Setelah itu, kamu akan verifikasi dengan World ID.',
   'Step 1 of 2': 'Langkah 1 dari 2',
   'Ready for face scan': 'Siap untuk pemindaian wajah',
   'Open face scan': 'Buka pemindaian wajah',
   'Setting up…': 'Menyiapkan…',
   'Starting your verification. Keep this screen open.': 'Memulai verifikasimu. Biarkan layar ini tetap terbuka.',
   'Before you start': 'Sebelum mulai',
   "A quick ID + selfie check — about 3 minutes. You'll be brought back here automatically when it's done. Your ID is checked by our secure verification partner and is never stored by Moodeng.":
      'Cek ID + selfie yang cepat — sekitar 3 menit. Kamu akan otomatis kembali ke sini setelah selesai. ID kamu dicek oleh mitra verifikasi kami yang aman dan tidak pernah disimpan oleh Moodeng.',
   'A quick ID + selfie check — about 3 minutes. It opens in a new tab; keep this page open and it will update automatically. Your ID is checked by our secure verification partner and is never stored by Moodeng.':
      'Cek ID + selfie yang cepat — sekitar 3 menit. Verifikasi akan terbuka di tab baru; biarkan halaman ini tetap terbuka dan halaman akan diperbarui otomatis. ID kamu dicek oleh mitra verifikasi kami yang aman dan tidak pernah disimpan oleh Moodeng.',
   'Have your physical national ID with you': 'Siapkan kartu identitas fisik kamu',
   'Find good, even lighting for the selfie': 'Cari pencahayaan yang baik dan merata untuk selfie',
   'Allow camera access when asked': 'Izinkan akses kamera saat diminta',
   'Open verification': 'Buka verifikasi',
   'Go back': 'Kembali',
   'Almost there — hang tight while we finish the check.': 'Sebentar lagi — tunggu ya, kami sedang menyelesaikan pengecekan.',
   'Still checking — face scans usually take a minute or two.': 'Masih mengecek — pemindaian wajah biasanya butuh satu atau dua menit.',
   'Face scan in progress. Complete it in the tab that just opened — this page will update automatically when done.':
      'Pemindaian wajah sedang berlangsung. Selesaikan di tab yang baru terbuka — halaman ini akan diperbarui otomatis setelah selesai.',
   'Waiting for face scan…': 'Menunggu pemindaian wajah…',
   'More options': 'Opsi lainnya',
   'Almost there — we’re finishing the review.': 'Sebentar lagi — kami sedang menyelesaikan peninjauan.',
   'Still confirming — verification usually takes a minute or two.': 'Masih mengonfirmasi — verifikasi biasanya butuh satu atau dua menit.',
   'Finish the steps in the verification tab — this page updates automatically when you’re done.':
      'Selesaikan langkah-langkahnya di tab verifikasi — halaman ini akan diperbarui otomatis setelah kamu selesai.',
   'Confirming your verification…': 'Mengonfirmasi verifikasimu…',
   'Almost there': 'Sebentar lagi',
   'Your face scan is still finishing up. This usually takes a moment. Left before finishing the scan? Start over below for a fresh one.':
      'Pemindaian wajahmu masih dalam proses akhir. Biasanya ini hanya sebentar. Keluar sebelum pemindaian selesai? Mulai ulang di bawah untuk pemindaian baru.',
   'Check again': 'Cek lagi',
   'Start over': 'Mulai ulang',
   'Face scan not finished': 'Pemindaian wajah belum selesai',
   'It looks like the face scan was closed before it was completed. No problem — start a new scan below. It only takes about 30 seconds.':
      'Sepertinya pemindaian wajah ditutup sebelum selesai. Tidak masalah — mulai pemindaian baru di bawah. Hanya butuh sekitar 30 detik.',
   'Start new face scan': 'Mulai pemindaian baru',
   'Reviewing your verification…': 'Meninjau verifikasimu…',
   "Your details are being reviewed. Most checks finish in a few minutes — we'll update this screen automatically when done. Left before finishing all the steps? Start over below.":
      'Datamu sedang ditinjau. Sebagian besar pengecekan selesai dalam beberapa menit — kami akan memperbarui layar ini otomatis setelah selesai. Keluar sebelum semua langkah selesai? Mulai ulang di bawah.',
   'Check status': 'Cek status',
   'Go to dashboard': 'Ke dasbor',
   'Manual review in progress': 'Peninjauan manual sedang berlangsung',
   "Your verification needs a quick human review — this usually takes a few hours but can take up to 1 business day. We'll update your status automatically. Want it faster? Message us below and we'll expedite your review.":
      'Verifikasimu perlu ditinjau singkat oleh tim kami — biasanya butuh beberapa jam, paling lama 1 hari kerja. Kami akan memperbarui statusmu secara otomatis. Ingin lebih cepat? Kirim pesan ke kami di bawah dan kami akan mempercepat peninjauanmu.',
   "Verification didn't pass": 'Verifikasi tidak lolos',
   "We weren't able to verify your identity. This can happen if the document image was unclear, expired, or didn't match your face. A few things that usually fix it:":
      'Kami tidak bisa memverifikasi identitasmu. Ini bisa terjadi jika foto dokumen tidak jelas, dokumen sudah kedaluwarsa, atau tidak cocok dengan wajahmu. Beberapa hal yang biasanya membantu:',
   'Try again': 'Coba lagi',
   "Verification wasn't finished": 'Verifikasi belum selesai',
   'It looks like you left before completing all the steps. Pick up right where you left off, or start over with a fresh session.':
      'Sepertinya kamu keluar sebelum menyelesaikan semua langkah. Lanjutkan dari bagian terakhir, atau mulai ulang dengan sesi baru.',
   "It looks like the verification was closed before all the steps were completed, so we couldn't finish checking your identity. No problem — you can start over any time.":
      'Sepertinya verifikasi ditutup sebelum semua langkah selesai, jadi kami belum bisa menyelesaikan pengecekan identitasmu. Tidak masalah — kamu bisa mulai ulang kapan saja.',
   'Continue verification': 'Lanjutkan verifikasi',
   'Opening…': 'Membuka…',
   'Verified!': 'Terverifikasi!',
   'Your identity has been confirmed. Taking you to the next step.': 'Identitasmu sudah dikonfirmasi. Mengarahkanmu ke langkah berikutnya.',
   'This identity is already registered': 'Identitas ini sudah terdaftar',
   'Our checks found an account already verified with this face. Each person can only verify once. If you think this is a mistake, please contact support.':
      'Pengecekan kami menemukan akun yang sudah terverifikasi dengan wajah ini. Setiap orang hanya bisa verifikasi satu kali. Jika menurutmu ini keliru, silakan hubungi dukungan.',
   'Continue to app': 'Lanjut ke aplikasi',
   "Face scan didn't pass": 'Pemindaian wajah tidak lolos',
   "The scan didn't finish successfully — either it was closed early or we couldn't confirm a live person. Tap Try again for a fresh scan. A few things that help:":
      'Pemindaian tidak selesai dengan baik — mungkin ditutup terlalu cepat atau kami tidak bisa memastikan bahwa ini orang sungguhan. Ketuk Coba lagi untuk memindai ulang. Beberapa hal yang membantu:',
   'Good, even lighting — avoid bright backlighting': 'Pencahayaan baik dan merata — hindari cahaya terang dari belakang',
   'Hold your phone steady and face the camera directly': 'Pegang ponsel dengan stabil dan hadap langsung ke kamera',
   'Remove sunglasses or hats': 'Lepas kacamata hitam atau topi',
   'Make sure your whole face is visible in the frame': 'Pastikan seluruh wajahmu terlihat di dalam bingkai',
   'Something went wrong': 'Terjadi kesalahan',
   'Please try again.': 'Silakan coba lagi.',
   'Continue to World ID': 'Lanjut ke World ID',
   'Requires a passport added to your World App.': 'Butuh paspor yang sudah ditambahkan di World App kamu.',
   'Requires a World ID verified at an Orb.': 'Butuh World ID yang sudah diverifikasi di Orb.',
   'Loading…': 'Memuat…',
   'Preparing verification.': 'Menyiapkan verifikasi.',
   'Step 1 of 2 done': 'Langkah 1 dari 2 selesai',
   'You’re a real person!': 'Kamu orang sungguhan!',
   'You’re not done yet — one last step. Verify with World ID below to finish and unlock your account.':
      'Belum selesai — tinggal satu langkah lagi. Verifikasi dengan World ID di bawah untuk menyelesaikan dan membuka akunmu.',
   'No World ID? Verify with your ID instead': 'Tidak punya World ID? Verifikasi dengan ID kamu saja',
   'Checking…': 'Mengecek…',
   'Need help from our team?': 'Butuh bantuan dari tim kami?',
   'Message us on Telegram': 'Kirim pesan lewat Telegram',
   'Message us on Facebook': 'Kirim pesan lewat Facebook',

   // src/components/Footer.tsx
   'Moodeng Credit logo': 'Logo Moodeng Credit',
   'Social Link': 'Tautan media sosial',

   // src/components/GuidedTourPreview.tsx
   'Want a quick tour?': 'Mau tur singkat?',
   "Pick a side and we'll walk you through it — no account needed.": 'Pilih peranmu dan kami akan memandumu — tanpa perlu akun.',
   'See how Moodeng works in under a minute. You can skip this and use everything normally.':
      'Lihat cara kerja Moodeng dalam kurang dari satu menit. Kamu bisa melewatinya dan tetap memakai semua fitur seperti biasa.',
   'Skip for now': 'Lewati dulu',
   'Start the tour': 'Mulai tur',
   'Take the tour': 'Ikuti tur',
   Skip: 'Lewati',
   Back: 'Kembali',
   Finished: 'Selesai',
   Next: 'Lanjut',

   // src/components/Header/MobileNav.tsx
   'Mobile navigation': 'Navigasi seluler',

   // src/components/InAppBrowserNotice.tsx
   'this app': 'aplikasi ini',
   'Open in Chrome': 'Buka di Chrome',
   'Link copied ✓': 'Link disalin ✓',
   'Copy link': 'Salin link',
   'Open in your browser': 'Buka di browser kamu',
   'Open Moodeng in your browser': 'Buka Moodeng di browser kamu',
   "Sign-in and wallet payments don't work inside": 'Login dan pembayaran lewat dompet tidak berfungsi di dalam',
   '. Tap below to continue in Chrome.': '. Ketuk di bawah untuk lanjut di Chrome.',
   '. Tap': '. Ketuk',
   'at the top, choose': 'di bagian atas, pilih',
   'Open in Browser': 'Buka di Browser',
   ', or copy the link below.': ', atau salin link di bawah.',
   'Not now': 'Nanti saja',
   "Why isn't this working?": 'Kenapa ini tidak berfungsi?',
   'In-app browser notice': 'Pemberitahuan browser dalam aplikasi',
   Dismiss: 'Tutup',

   // src/components/IouPointHistoryModal.tsx
   'IOU Point History': 'Riwayat Poin IOU',
   'No IOU points yet. Fund loan requests to start earning.':
      'Belum ada poin IOU. Danai permintaan pinjaman untuk mulai mengumpulkan poin.',
   From: 'Dari',

   // src/components/Loading.tsx
   'Loading Moodeng': 'Memuat Moodeng',

   // src/components/PlaceholderPage.tsx
   'Coming soon': 'Segera hadir',

   // src/components/PowerLenderBadge.tsx
   'Power Lender': 'Power Lender',

   // src/components/RepayInAppBrowserGate.tsx
   'Open Moodeng in your browser to repay': 'Buka Moodeng di browser kamu untuk membayar',
   'Finish repaying in your browser': 'Selesaikan pembayaran di browser kamu',
   "'s in-app browser can't open your wallet, so a repayment gets stuck here. Open this page in Chrome or Safari to pay — it only takes a few seconds.":
      'punya browser bawaan yang tidak bisa membuka dompetmu, jadi pembayaran kembali tertahan di sini. Buka halaman ini di Chrome atau Safari untuk membayar — hanya butuh beberapa detik.',
   'Your repay link': 'Link pembayaranmu',
   'Copied ✓': 'Disalin ✓',
   Copy: 'Salin',
   'Open in Safari': 'Buka di Safari',
   "If a button doesn't open your browser, tap": 'Jika tombol tidak membuka browsermu, ketuk',
   'at the top of': 'di bagian atas',
   'and choose': 'lalu pilih',
   ', then paste the link.': ', kemudian tempel link-nya.',
   'Still stuck? Message support': 'Masih bermasalah? Hubungi dukungan',

   // src/components/SocialContactRequiredNotifier.tsx
   'A message from the Moodeng team': 'Pesan dari tim Moodeng',
   "To request a loan, you'll first need to add a verified social media contact — like Facebook or WhatsApp — so we can reach you. Please contact us and we'll help you get set up.":
      'Untuk mengajukan pinjaman, kamu perlu menambahkan kontak media sosial yang terverifikasi dulu — seperti Facebook atau WhatsApp — agar kami bisa menghubungimu. Silakan hubungi kami dan kami akan membantumu menyiapkannya.',
   'Contact us': 'Hubungi kami',

   // src/components/ToastSystem/ToastDemo.tsx
   Success: 'Berhasil',
   'Success!': 'Berhasil!',
   'Operation completed successfully!': 'Operasi berhasil diselesaikan!',
   Info: 'Info',
   'Here is some information.': 'Ini sedikit informasi.',
   'Error!': 'Error!',
   'Something went wrong.': 'Terjadi kesalahan.',
   Warning: 'Peringatan',
   'Please check this.': 'Silakan periksa ini.',
   'Example error message': 'Contoh pesan error',
   'Simple Toast Demo': 'Demo Toast Sederhana',
   'Basic Types': 'Jenis Dasar',
   Errors: 'Error',
   Controls: 'Kontrol',
   'Clear All': 'Hapus Semua',
   'Usage:': 'Cara pakai:',

   // src/components/UserAvatar.tsx
   'Edit profile photo': 'Ubah foto profil',

   // src/components/UserNetwork.tsx
   'Guest User': 'Pengguna Tamu',
   VERIFY: 'VERIFIKASI',
   'SIGN IN': 'MASUK',
   'View IOU point history': 'Lihat riwayat poin IOU',
   Verified: 'Terverifikasi',
   'SIGN OUT': 'KELUAR',

   // src/components/UserPay.tsx
   'Still confirming': 'Masih dikonfirmasi',
   'Your payment was sent and is taking a moment to confirm. This will update automatically.':
      'Pembayaranmu sudah dikirim dan sedang menunggu konfirmasi sebentar. Status akan diperbarui otomatis.',
   'Unknown error': 'Error tidak diketahui',
   'Payment Sent, Still Recording': 'Pembayaran terkirim, masih dicatat',
   'Your payment went through but we could not record it yet. We will keep retrying automatically — contact support if it does not update.':
      'Pembayaranmu berhasil, tetapi kami belum bisa mencatatnya. Kami akan terus mencoba otomatis — hubungi dukungan jika statusnya tidak diperbarui.',
   'Loan Repayment': 'Pembayaran Kembali Pinjaman',
   'Total Due': 'Total Tagihan',
   'Amount Paid': 'Jumlah Dibayar',
   'Repayment Information': 'Informasi Pembayaran Kembali',
   Stablecoin: 'Stablecoin',
   'Repayment Amount': 'Jumlah Pembayaran',
   'Enter custom amount': 'Masukkan jumlah lain',
   'Processing...': 'Memproses...',
   'You can repay any amount at any time before the due date. Ensure full repayment by the due date to maintain your credit score.':
      'Kamu bisa membayar berapa pun kapan saja sebelum jatuh tempo. Pastikan pinjaman lunas sebelum jatuh tempo agar reputasi kreditmu tetap terjaga.',

   // src/components/WalletNetworkBlockNotice.tsx
   'Network is blocking wallet sign-in': 'Jaringan memblokir login dompet',
   'Trouble connecting? Your network may be blocking it': 'Gagal terhubung? Mungkin jaringanmu memblokirnya',
   "Some networks (PLDT / Smart) block the Base sign-in page, so the wallet screen won't load. The free":
      'Beberapa jaringan (PLDT / Smart) memblokir halaman login Base, sehingga layar dompet tidak bisa dimuat. Aplikasi gratis',
   'app fixes it — install it, switch it on, then reconnect. It works on WiFi and mobile data.':
      'bisa mengatasinya — pasang, aktifkan, lalu hubungkan ulang. Aplikasi ini berfungsi di WiFi maupun data seluler.',
   'Get the free 1.1.1.1 app': 'Unduh aplikasi gratis 1.1.1.1',
   "I've turned it on — Retry": 'Sudah aktif — Coba lagi',
   'Still stuck? Message the team': 'Masih bermasalah? Kirim pesan ke tim',
   'Wallet network block notice': 'Pemberitahuan pemblokiran jaringan dompet',

   // src/components/auth/AuthErrorAlert.tsx
   "We couldn't sign you in with": 'Gagal masuk dengan',
   'that provider': 'penyedia tersebut',
   '. This is usually temporary — please try again.': '. Biasanya ini hanya sementara — silakan coba lagi.',
   "That password didn't work. If you're not sure it's right, resetting it only takes a minute.":
      'Kata sandi itu tidak berhasil. Jika kamu tidak yakin kata sandinya benar, reset hanya butuh semenit.',
   'Reset password': 'Reset kata sandi',
   'No account found with this email address.': 'Tidak ada akun dengan alamat email ini.',
   'Try a different email': 'Coba email lain',
   or: 'atau',
   'Looks like you are new to Moodeng.': 'Sepertinya kamu baru di Moodeng.',
   'Create an account first, then verify the email code Moodeng sends you.':
      'Buat akun dulu, lalu verifikasi kode yang dikirim Moodeng ke email kamu.',
   'Create account': 'Buat akun',
   'Use a different email': 'Gunakan email lain',
   'The email or password you entered is incorrect.': 'Email atau kata sandi yang kamu masukkan salah.',
   'reset your password': 'reset kata sandimu',
   "if you've forgotten it.": 'jika kamu lupa.',

   // src/components/auth/LastUsedBadge.tsx
   'Last used': 'Terakhir dipakai',

   // src/components/auth/SignUpFormErrorAlert.tsx
   'Password must be longer than 8 characters. Choose a stronger password to continue.':
      'Kata sandi harus lebih dari 8 karakter. Pilih kata sandi yang lebih kuat untuk melanjutkan.',
   'Passwords do not match. Please re-enter your password.': 'Kata sandi tidak cocok. Silakan masukkan ulang kata sandimu.',
   'This email address has been permanently locked. Please try a different email or contact support if you believe this is a mistake.':
      'Alamat email ini sudah dikunci permanen. Silakan coba email lain atau hubungi dukungan jika menurutmu ini keliru.',
   'Why am I seeing this?': 'Kenapa aku melihat ini?',
   'This email is already linked to a Google account. Use a different email address or':
      'Email ini sudah terhubung ke akun Google. Gunakan alamat email lain atau',
   'instead.': 'saja.',
   "You're already signed up with this email. Enter your password above to log straight in, or pick an option below.":
      'Kamu sudah terdaftar dengan email ini. Masukkan kata sandimu di atas untuk langsung masuk, atau pilih opsi di bawah.',
   'Log In': 'Masuk',
   'Reset Password': 'Reset Kata Sandi',

   // src/components/auth/SocialAuthButtons.tsx
   'Sign Up with Google': 'Daftar dengan Google',
   'Sign In with Google': 'Masuk dengan Google',
   'Facebook sign-in coming soon': 'Login Facebook segera hadir',
   'Google sign-up could not start. Please try again.': 'Pendaftaran dengan Google gagal dimulai. Silakan coba lagi.',
   'Redirecting...': 'Mengalihkan...',
   Soon: 'Segera',

   // src/components/auth/TelegramLoginTile.tsx
   'Sign in with Telegram': 'Masuk dengan Telegram',

   // src/components/filters/DatePicker.tsx
   'Pick a date...': 'Pilih tanggal...',
   Su: 'Min',
   Mo: 'Sen',
   Tu: 'Sel',
   We: 'Rab',
   Th: 'Kam',
   Fr: 'Jum',
   Sa: 'Sab',
   Clear: 'Hapus',
   Today: 'Hari ini',

   // src/components/filters/FilterSidebar.tsx
   'Credit Limit': 'Limit Kredit',
   'Payback %': 'Pengembalian %',
   Type: 'Jenis',
   'Close filters': 'Tutup filter',
   'Swipe right to close filters': 'Geser ke kanan untuk menutup filter',
   Filters: 'Filter',
   'Payback is the total amount the borrower agrees to return. This filters the extra payback above the loan principal. Example: a $10 loan with a $13 payback is 30%.':
      'Pengembalian adalah total jumlah yang disepakati peminjam untuk dikembalikan. Filter ini menyaring kelebihan pengembalian di atas pokok pinjaman. Contoh: pinjaman $10 dengan pengembalian $13 berarti 30%.',
   'Repayment Date': 'Tanggal Pembayaran',
   'Borrow Type': 'Jenis Pinjaman',

   // src/components/filters/SortButtons.tsx
   Lowest: 'Terendah',
   Highest: 'Tertinggi',
   Oldest: 'Terlama',
   Newest: 'Terbaru',

   // src/components/marketing/MarketingPageShell.tsx
   'Open App': 'Buka Aplikasi',
   App: 'Aplikasi',
   'Benefits navigation': 'Navigasi manfaat',
   'Toggle benefits menu': 'Buka/tutup menu manfaat',
   'Mobile benefits navigation': 'Navigasi manfaat seluler',
   'Small USDC loans, World ID verification, and portable repayment history for borrowers building credit abroad.':
      'Pinjaman USDC kecil, verifikasi World ID, dan riwayat pembayaran kembali yang portabel untuk peminjam yang membangun kredit di luar negeri.',
   'Read docs': 'Baca dokumentasi',

   // src/components/mecha/stepContext.ts
   'Setting up your wallet? Your Instant Wallet is created from your Moodeng login — no app to download. I can walk you through it.':
      'Sedang menyiapkan dompet? Instant Wallet kamu dibuat dari login Moodeng — tanpa perlu mengunduh aplikasi. Aku bisa memandumu.',
   'What is the Instant Wallet?': 'Apa itu Instant Wallet?',
   'Can I use a Base Account instead?': 'Bisakah aku pakai Base Account saja?',
   'My wallet won’t connect': 'Dompetku tidak bisa terhubung',
   'Stuck on verifying? I can walk you through it.': 'Kesulitan verifikasi? Aku bisa memandumu.',
   'How do I verify my ID?': 'Bagaimana cara verifikasi ID-ku?',
   'My verification is stuck': 'Verifikasiku macet',
   'What is World ID?': 'Apa itu World ID?',
   'How do I repay?': 'Bagaimana cara bayar kembali?',
   'Where do I buy USDC?': 'Di mana aku bisa beli USDC?',
   'What network do I use?': 'Jaringan apa yang harus kupakai?',
   'How do I cash out to GCash?': 'Bagaimana cara mencairkan dana ke GCash?',
   'How do I withdraw to my bank?': 'Bagaimana cara tarik dana ke rekening bankku?',
   'Which network do I pick?': 'Jaringan mana yang harus kupilih?',
   'How do I request a loan?': 'Bagaimana cara mengajukan pinjaman?',
   'How does funding work?': 'Bagaimana cara kerja pendanaan?',
   'What are Pandesal points?': 'Apa itu poin Pandesal?',
   'How do I increase my credit limit?': 'Bagaimana cara menaikkan limit kreditku?',
   'How do I get verified?': 'Bagaimana cara verifikasi?',
   'How do I cash out?': 'Bagaimana cara mencairkan dana?',
   'How do I get started?': 'Bagaimana cara memulai?',
   'What do I need to borrow?': 'Apa saja yang kubutuhkan untuk meminjam?',
   'Is Moodeng legit?': 'Apakah Moodeng terpercaya?',

   // src/components/support/SupportContactsModal.tsx
   'Support contacts': 'Kontak dukungan',
   'Here are support contacts. Choose a channel and we will help you with your Moodeng account.':
      'Berikut kontak dukungan kami. Pilih salurannya dan kami akan membantumu dengan akun Moodeng kamu.',
   'Here are support contacts for your expired loan request. We can help you connect with a lender or decide whether to post again.':
      'Berikut kontak dukungan untuk permintaan pinjamanmu yang sudah kedaluwarsa. Kami bisa membantumu terhubung dengan pemberi pinjaman atau memutuskan apakah perlu memasang permintaan lagi.',
   'Here are support contacts for World ID verification if your status did not update after completing World ID.':
      'Berikut kontak dukungan untuk verifikasi World ID jika statusmu tidak berubah setelah menyelesaikan World ID.',
   'Close support contacts': 'Tutup kontak dukungan',
   'Contact us via': 'Hubungi kami lewat',
   'Live chat': 'Live chat',
   'Fastest — we reply here and by email': 'Paling cepat — kami membalas di sini dan lewat email',

   // src/components/ui/Modal.tsx
   'Close modal': 'Tutup',

   // src/components/ui/YouTubeVideoLightbox.tsx
   'Credit Levelling Guide': 'Panduan Naik Level Kredit',

   // src/components/verification/CountryFlags.tsx
   Vietnam: 'Vietnam',
   Taiwan: 'Taiwan',
   'South Korea': 'Korea Selatan',
   Philippines: 'Filipina',
   Malaysia: 'Malaysia',
   Japan: 'Jepang',
   Indonesia: 'Indonesia',
   Thailand: 'Thailand',

   // src/components/verification/VerificationUnsuccessfulModal.tsx
   'your ID': 'ID kamu',
   Verification: 'Verifikasi',
   'Verification didn’t go through': 'Verifikasi tidak berhasil',
   'We weren’t able to verify you with': 'Kami belum bisa memverifikasimu dengan',
   'this time. No worries — you can try again whenever you’re ready.':
      'kali ini. Tenang saja — kamu bisa mencoba lagi kapan pun kamu siap.',
   'or get help from our team': 'atau minta bantuan tim kami',

   // src/components/verification/VerifiedCelebrationNotifier.tsx
   'Manual review complete — you’re verified!': 'Peninjauan manual selesai — kamu sudah terverifikasi!',
   'Your ID is verified!': 'ID kamu sudah terverifikasi!',
   'Well done! Our reviewers confirmed your documents. You now have full access — start building trust with lenders.':
      'Mantap! Tim peninjau kami sudah mengonfirmasi dokumenmu. Sekarang kamu punya akses penuh — mulai bangun kepercayaan dengan pemberi pinjaman.',
   'Well done! Your identity is confirmed. You now have full access — start building trust with lenders.':
      'Mantap! Identitasmu sudah dikonfirmasi. Sekarang kamu punya akses penuh — mulai bangun kepercayaan dengan pemberi pinjaman.',
   'Request a loan': 'Ajukan pinjaman',

   // src/components/verification/VerifyYourselfModal.tsx
   '🇺🇸 United States': '🇺🇸 Amerika Serikat',
   '🇬🇧 United Kingdom': '🇬🇧 Inggris',
   '🇯🇵 Japan': '🇯🇵 Jepang',
   '🇰🇷 South Korea': '🇰🇷 Korea Selatan',
   '🇲🇽 Mexico': '🇲🇽 Meksiko',
   '🇨🇴 Colombia': '🇨🇴 Kolombia',
   '🇨🇱 Chile': '🇨🇱 Cile',
   '🇸🇬 Singapore': '🇸🇬 Singapura',
   '🇵🇭 Philippines': '🇵🇭 Filipina',
   '🇩🇪 Germany': '🇩🇪 Jerman',
   '🇦🇹 Austria': '🇦🇹 Austria',
   '🇵🇱 Poland': '🇵🇱 Polandia',
   '🇪🇨 Ecuador': '🇪🇨 Ekuador',
   '🇧🇷 Brazil': '🇧🇷 Brasil',
   'World ID Passport': 'Paspor World ID',
   'Verify by scanning your passport with your phone in the World App — no Orb visit needed. You need an':
      'Verifikasi dengan memindai paspor lewat ponselmu di World App — tanpa perlu datang ke Orb. Kamu butuh',
   'NFC-enabled (biometric) passport': 'paspor ber-NFC (biometrik)',
   'from one of these countries, and you must currently be in one of them:':
      'dari salah satu negara berikut, dan saat ini kamu harus berada di salah satu negara tersebut:',
   'Look for the chip symbol on your passport cover. You’ll also need a phone with NFC (most modern phones) and the World App installed.':
      'Cari simbol chip di sampul paspormu. Kamu juga butuh ponsel dengan NFC (kebanyakan ponsel modern punya) dan World App yang sudah terpasang.',
   'I’m eligible — Continue': 'Aku memenuhi syarat — Lanjutkan',
   'Get the World App': 'Unduh World App',
   'Need help with this step?': 'Butuh bantuan di langkah ini?',
   'World ID is verified in person at an Orb — a physical device available only in certain countries — or with a passport scan in the World App. Pick the option that matches you.':
      'World ID diverifikasi langsung di Orb — perangkat fisik yang hanya tersedia di negara tertentu — atau dengan memindai paspor di World App. Pilih opsi yang sesuai denganmu.',
   'I’ve been verified at an Orb': 'Aku sudah diverifikasi di Orb',
   'I’ll verify with my passport': 'Aku akan verifikasi dengan paspor',
   'New to World ID?': 'Baru mengenal World ID?',
   '1. Download the World App': '1. Unduh World App',
   '2. Find an Orb near you': '2. Cari Orb di dekatmu',
   'Countries with Orb locations': 'Negara dengan lokasi Orb',
   'Availability changes —': 'Ketersediaan bisa berubah —',
   'check the live map': 'cek peta terkini',
   'for exact locations.': 'untuk lokasi pastinya.',
   'Back to verification options': 'Kembali ke pilihan verifikasi',
   'Verify Yourself': 'Verifikasi Diri',
   'Confirm your identity to unlock your account — a one-time check that takes about 3 minutes.':
      'Konfirmasi identitasmu untuk membuka akunmu — pengecekan satu kali yang butuh sekitar 3 menit.',

   // src/components/worldId/WorldIDVerificationStatus.tsx
   "To confirm your identity and show it's really you, we use World ID. This helps keep our community safe, avoids bots, and builds trust for borrowers.":
      'Untuk mengonfirmasi identitasmu dan menunjukkan bahwa ini benar-benar kamu, kami menggunakan World ID. Ini membantu menjaga keamanan komunitas kami, mencegah bot, dan membangun kepercayaan untuk peminjam.',
   'Human Verified with World ID': 'Terverifikasi sebagai Manusia dengan World ID',

   // src/components/worldId/WorldIdVerificationOverlays.tsx
   'This may take a few seconds.': 'Ini mungkin butuh beberapa detik.',
   'Keep waiting': 'Tetap tunggu',
   'Verification status': 'Status verifikasi',
   'Having trouble?': 'Mengalami masalah?',
   'Still stuck? Contact support': 'Masih terkendala? Hubungi dukungan',
   'Close verification help': 'Tutup bantuan verifikasi',

   // src/components/worldId/modal/AlreadyUsedModal.tsx
   'Got it': 'Mengerti',

   // src/views/academy/AcademyGuide.tsx
   'Set Up Your Instant Wallet': 'Siapkan Instant Wallet Kamu',
   'Set Up Your Wallet': 'Siapkan Dompetmu',
   'Gasless transactions are supported on Base.': 'Transaksi tanpa gas didukung di Base.',
   'Available credit limit': 'Limit kredit yang tersedia',
   '$10 request': 'Permintaan $10',
   'Any request below your $15 credit limit becomes a trust-building loan.':
      'Permintaan berapa pun di bawah limit kredit $15 kamu menjadi trust-building loan.',
   '$10 is below your $15 limit': '$10 di bawah limitmu $15',
   'Does not raise Credit Level': 'Tidak menaikkan Level Kredit',
   '$20 request': 'Permintaan $20',
   'Any request above your $15 credit limit becomes a credit-building loan.':
      'Permintaan berapa pun di atas limit kredit $15 kamu menjadi credit-building loan.',
   '$20 is above your $15 limit': '$20 di atas limitmu $15',
   'Can increase your next limit': 'Bisa menaikkan limit berikutnya',
   'Best when repayment is clear': 'Paling baik jika pembayaran kembali jelas',
   'Borrow amount': 'Jumlah pinjaman',
   'Payback amount': 'Jumlah bayar kembali',
   Reason: 'Alasan',
   'Needs money before Friday': 'Butuh uang sebelum hari Jumat',
   'Short term': 'Jangka pendek',
   'Repayment amount': 'Jumlah pembayaran kembali',
   'Usual loan size': 'Besaran pinjaman biasanya',
   'Typical payment time': 'Waktu pembayaran biasanya',
   'See How Growth Works': 'Lihat Cara Kerja Pertumbuhan',
   'Mecha says': 'Kata Mecha',
   'Video guide': 'Panduan video',
   'Want to learn more? Open the step-by-step credit guide.':
      'Ingin belajar lebih lanjut? Buka panduan kredit langkah demi langkah.',
   'Moodeng Academy Quiz': 'Kuis Moodeng Academy',
   'Ready for the check?': 'Siap untuk pengecekannya?',
   'Start quiz': 'Mulai kuis',
   'Retake quiz': 'Ulangi kuis',
   'Submit a loan request': 'Ajukan permintaan pinjaman',
   'Get matched on the request board': 'Dapatkan kecocokan di papan permintaan',
   'Grow your next limit': 'Tumbuhkan limit berikutnya',
   'Full-limit loans repaid on time can unlock the next level, helping you build a visible credit record.':
      'Pinjaman limit penuh yang dibayar tepat waktu bisa membuka level berikutnya, membantu kamu membangun rekam jejak kredit yang terlihat.',
   'Level up': 'Naik Level',
   Quiz: 'Kuis',
   'Why do borrowers verify with World ID?': 'Kenapa peminjam verifikasi dengan World ID?',
   'To prove they are unique': 'Untuk membuktikan mereka unik',
   'Why do borrowers set up a wallet (Instant Wallet or Base Account)?':
      'Kenapa peminjam menyiapkan dompet (Instant Wallet atau Base Account)?',
   'To receive USDC loans and build onchain reputation': 'Untuk menerima pinjaman USDC dan membangun reputasi onchain',
   'Your credit limit is $15. What is a $10 request?': 'Limit kreditmu $15. Apa itu permintaan $10?',
   'Your credit limit is $15. What is a $20 request?': 'Limit kreditmu $15. Apa itu permintaan $20?',
   'What helps a borrower build a stronger record?': 'Apa yang membantu peminjam membangun rekam jejak yang lebih kuat?',
   'Repaying clearly and on time': 'Membayar kembali dengan jelas dan tepat waktu',
   'Nice practice request.': 'Latihan permintaan yang bagus.',
   'Strong repayment move.': 'Langkah pembayaran kembali yang kuat.',
   'Nice! Repaying is super important on Moodeng. On-time repayment helps your trust record, keeps lenders confident, and can unlock better borrowing limits over time.':
      'Bagus! Membayar kembali itu sangat penting di Moodeng. Pembayaran tepat waktu membantu rekam jejak kepercayaanmu, membuat pemberi pinjaman tetap yakin, dan bisa membuka limit pinjaman yang lebih baik seiring waktu.',
   'Mecha says: full-limit loans repaid on time are how borrowers build a stronger credit record. Keep repayment clean, and your next limit can grow.':
      'Kata Mecha: pinjaman limit penuh yang dibayar tepat waktu adalah cara peminjam membangun rekam jejak kredit yang lebih kuat. Jaga pembayaran tetap bersih, dan limit berikutnya bisa tumbuh.',
   'A step-by-step walkthrough of the Moodeng borrower flow — sign up, verify, set up your Instant Wallet (or connect a Base Account), request a loan, repay, and grow your credit limit.':
      'Panduan langkah demi langkah alur peminjam Moodeng — daftar, verifikasi, siapkan Instant Wallet kamu (atau hubungkan Base Account), ajukan pinjaman, bayar kembali, dan tumbuhkan limit kreditmu.',
   'Close message': 'Tutup pesan',
   'Academy path': 'Alur Academy',
   'Close tutorial video': 'Tutup video tutorial',
   'Moodeng Academy tutorial video': 'Video tutorial Moodeng Academy',
   'Moodeng Credit steps': 'Langkah-langkah Moodeng Credit',
   'Choose reward type': 'Pilih jenis hadiah',

   // src/views/academy/MoneyGuide.tsx
   'Getting verified, funding your wallet, cashing out, and repaying — in one friendly place.':
      'Verifikasi, isi dompetmu, tarik dana, dan bayar kembali — semuanya di satu tempat yang ramah.',
   'Read more': 'Baca selengkapnya',
   'How to verify, add USDC to your wallet, withdraw to your bank, and repay your loan on Moodeng.':
      'Cara verifikasi, menambah USDC ke dompetmu, menarik dana ke bank, dan membayar kembali pinjamanmu di Moodeng.',
   'Verify your identity': 'Verifikasi identitasmu',
   'A quick national ID photo and selfie check confirms you’re a real, unique person. Most checks finish within minutes.':
      'Foto KTP dan pengecekan selfie yang cepat mengonfirmasi bahwa kamu orang sungguhan dan unik. Sebagian besar pengecekan selesai dalam hitungan menit.',
   Selfie: 'Selfie',
   'Add funds to your wallet': 'Tambah dana ke dompetmu',
   'USDC on the Base network': 'USDC di jaringan Base',
   'Buy USDC on an exchange or with a card, then send it to your wallet — always on Base. Or bridge it from another chain.':
      'Beli USDC di exchange atau dengan kartu, lalu kirim ke dompetmu — selalu di jaringan Base. Atau bridge dari chain lain.',
   'Withdraw to your bank': 'Tarik dana ke bank',
   'Cash out to bank or e-wallet': 'Cairkan dana ke bank atau e-wallet',
   'Send USDC to an exchange or local service, sell it, and withdraw your local currency to your bank or GCash. The full guide has a video walkthrough.':
      'Kirim USDC ke exchange atau layanan lokal, jual, lalu tarik mata uang lokalnya ke bankmu atau GCash. Panduan lengkapnya ada video langkah demi langkah.',
   'Repay your loan': 'Bayar kembali pinjamanmu',
   'On-time repayment builds trust': 'Pembayaran tepat waktu membangun kepercayaan',
   'Send USDC to the repayment address shown on the Repay screen — from a wallet, exchange, or local service. Repaying on time raises your Pandesal points and credit limit.':
      'Kirim USDC ke alamat pembayaran yang tertera di layar Bayar — dari dompet, exchange, atau layanan lokal. Membayar tepat waktu menaikkan poin Pandesal dan limit kreditmu.',
   'From a wallet': 'Dari dompet',
   'From an exchange': 'Dari exchange',
   'Base network': 'Jaringan Base',

   // src/views/academy/VerifyGuide.tsx
   Money: 'Uang',
   'To keep Moodeng safe and fair, every borrower completes one short identity check. It keeps fake and duplicate accounts out of the community, and it is what lets lenders trust the requests they fund.':
      'Untuk menjaga Moodeng tetap aman dan adil, setiap peminjam menyelesaikan satu pengecekan identitas singkat. Ini mencegah akun palsu dan duplikat masuk ke komunitas, dan inilah yang membuat pemberi pinjaman percaya pada permintaan yang mereka danai.',
   'The recommended route: Verify Your ID.': 'Cara yang direkomendasikan: Verifikasi ID Kamu.',
   'National ID verification is available for these countries.': 'Verifikasi KTP tersedia untuk negara-negara berikut.',
   'Pass on the first try': 'Lolos di percobaan pertama',
   'If you are already verified in World App — in person at an Orb, or with a biometric passport — you can choose':
      'Jika kamu sudah terverifikasi di World App — langsung di Orb, atau dengan paspor biometrik — kamu bisa memilih',
   'Your ID is never stored by Moodeng': 'ID kamu tidak pernah disimpan oleh Moodeng',
   'The check is run by our secure verification partner. Moodeng receives the result — whether you passed — not a copy of your document.':
      'Pengecekan dijalankan oleh mitra verifikasi tepercaya kami. Moodeng hanya menerima hasilnya — lolos atau tidak — bukan salinan dokumenmu.',
   'Ready to verify?': 'Siap untuk verifikasi?',
   Read: 'Baca',
   'Verification makes sure every request comes from a real, unique person. That is what keeps fake and duplicate accounts away from lenders.':
      'Verifikasi memastikan setiap permintaan berasal dari orang sungguhan yang unik. Inilah yang menjauhkan akun palsu dan duplikat dari pemberi pinjaman.',
   Access: 'Akses',
   'Finishing verification is what unlocks loan requests, and it is the point where you start earning Pandesal points.':
      'Menyelesaikan verifikasi adalah yang membuka permintaan pinjaman, dan di situlah kamu mulai mendapatkan poin Pandesal.',
   Trust: 'Kepercayaan',
   'Lenders are funding real people, not anonymous accounts. That confidence is what gets requests on the board funded.':
      'Pemberi pinjaman mendanai orang sungguhan, bukan akun anonim. Keyakinan itulah yang membuat permintaan di papan didanai.',
   'Your physical national ID': 'KTP fisik kamu',
   'The real card in hand, not a photocopy or a picture on another screen.': 'Kartu asli di tangan, bukan fotokopi atau foto di layar lain.',
   'Avoid glare and hard shadows across the card or your face.': 'Hindari silau dan bayangan tajam di kartu atau wajahmu.',
   'Chrome or Safari': 'Chrome atau Safari',
   'Not the browser inside Facebook or Messenger — those can stall the check.':
      'Bukan browser di dalam Facebook atau Messenger — itu bisa membuat pengecekan macet.',
   'How long does verification take?': 'Berapa lama verifikasi berlangsung?',
   'The check itself takes about 3 minutes. Most results come back within minutes. If yours needs a human review, we notify you as soon as it is done — usually within a few hours, and at most 1 business day.':
      'Pengecekannya sendiri butuh sekitar 3 menit. Sebagian besar hasil keluar dalam hitungan menit. Jika punyamu butuh peninjauan manual, kami akan memberi tahu begitu selesai — biasanya dalam beberapa jam, dan paling lama 1 hari kerja.',
   'Does Moodeng store a copy of my ID?': 'Apakah Moodeng menyimpan salinan ID saya?',
   'No. Your ID is checked by our secure verification partner and is never stored by Moodeng.':
      'Tidak. ID kamu diperiksa oleh mitra verifikasi tepercaya kami dan tidak pernah disimpan oleh Moodeng.',
   'Do I have to verify again for every loan?': 'Apakah saya harus verifikasi lagi untuk setiap pinjaman?',
   'No. Verification is a one-time step. Once it is complete you can keep requesting loans without repeating it.':
      'Tidak. Verifikasi hanya dilakukan sekali. Setelah selesai, kamu bisa terus mengajukan pinjaman tanpa mengulanginya.',
   'Which countries are supported?': 'Negara mana saja yang didukung?',
   'I already use World App — can I use that instead?': 'Saya sudah pakai World App — bisakah saya pakai itu saja?',
   'How to verify your identity on Moodeng Credit': 'Cara verifikasi identitas kamu di Moodeng Credit',
   Breadcrumb: 'Breadcrumb',
   'Why verification matters': 'Kenapa verifikasi itu penting',
   'Already use World App?': 'Sudah pakai World App?',
   'Keep going': 'Lanjutkan',

   // src/views/account/AccountSettings.tsx
   "We'll send a verification code to your new email address to confirm the change.":
      'Kami akan mengirim kode verifikasi ke alamat email barumu untuk mengonfirmasi perubahan ini.',
   'Enter Verification Code': 'Masukkan Kode Verifikasi',
   'We sent a 6-digit code to': 'Kami mengirim kode 6 digit ke',
   'Verification Code': 'Kode Verifikasi',
   'Change Display Name': 'Ubah Nama Tampilan',
   'This is the name other users will see on your profile and loan requests.':
      'Ini adalah nama yang akan dilihat pengguna lain di profil dan permintaan pinjamanmu.',
   'Display Name': 'Nama Tampilan',
   'Telegram Alerts': 'Notifikasi Telegram',
   'Connect private loan alerts to your Telegram account.': 'Hubungkan notifikasi pinjaman pribadi ke akun Telegram kamu.',
   'Open Telegram Bot': 'Buka Bot Telegram',
   'Check Connection': 'Cek Koneksi',
   'Change Wallet': 'Ubah Dompet',
   'Other Wallets': 'Dompet Lainnya',
   'Connecting…': 'Menghubungkan…',
   'Approve the connection in your wallet app.': 'Setujui koneksi di aplikasi dompetmu.',
   'Dark mode': 'Mode gelap',
   Password: 'Kata sandi',
   Change: 'Ubah',
   'Open wallet': 'Buka dompet',
   'No wallet connected': 'Belum ada dompet yang terhubung',
   'Connect a wallet to continue': 'Hubungkan dompet untuk melanjutkan',
   'No wallet app? Create one': 'Tidak punya aplikasi dompet? Buat satu',
   'An Instant Wallet is made from your Moodeng login — no app, no seed phrase — and the key is yours to export anytime.':
      'Instant Wallet dibuat dari login Moodeng kamu — tanpa aplikasi, tanpa seed phrase — dan kuncinya bisa kamu ekspor kapan saja.',
   'Includes a ten-second face check, so Instant Wallets stay one per person.':
      'Termasuk pengecekan wajah sepuluh detik, agar Instant Wallet tetap satu per orang.',
   'Wallet locked while you have an active loan': 'Dompet terkunci selama kamu memiliki pinjaman aktif',
   'Disconnect wallet?': 'Putuskan koneksi dompet?',
   'Confirm your wallet': 'Konfirmasi dompetmu',
   'Confirm wallet': 'Konfirmasi dompet',
   'You have active loans': 'Kamu memiliki pinjaman aktif',
   'Change anyway': 'Tetap ubah',
   'Disconnect wallet': 'Putuskan koneksi dompet',
   'Add an email in Personal details to receive email alerts.':
      'Tambahkan email di Detail pribadi untuk menerima notifikasi email.',
   'Account activity': 'Aktivitas akun',
   'Security and account updates': 'Keamanan dan pembaruan akun',
   'Loan activity': 'Aktivitas pinjaman',
   'Funding, repayments, and due dates': 'Pendanaan, pembayaran kembali, dan jatuh tempo',
   'Moodeng news': 'Berita Moodeng',
   'Occasional product updates': 'Pembaruan produk sesekali',
   'Your identity check is complete.': 'Pengecekan identitasmu sudah selesai.',
   'Verification in review': 'Verifikasi sedang ditinjau',
   'Your identity check is being reviewed.': 'Pengecekan identitasmu sedang ditinjau.',
   'Verification pending': 'Verifikasi menunggu',
   'Your submitted identity check is processing.': 'Pengecekan identitas yang kamu kirim sedang diproses.',
   'Verification unfinished': 'Verifikasi belum selesai',
   'Continue where you left off.': 'Lanjutkan dari tempat kamu berhenti.',
   'Verification declined': 'Verifikasi ditolak',
   'Review the result and try again.': 'Tinjau hasilnya dan coba lagi.',
   'Verification blocked': 'Verifikasi diblokir',
   'Open verification to review the issue.': 'Buka verifikasi untuk meninjau masalahnya.',
   'Identity not verified': 'Identitas belum diverifikasi',
   'Complete an identity check to build account trust.': 'Selesaikan pengecekan identitas untuk membangun kepercayaan akun.',
   'Enter your old password': 'Masukkan kata sandi lamamu',
   'Enter your new password': 'Masukkan kata sandi barumu',
   'Failed to send verification code': 'Gagal mengirim kode verifikasi',
   'Failed to resend verification code': 'Gagal mengirim ulang kode verifikasi',
   'Failed to connect Telegram alerts': 'Gagal menghubungkan notifikasi Telegram',
   'Failed to create Telegram connection link': 'Gagal membuat link koneksi Telegram',
   'Failed to refresh Telegram alerts': 'Gagal memperbarui notifikasi Telegram',
   'Failed to change wallet': 'Gagal mengubah dompet',
   'Failed to update wallet.': 'Gagal memperbarui dompet.',
   'Personal details': 'Detail pribadi',
   Preferences: 'Preferensi',
   'Profile photo': 'Foto profil',
   'Display name': 'Nama tampilan',
   Bio: 'Bio',
   Appearance: 'Tampilan',
   'Use dark mode': 'Gunakan mode gelap',
   'Sign-in': 'Masuk',
   'Identity verification': 'Verifikasi identitas',
   'Connected wallet': 'Dompet terhubung',
   'Copy wallet address': 'Salin alamat dompet',
   'Wallet access': 'Akses dompet',
   Channels: 'Saluran',
   Connected: 'Terhubung',
   'Alert types': 'Jenis notifikasi',
   'Account activity notifications': 'Notifikasi aktivitas akun',
   'Loan activity notifications': 'Notifikasi aktivitas pinjaman',
   'Moodeng news notifications': 'Notifikasi berita Moodeng'
};
