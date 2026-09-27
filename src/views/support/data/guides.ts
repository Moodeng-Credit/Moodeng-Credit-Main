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

Most borrowers use both — trust loans to keep activity healthy, credit loans to grow their limit over time.`
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
      title: 'Paano mag-request ng unang loan mo',
      lastUpdated: 'Hunyo 9, 2026',
      body: `Sundin ang mga simpleng hakbang na ito para masimulan ang unang loan request mo sa Moodeng Credit. Puwede mo ring panoorin ang video walkthrough ng prosesong ito dito: https://youtube.com/shorts/fKpBC9zD6Hk?si=KoU6NRuIguzLw-Hh.

Step 1: Gumawa ng account
Mag-register sa Moodeng gamit ang gusto mong username, email, at password. I-tap ang "Gumawa ng Account" para magpatuloy.

Step 2: Simulan ang loan application
Kapag naka-log in ka na, i-tap ang button na "Mag-apply ng loan" para simulan ang proseso.

Step 3: I-set up ang wallet mo
Kailangan ng wallet para sa mga secure na transaksyon sa Moodeng. Bilang default, Moodeng Instant Wallet ang gagamitin mo — ginagawa ito mula sa Moodeng login mo, walang hiwalay na app o seed phrase. Kung mas gusto mo, puwede kang gumamit ng Base Account sa halip: pumunta sa https://account.base.app at sundin ang instructions sa pag-register.

Step 4: Ikonekta ang wallet mo
Bumalik sa Moodeng at i-tap ang "Ikonekta ang wallet" para magawa ang Instant Wallet mo — o para ligtas na ma-link ang Base Account mo kung iyon ang pinili mo — para nakatali ito sa Moodeng account mo.

Step 5: I-verify ang identity mo
Para mapanatiling ligtas ang community, i-tap ang "Verify Yourself" at kumpletuhin ang mabilis na ID + selfie check ("Verify Your ID") — mga 3 minuto lang ito. Gumagamit ka na ng World App? Puwede mong piliin ang "Verify with World ID" sa halip.

Step 6: I-submit ang request mo
I-tap ang "I-explore ang Request Board" para itakda ang loan terms mo. Kailangan mong ilagay ang:
- Halaga ng loan na gusto mo.
- Halagang babayaran at petsa ng pagbabayad.
- Malinaw na dahilan ng paghiram mo, para makatulong na bumuo ng tiwala sa mga posibleng lender.`
   },
   'understanding-your-trust-score': {
      title: 'Pag-unawa sa Pandesal points mo',
      lastUpdated: 'Hunyo 9, 2026',
      body: `Ipinapakita ng Pandesal points mo kung gaano ka maaasahan sa pagbabayad ng mga loan sa Moodeng Credit.

Tumataas ito sa bawat on-time na bayad at bumababa kapag may hindi ka nabayaran o nag-default ka. Ginagamit ito ng mga lender bilang mabilis na senyales para magpasya kung popondohan nila ang request mo.

Dahil nakatali sa wallet mo ang Pandesal points mo, dala mo ito kahit saan — hindi ito nakakulong sa iisang app.`
   },
   'how-credit-levels-work': {
      title: 'Paano gumagana ang Credit Levels',
      lastUpdated: 'Hunyo 9, 2026',
      body: `Tinutukoy ng Credit Level mo kung magkano ang puwede mong hiramin sa isang pagkakataon.

Lahat nagsisimula sa Level 1 na may $15 limit. Habang humihiram ka at nagbabayad nang buo, lumalaki ang limit mo — $15 → $20 → $40 → $60 → $80 → $100 → $120 → $140 — at nag-a-unlock ka ng mga bagong level.

Aakyat ka lang ng level kapag nakumpleto mo ang isang Credit-Building Loan: loan na katumbas ng buong current limit mo, na binayaran nang buo at on time.`
   },
   'trust-building-vs-credit-building-loans': {
      title: 'Trust-Building vs Credit-Building loans',
      lastUpdated: 'Hunyo 9, 2026',
      body: `May dalawang uri ng loan sa Moodeng Credit:

Ang Trust-Building Loans ay mas maliliit na loan na mas mababa sa current limit mo. Tinutulungan ka nitong ipakita na maaasahan ka sa pagbabayad, pero hindi nito tinataas ang limit mo.

Ang Credit-Building Loans ay mga loan na katumbas ng buong limit mo. Kapag nabayaran mo ang isa nang on time, tataas ang limit mo at maa-unlock ang susunod na Credit Level.

Karamihan ng mga borrower ay gumagamit ng dalawa — Trust-Building Loans para manatiling healthy ang activity nila, at Credit-Building Loans para unti-unting palakihin ang limit nila.`
   },
   'how-repayments-affect-your-trust-score': {
      title: 'Paano naaapektuhan ng pagbabayad ang Pandesal points mo',
      lastUpdated: 'Hunyo 9, 2026',
      body: `Bawat bayad para sa Credit-Building o Trust-Building loan ay direktang nakakaapekto sa Pandesal points mo, na nagsisilbing reputasyon mo sa platform. Ginawa ang system namin para i-reward ang tuloy-tuloy, maaasahan, at tapat na pag-uugali; mas mahalaga para sa reputasyon mo ang maliliit na loan na malinis ang pagbabayad kaysa sa malalaking loan na palpak ang pagbabayad.

Scoring breakdown

- On-time at buong bayad: Kapag nabayaran mo nang 100% sa o bago ang due date, makukuha mo ang maximum (10 points).

- Partial na bayad: Kapag hindi mo nabayaran ang buong halaga, nababawasan ang points mo ayon sa proporsyon — 75% = 7 points · 50% = 5 points · 25% = 3 points.

- Late na bayad: Anumang bayad na natanggap pagkatapos ng napagkasunduang deadline ay 0 points para sa transaksyong iyon.

- Default: Nag-iiwan ang hindi nabayarang loan ng permanenteng marka sa profile mo na makikita ng lahat ng susunod na lender.`
   },
   'what-happens-when-you-repay-a-loan-on-time': {
      title: 'Mga benepisyo ng on-time na pagbabayad',
      lastUpdated: 'Hunyo 9, 2026',
      body: `Ang pagbabayad sa o bago ang nakatakdang deadline ang pinakaepektibong paraan para palakasin ang standing mo sa Moodeng Credit. Kinukumpirma on-chain ang lahat ng bayad; kapag na-settle na ang USDC transfer, awtomatikong maa-update ang status ng loan mo sa "Successfully Repaid."

Kapag nagbayad ka on time, ito ang mga benepisyong makukuha ng profile mo:

- Mas maraming Pandesal points: Tumataas ang Pandesal points mo para sa Credit-Building o Trust-Building loan, na nagpapakita sa community na maaasahan ka.
- Pagtaas ng credit limit: Para sa Credit-Building loans, tataas ang current borrowing limit mo at maa-unlock ang susunod na Credit Level (halimbawa, mula $15 → $20).
- Verified na lending history: Makikita ng mga posibleng lender ang matagumpay mong repayment history, kaya mas mabilis mapondohan ang mga susunod mong request.

Repayment scoring breakdown

Ipinapakita ng Pandesal points mo kung gaano ka maaasahan, at ito ang nagtatakda kung gaano kadaling mapondohan ang mga susunod mong request:

- On-time at buong bayad: Makukuha mo ang maximum na 10 points.
- Partial na bayad: Nababawasan ang points mo ayon sa proporsyon ng halagang nabayaran (halimbawa, 75% = 7 points; 50% = 5 points).
- Late na bayad: Anumang bayad pagkatapos ng deadline ay 0 points, kahit magkano pa ang halaga.
- Default: Mag-iiwan ang hindi nabayarang loan ng permanenteng marka sa public on-chain profile mo.`
   },
   'repaying-your-loan': {
      title: 'Mga paraan ng pagbabayad ng loan mo',
      lastUpdated: 'Hulyo 3, 2026',
      body: `Para magbayad, ipadala ang kailangang halaga ng USDC sa repayment address na makikita sa Moodeng (ipinapakita ng Magbayad screen ang eksaktong halaga, at doon mo rin makokopya ang address). Puwede kang magpadala mula sa wallet, exchange, P2P platform, o local crypto service — kung ano ang available sa bansa mo.

Pagpapadala mula sa wallet
Kung may USDC ka na sa kahit anong wallet, ipadala ang halaga ng bayad sa address na nakalagay sa Moodeng. Siguraduhing Base ang network.

Pagpapadala mula sa exchange
I-withdraw ang USDC mula sa exchange account mo diretso sa repayment address. Piliin ang USDC at piliin ang Base bilang network.

Bumili muna ng USDC, saka magbayad
Kung wala ka pang USDC, bumili muna at ipadala ito sa wallet mo, saka magbayad mula roon:
- Binance P2P: bumili ng USDC gamit ang local currency mula sa ibang user, tapos i-withdraw sa Base network.
- Coins.ph: bumili ng USDC gamit ang PHP, tapos gamitin ang Send Crypto → External Wallet → Base network.
- GCrypto (GCash): kung naka-enable ang crypto sa GCash app mo, bumili ng USDC at i-withdraw gamit ang USDCBASE.
- PDAX: bumili ng USDC gamit ang PHP at i-withdraw sa wallet mo sa Base.
- Moneybees (external na opsyon): over-the-counter service na ginagamit ng ilang user para bumili ng crypto sa sariling proseso ng Moneybees. Sundin nang direkta ang instructions nila sa https://www.moneybees.ph/.

Ang pinakamahalaga: laging piliin ang Base bilang network kapag nagpapadala ng USDC. Kapag mali ang network, puwedeng mawala ang pera mo.`
   },
   'adding-funds-to-your-wallet': {
      title: 'Mga paraan para magdagdag ng USDC sa wallet mo',
      lastUpdated: 'Hulyo 3, 2026',
      body: `Gumagana ang Moodeng wallet mo gamit ang USDC sa Base network. Bukod sa mga opsyon sa loob ng app (pagbili gamit ang card at pag-bridge mula sa ibang chain), ito ang mga karaniwang paraan para makapaglagay ng USDC sa wallet mo:

Bumili sa exchange
Bumili ng USDC sa exchange na ginagamit mo na, tapos i-withdraw ito sa wallet address mo. Laging piliin ang USDC at ang Base network kapag nagwi-withdraw.

Binance P2P
Bumili ng USDC gamit ang local currency diretso mula sa ibang user, tapos i-withdraw sa Base network.

Mga serbisyo sa Pilipinas
- Coins.ph: bumili ng USDC gamit ang PHP, tapos Send Crypto → External Wallet → Base network.
- PDAX: bumili ng USDC gamit ang PHP at i-withdraw sa wallet mo sa Base.
- GCrypto (GCash): kung naka-enable ang crypto sa GCash app mo, bumili at i-withdraw gamit ang USDCBASE.

Moneybees (external na opsyon)
Ang Moneybees ay external na over-the-counter service na ginagamit ng ilang user para bumili ng crypto sa sariling proseso ng Moneybees. Kailangan mong sundin nang direkta ang instructions ng Moneybees sa https://www.moneybees.ph/.

Magpadala mula sa ibang wallet
Kung may USDC ka sa ibang wallet, ipadala ito sa Moodeng wallet address mo — sa Base network.

Ang pinakamahalaga: laging piliin ang Base bilang network. Kapag mali ang network na ginamit sa pagpapadala, puwedeng mawala ang pera mo.`
   },
   'withdrawing-to-your-bank': {
      title: 'Pag-withdraw ng pera mo papunta sa bank account',
      lastUpdated: 'Hulyo 3, 2026',
      body: `Puwede kang mag-withdraw sa pamamagitan ng pagpapadala ng USDC mo sa isang supported na exchange o serbisyo, pagbebenta nito roon, at paglilipat ng local currency sa bank account mo.

Video walkthrough — pagpapadala ng USDC mula sa Base Account mo papunta sa Binance: https://www.youtube.com/watch?v=Bqc2u3utbwc

Mga karaniwang opsyon:

Binance P2P
Ipadala ang USDC sa Binance account mo (laging piliin ang Base network), tapos ibenta ito sa Binance P2P at matanggap ang local currency diretso sa bank o e-wallet mo.

PDAX
Isang Philippine exchange na regulated ng BSP. Mag-deposit ng USDC, ibenta ito para sa PHP, at i-withdraw sa bank account mo.

Coins.ph
Mag-deposit ng USDC, i-convert sa PHP, at i-cash out sa bank o GCash mo.

GCrypto (GCash)
Kung naka-enable ang crypto sa GCash app mo, puwede kang tumanggap ng supported na crypto at i-convert ito sa loob ng GCash.

Moneybees (external na opsyon)
Ang Moneybees ay external na over-the-counter service na ginagamit ng ilang user para bumili o magbenta ng crypto sa sariling proseso ng Moneybees. Kailangan mong sundin nang direkta ang instructions ng Moneybees sa https://www.moneybees.ph/.

Ibang wallet o exchange
Puwede ka ring magpadala ng USDC sa kahit anong wallet o exchange na ginagamit mo na — siguraduhin lang na sinusuportahan nito ang USDC sa Base network bago ka magpadala.

Ang pinakamahalaga: laging piliin ang Base bilang network kapag nagde-deposit sa exchange. Kapag mali ang network, puwedeng mawala ang pera mo.`
   },
   'using-usdc-on-moodeng-credit': {
      title: 'Paggamit ng USDC sa Moodeng Credit',
      lastUpdated: 'Hunyo 9, 2026',
      body: `Lahat ng loan sa Moodeng Credit ay nasa USDC — isang regulated stablecoin na naka-peg 1:1 sa US dollar.

Dahil USDC ang gamit, hindi nagbabago ang halaga ng loan. Ang $20 loan ngayon ay $20 loan pa rin kapag binayaran mo ito, kahit gumalaw pa ang crypto market.

Tumatakbo sa Base ang Instant Wallet mo (o ang Base Account mo, kung iyon ang gusto mo), kung saan gasless ang USDC transfers — wala kang babayarang network fees.`
   },
   'verification-and-why-its-required': {
      title: 'Verification at seguridad',
      lastUpdated: 'Hunyo 9, 2026',
      body: `Para mapanatiling ligtas at patas ang Moodeng, lahat ng borrower ay dumadaan sa maikli at one-time na identity verification. Pinoprotektahan nito ang community laban sa mga peke at duplicate na account, at ito ang dahilan kung bakit napagkakatiwalaan ng mga lender ang mga request na pinopondohan nila.

Bakit kailangan mag-verify?
- Seguridad: sinisiguro na galing sa totoo at iisang tao ang bawat request, para maiwasan ang fraud.
- Access: kapag tapos na ang verification, puwede ka nang mag-request ng loan at magsisimula na ang Pandesal points mo.

Ang inirerekomendang paraan: Verify Your ID
1. I-tap ang "Verify Yourself" sa app at piliin ang "Verify Your ID".
2. Ihanda ang physical na national ID mo at pumuwesto sa lugar na maliwanag at pantay ang ilaw.
3. Kumpletuhin ang mabilis na ID photo + selfie check — mga 3 minuto lang ito.
4. Karamihan ng checks ay natatapos sa loob ng ilang minuto. Kung kailangan ng review ng tao, aabisuhan ka namin agad kapag tapos na ito (kadalasan sa loob ng ilang oras, pinakamatagal na ang 1 business day).

Sinusuri ang ID mo ng secure na verification partner namin, at hindi ito kailanman iniimbak ng Moodeng.

Alternatibo: Verify with World ID
Kung gumagamit ka na ng World App — na-verify nang personal sa isang Orb o gamit ang biometric passport — puwede mong piliin ang "Verify with World ID" sa halip at kumpirmahin ito sa World App.`
   },
   'managing-your-account-and-security-settings': {
      title: 'Pag-manage ng account at mga security setting mo',
      lastUpdated: 'Hunyo 9, 2026',
      body: `Nakatali ang account mo sa wallet mo, kaya ang seguridad ng wallet mo ay seguridad din ng account mo.

Sa Account screen, puwede mong i-update ang display name mo, i-manage ang email mo, palitan ang password mo, at mag-sign out.`
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

Langkah 3: Siapkan wallet
Transaksi aman di Moodeng membutuhkan wallet. Secara default, kamu memakai Instant Wallet Moodeng — dibuat dari login Moodeng kamu, tanpa aplikasi terpisah atau seed phrase. Jika lebih suka, kamu bisa memakai Base Account: kunjungi https://account.base.app dan ikuti instruksi pendaftaran.


Langkah 4: Hubungkan wallet
Kembali ke platform Moodeng dan tap "Connect Wallet" untuk membuat Instant Wallet kamu — atau menautkan Base Account dengan aman jika kamu memilihnya — ke akun Moodeng.

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
- Credit-building loans: Ini adalah pinjaman full-limit yang memakai seluruh credit limit saat ini, misalnya meminta penuh $15. Membayar pinjaman jenis ini dengan sukses adalah satu-satunya cara menaikkan limit ke level berikutnya, misalnya $15 -> $20 -> $40 -> $60 -> $80 -> $100 -> $120 -> $140 dan seterusnya. Kamu hanya boleh memiliki satu permintaan credit-building loan aktif dalam satu waktu.
- Trust-building loans: Ini adalah pinjaman lebih kecil di bawah credit limit saat ini. Pinjaman ini membangun poin Pandesal dengan pemberi pinjaman, tetapi tidak menaikkan credit limit keseluruhan. Kamu boleh memiliki beberapa trust-building loan aktif selama totalnya tetap di bawah limit saat ini.
- Membuka level berikutnya: Untuk naik level, kamu harus meminjam dan membayar penuh seluruh limit. Misalnya, jika limit kamu $15 dan kamu hanya meminta trust-building loan $12 lalu membayar $15, limit kamu tidak naik. Kamu harus meminjam penuh $15 dan membayar total yang disepakati, termasuk bunga kecil atau tambahan pembayaran yang kamu tawarkan dan diterima pemberi pinjaman.`
   },
   'understanding-your-trust-score': {
      title: 'Memahami poin Pandesal kamu',
      lastUpdated: 'Jun 9, 2026',
      body: `Poin Pandesal menunjukkan seberapa andal kamu membayar pinjaman di Moodeng Credit.

Skor ini naik setiap kali kamu membayar tepat waktu dan turun saat kamu terlambat atau gagal bayar. Pemberi pinjaman memakai skor ini sebagai sinyal cepat untuk memutuskan apakah mereka ingin mendanai permintaan kamu.

Karena poin Pandesal tertaut ke wallet, poin ini ikut bersama kamu. Poin ini tidak terkunci di satu app saja.`
   },
   'how-credit-levels-work': {
      title: 'Cara kerja level kredit',
      lastUpdated: 'Jun 9, 2026',
      body: `Level kredit menentukan berapa banyak yang bisa kamu pinjam dalam satu waktu.

Semua orang mulai di Level 1 dengan limit $15. Saat kamu meminjam dan membayar penuh, limit kamu bertambah: $15 -> $20 -> $40 -> $60 -> $80 -> $100 -> $120 -> $140, dan membuka level baru.

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
      title: 'Bagaimana pembayaran memengaruhi poin Pandesal',
      lastUpdated: 'Jun 9, 2026',
      body: `Setiap pembayaran untuk Credit-building atau Trust-building loans langsung memengaruhi poin Pandesal, yaitu reputasi kamu di platform. Sistem kami dirancang untuk memberi reward pada perilaku yang konsisten, andal, dan jujur. Pinjaman kecil yang dibayar rapi lebih bernilai untuk reputasi daripada pinjaman besar yang dibayar berantakan.

Rincian skor

- Pembayaran penuh tepat waktu: Menyelesaikan 100% pembayaran pada atau sebelum jatuh tempo memaksimalkan poin kamu (10 poin).

- Pembayaran sebagian: Jika jumlah penuh tidak dibayar, poin berkurang secara proporsional — 75% = 7 poin · 50% = 5 poin · 25% = 3 poin.

- Pembayaran terlambat: Pembayaran apa pun yang diterima setelah deadline yang disepakati menghasilkan 0 poin untuk transaksi itu.

- Gagal bayar: Pinjaman yang tidak dibayar meninggalkan tanda permanen di profil yang terlihat oleh semua pemberi pinjaman berikutnya.`
   },
   'what-happens-when-you-repay-a-loan-on-time': {
      title: 'Manfaat pembayaran tepat waktu',
      lastUpdated: 'Jun 9, 2026',
      body: `Mengirim pembayaran pada atau sebelum deadline adalah cara paling efektif untuk memperkuat posisi kamu di ekosistem Moodeng Credit. Semua pembayaran dikonfirmasi on-chain; setelah transfer USDC selesai, status pinjaman otomatis diperbarui menjadi "Successfully Repaid."

Saat kamu membayar tepat waktu, manfaat berikut diterapkan ke profil kamu:

- Poin Pandesal bertambah: Poin Pandesal kamu naik untuk Credit-building atau Trust-building loans, mencerminkan keandalan kamu kepada komunitas.
- Progression credit limit: Untuk Credit-building loans, limit pinjaman saat ini naik dan membuka credit level berikutnya, misalnya dari $15 ke $20.
- Riwayat pembayaran terverifikasi: Riwayat pembayaran sukses kamu terlihat oleh calon pemberi pinjaman, sehingga proses pendanaan permintaan berikutnya menjadi lebih mudah.

Rincian skor pembayaran

Poin Pandesal mencerminkan keandalan kamu dan menentukan peluang pendanaan ke depan:

- Pembayaran penuh tepat waktu: Mendapat maksimum 10 poin.
- Pembayaran sebagian: Poin berkurang proporsional berdasarkan jumlah yang dibayar, misalnya 75% = 7 poin; 50% = 5 poin.
- Pembayaran terlambat: Pembayaran setelah deadline menghasilkan 0 poin, berapa pun jumlahnya.
- Gagal bayar: Pinjaman yang tidak dibayar menghasilkan tanda permanen di profil on-chain publik kamu.`
   },
   'using-usdc-on-moodeng-credit': {
      title: 'Menggunakan USDC di Moodeng Credit',
      lastUpdated: 'Jun 9, 2026',
      body: `Semua pinjaman di Moodeng Credit memakai USDC, stablecoin teregulasi yang dipatok 1:1 ke dolar AS.

Dengan USDC, nilai pinjaman tetap konsisten. Pinjaman $20 hari ini tetap pinjaman $20 saat kamu membayarnya, terlepas dari pergerakan pasar kripto.

Instant Wallet kamu (atau Base Account, jika kamu memilihnya) berjalan di Base, tempat transfer USDC gasless sehingga kamu tidak membayar biaya jaringan.`
   },
   'verification-and-why-its-required': {
      title: 'Verifikasi dan keamanan',
      lastUpdated: 'Jun 9, 2026',
      body: `Untuk menjaga lingkungan yang aman dan adil, Moodeng Credit mewajibkan semua peminjam memverifikasi identitas manusia unik mereka lewat World ID. Proses ini melindungi komunitas dari bot otomatis dan akun duplikat tanpa meminta kamu mengunggah dokumen pribadi sensitif.

Mengapa perlu verifikasi?
- Keamanan: Memastikan setiap permintaan berasal dari orang sungguhan dan membantu mencegah penipuan.

- Reward: Pengguna baru bisa mengklaim sekitar $10 dalam reward Worldcoin setelah verifikasi berhasil.

- Akses: Verifikasi selesai memungkinkan kamu mengajukan pinjaman dan mulai membangun poin Pandesal.

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

ขั้นตอนที่ 3: ตั้งค่ากระเป๋า
ธุรกรรมบน Moodeng ต้องใช้กระเป๋า โดยค่าเริ่มต้นคุณจะใช้ Instant Wallet ของ Moodeng ซึ่งสร้างจากการเข้าสู่ระบบ Moodeng ของคุณ ไม่ต้องใช้แอปแยกหรือ seed phrase หากต้องการ คุณสามารถใช้ Base Account แทนได้ โดยไปที่ https://account.base.app และทำตามคำแนะนำ

ขั้นตอนที่ 4: เชื่อมต่อกระเป๋า
กลับมาที่ Moodeng แล้วแตะ "Connect Wallet" เพื่อสร้าง Instant Wallet หรือเชื่อม Base Account หากคุณเลือกใช้ กับบัญชี Moodeng

ขั้นตอนที่ 5: ยืนยันตัวตน
ดาวน์โหลด World App และยืนยันตัวตนมนุษย์ที่ World Orb จริง

ขั้นตอนที่ 6: เชื่อม World ID
หลังยืนยันที่ Orb แล้วกลับมาที่ Moodeng แตะ "Verify with World ID" และสแกน QR code

ขั้นตอนที่ 7: ส่งคำขอ
แตะ "Explore the Request Board" และกำหนดจำนวนเงิน วันที่ชำระคืน จำนวนที่ชำระคืน และเหตุผลในการยืม

หมายเหตุเกี่ยวกับวงเงินเครดิต
- ผู้ยืมใหม่เริ่มที่วงเงิน $15
- Credit-Building Loan คือเงินกู้เต็มวงเงินปัจจุบัน การชำระคืนสำเร็จเท่านั้นที่เพิ่มวงเงินไปยังระดับถัดไป
- Trust-Building Loan คือเงินกู้ที่ต่ำกว่าวงเงิน ช่วยสร้าง แต้ม Pandesal แต่ไม่เพิ่มระดับเครดิต`
   },
   'understanding-your-trust-score': {
      title: 'ทำความเข้าใจ แต้ม Pandesal',
      lastUpdated: 'Jun 9, 2026',
      body: `แต้ม Pandesal แสดงว่าคุณชำระเงินกู้บน Moodeng Credit ได้สม่ำเสมอแค่ไหน

คะแนนจะเพิ่มขึ้นเมื่อชำระตรงเวลา และลดลงเมื่อชำระล่าช้าหรือผิดนัด ผู้ให้กู้ใช้คะแนนนี้เป็นสัญญาณเร็ว ๆ ในการตัดสินใจว่าจะให้ทุนคำขอของคุณหรือไม่

เพราะ แต้ม Pandesal ผูกกับกระเป๋าเงิน มันจึงติดตามคุณไปได้ ไม่ได้อยู่แค่ในแอปเดียว`
   },
   'how-credit-levels-work': {
      title: 'ระดับเครดิตทำงานอย่างไร',
      lastUpdated: 'Jun 9, 2026',
      body: `ระดับเครดิตกำหนดว่าคุณสามารถยืมได้มากแค่ไหนในแต่ละครั้ง

ทุกคนเริ่มที่ Level 1 พร้อมวงเงิน $15 เมื่อคุณยืมและชำระคืนครบถ้วน วงเงินจะเพิ่มขึ้น: $15 → $20 → $40 → $60 → $80 → $100 → $120 → $140 และปลดล็อกระดับใหม่

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
      title: 'การชำระคืนมีผลต่อ แต้ม Pandesal อย่างไร',
      lastUpdated: 'Jun 9, 2026',
      body: `การชำระคืนของ Credit-Building หรือ Trust-Building Loan มีผลโดยตรงต่อ แต้ม Pandesal ซึ่งเป็นชื่อเสียงของคุณบนแพลตฟอร์ม

ชำระเต็มจำนวนตรงเวลาจะได้คะแนนสูงสุด การชำระบางส่วนจะลดคะแนนตามสัดส่วน การชำระล่าช้าได้ 0 แต้ม สำหรับธุรกรรมนั้น และการผิดนัดจะทิ้งเครื่องหมายถาวรบนโปรไฟล์ที่ผู้ให้กู้ในอนาคตเห็นได้`
   },
   'what-happens-when-you-repay-a-loan-on-time': {
      title: 'ประโยชน์ของการชำระตรงเวลา',
      lastUpdated: 'Jun 9, 2026',
      body: `การชำระในหรือก่อนกำหนดเป็นวิธีที่ดีที่สุดในการเสริมสถานะของคุณในระบบ Moodeng Credit

เมื่อคุณชำระตรงเวลา แต้ม Pandesal จะเพิ่มขึ้น ประวัติการชำระที่ดีจะมองเห็นได้ต่อผู้ให้กู้ และสำหรับ Credit-Building Loan วงเงินของคุณจะเพิ่มขึ้นเพื่อปลดล็อกระดับถัดไป

การชำระทั้งหมดถูกยืนยันบนเชน เมื่อ USDC settle แล้ว สถานะเงินกู้จะอัปเดตโดยอัตโนมัติ`
   },
   'using-usdc-on-moodeng-credit': {
      title: 'การใช้ USDC บน Moodeng Credit',
      lastUpdated: 'Jun 9, 2026',
      body: `เงินกู้ทั้งหมดบน Moodeng Credit ใช้ USDC ซึ่งเป็น stablecoin ที่ผูก 1:1 กับดอลลาร์สหรัฐ

การใช้ USDC ทำให้มูลค่าเงินกู้คงที่ เงินกู้ $20 วันนี้ยังเป็น $20 เมื่อคุณชำระคืน ไม่ขึ้นอยู่กับความผันผวนของตลาดคริปโต

Instant Wallet ของคุณ (หรือ Base Account หากคุณเลือกใช้) ทำงานบน Base ซึ่งการโอน USDC ไม่มีค่า gas`
   },
   'verification-and-why-its-required': {
      title: 'การยืนยันและความปลอดภัย',
      lastUpdated: 'Jun 9, 2026',
      body: `เพื่อให้ชุมชนปลอดภัยและเป็นธรรม Moodeng Credit กำหนดให้ผู้ยืมทุกคนยืนยันตัวตนมนุษย์ที่ไม่ซ้ำกันผ่าน World ID

ทำไมต้องยืนยัน?
- ความปลอดภัย: ทำให้ทุกคำขอมาจากคนจริงและช่วยป้องกัน fraud
- รางวัล: ผู้ใช้ใหม่อาจรับรางวัล Worldcoin ได้หลังยืนยันสำเร็จ
- การเข้าถึง: เมื่อยืนยันแล้ว คุณจึงขอเงินกู้และเริ่มสร้าง แต้ม Pandesal ได้

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

Bước 3: Thiết lập ví
Giao dịch an toàn trên Moodeng cần một ví. Mặc định, bạn dùng Instant Wallet của Moodeng — được tạo từ đăng nhập Moodeng của bạn, không cần ứng dụng riêng hay seed phrase. Nếu muốn, bạn có thể dùng Base Account: vào https://account.base.app và làm theo hướng dẫn.

Bước 4: Kết nối ví
Quay lại Moodeng và bấm "Connect Wallet" để tạo Instant Wallet — hoặc liên kết Base Account nếu bạn chọn dùng — với tài khoản Moodeng.

Bước 5: Xác minh danh tính
Tải World App và hoàn tất xác minh người thật tại địa điểm World Orb.

Bước 6: Liên kết World ID
Sau khi xác minh tại Orb, quay lại Moodeng, bấm "Verify with World ID" và quét QR code.

Bước 7: Gửi yêu cầu
Bấm "Explore the Request Board" để đặt số tiền vay, ngày trả, số tiền trả và lý do vay.

Lưu ý về hạn mức tín dụng
- Người vay mới bắt đầu với hạn mức $15.
- Credit-Building Loan là khoản vay toàn bộ hạn mức hiện tại; trả thành công là cách tăng hạn mức.
- Trust-Building Loan là khoản nhỏ hơn hạn mức; chúng xây dựng điểm Pandesal nhưng không tăng hạng tín dụng.`
   },
   'understanding-your-trust-score': {
      title: 'Hiểu điểm Pandesal của bạn',
      lastUpdated: 'Jun 9, 2026',
      body: `Điểm Pandesal phản ánh bạn trả các khoản vay trên Moodeng Credit đáng tin cậy đến mức nào.

Điểm tăng với mỗi lần trả đúng hạn và giảm khi bạn trả muộn hoặc vỡ nợ. Người cho vay dùng nó như tín hiệu nhanh để quyết định có cấp vốn cho yêu cầu của bạn không.

Vì điểm Pandesal gắn với ví của bạn, nó đi cùng bạn và không bị khóa trong một ứng dụng duy nhất.`
   },
   'how-credit-levels-work': {
      title: 'Hạng tín dụng hoạt động như thế nào',
      lastUpdated: 'Jun 9, 2026',
      body: `Hạng tín dụng xác định bạn có thể vay bao nhiêu trong một lần.

Mọi người bắt đầu ở Level 1 với hạn mức $15. Khi bạn vay và trả đầy đủ, hạn mức tăng: $15 → $20 → $40 → $60 → $80 → $100 → $120 → $140 và mở khóa cấp mới.

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
      title: 'Khoản trả ảnh hưởng điểm Pandesal như thế nào',
      lastUpdated: 'Jun 9, 2026',
      body: `Mỗi khoản trả cho Credit-Building hoặc Trust-Building Loan ảnh hưởng trực tiếp đến điểm Pandesal, tức uy tín của bạn trên nền tảng.

Trả đủ đúng hạn tối đa hóa điểm. Trả một phần làm giảm điểm theo tỷ lệ. Trả muộn nhận 0 điểm cho giao dịch đó. Vỡ nợ để lại dấu vĩnh viễn trên hồ sơ mà người cho vay tương lai có thể thấy.`
   },
   'what-happens-when-you-repay-a-loan-on-time': {
      title: 'Lợi ích của việc trả đúng hạn',
      lastUpdated: 'Jun 9, 2026',
      body: `Trả vào hoặc trước hạn là cách hiệu quả nhất để củng cố vị thế của bạn trong hệ sinh thái Moodeng Credit.

Khi bạn trả đúng hạn, điểm Pandesal tăng, lịch sử trả tốt hiển thị với người cho vay, và với Credit-Building Loan, hạn mức hiện tại tăng để mở khóa cấp tiếp theo.

Mọi khoản trả được xác nhận on-chain; khi chuyển USDC settle, trạng thái khoản vay tự động cập nhật.`
   },
   'using-usdc-on-moodeng-credit': {
      title: 'Dùng USDC trên Moodeng Credit',
      lastUpdated: 'Jun 9, 2026',
      body: `Tất cả khoản vay trên Moodeng Credit được tính bằng USDC, một stablecoin neo 1:1 với đô la Mỹ.

Dùng USDC giúp giá trị khoản vay ổn định. Khoản vay $20 hôm nay vẫn là $20 khi bạn trả, bất kể thị trường crypto biến động.

Instant Wallet của bạn (hoặc Base Account nếu bạn chọn dùng) chạy trên Base, nơi chuyển USDC không tốn gas.`
   },
   'verification-and-why-its-required': {
      title: 'Xác minh và bảo mật',
      lastUpdated: 'Jun 9, 2026',
      body: `Để giữ môi trường an toàn và công bằng, Moodeng Credit yêu cầu mọi người vay xác minh danh tính người thật duy nhất qua World ID.

Vì sao cần xác minh?
- Bảo mật: đảm bảo mỗi yêu cầu đến từ người thật và ngăn gian lận.
- Phần thưởng: người dùng mới có thể nhận phần thưởng Worldcoin sau khi xác minh thành công.
- Quyền truy cập: xác minh xong cho phép bạn yêu cầu khoản vay và bắt đầu xây dựng điểm Pandesal.

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
