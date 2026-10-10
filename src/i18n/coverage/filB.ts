// Filipino translations for on-screen English copy that has no entry in screenTranslations.ts,
// keyed by the exact English text. Loaded on demand by LocalizationDomBridge (see ./index.ts).
export const filipinoCoverageB: Record<string, string> = {
   // src/views/account/ExportInstantWalletKey.tsx
   'Export wallet key': 'I-export ang wallet key',
   'Your private key': 'Ang private key mo',
   'Anyone with this key controls your funds. Never share it or type it into any website. Moodeng will never ask for it.':
      'Kung sino man ang may hawak ng key na ito, siya ang may kontrol sa pera mo. Huwag itong ibahagi o i-type sa kahit anong website. Hinding-hindi ito hihingin ng Moodeng.',
   'Copy key': 'Kopyahin ang key',
   'Export your wallet key': 'I-export ang wallet key mo',
   'Please try again in a moment.': 'Subukan ulit maya-maya.',
   "I've saved it": 'Na-save ko na',
   'This reveals the private key to your Instant Wallet so you can import it into another wallet app like MetaMask or Trust. Make sure no one is looking at your screen.':
      'Ipapakita nito ang private key ng Instant Wallet mo para ma-import mo ito sa ibang wallet app gaya ng MetaMask o Trust. Siguraduhing walang nakatingin sa screen mo.',
   'Your face check just cleared. Tap to reveal your key.': 'Pasado na ang face check mo. I-tap para makita ang key mo.',
   "Couldn't export key": 'Hindi ma-export ang key',
   'Private key copied. Store it somewhere safe and never share it.':
      'Nakopya na ang private key. Itago ito sa ligtas na lugar at huwag itong ibahagi kahit kanino.',
   'Select the key and copy it manually.': 'Piliin ang key at kopyahin ito nang mano-mano.',
   'Revealing…': 'Ipinapakita…',
   'Reveal key': 'Ipakita ang key',

   // src/views/account/SettingsStylePreview.tsx
   'Account settings': 'Mga setting ng account',
   'Get updated with our latest news, updates and blogs': 'Makibalita sa pinakabagong balita, update, at blog namin',
   'Keep your profile and contact details up to date.': 'Panatilihing updated ang profile at contact details mo.',
   'Base Account · 0x95B6…d431': 'Base Account · 0x95B6…d431',
   'Get notified of activity going on with your account. Notifications will be sent to the email that you have provided.':
      'Makatanggap ng notification tungkol sa aktibidad sa account mo. Ipapadala ang mga notification sa email na ibinigay mo.',
   '2 of 3 preferences enabled': '2 sa 3 preference ang naka-on',
   'Account activity (on)': 'Aktibidad ng account (naka-on)',
   'Moodeng blogs (off)': 'Moodeng blogs (naka-off)',
   'Get important notifications about you or activity you’ve missed':
      'Makatanggap ng mahahalagang notification tungkol sa iyo o sa aktibidad na na-miss mo',
   'Used for account recovery and important alerts.': 'Ginagamit para sa account recovery at mahahalagang alert.',
   'Security & verification': 'Seguridad at verification',
   'Helps people recognize you': 'Para makilala ka ng ibang tao',
   'Work, income, and what you need help with': 'Trabaho, kita, at kung saan mo kailangan ng tulong',

   // src/views/account/TwoFactorSettings.tsx
   'Set up authenticator app': 'I-set up ang authenticator app',
   'Scan this QR code with Google Authenticator, Authy, or 1Password, then enter the 6-digit code it shows.':
      'I-scan ang QR code na ito gamit ang Google Authenticator, Authy, o 1Password, tapos ilagay ang 6-digit code na lalabas.',
   "Can't scan? Enter this code manually:": 'Hindi ma-scan? Ilagay nang mano-mano ang code na ito:',
   'Authenticator app': 'Authenticator app',
   Passkey: 'Passkey',
   'Failed to start setup': 'Hindi masimulan ang setup',
   'Scan with your authenticator app': 'I-scan gamit ang authenticator app mo',
   'Failed to remove': 'Hindi matanggal',
   'Failed to add passkey': 'Hindi maidagdag ang passkey',
   'Optional. Add an extra step when you sign in.': 'Optional. Magdagdag ng isa pang hakbang tuwing magsa-sign in ka.',
   'Optional. Use Face ID, Touch ID, or a security key on this device.':
      'Optional. Gumamit ng Face ID, Touch ID, o security key sa device na ito.',
   'Setting up authenticator app...': 'Sine-set up ang authenticator app...',
   '6-digit code': '6-digit code',
   'Authenticator app enabled': 'Naka-on na ang authenticator app',
   "You'll need a code from it to sign in from now on.": 'Mula ngayon, kakailanganin mo ang code mula rito para mag-sign in.',
   'Confirm and enable': 'I-confirm at i-on',
   Remove: 'Tanggalin',
   'authenticator app': 'ang authenticator app',
   passkey: 'ang passkey',
   'Remove authenticator app': 'Tanggalin ang authenticator app',
   'Remove passkey': 'Tanggalin ang passkey',
   'Removing...': 'Tinatanggal...',
   "You won't be asked for this the next time you sign in. You can set it up again anytime.":
      'Hindi na ito hihingin sa susunod mong pag-sign in. Puwede mo itong i-set up ulit kahit kailan.',
   'This removes the passkey from your account. Your password still works, and you can set one up again anytime.':
      'Tatanggalin nito ang passkey sa account mo. Gagana pa rin ang password mo, at puwede kang mag-set up ulit kahit kailan.',
   'Passkey added': 'Naidagdag na ang passkey',
   'You can now sign in with it instead of your password.': 'Puwede mo na itong gamitin sa pag-sign in imbes na password.',
   'authenticator app removed': 'Natanggal na ang authenticator app',
   'It will no longer be asked for at sign-in.': 'Hindi na ito hihingin sa pag-sign in.',
   'Passkey removed': 'Natanggal na ang passkey',
   'You can set one up again anytime.': 'Puwede kang mag-set up ulit kahit kailan.',
   'Two-factor authentication': 'Two-factor authentication',
   Enabled: 'Naka-on',
   'Not set up': 'Hindi pa naka-set up',
   'Disable authenticator app': 'I-off ang authenticator app',
   'Enable authenticator app': 'I-on ang authenticator app',
   'Waiting for your device...': 'Hinihintay ang device mo...',
   'Face ID, Touch ID, or a security key': 'Face ID, Touch ID, o security key',
   'Disable passkey': 'I-off ang passkey',
   'Enable passkey': 'I-on ang passkey',

   // src/views/account/WalletAccountInsights.tsx
   'USDC on Base': 'USDC sa Base',
   'Balance unavailable': 'Hindi makuha ang balance',
   'Some repayments go to another wallet': 'May mga bayad na napupunta sa ibang wallet',
   'View loan history': 'Tingnan ang loan history',
   'Activity unavailable': 'Hindi makuha ang aktibidad',
   'Your wallet is still connected. Try again to load recent activity.':
      'Nakakonekta pa rin ang wallet mo. Subukan ulit para ma-load ang mga huling galaw.',
   'No activity yet': 'Wala pang aktibidad',
   'Loans and repayments will appear here.': 'Dito lalabas ang mga loan at bayad.',
   'Check for on-chain transfers': 'I-check ang mga on-chain transfer',
   'On-chain transfers could not load. Confirmed loan events are shown.':
      'Hindi ma-load ang mga on-chain transfer. Ang mga confirmed na loan event lang ang ipinapakita.',
   'View all loan activity': 'Tingnan ang lahat ng aktibidad ng loan',
   'Wallet history unavailable': 'Hindi makuha ang wallet history',
   'We could not load wallets previously used with this account.':
      'Hindi namin ma-load ang mga wallet na dati nang ginamit sa account na ito.',
   Balance: 'Balance',
   'Loading USDC balance': 'Naglo-load ang USDC balance',
   'Recent activity': 'Mga huling galaw',
   'Loading recent wallet activity': 'Naglo-load ang mga huling galaw ng wallet',
   'Wallet history': 'Wallet history',
   'Loan received': 'Natanggap ang loan',
   'Loan funded': 'Napondohan ang loan',
   'Repayment sent': 'Naipadala ang bayad',
   'Repayment received': 'Natanggap ang bayad',
   'USDC sent': 'Naipadala ang USDC',
   'Show wallet history': 'Ipakita ang wallet history',
   'Hide wallet history': 'Itago ang wallet history',
   'We could not load this wallet’s USDC balance.': 'Hindi namin ma-load ang USDC balance ng wallet na ito.',
   'No USDC in this wallet on Base.': 'Walang USDC ang wallet na ito sa Base.',
   'Only this wallet’s USDC balance on Base is shown.': 'Ang USDC balance lang ng wallet na ito sa Base ang ipinapakita.',
   'will keep sending repayments to': 'ay patuloy na magpapadala ng bayad sa',
   'Wallet changed': 'Pinalitan ang wallet',
   'Wallet disconnected': 'Na-disconnect ang wallet',
   'Wallet connected': 'Nakonekta ang wallet',
   'Current wallet recorded': 'Na-record ang kasalukuyang wallet',
   'Previously used': 'Dating ginamit',

   // src/views/account/WalletBalanceCard.tsx
   'Money you receive lands here.': 'Dito napupunta ang perang natatanggap mo.',
   'Wallet details': 'Mga detalye ng wallet',

   // src/views/borrowerBenefits/BorrowerBenefits.tsx
   'Borrower Benefits | Moodeng Credit': 'Mga benepisyo ng borrower | Moodeng Credit',
   'Why borrowers choose Moodeng Credit: fast global access to small USDC loans, our mission and roadmap, and building verifiable credit as you repay.':
      'Bakit Moodeng Credit ang pinipili ng mga borrower: mabilis na access sa maliliit na USDC loan saan ka man sa mundo, ang misyon at roadmap namin, at pagbuo ng verifiable na credit habang nagbabayad ka.',

   // src/views/borrowerBenefits/sections/FastGlobalAccessSection.tsx
   'When a lender funds your request, USDC moves through your digital wallet so the money and repayment record are easier to track.':
      'Kapag pinondohan ng lender ang request mo, dumadaan ang USDC sa digital wallet mo kaya mas madaling i-track ang pera at ang record ng pagbabayad.',
   'You choose the request amount, repayment amount, due date, and reason before a lender decides whether to fund it.':
      'Ikaw ang pipili ng halaga ng request, halaga ng babayaran, due date, at dahilan bago magdesisyon ang lender kung popondohan niya ito.',

   // src/views/borrowerBenefits/sections/WhatPeopleSaySection.tsx
   'Borrower testimonial': 'Testimonial ng borrower',

   // src/views/creditLevelingGuide/CreditLevelingGuide.tsx
   'Next level': 'Susunod na level',
   'Current maximum': 'Kasalukuyang maximum',
   'Credit Leveling Guide | Moodeng Credit': 'Gabay sa Credit Leveling | Moodeng Credit',
   'How Moodeng credit levels work: repay a full-limit loan on time to unlock the next level, from $15 up to $140, plus trust-building vs credit-building loans.':
      'Paano gumagana ang Credit Level sa Moodeng: bayaran on time ang loan na katumbas ng buong limit mo para ma-unlock ang susunod na level, mula $15 hanggang $140, at ang pagkakaiba ng trust-building at credit-building loan.',
   'Main credit leveling rule': 'Pangunahing rule ng credit leveling',
   'How credit leveling works': 'Paano gumagana ang credit leveling',
   'Credit level progression': 'Pag-akyat ng Credit Level',
   'Borrow $60 and repay funded terms on time': 'Humiram ng $60 at bayaran on time ang napondohang terms',
   'Borrow $80 and repay funded terms on time': 'Humiram ng $80 at bayaran on time ang napondohang terms',
   'Borrow $100 and repay funded terms on time': 'Humiram ng $100 at bayaran on time ang napondohang terms',
   'Borrow $120 and repay funded terms on time': 'Humiram ng $120 at bayaran on time ang napondohang terms',

   // src/views/dashboard-v2/DashboardV2.tsx
   'Feed Moodeng Pandesal to grow your trust: verifying, repaying on time and milestones earn it, and Moodeng grows from Rookie to Apex.':
      'Pakainin si Moodeng ng Pandesal para lumago ang tiwala sa iyo: makakakuha ka nito sa pag-verify, sa pagbabayad on time, at sa mga milestone, at lalaki si Moodeng mula Rookie hanggang Apex.',
   'Milestones are extra ways to earn Pandesal. Complete them to strengthen your profile and make lenders more confident in your requests.':
      'Ang mga milestone ay dagdag na paraan para makakuha ng Pandesal. Tapusin ang mga ito para lumakas ang profile mo at mas magtiwala ang mga lender sa mga request mo.',
   'Post your first loan request': 'I-post ang una mong loan request',
   'Get funded by a lender': 'Mapondohan ng lender',
   'Loading your dashboard': 'Naglo-load ang Dashboard mo',
   'Trust & Pandesal': 'Tiwala at Pandesal',
   'Credit Level is your borrowing tier. Trust is what you build; Credit Level is what that trust unlocks.':
      'Ang Credit Level ang tier mo sa paghiram. Ang tiwala ang binubuo mo; ang Credit Level ang nabubuksan ng tiwalang iyon.',

   // src/views/dashboard-v2/DashboardV2Milestones.tsx
   Get: 'Kunin',
   'Top Reward': 'Top reward',
   'All Milestones': 'Lahat ng milestone',
   'No milestones yet': 'Wala pang milestone',
   'Your first one unlocks when you post a request': 'Mabubuksan ang una mo kapag nag-post ka ng request',
   'Grow Trust with feeding': 'Pakainin para lumago ang tiwala',
   'Grow Moodeng, eat on us': 'Palakihin si Moodeng, libre namin ang kain',
   'Back to dashboard': 'Bumalik sa Dashboard',
   'Loading milestones': 'Naglo-load ang mga milestone',
   'Reputation milestones': 'Mga milestone ng reputasyon',
   'Grow Moodeng to': 'Palakihin si Moodeng hanggang',

   // src/views/dashboard-v2/DashboardV2Preview.tsx
   Preview: 'Preview',
   'Dashboard preview state': 'Preview state ng Dashboard',
   'Switch language': 'Palitan ang wika',
   'Sign in to see your real data': 'Mag-sign in para makita ang totoong data mo',

   // src/views/dashboard-v2/DashboardV2Rewards.tsx
   'Voucher Unlocked!': 'Na-unlock ang voucher!',
   Claim: 'I-claim',
   Invite: 'Mag-invite',
   'You both get a ₱100 voucher once your friend repays their first loan on time. Claim yours here or on your dashboard.':
      'Pareho kayong makakakuha ng ₱100 voucher kapag nabayaran ng kaibigan mo on time ang una niyang loan. I-claim ang sa iyo rito o sa Dashboard mo.',
   'Borrow small, build your credit': 'Humiram nang maliit, buuin ang credit mo',
   'Small person-to-person loans with one amount, one date, and no Moodeng fees.':
      'Maliliit na loan mula tao sa tao: isang halaga, isang petsa, at walang fee mula sa Moodeng.',
   'Join Moodeng': 'Sumali sa Moodeng',
   'Tell us where to send your GrabFood voucher code.': 'Sabihin sa amin kung saan ipapadala ang GrabFood voucher code mo.',
   'Thanks for inviting them. Where should we send your voucher code?':
      'Salamat sa pag-invite sa kanila. Saan namin ipapadala ang voucher code mo?',
   'Thanks for joining with a friend. Where should we send your voucher code?':
      'Salamat sa pagsali kasama ang kaibigan mo. Saan namin ipapadala ang voucher code mo?',
   'Full name': 'Buong pangalan',
   'Mobile number': 'Mobile number',
   Embed: 'I-embed',
   'Close share': 'Isara ang share',
   'More share options': 'Iba pang paraan ng pag-share',
   'Free meal for both of you: a ₱100 voucher for you and a ₱100 voucher for your friend.':
      'Libreng kain para sa inyong dalawa: ₱100 voucher para sa iyo at ₱100 voucher para sa kaibigan mo.',
   'You repaid on time. Treat yourself!': 'Nakapagbayad ka on time. I-treat mo ang sarili mo!',
   'Your friend repaid on time. Free meal!': 'Nakapagbayad on time ang kaibigan mo. Libreng kain!',
   'You repaid on time. Free meal!': 'Nakapagbayad ka on time. Libreng kain!',
   'Moodeng grew to Rising. Treat yourself!': 'Lumaki si Moodeng hanggang Rising. I-treat mo ang sarili mo!',
   'Moodeng grew to Prime. Treat yourself!': 'Lumaki si Moodeng hanggang Prime. I-treat mo ang sarili mo!',
   'Moodeng reached Apex. Feast time!': 'Naabot ni Moodeng ang Apex. Handaan na!',
   'This voucher was already claimed.': 'Na-claim na ang voucher na ito.',
   "This voucher isn't unlocked yet.": 'Hindi pa naka-unlock ang voucher na ito.',
   'Please check your name and mobile number.': 'Pakitingnan ulit ang pangalan at mobile number mo.',
   'Salamat! We got it.': 'Salamat! Natanggap na namin.',
   "We'll send your ₱": 'Ipapadala namin ang ₱',
   'GrabFood voucher code to your mobile within 2 business days.': 'GrabFood voucher code mo sa mobile mo sa loob ng 2 business days.',
   'Preview sample — nothing was sent.': 'Preview sample lang — walang naipadala.',
   'Mobile number (GCash)': 'Mobile number (GCash)',
   'Email (optional)': 'Email (optional)',
   'Send My Voucher': 'Ipadala ang voucher ko',
   'Free meal for both of us — Moodeng Credit': 'Libreng kain para sa ating dalawa — Moodeng Credit',
   Rejected: 'Tinanggihan',
   'Unavailable right now': 'Hindi available ngayon',
   'Friends joined:': 'Mga kaibigang sumali:',
   '· Repaid on time:': '· Nagbayad on time:',
   "You're invited by": 'Nag-imbita sa iyo:',
   'a friend': 'isang kaibigan',
   '₱100 GrabFood voucher each': 'Tig-₱100 GrabFood voucher',
   'When you repay your first loan on time, you and': 'Kapag nabayaran mo on time ang una mong loan, ikaw at',
   'your friend': 'ang kaibigan mo',
   'both get one.': 'ay parehong makakakuha nito.',
   'Already have an account?': 'May account ka na?',

   // src/views/dashboard-v2/components/DashboardV2Banners.tsx
   'Feast with friend': 'Kumain kasama ang kaibigan',
   'Grab Now': 'Kunin na',
   'Verify My Identity: +10 Pandesal. Unlock borrowing and feeding Moodeng pandesal.':
      'I-verify ang identity ko: +10 Pandesal. I-unlock ang paghiram at ang pagpapakain ng pandesal kay Moodeng.',
   'Connect Wallet: +10 Pandesal. Receive USDC loans.': 'Ikonekta ang wallet: +10 Pandesal. Tumanggap ng USDC loan.',
   'Turn on repayment reminders': 'I-on ang mga paalala sa pagbabayad',
   'Get a heads-up before your due date so you never pay late.': 'Makakuha ng paalala bago ang due date para hindi ka ma-late.',
   'Turn on': 'I-on',

   // src/views/dashboard-v2/components/DashboardV2Hero.tsx
   'Grow your Trust with on-time micro-loans.': 'Palaguin ang tiwala sa iyo gamit ang mga micro-loan na nababayaran on time.',
   'Unlock higher limits by repaying on time.': 'Mag-unlock ng mas mataas na limit sa pagbabayad on time.',
   'Your Moodeng': 'Ang Moodeng mo',
   'Dismiss tip': 'Isara ang tip',
   'Previous Moodeng tier': 'Nakaraang Moodeng tier',
   'Next Moodeng tier': 'Susunod na Moodeng tier',
   'Credit available to borrow': 'Credit na puwedeng hiramin',
   Unverified: 'Hindi pa verified',
   'Live for': 'Live nang',
   day: 'araw',
   days: 'araw',
   'About credit level': 'Tungkol sa Credit Level',

   // src/views/dashboard-v2/components/DashboardV2Popups.tsx
   'Verify My Identity': 'I-verify ang identity ko',
   'Verify to unlock your account — a one-time check that takes about 3 minutes.':
      'Mag-verify para ma-unlock ang account mo — isang beses lang na check na mga 3 minuto lang.',
   'Verify Now': 'Mag-verify na',
   'Most used': 'Pinakaginagamit',
   'Milestone Streak!': 'Milestone Streak!',
   'See My Next Milestone': 'Tingnan ang susunod kong milestone',
   'This week': 'Ngayong linggo',
   'Request Loan & Feed Moodeng': 'Mag-request ng loan at pakainin si Moodeng',
   'View Requests & Feed Moodeng': 'Tingnan ang mga request at pakainin si Moodeng',
   'Repay On Time & Earn Voucher': 'Magbayad on time at makakuha ng voucher',
   'Verify to Start Feeding': 'Mag-verify para makapagpakain',
   'Repay on time, eat on us.': 'Magbayad on time, libre namin ang kain.',
   'Feed Moodeng to level up.': 'Pakainin si Moodeng para mag-level up.',
   'A GrabFood voucher for your first on-time repayment!': 'GrabFood voucher para sa una mong on-time na bayad!',
   'Bigger Moodeng = Higher cash limits!': 'Mas malaking Moodeng = mas mataas na cash limit!',
   'Quick national ID & selfie check. Available in VN, TW, KR, PH, MY, JP, ID, TH':
      'Mabilis na check ng national ID at selfie. Available sa VN, TW, KR, PH, MY, JP, ID, TH',
   'milestone this week': 'milestone ngayong linggo',
   'milestones this week': 'milestone ngayong linggo',
   'Pandesal fed to Moodeng': 'Pandesal na naipakain kay Moodeng',
   'Keep the streak going: your next milestone is waiting.': 'Ituloy mo lang: naghihintay na ang susunod mong milestone.',

   // src/views/dashboard-v2/components/DashboardV2Sections.tsx
   'View All Milestones': 'Tingnan ang lahat ng milestone',
   'Active Loans($)': 'Mga aktibong loan ($)',
   'Pending Request($)': 'Pending na request ($)',
   'My insights': 'Mga insight ko',
   'Loading voucher': 'Naglo-load ang voucher',
   'Defaulted($)': 'Nag-default ($)',
   'Due today': 'Due ngayong araw',
   'Moodeng grew to': 'Lumaki si Moodeng hanggang',
   'Claim your ₱': 'I-claim ang ₱',

   // src/views/dashboard/Dashboard.tsx
   'Withdraw your USDC': 'I-withdraw ang USDC mo',
   'Cash out your funded loan to local currency.': 'I-cash out ang napondohan mong loan sa local currency.',
   'Pandesal points': 'Pandesal points',
   'Pandesal points track your reputation on Moodeng. Verification, clean repayment, and healthy activity make lenders more confident in you.':
      'Sinusukat ng Pandesal points ang reputasyon mo sa Moodeng. Sa verification, malinis na pagbabayad, at maayos na aktibidad, mas nagtitiwala sa iyo ang mga lender.',
   'Milestones are extra ways to earn Pandesal points. Complete them to strengthen your profile and make lenders more confident in your requests.':
      'Ang mga milestone ay dagdag na paraan para makakuha ng Pandesal points. Tapusin ang mga ito para lumakas ang profile mo at mas magtiwala ang mga lender sa mga request mo.',

   // src/views/dashboard/RequestBoard.tsx
   'Role not selected': 'Wala pang napiling role',
   'Pick borrower or lender to unlock your dashboard, repayment, and history.':
      'Pumili kung borrower o lender ka para ma-unlock ang Dashboard, pagbabayad, at history mo.',
   'The team approved you — apply for your loan now.': 'Na-approve ka na ng team — mag-apply na ng loan mo ngayon.',
   'Borrow USDC to build trust and': 'Humiram ng USDC para bumuo ng tiwala at',
   'Apply For A Loan': 'Mag-apply ng loan',
   'Need USDC on Base?': 'Kailangan ng USDC sa Base?',
   'Buy or bridge USDC to fund': 'Bumili o mag-bridge ng USDC para pondohan',
   'Buy or bridge USDC to fund loans.': 'Bumili o mag-bridge ng USDC para pondohan ang mga loan.',
   'Fund Wallet': 'Pondohan ang wallet',
   'New here? Take the 60-sec tour': 'Bago ka rito? Mag-tour nang 60 segundo',
   'See how requests, funding, repayment, and trust fit together.':
      'Tingnan kung paano magkakaugnay ang mga request, pagpopondo, pagbabayad, at tiwala.',
   'Start tour': 'Simulan ang tour',
   "Once lenders have issued three loans, a fee will be charged to their accounts. This fee helps maintain the platform's operational costs and ensures continued support for all users.":
      'Kapag nakapagbigay na ang lender ng tatlong loan, may sisingiling fee sa account nila. Tumutulong ang fee na ito na mapanatili ang operational costs ng platform at masiguro ang patuloy na suporta para sa lahat ng user.',
   'No requests match your filters.': 'Walang request na tumutugma sa mga filter mo.',
   'Try widening your search or clearing your filters.': 'Subukang palawakin ang search mo o i-clear ang mga filter.',
   'Delete this request?': 'I-delete ang request na ito?',
   'This cannot be undone.': 'Hindi na ito puwedeng i-undo.',
   'Lenders will no longer see it. You can make a new request from the board, but repeated deletes pause new requests for a short time.':
      'Hindi na ito makikita ng mga lender. Puwede kang gumawa ng bagong request mula sa board, pero kapag paulit-ulit kang nag-delete, may pause muna sa bagong request sa loob ng maikling panahon.',
   'Keep request': 'Panatilihin ang request',
   'World App users can verify with World ID instead.': 'Puwedeng mag-verify ang mga user ng World App gamit ang World ID.',
   'Quick answers before you sign up.': 'Mabibilis na sagot bago ka mag-sign up.',
   'Take tour': 'Mag-tour',
   'See more': 'Tingnan pa',
   'I want to borrow': 'Gusto kong humiram',
   'See how to request a short-term USDC loan and build trust through on-time repayment.':
      'Tingnan kung paano mag-request ng short-term USDC loan at bumuo ng tiwala sa pamamagitan ng on-time na pagbabayad.',
   'I want to lend': 'Gusto kong magpahiram',
   'See how to fund loan requests, review borrower trust signals, and earn by supporting people you believe in.':
      'Tingnan kung paano pondohan ang mga loan request, suriin ang trust signals ng borrower, at kumita habang sinusuportahan ang mga taong pinagkakatiwalaan mo.',
   'Not sure yet — just show me around': 'Hindi pa sigurado — ilibot mo muna ako',
   'Get a quick overview of how Moodeng works before deciding which side to explore.':
      'Silipin muna kung paano gumagana ang Moodeng bago magdesisyon kung aling side ang susubukan.',
   'The request board': 'Ang request board',
   'This is where borrowers post short-term USDC loan requests and lenders browse them. Both sides of Moodeng meet here.':
      'Dito nagpo-post ang mga borrower ng short-term USDC loan request at dito rin ito bini-browse ng mga lender. Dito nagtatagpo ang dalawang panig ng Moodeng.',
   'Borrowers apply here': 'Dito nag-a-apply ang mga borrower',
   'A borrower sets their loan amount, repayment date, and reason. Once verified, their request goes live on this board.':
      'Dito itinatakda ng borrower ang halaga ng loan, petsa ng pagbabayad, at dahilan. Kapag verified na siya, magiging live sa board na ito ang request niya.',
   'Ready to get started?': 'Handa ka na bang magsimula?',
   'This is the marketplace. Once a request is live, lenders review the amount, repayment, and borrower before funding.':
      'Ito ang marketplace. Kapag live na ang request, sinusuri ng mga lender ang halaga, bayad, at borrower bago ito pondohan.',
   'When you are ready to borrow, this card opens the loan request flow. Got a code from a friend? Add it for a higher starting limit.':
      'Kapag handa ka nang humiram, bubuksan ng card na ito ang loan request flow. May code ka ba mula sa kaibigan? Idagdag ito para sa mas mataas na starting limit.',
   'Verify first': 'Mag-verify muna',
   'Borrowers complete a one-time identity check before requesting a loan. It helps lenders know they are funding a real person.':
      'Kumukumpleto ang mga borrower ng one-time identity check bago mag-request ng loan. Nakakatulong ito para malaman ng lender na totoong tao ang pinopondohan nila.',
   'Set your terms': 'Itakda ang terms mo',
   'After verification, this is where the borrower sets the amount, repayment, date, and reason for the request.':
      'Pagkatapos ng verification, dito itinatakda ng borrower ang halaga, bayad, petsa, at dahilan ng request.',
   'Get funded, then repay': 'Mapondohan, tapos magbayad',
   'A lender funds your request and USDC lands in your wallet. Repay on time and your Pandesal points — and your next limit — grow. Miss a repayment and it shows on your public profile, so lenders lend on trust.':
      'Pinopondohan ng lender ang request mo at pumapasok ang USDC sa wallet mo. Magbayad on time para tumaas ang Pandesal points mo — at ang susunod mong limit. Kapag na-miss ang bayad, makikita ito sa public profile mo, kaya nagpapahiram ang mga lender batay sa tiwala.',
   'Browse open requests': 'Tingnan ang mga bukas na request',
   'Look through open requests before signing up — each card shows the amount, repayment, borrower, and reason.':
      'Tingnan ang mga bukas na request bago mag-sign up — makikita sa bawat card ang halaga, bayad, borrower, at dahilan.',
   'The hamburger opens Help and Support questions here. Scroll the list to browse more answers without leaving the board.':
      'Binubuksan ng menu icon ang mga tanong sa Help and Support dito. I-scroll ang listahan para makita pa ang ibang sagot nang hindi umaalis sa board.',
   'Ready to build credit?': 'Handa ka na bang bumuo ng credit?',
   'Create your account to request your first loan — or sign in if you already have one.':
      'Gumawa ng account para ma-request ang una mong loan — o mag-sign in kung mayroon ka na.',
   'This list is the marketplace. Once a request is live, lenders can review the amount, repayment, and borrower profile before funding.':
      'Ang listahang ito ang marketplace. Kapag live na ang request, puwedeng suriin ng mga lender ang halaga, bayad, at profile ng borrower bago ito pondohan.',
   'When you are ready to borrow, this card opens the loan request form.':
      'Kapag handa ka nang humiram, bubuksan ng card na ito ang loan request form.',
   'Before an unverified borrower can request a loan, Moodeng sends them through a quick identity verification screen.':
      'Bago makapag-request ng loan ang hindi pa verified na borrower, dadalhin sila ng Moodeng sa mabilis na identity verification screen.',
   'Loan terms preview': 'Preview ng loan terms',
   'Trust-building vs credit-building': 'Trust-building kumpara sa credit-building',
   'Borrowing below your limit can build trust history. Borrowing your full limit and repaying on time is what raises your Credit Level.':
      'Bumubuo ng trust history ang paghiram nang mas mababa sa limit mo. Ang paghiram ng buong limit mo at pagbabayad on time ang nagpapataas ng Credit Level mo.',
   'Set a clear repayment': 'Magtakda ng malinaw na halaga ng bayad',
   'Your repayment must be at least $1 more than what you borrow. Lenders use this to decide if the request is worth funding.':
      'Dapat hindi bababa sa $1 ang sobra ng babayaran mo kaysa sa hiniram mo. Ginagamit ito ng mga lender para magpasya kung sulit pondohan ang request.',
   'Explain the reason': 'Ipaliwanag ang dahilan',
   'A short, specific reason helps lenders understand the request and builds trust before they fund it.':
      'Nakakatulong ang maikli at malinaw na dahilan para maintindihan ng mga lender ang request at magtiwala sila bago ito pondohan.',
   'Find open requests': 'Maghanap ng mga bukas na request',
   'As a lender, this board shows people asking for short-term USDC support. Start by comparing the amount, repayment, due date, and reason.':
      'Bilang lender, makikita mo sa board na ito ang mga taong humihingi ng short-term na tulong sa USDC. Magsimula sa paghahambing ng halaga, bayad, due date, at dahilan.',
   'Review the request': 'Suriin ang request',
   'Each card shows what the borrower needs, what they plan to repay, and whether their account is in good standing.':
      'Makikita sa bawat card kung ano ang kailangan ng borrower, kung magkano ang babayaran nila, at kung maayos ang account nila.',
   'Fund with one tap': 'Pondohan sa isang tap',
   'Tap Send Your Help. USDC goes straight from your wallet to the borrower once you approve.':
      'I-tap ang Send Your Help. Direktang pupunta ang USDC mula sa wallet mo papunta sa borrower kapag inaprubahan mo na.',
   'Get repaid, watch for the fee': 'Mabayaran, at bantayan ang fee',
   'Repayment comes back to your wallet by the due date shown on each request. After your third funded loan, a small platform fee applies to help cover operating costs.':
      'Babalik ang repayment sa wallet mo sa due date na nakalagay sa bawat request. Pagkatapos ng ikatlo mong napondohang loan, may maliit na platform fee na para makatulong sa operating costs.',
   'Check Borrower Insights': 'Tingnan ang insights ng borrower',
   'Before funding, open Borrower Details to review repayment behavior, credit level, and trust signals. The tour continues there next.':
      'Bago magpondo, i-tap ang Tingnan ang detalye ng borrower para suriin ang paraan ng pagbabayad, Credit Level, at mga senyales ng tiwala. Doon magpapatuloy ang tour.',
   'Edit display name': 'I-edit ang display name',
   'Verification in progress': 'Isinasagawa ang verification',
   'Close delete request confirmation': 'Isara ang delete request confirmation',

   // src/views/dashboard/components/ConnectStep.tsx
   'Set up cash-out to your local currency': 'I-set up ang cash-out papunta sa local currency mo',
   'Meet the team, ask anything': 'Kilalanin ang team, magtanong ng kahit ano',
   'Apply right after the call': 'Mag-apply kaagad pagkatapos ng call',
   'What do you need a loan for?': 'Para saan mo kailangan ang loan?',
   'Your time is in your email': 'Nasa email mo ang oras',
   'Join the meeting': 'Sumali sa meeting',
   'Have ready': 'Ihanda ang mga ito',
   'Your original ID or passport': 'Ang orihinal mong ID o passport',
   'Camera on, good light, phone nearby': 'Naka-on ang camera, maayos na ilaw, malapit ang phone',
   'Say hi to Emma on Facebook ›': 'Bumati kay Emma sa Facebook ›',
   'Your goal': 'Ang layunin mo',
   '15 minutes · on Zoom · you pick the time': '15 minuto · sa Zoom · ikaw ang pipili ng oras',
   'A quick note so the team knows how to help.': 'Maikling tala para malaman ng team kung paano makakatulong.',
   'Quick picks': 'Mabilisang pagpipilian',

   // src/views/dashboard/components/ContactsStep.tsx
   'Get Started': 'Magsimula',
   'Get due-date reminders on your phone': 'Makatanggap ng paalala sa due date sa phone mo',
   'On iPhone: tap': 'Sa iPhone: i-tap ang',
   Share: 'I-share',
   'Add to Home Screen': 'Idagdag sa Home Screen',
   'Turn on reminders to continue.': 'I-on ang mga reminder para magpatuloy.',
   'Only Moodeng sees this — never lenders.': 'Moodeng lang ang nakakakita nito — hinding-hindi ang mga lender.',
   'How can we reach you?': 'Paano ka namin makokontak?',
   'Open Messenger again': 'Buksan ulit ang Messenger',
   Required: 'Kailangan',
   'Turn on reminders': 'I-on ang mga reminder',

   // src/views/dashboard/components/CreditLevelSection.tsx
   'Your credit level grows as you borrow and repay on time. Higher levels unlock larger loan amounts.':
      'Tumataas ang credit level mo kapag humihiram ka at nagbabayad on time. Ang mas mataas na level ang nag-a-unlock ng mas malaking loan amount.',
   'Watch our credit levelling guide': 'Panoorin ang gabay namin sa Credit Leveling',
   'Verify to unlock': 'Mag-verify para ma-unlock',

   // src/views/dashboard/components/LendChecklistModal.tsx
   'Unlocks once you connect': 'Ma-a-unlock kapag nakakonekta ka na',
   'Base Account does both steps in one tap.': 'Sa Base Account, tapos ang dalawang hakbang sa isang tap lang.',
   'Send your help': 'Ipadala ang tulong mo',
   'Confirm the payment': 'Kumpirmahin ang bayad',

   // src/views/dashboard/components/LenderDiversitySection.tsx
   'Early estimate: needs 8 funded loans before the score is fully weighted.':
      'Unang estimate: kailangan ng 8 napondohang loan bago ganap na ma-weight ang score.',
   'This score appears after at least 2 funded loans.': 'Lumalabas ang score na ito pagkatapos ng hindi bababa sa 2 napondohang loan.',
   'Pay Loans': 'Magbayad ng loan',

   // src/views/dashboard/components/LoanRequestModal.tsx
   'Public borrower profile': 'Pampublikong profile ng borrower',
   'This is the identity lenders see beside your request.': 'Ito ang profile na nakikita ng mga lender sa tabi ng request mo.',
   'Profile image': 'Larawan sa profile',
   'Tap to choose a photo or avatar.': 'I-tap para pumili ng larawan o avatar.',
   'Name shown to lenders': 'Pangalang ipinapakita sa mga lender',
   'Use a first name or friendly nickname.': 'Gumamit ng first name o friendly na palayaw.',
   'Describe your situation': 'Ilarawan ang sitwasyon mo',
   'Tell lenders how you earn, in your own words.': 'Sabihin sa mga lender kung paano ka kumikita, sa sarili mong salita.',
   'Be specific, for example teacher or market vendor.': 'Maging specific, halimbawa teacher o market vendor.',
   'Still needed: how you describe your work.': 'Kailangan pa: kung paano mo ilalarawan ang trabaho mo.',
   'For example tutoring, delivery, or market trading.': 'Halimbawa tutoring, delivery, o pagtitinda sa market.',
   'Referral Boost': 'Referral Boost',
   'Schedule a video call': 'Mag-iskedyul ng video call',
   'How lenders see you': 'Kung paano ka nakikita ng mga lender',
   'Set your loan terms': 'Itakda ang mga terms ng loan mo',
   Optional: 'Optional',
   'Have a referral code?': 'May referral code ka ba?',
   'Add it now for a higher starting limit.': 'Idagdag ito ngayon para sa mas mataas na starting limit.',
   'Referral code': 'Referral code',
   'No code needed. You can continue normally.': 'Hindi kailangan ng code. Puwede kang magpatuloy nang normal.',
   'Please add your Facebook so we can reach out to you. We also have a':
      'Idagdag ang Facebook mo para maabot ka namin. Mayroon din kaming',
   'Borrow Amount': 'Halagang hihiramin',
   'All loans are issued and repaid in USDC.': 'Lahat ng loan ay ibinibigay at binabayaran sa USDC.',
   'Set Repayment Amount': 'Itakda ang halaga ng bayad',
   'You’ll repay': 'Babayaran mo ang',
   'Set Repayment Date': 'Itakda ang petsa ng pagbabayad',
   'Reason for Borrowing': 'Dahilan ng paghiram',
   'Short and specific helps lenders trust it.': 'Mas pinagkakatiwalaan ng mga lender ang maikli at malinaw na sagot.',
   'Checking your reason…': 'Sinusuri ang dahilan mo…',
   'Looks good': 'Maayos na',
   'At least 40 characters, in English — short and specific helps lenders trust it.':
      'Hindi bababa sa 40 character, sa English — mas pinagkakatiwalaan ng mga lender ang maikli at malinaw na sagot.',
   'I have a regular job': 'May regular akong trabaho',
   'Full-time or part-time with a fixed employer': 'Full-time o part-time na may fixed na employer',
   'I work for myself': 'Nagtatrabaho ako para sa sarili ko',
   'My income varies': 'Nag-iiba-iba ang kita ko',
   'Something else': 'Iba pa',
   'Describe your situation in your own words': 'Ilarawan ang sitwasyon mo sa sarili mong salita',
   'It varies': 'Nag-iiba-iba',
   'Gap before payday': 'Kulang bago sumahod',
   'Bills before payday': 'Mga bayarin bago sumahod',
   'Family needs': 'Pangangailangan ng pamilya',
   'Transport costs': 'Gastos sa transportasyon',
   'Medical expenses': 'Gastusing medikal',
   'Emergency costs': 'Gastos sa emergency',
   'Work supplies': 'Kagamitan sa trabaho',
   'Failed to save profile name.': 'Hindi na-save ang profile name.',
   'Swipe right to close loan form': 'I-swipe pakanan para isara ang loan form',
   'Explain setting loan terms': 'Ipaliwanag ang pagtakda ng loan terms',
   'Close loan form': 'Isara ang loan form',
   'So we can help you more 💜': 'Para mas matulungan ka namin 💜',
   'Explain current borrow limit': 'Ipaliwanag ang kasalukuyang borrow limit',
   'Set your desired amount': 'Itakda ang gustong halaga',
   'Explain USDC loans': 'Ipaliwanag ang mga USDC loan',
   'Must be more than the borrowed amount': 'Dapat mas mataas sa hiniram na halaga',
   'Selected repayment date': 'Napiling petsa ng pagbabayad',
   'Open repayment date calendar': 'Buksan ang calendar ng petsa ng pagbabayad',
   'Why do you need this loan? Write in English.': 'Bakit mo kailangan ang loan na ito? Isulat sa English.',
   'Ask Mecha to help me word this': 'Magpatulong kay Mecha sa pagsulat nito',
   'Ask Mecha to write this in English': 'Ipasulat ito kay Mecha sa English',
   'Choose repayment date': 'Piliin ang petsa ng pagbabayad',
   'Previous month': 'Nakaraang buwan',
   'Next month': 'Susunod na buwan',

   // src/views/dashboard/components/LoanSummarySection.tsx
   Total: 'Kabuuan',

   // src/views/dashboard/components/LocationPrimingModal.tsx
   'One last step': 'Isang huling hakbang',
   'Share location': 'I-share ang lokasyon',

   // src/views/dashboard/components/MilestoneSheets.tsx
   'Why it matters': 'Bakit mahalaga ito',
   'What changes on your profile': 'Ano ang magbabago sa profile mo',
   'Complete earlier milestones first': 'Tapusin muna ang mga naunang milestone',
   'Build trust one step at a time': 'Bumuo ng tiwala nang paunti-unti',
   'Complete clear actions, such as verifying your identity and repaying on time. Each completed milestone adds Pandesal points to your borrower profile.':
      'Tapusin ang mga malinaw na aksyon, gaya ng pag-verify ng identity mo at pagbabayad on time. Ang bawat natapos na milestone ay nagdaragdag ng Pandesal points sa borrower profile mo.',
   'Next milestone': 'Susunod na milestone',
   'The clearest action you can complete now.': 'Ang pinakamalinaw na aksyon na puwede mong tapusin ngayon.',
   'Locked milestones': 'Mga naka-lock na milestone',
   'These become available after earlier steps are complete.': 'Magiging available ang mga ito pagkatapos matapos ang mga naunang hakbang.',
   'View Milestone': 'Tingnan ang milestone',
   Unlocked: 'Naka-unlock',

   // src/views/dashboard/components/ReputationMilestones.tsx
   'Reputation Milestones': 'Mga milestone ng reputasyon',
   'Milestones show what to do next to build trust with lenders.':
      'Ipinapakita ng mga milestone kung ano ang susunod mong gagawin para bumuo ng tiwala sa mga lender.',
   'Complete milestones to unlock higher loan levels.': 'Tapusin ang mga milestone para ma-unlock ang mas mataas na loan level.',
   'How milestones work': 'Paano gumagana ang mga milestone',

   // src/views/dashboard/components/SuccessModal.tsx
   'Loan request submitted': 'Naisumite na ang loan request',
   'Your loan request is now live. Lenders can review it and fund your request.':
      'Live na ang loan request mo. Puwede na itong suriin at pondohan ng mga lender.',
   'Join the Moodeng borrower group on Facebook or Telegram so we can introduce you to great lenders.':
      'Sumali sa Moodeng borrower group sa Facebook o Telegram para maipakilala ka namin sa mahuhusay na lender.',
   'Join on Telegram': 'Sumali sa Telegram',
   'Join on Facebook': 'Sumali sa Facebook',

   // src/views/dashboard/components/TrustScoreSection.tsx
   'Your Pandesal points are your track record on Moodeng, out of 500 — and counting. They already unlock perks, with bigger rewards on the way for top scorers. Keep building them!':
      'Ang Pandesal points mo ang track record mo sa Moodeng, hanggang 500 — at patuloy pang dumadami. Nag-a-unlock na ito ng mga perk, at may mas malalaking reward pang paparating para sa mga top scorer. Ituloy mo lang!',
   'Your Pandesal points grow with every on-time repayment and live with your wallet.':
      'Tumataas ang Pandesal points mo sa bawat on-time na pagbabayad at nakatali ito sa wallet mo.',
   'About Pandesal points': 'Tungkol sa Pandesal points',

   // src/views/dashboard/components/VideoCallStep.tsx
   'Zoom link by email · reminder on Messenger': 'Zoom link sa email · paalala sa Messenger',
   'Finding open times…': 'Hinahanap ang mga bukas na oras…',
   'No referral code — book a call.': 'Walang referral code — mag-book ng call.',
   'Moodeng video call': 'Video call ng Moodeng',
   'Your short video hello with the Moodeng team — see how Moodeng works and ask anything.':
      'Maikling video call para makilala ang Moodeng team — alamin kung paano gumagana ang Moodeng at magtanong ng kahit ano.',

   // src/views/fund/FundBridge.tsx
   'Bridge to Base': 'I-bridge papunta sa Base',
   'From chain': 'Mula sa chain',
   'Select a chain': 'Pumili ng chain',
   'Amount (USDC)': 'Halaga (USDC)',
   'To chain': 'Papunta sa chain',
   'Fetching best rate…': 'Kinukuha ang pinakamahusay na rate…',
   'Quote Details': 'Detalye ng quote',
   'You send': 'Ipapadala mo',
   'You receive on Base': 'Matatanggap mo sa Base',
   'Estimated time': 'Tinatayang oras',
   'Pay from': 'Bayad mula sa',
   'Could not fetch a quote. Please try again.': 'Hindi nakuha ang quote. Subukan ulit.',

   // src/views/dashboard/components/UserCard.tsx
   'Timing and borrower context': 'Timing at konteksto ng borrower',
   'Lender reward': 'Reward ng lender',
   'Not seeing a prompt? Make sure your wallet app is open on this device — or reconnect it here.':
      'Walang lumalabas na prompt? Siguraduhing bukas ang wallet app mo sa device na ito — o mag-reconnect dito.',
   'Reconnect wallet': 'I-reconnect ang wallet',
   'Due On': 'Due sa',
   'Get back USDC': 'Ibabalik na USDC',
   'View Request': 'Tingnan ang request',
   'Your Loan Request': 'Ang loan request mo',
   'Help Received': 'Natanggap na tulong',
   'View Details': 'Tingnan ang detalye',
   'View Borrower Details': 'Tingnan ang detalye ng borrower',
   Funded: 'Napondohan',
   'Moodeng loan request': 'Loan request sa Moodeng',
   'Share this request': 'Ibahagi ang request na ito',
   'Delete your loan request': 'I-delete ang loan request mo',
   'Delete request': 'I-delete ang request',

   // src/views/fund/FundWalletSheet.tsx
   'Fund your wallet': 'Pondohan ang wallet mo',
   'Your USDC balance': 'Ang USDC balance mo',
   'Deposit USDC': 'Mag-deposit ng USDC',
   'Already have USDC? Send it to your wallet on Base': 'May USDC ka na ba? Ipadala ito sa wallet mo sa Base',
   'No fee': 'Walang fee',
   'Base network only': 'Base network lang',
   'Send USDC on the': 'Ipadala ang USDC sa',
   Copied: 'Nakopya',
   'Only send USDC on Base. Other tokens or networks may be lost.':
      'Sa Base network lang magpadala ng USDC. Puwedeng mawala ang ibang token o ang ipinadala sa ibang network.',
   'Buy USDC with card': 'Bumili ng USDC gamit ang card',
   'Powered by Stripe': 'Pinapagana ng Stripe',
   'Stays in the app': 'Nananatili sa app',
   'Supported in': 'Sinusuportahan sa',
   'Buy USDC with debit card': 'Bumili ng USDC gamit ang debit card',
   'Coinbase account needed': 'Kailangan ng Coinbase account',
   'Coinbase checks if you’re signed in — if not, you’ll sign in first, then pay by card.':
      'Susuriin ng Coinbase kung naka-sign in ka na — kung hindi, mag-sign in ka muna, tapos magbayad gamit ang card.',
   'Bridge from another chain': 'Mag-bridge mula sa ibang chain',
   'Already have stablecoins? Move them to Base': 'May stablecoins ka na ba? Ilipat ang mga ito sa Base',
   'Bridge from Solana': 'Mag-bridge mula sa Solana',
   'Gas only': 'Gas lang',
   'Loading balance': 'Naglo-load ang balance',

   // src/views/fund/StripeOnrampModal.tsx
   'Opening secure checkout…': 'Binubuksan ang secure checkout…',
   'Back to funding options': 'Bumalik sa mga opsyon sa pagpondo',
   'Payment confirmed': 'Nakumpirma ang bayad',
   'Your USDC is on its way to your wallet on Base. It usually lands within a minute.':
      'Papunta na ang USDC mo sa wallet mo sa Base. Karaniwang dumarating ito sa loob ng isang minuto.',

   // src/views/lenderBenefits/sections/CommunityHeroSection.tsx
   'Community information': 'Impormasyon ng komunidad',

   // src/views/lenderBenefits/sections/MeetYourFutureBorrowersSection.tsx
   'Borrower community illustration': 'Ilustrasyon ng komunidad ng borrower',

   // src/views/lenderBenefits/sections/ProblemSection.tsx
   'A group of people held together in a circular illustration': 'Isang grupo ng mga tao na magkakasama sa isang bilog na ilustrasyon',

   // src/views/lenderBenefits/sections/Web3WalletSection.tsx
   'Moodeng Credit wallet illustration': 'Ilustrasyon ng wallet ng Moodeng Credit',

   // src/views/login/components/AuthCard.tsx
   'Moodeng Mascot': 'Mascot ng Moodeng',

   // src/views/login/components/AuthForm.tsx
   'Email already exists.': 'May account na gamit ang email na ito.',
   'Invalid credentials.': 'Mali ang email o password.',
   'Remember me': 'Tandaan ako',
   'Enter your Email': 'Ilagay ang email mo',
   'Confirm your Password': 'I-confirm ang password mo',

   // src/views/login/sections/AuthFormSection.tsx
   'OR CONTINUE WITH EMAIL': 'O MAGPATULOY GAMIT ANG EMAIL',

   // src/views/milestones/Milestones.tsx
   Rewards: 'Mga reward',
   'How rewards unlock': 'Paano nag-a-unlock ang mga reward',
   'Complete milestones to earn Pandesal points. Profile rewards unlock automatically when you reach the required points.':
      'Tapusin ang mga milestone para makakuha ng Pandesal points. Awtomatikong nag-a-unlock ang mga profile reward kapag naabot mo na ang kinakailangang points.',
   'Pandesal points unlock profile rewards. They do not guarantee funding.':
      'Nag-a-unlock ng mga profile reward ang Pandesal points, pero hindi ito garantiya na mapopondohan ka.',
   'How rewards work': 'Paano gumagana ang mga reward',
   'Next reward': 'Susunod na reward',
   Collectibles: 'Mga collectible',
   Upcoming: 'Paparating',
   'Close rewards help': 'Isara ang tulong sa rewards',

   // src/views/lender/dashboard/LenderDashboard.tsx
   'Performance Summary': 'Buod ng performance',
   'View All Transactions': 'Tingnan ang lahat ng transaksyon',
   'No transactions found': 'Walang nakitang transaksyon',
   Default: 'Nag-default',
   'Total Earnings': 'Kabuuang kita',
   'Total Loans Lent out': 'Kabuuang ipinahiram na loan',
   'Total Loss': 'Kabuuang lugi',
   'Total Loans Funded': 'Kabuuang napondohang loan',
   'Search Fundings': 'Maghanap ng funding',

   // src/views/lender/loanNote/LenderFundLoanModal.tsx
   'This loan is no longer available.': 'Hindi na available ang loan na ito.',
   'Thank you for funding': 'Salamat sa pagpondo',
   'View transaction on Basescan ↗': 'Tingnan ang transaksyon sa Basescan ↗',
   'View My Funded Loans': 'Tingnan ang mga napondohan kong loan',
   'You pay': 'Babayaran mo',
   'You receive': 'Matatanggap mo',
   'Loan Note ID': 'Loan Note ID',
   'You paid': 'Binayaran mo',
   'Expected repayment': 'Inaasahang bayad',
   'IOU points earned': 'Nakuhang IOU points',
   'Fund this loan': 'Pondohan ang loan na ito',

   // src/views/lender/loanNote/LoanNotePurchase.tsx
   'Loan not found': 'Hindi nahanap ang loan',
   'This support link is invalid or the loan is no longer available.': 'Invalid ang support link na ito o hindi na available ang loan.',
   'Amount funded': 'Halagang napondohan',
   'Will repay': 'Babayaran',
   'You already own this Loan Note.': 'Mayroon ka nang Loan Note na ito.',
   'You’ll be asked to sign in or sign up, then returned here to complete your support.':
      'Hihilingin sa iyong mag-sign in o mag-sign up, tapos ibabalik ka rito para tapusin ang pagtulong mo.',
   'Your purchase is confirmed on-chain (you own the Loan Note). We’re still syncing it to your dashboard — it’ll appear shortly. Your funds and IOU points are safe.':
      'Nakumpirma na on-chain ang pagbili mo (nasa iyo na ang Loan Note). Sine-sync pa namin ito sa Dashboard mo — lalabas ito maya-maya. Ligtas ang pera at IOU points mo.',
   'Remaining owed': 'Natitirang utang',
   'IOU points reward': 'Reward na IOU points',
   'Purchase amount': 'Halaga ng bili',

   // src/views/lender/performance/LenderPerformance.tsx
   'Total Lent': 'Kabuuang ipinahiram',

   // src/views/lender/supported/SupportedLoans.tsx
   'My Funded Loans': 'Mga napondohan kong loan',
   'Repayments are automatically sent to your wallet when the borrower repays.':
      'Awtomatikong ipinapadala ang repayment sa wallet mo kapag nagbayad na ang borrower.',
   'You haven’t funded any loans yet. Funding links are shared directly with you.':
      'Wala ka pang napondohang loan. Direktang ibinabahagi sa iyo ang mga funding link.',
   'Amount paid': 'Halagang nabayaran',
   'Borrower owes': 'Utang ng borrower',
   'Released to you': 'Nailabas na sa iyo',
   'Held in contract': 'Nakahawak sa contract',
   'Repayment destination': 'Saan mapupunta ang bayad'
};
