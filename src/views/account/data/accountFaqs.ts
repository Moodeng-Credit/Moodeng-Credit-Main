export interface AccountFAQItem {
   id: string;
   question: string;
   answer: string;
   /** App path this FAQ links to for the full academy-style guide (e.g. /academy/money/repay). */
   readMorePath?: string;
   /** Localized label for the read-more link. */
   readMoreLabel?: string;
}

// Shown to both borrowers and lenders
export const SHARED_FAQS: AccountFAQItem[] = [
   {
      id: 'does-moodeng-touch-money',
      question: 'Does Moodeng touch my money?',
      answer: `No. Moodeng does not hold, custody, or move user funds for you.

Loans go directly from the lender's wallet to the borrower's wallet. Repayments go directly from the borrower's wallet back to the lender's wallet. Moodeng helps with the request board, verification, repayment status, and record keeping so both sides can see what happened clearly.`
   },
   {
      id: 'why-usdc',
      question: 'Why does Moodeng use USDC?',
      answer: `USDC is a stablecoin pegged 1:1 to the US dollar. Issued by Circle, a regulated US financial company, it keeps loan values predictable — a $20 loan today is still $20 at repayment, not $15 or $30. Lenders and borrowers don't take on currency risk just by participating.

USDC is also fast to send globally and, when used on Base with your Instant Wallet or a Base Account, is completely gasless. That means no network fees eat into your repayment — 100% of what you send reaches your lender.

It's also widely accepted: every major crypto exchange supports USDC deposits, and you can convert it to fiat (US dollars, pesos, naira, etc.) almost anywhere. So when you receive a loan or get repaid, you can spend it on-chain, hold it, or cash it out — your choice.`
   },
   {
      id: 'how-to-get-verified',
      question: 'How do I get verified?',
      answer: `Verification is a quick, one-time identity check. The recommended way is "Verify Your ID" — a short national ID photo + selfie check that takes about 3 minutes and works in supported countries. If you already use World App, you can verify with World ID instead.

Tap "Verify Yourself" in the app to start. Most checks finish within minutes.`,
      readMorePath: '/academy/money/verify',
      readMoreLabel: 'Read the full guide'
   }
];

// Shown to borrowers only
export const BORROWER_FAQS: AccountFAQItem[] = [
   {
      id: 'convert-loan-to-bank',
      question: 'How do I convert my loan into my local bank account?',
      answer: `Send your USDC to an exchange or local service — Binance P2P, Coins.ph, PDAX, GCrypto (GCash), and more — sell it there, and withdraw the local currency straight to your bank or e-wallet.

The key detail: always choose Base as the network when sending USDC. The full guide has a video walkthrough and step-by-step instructions for each service.`,
      readMorePath: '/academy/money/withdraw',
      readMoreLabel: 'Read the full guide'
   },
   {
      id: 'how-to-repay',
      question: 'How do I repay my loan?',
      answer: `Open the Repay screen — it shows the exact amount due and the repayment address. Send USDC there from any wallet, exchange, or local service. If you don't hold USDC yet, buy it first (Binance P2P, Coins.ph, PDAX, GCrypto, and more) — always on the Base network.

Repay before the due date — on-time repayment builds your Pandesal points, and repaying a loan at your full limit on time unlocks the next Credit Level. The full guide walks through each way to repay.`,
      readMorePath: '/academy/money/repay',
      readMoreLabel: 'Read the full guide'
   },
   {
      id: 'borrow-below-limit',
      question: 'Can I borrow below my credit limit?',
      answer: `Yes — and we actually recommend it, especially when you're starting out. Borrowing below your limit is called a Trust-Building Loan.

These smaller loans don't count toward unlocking the next Credit Level (for that, you need to borrow your full limit and repay on time), but they do build your repayment history and earn Pandesal points each time you repay on time.

So if you want to grow your reputation quickly, Trust-Building Loans are a great way to do it.`
   },
   {
      id: 'increase-credit-limit',
      question: 'How do I increase my credit limit?',
      answer: `Your credit limit goes up when you borrow your full limit and repay it on time. These are called Credit-Building Loans.

If your limit is $20 and you only borrow $15, that doesn't count toward the next level — even if you repay it perfectly. The system needs to see you can handle the full limit before it raises the ceiling.

Progression goes $15 → $20 → $40 → $60 → $80 → $100 → $120 → $140, which is the current maximum. One step at a time: borrow your max, repay on time, repeat.`
   }
];

// Shown to lenders only
export const LENDER_FAQS: AccountFAQItem[] = [
   {
      id: 'what-are-iou-points',
      question: 'What are IOU Points?',
      answer: `IOU Points are reputation points earned by lenders. In the Year 1 model, each funded loan earns base IOU points for the amount funded plus a borrower-stage bonus. They track who's actively supporting the community.

Right now IOU is just points. Down the line, we'll launch a token also called IOU, and your accumulated points will convert via an airdrop. Holding IOU will unlock additional benefits tied to the platform.

IOU is for lenders only — borrowers build their Pandesal points and Credit Level instead. So if you want to earn IOU, fund a loan request from the Request Board.`
   },
   {
      id: 'how-borrowers-verify',
      question: 'How do borrowers verify?',
      answer: `Every borrower completes a one-time identity verification — a national ID photo + selfie check with duplicate detection, or World ID for those who use World App. Either way, it confirms each borrower is a unique real person, which prevents fake accounts and bots.

Each person can only verify one account, so the borrower profile and repayment history you see belong to the same real individual — and banned users can't simply return with a new account.`,
      readMorePath: '/academy/money/verify',
      readMoreLabel: 'Read the full guide'
   },
   {
      id: 'how-borrowers-increase-credit-limit',
      question: 'How do borrowers increase their credit limit?',
      answer: `Borrowers increase their credit limit by taking out a Credit-Building Loan and borrowing their full current limit. If they repay that full-limit loan on time, they level up and unlock a higher credit limit.

If they borrow below their limit, it is a Trust-Building Loan instead. That does not level them up, but it helps build a stronger repayment record and better borrower stats on the platform.`
   },
   {
      id: 'how-to-fund-loan',
      question: 'How do I fund a loan?',
      answer: `Go to the Request Board and browse open loan requests. Each request shows the borrower's stats, credit limit, requested amount, and repayment term.

When you find one you want to fund, tap Fund and confirm. The USDC leaves your wallet (usually your Base Account, or your Instant Wallet if you use one) immediately and goes directly to the borrower's wallet — no middleman, no delay.

You can track all your active loans and repayment statuses from your Lender Dashboard.`
   },
   {
      id: 'when-do-i-get-repaid',
      question: 'When do I get repaid?',
      answer: `The due date is set by the borrower when they post their request — you'll see it clearly on the loan card before you fund, so you always know the timeline upfront.

Once the loan is due, the borrower repays directly to your wallet — usually your Base Account (or your Instant Wallet, if you use one). You can track the status of all your active loans on your Lender Dashboard.`
   }
];

const FILIPINO_SHARED_FAQS: AccountFAQItem[] = [
   {
      id: 'does-moodeng-touch-money',
      question: 'Hinahawakan ba ng Moodeng ang pera ko?',
      answer: `Hindi. Hindi hinahawakan, iniingatan, o inililipat ng Moodeng ang pera ng mga user.

Diretso ang loan mula sa wallet ng lender papunta sa wallet ng borrower. Diretso rin ang bayad mula sa wallet ng borrower pabalik sa wallet ng lender. Tumutulong ang Moodeng sa Request Board, verification, status ng bayad, at pagtatala, para malinaw na makita ng magkabilang panig kung ano ang nangyari.`
   },
   {
      id: 'why-usdc',
      question: 'Bakit USDC ang ginagamit ng Moodeng?',
      answer: `Ang USDC ay stablecoin na naka-peg 1:1 sa US dollar. Ini-issue ito ng Circle, isang regulated na financial company sa US, kaya hindi nagbabago ang halaga ng loan — ang $20 loan ngayon ay $20 pa rin pagdating ng bayaran, hindi biglang $15 o $30. Walang currency risk ang mga lender at borrower dahil lang sa pagsali nila.

Mabilis ding maipadala ang USDC kahit saan sa mundo, at kapag ginamit sa Base gamit ang Instant Wallet mo o ang Base Account, wala itong gas fee. Ibig sabihin, walang network fee na babawas sa bayad mo — 100% ng ipinadala mo ang makakarating sa lender mo.

Malawak din itong tinatanggap: lahat ng malalaking crypto exchange ay tumatanggap ng USDC deposit, at puwede mo itong i-convert sa fiat (US dollars, piso, naira, at iba pa) halos kahit saan. Kaya kapag nakatanggap ka ng loan o nabayaran ka, puwede mo itong gastusin on-chain, itabi, o i-cash out — ikaw ang bahala.`
   },
   {
      id: 'how-to-get-verified',
      question: 'Paano ako magpa-verify?',
      answer: `Ang verification ay mabilis at isang beses lang na identity check. Ang inirerekomendang paraan ay ang "Verify Your ID" — mabilis na national ID photo + selfie check na mga 3 minuto lang at gumagana sa mga supported na bansa. Kung gumagamit ka na ng World App, puwede ka ring mag-verify gamit ang World ID.

I-tap ang "Verify Yourself" sa app para magsimula. Karamihan ng check ay natatapos sa loob ng ilang minuto.`,
      readMorePath: '/academy/money/verify',
      readMoreLabel: 'Basahin ang buong guide'
   }
];

const FILIPINO_BORROWER_FAQS: AccountFAQItem[] = [
   {
      id: 'convert-loan-to-bank',
      question: 'Paano ko maililipat ang loan ko sa local bank account ko?',
      answer: `Ipadala ang USDC mo sa isang exchange o local service — Binance P2P, Coins.ph, PDAX, GCrypto (GCash), at iba pa — ibenta ito roon, at i-withdraw ang local currency diretso sa bank o e-wallet mo.

Ang pinakamahalaga: laging piliin ang Base bilang network kapag nagpapadala ng USDC. Nasa buong guide ang video walkthrough at step-by-step na instructions para sa bawat serbisyo.`,
      readMorePath: '/academy/money/withdraw',
      readMoreLabel: 'Basahin ang buong guide'
   },
   {
      id: 'how-to-repay',
      question: 'Paano ko babayaran ang loan ko?',
      answer: `Buksan ang Magbayad screen — makikita mo roon ang eksaktong halagang dapat bayaran at ang repayment address. Magpadala ng USDC doon mula sa kahit anong wallet, exchange, o local service. Kung wala ka pang USDC, bumili muna (Binance P2P, Coins.ph, PDAX, GCrypto, at iba pa) — laging sa Base network.

Magbayad bago ang due date — nagdadagdag ng Pandesal points ang bayad na on time, at kapag nabayaran mo nang on time ang loan na katumbas ng buong limit mo, maa-unlock ang susunod na Credit Level. Nasa buong guide ang bawat paraan ng pagbabayad.`,
      readMorePath: '/academy/money/repay',
      readMoreLabel: 'Basahin ang buong guide'
   },
   {
      id: 'borrow-below-limit',
      question: 'Puwede ba akong humiram nang mas mababa sa credit limit ko?',
      answer: `Oo — at inirerekomenda pa nga namin ito, lalo na kung nagsisimula ka pa lang. Ang paghiram nang mas mababa sa limit mo ay tinatawag na Trust-Building Loan.

Hindi binibilang ang mas maliliit na loan na ito para ma-unlock ang susunod na Credit Level (para roon, kailangan mong hiramin ang buong limit mo at magbayad on time), pero bumubuo ang mga ito ng repayment history mo at kikita ka ng Pandesal points tuwing magbabayad ka on time.

Kaya kung gusto mong mabilis na mapalago ang reputasyon mo, magandang paraan ang mga Trust-Building Loan.`
   },
   {
      id: 'increase-credit-limit',
      question: 'Paano ko mapapataas ang credit limit ko?',
      answer: `Tumataas ang credit limit mo kapag hiniram mo ang buong limit mo at binayaran ito on time. Tinatawag itong mga Credit-Building Loan.

Kung $20 ang limit mo at $15 lang ang hiniram mo, hindi iyon bibilang para sa susunod na level — kahit perpekto pa ang pagbabayad mo. Kailangang makita ng system na kaya mo ang buong limit bago nito itaas ang limit mo.

Ang pag-akyat ay $15 → $20 → $40 → $60 → $80 → $100 → $120 → $140, na siyang kasalukuyang maximum. Paisa-isang hakbang lang: hiramin ang max mo, magbayad on time, at ulitin.`
   }
];

const FILIPINO_LENDER_FAQS: AccountFAQItem[] = [
   {
      id: 'what-are-iou-points',
      question: 'Ano ang IOU points?',
      answer: `Ang IOU points ay reputation points na kinikita ng mga lender. Sa Year 1 model, bawat napondohang loan ay may base IOU points batay sa halagang pinondohan, dagdag pa ang borrower-stage bonus. Ipinapakita nito kung sino ang aktibong sumusuporta sa komunidad.

Sa ngayon, points pa lang ang IOU. Sa hinaharap, maglulunsad kami ng token na IOU rin ang pangalan, at iko-convert ang naipon mong points sa pamamagitan ng airdrop. Kapag may hawak kang IOU, maa-unlock mo ang iba pang benepisyo sa platform.

Para sa mga lender lang ang IOU — ang mga borrower naman ay bumubuo ng Pandesal points at Credit Level nila. Kaya kung gusto mong kumita ng IOU, pondohan ang isang loan request sa Request Board.`
   },
   {
      id: 'how-borrowers-verify',
      question: 'Paano nagpapa-verify ang mga borrower?',
      answer: `Bawat borrower ay dumadaan sa isang beses na identity verification — national ID photo + selfie check na may duplicate detection, o World ID para sa mga gumagamit ng World App. Alinman dito, kinukumpirma nito na iisa at totoong tao ang bawat borrower, kaya napipigilan ang mga pekeng account at bot.

Isang account lang ang puwedeng i-verify ng bawat tao, kaya ang borrower profile at repayment history na nakikita mo ay pag-aari ng iisang totoong tao — at hindi basta makakabalik ang mga na-ban gamit ang bagong account.`,
      readMorePath: '/academy/money/verify',
      readMoreLabel: 'Basahin ang buong guide'
   },
   {
      id: 'how-borrowers-increase-credit-limit',
      question: 'Paano napapataas ng mga borrower ang credit limit nila?',
      answer: `Napapataas ng mga borrower ang credit limit nila sa pamamagitan ng Credit-Building Loan, kung saan hinihiram nila ang buong kasalukuyang limit nila. Kapag nabayaran nila nang on time ang full-limit loan na iyon, aakyat sila ng level at maa-unlock ang mas mataas na credit limit.

Kung mas mababa sa limit nila ang hiniram nila, Trust-Building Loan iyon. Hindi sila aakyat ng level dahil doon, pero nakakatulong ito na bumuo ng mas matibay na repayment record at mas magandang borrower stats sa platform.`
   },
   {
      id: 'how-to-fund-loan',
      question: 'Paano ako magpopondo ng loan?',
      answer: `Pumunta sa Request Board at tingnan ang mga bukas na loan request. Ipinapakita ng bawat request ang stats ng borrower, credit limit, halagang hinihiram, at repayment term.

Kapag may nakita kang gusto mong pondohan, i-tap ang "Fund" at i-confirm. Agad na aalis ang USDC sa wallet mo (kadalasan ang Base Account mo, o ang Instant Wallet mo kung iyon ang gamit mo) at diretsong mapupunta sa wallet ng borrower — walang middleman, walang delay.

Masusubaybayan mo ang lahat ng aktibong loan mo at ang status ng mga bayad sa Lender Dashboard mo.`
   },
   {
      id: 'when-do-i-get-repaid',
      question: 'Kailan ako mababayaran?',
      answer: `Ang borrower ang nagtatakda ng due date kapag nag-post siya ng request — makikita mo ito nang malinaw sa loan card bago ka magpondo, kaya alam mo agad ang timeline.

Pagdating ng due date, diretsong magbabayad ang borrower sa wallet mo — kadalasan ang Base Account mo (o ang Instant Wallet mo, kung iyon ang gamit mo). Masusubaybayan mo ang status ng lahat ng aktibong loan mo sa Lender Dashboard mo.`
   }
];

const INDONESIAN_SHARED_FAQS: AccountFAQItem[] = [
   {
      id: 'does-moodeng-touch-money',
      question: 'Apakah Moodeng memegang uang saya?',
      answer: `Tidak. Moodeng tidak memegang, menyimpan, atau memindahkan dana pengguna atas nama kamu.

Pinjaman dikirim langsung dari dompet pemberi pinjaman ke dompet peminjam. Pembayaran kembali dikirim langsung dari dompet peminjam ke dompet pemberi pinjaman. Moodeng membantu lewat Papan Permintaan, verifikasi, status pembayaran kembali, dan pencatatan, agar kedua pihak bisa melihat dengan jelas apa yang terjadi.`
   },
   {
      id: 'why-usdc',
      question: 'Mengapa Moodeng memakai USDC?',
      answer: `USDC adalah stablecoin yang dipatok 1:1 ke dolar AS. Diterbitkan oleh Circle, perusahaan keuangan AS yang teregulasi, USDC menjaga nilai pinjaman tetap bisa diprediksi. Pinjaman $20 hari ini tetap bernilai $20 saat dibayar kembali, bukan $15 atau $30. Pemberi pinjaman dan peminjam tidak menanggung risiko nilai tukar hanya karena ikut serta.

USDC juga cepat dikirim ke seluruh dunia dan, saat dipakai di Base dengan Instant Wallet atau Base Account kamu, sepenuhnya bebas biaya gas. Artinya, tidak ada biaya jaringan yang memotong pembayaran kamu: 100% yang kamu kirim sampai ke pemberi pinjaman.

USDC juga diterima secara luas: semua bursa kripto besar mendukung setoran USDC, dan kamu bisa menukarnya ke mata uang biasa (dolar AS, peso, naira, dan lainnya) hampir di mana saja. Jadi saat kamu menerima pinjaman atau pembayaran kembali, kamu bisa memakainya secara on-chain, menyimpannya, atau mencairkannya. Pilihannya ada di tangan kamu.`
   },
   {
      id: 'how-to-get-verified',
      question: 'Bagaimana cara saya diverifikasi?',
      answer: `Verifikasi adalah pemeriksaan identitas singkat yang cukup dilakukan sekali. Cara yang disarankan adalah "Verifikasi ID Kamu": pemeriksaan singkat foto KTP atau kartu identitas nasional + selfie yang memakan waktu sekitar 3 menit dan tersedia di negara yang didukung. Jika kamu sudah memakai World App, kamu bisa memverifikasi dengan World ID sebagai gantinya.

Ketuk "Verifikasi Diri" di aplikasi untuk memulai. Sebagian besar pemeriksaan selesai dalam hitungan menit.`,
      readMorePath: '/academy/money/verify',
      readMoreLabel: 'Baca panduan lengkap'
   }
];

const INDONESIAN_BORROWER_FAQS: AccountFAQItem[] = [
   {
      id: 'convert-loan-to-bank',
      question: 'Bagaimana cara mencairkan pinjaman saya ke rekening bank lokal?',
      answer: `Kirim USDC kamu ke exchange atau layanan yang mendukung USDC di jaringan Base, misalnya Binance P2P, jual di sana, lalu tarik mata uang lokal langsung ke rekening bank atau dompet digital kamu. Pastikan dulu layanan tersebut mendukung jaringan Base sebelum mengirim.

Yang paling penting: selalu pilih Base sebagai jaringan saat mengirim USDC. Panduan lengkap berisi video panduan dan petunjuk langkah demi langkah.`,
      readMorePath: '/academy/money/withdraw',
      readMoreLabel: 'Baca panduan lengkap'
   },
   {
      id: 'how-to-repay',
      question: 'Bagaimana cara membayar pinjaman saya?',
      answer: `Buka layar Bayar. Di sana tertera jumlah persis yang harus dibayar dan alamat pembayarannya. Kirim USDC ke alamat itu dari dompet, exchange, atau layanan lokal mana pun. Jika kamu belum punya USDC, beli dulu (misalnya lewat Binance P2P, atau exchange atau aplikasi lain yang mendukung USDC di jaringan Base), dan selalu kirim di jaringan Base.

Bayar kembali sebelum jatuh tempo. Pembayaran kembali tepat waktu menambah poin Pandesal kamu, dan melunasi pinjaman sebesar limit penuh tepat waktu akan membuka Level Kredit berikutnya. Panduan lengkap menjelaskan setiap cara membayar kembali.`,
      readMorePath: '/academy/money/repay',
      readMoreLabel: 'Baca panduan lengkap'
   },
   {
      id: 'borrow-below-limit',
      question: 'Bisakah saya meminjam di bawah limit kredit saya?',
      answer: `Bisa, dan kami justru menyarankannya, terutama saat kamu baru mulai. Meminjam di bawah limit disebut Trust-Building Loan.

Pinjaman yang lebih kecil ini tidak dihitung untuk membuka Level Kredit berikutnya (untuk itu, kamu perlu meminjam sebesar limit penuh dan membayarnya kembali tepat waktu), tetapi pinjaman ini tetap membangun riwayat pembayaran kembali kamu dan memberi lebih banyak poin Pandesal daripada meminjam jumlah maksimum.

Jadi, jika kamu ingin cepat membangun reputasi, Trust-Building Loan adalah cara yang tepat.`
   },
   {
      id: 'increase-credit-limit',
      question: 'Bagaimana cara menaikkan limit kredit saya?',
      answer: `Limit kredit kamu naik saat kamu meminjam sebesar limit penuh dan membayarnya kembali tepat waktu. Pinjaman seperti ini disebut Credit-Building Loan.

Jika limit kamu $20 dan kamu hanya meminjam $15, pinjaman itu tidak dihitung untuk naik ke level berikutnya, meskipun kamu melunasinya dengan sempurna. Sistem perlu melihat bahwa kamu sanggup menangani limit penuh sebelum menaikkan batasnya.

Urutannya: $15 → $20 → $40 → $60 → $80 → $100 → $120 → $140, yang saat ini merupakan limit maksimum. Naik satu langkah setiap kali: pinjam sebesar limit maksimum, bayar kembali tepat waktu, lalu ulangi.`
   }
];

const INDONESIAN_LENDER_FAQS: AccountFAQItem[] = [
   {
      id: 'what-are-iou-points',
      question: 'Apa itu poin IOU?',
      answer: `Poin IOU adalah poin reputasi yang didapat pemberi pinjaman. Dalam model Tahun 1, setiap pinjaman yang didanai menghasilkan poin IOU dasar sesuai jumlah yang didanai, ditambah bonus tahap peminjam. Poin ini mencatat siapa saja yang aktif mendukung komunitas.

Saat ini IOU hanya berupa poin. Ke depannya, kami akan meluncurkan token yang juga bernama IOU, dan poin yang kamu kumpulkan akan dikonversi lewat airdrop. Memegang IOU akan membuka manfaat tambahan yang terkait dengan platform.

IOU hanya untuk pemberi pinjaman. Peminjam membangun poin Pandesal dan Level Kredit. Jadi, jika kamu ingin mendapatkan IOU, danai permintaan pinjaman dari Papan Permintaan.`
   },
   {
      id: 'how-borrowers-verify',
      question: 'Bagaimana peminjam diverifikasi?',
      answer: `Setiap peminjam menyelesaikan verifikasi identitas satu kali: pemeriksaan foto kartu identitas nasional + selfie dengan deteksi duplikat, atau World ID bagi yang memakai World App. Dengan cara mana pun, verifikasi ini memastikan setiap peminjam adalah orang sungguhan yang unik, sehingga mencegah akun palsu dan bot.

Setiap orang hanya bisa memverifikasi satu akun, jadi profil peminjam dan riwayat pembayaran kembali yang kamu lihat benar-benar milik orang yang sama. Pengguna yang diblokir juga tidak bisa begitu saja kembali dengan akun baru.`,
      readMorePath: '/academy/money/verify',
      readMoreLabel: 'Baca panduan lengkap'
   },
   {
      id: 'how-borrowers-increase-credit-limit',
      question: 'Bagaimana peminjam menaikkan limit kredit mereka?',
      answer: `Peminjam menaikkan limit kredit dengan mengambil Credit-Building Loan, yaitu meminjam sebesar limit penuh mereka saat ini. Jika mereka melunasi pinjaman sebesar limit penuh itu tepat waktu, mereka naik level dan membuka limit kredit yang lebih tinggi.

Jika mereka meminjam di bawah limit, pinjaman itu adalah Trust-Building Loan. Pinjaman ini tidak menaikkan level, tetapi membantu membangun riwayat pembayaran kembali yang lebih kuat dan statistik peminjam yang lebih baik di platform.`
   },
   {
      id: 'how-to-fund-loan',
      question: 'Bagaimana cara mendanai pinjaman?',
      answer: `Buka Papan Permintaan dan lihat permintaan pinjaman yang terbuka. Setiap permintaan menampilkan statistik peminjam, limit kredit, jumlah yang diminta, dan jangka waktu pembayaran kembali.

Saat menemukan permintaan yang ingin kamu danai, ketuk Danai lalu konfirmasi. USDC langsung keluar dari dompet kamu (biasanya Base Account kamu, atau Instant Wallet jika kamu memakainya) dan masuk langsung ke dompet peminjam. Tanpa perantara, tanpa penundaan.

Kamu bisa memantau semua pinjaman aktif dan status pembayaran kembali dari Dasbor pemberi pinjaman.`
   },
   {
      id: 'when-do-i-get-repaid',
      question: 'Kapan saya dibayar kembali?',
      answer: `Tanggal jatuh tempo ditentukan oleh peminjam saat membuat permintaan. Kamu bisa melihatnya dengan jelas di kartu pinjaman sebelum mendanai, jadi kamu selalu tahu jangka waktunya sejak awal.

Saat pinjaman jatuh tempo, peminjam membayar kembali langsung ke dompet kamu, biasanya Base Account kamu (atau Instant Wallet, jika kamu memakainya). Kamu bisa memantau status semua pinjaman aktif di Dasbor pemberi pinjaman.`
   }
];

const THAI_SHARED_FAQS: AccountFAQItem[] = [
   {
      id: 'does-moodeng-touch-money',
      question: 'Moodeng ถือหรือเข้าถึงเงินของฉันไหม?',
      answer: `ไม่เลย Moodeng ไม่ได้ถือ ดูแลรักษา หรือโอนเงินของผู้ใช้แทนคุณ

เงินกู้จะโอนตรงจากกระเป๋าเงินของผู้ให้กู้ไปยังกระเป๋าเงินของผู้ยืม และการชำระคืนก็โอนตรงจากกระเป๋าเงินของผู้ยืมกลับไปยังกระเป๋าเงินของผู้ให้กู้ Moodeng ช่วยในส่วนของกระดานคำขอ การยืนยันตัวตน สถานะการชำระคืน และการบันทึกประวัติ เพื่อให้ทั้งสองฝ่ายเห็นได้ชัดเจนว่าเกิดอะไรขึ้นบ้าง`
   },
   {
      id: 'why-usdc',
      question: 'ทำไม Moodeng จึงใช้ USDC?',
      answer: `USDC คือ stablecoin ที่ตรึงมูลค่า 1:1 กับดอลลาร์สหรัฐ ออกโดย Circle ซึ่งเป็นบริษัทการเงินในสหรัฐฯ ที่อยู่ภายใต้การกำกับดูแล USDC ทำให้มูลค่าเงินกู้คาดการณ์ได้ เงินกู้ $20 ในวันนี้ก็ยังเป็น $20 ในวันที่ชำระคืน ไม่ใช่ $15 หรือ $30 ผู้ให้กู้และผู้ยืมจึงไม่ต้องรับความเสี่ยงด้านค่าเงินเพียงเพราะเข้าร่วมใช้งาน

USDC ยังส่งไปได้ทั่วโลกอย่างรวดเร็ว และเมื่อใช้บน Base กับ Instant Wallet หรือ Base Account ก็ไม่มีค่า gas เลย ค่าธรรมเนียมเครือข่ายจึงไม่มาหักยอดชำระคืนของคุณ เงินที่คุณส่งจะถึงมือผู้ให้กู้ครบ 100%

นอกจากนี้ USDC ยังเป็นที่ยอมรับอย่างกว้างขวาง แพลตฟอร์มแลกเปลี่ยนคริปโตรายใหญ่ทุกแห่งรองรับการฝาก USDC และคุณแปลงเป็นเงินตราทั่วไป (ดอลลาร์สหรัฐ เปโซ ไนรา ฯลฯ) ได้แทบทุกที่ ดังนั้นเมื่อคุณได้รับเงินกู้หรือได้รับเงินชำระคืน คุณจะใช้จ่ายแบบออนเชน ถือไว้ หรือถอนเป็นเงินสดก็ได้ตามต้องการ`
   },
   {
      id: 'how-to-get-verified',
      question: 'ฉันจะยืนยันตัวตนได้อย่างไร?',
      answer: `การยืนยันตัวตนคือการตรวจสอบที่รวดเร็วและทำเพียงครั้งเดียว วิธีที่แนะนำคือ "ยืนยันด้วยบัตรประชาชน" ซึ่งเป็นการถ่ายรูปบัตรประชาชนและเซลฟี่สั้น ๆ ใช้เวลาประมาณ 3 นาที และใช้ได้ในประเทศที่รองรับ หากคุณใช้ World App อยู่แล้ว คุณยืนยันด้วย World ID แทนได้

แตะ "ยืนยันตัวตน" ในแอปเพื่อเริ่มต้น การตรวจสอบส่วนใหญ่เสร็จภายในไม่กี่นาที`,
      readMorePath: '/academy/money/verify',
      readMoreLabel: 'อ่านคู่มือฉบับเต็ม'
   }
];

const THAI_BORROWER_FAQS: AccountFAQItem[] = [
   {
      id: 'convert-loan-to-bank',
      question: 'ฉันจะโอนเงินกู้เข้าบัญชีธนาคารในประเทศได้อย่างไร?',
      answer: `ส่ง USDC ของคุณไปยังแพลตฟอร์มแลกเปลี่ยนคริปโตหรือบริการในประเทศ เช่น Binance P2P หรือแพลตฟอร์มแลกเปลี่ยนหรือแอปอื่นที่รองรับ USDC บนเครือข่าย Base แล้วขาย USDC ที่นั่น และถอนเงินสกุลท้องถิ่นเข้าบัญชีธนาคารหรือ e-wallet ของคุณโดยตรง ตรวจสอบก่อนส่งทุกครั้งว่าแพลตฟอร์มนั้นรองรับเครือข่าย Base

ข้อสำคัญ: เลือกเครือข่าย Base ทุกครั้งเมื่อส่ง USDC คู่มือฉบับเต็มมีวิดีโอสาธิตและคำแนะนำทีละขั้นตอนสำหรับแต่ละบริการ`,
      readMorePath: '/academy/money/withdraw',
      readMoreLabel: 'อ่านคู่มือฉบับเต็ม'
   },
   {
      id: 'how-to-repay',
      question: 'ฉันจะชำระคืนเงินกู้ได้อย่างไร?',
      answer: `เปิดหน้า "ชำระคืน" ซึ่งจะแสดงยอดที่ต้องชำระและที่อยู่สำหรับชำระคืนอย่างชัดเจน ส่ง USDC ไปยังที่อยู่นั้นจากกระเป๋าเงิน แพลตฟอร์มแลกเปลี่ยนคริปโต หรือบริการในประเทศใดก็ได้ หากคุณยังไม่มี USDC ให้ซื้อก่อน (เช่น ผ่าน Binance P2P หรือแพลตฟอร์มแลกเปลี่ยนหรือแอปที่รองรับ USDC บนเครือข่าย Base) และใช้เครือข่าย Base ทุกครั้ง

ชำระคืนก่อนวันครบกำหนด การชำระคืนตรงเวลาช่วยเพิ่มแต้ม Pandesal ของคุณ และการชำระคืนเงินกู้แบบเต็มวงเงินตรงเวลาจะปลดล็อกระดับเครดิตถัดไป คู่มือฉบับเต็มอธิบายทุกวิธีในการชำระคืน`,
      readMorePath: '/academy/money/repay',
      readMoreLabel: 'อ่านคู่มือฉบับเต็ม'
   },
   {
      id: 'borrow-below-limit',
      question: 'ฉันยืมต่ำกว่าวงเงินได้ไหม?',
      answer: `ได้ และเราแนะนำให้ทำเช่นนั้น โดยเฉพาะเมื่อคุณเพิ่งเริ่มต้น การยืมต่ำกว่าวงเงินเรียกว่า Trust-Building Loan

เงินกู้ขนาดเล็กเหล่านี้ไม่นับรวมในการปลดล็อกระดับเครดิตถัดไป (หากต้องการเลื่อนระดับ คุณต้องยืมเต็มวงเงินและชำระคืนตรงเวลา) แต่ช่วยสร้างประวัติการชำระคืน และทำให้คุณได้แต้ม Pandesal มากกว่าการยืมเต็มวงเงิน

ดังนั้นหากคุณต้องการสร้างความน่าเชื่อถืออย่างรวดเร็ว Trust-Building Loan คือวิธีที่ดีมาก`
   },
   {
      id: 'increase-credit-limit',
      question: 'ฉันจะเพิ่มวงเงินกู้ได้อย่างไร?',
      answer: `วงเงินของคุณจะเพิ่มขึ้นเมื่อคุณยืมเต็มวงเงินและชำระคืนตรงเวลา เงินกู้แบบนี้เรียกว่า Credit-Building Loan

หากวงเงินของคุณคือ $20 แต่คุณยืมเพียง $15 เงินกู้นั้นจะไม่นับรวมในการเลื่อนระดับถัดไป แม้คุณจะชำระคืนครบถ้วนตรงเวลาก็ตาม ระบบต้องเห็นว่าคุณจัดการเงินกู้เต็มวงเงินได้ก่อน จึงจะเพิ่มเพดานวงเงินให้

ลำดับขั้นของวงเงินคือ $15 → $20 → $40 → $60 → $80 → $100 → $120 → $140 ซึ่งเป็นวงเงินสูงสุดในขณะนี้ ค่อย ๆ ไปทีละขั้น: ยืมเต็มวงเงิน ชำระคืนตรงเวลา แล้วทำซ้ำ`
   }
];

const THAI_LENDER_FAQS: AccountFAQItem[] = [
   {
      id: 'what-are-iou-points',
      question: 'แต้ม IOU คืออะไร?',
      answer: `แต้ม IOU คือแต้มความน่าเชื่อถือที่ผู้ให้กู้ได้รับ ในโมเดลปีแรก เงินกู้แต่ละรายการที่คุณปล่อยกู้จะได้รับแต้ม IOU พื้นฐานตามจำนวนเงินที่ปล่อยกู้ บวกโบนัสตามระดับขั้นของผู้ยืม แต้มเหล่านี้ใช้ติดตามว่าใครกำลังสนับสนุนชุมชนอย่างต่อเนื่อง

ตอนนี้ IOU ยังเป็นเพียงแต้ม ในอนาคตเราจะเปิดตัวโทเคนที่ชื่อ IOU เช่นกัน และแต้มที่คุณสะสมไว้จะถูกแปลงผ่านการแจก airdrop การถือ IOU จะปลดล็อกสิทธิประโยชน์เพิ่มเติมที่เกี่ยวข้องกับแพลตฟอร์ม

IOU มีไว้สำหรับผู้ให้กู้เท่านั้น ส่วนผู้ยืมจะสะสมแต้ม Pandesal และระดับเครดิตแทน ดังนั้นหากคุณต้องการรับ IOU ให้ปล่อยกู้ตามคำขอจากกระดานคำขอ`
   },
   {
      id: 'how-borrowers-verify',
      question: 'ผู้ยืมยืนยันตัวตนอย่างไร?',
      answer: `ผู้ยืมทุกคนต้องยืนยันตัวตนเพียงครั้งเดียว โดยถ่ายรูปบัตรประชาชนและเซลฟี่พร้อมระบบตรวจจับบัญชีซ้ำ หรือใช้ World ID สำหรับผู้ที่ใช้ World App ไม่ว่าวิธีใดก็ยืนยันได้ว่าผู้ยืมแต่ละคนเป็นบุคคลจริงที่ไม่ซ้ำกัน ซึ่งช่วยป้องกันบัญชีปลอมและบอท

แต่ละคนยืนยันตัวตนได้เพียงหนึ่งบัญชี ดังนั้นโปรไฟล์ผู้ยืมและประวัติการชำระคืนที่คุณเห็นจึงเป็นของบุคคลจริงคนเดียวกัน และผู้ใช้ที่ถูกแบนก็ไม่สามารถกลับมาด้วยบัญชีใหม่ได้ง่าย ๆ`,
      readMorePath: '/academy/money/verify',
      readMoreLabel: 'อ่านคู่มือฉบับเต็ม'
   },
   {
      id: 'how-borrowers-increase-credit-limit',
      question: 'ผู้ยืมเพิ่มวงเงินกู้ได้อย่างไร?',
      answer: `ผู้ยืมเพิ่มวงเงินได้ด้วยการกู้ Credit-Building Loan โดยยืมเต็มวงเงินปัจจุบัน หากชำระคืนเงินกู้เต็มวงเงินนั้นตรงเวลา ผู้ยืมจะเลื่อนระดับและปลดล็อกวงเงินที่สูงขึ้น

หากยืมต่ำกว่าวงเงิน เงินกู้นั้นจะเป็น Trust-Building Loan แทน ซึ่งไม่ทำให้เลื่อนระดับ แต่ช่วยสร้างประวัติการชำระคืนที่แข็งแกร่งขึ้นและสถิติผู้ยืมที่ดีขึ้นบนแพลตฟอร์ม`
   },
   {
      id: 'how-to-fund-loan',
      question: 'ฉันจะปล่อยกู้ได้อย่างไร?',
      answer: `ไปที่กระดานคำขอและดูคำขอเงินกู้ที่เปิดอยู่ แต่ละคำขอจะแสดงสถิติของผู้ยืม วงเงิน จำนวนเงินที่ขอ และระยะเวลาชำระคืน

เมื่อพบคำขอที่ต้องการปล่อยกู้ ให้แตะ "ปล่อยกู้" แล้วยืนยัน USDC จะออกจากกระเป๋าเงินของคุณ (โดยปกติคือ Base Account หรือ Instant Wallet หากคุณใช้) ทันที และโอนตรงไปยังกระเป๋าเงินของผู้ยืม ไม่มีคนกลาง ไม่มีความล่าช้า

คุณติดตามเงินกู้ที่กำลังดำเนินอยู่และสถานะการชำระคืนทั้งหมดได้จากแดชบอร์ดผู้ให้กู้`
   },
   {
      id: 'when-do-i-get-repaid',
      question: 'ฉันจะได้รับเงินชำระคืนเมื่อใด?',
      answer: `ผู้ยืมเป็นผู้ตั้งวันครบกำหนดเมื่อโพสต์คำขอ คุณจะเห็นวันนี้อย่างชัดเจนบนการ์ดเงินกู้ก่อนปล่อยกู้ จึงรู้กำหนดเวลาล่วงหน้าเสมอ

เมื่อเงินกู้ถึงกำหนด ผู้ยืมจะชำระคืนตรงเข้ากระเป๋าเงินของคุณ (โดยปกติคือ Base Account หรือ Instant Wallet หากคุณใช้) คุณติดตามสถานะของเงินกู้ที่กำลังดำเนินอยู่ทั้งหมดได้จากแดชบอร์ดผู้ให้กู้`
   }
];

const VIETNAMESE_SHARED_FAQS: AccountFAQItem[] = [
   {
      id: 'does-moodeng-touch-money',
      question: 'Moodeng có nắm giữ tiền của tôi không?',
      answer: `Không. Moodeng không giữ, lưu ký hoặc chuyển tiền thay bạn.

Khoản vay được chuyển trực tiếp từ ví người cho vay sang ví người vay. Khoản trả nợ được chuyển trực tiếp từ ví người vay về ví người cho vay. Moodeng hỗ trợ Bảng yêu cầu, xác minh, trạng thái trả nợ và lưu trữ hồ sơ để cả hai bên đều thấy rõ những gì đã diễn ra.`
   },
   {
      id: 'why-usdc',
      question: 'Vì sao Moodeng dùng USDC?',
      answer: `USDC là stablecoin neo giá 1:1 với đô la Mỹ. Được phát hành bởi Circle — một công ty tài chính được quản lý tại Mỹ — USDC giúp giá trị khoản vay luôn dễ dự đoán: khoản vay $20 hôm nay vẫn là $20 khi trả, không phải $15 hay $30. Người cho vay và người vay không phải chịu rủi ro tỷ giá chỉ vì tham gia.

USDC còn chuyển nhanh trên toàn cầu, và khi dùng trên Base với Instant Wallet hoặc Base Account thì hoàn toàn không mất phí gas. Điều đó có nghĩa là không có phí mạng nào bị trừ vào khoản trả nợ của bạn — 100% số tiền bạn gửi đều đến tay người cho vay.

USDC cũng được chấp nhận rộng rãi: mọi sàn giao dịch crypto lớn đều hỗ trợ nạp USDC, và bạn có thể đổi USDC sang tiền pháp định (đô la Mỹ, peso, naira, v.v.) ở hầu hết mọi nơi. Vì vậy, khi nhận khoản vay hoặc được trả nợ, bạn có thể dùng USDC on-chain, giữ lại hoặc rút ra tiền mặt — tùy bạn lựa chọn.`
   },
   {
      id: 'how-to-get-verified',
      question: 'Tôi xác minh danh tính bằng cách nào?',
      answer: `Xác minh là bước kiểm tra danh tính nhanh, chỉ thực hiện một lần. Cách được khuyên dùng là "Xác minh bằng giấy tờ tùy thân" — chụp nhanh ảnh thẻ căn cước + ảnh selfie, mất khoảng 3 phút và áp dụng tại các quốc gia được hỗ trợ. Nếu bạn đã dùng World App, bạn có thể chọn xác minh bằng World ID.

Nhấn "Xác minh danh tính" trong ứng dụng để bắt đầu. Hầu hết lượt xác minh hoàn tất trong vài phút.`,
      readMorePath: '/academy/money/verify',
      readMoreLabel: 'Đọc hướng dẫn đầy đủ'
   }
];

const VIETNAMESE_BORROWER_FAQS: AccountFAQItem[] = [
   {
      id: 'convert-loan-to-bank',
      question: 'Làm sao để chuyển tiền vay về tài khoản ngân hàng trong nước?',
      answer: `Gửi USDC của bạn đến một sàn giao dịch hoặc dịch vụ — chẳng hạn Binance P2P, hoặc một sàn giao dịch hay ứng dụng khác hỗ trợ USDC trên mạng Base — bán USDC tại đó, rồi rút tiền địa phương thẳng về tài khoản ngân hàng hoặc ví điện tử của bạn. Hãy kiểm tra xem nền tảng đó có hỗ trợ mạng Base không trước khi gửi.

Điều quan trọng: luôn chọn mạng Base khi gửi USDC. Hướng dẫn đầy đủ có video minh họa và các bước chi tiết cho từng dịch vụ.`,
      readMorePath: '/academy/money/withdraw',
      readMoreLabel: 'Đọc hướng dẫn đầy đủ'
   },
   {
      id: 'how-to-repay',
      question: 'Tôi trả khoản vay bằng cách nào?',
      answer: `Mở màn hình "Trả nợ" — màn hình này hiển thị chính xác số tiền đến hạn và địa chỉ trả nợ. Gửi USDC đến địa chỉ đó từ bất kỳ ví, sàn giao dịch hoặc dịch vụ địa phương nào. Nếu bạn chưa có USDC, hãy mua trước (qua Binance P2P, hoặc một sàn giao dịch hay ứng dụng khác hỗ trợ USDC trên mạng Base — hãy kiểm tra điều này trước khi gửi) — luôn dùng mạng Base.

Hãy trả trước ngày đến hạn — trả nợ đúng hạn giúp tăng điểm Pandesal, và trả đúng hạn một khoản vay bằng toàn bộ hạn mức sẽ mở khóa Hạng tín dụng tiếp theo. Hướng dẫn đầy đủ sẽ giải thích từng cách trả nợ.`,
      readMorePath: '/academy/money/repay',
      readMoreLabel: 'Đọc hướng dẫn đầy đủ'
   },
   {
      id: 'borrow-below-limit',
      question: 'Tôi có thể vay thấp hơn hạn mức tín dụng không?',
      answer: `Có — và chúng tôi còn khuyến khích điều đó, nhất là khi bạn mới bắt đầu. Vay thấp hơn hạn mức được gọi là Trust-Building Loan (khoản vay xây dựng niềm tin).

Những khoản vay nhỏ này không được tính vào việc mở khóa Hạng tín dụng tiếp theo (muốn lên hạng, bạn cần vay toàn bộ hạn mức và trả đúng hạn), nhưng chúng giúp xây dựng lịch sử trả nợ và mang lại điểm Pandesal mỗi lần bạn trả đúng hạn.

Vì vậy, nếu bạn muốn nhanh chóng xây dựng uy tín, Trust-Building Loan là một cách rất tốt.`
   },
   {
      id: 'increase-credit-limit',
      question: 'Làm sao để tăng hạn mức tín dụng?',
      answer: `Hạn mức tín dụng của bạn tăng khi bạn vay toàn bộ hạn mức và trả đúng hạn. Những khoản vay này được gọi là Credit-Building Loan (khoản vay xây dựng tín dụng).

Nếu hạn mức của bạn là $20 mà bạn chỉ vay $15, khoản đó không được tính để lên hạng tiếp theo — kể cả khi bạn trả đầy đủ, đúng hạn. Hệ thống cần thấy bạn quản lý được toàn bộ hạn mức trước khi nâng hạn mức.

Lộ trình là $15 → $20 → $40 → $60 → $80 → $100 → $120 → $140, đây là mức tối đa hiện tại. Từng bước một: vay tối đa hạn mức, trả đúng hạn, rồi lặp lại.`
   }
];

const VIETNAMESE_LENDER_FAQS: AccountFAQItem[] = [
   {
      id: 'what-are-iou-points',
      question: 'Điểm IOU là gì?',
      answer: `Điểm IOU là điểm uy tín dành cho người cho vay. Theo mô hình Năm thứ nhất, mỗi khoản vay được cấp vốn mang lại điểm IOU cơ bản tương ứng với số tiền cấp vốn, cộng thêm điểm thưởng theo giai đoạn của người vay. Điểm IOU ghi nhận những ai đang tích cực hỗ trợ cộng đồng.

Hiện tại, IOU mới chỉ là điểm. Trong tương lai, chúng tôi sẽ ra mắt một token cũng mang tên IOU, và số điểm bạn tích lũy sẽ được quy đổi qua airdrop. Việc nắm giữ IOU sẽ mở khóa thêm các quyền lợi gắn với nền tảng.

IOU chỉ dành cho người cho vay — người vay thì xây dựng điểm Pandesal và Hạng tín dụng. Vì vậy, nếu bạn muốn kiếm IOU, hãy cấp vốn cho một yêu cầu vay trên Bảng yêu cầu.`
   },
   {
      id: 'how-borrowers-verify',
      question: 'Người vay xác minh danh tính bằng cách nào?',
      answer: `Mỗi người vay đều hoàn tất xác minh danh tính một lần — chụp ảnh thẻ căn cước + selfie, kèm cơ chế phát hiện trùng lặp, hoặc dùng World ID đối với người dùng World App. Dù theo cách nào, bước này cũng xác nhận mỗi người vay là một người thật và duy nhất, giúp ngăn chặn tài khoản giả và bot.

Mỗi người chỉ có thể xác minh một tài khoản, nên hồ sơ người vay và lịch sử trả nợ mà bạn thấy đều thuộc về cùng một người thật — và người dùng đã bị cấm không thể đơn giản quay lại bằng một tài khoản mới.`,
      readMorePath: '/academy/money/verify',
      readMoreLabel: 'Đọc hướng dẫn đầy đủ'
   },
   {
      id: 'how-borrowers-increase-credit-limit',
      question: 'Người vay tăng hạn mức tín dụng bằng cách nào?',
      answer: `Người vay tăng hạn mức tín dụng bằng cách thực hiện một Credit-Building Loan (khoản vay xây dựng tín dụng), tức là vay toàn bộ hạn mức hiện tại. Nếu trả đúng hạn khoản vay bằng toàn bộ hạn mức đó, họ sẽ lên hạng và mở khóa hạn mức tín dụng cao hơn.

Nếu vay thấp hơn hạn mức, đó là Trust-Building Loan (khoản vay xây dựng niềm tin). Khoản vay này không giúp họ lên hạng, nhưng giúp xây dựng lịch sử trả nợ vững chắc hơn và cải thiện các chỉ số người vay trên nền tảng.`
   },
   {
      id: 'how-to-fund-loan',
      question: 'Tôi cấp vốn cho khoản vay bằng cách nào?',
      answer: `Vào Bảng yêu cầu và xem các yêu cầu vay đang mở. Mỗi yêu cầu hiển thị các chỉ số của người vay, hạn mức tín dụng, số tiền yêu cầu và thời hạn trả nợ.

Khi tìm được yêu cầu bạn muốn cấp vốn, nhấn "Cấp vốn" và xác nhận. USDC sẽ rời ví của bạn (thường là Base Account, hoặc Instant Wallet nếu bạn dùng) ngay lập tức và đến thẳng ví của người vay — không qua trung gian, không chậm trễ.

Bạn có thể theo dõi tất cả khoản vay đang hoạt động và trạng thái trả nợ trên trang Tổng quan người cho vay.`
   },
   {
      id: 'when-do-i-get-repaid',
      question: 'Khi nào tôi nhận được tiền trả nợ?',
      answer: `Ngày đến hạn do người vay đặt khi đăng yêu cầu — bạn sẽ thấy rõ ngày này trên thẻ khoản vay trước khi cấp vốn, nên bạn luôn biết trước thời hạn.

Khi khoản vay đến hạn, người vay sẽ trả trực tiếp vào ví của bạn — thường là Base Account (hoặc Instant Wallet, nếu bạn dùng). Bạn có thể theo dõi trạng thái tất cả khoản vay đang hoạt động trên trang Tổng quan người cho vay.`
   }
];

export function getAccountFaqsForLocale(locale: string, isLender: boolean): AccountFAQItem[] {
   const sharedFaqs =
      locale === 'fil'
         ? FILIPINO_SHARED_FAQS
         : locale === 'id'
           ? INDONESIAN_SHARED_FAQS
           : locale === 'th'
             ? THAI_SHARED_FAQS
             : locale === 'vi'
               ? VIETNAMESE_SHARED_FAQS
               : SHARED_FAQS;
   const roleFaqs =
      locale === 'fil'
         ? isLender
            ? FILIPINO_LENDER_FAQS
            : FILIPINO_BORROWER_FAQS
         : locale === 'id'
           ? isLender
              ? INDONESIAN_LENDER_FAQS
              : INDONESIAN_BORROWER_FAQS
           : locale === 'th'
             ? isLender
                ? THAI_LENDER_FAQS
                : THAI_BORROWER_FAQS
             : locale === 'vi'
               ? isLender
                  ? VIETNAMESE_LENDER_FAQS
                  : VIETNAMESE_BORROWER_FAQS
               : isLender
                 ? LENDER_FAQS
                 : BORROWER_FAQS;
   const visibleSharedFaqs = isLender ? sharedFaqs.filter((item) => item.id !== 'how-to-get-verified') : sharedFaqs;
   return [...visibleSharedFaqs, ...roleFaqs];
}
