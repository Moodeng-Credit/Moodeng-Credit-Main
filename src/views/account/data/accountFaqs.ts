export interface AccountFAQItem {
   id: string;
   question: string;
   answer: string;
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

USDC is also fast to send globally and, when used on Base with a Base Account, is completely gasless. That means no network fees eat into your repayment — 100% of what you send reaches your lender.

It's also widely accepted: every major crypto exchange supports USDC deposits, and you can convert it to fiat (US dollars, pesos, naira, etc.) almost anywhere. So when you receive a loan or get repaid, you can spend it on-chain, hold it, or cash it out — your choice.`
   },
   {
      id: 'how-to-get-verified',
      question: 'How do I get verified?',
      answer: `We use World ID — it's the only method we accept. To get verified, you need to scan your eyes at a World ID Orb. Here's how:

First, download the World App on your phone (iOS or Android).

Then find a verification location near you. Open https://world.org/find-orb to see a map of every Orb in your country. Some locations let you book an appointment in advance; many you can just walk into.

Go to the Orb. Open the World App, follow the prompts, and let the Orb scan your eyes — it takes about a minute. The scan is converted into an anonymous proof; your biometrics never leave the device.

Once verified in the World App, come back to Moodeng and tap "Verify with World ID" — that links your World ID to your account in seconds, and you're done.`
   }
];

// Shown to borrowers only
export const BORROWER_FAQS: AccountFAQItem[] = [
   {
      id: 'convert-loan-to-bank',
      question: 'How do I convert my loan into my local bank account?',
      answer: `Once you receive USDC in your Base account, here's how to get it into your local bank:

1. Open your exchange (e.g. Binance) and find your USDC deposit address. Make sure the network is set to Base — this is important, as it keeps transfers completely free.
2. Withdraw from your Base account to that deposit address.
3. Once it arrives on the exchange, withdraw to your local bank account. If your exchange supports direct bank withdrawals, use that. If not, use the P2P feature to sell USDC and receive local currency directly to your bank.

The key detail: always select Base as the network when depositing to your exchange. Using the wrong network can result in lost funds.`
   },
   {
      id: 'how-to-repay',
      question: 'How do I repay my loan?',
      answer: `Repaying is the reverse of receiving your loan:

1. Deposit from your local bank account to your exchange (e.g. Binance) — use the P2P feature to buy USDC with local currency, or transfer from your bank if the exchange supports it.
2. Once you have USDC on the exchange, withdraw it to your Base account. Get the deposit address from your Base wallet and make sure the network is set to Base so the transfer is free.
3. Once the USDC is in your Base account, go to the Repay section in the app and follow the steps to send it to your lender.

Always repay before the due date — on-time repayment builds your Trust Score and unlocks higher credit levels.`
   },
   {
      id: 'borrow-below-limit',
      question: 'Can I borrow below my credit limit?',
      answer: `Yes — and we actually recommend it, especially when you're starting out. Borrowing below your limit is called a Trust-Building Loan.

These smaller loans don't count toward unlocking the next Credit Level (for that, you need to borrow your full limit and repay on time), but they do build your repayment history and earn you more Trust Points than borrowing your maximum would.

So if you want to grow your reputation quickly, Trust-Building Loans are a great way to do it.`
   },
   {
      id: 'increase-credit-limit',
      question: 'How do I increase my credit limit?',
      answer: `Your credit limit goes up when you borrow your full limit and repay it on time. These are called Credit-Building Loans.

If your limit is $20 and you only borrow $15, that doesn't count toward the next level — even if you repay it perfectly. The system needs to see you can handle the full limit before it raises the ceiling.

Progression goes $15 → $20 → $40 → $60 — and beyond. One step at a time: borrow your max, repay on time, repeat.`
   }
];

// Shown to lenders only
export const LENDER_FAQS: AccountFAQItem[] = [
   {
      id: 'what-are-iou-points',
      question: 'What are IOU Points?',
      answer: `IOU Points are reputation points earned by lenders. In the Year 1 model, each funded loan earns base IOU points for the amount funded plus a borrower-stage bonus. They track who's actively supporting the community.

Right now IOU is just points. Down the line, we'll launch a token also called IOU, and your accumulated points will convert via an airdrop. Holding IOU will unlock additional benefits tied to the platform.

IOU is for lenders only — borrowers build their Trust Score and Credit Level instead. So if you want to earn IOU, fund a loan request from the Request Board.`
   },
   {
      id: 'how-borrowers-verify',
      question: 'How do borrowers verify?',
      answer: `Borrowers verify through World ID. This is a one-time biometric verification that confirms each borrower is a unique real person, which helps prevent fake accounts and bots.

Each person can only create one verified account, so lenders know the borrower profile and repayment history belong to the same real individual. If someone is banned, they cannot simply come back with a new account — one World ID equals one person.`
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

When you find one you want to fund, tap Fund and confirm. The USDC leaves your Base account immediately and goes directly to the borrower's Base account — no middleman, no delay.

You can track all your active loans and repayment statuses from your Lender Dashboard.`
   },
   {
      id: 'when-do-i-get-repaid',
      question: 'When do I get repaid?',
      answer: `The due date is set by the borrower when they post their request — you'll see it clearly on the loan card before you fund, so you always know the timeline upfront.

Once the loan is due, the borrower repays directly to your Base account. You can track the status of all your active loans on your Lender Dashboard.`
   }
];

const FILIPINO_SHARED_FAQS: AccountFAQItem[] = [
   {
      id: 'does-moodeng-touch-money',
      question: 'Hinahawakan ba ng Moodeng ang pera ko?',
      answer: `Hindi. Hindi hinahawakan, iniimbak, o ginagalaw ng Moodeng ang funds mo.

Direkta ang loan mula sa wallet ng nagpapahiram papunta sa wallet ng borrower. Direkta rin ang repayments mula sa wallet ng borrower pabalik sa wallet ng nagpapahiram. Tinutulungan lang ng Moodeng ang request board, verification, repayment status, at record keeping para malinaw sa magkabilang side kung ano ang nangyari.`
   },
   {
      id: 'why-usdc',
      question: 'Bakit USDC ang ginagamit ng Moodeng?',
      answer: `Ang USDC ay stablecoin na naka-peg 1:1 sa US dollar. Ini-issue ito ng Circle, isang regulated US financial company, kaya predictable ang halaga ng loan. Ang $20 na loan ngayon ay $20 pa rin kapag binayaran, hindi biglang $15 o $30. Hindi nagkakaroon ng currency risk ang lenders at borrowers dahil lang sumali sila.

Mabilis ding ipadala ang USDC globally at, kapag ginamit sa Base gamit ang Base Account, gasless ito. Ibig sabihin, walang network fees na kakain sa repayment mo - 100% ng ipinadala mo ang makakarating sa lender.

Malawak din itong tinatanggap: supported ang USDC deposits sa major crypto exchanges, at puwede mo itong i-convert sa fiat gaya ng US dollars, pesos, naira, at iba pa. Kapag nakatanggap ka ng loan o repayment, puwede mo itong gamitin on-chain, i-hold, o i-cash out - ikaw ang pipili.`
   },
   {
      id: 'how-to-get-verified',
      question: 'Paano ako ma-ve-verify?',
      answer: `World ID ang ginagamit namin, at ito lang ang tinatanggap naming verification method. Para ma-verify, kailangan mong ipa-scan ang mata mo sa World ID Orb. Ganito ang proseso:

Una, i-download ang World App sa phone mo, iOS man o Android.

Pagkatapos, maghanap ng verification location malapit sa iyo. Buksan ang https://world.org/find-orb para makita ang mapa ng mga Orb sa bansa mo. May ilang location na puwedeng mag-book ng appointment in advance, at marami rin ang tumatanggap ng walk-in.

Pumunta sa Orb. Buksan ang World App, sundin ang prompts, at hayaan ang Orb na i-scan ang mata mo. Mga isang minuto lang ito. Kino-convert ang scan sa anonymous proof; hindi umaalis sa device ang biometrics mo.

Kapag verified ka na sa World App, bumalik sa Moodeng at i-tap ang "Verify with World ID". Ili-link nito ang World ID mo sa account mo sa loob ng ilang segundo, at tapos ka na.`
   }
];

const FILIPINO_BORROWER_FAQS: AccountFAQItem[] = [
   {
      id: 'convert-loan-to-bank',
      question: 'Paano ko ililipat ang loan ko sa local bank account ko?',
      answer: `Kapag natanggap mo na ang USDC sa Base account mo, ganito mo ito maililipat sa local bank:

1. Buksan ang exchange mo, halimbawa Binance, at hanapin ang USDC deposit address mo. Siguraduhin na Base ang napiling network. Mahalaga ito dahil libre ang transfer sa Base.
2. Mag-withdraw mula sa Base account mo papunta sa deposit address na iyon.
3. Kapag dumating na sa exchange, mag-withdraw papunta sa local bank account mo. Kung may direct bank withdrawal ang exchange mo, iyon ang gamitin. Kung wala, gamitin ang P2P feature para ibenta ang USDC at tumanggap ng local currency direkta sa bank mo.

Ang importanteng detalye: palaging piliin ang Base bilang network kapag nagde-deposit sa exchange. Kapag maling network ang ginamit, puwedeng mawala ang funds.`
   },
   {
      id: 'how-to-repay',
      question: 'Paano ko babayaran ang loan ko?',
      answer: `Ang repayment ay kabaligtaran ng pagtanggap ng loan:

1. Mag-deposit mula sa local bank account mo papunta sa exchange mo, halimbawa Binance. Gamitin ang P2P feature para bumili ng USDC gamit ang local currency, o mag-transfer mula sa bank kung supported ito ng exchange.
2. Kapag may USDC ka na sa exchange, i-withdraw ito papunta sa Base account mo. Kunin ang deposit address mula sa Base wallet mo at siguraduhing Base ang network para libre ang transfer.
3. Kapag nasa Base account mo na ang USDC, pumunta sa Magbayad section ng app at sundin ang steps para ipadala ito sa lender mo.

Palaging magbayad bago ang due date. Ang on-time repayment ay nagpapataas ng Trust Score mo at nag-u-unlock ng mas mataas na antas ng kredito.`
   },
   {
      id: 'borrow-below-limit',
      question: 'Puwede ba akong humiram nang mas mababa sa credit limit ko?',
      answer: `Oo, at inirerekomenda pa nga namin ito lalo na kung nagsisimula ka pa lang. Ang paghiram nang mas mababa sa limit mo ay tinatawag na Trust-Building Loan.

Hindi binibilang ang mas maliliit na loans na ito para ma-unlock ang susunod na antas ng kredito. Para doon, kailangan mong hiramin ang buong limit mo at magbayad on time. Pero nakakatulong ang mga ito na bumuo ng repayment history mo at makakuha ng mas maraming Trust Points kaysa kung lagi mong hihiramin ang maximum.

Kaya kung gusto mong mabilis na mapalakas ang reputation mo, magandang paraan ang Trust-Building Loans.`
   },
   {
      id: 'increase-credit-limit',
      question: 'Paano ko tataasan ang credit limit ko?',
      answer: `Tumataas ang credit limit mo kapag hiniram mo ang buong limit mo at binayaran ito on time. Tinatawag itong Credit-Building Loans.

Kung $20 ang limit mo at $15 lang ang hiniram mo, hindi iyon bibilang sa next level kahit perfect ang repayment mo. Kailangan makita ng system na kaya mong hawakan ang buong limit bago nito itaas ang ceiling.

Ang progression ay $15 -> $20 -> $40 -> $60, at pataas pa. Isang step lang bawat beses: hiramin ang max, magbayad on time, ulitin.`
   }
];

const FILIPINO_LENDER_FAQS: AccountFAQItem[] = [
   {
      id: 'what-are-iou-points',
      question: 'Ano ang IOU Points?',
      answer: `Ang IOU Points ay reputation points na kinikita ng lenders. Sa Year 1 model, bawat funded loan ay kumikita ng base IOU points batay sa amount na pinondohan, kasama ang borrower-stage bonus. Tinutulungan nitong makita kung sino ang aktibong sumusuporta sa community.

Sa ngayon, points pa lang ang IOU. Sa susunod, maglulunsad kami ng token na IOU rin ang pangalan, at ang naipon mong points ay iko-convert sa pamamagitan ng airdrop. Ang pag-hold ng IOU ay mag-u-unlock ng karagdagang benefits na konektado sa platform.

Para sa lenders lang ang IOU. Ang borrowers naman ay bumubuo ng Trust Score at antas ng kredito. Kaya kung gusto mong kumita ng IOU, mag-fund ng loan request mula sa Request Board.`
   },
   {
      id: 'how-borrowers-verify',
      question: 'Paano nave-verify ang borrowers?',
      answer: `Nave-verify ang borrowers gamit ang World ID. Isa itong one-time biometric verification na kumukumpirma na unique at totoong tao ang bawat borrower, kaya nakakatulong itong pigilan ang fake accounts at bots.

Isang verified account lang ang magagawa ng bawat tao, kaya alam ng lenders na ang borrower profile at repayment history ay pag-aari ng iisang totoong individual. Kapag na-ban ang isang tao, hindi siya basta makakabalik gamit ang bagong account. Isang World ID ay katumbas ng isang tao.`
   },
   {
      id: 'how-borrowers-increase-credit-limit',
      question: 'Paano tinataasan ng borrowers ang credit limit nila?',
      answer: `Tinataasan ng borrowers ang credit limit nila sa pamamagitan ng Credit-Building Loan, kung saan hinihiram nila ang buong current limit nila. Kapag binayaran nila ang full-limit loan na iyon on time, nagle-level up sila at nag-u-unlock ng mas mataas na credit limit.

Kung mas mababa sa limit ang hiniram nila, Trust-Building Loan iyon. Hindi iyon magle-level up sa kanila, pero nakakatulong itong bumuo ng mas malakas na repayment record at mas magandang borrower stats sa platform.`
   },
   {
      id: 'how-to-fund-loan',
      question: 'Paano ako magfa-fund ng loan?',
      answer: `Pumunta sa Request Board at tingnan ang open loan requests. Ipinapakita ng bawat request ang stats ng borrower, credit limit, requested amount, at repayment term.

Kapag may nakita kang gusto mong pondohan, i-tap ang Fund at i-confirm. Aalis agad ang USDC mula sa Base account mo at diretsong pupunta sa Base account ng borrower. Walang middleman at walang delay.

Makikita mo ang lahat ng active loans at repayment statuses mo sa Lender Dashboard.`
   },
   {
      id: 'when-do-i-get-repaid',
      question: 'Kailan ako mababayaran?',
      answer: `Ang due date ay sine-set ng borrower kapag nag-post sila ng request. Makikita mo ito nang malinaw sa loan card bago ka mag-fund, kaya alam mo agad ang timeline.

Kapag due na ang loan, diretsong magbabayad ang borrower papunta sa Base account mo. Makikita mo ang status ng lahat ng active loans mo sa Lender Dashboard.`
   }
];

const INDONESIAN_SHARED_FAQS: AccountFAQItem[] = [
   {
      id: 'does-moodeng-touch-money',
      question: 'Apakah Moodeng menyentuh uang saya?',
      answer: `Tidak. Moodeng tidak memegang, menyimpan, atau memindahkan dana pengguna untuk kamu.

Pinjaman berjalan langsung dari wallet pemberi pinjaman ke wallet peminjam. Pembayaran berjalan langsung dari wallet peminjam kembali ke wallet pemberi pinjaman. Moodeng membantu dengan papan permintaan, verifikasi, status pembayaran, dan pencatatan agar kedua sisi bisa melihat dengan jelas apa yang terjadi.`
   },
   {
      id: 'why-usdc',
      question: 'Mengapa Moodeng memakai USDC?',
      answer: `USDC adalah stablecoin yang dipatok 1:1 ke dolar AS. Diterbitkan oleh Circle, perusahaan keuangan AS yang teregulasi, USDC menjaga nilai pinjaman tetap dapat diprediksi. Pinjaman $20 hari ini tetap $20 saat dibayar, bukan tiba-tiba $15 atau $30. Pemberi pinjaman dan peminjam tidak menanggung risiko mata uang hanya karena memakai platform.

USDC juga cepat dikirim secara global dan, saat dipakai di Base dengan Base Account, sepenuhnya gasless. Artinya tidak ada biaya jaringan yang memotong pembayaran kamu: 100% yang kamu kirim sampai ke pemberi pinjaman.

USDC juga didukung luas. Hampir semua bursa kripto besar mendukung deposit USDC, dan kamu bisa mengubahnya ke fiat seperti dolar AS, peso, naira, dan lainnya di banyak tempat. Saat menerima pinjaman atau pembayaran, kamu bisa memakai on-chain, menyimpan, atau cash out. Pilihannya ada di kamu.`
   },
   {
      id: 'how-to-get-verified',
      question: 'Bagaimana cara saya diverifikasi?',
      answer: `Kami memakai World ID, dan itu satu-satunya metode verifikasi yang kami terima. Untuk diverifikasi, kamu perlu memindai mata di World ID Orb. Begini caranya:

Pertama, download World App di ponsel kamu, iOS atau Android.

Lalu cari lokasi verifikasi terdekat. Buka https://world.org/find-orb untuk melihat peta Orb di negara kamu. Beberapa lokasi memungkinkan booking janji temu sebelumnya; banyak juga yang menerima walk-in.

Datang ke Orb. Buka World App, ikuti instruksi, dan biarkan Orb memindai mata kamu. Prosesnya sekitar satu menit. Pemindaian diubah menjadi proof anonim; biometrik kamu tidak keluar dari perangkat.

Setelah terverifikasi di World App, kembali ke Moodeng dan tap "Verify with World ID". Ini menautkan World ID ke akun kamu dalam hitungan detik, lalu selesai.`
   }
];

const INDONESIAN_BORROWER_FAQS: AccountFAQItem[] = [
   {
      id: 'convert-loan-to-bank',
      question: 'Bagaimana cara mengubah pinjaman saya ke rekening bank lokal?',
      answer: `Setelah menerima USDC di Base account, begini cara memindahkannya ke bank lokal:

1. Buka exchange kamu, misalnya Binance, dan cari alamat deposit USDC. Pastikan network disetel ke Base. Ini penting karena transfer di Base gratis.
2. Withdraw dari Base account kamu ke alamat deposit tersebut.
3. Setelah tiba di exchange, withdraw ke rekening bank lokal. Jika exchange mendukung direct bank withdrawal, gunakan itu. Jika tidak, gunakan fitur P2P untuk menjual USDC dan menerima mata uang lokal langsung ke bank.

Detail penting: selalu pilih Base sebagai network saat deposit ke exchange. Memakai network yang salah bisa menyebabkan dana hilang.`
   },
   {
      id: 'how-to-repay',
      question: 'Bagaimana cara membayar pinjaman saya?',
      answer: `Pembayaran adalah kebalikan dari menerima pinjaman:

1. Deposit dari rekening bank lokal ke exchange, misalnya Binance. Gunakan fitur P2P untuk membeli USDC dengan mata uang lokal, atau transfer dari bank jika exchange mendukungnya.
2. Setelah punya USDC di exchange, withdraw ke Base account kamu. Ambil alamat deposit dari Base wallet dan pastikan network disetel ke Base agar transfer gratis.
3. Setelah USDC ada di Base account, buka bagian Bayar di app dan ikuti langkah untuk mengirimnya ke pemberi pinjaman.

Selalu bayar sebelum tanggal jatuh tempo. Pembayaran tepat waktu membangun Trust Score dan membuka level kredit yang lebih tinggi.`
   },
   {
      id: 'borrow-below-limit',
      question: 'Bisakah saya meminjam di bawah credit limit saya?',
      answer: `Ya, dan kami justru merekomendasikannya, terutama saat kamu baru mulai. Meminjam di bawah limit disebut Trust-Building Loan.

Pinjaman yang lebih kecil ini tidak dihitung untuk membuka level kredit berikutnya. Untuk itu, kamu perlu meminjam limit penuh dan membayar tepat waktu. Tetapi pinjaman kecil tetap membangun riwayat pembayaran dan memberi lebih banyak Trust Points daripada selalu meminjam maksimum.

Jadi jika kamu ingin cepat membangun reputasi, Trust-Building Loans adalah cara yang bagus.`
   },
   {
      id: 'increase-credit-limit',
      question: 'Bagaimana cara menaikkan credit limit?',
      answer: `Credit limit kamu naik saat kamu meminjam limit penuh dan membayarnya tepat waktu. Ini disebut Credit-Building Loans.

Jika limit kamu $20 dan kamu hanya meminjam $15, itu tidak dihitung untuk level berikutnya meskipun pembayaran sempurna. Sistem perlu melihat bahwa kamu bisa menangani limit penuh sebelum menaikkan ceiling.

Progression berjalan $15 -> $20 -> $40 -> $60, dan seterusnya. Satu langkah setiap kali: pinjam maksimum, bayar tepat waktu, ulangi.`
   }
];

const INDONESIAN_LENDER_FAQS: AccountFAQItem[] = [
   {
      id: 'what-are-iou-points',
      question: 'Apa itu IOU Points?',
      answer: `IOU Points adalah poin reputasi yang didapat pemberi pinjaman. Dalam model Tahun 1, setiap pinjaman yang didanai menghasilkan base IOU points berdasarkan jumlah yang didanai ditambah bonus tahap peminjam. Poin ini menunjukkan siapa yang aktif mendukung komunitas.

Saat ini IOU masih berupa poin. Ke depannya, kami akan meluncurkan token yang juga bernama IOU, dan poin yang terkumpul akan dikonversi lewat airdrop. Memegang IOU akan membuka manfaat tambahan yang terhubung ke platform.

IOU hanya untuk pemberi pinjaman. Peminjam membangun Trust Score dan level kredit. Jadi jika kamu ingin mendapatkan IOU, danai permintaan pinjaman dari Papan Permintaan.`
   },
   {
      id: 'how-borrowers-verify',
      question: 'Bagaimana peminjam diverifikasi?',
      answer: `Peminjam diverifikasi melalui World ID. Ini adalah verifikasi biometrik satu kali yang memastikan setiap peminjam adalah orang sungguhan yang unik, sehingga membantu mencegah akun palsu dan bot.

Setiap orang hanya bisa membuat satu akun terverifikasi, sehingga pemberi pinjaman tahu profil peminjam dan riwayat pembayarannya milik orang nyata yang sama. Jika seseorang diblokir, mereka tidak bisa begitu saja kembali dengan akun baru. Satu World ID sama dengan satu orang.`
   },
   {
      id: 'how-borrowers-increase-credit-limit',
      question: 'Bagaimana peminjam menaikkan credit limit mereka?',
      answer: `Peminjam menaikkan credit limit dengan mengambil Credit-Building Loan dan meminjam limit penuh saat ini. Jika mereka membayar pinjaman full-limit itu tepat waktu, mereka naik level dan membuka credit limit yang lebih tinggi.

Jika mereka meminjam di bawah limit, itu adalah Trust-Building Loan. Itu tidak menaikkan level, tetapi membantu membangun catatan pembayaran yang lebih kuat dan statistik peminjam yang lebih baik di platform.`
   },
   {
      id: 'how-to-fund-loan',
      question: 'Bagaimana cara mendanai pinjaman?',
      answer: `Buka Papan Permintaan dan lihat permintaan pinjaman yang terbuka. Setiap permintaan menunjukkan statistik peminjam, credit limit, jumlah yang diminta, dan tenor pembayaran.

Saat menemukan pinjaman yang ingin kamu danai, tap Danai dan konfirmasi. USDC langsung keluar dari Base account kamu dan masuk langsung ke Base account peminjam. Tidak ada perantara dan tidak ada penundaan.

Kamu bisa melacak semua pinjaman aktif dan status pembayaran dari Lender Dashboard.`
   },
   {
      id: 'when-do-i-get-repaid',
      question: 'Kapan saya dibayar kembali?',
      answer: `Tanggal jatuh tempo ditentukan oleh peminjam saat mereka membuat permintaan. Kamu akan melihatnya dengan jelas di kartu pinjaman sebelum mendanai, jadi timeline selalu jelas sejak awal.

Saat pinjaman jatuh tempo, peminjam membayar langsung ke Base account kamu. Kamu bisa melacak status semua pinjaman aktif di Lender Dashboard.`
   }
];

const THAI_SHARED_FAQS: AccountFAQItem[] = [
   {
      id: 'does-moodeng-touch-money',
      question: 'Moodeng จับเงินของฉันไหม?',
      answer: `ไม่ Moodeng ไม่ถือ ไม่ดูแล และไม่ย้ายเงินของผู้ใช้แทนคุณ

เงินกู้จะส่งตรงจากกระเป๋าของผู้ให้กู้ไปยังกระเป๋าของผู้ยืม การชำระคืนก็ส่งตรงจากกระเป๋าของผู้ยืมกลับไปยังกระเป๋าของผู้ให้กู้ Moodeng ช่วยเรื่องกระดานคำขอ การยืนยัน สถานะการชำระคืน และการเก็บประวัติเท่านั้น`
   },
   {
      id: 'why-usdc',
      question: 'ทำไม Moodeng ใช้ USDC?',
      answer: `USDC เป็น stablecoin ที่ผูก 1:1 กับดอลลาร์สหรัฐ ทำให้มูลค่าเงินกู้คาดเดาได้ เงินกู้ $20 วันนี้ยังเป็น $20 ตอนชำระคืน

USDC ยังส่งได้รวดเร็วทั่วโลก และเมื่อใช้บน Base กับ Base Account จะไม่มีค่า gas จึงไม่มีค่าธรรมเนียมเครือข่ายมาหักเงินที่คุณชำระคืน`
   },
   {
      id: 'how-to-get-verified',
      question: 'ฉันจะยืนยันตัวตนได้อย่างไร?',
      answer: `เราใช้ World ID เท่านั้น คุณต้องสแกนดวงตาที่ World ID Orb

ดาวน์โหลด World App บนโทรศัพท์ ค้นหาสถานที่ยืนยันใกล้คุณที่ https://world.org/find-orb ไปที่ Orb แล้วทำตามขั้นตอนในแอป หลังจากยืนยันใน World App แล้วกลับมาที่ Moodeng และแตะ "Verify with World ID" เพื่อเชื่อมบัญชี`
   }
];

const THAI_BORROWER_FAQS: AccountFAQItem[] = [
   {
      id: 'convert-loan-to-bank',
      question: 'ฉันจะแปลงเงินกู้เข้าบัญชีธนาคารท้องถิ่นได้อย่างไร?',
      answer: `เมื่อได้รับ USDC ในบัญชี Base แล้ว ให้ฝาก USDC เข้า exchange ของคุณ เช่น Binance โดยเลือกเครือข่าย Base จากนั้นถอนเป็นสกุลเงินท้องถิ่นเข้าธนาคาร หาก exchange ไม่มีถอนธนาคารโดยตรง ให้ใช้ P2P เพื่อขาย USDC

รายละเอียดสำคัญคือเลือก Base เป็นเครือข่ายเสมอ การเลือกผิดเครือข่ายอาจทำให้เงินหายได้`
   },
   {
      id: 'how-to-repay',
      question: 'ฉันจะชำระคืนเงินกู้ได้อย่างไร?',
      answer: `การชำระคืนคือกระบวนการย้อนกลับจากการรับเงินกู้

ซื้อหรือฝาก USDC ผ่าน exchange ของคุณ จากนั้นถอน USDC ไปยังบัญชี Base ตรวจสอบว่าเลือกเครือข่าย Base เพื่อให้โอนฟรี เมื่อ USDC อยู่ในบัญชี Base แล้ว ไปที่ส่วนชำระในแอปและทำตามขั้นตอนเพื่อส่งให้ผู้ให้กู้

ชำระก่อนวันครบกำหนดเสมอ เพราะการชำระตรงเวลาช่วยเพิ่ม Trust Score และปลดล็อกระดับเครดิตที่สูงขึ้น`
   },
   {
      id: 'borrow-below-limit',
      question: 'ฉันยืมต่ำกว่าวงเงินเครดิตได้ไหม?',
      answer: `ได้ และเราแนะนำโดยเฉพาะเมื่อคุณเพิ่งเริ่ม การยืมต่ำกว่าวงเงินเรียกว่า Trust-Building Loan

เงินกู้ขนาดเล็กเหล่านี้ไม่ได้นับเพื่อปลดล็อกระดับเครดิตถัดไป แต่ช่วยสร้างประวัติการชำระคืนและเพิ่ม Trust Points ได้ดี`
   },
   {
      id: 'increase-credit-limit',
      question: 'ฉันจะเพิ่มวงเงินเครดิตได้อย่างไร?',
      answer: `วงเงินเครดิตเพิ่มขึ้นเมื่อคุณยืมเต็มวงเงินและชำระคืนตรงเวลา สิ่งนี้เรียกว่า Credit-Building Loan

ถ้าวงเงินของคุณคือ $20 แต่ยืมแค่ $15 จะไม่นับสู่ระดับถัดไป แม้ว่าจะชำระดีมากก็ตาม ระบบต้องเห็นว่าคุณจัดการเต็มวงเงินได้ก่อน`
   }
];

const THAI_LENDER_FAQS: AccountFAQItem[] = [
   {
      id: 'what-are-iou-points',
      question: 'IOU Points คืออะไร?',
      answer: `IOU Points คือคะแนนชื่อเสียงที่ผู้ให้กู้ได้รับ ในโมเดลปีแรก เงินกู้ที่ได้รับทุนแต่ละรายการจะสร้าง IOU points ตามจำนวนเงิน พร้อมโบนัสตามสถานะผู้ยืม

ตอนนี้ IOU เป็นคะแนนก่อน ในอนาคตเราจะเปิดตัวโทเคน IOU และคะแนนสะสมจะถูกแปลงผ่าน airdrop`
   },
   {
      id: 'how-borrowers-verify',
      question: 'ผู้ยืมยืนยันตัวตนอย่างไร?',
      answer: `ผู้ยืมยืนยันผ่าน World ID ซึ่งเป็นการยืนยันชีวภาพครั้งเดียวเพื่อยืนยันว่าแต่ละคนเป็นบุคคลจริงที่ไม่ซ้ำกัน สิ่งนี้ช่วยป้องกันบัญชีปลอมและบอท`
   },
   {
      id: 'how-borrowers-increase-credit-limit',
      question: 'ผู้ยืมเพิ่มวงเงินเครดิตอย่างไร?',
      answer: `ผู้ยืมเพิ่มวงเงินโดยทำ Credit-Building Loan และยืมเต็มวงเงินปัจจุบัน หากชำระเต็มจำนวนตรงเวลา ก็จะเลื่อนระดับและปลดล็อกวงเงินสูงขึ้น`
   },
   {
      id: 'how-to-fund-loan',
      question: 'ฉันจะให้ทุนเงินกู้ได้อย่างไร?',
      answer: `ไปที่กระดานคำขอและดูคำขอเงินกู้ที่เปิดอยู่ แต่ละคำขอจะแสดงสถิติผู้ยืม วงเงิน จำนวนเงินที่ต้องการ และเงื่อนไขการชำระคืน

เมื่อพบคำขอที่ต้องการ ให้แตะ Fund และยืนยัน USDC จะออกจากบัญชี Base ของคุณไปยังบัญชี Base ของผู้ยืมโดยตรง`
   },
   {
      id: 'when-do-i-get-repaid',
      question: 'ฉันจะได้รับชำระคืนเมื่อไหร่?',
      answer: `วันครบกำหนดถูกกำหนดโดยผู้ยืมเมื่อโพสต์คำขอ คุณจะเห็นชัดเจนบนการ์ดเงินกู้ก่อนให้ทุน

เมื่อถึงกำหนด ผู้ยืมจะชำระคืนตรงเข้าบัญชี Base ของคุณ และคุณติดตามสถานะได้จาก Lender Dashboard`
   }
];

const VIETNAMESE_SHARED_FAQS: AccountFAQItem[] = [
   {
      id: 'does-moodeng-touch-money',
      question: 'Moodeng có chạm vào tiền của tôi không?',
      answer: `Không. Moodeng không giữ, lưu ký hoặc di chuyển tiền của người dùng thay bạn.

Khoản vay đi trực tiếp từ ví người cho vay sang ví người vay. Khoản trả đi trực tiếp từ ví người vay về ví người cho vay. Moodeng chỉ hỗ trợ bảng yêu cầu, xác minh, trạng thái trả nợ và ghi nhận lịch sử để hai bên thấy rõ điều gì đã xảy ra.`
   },
   {
      id: 'why-usdc',
      question: 'Vì sao Moodeng dùng USDC?',
      answer: `USDC là stablecoin neo 1:1 với đô la Mỹ, giúp giá trị khoản vay dễ dự đoán. Khoản vay $20 hôm nay vẫn là $20 khi trả, không thành $15 hay $30.

USDC cũng chuyển toàn cầu rất nhanh và khi dùng trên Base với Base Account thì hoàn toàn không tốn gas. Điều đó có nghĩa là không có phí mạng ăn vào khoản trả của bạn.`
   },
   {
      id: 'how-to-get-verified',
      question: 'Tôi xác minh bằng cách nào?',
      answer: `Chúng tôi dùng World ID và chỉ chấp nhận phương thức này. Bạn cần quét mắt tại World ID Orb.

Tải World App trên điện thoại, tìm địa điểm Orb gần bạn tại https://world.org/find-orb, đến Orb và làm theo hướng dẫn trong app. Khi đã xác minh trong World App, quay lại Moodeng và bấm "Verify with World ID" để liên kết tài khoản.`
   }
];

const VIETNAMESE_BORROWER_FAQS: AccountFAQItem[] = [
   {
      id: 'convert-loan-to-bank',
      question: 'Làm sao chuyển khoản vay về tài khoản ngân hàng địa phương?',
      answer: `Khi bạn nhận USDC trong tài khoản Base, hãy gửi USDC vào sàn của bạn, ví dụ Binance, và nhớ chọn mạng Base. Sau khi USDC đến sàn, rút về ngân hàng địa phương. Nếu sàn không hỗ trợ rút ngân hàng trực tiếp, dùng P2P để bán USDC và nhận nội tệ.

Chi tiết quan trọng: luôn chọn Base khi nạp vào sàn. Chọn sai mạng có thể làm mất tiền.`
   },
   {
      id: 'how-to-repay',
      question: 'Tôi trả khoản vay bằng cách nào?',
      answer: `Việc trả nợ là chiều ngược lại của lúc nhận khoản vay.

Mua hoặc nạp USDC qua sàn của bạn, sau đó rút USDC về tài khoản Base. Lấy địa chỉ nạp từ ví Base và đảm bảo mạng là Base để chuyển miễn phí. Khi USDC đã ở tài khoản Base, vào phần Trả nợ trong app và làm theo các bước để gửi cho người cho vay.

Luôn trả trước ngày đến hạn. Trả đúng hạn giúp tăng Trust Score và mở khóa hạng tín dụng cao hơn.`
   },
   {
      id: 'borrow-below-limit',
      question: 'Tôi có thể vay thấp hơn hạn mức tín dụng không?',
      answer: `Có, và chúng tôi thật sự khuyến nghị điều đó, nhất là khi bạn mới bắt đầu. Vay thấp hơn hạn mức được gọi là Trust-Building Loan.

Các khoản nhỏ này không mở khóa hạng tín dụng tiếp theo, nhưng chúng xây dựng lịch sử trả nợ và giúp bạn kiếm nhiều Trust Points hơn.`
   },
   {
      id: 'increase-credit-limit',
      question: 'Làm sao tăng hạn mức tín dụng?',
      answer: `Hạn mức tăng khi bạn vay toàn bộ hạn mức và trả đúng hạn. Đây gọi là Credit-Building Loan.

Nếu hạn mức là $20 nhưng bạn chỉ vay $15, điều đó không được tính cho cấp tiếp theo, kể cả khi bạn trả hoàn hảo. Hệ thống cần thấy bạn xử lý được toàn bộ hạn mức trước khi nâng trần.`
   }
];

const VIETNAMESE_LENDER_FAQS: AccountFAQItem[] = [
   {
      id: 'what-are-iou-points',
      question: 'IOU Points là gì?',
      answer: `IOU Points là điểm uy tín người cho vay kiếm được. Trong mô hình năm 1, mỗi khoản vay được cấp vốn tạo điểm IOU cơ bản theo số tiền cấp vốn cộng với bonus theo giai đoạn người vay.

Hiện tại IOU chỉ là điểm. Về sau chúng tôi sẽ ra mắt token cũng tên IOU, và điểm tích lũy của bạn sẽ chuyển đổi qua airdrop.`
   },
   {
      id: 'how-borrowers-verify',
      question: 'Người vay xác minh bằng cách nào?',
      answer: `Người vay xác minh qua World ID. Đây là xác minh sinh trắc học một lần để xác nhận mỗi người vay là một người thật duy nhất, giúp ngăn tài khoản giả và bot.`
   },
   {
      id: 'how-borrowers-increase-credit-limit',
      question: 'Người vay tăng hạn mức tín dụng bằng cách nào?',
      answer: `Người vay tăng hạn mức bằng cách lấy Credit-Building Loan và vay toàn bộ hạn mức hiện tại. Nếu họ trả khoản full-limit đó đúng hạn, họ lên cấp và mở khóa hạn mức cao hơn.`
   },
   {
      id: 'how-to-fund-loan',
      question: 'Tôi cấp vốn cho khoản vay bằng cách nào?',
      answer: `Vào Bảng yêu cầu và xem các yêu cầu vay đang mở. Mỗi yêu cầu hiển thị thống kê người vay, hạn mức, số tiền yêu cầu và kỳ hạn trả.

Khi thấy khoản muốn cấp vốn, bấm Fund và xác nhận. USDC rời tài khoản Base của bạn ngay lập tức và đi thẳng đến tài khoản Base của người vay.`
   },
   {
      id: 'when-do-i-get-repaid',
      question: 'Khi nào tôi được trả?',
      answer: `Ngày đến hạn do người vay đặt khi đăng yêu cầu. Bạn sẽ thấy rõ trên thẻ khoản vay trước khi cấp vốn.

Khi khoản vay đến hạn, người vay trả trực tiếp về tài khoản Base của bạn. Bạn có thể theo dõi trạng thái các khoản vay đang hoạt động trong Lender Dashboard.`
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
