export interface FAQItem {
   id: string;
   question: string;
   answer: string;
}

export const FAQS: FAQItem[] = [
   {
      id: 'what-is-moodeng-credit',
      question: 'What is Moodeng Credit?',
      answer: `Moodeng Credit is a borrowing platform that lets you request short-term loans in USDC while building a Trust Score linked to your wallet.

Instead of focusing on traditional credit scores, Moodeng helps you build trust through responsible borrowing and on-time repayments. Over time, this trust allows you to unlock higher Credit Levels and request larger loan amounts.

Your Trust Score isn't locked inside one app. It's designed to reflect your reliability and help you build a reputation you can carry forward.`
   },
   {
      id: 'how-does-borrowing-work',
      question: 'How does borrowing on Moodeng work?',
      answer: `You post a loan request from the Request Board with your desired amount (up to your current limit), repayment date, interest rate, and reason.

Lenders browse open requests and choose which to fund. Once a lender funds you, USDC is transferred directly to your wallet. You repay them on or before the agreed date from any wallet that holds USDC.`
   },
   {
      id: 'what-is-a-trust-score',
      question: 'What is a Trust Score and how is it calculated?',
      answer: `Your Trust Score is a reputation signal that reflects how reliably you repay loans.

It goes up with on-time, in-full repayments and drops with late payments or defaults. Lenders use it to gauge risk when deciding whether to fund your requests.`
   },
   {
      id: 'what-is-a-credit-level',
      question: 'What is a Credit Level?',
      answer: `Credit Levels control how much you can borrow at a time.

You start at Level 1 with a $15 limit. Each full repayment of a Credit-Building loan raises your limit and unlocks the next level — $15 → $20 → $40 → $60 — and beyond.`
   },
   {
      id: 'what-is-a-base-wallet',
      question: 'What is a Base wallet?',
      answer: `Base is a Layer 2 blockchain network built by Coinbase, designed for fast, cheap, secure crypto transactions. A "Base wallet" is any wallet that can hold and send funds on the Base network — most commonly the Coinbase Smart Wallet, which is tightly integrated with Base.

Moodeng uses Base wallets for one big reason: gasless USDC transactions. On Base with a Coinbase Smart Wallet, sending or receiving USDC costs nothing in network fees. When you receive a loan, the full amount lands in your wallet. When you repay, the lender gets every cent back.

Coinbase Smart Wallet is also passwordless and seedless — you sign in with email or passkey, no 12-word recovery phrase to lose. For a borrowing platform where new users may have never touched crypto, that's a meaningful improvement over older wallets like MetaMask.

Borrowers on Moodeng must use a Coinbase Smart Wallet on Base. Lenders have more flexibility but we recommend the same setup to keep transactions gasless.`
   },
   {
      id: 'what-is-usdc',
      question: 'What is USDC, and why does Moodeng use it?',
      answer: `USDC is a stablecoin pegged 1:1 to the US dollar, issued by Circle, a regulated US financial company. One USDC always equals one dollar, which means loan amounts on Moodeng don't fluctuate with crypto market swings — a $20 loan today is still worth $20 at repayment.

Moodeng uses USDC because it solves problems that both traditional currencies and other cryptocurrencies have. USD bank transfers take days, require both sides to have the right banking infrastructure, and often have fees. Volatile cryptocurrencies like Bitcoin or ETH can swing 10–20% during a loan's lifetime, exposing both sides to currency risk on top of repayment risk. USDC has neither problem.

USDC also moves anywhere in the world in seconds, is widely accepted by every major exchange (you can convert it to your local currency on Coinbase, Binance, Kraken, or local on/off-ramps), and is gasless when used on Base. It works whether you're in Manila, Lagos, or Mumbai.`
   },
   {
      id: 'does-moodeng-charge-fees',
      question: 'Does Moodeng charge fees?',
      answer: `No. Moodeng Credit is free to use. There are no platform fees on borrowing, no fees on lending, no monthly subscriptions, no setup costs. 100% of what a lender funds reaches the borrower, and 100% of a repayment reaches the lender.

Network fees (gas) are also zero when you use a Coinbase Smart Wallet on Base. So the only cost of using Moodeng is the interest rate the borrower offers — and that goes entirely to the lender, not to us.

How do we keep things free? We don't take a cut. Our future business model is the IOU token, which we'll launch via airdrop to active lenders. Until then, Moodeng is fully fee-free.`
   },
   {
      id: 'fight-loan-sharks',
      question: 'How does Moodeng help fight loan sharks?',
      answer: `Loan sharks — informal lenders who charge 20–100% weekly interest, threaten borrowers, and trap people in debt cycles — are a global problem. Hundreds of millions of unbanked and underbanked people have nowhere else to turn for emergency cash, and end up paying multiples of what they borrowed, over and over.

Moodeng Credit is built as a fairer alternative. Interest rates are set by the borrower and accepted (or passed on) by lenders in a transparent marketplace — no hidden charges, no compounding tricks. Small starter loans ($15–$60 at Credit Levels 1–4) match what borrowers actually need for short-term emergencies, paired with a credit-building system that grows your limit as you prove reliability.

There's no collateral, no government ID, and no bank account required — just a verified World ID and a Coinbase Smart Wallet. Anyone with a phone can access loans. And your reputation travels with you (linked to your wallet and World ID), so you build genuine credit history that lenders trust — instead of staying stuck in a cycle.

We don't claim to replace banks for everyone. But for the people currently using loan sharks because they have no other option, Moodeng aims to be a safer, fairer, more dignified path.`
   },
   {
      id: 'what-is-credit-building-loan',
      question: 'What is a credit-building loan?',
      answer: `A credit-building loan is a loan you take out specifically to grow your credit limit on Moodeng. To qualify as one, the loan must be at your full current Credit Level limit — not below it.

Here's how it works. You start at Credit Level 1 with a $15 borrowing limit. Borrow the full $15 and repay it on time, and your limit moves up to $20. Borrow that full $20 next time and repay, you unlock $40. Then $60. The progression keeps going at higher levels.

Smaller loans below your full limit are called Trust-Building Loans. Those still help — they grow your repayment record and reputation with lenders — but they don't raise your Credit Level. So if your goal is to build credit and unlock larger loans, you specifically want to take out and repay full-limit Credit-Building Loans.

Unlike a bank credit card or traditional credit-builder product, Moodeng's credit isn't reported to a credit bureau. It's tracked on-chain, tied to your wallet and World ID, and portable across any platform that integrates with the system.`
   },
   {
      id: 'small-loan',
      question: 'Can I get a small loan with Moodeng?',
      answer: `Yes — small loans are exactly what Moodeng is built for. New borrowers start at a $15 limit, and the platform was designed for short-term, low-amount lending: emergency cash, bridging gaps before payday, one-off expenses.

There are no minimum loan amounts, no monthly subscriptions, no setup costs, and no fees. You request what you need (up to your current Credit Level limit), set the repayment date and interest rate, and lenders decide whether to fund you.

Each successful repayment grows your limit step by step — $15 → $20 → $40 → $60, and beyond. So you can start small to test the platform with low stakes, build your reputation, and grow into larger loans only as you're ready.`
   }
];

const FILIPINO_FAQS: FAQItem[] = [
   {
      id: 'what-is-moodeng-credit',
      question: 'Ano ang Moodeng Credit?',
      answer: `Ang Moodeng Credit ay borrowing platform kung saan puwede kang mag-request ng short-term loans sa USDC habang bumubuo ng Trust Score na naka-link sa wallet mo.

Sa halip na umasa sa traditional credit scores, tinutulungan ka ng Moodeng na bumuo ng tiwala sa pamamagitan ng responsible borrowing at on-time repayments. Habang tumatagal, ang tiwalang ito ang nag-u-unlock ng mas mataas na Credit Levels at mas malaking loan amounts.

Hindi nakakulong ang Trust Score mo sa isang app lang. Dinisenyo itong magpakita ng reliability mo at tumulong bumuo ng reputation na madadala mo sa susunod.`
   },
   {
      id: 'how-does-borrowing-work',
      question: 'Paano gumagana ang paghiram sa Moodeng?',
      answer: `Magpo-post ka ng loan request mula sa Request Board kasama ang amount na gusto mo, hanggang sa current limit mo, repayment date, interest rate, at reason.

Titingnan ng lenders ang open requests at pipiliin kung alin ang gusto nilang pondohan. Kapag may lender na nag-fund sa iyo, diretso ang USDC sa wallet mo. Babayaran mo sila on or before the agreed date mula sa kahit anong wallet na may USDC.`
   },
   {
      id: 'what-is-a-trust-score',
      question: 'Ano ang Trust Score at paano ito kinakalkula?',
      answer: `Ang Trust Score mo ay reputation signal na nagpapakita kung gaano ka ka-reliable magbayad ng loans.

Tumataas ito kapag nagbabayad ka on time at in full, at bumababa kapag late ang payment o nag-default. Ginagamit ito ng lenders para timbangin ang risk kapag nagdedesisyon silang pondohan ang requests mo.`
   },
   {
      id: 'what-is-a-credit-level',
      question: 'Ano ang Credit Level?',
      answer: `Ang Credit Levels ang kumokontrol kung magkano ang puwede mong hiramin at a time.

Magsisimula ka sa Level 1 na may $15 limit. Bawat full repayment ng Credit-Building Loan ay nagpapataas ng limit mo at nag-u-unlock ng next level: $15 -> $20 -> $40 -> $60, at pataas pa.`
   },
   {
      id: 'what-is-a-base-wallet',
      question: 'Ano ang Base wallet?',
      answer: `Ang Base ay Layer 2 blockchain network na ginawa ng Coinbase para sa mabilis, mura, at secure na crypto transactions. Ang "Base wallet" ay kahit anong wallet na kayang mag-hold at magpadala ng funds sa Base network. Pinaka-common dito ang Coinbase Smart Wallet, na tightly integrated sa Base.

Ginagamit ng Moodeng ang Base wallets dahil sa isang malaking dahilan: gasless USDC transactions. Sa Base gamit ang Coinbase Smart Wallet, walang network fee ang pagpapadala o pagtanggap ng USDC. Kapag nakatanggap ka ng loan, buong amount ang papasok sa wallet mo. Kapag nagbayad ka, bawat sentimo ay makakarating sa lender.

Passwordless at seedless din ang Coinbase Smart Wallet. Nag-sign in ka gamit ang email o passkey, walang 12-word recovery phrase na puwedeng mawala. Para sa borrowing platform kung saan maraming bagong users ang hindi pa sanay sa crypto, malaking improvement ito kumpara sa older wallets tulad ng MetaMask.

Kailangang gumamit ang borrowers sa Moodeng ng Coinbase Smart Wallet sa Base. Mas flexible ang lenders, pero nirerekomenda rin namin ang parehong setup para manatiling gasless ang transactions.`
   },
   {
      id: 'what-is-usdc',
      question: 'Ano ang USDC, at bakit ito ginagamit ng Moodeng?',
      answer: `Ang USDC ay stablecoin na naka-peg 1:1 sa US dollar at ini-issue ng Circle, isang regulated US financial company. Ang isang USDC ay palaging katumbas ng isang dollar, kaya hindi nagbabago ang loan amounts sa Moodeng dahil sa crypto market swings. Ang $20 na loan ngayon ay $20 pa rin ang halaga kapag repayment na.

Ginagamit ng Moodeng ang USDC dahil nilulutas nito ang mga problemang meron sa traditional currencies at ibang cryptocurrencies. Ang USD bank transfers ay puwedeng tumagal ng ilang araw, kailangan ng banking access sa magkabilang side, at madalas may fees. Ang volatile crypto tulad ng Bitcoin o ETH ay puwedeng gumalaw ng 10-20% habang active ang loan, kaya nadadagdagan ang currency risk bukod pa sa repayment risk. Wala ang dalawang problemang iyon sa USDC.

Mabilis ding gumagalaw ang USDC kahit saan sa mundo, accepted ito ng major exchanges, at puwede itong i-convert sa local currency sa Coinbase, Binance, Kraken, o local on/off-ramps. Gasless din ito kapag ginamit sa Base. Gumagana ito nasa Manila, Lagos, Mumbai, o kahit saan ka man.`
   },
   {
      id: 'does-moodeng-charge-fees',
      question: 'May fees ba ang Moodeng?',
      answer: `Wala. Libre gamitin ang Moodeng Credit. Walang platform fees sa paghiram, walang fees sa pagpapahiram, walang monthly subscriptions, at walang setup costs. 100% ng pini-fund ng lender ay napupunta sa borrower, at 100% ng repayment ay napupunta sa lender.

Zero rin ang network fees o gas kapag gumagamit ka ng Coinbase Smart Wallet sa Base. Kaya ang tanging cost sa paggamit ng Moodeng ay ang interest rate na ino-offer ng borrower, at iyon ay buong napupunta sa lender, hindi sa amin.

Paano namin pinananatiling libre ito? Hindi kami kumukuha ng cut. Ang future business model namin ay ang IOU token, na ilulunsad namin sa pamamagitan ng airdrop sa active lenders. Hanggang doon, ganap na fee-free ang Moodeng.`
   },
   {
      id: 'fight-loan-sharks',
      question: 'Paano tumutulong ang Moodeng laban sa loan sharks?',
      answer: `Ang loan sharks ay informal lenders na naniningil ng 20-100% weekly interest, nananakot ng borrowers, at nagkukulong sa tao sa cycle ng utang. Global problem ito. Daan-daang milyong unbanked at underbanked na tao ang walang ibang mapuntahan para sa emergency cash, kaya nauuwi sila sa pagbabayad ng maraming beses ng orihinal nilang hiniram.

Ginawa ang Moodeng Credit bilang mas patas na alternative. Ang interest rates ay sine-set ng borrower at tinatanggap o nilalagpasan ng lenders sa transparent marketplace. Walang hidden charges at walang compounding tricks. Ang small starter loans, gaya ng $15-$60 sa Credit Levels 1-4, ay tugma sa short-term emergency needs ng borrowers, kasama ang credit-building system na nagpapalaki ng limit habang napapatunayan mo ang reliability mo.

Walang collateral, walang government ID, at walang bank account na kailangan. Verified World ID at Coinbase Smart Wallet lang. Kahit sinong may phone ay puwedeng maka-access ng loans. At dahil naka-link sa wallet at World ID ang reputation mo, nadadala mo ito at nakakabuo ka ng tunay na credit history na puwedeng pagkatiwalaan ng lenders, sa halip na manatili sa cycle.

Hindi namin sinasabing papalitan namin ang banks para sa lahat. Pero para sa mga taong napipilitang gumamit ng loan sharks dahil wala silang ibang option, layunin ng Moodeng na maging mas ligtas, mas patas, at mas dignified na path.`
   },
   {
      id: 'what-is-credit-building-loan',
      question: 'Ano ang credit-building loan?',
      answer: `Ang credit-building loan ay loan na kinukuha mo para palakihin ang credit limit mo sa Moodeng. Para maging credit-building loan, dapat nasa buong current Credit Level limit mo ang loan, hindi mas mababa.

Ganito ito gumagana. Magsisimula ka sa Credit Level 1 na may $15 borrowing limit. Hiramin ang buong $15 at bayaran on time, at aangat ang limit mo sa $20. Hiramin naman ang buong $20 sa susunod at bayaran, mag-u-unlock ka ng $40. Pagkatapos $60. Patuloy ang progression sa higher levels.

Ang mas maliliit na loans na mas mababa sa full limit mo ay tinatawag na Trust-Building Loans. Nakakatulong pa rin ang mga iyon dahil pinapalakas nila ang repayment record at reputation mo sa lenders, pero hindi nila tinataas ang Credit Level mo. Kaya kung goal mo ang mag-build ng credit at mag-unlock ng mas malalaking loans, kailangan mong kumuha at magbayad ng full-limit Credit-Building Loans.

Hindi tulad ng bank credit card o traditional credit-builder product, hindi nire-report sa credit bureau ang credit ng Moodeng. Naka-track ito on-chain, naka-link sa wallet at World ID mo, at portable sa kahit anong platform na mag-iintegrate sa system.`
   },
   {
      id: 'small-loan',
      question: 'Puwede ba akong makakuha ng maliit na loan sa Moodeng?',
      answer: `Oo. Maliit na loans talaga ang pangunahing gamit ng Moodeng. Nagsisimula ang bagong borrowers sa $15 limit, at dinisenyo ang platform para sa short-term, low-amount lending: emergency cash, pantawid bago payday, o one-off expenses.

Walang minimum loan amounts, walang monthly subscriptions, walang setup costs, at walang fees. Ire-request mo ang kailangan mo, hanggang sa current Credit Level limit mo, ise-set ang repayment date at interest rate, at lenders ang magdedesisyon kung popondohan ka nila.

Bawat successful repayment ay nagpapalaki ng limit mo step by step: $15 -> $20 -> $40 -> $60, at pataas pa. Kaya puwede kang magsimula sa maliit para subukan ang platform with low stakes, bumuo ng reputation, at lumaki lang sa bigger loans kapag handa ka na.`
   }
];

const INDONESIAN_FAQS: FAQItem[] = [
   {
      id: 'what-is-moodeng-credit',
      question: 'Apa itu Moodeng Credit?',
      answer: `Moodeng Credit adalah platform pinjaman yang memungkinkan kamu mengajukan pinjaman jangka pendek dalam USDC sambil membangun Trust Score yang tertaut ke wallet kamu.

Alih-alih fokus pada skor kredit tradisional, Moodeng membantu kamu membangun kepercayaan lewat pinjaman yang bertanggung jawab dan pembayaran tepat waktu. Seiring waktu, kepercayaan ini membuka Credit Level yang lebih tinggi dan jumlah pinjaman yang lebih besar.

Trust Score kamu tidak terkunci di satu app. Skor ini dirancang untuk mencerminkan keandalan kamu dan membantu kamu membangun reputasi yang bisa dibawa ke depan.`
   },
   {
      id: 'how-does-borrowing-work',
      question: 'Bagaimana cara meminjam di Moodeng?',
      answer: `Kamu membuat permintaan pinjaman dari Papan Permintaan dengan jumlah yang diinginkan, sampai batas limit saat ini, tanggal pembayaran, rate bunga, dan alasan pinjaman.

Pemberi pinjaman melihat permintaan terbuka dan memilih mana yang ingin mereka danai. Setelah didanai, USDC dikirim langsung ke wallet kamu. Kamu membayar kembali pada atau sebelum tanggal yang disepakati dari wallet mana pun yang memiliki USDC.`
   },
   {
      id: 'what-is-a-trust-score',
      question: 'Apa itu Trust Score dan bagaimana dihitung?',
      answer: `Trust Score adalah sinyal reputasi yang menunjukkan seberapa andal kamu membayar pinjaman.

Skor ini naik saat kamu membayar penuh dan tepat waktu, dan turun saat pembayaran terlambat atau gagal bayar. Pemberi pinjaman memakai skor ini untuk menilai risiko sebelum mendanai permintaan kamu.`
   },
   {
      id: 'what-is-a-credit-level',
      question: 'Apa itu Credit Level?',
      answer: `Credit Level menentukan berapa banyak yang bisa kamu pinjam dalam satu waktu.

Kamu mulai dari Level 1 dengan limit $15. Setiap pembayaran penuh untuk Credit-Building Loan menaikkan limit dan membuka level berikutnya: $15 -> $20 -> $40 -> $60, dan seterusnya.`
   },
   {
      id: 'what-is-a-base-wallet',
      question: 'Apa itu Base wallet?',
      answer: `Base adalah jaringan blockchain Layer 2 dari Coinbase yang dirancang untuk transaksi kripto yang cepat, murah, dan aman. "Base wallet" adalah wallet apa pun yang bisa menyimpan dan mengirim dana di jaringan Base, paling umum Coinbase Smart Wallet yang terintegrasi erat dengan Base.

Moodeng memakai Base wallet karena satu alasan besar: transaksi USDC tanpa gas. Di Base dengan Coinbase Smart Wallet, mengirim atau menerima USDC tidak memerlukan biaya jaringan. Saat kamu menerima pinjaman, jumlah penuh masuk ke wallet kamu. Saat kamu membayar, pemberi pinjaman menerima seluruh jumlahnya.

Coinbase Smart Wallet juga passwordless dan seedless. Kamu masuk dengan email atau passkey, tanpa recovery phrase 12 kata yang bisa hilang. Untuk platform pinjaman dengan banyak pengguna baru yang belum terbiasa dengan kripto, ini jauh lebih mudah dibanding wallet lama seperti MetaMask.

Peminjam di Moodeng harus memakai Coinbase Smart Wallet di Base. Pemberi pinjaman lebih fleksibel, tetapi kami tetap merekomendasikan setup yang sama agar transaksi tetap gasless.`
   },
   {
      id: 'what-is-usdc',
      question: 'Apa itu USDC, dan mengapa Moodeng memakainya?',
      answer: `USDC adalah stablecoin yang dipatok 1:1 ke dolar AS dan diterbitkan oleh Circle, perusahaan keuangan AS yang teregulasi. Satu USDC selalu setara satu dolar, jadi nilai pinjaman di Moodeng tidak berubah karena pergerakan pasar kripto. Pinjaman $20 hari ini tetap bernilai $20 saat dibayar.

Moodeng memakai USDC karena ini menyelesaikan masalah yang ada pada mata uang tradisional dan kripto lain. Transfer bank USD bisa memakan waktu berhari-hari, membutuhkan akses perbankan di kedua sisi, dan sering memiliki biaya. Kripto volatil seperti Bitcoin atau ETH bisa bergerak 10-20% selama masa pinjaman, menambah risiko mata uang di luar risiko pembayaran. USDC tidak memiliki kedua masalah itu.

USDC juga bergerak ke mana pun di dunia dalam hitungan detik, didukung oleh bursa kripto besar, dan bisa dikonversi ke mata uang lokal melalui Coinbase, Binance, Kraken, atau on/off-ramp lokal. USDC juga gasless saat digunakan di Base.`
   },
   {
      id: 'does-moodeng-charge-fees',
      question: 'Apakah Moodeng mengenakan biaya?',
      answer: `Tidak. Moodeng Credit gratis digunakan. Tidak ada biaya platform untuk meminjam, tidak ada biaya untuk memberi pinjaman, tidak ada langganan bulanan, dan tidak ada biaya setup. 100% dana dari pemberi pinjaman sampai ke peminjam, dan 100% pembayaran sampai ke pemberi pinjaman.

Biaya jaringan atau gas juga nol saat kamu memakai Coinbase Smart Wallet di Base. Jadi satu-satunya biaya memakai Moodeng adalah rate bunga yang ditawarkan peminjam, dan itu sepenuhnya untuk pemberi pinjaman, bukan untuk kami.

Bagaimana kami menjaga ini tetap gratis? Kami tidak mengambil potongan. Model bisnis masa depan kami adalah token IOU, yang akan diluncurkan lewat airdrop untuk pemberi pinjaman aktif. Sampai saat itu, Moodeng sepenuhnya bebas biaya.`
   },
   {
      id: 'fight-loan-sharks',
      question: 'Bagaimana Moodeng membantu melawan rentenir?',
      answer: `Rentenir, yaitu pemberi pinjaman informal yang mengenakan bunga mingguan 20-100%, mengancam peminjam, dan menjebak orang dalam siklus utang, adalah masalah global. Ratusan juta orang unbanked dan underbanked tidak punya pilihan lain untuk uang darurat, lalu membayar berkali-kali lipat dari jumlah yang mereka pinjam.

Moodeng Credit dibuat sebagai alternatif yang lebih adil. Rate bunga ditentukan oleh peminjam dan diterima atau dilewati oleh pemberi pinjaman di marketplace yang transparan. Tidak ada biaya tersembunyi dan tidak ada trik bunga berbunga. Pinjaman awal kecil, seperti $15-$60 di Credit Level 1-4, sesuai dengan kebutuhan darurat jangka pendek, ditambah sistem credit-building yang menaikkan limit saat kamu membuktikan keandalan.

Tidak perlu agunan, ID pemerintah, atau rekening bank. Cukup World ID terverifikasi dan Coinbase Smart Wallet. Siapa pun dengan ponsel bisa mengakses pinjaman. Reputasi kamu juga ikut terbawa, karena tertaut ke wallet dan World ID, sehingga kamu membangun riwayat kredit nyata yang bisa dipercaya pemberi pinjaman.

Kami tidak mengklaim bisa menggantikan bank untuk semua orang. Tetapi untuk orang yang memakai rentenir karena tidak ada pilihan lain, Moodeng bertujuan menjadi jalur yang lebih aman, adil, dan bermartabat.`
   },
   {
      id: 'what-is-credit-building-loan',
      question: 'Apa itu credit-building loan?',
      answer: `Credit-building loan adalah pinjaman yang kamu ambil khusus untuk menaikkan credit limit di Moodeng. Agar termasuk credit-building loan, pinjaman harus sebesar limit Credit Level kamu saat ini, bukan di bawahnya.

Begini cara kerjanya. Kamu mulai di Credit Level 1 dengan limit pinjaman $15. Pinjam penuh $15 dan bayar tepat waktu, lalu limit kamu naik ke $20. Pinjam penuh $20 berikutnya dan bayar, kamu membuka $40. Lalu $60. Progression terus berlanjut di level yang lebih tinggi.

Pinjaman lebih kecil di bawah limit penuh disebut Trust-Building Loans. Pinjaman itu tetap membantu karena membangun riwayat pembayaran dan reputasi dengan pemberi pinjaman, tetapi tidak menaikkan Credit Level. Jadi jika tujuan kamu adalah membangun kredit dan membuka pinjaman lebih besar, kamu perlu mengambil dan membayar Credit-Building Loans dengan limit penuh.

Berbeda dari kartu kredit bank atau produk credit-builder tradisional, kredit Moodeng tidak dilaporkan ke credit bureau. Kredit ini dilacak on-chain, tertaut ke wallet dan World ID kamu, dan portable ke platform mana pun yang mengintegrasikan sistem ini.`
   },
   {
      id: 'small-loan',
      question: 'Bisakah saya mendapat pinjaman kecil di Moodeng?',
      answer: `Ya. Pinjaman kecil memang alasan utama Moodeng dibuat. Peminjam baru mulai dengan limit $15, dan platform ini dirancang untuk pinjaman jangka pendek bernilai kecil: uang darurat, menjembatani kebutuhan sebelum gajian, atau pengeluaran satu kali.

Tidak ada minimum jumlah pinjaman, tidak ada langganan bulanan, tidak ada biaya setup, dan tidak ada fee. Kamu meminta jumlah yang kamu perlukan, sampai limit Credit Level saat ini, menetapkan tanggal pembayaran dan rate bunga, lalu pemberi pinjaman memutuskan apakah ingin mendanai.

Setiap pembayaran berhasil menaikkan limit kamu bertahap: $15 -> $20 -> $40 -> $60, dan seterusnya. Jadi kamu bisa mulai kecil untuk mencoba platform dengan risiko rendah, membangun reputasi, lalu tumbuh ke pinjaman lebih besar saat sudah siap.`
   }
];

const THAI_FAQS: FAQItem[] = [
   {
      id: 'what-is-moodeng-credit',
      question: 'Moodeng Credit คืออะไร?',
      answer: `Moodeng Credit เป็นแพลตฟอร์มการยืมที่ให้คุณขอเงินกู้ระยะสั้นเป็น USDC พร้อมสร้าง Trust Score ที่ผูกกับกระเป๋าเงินของคุณ

แทนที่จะอิงคะแนนเครดิตแบบเดิม Moodeng ช่วยให้คุณสร้างความน่าเชื่อถือผ่านการยืมอย่างรับผิดชอบและการชำระคืนตรงเวลา เมื่อเวลาผ่านไป ความน่าเชื่อถือนี้จะช่วยปลดล็อก Credit Level ที่สูงขึ้นและขอวงเงินที่มากขึ้นได้

Trust Score ของคุณไม่ได้ติดอยู่ในแอปเดียว แต่สะท้อนความน่าเชื่อถือและช่วยสร้างชื่อเสียงที่คุณพกต่อไปได้`
   },
   {
      id: 'how-does-borrowing-work',
      question: 'การยืมบน Moodeng ทำงานอย่างไร?',
      answer: `คุณโพสต์คำขอเงินกู้จากกระดานคำขอ พร้อมจำนวนเงินที่ต้องการ ภายในวงเงินปัจจุบัน วันชำระคืน อัตราดอกเบี้ย และเหตุผลในการยืม

ผู้ให้กู้จะดูคำขอที่เปิดอยู่และเลือกคำขอที่ต้องการสนับสนุน เมื่อมีผู้ให้กู้ให้ทุน USDC จะถูกส่งตรงเข้ากระเป๋าของคุณ คุณชำระคืนในหรือก่อนวันที่ตกลงจากกระเป๋าใดก็ได้ที่มี USDC`
   },
   {
      id: 'what-is-a-trust-score',
      question: 'Trust Score คืออะไร และคำนวณอย่างไร?',
      answer: `Trust Score คือสัญญาณชื่อเสียงที่แสดงว่าคุณชำระเงินกู้ได้สม่ำเสมอแค่ไหน

คะแนนจะเพิ่มขึ้นเมื่อชำระเต็มจำนวนตรงเวลา และลดลงเมื่อชำระล่าช้าหรือผิดนัด ผู้ให้กู้ใช้คะแนนนี้เพื่อประเมินความเสี่ยงก่อนตัดสินใจให้ทุนคำขอของคุณ`
   },
   {
      id: 'what-is-a-credit-level',
      question: 'Credit Level คืออะไร?',
      answer: `Credit Level กำหนดว่าคุณสามารถยืมได้มากแค่ไหนในแต่ละครั้ง

คุณเริ่มที่ Level 1 พร้อมวงเงิน $15 การชำระคืนเต็มจำนวนของ Credit-Building Loan แต่ละครั้งจะเพิ่มวงเงินและปลดล็อกระดับถัดไป: $15 -> $20 -> $40 -> $60 และต่อไป`
   },
   {
      id: 'what-is-a-base-wallet',
      question: 'Base wallet คืออะไร?',
      answer: `Base เป็นเครือข่ายบล็อกเชน Layer 2 จาก Coinbase ที่ออกแบบมาเพื่อธุรกรรมคริปโตที่รวดเร็ว ถูก และปลอดภัย "Base wallet" คือกระเป๋าเงินใด ๆ ที่ถือและส่งเงินบนเครือข่าย Base ได้ โดยที่พบบ่อยคือ Coinbase Smart Wallet

Moodeng ใช้ Base wallet เพราะธุรกรรม USDC บน Base ด้วย Coinbase Smart Wallet ไม่มีค่า gas เมื่อคุณได้รับเงินกู้ จำนวนเต็มจะเข้ากระเป๋าของคุณ และเมื่อคุณชำระคืน ผู้ให้กู้จะได้รับเต็มจำนวน

ผู้ยืมบน Moodeng ต้องใช้ Coinbase Smart Wallet บน Base ส่วนผู้ให้กู้ยืดหยุ่นกว่า แต่เราแนะนำวิธีเดียวกันเพื่อให้ธุรกรรมไม่มีค่า gas`
   },
   {
      id: 'what-is-usdc',
      question: 'USDC คืออะไร และทำไม Moodeng ใช้มัน?',
      answer: `USDC เป็น stablecoin ที่ผูก 1:1 กับดอลลาร์สหรัฐ ออกโดย Circle ซึ่งเป็นบริษัทการเงินสหรัฐที่อยู่ภายใต้การกำกับดูแล หนึ่ง USDC เท่ากับหนึ่งดอลลาร์เสมอ ทำให้มูลค่าเงินกู้บน Moodeng ไม่ผันผวนตามตลาดคริปโต

Moodeng ใช้ USDC เพราะโอนทั่วโลกได้รวดเร็ว เป็นที่ยอมรับในตลาดแลกเปลี่ยนหลัก และไม่มีค่า gas เมื่อใช้บน Base คุณจึงสามารถรับ ถือ แปลงเป็นเงินท้องถิ่น หรือใช้บนเชนได้ตามต้องการ`
   },
   {
      id: 'does-moodeng-charge-fees',
      question: 'Moodeng คิดค่าธรรมเนียมหรือไม่?',
      answer: `ไม่ Moodeng Credit ใช้งานฟรี ไม่มีค่าธรรมเนียมแพลตฟอร์มสำหรับการยืมหรือให้กู้ ไม่มีค่าสมัครรายเดือน และไม่มีค่าเริ่มต้น เงินที่ผู้ให้กู้ให้ทุนจะถึงผู้ยืม 100% และเงินชำระคืนจะถึงผู้ให้กู้ 100%

ค่า network fee หรือ gas ก็เป็นศูนย์เมื่อใช้ Coinbase Smart Wallet บน Base ค่าใช้จ่ายเดียวคือดอกเบี้ยที่ผู้ยืมเสนอ และเงินส่วนนั้นเป็นของผู้ให้กู้ทั้งหมด ไม่ใช่ของเรา`
   },
   {
      id: 'fight-loan-sharks',
      question: 'Moodeng ช่วยต่อสู้กับเงินกู้นอกระบบอย่างไร?',
      answer: `เงินกู้นอกระบบที่คิดดอกเบี้ยรายสัปดาห์สูง ข่มขู่ผู้ยืม และทำให้คนติดวงจรหนี้เป็นปัญหาทั่วโลก หลายคนไม่มีทางเลือกอื่นเมื่อต้องใช้เงินฉุกเฉิน

Moodeng Credit ถูกสร้างเป็นทางเลือกที่เป็นธรรมกว่า อัตราดอกเบี้ยถูกกำหนดโดยผู้ยืมและยอมรับโดยผู้ให้กู้ในตลาดที่โปร่งใส ไม่มีค่าใช้จ่ายแอบแฝง ไม่มีดอกเบี้ยทบต้นแบบหลอกลวง และใช้เงินกู้เริ่มต้นขนาดเล็กพร้อมระบบสร้างเครดิตที่เพิ่มวงเงินเมื่อคุณพิสูจน์ความน่าเชื่อถือ`
   },
   {
      id: 'what-is-credit-building-loan',
      question: 'Credit-Building Loan คืออะไร?',
      answer: `Credit-Building Loan คือเงินกู้ที่คุณใช้เพื่อเพิ่มวงเงินเครดิตบน Moodeng โดยต้องเป็นเงินกู้เต็มวงเงิน Credit Level ปัจจุบัน ไม่ต่ำกว่านั้น

เช่น คุณเริ่มที่ Level 1 วงเงิน $15 ยืมเต็ม $15 และชำระคืนตรงเวลา วงเงินจะเพิ่มเป็น $20 ครั้งต่อไปยืมเต็ม $20 และชำระคืน ก็จะปลดล็อก $40 แล้วต่อไปเป็น $60

เงินกู้ที่ต่ำกว่าเต็มวงเงินเรียกว่า Trust-Building Loan ซึ่งช่วยสร้างประวัติการชำระและชื่อเสียง แต่ไม่เพิ่ม Credit Level`
   },
   {
      id: 'small-loan',
      question: 'ฉันขอเงินกู้ขนาดเล็กกับ Moodeng ได้ไหม?',
      answer: `ได้ เงินกู้ขนาดเล็กคือสิ่งที่ Moodeng สร้างมาเพื่อทำ ผู้ยืมใหม่เริ่มด้วยวงเงิน $15 และแพลตฟอร์มออกแบบมาสำหรับเงินกู้ระยะสั้นจำนวนไม่สูง เช่น เงินฉุกเฉินหรือค่าใช้จ่ายครั้งเดียว

ไม่มีขั้นต่ำ ไม่มีค่าสมัครรายเดือน ไม่มีค่าเริ่มต้น และไม่มีค่าธรรมเนียม คุณขอเท่าที่ต้องการภายในวงเงิน กำหนดวันชำระคืนและอัตราดอกเบี้ย แล้วผู้ให้กู้จะตัดสินใจว่าจะให้ทุนหรือไม่`
   }
];

const VIETNAMESE_FAQS: FAQItem[] = [
   {
      id: 'what-is-moodeng-credit',
      question: 'Moodeng Credit là gì?',
      answer: `Moodeng Credit là nền tảng vay cho phép bạn yêu cầu các khoản vay ngắn hạn bằng USDC đồng thời xây dựng Trust Score gắn với ví của bạn.

Thay vì tập trung vào điểm tín dụng truyền thống, Moodeng giúp bạn xây dựng niềm tin qua việc vay có trách nhiệm và trả đúng hạn. Theo thời gian, niềm tin này giúp bạn mở khóa Credit Level cao hơn và yêu cầu khoản vay lớn hơn.

Trust Score của bạn không bị khóa trong một ứng dụng. Nó phản ánh độ tin cậy và giúp bạn xây dựng uy tín có thể mang theo.`
   },
   {
      id: 'how-does-borrowing-work',
      question: 'Việc vay trên Moodeng hoạt động như thế nào?',
      answer: `Bạn đăng một yêu cầu vay từ Bảng yêu cầu với số tiền mong muốn, trong hạn mức hiện tại, ngày trả, lãi suất và lý do vay.

Người cho vay xem các yêu cầu đang mở và chọn khoản muốn cấp vốn. Khi được cấp vốn, USDC được chuyển thẳng vào ví của bạn. Bạn trả lại vào hoặc trước ngày đã thỏa thuận từ bất kỳ ví nào có USDC.`
   },
   {
      id: 'what-is-a-trust-score',
      question: 'Trust Score là gì và được tính như thế nào?',
      answer: `Trust Score là tín hiệu uy tín cho thấy bạn trả khoản vay đáng tin cậy đến mức nào.

Điểm tăng khi bạn trả đủ và đúng hạn, và giảm khi trả muộn hoặc vỡ nợ. Người cho vay dùng điểm này để đánh giá rủi ro trước khi cấp vốn cho yêu cầu của bạn.`
   },
   {
      id: 'what-is-a-credit-level',
      question: 'Credit Level là gì?',
      answer: `Credit Level kiểm soát số tiền bạn có thể vay trong một lần.

Bạn bắt đầu ở Level 1 với hạn mức $15. Mỗi lần trả đủ một Credit-Building Loan sẽ tăng hạn mức và mở khóa cấp tiếp theo: $15 -> $20 -> $40 -> $60, và tiếp tục.`
   },
   {
      id: 'what-is-a-base-wallet',
      question: 'Base wallet là gì?',
      answer: `Base là mạng blockchain Layer 2 do Coinbase xây dựng cho giao dịch crypto nhanh, rẻ và an toàn. "Base wallet" là bất kỳ ví nào có thể giữ và gửi tiền trên mạng Base, phổ biến nhất là Coinbase Smart Wallet.

Moodeng dùng Base wallet vì giao dịch USDC trên Base với Coinbase Smart Wallet không tốn gas. Khi bạn nhận khoản vay, toàn bộ số tiền vào ví của bạn. Khi bạn trả, người cho vay nhận đủ số tiền.

Người vay trên Moodeng phải dùng Coinbase Smart Wallet trên Base. Người cho vay linh hoạt hơn, nhưng chúng tôi vẫn khuyến nghị cùng cách thiết lập để giao dịch không tốn gas.`
   },
   {
      id: 'what-is-usdc',
      question: 'USDC là gì và vì sao Moodeng dùng nó?',
      answer: `USDC là stablecoin neo 1:1 với đô la Mỹ, do Circle phát hành. Một USDC luôn bằng một đô la, nên giá trị khoản vay trên Moodeng không biến động theo thị trường crypto.

Moodeng dùng USDC vì nó chuyển toàn cầu nhanh, được các sàn lớn hỗ trợ, có thể đổi sang tiền địa phương và không tốn gas khi dùng trên Base. Bạn có thể nhận, giữ, dùng on-chain hoặc rút ra tiền pháp định theo lựa chọn của mình.`
   },
   {
      id: 'does-moodeng-charge-fees',
      question: 'Moodeng có tính phí không?',
      answer: `Không. Moodeng Credit miễn phí sử dụng. Không có phí nền tảng khi vay, không có phí khi cho vay, không có gói tháng và không có phí thiết lập. 100% tiền người cho vay cấp đến người vay, và 100% tiền trả lại đến người cho vay.

Phí mạng hoặc gas cũng bằng 0 khi bạn dùng Coinbase Smart Wallet trên Base. Chi phí duy nhất là lãi suất người vay tự đề xuất, và phần đó thuộc hoàn toàn về người cho vay.`
   },
   {
      id: 'fight-loan-sharks',
      question: 'Moodeng giúp chống cho vay nặng lãi như thế nào?',
      answer: `Cho vay nặng lãi là vấn đề toàn cầu: lãi tuần rất cao, đe dọa người vay và khiến người ta mắc kẹt trong vòng xoáy nợ. Nhiều người không có tài khoản ngân hàng hoặc thiếu dịch vụ tài chính không còn lựa chọn nào khác khi cần tiền khẩn cấp.

Moodeng Credit là một lựa chọn công bằng hơn. Lãi suất do người vay đặt và người cho vay chấp nhận trong một thị trường minh bạch. Không có phí ẩn, không có trò lãi chồng lãi, và các khoản vay nhỏ ban đầu phù hợp nhu cầu ngắn hạn trong khi hệ thống xây dựng tín dụng tăng hạn mức khi bạn chứng minh độ tin cậy.`
   },
   {
      id: 'what-is-credit-building-loan',
      question: 'Credit-Building Loan là gì?',
      answer: `Credit-Building Loan là khoản vay bạn dùng để tăng hạn mức tín dụng trên Moodeng. Để được tính là loại này, khoản vay phải bằng toàn bộ hạn mức Credit Level hiện tại, không thấp hơn.

Bạn bắt đầu ở Credit Level 1 với hạn mức $15. Vay đủ $15 và trả đúng hạn, hạn mức tăng lên $20. Lần sau vay đủ $20 và trả, bạn mở khóa $40, rồi $60.

Các khoản vay nhỏ hơn hạn mức được gọi là Trust-Building Loan. Chúng vẫn giúp xây dựng lịch sử trả và uy tín, nhưng không tăng Credit Level.`
   },
   {
      id: 'small-loan',
      question: 'Tôi có thể vay khoản nhỏ với Moodeng không?',
      answer: `Có. Khoản vay nhỏ chính là điều Moodeng được xây dựng để hỗ trợ. Người vay mới bắt đầu với hạn mức $15, và nền tảng được thiết kế cho vay ngắn hạn, số tiền nhỏ: tiền khẩn cấp, bắc cầu trước ngày lương, hoặc chi phí một lần.

Không có số tiền tối thiểu, không có phí tháng, không có phí thiết lập và không có phí nền tảng. Bạn yêu cầu số tiền cần vay trong hạn mức hiện tại, đặt ngày trả và lãi suất, rồi người cho vay quyết định có cấp vốn hay không.`
   }
];

export function getFaqsForLocale(locale: string): FAQItem[] {
   if (locale === 'fil') return FILIPINO_FAQS;
   if (locale === 'id') return INDONESIAN_FAQS;
   if (locale === 'th') return THAI_FAQS;
   if (locale === 'vi') return VIETNAMESE_FAQS;
   return FAQS;
}
