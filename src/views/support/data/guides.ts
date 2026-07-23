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

Step 3: Set Up Your Base Account
Secure transactions on Moodeng require a Base Account. Visit https://account.base.app and follow the registration instructions.

Step 4: Connect Your Wallet
Return to the Moodeng platform and tap "Connect Wallet" to securely link your new Base Account to your Moodeng account.

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
      title: 'Understanding your Trust Score',
      lastUpdated: 'Jun 9, 2026',
      body: `Your Trust Score reflects how reliably you repay loans on Moodeng Credit.

It rises with every on-time repayment and drops when you miss or default. Lenders use it as a quick signal to decide whether to fund your request.

Because your Trust Score is tied to your wallet, it travels with you — it's not locked inside a single app.`
   },
   {
      slug: 'how-credit-levels-work',
      title: 'How Credit Levels work',
      lastUpdated: 'Jun 9, 2026',
      body: `Credit Levels determine how much you can borrow at a time.

Everyone starts at Level 1 with a $15 limit. As you borrow and fully repay, your limit grows — $15 → $20 → $40 → $60 — and unlocks new levels.

You only advance by completing a Credit Growth Loan: a loan at your full current limit, repaid in full and on time.`
   },
   {
      slug: 'trust-building-vs-credit-building-loans',
      title: 'Trust-Building vs Credit-Building loans',
      lastUpdated: 'Jun 9, 2026',
      body: `Moodeng Credit supports two kinds of loans:

Trust-Building Loans are smaller loans below your current limit. They help you demonstrate reliable repayment but don't increase your limit.

Credit-Building Loans are full-limit loans. Repaying one on time raises your limit and unlocks the next Credit Level.

Most borrowers use both — trust loans to keep activity healthy, credit loans to grow their limit over time.`
   },
   {
      slug: 'how-repayments-affect-your-trust-score',
      title: 'How Repayments Affect Your Trust Score',
      lastUpdated: 'Jun 9, 2026',
      body: `Every repayment for either Credit-Building or Trust-Building loans directly impacts your Trust Score (TS), which serves as your reputation on the platform. Our system is designed to reward consistent, reliable, and honest behavior; small loans repaid cleanly are more valuable for your reputation than large loans repaid sloppily.

Scoring Breakdown

- On-Time, Full Repayments: Completing a 100% repayment on or before the due date maximizes your score (10 TS).

- Partial Repayments: Failing to repay the full amount reduces your score proportionally — 75% = 7 TS · 50% = 5 TS · 25% = 3 TS.

- Late Repayments: Any payment received after the agreed-upon deadline results in a 0 TS for that transaction.

- Defaults: Unpaid loans leave a permanent mark on your profile that is visible to all future lenders.`
   },
   {
      slug: 'what-happens-when-you-repay-a-loan-on-time',
      title: 'The Benefits of On-Time Repayments',
      lastUpdated: 'Jun 9, 2026',
      body: `Submitting your repayment on or before the scheduled deadline is the most effective way to strengthen your standing within the Moodeng Credit ecosystem. All repayments are confirmed on-chain; once the USDC transfer settles, your loan status is automatically updated to "Successfully Repaid."

When you repay on time, the following benefits are applied to your profile:

- Trust Score Enhancement: Your Trust Score increases for either Credit-Building or Trust-Building loans, reflecting your reliability to the community.
- Credit Limit Progression: For Credit-Building loans, your current borrowing limit increases, successfully unlocking the next credit level (e.g., advancing from $15 → $20).
- Verified Lending History: Your successful repayment history becomes visible to potential lenders, significantly streamlining the funding process for your future requests.

Repayment Scoring Breakdown

Your Trust Score (TS) reflects your reliability and determines your future funding success:

- On-Time, Full Repayment: Awards the maximum 10 TS.
- Partial Repayment: Your score is reduced proportionally based on the amount paid (e.g., 75% = 7 TS; 50% = 5 TS).
- Late Repayment: Any payment made after the deadline results in 0 TS, regardless of the amount.
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

Common options:

Coins.ph (recommended in the Philippines)
Our recommended option — it's the lowest-cost rail we've found, at roughly 0.70% all-in for a full round trip (see "What fees will I pay?"). Deposit USDC on the Base network, convert to PHP, and cash out to your bank or GCash.

PDAX
A BSP-regulated Philippine exchange. Deposit USDC, sell for PHP, and withdraw to your bank account.

GCrypto (GCash)
If crypto is enabled in your GCash app, you can receive supported crypto and convert inside GCash.

Binance P2P
Send USDC to your Binance account (always choose the Base network), then sell it through Binance P2P and receive local currency straight to your bank or e-wallet. Video walkthrough — sending USDC from your Base account to Binance: https://www.youtube.com/watch?v=Bqc2u3utbwc

Moneybees (external option)
Moneybees is an external over-the-counter service some users may use to buy or sell crypto through Moneybees' own process. It usually works out more expensive than Coins.ph, since its margin is built into the rate. You'll need to follow Moneybees' instructions directly at https://www.moneybees.ph/.

Another wallet or exchange
You can always send USDC to any wallet or exchange you already use — just make sure it supports USDC on the Base network before sending.

The key detail: always select Base as the network when depositing to an exchange. Using the wrong network can result in lost funds.`
   },
   {
      slug: 'fees-and-costs',
      title: 'What fees will I pay?',
      lastUpdated: 'Jul 23, 2026',
      body: `Moodeng itself is free. There are no platform fees on borrowing or lending, and no network (gas) fees when you use a Base Account on Base. The only real cost is the small fee a local exchange charges when you turn your USDC into pesos — and back into USDC when you repay.

The cheapest way: Coins.ph
Coins.ph is the lowest-cost rail we've found, which is why it's our recommended option in the Philippines. Here's the complete, all-in cost of a $15 loan taken out and repaid — the full round trip — through Coins.ph:

About ₱6.50 total (roughly $0.10) — around 0.70% of the loan amount.

That covers everything:
- The 0.30% spot trading fee each way — about ₱2.78 to sell USDC for pesos when you cash out, and ₱2.78 to buy it back when you repay.
- A tiny orderbook spread that stands in for any currency-conversion cost — about ₱0.15 each way.
- A free PESONet bank cash-out when you receive your pesos.
- A one-cent (₱0.62) network withdrawal fee to send your repayment USDC back to your Base wallet.

Want the pesos instantly?
PESONet settles the same or next business day. If you'd rather have the cash in your bank or e-wallet within minutes, choose InstaPay instead — it adds a flat ₱5 fee, bringing the round trip to about ₱11.50 (roughly $0.19, or 1.24%). Either way it's a tiny fraction of what a bank wire, a remittance service, or a "zero-fee" convert app would charge to move the same $15.

What about other services?
Over-the-counter services like Moneybees usually build their margin into the exchange rate, so they tend to work out more expensive than Coins.ph — that's why we no longer recommend them as the default. You're free to use any exchange or service you like; just check the fees and the rate before you confirm.

Rates and fees are set by each provider and can change. The figures here are approximate examples for a $15 loan — always check the amount shown before you confirm a trade or withdrawal.`
   },
   {
      slug: 'using-usdc-on-moodeng-credit',
      title: 'Using USDC on Moodeng Credit',
      lastUpdated: 'Jun 9, 2026',
      body: `All loans on Moodeng Credit are denominated in USDC — a regulated stablecoin pegged 1:1 to the US dollar.

Using USDC means loan values stay consistent. A $20 loan today is still a $20 loan when you repay it, regardless of crypto market movement.

We recommend using a Base Account on Base, where USDC transfers are gasless — you pay no network fees.`
   },
   {
      slug: 'verification-and-why-its-required',
      title: 'Verification & Security',
      lastUpdated: 'Jun 9, 2026',
      body: `To keep Moodeng safe and fair, all borrowers complete a short one-time identity verification. This protects the community from fake and duplicate accounts, and it's what lets lenders trust the requests they fund.

Why verify?
- Security: ensures every request comes from a real, unique person, preventing fraud.
- Access: completed verification unlocks loan requests and starts your Trust Score.

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

Step 2: Simulan ang BASE application
Kapag naka-log in ka na, i-tap ang "Apply for a Loan" button para simulan ang proseso.

Step 3: I-set up ang Base Account mo
Kailangan ng Base Account para sa secure transactions sa Moodeng. Pumunta sa https://account.base.app at sundin ang registration instructions.


Step 4: Ikonek ang wallet mo
Bumalik sa Moodeng platform at i-tap ang "Connect Wallet" para secure na mai-link ang bagong Base Account mo sa Moodeng account mo.

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
- Credit-building loans: Full-limit loan ito na gumagamit ng buong current credit limit mo, halimbawa full $15 request. Ang successful repayment ng ganitong loan lang ang paraan para tumaas ang limit mo sa next level, halimbawa $15 → $20 → $40 → $60 at pataas. Isang credit-building loan request lang ang puwedeng active at a time.
- Trust-building loans: Mas maliit na loans ito na below sa current credit limit mo. Nakakatulong ito bumuo ng Trust Score mo sa lenders, pero hindi nito tinataas ang overall credit limit mo. Puwede kang magkaroon ng multiple trust-building loan requests at the same time basta ang total ay nasa ilalim ng current limit mo.
- Pag-unlock ng next level: Para umakyat, kailangan mong hiramin at fully repay ang buong limit mo. Halimbawa, kung $15 ang limit mo at $12 trust-building loan lang ang ni-request mo at nagbayad ka ng $15, hindi tataas ang limit mo. Kailangan mong hiramin ang buong $15 at bayaran ang total agreed amount, kasama ang anumang maliit na interest o additional repayment amount na inoffer mo at tinanggap ng lender, para ma-unlock ang next level.`
   },
   'understanding-your-trust-score': {
      title: 'Pag-unawa sa Trust Score mo',
      lastUpdated: 'Jun 9, 2026',
      body: `Ipinapakita ng Trust Score mo kung gaano ka reliable magbayad ng loans sa Moodeng Credit.

Tumataas ito sa bawat on-time repayment at bumababa kapag late ka o nag-default. Ginagamit ito ng lenders bilang mabilis na signal para mag-decide kung i-fund nila ang request mo.

Dahil naka-tie ang Trust Score mo sa wallet mo, dala mo ito kahit saan. Hindi ito nakakulong sa isang app lang.`
   },
   'how-credit-levels-work': {
      title: 'Paano gumagana ang mga antas ng kredito',
      lastUpdated: 'Jun 9, 2026',
      body: `Tinutukoy ng mga antas ng kredito kung magkano ang puwede mong hiramin at a time.

Lahat nagsisimula sa Level 1 na may $15 limit. Habang humihiram ka at fully nagbabayad, lumalaki ang limit mo — $15 → $20 → $40 → $60 — at nag-a-unlock ng bagong levels.

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
      title: 'Paano naaapektuhan ng repayments ang Trust Score mo',
      lastUpdated: 'Jun 9, 2026',
      body: `Bawat repayment para sa Credit-building o Trust-building loans ay direktang nakakaapekto sa Trust Score (TS) mo, na nagsisilbing reputation mo sa platform. Dinisenyo ang system namin para i-reward ang consistent, reliable, at honest behavior; mas mahalaga sa reputation mo ang maliit na loans na malinis ang repayment kaysa malaking loans na magulo ang repayment.

Scoring breakdown

- On-time, full repayments: Kapag nakumpleto ang 100% repayment on or before the due date, maximized ang score mo (10 TS).

- Partial repayments: Kapag hindi nabayaran ang buong amount, nababawasan ang score mo proportionally — 75% = 7 TS · 50% = 5 TS · 25% = 3 TS.

- Late repayments: Anumang payment na natanggap pagkatapos ng agreed deadline ay nagreresulta sa 0 TS para sa transaction na iyon.

- Defaults: Ang unpaid loans ay nag-iiwan ng permanent mark sa profile mo na makikita ng lahat ng future lenders.`
   },
   'what-happens-when-you-repay-a-loan-on-time': {
      title: 'Mga benepisyo ng on-time repayments',
      lastUpdated: 'Jun 9, 2026',
      body: `Ang pag-submit ng repayment on or before the scheduled deadline ang pinaka-effective na paraan para palakasin ang standing mo sa Moodeng Credit ecosystem. Lahat ng repayments ay confirmed on-chain; kapag settled na ang USDC transfer, automatic na maa-update ang loan status mo sa "Successfully Repaid."

Kapag nagbayad ka on time, maa-apply sa profile mo ang mga benepisyong ito:

- Trust Score enhancement: Tumataas ang Trust Score mo para sa Credit-building o Trust-building loans, na nagpapakita ng reliability mo sa community.
- Credit limit progression: Para sa Credit-building loans, tataas ang current borrowing limit mo at maa-unlock ang next credit level, halimbawa mula $15 papuntang $20.
- Verified lending history: Makikita ng potential lenders ang successful repayment history mo, kaya mas madali nilang ma-review ang future requests mo.

Repayment scoring breakdown

Ipinapakita ng Trust Score (TS) mo ang reliability mo at tumutulong sa future funding success mo:

- On-time, full repayment: Nagbibigay ng maximum 10 TS.
- Partial repayment: Nababawasan ang score mo proportionally base sa amount na nabayaran, halimbawa 75% = 7 TS; 50% = 5 TS.
- Late repayment: Anumang payment pagkatapos ng deadline ay nagreresulta sa 0 TS, kahit magkano ang amount.
- Default: Ang unpaid loans ay nagreresulta sa permanent mark sa public on-chain profile mo.`
   },
   'using-usdc-on-moodeng-credit': {
      title: 'Paggamit ng USDC sa Moodeng Credit',
      lastUpdated: 'Jun 9, 2026',
      body: `Lahat ng loans sa Moodeng Credit ay denominated sa USDC — regulated stablecoin na naka-peg 1:1 sa US dollar.

Kapag USDC ang gamit, consistent ang loan values. Ang $20 loan ngayon ay $20 pa rin kapag binayaran mo ito, kahit gumalaw ang crypto market.

Inirerekomenda namin ang Base Account sa Base, kung saan gasless ang USDC transfers — wala kang babayarang network fees.`
   },
   'verification-and-why-its-required': {
      title: 'Verification at security',
      lastUpdated: 'Jun 9, 2026',
      body: `Para mapanatiling secure at fair ang environment, kailangan ng Moodeng Credit na i-verify ng lahat ng borrowers ang unique human identity nila gamit ang World ID. Pinoprotektahan ng process na ito ang community mula sa automated bots at duplicate accounts nang hindi ka pinapa-upload ng sensitive personal documents.

Bakit kailangan mag-verify?
- Security: Tinitiyak na galing sa totoong tao ang bawat request at nakakatulong maiwasan ang fraud.

- Rewards: Puwedeng mag-claim ang new users ng humigit-kumulang $10 sa Worldcoin rewards pagkatapos ng successful verification.

- Access: Kapag complete ang verification, puwede ka nang mag-request ng loans at magsimulang bumuo ng community trust score.

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
      lastUpdated: 'Jun 9, 2026',
      body: `Ikuti langkah sederhana ini untuk memulai permintaan pinjaman pertama kamu di Moodeng Credit. Kamu juga bisa menonton video walkthrough di sini: https://youtube.com/shorts/fKpBC9zD6Hk?si=KoU6NRuIguzLw-Hh.

Langkah 1: Buat akun
Daftar di platform Moodeng dengan username, email, dan password yang kamu pilih. Klik "Create Account" untuk melanjutkan.

Langkah 2: Mulai aplikasi pinjaman
Setelah login, tap tombol "Apply for a Loan" untuk memulai proses.

Langkah 3: Siapkan Base Account
Transaksi aman di Moodeng membutuhkan Base Account. Kunjungi https://account.base.app dan ikuti instruksi pendaftaran.


Langkah 4: Hubungkan wallet
Kembali ke platform Moodeng dan tap "Connect Wallet" untuk menautkan Base Account baru kamu ke akun Moodeng dengan aman.

Langkah 5: Verifikasi identitas
Agar komunitas tetap aman, download World App dan selesaikan verifikasi identitas manusia di lokasi World Orb fisik.

Langkah 6: Tautkan World ID
Setelah verifikasi di Orb, kembali ke Moodeng dan tap "Verify with World ID." Pindai kode QR untuk menyelesaikan tautan antara World ID dan akun Moodeng kamu.

Langkah 7: Kirim permintaan
Tap "Explore the Request Board" untuk mengatur syarat pinjaman. Kamu perlu menentukan:
- Jumlah pinjaman yang diinginkan.
- Jumlah pembayaran dan tanggal pembayaran.
- Alasan pinjaman yang jelas agar membantu membangun kepercayaan dengan calon pemberi pinjaman.

Catatan penting tentang credit limit
- Limit awal: Setiap peminjam baru mulai dengan limit $15.
- Credit-building loans: Ini adalah pinjaman full-limit yang memakai seluruh credit limit saat ini, misalnya meminta penuh $15. Membayar pinjaman jenis ini dengan sukses adalah satu-satunya cara menaikkan limit ke level berikutnya, misalnya $15 -> $20 -> $40 -> $60 dan seterusnya. Kamu hanya boleh memiliki satu permintaan credit-building loan aktif dalam satu waktu.
- Trust-building loans: Ini adalah pinjaman lebih kecil di bawah credit limit saat ini. Pinjaman ini membangun Trust Score dengan pemberi pinjaman, tetapi tidak menaikkan credit limit keseluruhan. Kamu boleh memiliki beberapa trust-building loan aktif selama totalnya tetap di bawah limit saat ini.
- Membuka level berikutnya: Untuk naik level, kamu harus meminjam dan membayar penuh seluruh limit. Misalnya, jika limit kamu $15 dan kamu hanya meminta trust-building loan $12 lalu membayar $15, limit kamu tidak naik. Kamu harus meminjam penuh $15 dan membayar total yang disepakati, termasuk bunga kecil atau tambahan pembayaran yang kamu tawarkan dan diterima pemberi pinjaman.`
   },
   'understanding-your-trust-score': {
      title: 'Memahami Trust Score kamu',
      lastUpdated: 'Jun 9, 2026',
      body: `Trust Score menunjukkan seberapa andal kamu membayar pinjaman di Moodeng Credit.

Skor ini naik setiap kali kamu membayar tepat waktu dan turun saat kamu terlambat atau gagal bayar. Pemberi pinjaman memakai skor ini sebagai sinyal cepat untuk memutuskan apakah mereka ingin mendanai permintaan kamu.

Karena Trust Score tertaut ke wallet, skor ini ikut bersama kamu. Skor ini tidak terkunci di satu app saja.`
   },
   'how-credit-levels-work': {
      title: 'Cara kerja level kredit',
      lastUpdated: 'Jun 9, 2026',
      body: `Level kredit menentukan berapa banyak yang bisa kamu pinjam dalam satu waktu.

Semua orang mulai di Level 1 dengan limit $15. Saat kamu meminjam dan membayar penuh, limit kamu bertambah: $15 -> $20 -> $40 -> $60, dan membuka level baru.

Kamu hanya naik level dengan menyelesaikan Credit Growth Loan: pinjaman sebesar limit penuh saat ini, dibayar penuh dan tepat waktu.`
   },
   'trust-building-vs-credit-building-loans': {
      title: 'Trust-building vs credit-building loans',
      lastUpdated: 'Jun 9, 2026',
      body: `Moodeng Credit mendukung dua jenis pinjaman:

Trust-building loans adalah pinjaman lebih kecil di bawah limit saat ini. Pinjaman ini membantu kamu menunjukkan pembayaran yang andal, tetapi tidak menaikkan limit.

Credit-building loans adalah pinjaman full-limit. Membayar satu pinjaman ini tepat waktu menaikkan limit dan membuka level kredit berikutnya.

Sebagian besar peminjam memakai keduanya: trust loans untuk menjaga aktivitas sehat, dan credit loans untuk menaikkan limit dari waktu ke waktu.`
   },
   'how-repayments-affect-your-trust-score': {
      title: 'Bagaimana pembayaran memengaruhi Trust Score',
      lastUpdated: 'Jun 9, 2026',
      body: `Setiap pembayaran untuk Credit-building atau Trust-building loans langsung memengaruhi Trust Score (TS), yaitu reputasi kamu di platform. Sistem kami dirancang untuk memberi reward pada perilaku yang konsisten, andal, dan jujur. Pinjaman kecil yang dibayar rapi lebih bernilai untuk reputasi daripada pinjaman besar yang dibayar berantakan.

Rincian skor

- Pembayaran penuh tepat waktu: Menyelesaikan 100% pembayaran pada atau sebelum jatuh tempo memaksimalkan skor kamu (10 TS).

- Pembayaran sebagian: Jika jumlah penuh tidak dibayar, skor berkurang secara proporsional — 75% = 7 TS · 50% = 5 TS · 25% = 3 TS.

- Pembayaran terlambat: Pembayaran apa pun yang diterima setelah deadline yang disepakati menghasilkan 0 TS untuk transaksi itu.

- Gagal bayar: Pinjaman yang tidak dibayar meninggalkan tanda permanen di profil yang terlihat oleh semua pemberi pinjaman berikutnya.`
   },
   'what-happens-when-you-repay-a-loan-on-time': {
      title: 'Manfaat pembayaran tepat waktu',
      lastUpdated: 'Jun 9, 2026',
      body: `Mengirim pembayaran pada atau sebelum deadline adalah cara paling efektif untuk memperkuat posisi kamu di ekosistem Moodeng Credit. Semua pembayaran dikonfirmasi on-chain; setelah transfer USDC selesai, status pinjaman otomatis diperbarui menjadi "Successfully Repaid."

Saat kamu membayar tepat waktu, manfaat berikut diterapkan ke profil kamu:

- Peningkatan Trust Score: Trust Score kamu naik untuk Credit-building atau Trust-building loans, mencerminkan keandalan kamu kepada komunitas.
- Progression credit limit: Untuk Credit-building loans, limit pinjaman saat ini naik dan membuka credit level berikutnya, misalnya dari $15 ke $20.
- Riwayat pembayaran terverifikasi: Riwayat pembayaran sukses kamu terlihat oleh calon pemberi pinjaman, sehingga proses pendanaan permintaan berikutnya menjadi lebih mudah.

Rincian skor pembayaran

Trust Score (TS) mencerminkan keandalan kamu dan menentukan peluang pendanaan ke depan:

- Pembayaran penuh tepat waktu: Mendapat maksimum 10 TS.
- Pembayaran sebagian: Skor berkurang proporsional berdasarkan jumlah yang dibayar, misalnya 75% = 7 TS; 50% = 5 TS.
- Pembayaran terlambat: Pembayaran setelah deadline menghasilkan 0 TS, berapa pun jumlahnya.
- Gagal bayar: Pinjaman yang tidak dibayar menghasilkan tanda permanen di profil on-chain publik kamu.`
   },
   'using-usdc-on-moodeng-credit': {
      title: 'Menggunakan USDC di Moodeng Credit',
      lastUpdated: 'Jun 9, 2026',
      body: `Semua pinjaman di Moodeng Credit memakai USDC, stablecoin teregulasi yang dipatok 1:1 ke dolar AS.

Dengan USDC, nilai pinjaman tetap konsisten. Pinjaman $20 hari ini tetap pinjaman $20 saat kamu membayarnya, terlepas dari pergerakan pasar kripto.

Kami merekomendasikan Base Account di Base, tempat transfer USDC gasless sehingga kamu tidak membayar biaya jaringan.`
   },
   'verification-and-why-its-required': {
      title: 'Verifikasi dan keamanan',
      lastUpdated: 'Jun 9, 2026',
      body: `Untuk menjaga lingkungan yang aman dan adil, Moodeng Credit mewajibkan semua peminjam memverifikasi identitas manusia unik mereka lewat World ID. Proses ini melindungi komunitas dari bot otomatis dan akun duplikat tanpa meminta kamu mengunggah dokumen pribadi sensitif.

Mengapa perlu verifikasi?
- Keamanan: Memastikan setiap permintaan berasal dari orang sungguhan dan membantu mencegah penipuan.

- Reward: Pengguna baru bisa mengklaim sekitar $10 dalam reward Worldcoin setelah verifikasi berhasil.

- Akses: Verifikasi selesai memungkinkan kamu mengajukan pinjaman dan mulai membangun community trust score.

Panduan langkah demi langkah
1. Download World App
Install app resmi melalui Apple App Store atau Google Play Store.

2. Temukan Orb
Di World App, buka Settings, pilih "Find an Orb," dan aktifkan "Allow Location" untuk menemukan pusat verifikasi terdekat .

3. Selesaikan verifikasi langsung
Datang ke lokasi Orb yang kamu pilih dan ikuti instruksi di layar app untuk menyelesaikan proses verifikasi satu kali.

4. Hubungkan ke Moodeng
Setelah terverifikasi, kembali ke platform Moodeng. Buka "Verification," lalu pilih "Connect World ID" untuk menautkan akun dan menyelesaikan eligibility kamu .`
   },
   'managing-your-account-and-security-settings': {
      title: 'Mengelola akun dan pengaturan keamanan',
      lastUpdated: 'Jun 9, 2026',
      body: `Akun kamu tertaut ke wallet, jadi keamanan wallet adalah keamanan akun.

Dari layar Akun, kamu bisa memperbarui nama tampilan, mengelola email, mengganti password, dan keluar.`
   }
};

const THAI_GUIDES: Record<string, LocalizedGuideArticle> = {
   'how-to-request-your-first-loan': {
      title: 'วิธีขอเงินกู้ครั้งแรก',
      lastUpdated: 'Jun 9, 2026',
      body: `ทำตามขั้นตอนเหล่านี้เพื่อเริ่มขอเงินกู้ครั้งแรกบน Moodeng Credit

ขั้นตอนที่ 1: สร้างบัญชี
สมัครบนแพลตฟอร์ม Moodeng ด้วยชื่อผู้ใช้ อีเมล และรหัสผ่านที่ต้องการ

ขั้นตอนที่ 2: เริ่มสมัครเงินกู้
หลังเข้าสู่ระบบ แตะ "Apply for a Loan" เพื่อเริ่มขั้นตอน

ขั้นตอนที่ 3: ตั้งค่า Base Account
ธุรกรรมบน Moodeng ต้องใช้ Base Account ไปที่ https://account.base.app และทำตามคำแนะนำ

ขั้นตอนที่ 4: เชื่อมต่อกระเป๋า
กลับมาที่ Moodeng แล้วแตะ "Connect Wallet" เพื่อเชื่อม Base Account กับบัญชี Moodeng

ขั้นตอนที่ 5: ยืนยันตัวตน
ดาวน์โหลด World App และยืนยันตัวตนมนุษย์ที่ World Orb จริง

ขั้นตอนที่ 6: เชื่อม World ID
หลังยืนยันที่ Orb แล้วกลับมาที่ Moodeng แตะ "Verify with World ID" และสแกน QR code

ขั้นตอนที่ 7: ส่งคำขอ
แตะ "Explore the Request Board" และกำหนดจำนวนเงิน วันที่ชำระคืน จำนวนที่ชำระคืน และเหตุผลในการยืม

หมายเหตุเกี่ยวกับวงเงินเครดิต
- ผู้ยืมใหม่เริ่มที่วงเงิน $15
- Credit-Building Loan คือเงินกู้เต็มวงเงินปัจจุบัน การชำระคืนสำเร็จเท่านั้นที่เพิ่มวงเงินไปยังระดับถัดไป
- Trust-Building Loan คือเงินกู้ที่ต่ำกว่าวงเงิน ช่วยสร้าง Trust Score แต่ไม่เพิ่มระดับเครดิต`
   },
   'understanding-your-trust-score': {
      title: 'ทำความเข้าใจ Trust Score',
      lastUpdated: 'Jun 9, 2026',
      body: `Trust Score แสดงว่าคุณชำระเงินกู้บน Moodeng Credit ได้สม่ำเสมอแค่ไหน

คะแนนจะเพิ่มขึ้นเมื่อชำระตรงเวลา และลดลงเมื่อชำระล่าช้าหรือผิดนัด ผู้ให้กู้ใช้คะแนนนี้เป็นสัญญาณเร็ว ๆ ในการตัดสินใจว่าจะให้ทุนคำขอของคุณหรือไม่

เพราะ Trust Score ผูกกับกระเป๋าเงิน มันจึงติดตามคุณไปได้ ไม่ได้อยู่แค่ในแอปเดียว`
   },
   'how-credit-levels-work': {
      title: 'ระดับเครดิตทำงานอย่างไร',
      lastUpdated: 'Jun 9, 2026',
      body: `ระดับเครดิตกำหนดว่าคุณสามารถยืมได้มากแค่ไหนในแต่ละครั้ง

ทุกคนเริ่มที่ Level 1 พร้อมวงเงิน $15 เมื่อคุณยืมและชำระคืนครบถ้วน วงเงินจะเพิ่มขึ้น: $15 → $20 → $40 → $60 และปลดล็อกระดับใหม่

คุณจะเลื่อนระดับได้ด้วย Credit Growth Loan เท่านั้น: เงินกู้เต็มวงเงินปัจจุบันที่ชำระคืนเต็มจำนวนและตรงเวลา`
   },
   'trust-building-vs-credit-building-loans': {
      title: 'Trust-Building Loan กับ Credit-Building Loan',
      lastUpdated: 'Jun 9, 2026',
      body: `Moodeng Credit รองรับเงินกู้สองประเภท

Trust-Building Loan คือเงินกู้ขนาดเล็กที่ต่ำกว่าวงเงินปัจจุบัน ช่วยแสดงว่าคุณชำระคืนได้ดี แต่ไม่เพิ่มวงเงิน

Credit-Building Loan คือเงินกู้เต็มวงเงิน การชำระตรงเวลาจะเพิ่มวงเงินและปลดล็อกระดับเครดิตถัดไป

ผู้ยืมส่วนใหญ่ใช้ทั้งสองแบบ: trust loans เพื่อรักษาประวัติให้แข็งแรง และ credit loans เพื่อเพิ่มวงเงินเมื่อพร้อม`
   },
   'how-repayments-affect-your-trust-score': {
      title: 'การชำระคืนมีผลต่อ Trust Score อย่างไร',
      lastUpdated: 'Jun 9, 2026',
      body: `การชำระคืนของ Credit-Building หรือ Trust-Building Loan มีผลโดยตรงต่อ Trust Score ซึ่งเป็นชื่อเสียงของคุณบนแพลตฟอร์ม

ชำระเต็มจำนวนตรงเวลาจะได้คะแนนสูงสุด การชำระบางส่วนจะลดคะแนนตามสัดส่วน การชำระล่าช้าได้ 0 TS สำหรับธุรกรรมนั้น และการผิดนัดจะทิ้งเครื่องหมายถาวรบนโปรไฟล์ที่ผู้ให้กู้ในอนาคตเห็นได้`
   },
   'what-happens-when-you-repay-a-loan-on-time': {
      title: 'ประโยชน์ของการชำระตรงเวลา',
      lastUpdated: 'Jun 9, 2026',
      body: `การชำระในหรือก่อนกำหนดเป็นวิธีที่ดีที่สุดในการเสริมสถานะของคุณในระบบ Moodeng Credit

เมื่อคุณชำระตรงเวลา Trust Score จะเพิ่มขึ้น ประวัติการชำระที่ดีจะมองเห็นได้ต่อผู้ให้กู้ และสำหรับ Credit-Building Loan วงเงินของคุณจะเพิ่มขึ้นเพื่อปลดล็อกระดับถัดไป

การชำระทั้งหมดถูกยืนยันบนเชน เมื่อ USDC settle แล้ว สถานะเงินกู้จะอัปเดตโดยอัตโนมัติ`
   },
   'using-usdc-on-moodeng-credit': {
      title: 'การใช้ USDC บน Moodeng Credit',
      lastUpdated: 'Jun 9, 2026',
      body: `เงินกู้ทั้งหมดบน Moodeng Credit ใช้ USDC ซึ่งเป็น stablecoin ที่ผูก 1:1 กับดอลลาร์สหรัฐ

การใช้ USDC ทำให้มูลค่าเงินกู้คงที่ เงินกู้ $20 วันนี้ยังเป็น $20 เมื่อคุณชำระคืน ไม่ขึ้นอยู่กับความผันผวนของตลาดคริปโต

เราแนะนำ Base Account บน Base เพราะการโอน USDC ไม่มีค่า gas`
   },
   'verification-and-why-its-required': {
      title: 'การยืนยันและความปลอดภัย',
      lastUpdated: 'Jun 9, 2026',
      body: `เพื่อให้ชุมชนปลอดภัยและเป็นธรรม Moodeng Credit กำหนดให้ผู้ยืมทุกคนยืนยันตัวตนมนุษย์ที่ไม่ซ้ำกันผ่าน World ID

ทำไมต้องยืนยัน?
- ความปลอดภัย: ทำให้ทุกคำขอมาจากคนจริงและช่วยป้องกัน fraud
- รางวัล: ผู้ใช้ใหม่อาจรับรางวัล Worldcoin ได้หลังยืนยันสำเร็จ
- การเข้าถึง: เมื่อยืนยันแล้ว คุณจึงขอเงินกู้และเริ่มสร้าง Trust Score ได้

ดาวน์โหลด World App ค้นหา Orb ใกล้คุณ ทำการยืนยันแบบพบหน้า แล้วกลับมาเชื่อม World ID กับบัญชี Moodeng`
   },
   'managing-your-account-and-security-settings': {
      title: 'จัดการบัญชีและการตั้งค่าความปลอดภัย',
      lastUpdated: 'Jun 9, 2026',
      body: `บัญชีของคุณผูกกับกระเป๋าเงิน ดังนั้นความปลอดภัยของกระเป๋าคือความปลอดภัยของบัญชี

จากหน้าบัญชี คุณสามารถอัปเดตชื่อที่แสดง จัดการอีเมล เปลี่ยนรหัสผ่าน และออกจากระบบได้`
   }
};

const VIETNAMESE_GUIDES: Record<string, LocalizedGuideArticle> = {
   'how-to-request-your-first-loan': {
      title: 'Cách yêu cầu khoản vay đầu tiên',
      lastUpdated: 'Jun 9, 2026',
      body: `Làm theo các bước này để bắt đầu yêu cầu khoản vay đầu tiên trên Moodeng Credit.

Bước 1: Tạo tài khoản
Đăng ký trên Moodeng bằng tên người dùng, email và mật khẩu bạn muốn.

Bước 2: Bắt đầu đăng ký vay
Sau khi đăng nhập, bấm "Apply for a Loan" để bắt đầu.

Bước 3: Thiết lập Base Account
Giao dịch an toàn trên Moodeng cần Base Account. Vào https://account.base.app và làm theo hướng dẫn.

Bước 4: Kết nối ví
Quay lại Moodeng và bấm "Connect Wallet" để liên kết Base Account với tài khoản Moodeng.

Bước 5: Xác minh danh tính
Tải World App và hoàn tất xác minh người thật tại địa điểm World Orb.

Bước 6: Liên kết World ID
Sau khi xác minh tại Orb, quay lại Moodeng, bấm "Verify with World ID" và quét QR code.

Bước 7: Gửi yêu cầu
Bấm "Explore the Request Board" để đặt số tiền vay, ngày trả, số tiền trả và lý do vay.

Lưu ý về hạn mức tín dụng
- Người vay mới bắt đầu với hạn mức $15.
- Credit-Building Loan là khoản vay toàn bộ hạn mức hiện tại; trả thành công là cách tăng hạn mức.
- Trust-Building Loan là khoản nhỏ hơn hạn mức; chúng xây dựng Trust Score nhưng không tăng hạng tín dụng.`
   },
   'understanding-your-trust-score': {
      title: 'Hiểu Trust Score của bạn',
      lastUpdated: 'Jun 9, 2026',
      body: `Trust Score phản ánh bạn trả các khoản vay trên Moodeng Credit đáng tin cậy đến mức nào.

Điểm tăng với mỗi lần trả đúng hạn và giảm khi bạn trả muộn hoặc vỡ nợ. Người cho vay dùng nó như tín hiệu nhanh để quyết định có cấp vốn cho yêu cầu của bạn không.

Vì Trust Score gắn với ví của bạn, nó đi cùng bạn và không bị khóa trong một ứng dụng duy nhất.`
   },
   'how-credit-levels-work': {
      title: 'Hạng tín dụng hoạt động như thế nào',
      lastUpdated: 'Jun 9, 2026',
      body: `Hạng tín dụng xác định bạn có thể vay bao nhiêu trong một lần.

Mọi người bắt đầu ở Level 1 với hạn mức $15. Khi bạn vay và trả đầy đủ, hạn mức tăng: $15 → $20 → $40 → $60 và mở khóa cấp mới.

Bạn chỉ lên cấp bằng cách hoàn thành Credit Growth Loan: khoản vay bằng toàn bộ hạn mức hiện tại, được trả đủ và đúng hạn.`
   },
   'trust-building-vs-credit-building-loans': {
      title: 'Trust-Building Loan và Credit-Building Loan',
      lastUpdated: 'Jun 9, 2026',
      body: `Moodeng Credit hỗ trợ hai loại khoản vay.

Trust-Building Loan là khoản nhỏ hơn hạn mức hiện tại. Chúng giúp bạn chứng minh khả năng trả đáng tin cậy nhưng không tăng hạn mức.

Credit-Building Loan là khoản vay toàn bộ hạn mức. Trả đúng hạn sẽ nâng hạn mức và mở khóa hạng tín dụng tiếp theo.

Hầu hết người vay dùng cả hai: trust loans để giữ hoạt động lành mạnh, credit loans để tăng hạn mức theo thời gian.`
   },
   'how-repayments-affect-your-trust-score': {
      title: 'Khoản trả ảnh hưởng Trust Score như thế nào',
      lastUpdated: 'Jun 9, 2026',
      body: `Mỗi khoản trả cho Credit-Building hoặc Trust-Building Loan ảnh hưởng trực tiếp đến Trust Score, tức uy tín của bạn trên nền tảng.

Trả đủ đúng hạn tối đa hóa điểm. Trả một phần làm giảm điểm theo tỷ lệ. Trả muộn nhận 0 TS cho giao dịch đó. Vỡ nợ để lại dấu vĩnh viễn trên hồ sơ mà người cho vay tương lai có thể thấy.`
   },
   'what-happens-when-you-repay-a-loan-on-time': {
      title: 'Lợi ích của việc trả đúng hạn',
      lastUpdated: 'Jun 9, 2026',
      body: `Trả vào hoặc trước hạn là cách hiệu quả nhất để củng cố vị thế của bạn trong hệ sinh thái Moodeng Credit.

Khi bạn trả đúng hạn, Trust Score tăng, lịch sử trả tốt hiển thị với người cho vay, và với Credit-Building Loan, hạn mức hiện tại tăng để mở khóa cấp tiếp theo.

Mọi khoản trả được xác nhận on-chain; khi chuyển USDC settle, trạng thái khoản vay tự động cập nhật.`
   },
   'using-usdc-on-moodeng-credit': {
      title: 'Dùng USDC trên Moodeng Credit',
      lastUpdated: 'Jun 9, 2026',
      body: `Tất cả khoản vay trên Moodeng Credit được tính bằng USDC, một stablecoin neo 1:1 với đô la Mỹ.

Dùng USDC giúp giá trị khoản vay ổn định. Khoản vay $20 hôm nay vẫn là $20 khi bạn trả, bất kể thị trường crypto biến động.

Chúng tôi khuyến nghị Base Account trên Base, nơi chuyển USDC không tốn gas.`
   },
   'verification-and-why-its-required': {
      title: 'Xác minh và bảo mật',
      lastUpdated: 'Jun 9, 2026',
      body: `Để giữ môi trường an toàn và công bằng, Moodeng Credit yêu cầu mọi người vay xác minh danh tính người thật duy nhất qua World ID.

Vì sao cần xác minh?
- Bảo mật: đảm bảo mỗi yêu cầu đến từ người thật và ngăn gian lận.
- Phần thưởng: người dùng mới có thể nhận phần thưởng Worldcoin sau khi xác minh thành công.
- Quyền truy cập: xác minh xong cho phép bạn yêu cầu khoản vay và bắt đầu xây dựng Trust Score.

Tải World App, tìm Orb gần bạn, hoàn tất xác minh trực tiếp, rồi quay lại liên kết World ID với tài khoản Moodeng.`
   },
   'managing-your-account-and-security-settings': {
      title: 'Quản lý tài khoản và cài đặt bảo mật',
      lastUpdated: 'Jun 9, 2026',
      body: `Tài khoản của bạn gắn với ví, nên bảo mật ví cũng là bảo mật tài khoản.

Từ màn hình Tài khoản, bạn có thể cập nhật tên hiển thị, quản lý email, đổi mật khẩu và đăng xuất.`
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
