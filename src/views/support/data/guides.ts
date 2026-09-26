export interface GuideArticle {
   slug: string;
   title: string;
   lastUpdated: string;
   body: string;
}

type LocalizedGuideArticle = Pick<GuideArticle, 'title' | 'lastUpdated' | 'body'>;

export const GUIDES: GuideArticle[] = [
   {
      slug: 'how-to-request-your-first-loan',
      title: 'How to Request Your First Loan',
      lastUpdated: 'Jun 9, 2026',
      body: `Follow these streamlined steps to initiate your first loan request on Moodeng Credit. You can also view a video walkthrough of this process here: https://youtube.com/shorts/fKpBC9zD6Hk?si=KoU6NRuIguzLw-Hh.

Step 1: Create Your Account
Register on the Moodeng platform by entering your preferred username, email, and password. Click "Create Account" to proceed.

Step 2: Start Your Loan Application
Once logged in, tap the "Apply for a Loan" button to start the process.

Step 3: Set Up Your Wallet
Secure transactions on Moodeng need a wallet. By default, you use a Moodeng Instant Wallet — it is created from your Moodeng login, with no separate app or seed phrase. If you prefer, you can use a Base Account instead: visit https://account.base.app and follow the registration instructions.

Step 4: Connect Your Wallet
Return to the Moodeng platform and tap "Connect Wallet" to create your Instant Wallet — or securely link your Base Account if you chose one — so it is tied to your Moodeng account.

Step 5: Verify Your Identity
To ensure community safety, tap "Verify Yourself" and complete the quick ID + selfie check ("Verify Your ID") — it takes about 3 minutes. Already a World App user? You can choose "Verify with World ID" instead.

Step 6: Submit Your Request
Tap "Explore the Request Board" to set your specific loan terms. You will need to define:
- The desired loan amount.
- The repayment amount and date.
- A clear reason for your borrowing request to help build trust with potential lenders.`
   },
   {
      slug: 'understanding-your-trust-score',
      title: 'Understanding your Pandesal points',
      lastUpdated: 'Jun 9, 2026',
      body: `Your Pandesal points reflect how reliably you repay loans on Moodeng Credit.

They rise with every on-time repayment and drop when you miss or default. Lenders use them as a quick signal to decide whether to fund your request.

Because your Pandesal points are tied to your wallet, they travel with you — they're not locked inside a single app.`
   },
   {
      slug: 'how-credit-levels-work',
      title: 'How Credit Levels work',
      lastUpdated: 'Jun 9, 2026',
      body: `Credit Levels determine how much you can borrow at a time.

Everyone starts at Level 1 with a $15 limit. As you borrow and fully repay, your limit grows — $15 → $20 → $40 → $60 → $80 → $100 → $120 → $140 — and unlocks new levels.

You only advance by completing a Credit-Building Loan: a loan at your full current limit, repaid in full and on time.`
   },
   {
      slug: 'trust-building-vs-credit-building-loans',
      title: 'Trust-Building vs Credit-Building loans',
      lastUpdated: 'Jun 9, 2026',
      body: `Moodeng Credit supports two kinds of loans:

Trust-Building Loans are smaller loans below your current limit. They help you demonstrate reliable repayment but don't increase your limit.

Credit-Building Loans are full-limit loans. Repaying one on time raises your limit and unlocks the next Credit Level.

Most borrowers use both — Trust-Building Loans to keep their repayment record active, Credit-Building Loans to grow their limit over time.`
   },
   {
      slug: 'how-repayments-affect-your-trust-score',
      title: 'How Repayments Affect Your Pandesal Points',
      lastUpdated: 'Jun 9, 2026',
      body: `Every repayment for either Credit-Building or Trust-Building loans directly impacts your Pandesal points, which serve as your reputation on the platform. Our system is designed to reward consistent, reliable, and honest behavior; small loans repaid cleanly are more valuable for your reputation than large loans repaid sloppily.

Scoring Breakdown

- On-Time, Full Repayments: Completing a 100% repayment on or before the due date earns the maximum (10 points).

- Partial Repayments: Failing to repay the full amount reduces your points proportionally — 75% = 7 points · 50% = 5 points · 25% = 3 points.

- Late Repayments: Any payment received after the agreed-upon deadline results in 0 points for that transaction.

- Defaults: Unpaid loans leave a permanent mark on your profile that is visible to all future lenders.`
   },
   {
      slug: 'what-happens-when-you-repay-a-loan-on-time',
      title: 'The Benefits of On-Time Repayments',
      lastUpdated: 'Jun 9, 2026',
      body: `Submitting your repayment on or before the scheduled deadline is the most effective way to strengthen your standing within the Moodeng Credit ecosystem. All repayments are confirmed on-chain; once the USDC transfer settles, your loan status is automatically updated to "Successfully Repaid."

When you repay on time, the following benefits are applied to your profile:

- More Pandesal Points: Your Pandesal points increase for either Credit-Building or Trust-Building loans, reflecting your reliability to the community.
- Credit Limit Progression: For Credit-Building loans, your current borrowing limit increases, successfully unlocking the next credit level (e.g., advancing from $15 → $20).
- Verified Lending History: Your successful repayment history becomes visible to potential lenders, significantly streamlining the funding process for your future requests.

Repayment Scoring Breakdown

Your Pandesal points reflect your reliability and determine your future funding success:

- On-Time, Full Repayment: Awards the maximum 10 points.
- Partial Repayment: Your points are reduced proportionally based on the amount paid (e.g., 75% = 7 points; 50% = 5 points).
- Late Repayment: Any payment made after the deadline results in 0 points, regardless of the amount.
- Default: Unpaid loans result in a permanent mark on your public on-chain profile.`
   },
   {
      slug: 'repaying-your-loan',
      title: 'Ways to repay your loan',
      lastUpdated: 'Jul 3, 2026',
      body: `To repay, send the required USDC amount to the repayment address shown in Moodeng (the Repay screen shows the exact amount and lets you copy the address). You can send from a wallet, an exchange, a P2P platform, or a local crypto service — whatever is available in your country.

Sending from a wallet
If you already hold USDC in any wallet, send the repayment amount to the address shown in Moodeng. Make sure the network is Base.

Sending from an exchange
Withdraw USDC from your exchange account directly to the repayment address. Choose USDC and select Base as the network.

Buying USDC first, then repaying
If you don't hold USDC yet, buy it first and send it to your wallet, then repay from there:
- Binance P2P: buy USDC with local currency from other users, then withdraw on the Base network.
- Coins.ph: buy USDC with PHP, then use Send Crypto → External Wallet → Base network.
- GCrypto (GCash): if crypto is enabled in your GCash app, buy USDC and withdraw via USDCBASE.
- PDAX: buy USDC with PHP and withdraw to your wallet on Base.
- Moneybees (external option): an over-the-counter service some users may use to buy crypto through Moneybees' own process. Follow their instructions directly at https://www.moneybees.ph/.

The key detail: always select Base as the network when sending USDC. Using the wrong network can result in lost funds.`
   },
   {
      slug: 'adding-funds-to-your-wallet',
      title: 'Ways to add USDC to your wallet',
      lastUpdated: 'Jul 3, 2026',
      body: `Your Moodeng wallet works with USDC on the Base network. Besides the in-app options (card purchase and bridging from another chain), here are common ways to get USDC into your wallet:

Buy on an exchange
Buy USDC on an exchange you already use, then withdraw it to your wallet address. Always select USDC and the Base network when withdrawing.

Binance P2P
Buy USDC with local currency directly from other users, then withdraw on the Base network.

Philippine services
- Coins.ph: buy USDC with PHP, then Send Crypto → External Wallet → Base network.
- PDAX: buy USDC with PHP and withdraw to your wallet on Base.
- GCrypto (GCash): if crypto is enabled in your GCash app, buy and withdraw via USDCBASE.

Moneybees (external option)
Moneybees is an external over-the-counter service some users may use to buy crypto through Moneybees' own process. You'll need to follow Moneybees' instructions directly at https://www.moneybees.ph/.

Send from another wallet
If you hold USDC elsewhere, send it to your Moodeng wallet address — on the Base network.

The key detail: always choose Base as the network. Sending on the wrong network can result in lost funds.`
   },
   {
      slug: 'withdrawing-to-your-bank',
      title: 'Withdrawing your funds to a bank account',
      lastUpdated: 'Jul 3, 2026',
      body: `You can withdraw by sending your USDC to a supported exchange or service, selling it there, and transferring the local currency to your bank account.

Video walkthrough — sending USDC from your Base Account to Binance: https://www.youtube.com/watch?v=Bqc2u3utbwc

Common options:

Binance P2P
Send USDC to your Binance account (always choose the Base network), then sell it through Binance P2P and receive local currency straight to your bank or e-wallet.

PDAX
A BSP-regulated Philippine exchange. Deposit USDC, sell for PHP, and withdraw to your bank account.

Coins.ph
Deposit USDC, convert to PHP, and cash out to your bank or GCash.

GCrypto (GCash)
If crypto is enabled in your GCash app, you can receive supported crypto and convert inside GCash.

Moneybees (external option)
Moneybees is an external over-the-counter service some users may use to buy or sell crypto through Moneybees' own process. You'll need to follow Moneybees' instructions directly at https://www.moneybees.ph/.

Another wallet or exchange
You can always send USDC to any wallet or exchange you already use — just make sure it supports USDC on the Base network before sending.

The key detail: always select Base as the network when depositing to an exchange. Using the wrong network can result in lost funds.`
   },
   {
      slug: 'using-usdc-on-moodeng-credit',
      title: 'Using USDC on Moodeng Credit',
      lastUpdated: 'Jun 9, 2026',
      body: `All loans on Moodeng Credit are denominated in USDC — a regulated stablecoin pegged 1:1 to the US dollar.

Using USDC means loan values stay consistent. A $20 loan today is still a $20 loan when you repay it, regardless of crypto market movement.

Your Instant Wallet (or a Base Account, if you prefer) runs on Base, where USDC transfers are gasless — you pay no network fees.`
   },
   {
      slug: 'verification-and-why-its-required',
      title: 'Verification & Security',
      lastUpdated: 'Jun 9, 2026',
      body: `To keep Moodeng safe and fair, all borrowers complete a short one-time identity verification. This protects the community from fake and duplicate accounts, and it's what lets lenders trust the requests they fund.

Why verify?
- Security: ensures every request comes from a real, unique person, preventing fraud.
- Access: completed verification unlocks loan requests and starts your Pandesal points.

The recommended way: Verify Your ID
1. Tap "Verify Yourself" in the app and choose "Verify Your ID".
2. Have your physical national ID ready and find good, even lighting.
3. Complete the quick ID photo + selfie check — it takes about 3 minutes.
4. Most checks finish in minutes. If yours needs a human review, we'll notify you as soon as it's done (usually within a few hours, at most 1 business day).

Your ID is checked by our secure verification partner and is never stored by Moodeng.

Alternative: Verify with World ID
If you already use World App — verified in person at an Orb or with a biometric passport — you can choose "Verify with World ID" instead and confirm through the World App.`
   },
   {
      slug: 'managing-your-account-and-security-settings',
      title: 'Managing your account and security settings',
      lastUpdated: 'Jun 9, 2026',
      body: `Your account is tied to your wallet, so wallet security is account security.

From the Account screen, you can update your display name, manage your email, change your password, and sign out.`
   }
];

const FILIPINO_GUIDES: Record<string, LocalizedGuideArticle> = {
   'how-to-request-your-first-loan': {
      title: 'Paano mag-request ng unang loan',
      lastUpdated: 'Jun 9, 2026',
      body: `Sundin ang mga simpleng step na ito para simulan ang unang loan request mo sa Moodeng Credit. Puwede mo ring panoorin ang video walkthrough dito: https://youtube.com/shorts/fKpBC9zD6Hk?si=KoU6NRuIguzLw-Hh.

Step 1: Gumawa ng account
Mag-register sa Moodeng platform gamit ang preferred username, email, at password mo. I-click ang "Create Account" para magpatuloy.

Step 2: Simulan ang loan application
Kapag naka-log in ka na, i-tap ang "Apply for a Loan" button para simulan ang proseso.

Step 3: I-set up ang wallet mo
Kailangan ng wallet para sa secure transactions sa Moodeng. Bilang default, Moodeng Instant Wallet ang gamit mo — ginagawa ito mula sa Moodeng login mo, walang hiwalay na app o seed phrase. Kung mas gusto mo, puwede kang gumamit ng Base Account: pumunta sa https://account.base.app at sundin ang registration instructions.


Step 4: Ikonek ang wallet mo
Bumalik sa Moodeng platform at i-tap ang "Connect Wallet" para gumawa ng Instant Wallet mo — o secure na i-link ang Base Account mo kung iyon ang pinili mo — sa Moodeng account mo.

Step 5: I-verify ang identity mo
Para mapanatiling safe ang community, i-download ang World App at kumpletuhin ang human identity verification sa physical World Orb location.

Step 6: I-link ang World ID
Pagkatapos mag-verify sa Orb, bumalik sa Moodeng at i-tap ang "Verify with World ID." I-scan ang QR code para ma-finalize ang link ng World ID mo at Moodeng account mo.

Step 7: I-submit ang request mo
I-tap ang "Explore the Request Board" para i-set ang specific loan terms mo. Kailangan mong ilagay:
- Desired loan amount.
- Repayment amount at date.
- Malinaw na reason kung bakit ka nanghihiram para makatulong bumuo ng tiwala sa potential lenders.

Important notes tungkol sa credit limit mo
- Starting limit: Bawat bagong borrower ay nagsisimula sa initial borrowing limit na $15.
- Credit-building loans: Full-limit loan ito na gumagamit ng buong current credit limit mo, halimbawa full $15 request. Ang successful repayment ng ganitong loan lang ang paraan para tumaas ang limit mo sa next level, halimbawa $15 → $20 → $40 → $60 → $80 → $100 → $120 → $140 at pataas. Isang credit-building loan request lang ang puwedeng active at a time.
- Trust-building loans: Mas maliit na loans ito na below sa current credit limit mo. Nakakatulong ito bumuo ng Pandesal points mo sa lenders, pero hindi nito tinataas ang overall credit limit mo. Puwede kang magkaroon ng multiple trust-building loan requests at the same time basta ang total ay nasa ilalim ng current limit mo.
- Pag-unlock ng next level: Para umakyat, kailangan mong hiramin at fully repay ang buong limit mo. Halimbawa, kung $15 ang limit mo at $12 trust-building loan lang ang ni-request mo at nagbayad ka ng $15, hindi tataas ang limit mo. Kailangan mong hiramin ang buong $15 at bayaran ang total agreed amount, kasama ang anumang maliit na interest o additional repayment amount na inoffer mo at tinanggap ng lender, para ma-unlock ang next level.`
   },
   'understanding-your-trust-score': {
      title: 'Pag-unawa sa Pandesal points mo',
      lastUpdated: 'Jun 9, 2026',
      body: `Ipinapakita ng Pandesal points mo kung gaano ka reliable magbayad ng loans sa Moodeng Credit.

Tumataas ito sa bawat on-time repayment at bumababa kapag late ka o nag-default. Ginagamit ito ng lenders bilang mabilis na signal para mag-decide kung i-fund nila ang request mo.

Dahil naka-tie ang Pandesal points mo sa wallet mo, dala mo ito kahit saan. Hindi ito nakakulong sa isang app lang.`
   },
   'how-credit-levels-work': {
      title: 'Paano gumagana ang mga antas ng kredito',
      lastUpdated: 'Jun 9, 2026',
      body: `Tinutukoy ng mga antas ng kredito kung magkano ang puwede mong hiramin at a time.

Lahat nagsisimula sa Level 1 na may $15 limit. Habang humihiram ka at fully nagbabayad, lumalaki ang limit mo — $15 → $20 → $40 → $60 → $80 → $100 → $120 → $140 — at nag-a-unlock ng bagong levels.

Umakyat ka lang kapag nakumpleto mo ang Credit Growth Loan: loan sa buong current limit mo, fully repaid at on time.`
   },
   'trust-building-vs-credit-building-loans': {
      title: 'Trust-building vs credit-building loans',
      lastUpdated: 'Jun 9, 2026',
      body: `May dalawang uri ng loans ang Moodeng Credit:

Ang Trust-building loans ay mas maliit na loans below sa current limit mo. Tinutulungan ka nitong ipakita na reliable kang magbayad, pero hindi nito tinataas ang limit mo.

Ang Credit-building loans ay full-limit loans. Kapag nabayaran mo ito on time, tataas ang limit mo at maa-unlock ang susunod na antas ng kredito.

Karamihan ng borrowers ay gumagamit ng pareho: trust loans para manatiling healthy ang activity, at credit loans para palakihin ang limit over time.`
   },
   'how-repayments-affect-your-trust-score': {
      title: 'Paano naaapektuhan ng repayments ang Pandesal points mo',
      lastUpdated: 'Jun 9, 2026',
      body: `Bawat repayment para sa Credit-building o Trust-building loans ay direktang nakakaapekto sa Pandesal points mo, na nagsisilbing reputation mo sa platform. Dinisenyo ang system namin para i-reward ang consistent, reliable, at honest behavior; mas mahalaga sa reputation mo ang maliit na loans na malinis ang repayment kaysa malaking loans na magulo ang repayment.

Scoring breakdown

- On-time, full repayments: Kapag nakumpleto ang 100% repayment on or before the due date, maximized ang points mo (10 points).

- Partial repayments: Kapag hindi nabayaran ang buong amount, nababawasan ang points mo proportionally — 75% = 7 points · 50% = 5 points · 25% = 3 points.

- Late repayments: Anumang payment na natanggap pagkatapos ng agreed deadline ay nagreresulta sa 0 points para sa transaction na iyon.

- Defaults: Ang unpaid loans ay nag-iiwan ng permanent mark sa profile mo na makikita ng lahat ng future lenders.`
   },
   'what-happens-when-you-repay-a-loan-on-time': {
      title: 'Mga benepisyo ng on-time repayments',
      lastUpdated: 'Jun 9, 2026',
      body: `Ang pag-submit ng repayment on or before the scheduled deadline ang pinaka-effective na paraan para palakasin ang standing mo sa Moodeng Credit ecosystem. Lahat ng repayments ay confirmed on-chain; kapag settled na ang USDC transfer, automatic na maa-update ang loan status mo sa "Successfully Repaid."

Kapag nagbayad ka on time, maa-apply sa profile mo ang mga benepisyong ito:

- Mas maraming Pandesal points: Tumataas ang Pandesal points mo para sa Credit-building o Trust-building loans, na nagpapakita ng reliability mo sa community.
- Credit limit progression: Para sa Credit-building loans, tataas ang current borrowing limit mo at maa-unlock ang next credit level, halimbawa mula $15 papuntang $20.
- Verified lending history: Makikita ng potential lenders ang successful repayment history mo, kaya mas madali nilang ma-review ang future requests mo.

Repayment scoring breakdown

Ipinapakita ng Pandesal points mo ang reliability mo at tumutulong sa future funding success mo:

- On-time, full repayment: Nagbibigay ng maximum 10 points.
- Partial repayment: Nababawasan ang points mo proportionally base sa amount na nabayaran, halimbawa 75% = 7 points; 50% = 5 points.
- Late repayment: Anumang payment pagkatapos ng deadline ay nagreresulta sa 0 points, kahit magkano ang amount.
- Default: Ang unpaid loans ay nagreresulta sa permanent mark sa public on-chain profile mo.`
   },
   'using-usdc-on-moodeng-credit': {
      title: 'Paggamit ng USDC sa Moodeng Credit',
      lastUpdated: 'Jun 9, 2026',
      body: `Lahat ng loans sa Moodeng Credit ay denominated sa USDC — regulated stablecoin na naka-peg 1:1 sa US dollar.

Kapag USDC ang gamit, consistent ang loan values. Ang $20 loan ngayon ay $20 pa rin kapag binayaran mo ito, kahit gumalaw ang crypto market.

Tumatakbo sa Base ang Instant Wallet mo (o Base Account, kung iyon ang gusto mo), kung saan gasless ang USDC transfers — wala kang babayarang network fees.`
   },
   'verification-and-why-its-required': {
      title: 'Verification at security',
      lastUpdated: 'Jun 9, 2026',
      body: `Para mapanatiling secure at fair ang environment, kailangan ng Moodeng Credit na i-verify ng lahat ng borrowers ang unique human identity nila gamit ang World ID. Pinoprotektahan ng process na ito ang community mula sa automated bots at duplicate accounts nang hindi ka pinapa-upload ng sensitive personal documents.

Bakit kailangan mag-verify?
- Security: Tinitiyak na galing sa totoong tao ang bawat request at nakakatulong maiwasan ang fraud.

- Rewards: Puwedeng mag-claim ang new users ng humigit-kumulang $10 sa Worldcoin rewards pagkatapos ng successful verification.

- Access: Kapag complete ang verification, puwede ka nang mag-request ng loans at magsimulang bumuo ng Pandesal points.

Step-by-step guide
1. I-download ang World App
I-install ang official app gamit ang Apple App Store o Google Play Store.

2. Humanap ng Orb
Sa loob ng World App, pumunta sa Settings, piliin ang "Find an Orb," at i-enable ang "Allow Location" para mahanap ang pinakamalapit na verification center sa iyo .

3. Kumpletuhin ang in-person verification
Pumunta sa napili mong Orb location at sundin ang on-screen instructions sa app para makumpleto ang one-time verification process.

4. Kumonek sa Moodeng
Kapag verified ka na, bumalik sa Moodeng platform. Pumunta sa "Verification," at piliin ang "Connect World ID" para i-link ang account mo at i-finalize ang eligibility mo .`
   },
   'managing-your-account-and-security-settings': {
      title: 'Pag-manage ng account at security settings mo',
      lastUpdated: 'Jun 9, 2026',
      body: `Naka-tie ang account mo sa wallet mo, kaya wallet security ang account security.

Mula sa Account screen, puwede mong i-update ang display name mo, i-manage ang email mo, palitan ang password mo, at mag-sign out.`
   }
};

const INDONESIAN_GUIDES: Record<string, LocalizedGuideArticle> = {
   'how-to-request-your-first-loan': {
      title: 'Cara mengajukan pinjaman pertama',
      lastUpdated: '9 Juni 2026',
      body: `Ikuti langkah-langkah praktis ini untuk membuat permintaan pinjaman pertama kamu di Moodeng Credit. Kamu juga bisa menonton video panduan prosesnya di sini: https://youtube.com/shorts/fKpBC9zD6Hk?si=KoU6NRuIguzLw-Hh.

Langkah 1: Buat akun
Daftar di platform Moodeng dengan memasukkan nama pengguna, email, dan kata sandi pilihan kamu. Klik "Buat akun" untuk melanjutkan.

Langkah 2: Mulai pengajuan pinjaman
Setelah masuk, ketuk tombol "Ajukan pinjaman" untuk memulai prosesnya.

Langkah 3: Siapkan dompet
Transaksi yang aman di Moodeng membutuhkan dompet. Secara default, kamu memakai Instant Wallet Moodeng. Dompet ini dibuat dari login Moodeng kamu, tanpa aplikasi terpisah dan tanpa seed phrase. Jika lebih suka, kamu bisa memakai Base Account: kunjungi https://account.base.app dan ikuti petunjuk pendaftarannya.

Langkah 4: Hubungkan dompet
Kembali ke platform Moodeng dan ketuk "Hubungkan dompet" untuk membuat Instant Wallet kamu, atau untuk menautkan Base Account kamu dengan aman jika kamu memilihnya, agar terhubung ke akun Moodeng kamu.

Langkah 5: Verifikasi identitas
Demi keamanan komunitas, ketuk "Verifikasi Diri" lalu selesaikan pemeriksaan singkat foto ID + selfie ("Verifikasi ID Kamu"). Prosesnya sekitar 3 menit. Sudah memakai World App? Kamu bisa memilih "Verifikasi dengan World ID" sebagai gantinya.

Langkah 6: Kirim permintaan
Ketuk "Jelajahi Papan Permintaan" untuk menentukan syarat pinjaman kamu. Kamu perlu menentukan:
- Jumlah pinjaman yang kamu inginkan.
- Jumlah dan tanggal pembayaran kembali.
- Alasan meminjam yang jelas, untuk membantu membangun kepercayaan dengan calon pemberi pinjaman.`
   },
   'understanding-your-trust-score': {
      title: 'Memahami poin Pandesal kamu',
      lastUpdated: '9 Juni 2026',
      body: `Poin Pandesal kamu menunjukkan seberapa andal kamu membayar kembali pinjaman di Moodeng Credit.

Poin ini naik setiap kali kamu membayar tepat waktu dan turun saat kamu terlambat atau gagal bayar. Pemberi pinjaman memakai poin ini sebagai sinyal cepat untuk memutuskan apakah akan mendanai permintaan kamu.

Karena poin Pandesal tertaut ke dompet kamu, poin ini ikut ke mana pun kamu pergi. Poin ini tidak terkunci di satu aplikasi saja.`
   },
   'how-credit-levels-work': {
      title: 'Cara kerja Level Kredit',
      lastUpdated: '9 Juni 2026',
      body: `Level Kredit menentukan berapa banyak yang bisa kamu pinjam dalam satu waktu.

Semua orang mulai di Level 1 dengan limit $15. Saat kamu meminjam dan melunasi pinjaman, limit kamu bertambah, $15 → $20 → $40 → $60 → $80 → $100 → $120 → $140, dan level baru pun terbuka.

Kamu hanya bisa naik level dengan menyelesaikan Credit-Building Loan: pinjaman sebesar limit penuh kamu saat ini, yang dibayar kembali secara penuh dan tepat waktu.`
   },
   'trust-building-vs-credit-building-loans': {
      title: 'Trust-Building Loan vs Credit-Building Loan',
      lastUpdated: '9 Juni 2026',
      body: `Moodeng Credit mendukung dua jenis pinjaman:

Trust-Building Loan adalah pinjaman yang lebih kecil, di bawah limit kamu saat ini. Pinjaman ini membantu kamu menunjukkan bahwa kamu membayar kembali dengan andal, tetapi tidak menaikkan limit kamu.

Credit-Building Loan adalah pinjaman sebesar limit penuh. Melunasinya tepat waktu akan menaikkan limit kamu dan membuka Level Kredit berikutnya.

Sebagian besar peminjam memakai keduanya: Trust-Building Loan untuk menjaga aktivitas tetap sehat, dan Credit-Building Loan untuk menaikkan limit dari waktu ke waktu.`
   },
   'how-repayments-affect-your-trust-score': {
      title: 'Bagaimana pembayaran kembali memengaruhi poin Pandesal kamu',
      lastUpdated: '9 Juni 2026',
      body: `Setiap pembayaran kembali, baik untuk Credit-Building Loan maupun Trust-Building Loan, langsung memengaruhi poin Pandesal kamu, yang menjadi reputasi kamu di platform. Sistem kami dirancang untuk menghargai perilaku yang konsisten, andal, dan jujur. Pinjaman kecil yang dilunasi dengan rapi lebih berharga bagi reputasi kamu daripada pinjaman besar yang dibayar asal-asalan.

Rincian poin

- Pembayaran penuh tepat waktu: Melunasi 100% pada atau sebelum jatuh tempo memberi poin maksimum (10 poin).

- Pembayaran sebagian: Jika kamu tidak membayar jumlah penuh, poin kamu berkurang secara proporsional: 75% = 7 poin · 50% = 5 poin · 25% = 3 poin.

- Pembayaran terlambat: Pembayaran apa pun yang diterima setelah batas waktu yang disepakati mendapat 0 poin untuk transaksi itu.

- Gagal bayar: Pinjaman yang tidak dibayar meninggalkan tanda permanen di profil kamu, yang terlihat oleh semua pemberi pinjaman berikutnya.`
   },
   'what-happens-when-you-repay-a-loan-on-time': {
      title: 'Manfaat membayar kembali tepat waktu',
      lastUpdated: '9 Juni 2026',
      body: `Membayar kembali pada atau sebelum jatuh tempo adalah cara paling efektif untuk memperkuat posisi kamu di ekosistem Moodeng Credit. Semua pembayaran kembali dikonfirmasi secara on-chain. Setelah transfer USDC selesai, status pinjaman kamu otomatis berubah menjadi "Lunas".

Saat kamu membayar kembali tepat waktu, manfaat berikut diterapkan ke profil kamu:

- Poin Pandesal bertambah: Poin Pandesal kamu naik, baik untuk Credit-Building Loan maupun Trust-Building Loan, sebagai cerminan keandalan kamu di mata komunitas.
- Kenaikan limit kredit: Untuk Credit-Building Loan, limit pinjaman kamu saat ini naik dan Level Kredit berikutnya terbuka (misalnya, naik dari $15 → $20).
- Riwayat pinjaman terverifikasi: Riwayat pembayaran kembali kamu yang berhasil terlihat oleh calon pemberi pinjaman, sehingga permintaan kamu berikutnya jauh lebih mudah didanai.

Rincian poin pembayaran kembali

Poin Pandesal mencerminkan keandalan kamu dan menentukan peluang kamu mendapat pendanaan di masa depan:

- Pembayaran penuh tepat waktu: Mendapat poin maksimum, yaitu 10 poin.
- Pembayaran sebagian: Poin kamu berkurang secara proporsional sesuai jumlah yang dibayar (misalnya, 75% = 7 poin; 50% = 5 poin).
- Pembayaran terlambat: Pembayaran apa pun setelah batas waktu mendapat 0 poin, berapa pun jumlahnya.
- Gagal bayar: Pinjaman yang tidak dibayar meninggalkan tanda permanen di profil on-chain publik kamu.`
   },
   'repaying-your-loan': {
      title: 'Cara membayar kembali pinjaman kamu',
      lastUpdated: '3 Juli 2026',
      body: `Untuk membayar kembali, kirim jumlah USDC yang diminta ke alamat pembayaran yang ditampilkan di Moodeng (layar Bayar menampilkan jumlah persisnya dan memungkinkan kamu menyalin alamatnya). Kamu bisa mengirim dari dompet, exchange, platform P2P, atau layanan kripto lokal, mana pun yang tersedia di negaramu.

Mengirim dari dompet
Jika kamu sudah menyimpan USDC di dompet mana pun, kirim jumlah pembayaran ke alamat yang ditampilkan di Moodeng. Pastikan jaringannya Base.

Mengirim dari exchange
Tarik USDC dari akun exchange kamu langsung ke alamat pembayaran. Pilih USDC, lalu pilih Base sebagai jaringannya.

Beli USDC dulu, lalu bayar kembali
Jika kamu belum punya USDC, beli dulu dan kirim ke dompet kamu, lalu bayar kembali dari sana:
- Binance P2P: beli USDC dengan mata uang lokal dari pengguna lain, lalu tarik di jaringan Base.
- Exchange atau aplikasi lain yang mendukung USDC di jaringan Base: beli USDC dengan mata uang lokal, lalu tarik ke dompet kamu di jaringan Base. Pastikan dulu layanan tersebut mendukung jaringan Base sebelum mengirim.

Yang paling penting: selalu pilih Base sebagai jaringan saat mengirim USDC. Jaringan yang salah bisa membuat dana kamu hilang.`
   },
   'adding-funds-to-your-wallet': {
      title: 'Cara menambahkan USDC ke dompet kamu',
      lastUpdated: '3 Juli 2026',
      body: `Dompet Moodeng kamu bekerja dengan USDC di jaringan Base. Selain opsi di dalam aplikasi (beli dengan kartu dan bridge dari jaringan lain), berikut cara umum untuk memasukkan USDC ke dompet kamu:

Beli di exchange
Beli USDC di exchange yang sudah kamu pakai, lalu tarik ke alamat dompet kamu. Saat menarik, selalu pilih USDC dan jaringan Base.

Binance P2P
Beli USDC dengan mata uang lokal langsung dari pengguna lain, lalu tarik di jaringan Base.

Layanan lokal
Kamu juga bisa memakai exchange atau aplikasi lain yang mendukung USDC di jaringan Base: beli USDC dengan mata uang lokal, lalu tarik ke dompet kamu di jaringan Base. Pastikan dulu layanan tersebut mendukung jaringan Base sebelum mengirim.

Kirim dari dompet lain
Jika kamu menyimpan USDC di tempat lain, kirim ke alamat dompet Moodeng kamu, di jaringan Base.

Yang paling penting: selalu pilih Base sebagai jaringan. Mengirim di jaringan yang salah bisa membuat dana kamu hilang.`
   },
   'withdrawing-to-your-bank': {
      title: 'Cara menarik dana ke rekening bank',
      lastUpdated: '3 Juli 2026',
      body: `Kamu bisa menarik dana dengan mengirim USDC ke exchange atau layanan yang didukung, menjualnya di sana, lalu mentransfer mata uang lokal ke rekening bank kamu.

Video panduan, cara mengirim USDC dari Base Account ke Binance: https://www.youtube.com/watch?v=Bqc2u3utbwc

Pilihan yang umum:

Binance P2P
Kirim USDC ke akun Binance kamu (selalu pilih jaringan Base), lalu jual lewat Binance P2P dan terima mata uang lokal langsung ke rekening bank atau dompet digital kamu.

Exchange atau aplikasi lokal
Kamu juga bisa memakai exchange atau aplikasi yang mendukung USDC di jaringan Base: setor USDC, jual ke mata uang lokal, lalu tarik ke rekening bank kamu. Pastikan dulu layanan tersebut mendukung jaringan Base sebelum mengirim.

Dompet atau exchange lain
Kamu selalu bisa mengirim USDC ke dompet atau exchange mana pun yang sudah kamu pakai. Pastikan saja layanan itu mendukung USDC di jaringan Base sebelum mengirim.

Yang paling penting: selalu pilih Base sebagai jaringan saat menyetor ke exchange. Jaringan yang salah bisa membuat dana kamu hilang.`
   },
   'using-usdc-on-moodeng-credit': {
      title: 'Menggunakan USDC di Moodeng Credit',
      lastUpdated: '9 Juni 2026',
      body: `Semua pinjaman di Moodeng Credit dinyatakan dalam USDC, stablecoin teregulasi yang dipatok 1:1 ke dolar AS.

Dengan USDC, nilai pinjaman tetap stabil. Pinjaman $20 hari ini tetap pinjaman $20 saat kamu membayarnya kembali, apa pun pergerakan pasar kripto.

Instant Wallet kamu (atau Base Account, jika kamu lebih suka) berjalan di Base, tempat transfer USDC bebas biaya gas, jadi kamu tidak membayar biaya jaringan.`
   },
   'verification-and-why-its-required': {
      title: 'Verifikasi dan keamanan',
      lastUpdated: '9 Juni 2026',
      body: `Agar Moodeng tetap aman dan adil, semua peminjam menyelesaikan verifikasi identitas singkat yang cukup dilakukan sekali. Verifikasi ini melindungi komunitas dari akun palsu dan akun ganda, dan inilah yang membuat pemberi pinjaman bisa memercayai permintaan yang mereka danai.

Mengapa perlu verifikasi?
- Keamanan: memastikan setiap permintaan berasal dari orang sungguhan yang unik, sehingga mencegah penipuan.
- Akses: setelah verifikasi selesai, kamu bisa mengajukan pinjaman dan mulai mengumpulkan poin Pandesal.

Cara yang disarankan: Verifikasi ID Kamu
1. Ketuk "Verifikasi Diri" di aplikasi, lalu pilih "Verifikasi ID Kamu".
2. Siapkan KTP atau kartu identitas nasional fisik kamu, dan cari tempat dengan pencahayaan yang terang dan merata.
3. Selesaikan pemeriksaan singkat foto ID + selfie. Prosesnya sekitar 3 menit.
4. Sebagian besar pemeriksaan selesai dalam hitungan menit. Jika punyamu perlu ditinjau oleh petugas, kami akan memberi tahu kamu begitu selesai (biasanya dalam beberapa jam, paling lama 1 hari kerja).

ID kamu diperiksa oleh mitra verifikasi kami yang aman dan tidak pernah disimpan oleh Moodeng.

Alternatif: Verifikasi dengan World ID
Jika kamu sudah memakai World App (terverifikasi langsung di Orb atau dengan paspor biometrik), kamu bisa memilih "Verifikasi dengan World ID" sebagai gantinya dan mengonfirmasinya lewat World App.`
   },
   'managing-your-account-and-security-settings': {
      title: 'Mengelola akun dan pengaturan keamanan',
      lastUpdated: '9 Juni 2026',
      body: `Akun kamu tertaut ke dompet kamu, jadi keamanan dompet adalah keamanan akun.

Dari layar Akun, kamu bisa memperbarui nama tampilan, mengelola email, mengganti kata sandi, dan keluar.`
   }
};

const THAI_GUIDES: Record<string, LocalizedGuideArticle> = {
   'how-to-request-your-first-loan': {
      title: 'วิธีขอเงินกู้ครั้งแรก',
      lastUpdated: '9 มิ.ย. 2026',
      body: `ทำตามขั้นตอนง่าย ๆ ต่อไปนี้เพื่อเริ่มส่งคำขอเงินกู้ครั้งแรกบน Moodeng Credit คุณยังดูวิดีโอสาธิตขั้นตอนทั้งหมดได้ที่นี่: https://youtube.com/shorts/fKpBC9zD6Hk?si=KoU6NRuIguzLw-Hh

ขั้นตอนที่ 1: สร้างบัญชี
สมัครสมาชิกบนแพลตฟอร์ม Moodeng โดยกรอกชื่อผู้ใช้ อีเมล และรหัสผ่านที่ต้องการ แล้วแตะ "สร้างบัญชี" เพื่อดำเนินการต่อ

ขั้นตอนที่ 2: เริ่มยื่นขอเงินกู้
หลังเข้าสู่ระบบ แตะปุ่ม "ขอเงินกู้" เพื่อเริ่มขั้นตอน

ขั้นตอนที่ 3: ตั้งค่ากระเป๋าเงิน
ธุรกรรมที่ปลอดภัยบน Moodeng ต้องใช้กระเป๋าเงิน โดยค่าเริ่มต้นคุณจะใช้ Instant Wallet ของ Moodeng ซึ่งสร้างจากการเข้าสู่ระบบ Moodeng ของคุณ ไม่ต้องใช้แอปแยกและไม่ต้องมี seed phrase หากต้องการ คุณใช้ Base Account แทนได้ โดยไปที่ https://account.base.app แล้วทำตามขั้นตอนการลงทะเบียน

ขั้นตอนที่ 4: เชื่อมต่อกระเป๋าเงิน
กลับมาที่แพลตฟอร์ม Moodeng แล้วแตะ "เชื่อมต่อกระเป๋าเงิน" เพื่อสร้าง Instant Wallet หรือเชื่อมต่อ Base Account อย่างปลอดภัยหากคุณเลือกใช้ เพื่อให้กระเป๋าเงินผูกกับบัญชี Moodeng ของคุณ

ขั้นตอนที่ 5: ยืนยันตัวตน
เพื่อความปลอดภัยของชุมชน แตะ "ยืนยันตัวตน" แล้วทำการตรวจสอบบัตรประชาชนและเซลฟี่ ("ยืนยันด้วยบัตรประชาชน") ซึ่งใช้เวลาประมาณ 3 นาที หากคุณใช้ World App อยู่แล้ว สามารถเลือก "ยืนยันด้วย World ID" แทนได้

ขั้นตอนที่ 6: ส่งคำขอ
แตะ "สำรวจกระดานคำขอ" เพื่อกำหนดเงื่อนไขเงินกู้ของคุณ โดยต้องระบุ:
- จำนวนเงินกู้ที่ต้องการ
- ยอดที่ต้องชำระคืนและวันชำระคืน
- เหตุผลในการยืมที่ชัดเจน เพื่อช่วยสร้างความน่าเชื่อถือกับผู้ให้กู้ที่อาจสนใจ`
   },
   'understanding-your-trust-score': {
      title: 'ทำความเข้าใจแต้ม Pandesal ของคุณ',
      lastUpdated: '9 มิ.ย. 2026',
      body: `แต้ม Pandesal สะท้อนว่าคุณชำระคืนเงินกู้บน Moodeng Credit ได้สม่ำเสมอเพียงใด

แต้มจะเพิ่มขึ้นทุกครั้งที่คุณชำระคืนตรงเวลา และลดลงเมื่อคุณพลาดการชำระหรือผิดนัดชำระ ผู้ให้กู้ใช้แต้มนี้เป็นตัวชี้วัดเบื้องต้นในการตัดสินใจว่าจะปล่อยกู้ตามคำขอของคุณหรือไม่

เนื่องจากแต้ม Pandesal ผูกกับกระเป๋าเงินของคุณ แต้มจึงติดตัวคุณไปได้ทุกที่ ไม่ได้ถูกจำกัดไว้ในแอปใดแอปหนึ่ง`
   },
   'how-credit-levels-work': {
      title: 'ระดับเครดิตทำงานอย่างไร',
      lastUpdated: '9 มิ.ย. 2026',
      body: `ระดับเครดิตกำหนดว่าคุณยืมได้มากเท่าใดในแต่ละครั้ง

ทุกคนเริ่มที่ระดับ 1 ด้วยวงเงิน $15 เมื่อคุณยืมและชำระคืนครบถ้วน วงเงินของคุณจะเพิ่มขึ้น: $15 → $20 → $40 → $60 → $80 → $100 → $120 → $140 และปลดล็อกระดับใหม่

คุณจะเลื่อนระดับได้ด้วยการทำ Credit-Building Loan ให้สำเร็จเท่านั้น นั่นคือเงินกู้เต็มวงเงินปัจจุบันที่ชำระคืนครบเต็มจำนวนและตรงเวลา`
   },
   'trust-building-vs-credit-building-loans': {
      title: 'Trust-Building Loan กับ Credit-Building Loan',
      lastUpdated: '9 มิ.ย. 2026',
      body: `Moodeng Credit มีเงินกู้สองประเภท:

Trust-Building Loan คือเงินกู้ขนาดเล็กที่ต่ำกว่าวงเงินปัจจุบันของคุณ ช่วยแสดงให้เห็นว่าคุณชำระคืนได้อย่างน่าเชื่อถือ แต่ไม่ได้เพิ่มวงเงิน

Credit-Building Loan คือเงินกู้เต็มวงเงิน เมื่อชำระคืนตรงเวลา วงเงินของคุณจะเพิ่มขึ้นและปลดล็อกระดับเครดิตถัดไป

ผู้ยืมส่วนใหญ่ใช้ทั้งสองแบบ: ใช้ Trust-Building Loan เพื่อรักษาความต่อเนื่องของประวัติการชำระคืน และใช้ Credit-Building Loan เพื่อเพิ่มวงเงินไปเรื่อย ๆ`
   },
   'how-repayments-affect-your-trust-score': {
      title: 'การชำระคืนส่งผลต่อแต้ม Pandesal อย่างไร',
      lastUpdated: '9 มิ.ย. 2026',
      body: `การชำระคืนทุกครั้ง ไม่ว่าจะเป็น Credit-Building Loan หรือ Trust-Building Loan ส่งผลโดยตรงต่อแต้ม Pandesal ซึ่งเป็นตัวแทนความน่าเชื่อถือของคุณบนแพลตฟอร์ม ระบบของเราออกแบบมาเพื่อให้รางวัลกับพฤติกรรมที่สม่ำเสมอ น่าเชื่อถือ และซื่อสัตย์ เงินกู้ขนาดเล็กที่ชำระคืนอย่างเรียบร้อยมีคุณค่าต่อความน่าเชื่อถือของคุณมากกว่าเงินกู้ก้อนใหญ่ที่ชำระคืนอย่างไม่เรียบร้อย

การคิดแต้ม

- ชำระคืนเต็มจำนวนตรงเวลา: การชำระคืนครบ 100% ภายในวันครบกำหนดจะได้แต้มสูงสุด (10 แต้ม)

- ชำระคืนบางส่วน: หากชำระไม่ครบจำนวน แต้มจะลดลงตามสัดส่วน: 75% = 7 แต้ม · 50% = 5 แต้ม · 25% = 3 แต้ม

- ชำระคืนล่าช้า: การชำระใด ๆ ที่ได้รับหลังกำหนดที่ตกลงกันไว้ จะได้ 0 แต้มสำหรับธุรกรรมนั้น

- ผิดนัดชำระ: เงินกู้ที่ไม่ได้ชำระจะทิ้งประวัติผิดนัดชำระถาวรไว้บนโปรไฟล์ของคุณ ซึ่งผู้ให้กู้ทุกคนในอนาคตจะมองเห็นได้`
   },
   'what-happens-when-you-repay-a-loan-on-time': {
      title: 'ประโยชน์ของการชำระคืนตรงเวลา',
      lastUpdated: '9 มิ.ย. 2026',
      body: `การชำระคืนภายในกำหนดเวลาเป็นวิธีที่ได้ผลที่สุดในการเสริมสถานะของคุณในระบบของ Moodeng Credit การชำระคืนทั้งหมดได้รับการยืนยันแบบออนเชน เมื่อการโอน USDC เสร็จสมบูรณ์ สถานะเงินกู้ของคุณจะอัปเดตเป็น "ชำระคืนสำเร็จ" โดยอัตโนมัติ

เมื่อคุณชำระคืนตรงเวลา โปรไฟล์ของคุณจะได้รับประโยชน์ดังนี้:

- แต้ม Pandesal เพิ่มขึ้น: แต้ม Pandesal ของคุณจะเพิ่มขึ้นทั้งจาก Credit-Building Loan และ Trust-Building Loan สะท้อนความน่าเชื่อถือของคุณต่อชุมชน
- วงเงินเพิ่มขึ้น: สำหรับ Credit-Building Loan วงเงินกู้ปัจจุบันของคุณจะเพิ่มขึ้นและปลดล็อกระดับเครดิตถัดไป (เช่น จาก $15 → $20)
- ประวัติการกู้ยืมที่ตรวจสอบได้: ประวัติการชำระคืนที่ดีของคุณจะแสดงให้ผู้ให้กู้ที่สนใจเห็น ช่วยให้คำขอครั้งต่อไปได้รับการปล่อยกู้ง่ายขึ้นมาก

การคิดแต้มจากการชำระคืน

แต้ม Pandesal สะท้อนความน่าเชื่อถือของคุณ และมีผลต่อโอกาสได้รับการปล่อยกู้ในอนาคต:

- ชำระคืนเต็มจำนวนตรงเวลา: ได้แต้มสูงสุด 10 แต้ม
- ชำระคืนบางส่วน: แต้มจะลดลงตามสัดส่วนของยอดที่ชำระ (เช่น 75% = 7 แต้ม; 50% = 5 แต้ม)
- ชำระคืนล่าช้า: การชำระหลังกำหนดจะได้ 0 แต้ม ไม่ว่าจะชำระเป็นจำนวนเท่าใด
- ผิดนัดชำระ: เงินกู้ที่ไม่ได้ชำระจะทิ้งประวัติผิดนัดชำระถาวรไว้บนโปรไฟล์ออนเชนสาธารณะของคุณ`
   },
   'repaying-your-loan': {
      title: 'วิธีชำระคืนเงินกู้',
      lastUpdated: '3 ก.ค. 2026',
      body: `หากต้องการชำระคืน ให้ส่ง USDC ตามยอดที่ต้องชำระไปยังที่อยู่สำหรับชำระคืนที่แสดงใน Moodeng (หน้า "ชำระคืน" จะแสดงยอดที่แน่นอนและให้คุณคัดลอกที่อยู่ได้) คุณส่งได้จากกระเป๋าเงิน แพลตฟอร์มแลกเปลี่ยนคริปโต แพลตฟอร์ม P2P หรือบริการคริปโตในประเทศ แล้วแต่ว่าในประเทศของคุณมีช่องทางใดบ้าง

ส่งจากกระเป๋าเงิน
หากคุณมี USDC อยู่ในกระเป๋าเงินใดอยู่แล้ว ให้ส่งยอดที่ต้องชำระคืนไปยังที่อยู่ที่แสดงใน Moodeng และตรวจสอบให้แน่ใจว่าเลือกเครือข่าย Base

ส่งจากแพลตฟอร์มแลกเปลี่ยนคริปโต
ถอน USDC จากบัญชีแพลตฟอร์มแลกเปลี่ยนของคุณไปยังที่อยู่สำหรับชำระคืนโดยตรง โดยเลือก USDC และเลือกเครือข่าย Base

ซื้อ USDC ก่อน แล้วจึงชำระคืน
หากคุณยังไม่มี USDC ให้ซื้อก่อนแล้วส่งเข้ากระเป๋าเงินของคุณ จากนั้นจึงชำระคืนจากกระเป๋าเงินนั้น:
- Binance P2P: ซื้อ USDC ด้วยเงินสกุลท้องถิ่นจากผู้ใช้คนอื่น แล้วถอนผ่านเครือข่าย Base
- แพลตฟอร์มแลกเปลี่ยนคริปโตหรือแอปที่รองรับ USDC บนเครือข่าย Base: ซื้อ USDC ด้วยเงินสกุลท้องถิ่น แล้วถอนไปยังกระเป๋าเงินของคุณบนเครือข่าย Base โดยตรวจสอบก่อนทุกครั้งว่าแพลตฟอร์มนั้นรองรับการถอน USDC บนเครือข่าย Base

ข้อสำคัญ: เลือกเครือข่าย Base ทุกครั้งเมื่อส่ง USDC หากเลือกเครือข่ายผิด เงินอาจสูญหายได้`
   },
   'adding-funds-to-your-wallet': {
      title: 'วิธีเติม USDC เข้ากระเป๋าเงิน',
      lastUpdated: '3 ก.ค. 2026',
      body: `กระเป๋าเงิน Moodeng ของคุณใช้งานกับ USDC บนเครือข่าย Base นอกจากตัวเลือกในแอป (ซื้อด้วยบัตรและบริดจ์จากเชนอื่น) ยังมีวิธีทั่วไปในการนำ USDC เข้ากระเป๋าเงินของคุณดังนี้

ซื้อบนแพลตฟอร์มแลกเปลี่ยนคริปโต
ซื้อ USDC บนแพลตฟอร์มแลกเปลี่ยนคริปโตหรือแอปที่คุณใช้อยู่แล้ว แล้วถอนไปยังที่อยู่กระเป๋าเงินของคุณ ตรวจสอบก่อนว่าแพลตฟอร์มนั้นรองรับ USDC บนเครือข่าย Base และเลือก USDC กับเครือข่าย Base ทุกครั้งเมื่อถอน

Binance P2P
ซื้อ USDC ด้วยเงินสกุลท้องถิ่นจากผู้ใช้คนอื่นโดยตรง แล้วถอนผ่านเครือข่าย Base

ส่งจากกระเป๋าเงินอื่น
หากคุณมี USDC อยู่ที่อื่น ให้ส่งไปยังที่อยู่กระเป๋าเงิน Moodeng ของคุณผ่านเครือข่าย Base

ข้อสำคัญ: เลือกเครือข่าย Base ทุกครั้ง หากส่งผ่านเครือข่ายผิด เงินอาจสูญหายได้`
   },
   'withdrawing-to-your-bank': {
      title: 'การถอนเงินเข้าบัญชีธนาคาร',
      lastUpdated: '3 ก.ค. 2026',
      body: `คุณถอนเงินได้โดยส่ง USDC ไปยังแพลตฟอร์มแลกเปลี่ยนคริปโตหรือบริการที่รองรับ ขาย USDC ที่นั่น แล้วโอนเงินสกุลท้องถิ่นเข้าบัญชีธนาคารของคุณ

วิดีโอสาธิตการส่ง USDC จาก Base Account ไปยัง Binance: https://www.youtube.com/watch?v=Bqc2u3utbwc

ตัวเลือกที่ใช้กันทั่วไป:

Binance P2P
ส่ง USDC เข้าบัญชี Binance ของคุณ (เลือกเครือข่าย Base ทุกครั้ง) แล้วขายผ่าน Binance P2P และรับเงินสกุลท้องถิ่นเข้าบัญชีธนาคารหรือ e-wallet ของคุณโดยตรง

แพลตฟอร์มแลกเปลี่ยนคริปโตหรือแอปอื่น
ใช้แพลตฟอร์มแลกเปลี่ยนคริปโตหรือแอปที่รองรับ USDC บนเครือข่าย Base โดยฝาก USDC ขายเป็นเงินสกุลท้องถิ่น แล้วถอนเข้าบัญชีธนาคารของคุณ ตรวจสอบก่อนส่งทุกครั้งว่าแพลตฟอร์มนั้นรองรับการฝาก USDC บนเครือข่าย Base

กระเป๋าเงินหรือแพลตฟอร์มแลกเปลี่ยนอื่น
คุณส่ง USDC ไปยังกระเป๋าเงินหรือแพลตฟอร์มแลกเปลี่ยนใดก็ได้ที่คุณใช้อยู่แล้ว เพียงตรวจสอบให้แน่ใจว่ารองรับ USDC บนเครือข่าย Base ก่อนส่ง

ข้อสำคัญ: เลือกเครือข่าย Base ทุกครั้งเมื่อฝากเข้าแพลตฟอร์มแลกเปลี่ยน หากเลือกเครือข่ายผิด เงินอาจสูญหายได้`
   },
   'using-usdc-on-moodeng-credit': {
      title: 'การใช้ USDC บน Moodeng Credit',
      lastUpdated: '9 มิ.ย. 2026',
      body: `เงินกู้ทั้งหมดบน Moodeng Credit คิดเป็น USDC ซึ่งเป็น stablecoin ที่อยู่ภายใต้การกำกับดูแลและตรึงมูลค่า 1:1 กับดอลลาร์สหรัฐ

การใช้ USDC ทำให้มูลค่าเงินกู้คงที่ เงินกู้ $20 ในวันนี้ก็ยังเป็นเงินกู้ $20 เมื่อคุณชำระคืน ไม่ว่าตลาดคริปโตจะเคลื่อนไหวอย่างไร

Instant Wallet ของคุณ (หรือ Base Account หากคุณเลือกใช้) ทำงานบน Base ซึ่งการโอน USDC ไม่มีค่า gas คุณจึงไม่ต้องจ่ายค่าธรรมเนียมเครือข่าย`
   },
   'verification-and-why-its-required': {
      title: 'การยืนยันตัวตนและความปลอดภัย',
      lastUpdated: '9 มิ.ย. 2026',
      body: `เพื่อให้ Moodeng ปลอดภัยและเป็นธรรม ผู้ยืมทุกคนต้องยืนยันตัวตนสั้น ๆ เพียงครั้งเดียว ขั้นตอนนี้ช่วยปกป้องชุมชนจากบัญชีปลอมและบัญชีซ้ำ และทำให้ผู้ให้กู้มั่นใจในคำขอที่ตนปล่อยกู้

ทำไมต้องยืนยันตัวตน?
- ความปลอดภัย: ทำให้มั่นใจว่าทุกคำขอมาจากบุคคลจริงที่ไม่ซ้ำกัน และช่วยป้องกันการฉ้อโกง
- การเข้าถึง: เมื่อยืนยันตัวตนเสร็จ คุณจะส่งคำขอเงินกู้ได้และเริ่มสะสมแต้ม Pandesal

วิธีที่แนะนำ: ยืนยันด้วยบัตรประชาชน
1. แตะ "ยืนยันตัวตน" ในแอป แล้วเลือก "ยืนยันด้วยบัตรประชาชน"
2. เตรียมบัตรประชาชนตัวจริงให้พร้อม และหาที่ที่มีแสงสว่างเพียงพอและสม่ำเสมอ
3. ถ่ายรูปบัตรประชาชนและเซลฟี่ให้เสร็จ ใช้เวลาประมาณ 3 นาที
4. การตรวจสอบส่วนใหญ่เสร็จภายในไม่กี่นาที หากต้องให้เจ้าหน้าที่ตรวจสอบเพิ่มเติม เราจะแจ้งให้คุณทราบทันทีที่เสร็จ (โดยปกติภายในไม่กี่ชั่วโมง และไม่เกิน 1 วันทำการ)

บัตรประชาชนของคุณได้รับการตรวจสอบโดยพาร์ทเนอร์ด้านการยืนยันตัวตนที่ปลอดภัยของเรา และ Moodeng จะไม่จัดเก็บข้อมูลบัตรของคุณ

ทางเลือกอื่น: ยืนยันด้วย World ID
หากคุณใช้ World App อยู่แล้ว (ยืนยันตัวตนแบบพบหน้าที่ Orb หรือด้วยหนังสือเดินทางแบบไบโอเมตริกซ์) คุณเลือก "ยืนยันด้วย World ID" แทนได้ แล้วยืนยันผ่าน World App`
   },
   'managing-your-account-and-security-settings': {
      title: 'จัดการบัญชีและการตั้งค่าความปลอดภัย',
      lastUpdated: '9 มิ.ย. 2026',
      body: `บัญชีของคุณผูกกับกระเป๋าเงิน ดังนั้นความปลอดภัยของกระเป๋าเงินก็คือความปลอดภัยของบัญชี

จากหน้า "บัญชี" คุณอัปเดตชื่อที่แสดง จัดการอีเมล เปลี่ยนรหัสผ่าน และออกจากระบบได้`
   }
};

const VIETNAMESE_GUIDES: Record<string, LocalizedGuideArticle> = {
   'how-to-request-your-first-loan': {
      title: 'Cách yêu cầu khoản vay đầu tiên',
      lastUpdated: '9 tháng 6, 2026',
      body: `Làm theo các bước đơn giản sau để gửi yêu cầu vay đầu tiên trên Moodeng Credit. Bạn cũng có thể xem video hướng dẫn quy trình này tại đây: https://youtube.com/shorts/fKpBC9zD6Hk?si=KoU6NRuIguzLw-Hh.

Bước 1: Tạo tài khoản
Đăng ký trên nền tảng Moodeng bằng cách nhập tên người dùng, email và mật khẩu bạn muốn. Bấm "Tạo tài khoản" để tiếp tục.

Bước 2: Bắt đầu đăng ký vay
Sau khi đăng nhập, bấm nút "Đăng ký vay" để bắt đầu.

Bước 3: Thiết lập ví
Để giao dịch an toàn trên Moodeng, bạn cần có ví. Mặc định, bạn dùng Moodeng Instant Wallet — ví được tạo từ tài khoản đăng nhập Moodeng của bạn, không cần ứng dụng riêng hay cụm từ khôi phục (seed phrase). Nếu muốn, bạn có thể dùng Base Account thay thế: truy cập https://account.base.app và làm theo hướng dẫn đăng ký.

Bước 4: Kết nối ví
Quay lại Moodeng và bấm "Kết nối ví" để tạo Instant Wallet — hoặc liên kết an toàn Base Account nếu bạn đã chọn dùng — để ví được gắn với tài khoản Moodeng của bạn.

Bước 5: Xác minh danh tính
Để đảm bảo an toàn cho cộng đồng, bấm "Xác minh danh tính" và hoàn tất bước kiểm tra nhanh bằng giấy tờ tùy thân + ảnh selfie ("Xác minh bằng giấy tờ tùy thân") — chỉ mất khoảng 3 phút. Đã dùng World App? Bạn có thể chọn "Xác minh bằng World ID".

Bước 6: Gửi yêu cầu
Bấm "Khám phá Bảng yêu cầu" để đặt các điều khoản cho khoản vay của bạn. Bạn cần xác định:
- Số tiền muốn vay.
- Số tiền trả và ngày trả.
- Lý do vay rõ ràng, giúp bạn tạo dựng niềm tin với những người cho vay tiềm năng.`
   },
   'understanding-your-trust-score': {
      title: 'Hiểu về điểm Pandesal của bạn',
      lastUpdated: '9 tháng 6, 2026',
      body: `Điểm Pandesal phản ánh mức độ đáng tin cậy trong việc trả nợ của bạn trên Moodeng Credit.

Điểm tăng sau mỗi lần bạn trả nợ đúng hạn và giảm khi bạn lỡ hạn trả hoặc vỡ nợ. Người cho vay dùng điểm này như một tín hiệu nhanh để quyết định có cấp vốn cho yêu cầu của bạn hay không.

Vì điểm Pandesal gắn với ví của bạn, điểm sẽ luôn đi cùng bạn — không bị khóa trong một ứng dụng duy nhất.`
   },
   'how-credit-levels-work': {
      title: 'Hạng tín dụng hoạt động như thế nào',
      lastUpdated: '9 tháng 6, 2026',
      body: `Hạng tín dụng xác định số tiền tối đa bạn có thể vay mỗi lần.

Mọi người đều bắt đầu ở Hạng 1 với hạn mức $15. Khi bạn vay và trả đủ, hạn mức sẽ tăng dần — $15 → $20 → $40 → $60 → $80 → $100 → $120 → $140 — và mở khóa các hạng mới.

Bạn chỉ lên hạng khi hoàn thành một Credit-Building Loan (khoản vay xây dựng tín dụng): khoản vay bằng toàn bộ hạn mức hiện tại, được trả đủ và đúng hạn.`
   },
   'trust-building-vs-credit-building-loans': {
      title: 'Trust-Building Loan và Credit-Building Loan',
      lastUpdated: '9 tháng 6, 2026',
      body: `Moodeng Credit có hai loại khoản vay:

Trust-Building Loan (khoản vay xây dựng niềm tin) là các khoản vay nhỏ hơn hạn mức hiện tại của bạn. Chúng giúp bạn chứng minh mình trả nợ đáng tin cậy, nhưng không làm tăng hạn mức.

Credit-Building Loan (khoản vay xây dựng tín dụng) là khoản vay bằng toàn bộ hạn mức. Trả đúng hạn một khoản vay như vậy sẽ nâng hạn mức và mở khóa Hạng tín dụng tiếp theo.

Hầu hết người vay dùng cả hai: khoản vay xây dựng niềm tin để duy trì hoạt động đều đặn, và khoản vay xây dựng tín dụng để tăng hạn mức theo thời gian.`
   },
   'how-repayments-affect-your-trust-score': {
      title: 'Việc trả nợ ảnh hưởng đến điểm Pandesal như thế nào',
      lastUpdated: '9 tháng 6, 2026',
      body: `Mỗi lần trả nợ, dù là cho Credit-Building Loan hay Trust-Building Loan, đều ảnh hưởng trực tiếp đến điểm Pandesal — thước đo uy tín của bạn trên nền tảng. Hệ thống của chúng tôi được thiết kế để ghi nhận hành vi nhất quán, đáng tin cậy và trung thực; những khoản vay nhỏ được trả sòng phẳng có giá trị với uy tín của bạn hơn những khoản vay lớn được trả thiếu nghiêm túc.

Cách tính điểm

- Trả đủ, đúng hạn: Trả 100% vào hoặc trước ngày đến hạn giúp bạn nhận số điểm tối đa (10 điểm).

- Trả một phần: Nếu không trả đủ, số điểm sẽ giảm theo tỷ lệ — 75% = 7 điểm · 50% = 5 điểm · 25% = 3 điểm.

- Trả trễ hạn: Mọi khoản trả nhận được sau thời hạn đã thỏa thuận đều được 0 điểm cho giao dịch đó.

- Vỡ nợ: Khoản vay không được trả sẽ để lại dấu vết vĩnh viễn trên hồ sơ của bạn, hiển thị với mọi người cho vay trong tương lai.`
   },
   'what-happens-when-you-repay-a-loan-on-time': {
      title: 'Lợi ích của việc trả nợ đúng hạn',
      lastUpdated: '9 tháng 6, 2026',
      body: `Trả nợ vào hoặc trước thời hạn là cách hiệu quả nhất để củng cố vị thế của bạn trong hệ sinh thái Moodeng Credit. Mọi khoản trả nợ đều được xác nhận on-chain; khi giao dịch USDC hoàn tất, trạng thái khoản vay sẽ tự động chuyển thành "Đã trả thành công".

Khi bạn trả đúng hạn, hồ sơ của bạn nhận được các lợi ích sau:

- Thêm điểm Pandesal: Điểm Pandesal của bạn tăng lên với cả Credit-Building Loan lẫn Trust-Building Loan, thể hiện sự đáng tin cậy của bạn với cộng đồng.
- Tăng hạn mức tín dụng: Với Credit-Building Loan, hạn mức vay hiện tại của bạn sẽ tăng, mở khóa Hạng tín dụng tiếp theo (ví dụ: từ $15 → $20).
- Lịch sử vay được xác thực: Lịch sử trả nợ thành công của bạn hiển thị với những người cho vay tiềm năng, giúp các yêu cầu vay sau này được cấp vốn nhanh chóng hơn nhiều.

Cách tính điểm trả nợ

Điểm Pandesal phản ánh mức độ đáng tin cậy của bạn và quyết định khả năng được cấp vốn trong tương lai:

- Trả đủ, đúng hạn: Nhận tối đa 10 điểm.
- Trả một phần: Điểm giảm theo tỷ lệ số tiền đã trả (ví dụ: 75% = 7 điểm; 50% = 5 điểm).
- Trả trễ hạn: Mọi khoản trả sau thời hạn đều được 0 điểm, bất kể số tiền.
- Vỡ nợ: Khoản vay không được trả sẽ để lại dấu vết vĩnh viễn trên hồ sơ on-chain công khai của bạn.`
   },
   'repaying-your-loan': {
      title: 'Các cách trả khoản vay',
      lastUpdated: '3 tháng 7, 2026',
      body: `Để trả nợ, hãy gửi đúng số USDC cần trả đến địa chỉ trả nợ hiển thị trong Moodeng (màn hình "Trả nợ" hiển thị chính xác số tiền và cho phép bạn sao chép địa chỉ). Bạn có thể gửi từ ví, sàn giao dịch, nền tảng P2P hoặc dịch vụ crypto địa phương — bất kỳ lựa chọn nào có ở quốc gia của bạn.

Gửi từ ví
Nếu bạn đã có USDC trong một ví bất kỳ, hãy gửi số tiền cần trả đến địa chỉ hiển thị trong Moodeng. Hãy đảm bảo mạng được chọn là Base.

Gửi từ sàn giao dịch
Rút USDC từ tài khoản sàn giao dịch thẳng đến địa chỉ trả nợ. Chọn USDC và chọn mạng Base.

Mua USDC trước, rồi trả nợ
Nếu bạn chưa có USDC, hãy mua trước và gửi về ví của bạn, sau đó trả nợ từ ví đó:
- Binance P2P: mua USDC bằng tiền địa phương từ người dùng khác, sau đó rút về qua mạng Base.
- Sàn giao dịch hoặc ứng dụng khác: mua USDC trên một sàn giao dịch hoặc ứng dụng hỗ trợ USDC trên mạng Base, rồi rút về ví của bạn qua mạng Base. Hãy kiểm tra xem nền tảng đó có hỗ trợ mạng Base không trước khi gửi.

Điều quan trọng: luôn chọn mạng Base khi gửi USDC. Chọn sai mạng có thể khiến bạn mất tiền.`
   },
   'adding-funds-to-your-wallet': {
      title: 'Các cách nạp USDC vào ví',
      lastUpdated: '3 tháng 7, 2026',
      body: `Ví Moodeng của bạn dùng USDC trên mạng Base. Ngoài các tùy chọn ngay trong ứng dụng (mua bằng thẻ và chuyển USDC từ chuỗi khác qua cầu nối), dưới đây là những cách phổ biến để nạp USDC vào ví:

Mua trên sàn giao dịch
Mua USDC trên sàn giao dịch bạn đang dùng, sau đó rút về địa chỉ ví của bạn. Khi rút, luôn chọn USDC và mạng Base.

Binance P2P
Mua USDC bằng tiền địa phương trực tiếp từ người dùng khác, sau đó rút về qua mạng Base.

Sàn giao dịch hoặc ứng dụng khác
Bạn cũng có thể mua USDC trên một sàn giao dịch hoặc ứng dụng hỗ trợ USDC trên mạng Base, rồi rút về ví của bạn. Hãy kiểm tra xem nền tảng đó có hỗ trợ mạng Base không trước khi gửi.

Gửi từ ví khác
Nếu bạn có USDC ở nơi khác, hãy gửi đến địa chỉ ví Moodeng của bạn — qua mạng Base.

Điều quan trọng: luôn chọn mạng Base. Gửi qua sai mạng có thể khiến bạn mất tiền.`
   },
   'withdrawing-to-your-bank': {
      title: 'Rút tiền về tài khoản ngân hàng',
      lastUpdated: '3 tháng 7, 2026',
      body: `Bạn có thể rút tiền bằng cách gửi USDC đến một sàn giao dịch hoặc dịch vụ được hỗ trợ, bán USDC tại đó, rồi chuyển tiền địa phương về tài khoản ngân hàng của bạn.

Video hướng dẫn — gửi USDC từ Base Account sang Binance: https://www.youtube.com/watch?v=Bqc2u3utbwc

Các lựa chọn phổ biến:

Binance P2P
Gửi USDC vào tài khoản Binance của bạn (luôn chọn mạng Base), sau đó bán qua Binance P2P và nhận tiền địa phương thẳng vào tài khoản ngân hàng hoặc ví điện tử.

Sàn giao dịch hoặc ứng dụng hỗ trợ USDC trên mạng Base
Nạp USDC, bán lấy tiền địa phương rồi rút về tài khoản ngân hàng của bạn. Hãy kiểm tra xem nền tảng đó có hỗ trợ mạng Base không trước khi gửi.

Ví hoặc sàn giao dịch khác
Bạn luôn có thể gửi USDC đến bất kỳ ví hoặc sàn giao dịch nào bạn đang dùng — chỉ cần đảm bảo nơi đó hỗ trợ USDC trên mạng Base trước khi gửi.

Điều quan trọng: luôn chọn mạng Base khi nạp tiền vào sàn giao dịch. Chọn sai mạng có thể khiến bạn mất tiền.`
   },
   'using-usdc-on-moodeng-credit': {
      title: 'Dùng USDC trên Moodeng Credit',
      lastUpdated: '9 tháng 6, 2026',
      body: `Tất cả khoản vay trên Moodeng Credit đều được tính bằng USDC — một stablecoin được quản lý chặt chẽ, neo giá 1:1 với đô la Mỹ.

Dùng USDC giúp giá trị khoản vay luôn ổn định. Khoản vay $20 hôm nay vẫn là khoản vay $20 khi bạn trả, bất kể thị trường crypto biến động ra sao.

Instant Wallet của bạn (hoặc Base Account, nếu bạn muốn) chạy trên Base, nơi chuyển USDC không mất phí gas — bạn không phải trả phí mạng.`
   },
   'verification-and-why-its-required': {
      title: 'Xác minh và bảo mật',
      lastUpdated: '9 tháng 6, 2026',
      body: `Để giữ Moodeng an toàn và công bằng, mọi người vay đều cần hoàn tất một bước xác minh danh tính ngắn, chỉ một lần. Việc này bảo vệ cộng đồng khỏi tài khoản giả và tài khoản trùng lặp, đồng thời giúp người cho vay tin tưởng các yêu cầu mà họ cấp vốn.

Vì sao cần xác minh?
- Bảo mật: đảm bảo mỗi yêu cầu đến từ một người thật, duy nhất, giúp ngăn chặn gian lận.
- Quyền truy cập: xác minh xong sẽ mở khóa tính năng yêu cầu vay và bắt đầu tích lũy điểm Pandesal của bạn.

Cách được khuyến nghị: Xác minh bằng giấy tờ tùy thân
1. Bấm "Xác minh danh tính" trong ứng dụng và chọn "Xác minh bằng giấy tờ tùy thân".
2. Chuẩn bị sẵn thẻ căn cước bản gốc và tìm nơi có ánh sáng tốt, đều.
3. Hoàn tất bước chụp ảnh giấy tờ + selfie nhanh — chỉ mất khoảng 3 phút.
4. Hầu hết lượt xác minh hoàn tất trong vài phút. Nếu hồ sơ của bạn cần được xét duyệt thủ công, chúng tôi sẽ thông báo ngay khi xong (thường trong vài giờ, tối đa 1 ngày làm việc).

Giấy tờ tùy thân của bạn được kiểm tra bởi đối tác xác minh bảo mật của chúng tôi và không bao giờ được Moodeng lưu trữ.

Cách khác: Xác minh bằng World ID
Nếu bạn đã dùng World App — đã được xác minh trực tiếp tại một Orb hoặc bằng hộ chiếu sinh trắc học — bạn có thể chọn "Xác minh bằng World ID" và xác nhận qua World App.`
   },
   'managing-your-account-and-security-settings': {
      title: 'Quản lý tài khoản và cài đặt bảo mật',
      lastUpdated: '9 tháng 6, 2026',
      body: `Tài khoản của bạn gắn với ví, nên bảo mật ví cũng chính là bảo mật tài khoản.

Từ màn hình "Tài khoản", bạn có thể cập nhật tên hiển thị, quản lý email, đổi mật khẩu và đăng xuất.`
   }
};

export function getGuidesForLocale(locale: string): GuideArticle[] {
   if (!['fil', 'id', 'th', 'vi'].includes(locale)) return GUIDES;
   const localizedGuides =
      locale === 'fil' ? FILIPINO_GUIDES : locale === 'id' ? INDONESIAN_GUIDES : locale === 'th' ? THAI_GUIDES : VIETNAMESE_GUIDES;

   return GUIDES.map((guide) => ({
      ...guide,
      ...(localizedGuides[guide.slug] ?? {})
   }));
}

export function getGuideForLocale(slug: string | undefined, locale: string): GuideArticle | undefined {
   return getGuidesForLocale(locale).find((guide) => guide.slug === slug);
}
