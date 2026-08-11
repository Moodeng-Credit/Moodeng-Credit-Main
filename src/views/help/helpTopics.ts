import type { LocalizedText } from '@/components/mecha/stepContext';

// The Moodeng help center content — the pre-arranged answers behind /help.
//
// SOURCE OF TRUTH. Every answer here is a condensed, faithful version of the
// content the team already maintains and has vetted:
//
//   tools/support-knowledge/troubleshooting.md   (real Messenger/Telegram fixes)
//   src/views/support/data/faqs.ts               (public FAQ)
//   src/views/support/data/guides.ts             (help-center guides)
//
// Nothing here is invented. When a fact changes, change it in those files first,
// then mirror it here, so the help center, the guides and the support bot can
// never drift apart.
//
// COPY RULES (carried over from troubleshooting.md, keep them):
//   - The ID check is always "Verify Your ID" — never "KYC", "Didit", "eID".
//   - We are not a financial adviser. How-to and product answers only; never
//     tell anyone whether to hold or sell crypto.
//   - Always: send USDC on the Base network. Wrong network = lost funds.
//   - A Base Account is seedless. We never ask for a seed / recovery phrase.

export type HelpCategoryId =
   | 'getting-started'
   | 'verify'
   | 'wallet'
   | 'money-in'
   | 'cash-out'
   | 'credit'
   | 'writing-request'
   | 'safety';

export interface HelpCategory {
   id: HelpCategoryId;
   emoji: string;
   label: LocalizedText;
   blurb: LocalizedText;
}

export const HELP_CATEGORIES: HelpCategory[] = [
   {
      id: 'getting-started',
      emoji: '🚀',
      label: { en: 'Getting started', fil: 'Pagsisimula' },
      blurb: { en: 'What Moodeng is and how your first loan works', fil: 'Ano ang Moodeng at paano ang unang loan mo' }
   },
   {
      id: 'verify',
      emoji: '🪪',
      label: { en: 'Verify your ID', fil: 'I-verify ang ID mo' },
      blurb: { en: 'The quick check that unlocks borrowing', fil: 'Ang mabilis na check para makahiram' }
   },
   {
      id: 'wallet',
      emoji: '🔗',
      label: { en: 'Wallet & Base Account', fil: 'Wallet at Base Account' },
      blurb: { en: 'Set up, connect, and fix wallet problems', fil: 'I-set up, ikonekta, at ayusin ang wallet' }
   },
   {
      id: 'money-in',
      emoji: '💸',
      label: { en: 'Adding & repaying USDC', fil: 'Pagdagdag at pagbayad ng USDC' },
      blurb: { en: 'Fund your wallet and repay your loan', fil: 'Lagyan ng pondo at bayaran ang loan' }
   },
   {
      id: 'cash-out',
      emoji: '🏦',
      label: { en: 'Cashing out', fil: 'Pag-cash out' },
      blurb: { en: 'Turn USDC into pesos in your bank', fil: 'Gawing piso ang USDC sa bank mo' }
   },
   {
      id: 'credit',
      emoji: '📈',
      label: { en: 'Credit & Trust Score', fil: 'Credit at Trust Score' },
      blurb: { en: 'Grow your limit and your reputation', fil: 'Palakihin ang limit at reputasyon mo' }
   },
   {
      id: 'writing-request',
      emoji: '✍️',
      label: { en: 'Writing a loan request', fil: 'Pagsulat ng loan request' },
      blurb: { en: 'Get your request approved and funded', fil: 'Para ma-approve at ma-fund ang request' }
   },
   {
      id: 'safety',
      emoji: '🛡️',
      label: { en: 'Safety & your account', fil: 'Kaligtasan at account mo' },
      blurb: { en: 'Staying safe, and what happens if a loan is unpaid', fil: 'Manatiling ligtas, at kung hindi nabayaran' }
   }
];

export interface HelpTopic {
   id: string;
   category: HelpCategoryId;
   emoji: string;
   title: LocalizedText;
   subtitle: LocalizedText;
   /** The question this answers. Sent to the agent as context and pre-filled into Telegram. */
   question: LocalizedText;
   /** Prose answer, shown above any steps. Use for explainers. */
   intro?: LocalizedText;
   /** Ordered steps, shown as a numbered list. Use for how-tos. */
   steps?: { en: string[]; fil: string[] };
   /** The one thing people get wrong here. Rendered as a callout. */
   watchOut?: LocalizedText;
   /** Link to the in-app guide with the long version. */
   guide?: { path: string; label: LocalizedText };
   /** Extra search terms not already in the title/question. */
   keywords?: string[];
}

export const HELP_TOPICS: HelpTopic[] = [
   // ─── Getting started ──────────────────────────────────────────────────────
   {
      id: 'what-is-moodeng',
      category: 'getting-started',
      emoji: '🦛',
      title: { en: 'What is Moodeng Credit?', fil: 'Ano ang Moodeng Credit?' },
      subtitle: { en: 'Small USDC loans that build your credit', fil: 'Maliit na USDC loan na nagpapalaki ng kredito' },
      question: { en: 'What is Moodeng Credit and how does it work?', fil: 'Ano ang Moodeng Credit at paano ito gumagana?' },
      intro: {
         en: 'Moodeng Credit lets you request short-term loans in USDC while building a Trust Score linked to your wallet. You post a request, a lender funds it directly to your wallet, and you repay on or before the date you set. Every on-time repayment raises your Trust Score and unlocks a higher credit limit — so you start small and grow as you prove reliable. Your reputation is tied to your wallet, so it travels with you rather than being locked inside one app.',
         fil: 'Sa Moodeng Credit puwede kang humiram ng short-term loan sa USDC habang nagtatayo ng Trust Score na nakakabit sa wallet mo. Mag-post ka ng request, i-fu-fund ito ng lender diretso sa wallet mo, at babayaran mo on or before ang petsang itinakda mo. Bawat on-time na bayad ay nagpapataas ng Trust Score at nagbubukas ng mas mataas na limit — kaya maliit ang simula at lumalaki habang pinapatunayan mong maaasahan ka. Nakakabit sa wallet mo ang reputasyon, kaya kasama mo ito kahit saan.'
      },
      guide: { path: '/learn/how-to-request-your-first-loan', label: { en: 'How to request your first loan', fil: 'Paano mag-request ng unang loan' } },
      keywords: ['about', 'what is', 'overview', 'how it works']
   },
   {
      id: 'first-loan',
      category: 'getting-started',
      emoji: '📝',
      title: { en: 'Request your first loan', fil: 'I-request ang unang loan mo' },
      subtitle: { en: 'Account → wallet → verify → request', fil: 'Account → wallet → verify → request' },
      question: { en: 'How do I request my first loan?', fil: 'Paano mag-request ng unang loan?' },
      steps: {
         en: [
            'Create your account with a username, email, and password.',
            'Tap "Apply for a Loan" to start.',
            'Set up a Base Account at account.base.app, then tap "Connect Wallet" to link it.',
            'Tap "Verify Yourself" and complete "Verify Your ID" — about 3 minutes.',
            'Open the Request Board and set your amount (up to your limit), repayment date, and a clear reason.'
         ],
         fil: [
            'Gumawa ng account gamit ang username, email, at password.',
            'I-tap ang "Apply for a Loan" para magsimula.',
            'Mag-set up ng Base Account sa account.base.app, tapos i-tap ang "Connect Wallet" para ikabit ito.',
            'I-tap ang "Verify Yourself" at kumpletuhin ang "Verify Your ID" — mga 3 minuto.',
            'Buksan ang Request Board at itakda ang halaga (hanggang sa limit mo), petsa ng bayad, at malinaw na dahilan.'
         ]
      },
      watchOut: {
         en: 'Signing up and verifying are two separate steps. You cannot post a request until "Verify Your ID" is done.',
         fil: 'Magkaibang hakbang ang sign up at verify. Hindi ka makaka-post ng request hangga\'t hindi tapos ang "Verify Your ID".'
      },
      guide: { path: '/learn/how-to-request-your-first-loan', label: { en: 'Full walkthrough', fil: 'Buong gabay' } },
      keywords: ['start', 'begin', 'apply', 'new']
   },
   {
      id: 'is-it-free',
      category: 'getting-started',
      emoji: '🆓',
      title: { en: 'Does Moodeng charge fees?', fil: 'May bayad ba ang Moodeng?' },
      subtitle: { en: 'No platform fees, no gas on Base', fil: 'Walang platform fee, walang gas sa Base' },
      question: { en: 'Does Moodeng charge any fees?', fil: 'May sinisingil bang bayad ang Moodeng?' },
      intro: {
         en: 'No. Moodeng is free to use — no platform fees on borrowing or lending, no subscriptions, no setup costs. 100% of what a lender funds reaches you, and 100% of your repayment reaches the lender. Network fees (gas) are also zero when you use a Base Account on Base. The only cost is the interest rate the borrower offers, and that goes entirely to the lender, not to us.',
         fil: 'Wala. Libre ang Moodeng — walang platform fee sa paghiram o pagpapahiram, walang subscription, walang setup cost. 100% ng ini-fund ng lender ay napupunta sa iyo, at 100% ng bayad mo ay napupunta sa lender. Zero din ang network fee (gas) kapag Base Account sa Base ang gamit. Ang tanging gastos ay ang interest na inaalok ng borrower, at napupunta iyon nang buo sa lender, hindi sa amin.'
      },
      keywords: ['cost', 'price', 'fee', 'charge', 'free', 'gas']
   },
   {
      id: 'small-loans',
      category: 'getting-started',
      emoji: '🪙',
      title: { en: 'Can I get a small loan?', fil: 'Puwede bang maliit na loan?' },
      subtitle: { en: 'Yes — this is built for small loans', fil: 'Oo — para dito ginawa ang Moodeng' },
      question: { en: 'Can I get a small loan with Moodeng?', fil: 'Puwede ba akong makakuha ng maliit na loan?' },
      intro: {
         en: 'Yes — small loans are exactly what Moodeng is for. New borrowers start at a $15 limit, with no minimum amount, no subscription, and no fees. You request what you need up to your current limit, set the date and interest, and lenders decide whether to fund you. Each on-time repayment grows your limit step by step, from $15 up to a $140 maximum, so you can start small and grow into larger loans only when you are ready.',
         fil: 'Oo — para sa maliliit na loan talaga ginawa ang Moodeng. Nagsisimula ang bagong borrower sa $15 limit, walang minimum, walang subscription, walang fee. Hihingi ka ng kailangan mo hanggang sa limit mo, itatakda ang petsa at interes, at magdedesisyon ang lenders kung i-fu-fund ka. Bawat on-time na bayad ay pinapalaki ang limit, mula $15 hanggang $140 na maximum, kaya puwedeng maliit ang simula at lumaki kapag handa ka na.'
      },
      keywords: ['minimum', 'smallest', 'first loan amount']
   },

   // ─── Verify your ID ───────────────────────────────────────────────────────
   {
      id: 'verify-id',
      category: 'verify',
      emoji: '🪪',
      title: { en: 'Verify your ID', fil: 'I-verify ang ID mo' },
      subtitle: { en: 'The quick 3-minute check', fil: 'Mabilis na 3-minutong check' },
      question: { en: 'How do I verify my ID?', fil: 'Paano i-verify ang ID ko?' },
      steps: {
         en: [
            'In the app, tap "Verify Yourself".',
            'Choose "Verify Your ID" — a photo of your national ID plus a selfie. Have good, even lighting.',
            'Already use World App? You can choose "Verify with World ID" instead.',
            'Most checks finish within minutes. If yours needs a human review, we notify you as soon as it is done — usually within a few hours, at most 1 business day.'
         ],
         fil: [
            'Sa app, i-tap ang "Verify Yourself".',
            'Piliin ang "Verify Your ID" — larawan ng national ID mo at isang selfie. Siguraduhing maliwanag at pantay ang ilaw.',
            'Gumagamit ka na ng World App? Puwede mong piliin ang "Verify with World ID".',
            'Karamihan ay tapos sa loob ng ilang minuto. Kung kailangan ng review ng tao, aabisuhan ka namin agad — kadalasan sa loob ng ilang oras, pinakamatagal 1 business day.'
         ]
      },
      watchOut: {
         en: 'Your ID is checked by our secure verification partner and is never stored by Moodeng. If it gets stuck, retry in Chrome or Safari — not a browser inside Facebook or Messenger — with a clear, well-lit photo.',
         fil: 'Ang ID mo ay sinusuri ng secure na partner namin at hindi kailanman iniimbak ng Moodeng. Kung na-stuck, subukan ulit sa Chrome o Safari — hindi sa browser na nasa loob ng Facebook o Messenger — na malinaw at maliwanag ang larawan.'
      },
      guide: { path: '/learn/verification-and-why-its-required', label: { en: 'Verification & Security', fil: 'Verification at Security' } },
      keywords: ['id', 'selfie', 'kyc', 'identity', 'world id']
   },
   {
      id: 'still-not-verified',
      category: 'verify',
      emoji: '⏳',
      title: { en: "I signed up but I'm not verified", fil: 'Naka-sign up na pero hindi pa verified' },
      subtitle: { en: 'Sign-up and verify are separate', fil: 'Magkaiba ang sign-up at verify' },
      question: { en: "I signed up but I'm still not verified — what do I do?", fil: 'Naka-sign up na ako pero hindi pa verified — ano ang gagawin ko?' },
      steps: {
         en: [
            'In the app, tap "Verify Yourself".',
            'Choose "Verify Your ID" — the quick national ID photo + selfie check, about 3 minutes.',
            'Already a World App user? Choose "Verify with World ID" instead.',
            'If it is stuck, retry in a real browser (Chrome or Safari) and make sure the photo is clear and well lit.'
         ],
         fil: [
            'Sa app, i-tap ang "Verify Yourself".',
            'Piliin ang "Verify Your ID" — mabilis na national ID photo + selfie, mga 3 minuto.',
            'Gumagamit ka na ng World App? Piliin ang "Verify with World ID".',
            'Kung na-stuck, subukan ulit sa totoong browser (Chrome o Safari) at siguraduhing malinaw at maliwanag ang larawan.'
         ]
      },
      watchOut: {
         en: 'Signing up alone is not enough — verifying is the last step before you can send a request.',
         fil: 'Hindi sapat ang sign up lang — ang verify ang huling hakbang bago ka makapag-request.'
      },
      guide: { path: '/learn/verification-and-why-its-required', label: { en: 'Verification & Security', fil: 'Verification at Security' } },
      keywords: ['pending', 'stuck', 'not working', 'unverified']
   },

   // ─── Wallet & Base Account ────────────────────────────────────────────────
   {
      id: 'coinbase-vs-base',
      category: 'wallet',
      emoji: '🟣',
      title: { en: 'Coinbase app vs Base Account', fil: 'Coinbase app vs Base Account' },
      subtitle: { en: 'You need Base, not the Coinbase app', fil: 'Base ang kailangan, hindi Coinbase app' },
      question: { en: 'Do I need the Coinbase app or a Base Account?', fil: 'Kailangan ko ba ang Coinbase app o Base Account?' },
      steps: {
         en: [
            'You need a Base Account. Create it at account.base.app.',
            'You do not need the Coinbase app. Base is a network built by Coinbase, but the app is a different thing.',
            'A Base Account is passwordless and seedless — you sign in with email or a passkey.'
         ],
         fil: [
            'Base Account ang kailangan mo. Gawin ito sa account.base.app.',
            'Hindi mo kailangan ang Coinbase app. Ang Base ay network na ginawa ng Coinbase, pero ibang bagay ang app.',
            'Ang Base Account ay walang password at walang seed phrase — email o passkey ang gamit sa pag-sign in.'
         ]
      },
      watchOut: {
         en: 'Because it is seedless, there is no 12-word recovery phrase to lose — and Moodeng will never ask you for a seed or recovery phrase. Nobody legitimate ever will.',
         fil: 'Dahil seedless, walang 12-word recovery phrase na mawawala — at hindi kailanman hihingin ng Moodeng ang seed o recovery phrase mo. Walang lehitimong tao ang hihingi nito.'
      },
      guide: { path: '/learn/using-usdc-on-moodeng-credit', label: { en: 'Using USDC on Moodeng', fil: 'Paggamit ng USDC sa Moodeng' } },
      keywords: ['coinbase', 'base', 'which app', 'account.base.app']
   },
   {
      id: 'create-base-account',
      category: 'wallet',
      emoji: '🆕',
      title: { en: "Can't create a Base Account", fil: 'Hindi makagawa ng Base Account' },
      subtitle: { en: 'The page won\'t load fix', fil: 'Ayos kapag ayaw mag-load ng page' },
      question: { en: "The Base Account page won't load — how do I create one?", fil: 'Ayaw mag-load ng Base Account page — paano ako gagawa?' },
      steps: {
         en: [
            'Switch from Wi-Fi to mobile data (or the other way around). Some Wi-Fi networks block the sign-in — this fixes it surprisingly often.',
            'Use a real browser — Chrome or Safari — not a browser inside another app.',
            'Try again at account.base.app.',
            'If it still fails, your network may be blocking Base — see "Base won\'t load in the Philippines".'
         ],
         fil: [
            'Lumipat mula Wi-Fi papuntang mobile data (o kabaligtaran). May mga Wi-Fi na hina-block ang sign-in — madalas itong nakaka-ayos.',
            'Gumamit ng totoong browser — Chrome o Safari — hindi sa browser na nasa loob ng ibang app.',
            'Subukan ulit sa account.base.app.',
            'Kung ayaw pa rin, baka hina-block ng network mo ang Base — tingnan ang "Ayaw mag-load ng Base sa Pilipinas".'
         ]
      },
      keywords: ['base account', 'wont load', 'cant create', 'sign up base']
   },
   {
      id: 'base-wont-load-ph',
      category: 'wallet',
      emoji: '📶',
      title: { en: "Base won't load (PLDT / Smart)", fil: 'Ayaw mag-load ng Base (PLDT / Smart)' },
      subtitle: { en: 'Network blocking — three fixes', fil: 'Bina-block ng network — tatlong ayos' },
      question: { en: "Base won't load on my network and my wallet won't connect — what do I do?", fil: 'Ayaw mag-load ng Base sa network ko at ayaw kumonekta ng wallet — ano ang gagawin ko?' },
      intro: {
         en: 'Some Philippine networks (notably PLDT and Smart) block the sign-in service Base uses. When that happens, account.base.app won\'t load or connecting your wallet dead-ends — sometimes with a "your connection is not private" or security warning — even though the rest of the internet works. This is the network, not your phone or account.',
         fil: 'May mga Philippine network (lalo na PLDT at Smart) na hina-block ang sign-in service ng Base. Kapag ganito, ayaw mag-load ng account.base.app o dede-dead-end ang pag-connect ng wallet — minsan may "your connection is not private" o security warning — kahit gumagana ang iba pang internet. Network ito, hindi ang phone o account mo.'
      },
      steps: {
         en: [
            'Easiest — create an instant wallet instead. When we detect the block, the wallet screen shows "Create your wallet instantly". No app, no seed phrase, and network fees are covered for you.',
            'Switch Wi-Fi ↔ mobile data. If one network blocks it, the other often works.',
            'Install the free "1.1.1.1" app by Cloudflare, turn it On, then reopen account.base.app.',
            'Or use a reputable free VPN like Proton VPN — turn it on before opening the sign-in page, connect to a nearby location, then reopen Moodeng.'
         ],
         fil: [
            'Pinakamadali — gumawa na lang ng instant wallet. Kapag na-detect ang block, may lalabas na "Create your wallet instantly" sa wallet screen. Walang app, walang seed phrase, at kami na ang sa network fees.',
            'Lumipat ng Wi-Fi ↔ mobile data. Kung isa ang naka-block, madalas gumagana ang isa.',
            'I-install ang libreng "1.1.1.1" app ng Cloudflare, i-On ito, tapos buksan ulit ang account.base.app.',
            'O gumamit ng maaasahang libreng VPN gaya ng Proton VPN — i-on bago buksan ang sign-in page, kumonekta sa malapit na lokasyon, tapos buksan ulit ang Moodeng.'
         ]
      },
      watchOut: {
         en: 'A VPN only changes how your connection is routed — it never touches your funds. Use only a well-known VPN or the official 1.1.1.1 app, and remember Moodeng will never ask for your seed or recovery phrase.',
         fil: 'Ang VPN ay nagbabago lang kung paano dumadaan ang koneksyon mo — hindi nito hinahawakan ang pera mo. Gumamit lang ng kilalang VPN o ang opisyal na 1.1.1.1 app, at tandaan na hindi hihingin ng Moodeng ang seed o recovery phrase mo.'
      },
      keywords: ['pldt', 'smart', 'vpn', '1.1.1.1', 'cloudflare', 'proton', 'blocked', 'connection not private']
   },
   {
      id: 'instant-wallet',
      category: 'wallet',
      emoji: '⚡',
      title: { en: 'The instant wallet', fil: 'Ang instant wallet' },
      subtitle: { en: 'A wallet without Base — no seed phrase', fil: 'Wallet na walang Base — walang seed phrase' },
      question: { en: 'What is the instant wallet and is it safe?', fil: 'Ano ang instant wallet at ligtas ba ito?' },
      intro: {
         en: 'The instant wallet is a real, self-custodial wallet Moodeng sets up for a borrower straight from your login — no app to download and no seed phrase to write down. It is the escape hatch for people who can\'t use a Base Account (most often the PLDT / Smart block). It receives USDC loans and builds Trust Score exactly like any other wallet, and it is gasless — Moodeng covers the network fees, so you don\'t need ETH to repay or cash out.',
         fil: 'Ang instant wallet ay totoo at self-custodial na wallet na ise-set up ng Moodeng para sa borrower diretso mula sa login mo — walang app na ida-download at walang seed phrase na isusulat. Ito ang escape hatch para sa hindi makagamit ng Base Account (kadalasan ang PLDT / Smart block). Tumatanggap ito ng USDC loan at nagtatayo ng Trust Score gaya ng ibang wallet, at gasless — kami ang sa network fees, kaya hindi mo kailangan ng ETH para magbayad o mag-cash out.'
      },
      watchOut: {
         en: 'You fully own it. You can export its private key anytime from Account → Account Settings → Wallet → "Export wallet key" and import it into MetaMask, Trust, or any wallet — then you\'re free to leave Moodeng entirely. Only borrowers get this; lenders use the normal wallet picker.',
         fil: 'Ikaw ang ganap na may-ari. Puwede mong i-export ang private key anumang oras sa Account → Account Settings → Wallet → "Export wallet key" at i-import sa MetaMask, Trust, o kahit anong wallet — tapos malaya kang umalis sa Moodeng. Borrower lang ang may ganito; ang lenders ay gumagamit ng normal na wallet picker.'
      },
      keywords: ['instant wallet', 'create my wallet', 'no seed', 'export key', 'embedded wallet']
   },
   {
      id: 'in-app-browser',
      category: 'wallet',
      emoji: '🌐',
      title: { en: 'Open in a real browser', fil: 'Buksan sa totoong browser' },
      subtitle: { en: 'Fix sign-in inside Facebook / Messenger', fil: 'Ayos kapag sa loob ng Facebook / Messenger' },
      question: { en: "Sign-in / my wallet won't work when I opened Moodeng from Facebook — what do I do?", fil: 'Ayaw gumana ng sign-in / wallet nang binuksan ang Moodeng mula sa Facebook — ano ang gagawin ko?' },
      intro: {
         en: 'If you opened Moodeng by tapping a link inside Facebook, Messenger, Instagram, or LINE, you\'re in that app\'s built-in mini-browser. Sign-in and wallet pop-ups often fail silently there — nothing happens, or you see a 403 error.',
         fil: 'Kung binuksan mo ang Moodeng sa pamamagitan ng link sa loob ng Facebook, Messenger, Instagram, o LINE, nasa built-in na mini-browser ka ng app na iyon. Madalas na tahimik na nabi-bigo doon ang sign-in at wallet pop-up — walang nangyayari, o may 403 error.'
      },
      steps: {
         en: [
            'Tap the three dots (⋯) in the corner and choose "Open in Chrome" / "Open in Safari" / "Open in external browser".',
            'Or copy the link and paste it into Chrome or Safari directly.',
            'Then sign in and connect your wallet again from there.'
         ],
         fil: [
            'I-tap ang tatlong tuldok (⋯) sa gilid at piliin ang "Open in Chrome" / "Open in Safari" / "Open in external browser".',
            'O kopyahin ang link at i-paste nang diretso sa Chrome o Safari.',
            'Tapos mag-sign in at ikonekta ulit ang wallet mula doon.'
         ]
      },
      keywords: ['in-app browser', 'facebook browser', 'messenger', '403', 'open in chrome']
   },
   {
      id: 'wallet-wont-connect',
      category: 'wallet',
      emoji: '🔌',
      title: { en: "Wallet won't connect", fil: 'Ayaw kumonekta ng wallet' },
      subtitle: { en: 'The reset that works', fil: 'Ang reset na gumagana' },
      question: { en: "My wallet won't connect to Moodeng — what do I do?", fil: 'Ayaw kumonekta ng wallet ko sa Moodeng — ano ang gagawin ko?' },
      steps: {
         en: [
            'Close every tab where Moodeng is open.',
            'Open your wallet app and disconnect Moodeng if it shows as connected.',
            'Close the browser completely, then reopen it.',
            'Open Moodeng again in Chrome or Safari — not a browser inside another app.',
            'Tap Connect Wallet again and approve the request when it appears.'
         ],
         fil: [
            'Isara lahat ng tab kung saan bukas ang Moodeng.',
            'Buksan ang wallet app mo at i-disconnect ang Moodeng kung nakakonekta ito.',
            'Isara nang buo ang browser, tapos buksan ulit.',
            'Buksan ulit ang Moodeng sa Chrome o Safari — hindi sa browser na nasa loob ng ibang app.',
            'I-tap ulit ang Connect Wallet at aprubahan ang request kapag lumabas.'
         ]
      },
      watchOut: {
         en: 'On PLDT and Smart the sign-in is sometimes blocked by the network itself. If the page won\'t load or shows a security warning, use the instant wallet or see "Base won\'t load (PLDT / Smart)".',
         fil: 'Sa PLDT at Smart, minsan hina-block mismo ng network ang sign-in. Kung ayaw mag-load o may security warning, gamitin ang instant wallet o tingnan ang "Ayaw mag-load ng Base (PLDT / Smart)".'
      },
      keywords: ['connect wallet', 'reset', 'disconnect', 'approve']
   },
   {
      id: 'try-again-twice',
      category: 'wallet',
      emoji: '🔁',
      title: { en: '"Try again" keeps popping up', fil: 'Paulit-ulit ang "Try again"' },
      subtitle: { en: 'When you have to tap twice', fil: 'Kapag kailangang i-tap nang dalawang beses' },
      question: { en: '"Try again" keeps popping up / I have to tap twice — how do I fix it?', fil: 'Paulit-ulit ang "Try again" / kailangang i-tap ng dalawang beses — paano ayusin?' },
      steps: {
         en: [
            'Tap the connect / approve button directly — don\'t wait for it to happen automatically.',
            'Approve the pop-up when it appears.',
            'If nothing appears, redo the "Wallet won\'t connect" reset.'
         ],
         fil: [
            'I-tap nang diretso ang connect / approve button — huwag hintaying mangyari mag-isa.',
            'Aprubahan ang pop-up kapag lumabas.',
            'Kung walang lumalabas, ulitin ang reset sa "Ayaw kumonekta ng wallet".'
         ]
      },
      keywords: ['try again', 'tap twice', 'popup', 'returning user']
   },

   // ─── Adding & repaying USDC ───────────────────────────────────────────────
   {
      id: 'repay',
      category: 'money-in',
      emoji: '💸',
      title: { en: 'How to repay your loan', fil: 'Paano bayaran ang loan' },
      subtitle: { en: 'Send USDC on Base to the Repay address', fil: 'Magpadala ng USDC sa Base sa Repay address' },
      question: { en: 'How do I repay my loan?', fil: 'Paano bayaran ang loan ko?' },
      steps: {
         en: [
            'Open the Repay screen — it shows the exact amount and lets you copy the repayment address.',
            "If you don't hold USDC yet, buy some on Binance P2P, Coins.ph, PDAX, or GCrypto (GCash).",
            'Send the USDC to the repayment address, and choose Base as the network.',
            'You can pay in parts — the Repay screen has 25% / 50% / 75% / Full buttons, or a custom amount.'
         ],
         fil: [
            'Buksan ang Repay screen — ipinapakita nito ang eksaktong halaga at puwedeng kopyahin ang repayment address.',
            'Kung wala ka pang USDC, bumili sa Binance P2P, Coins.ph, PDAX, o GCrypto (GCash).',
            'Ipadala ang USDC sa repayment address, at piliin ang Base bilang network.',
            'Puwede kang magbayad nang paunti-unti — may 25% / 50% / 75% / Full na buttons ang Repay screen, o custom na halaga.'
         ]
      },
      watchOut: {
         en: 'Always select Base as the network — the wrong network can lose the funds. Repaying before the due date builds your Trust Score and unlocks higher credit levels.',
         fil: 'Laging piliin ang Base bilang network — ang maling network ay puwedeng magpawala ng pera. Ang pagbayad bago ang due date ay nagpapataas ng Trust Score at nagbubukas ng mas mataas na level.'
      },
      guide: { path: '/learn/repaying-your-loan', label: { en: 'Ways to repay your loan', fil: 'Mga paraan ng pagbayad' } },
      keywords: ['repay', 'pay back', 'due', 'binance', 'coins.ph', 'pdax']
   },
   {
      id: 'add-funds',
      category: 'money-in',
      emoji: '➕',
      title: { en: 'Add USDC to your wallet', fil: 'Magdagdag ng USDC sa wallet' },
      subtitle: { en: 'Buy on an exchange, send on Base', fil: 'Bumili sa exchange, ipadala sa Base' },
      question: { en: 'How do I add USDC to my wallet?', fil: 'Paano magdagdag ng USDC sa wallet ko?' },
      steps: {
         en: [
            'Buy USDC on an exchange you use — Binance P2P, Coins.ph, PDAX, or GCrypto (GCash).',
            'Withdraw / send it to your Moodeng wallet address.',
            'Always select USDC and the Base network when sending.'
         ],
         fil: [
            'Bumili ng USDC sa exchange na ginagamit mo — Binance P2P, Coins.ph, PDAX, o GCrypto (GCash).',
            'I-withdraw / ipadala ito sa Moodeng wallet address mo.',
            'Laging piliin ang USDC at ang Base network kapag nagpapadala.'
         ]
      },
      watchOut: {
         en: 'Sending on the wrong network can result in lost funds — always choose Base.',
         fil: 'Ang pagpadala sa maling network ay puwedeng magpawala ng pera — laging piliin ang Base.'
      },
      guide: { path: '/learn/adding-funds-to-your-wallet', label: { en: 'Ways to add USDC', fil: 'Mga paraan ng pagdagdag ng USDC' } },
      keywords: ['add funds', 'buy usdc', 'deposit', 'top up', 'on-ramp']
   },
   {
      id: 'paying-in-parts',
      category: 'money-in',
      emoji: '🧩',
      title: { en: 'Paying in parts', fil: 'Pagbayad nang paunti-unti' },
      subtitle: { en: 'Some now, some later', fil: 'Konti ngayon, konti mamaya' },
      question: { en: 'Can I pay my loan in parts?', fil: 'Puwede bang hulugan ang loan?' },
      intro: {
         en: 'Yes. The Repay screen has 25% / 50% / 75% / Full buttons or a custom amount, and the loan stays active until it is fully paid. Partial on-time payments still help your Trust Score — about 7 points for 75% paid, 5 for 50%, 3 for 25% — while a full on-time payment earns the most (10). If part of the payment lands after the due date, that late part earns 0 points, but the amount you owe never grows: no late fees, no rollover. Paying as much as you can before the due date is always better than nothing.',
         fil: 'Oo. May 25% / 50% / 75% / Full na buttons ang Repay screen o custom na halaga, at aktibo pa rin ang loan hangga\'t hindi pa buo ang bayad. Ang partial na on-time na bayad ay nakakatulong pa rin sa Trust Score — mga 7 puntos sa 75%, 5 sa 50%, 3 sa 25% — habang pinakamalaki ang buong on-time na bayad (10). Kung may bahaging huli sa due date, 0 puntos iyon, pero hindi lumalaki ang utang mo: walang late fee, walang rollover. Mas mabuti ang bayad nang kaya mo bago ang due date kaysa wala.'
      },
      keywords: ['partial', 'installment', 'hulugan', 'part payment']
   },
   {
      id: 'multiple-loans',
      category: 'money-in',
      emoji: '🔢',
      title: { en: 'More than one loan at a time', fil: 'Higit sa isang loan nang sabay' },
      subtitle: { en: 'Yes, within your available limit', fil: 'Oo, hangga\'t kasya sa limit' },
      question: { en: 'Can I have more than one loan at a time?', fil: 'Puwede bang higit sa isang loan nang sabay?' },
      intro: {
         en: 'Yes — you can have more than one active loan at the same time, as long as the new amount fits within your available credit limit. Your available limit is your current level\'s limit (anywhere from $15 up to $140) minus what you already owe on active loans. If your current loans already use your whole limit, repay some or all before requesting more. Some accounts may also have a cap on how many loans can be active at once — if the app says you\'ve reached your maximum, repay one first.',
         fil: 'Oo — puwede kang magkaroon ng higit sa isang aktibong loan nang sabay, basta kasya ang bagong halaga sa available na limit mo. Ang available na limit ay ang limit ng kasalukuyang level mo (mula $15 hanggang $140) bawas ang utang mo sa aktibong loans. Kung nagamit na ng kasalukuyang loans ang buong limit, magbayad muna bago humiling ng iba. May mga account din na may cap kung ilang loan ang puwedeng aktibo — kung sabi ng app na umabot ka na sa max, magbayad muna ng isa.'
      },
      keywords: ['two loans', 'multiple', 'second loan', 'at once']
   },

   // ─── Cashing out ──────────────────────────────────────────────────────────
   {
      id: 'cash-out',
      category: 'cash-out',
      emoji: '🏦',
      title: { en: 'Cash out to GCash or a bank', fil: 'Mag-cash out sa GCash o bank' },
      subtitle: { en: 'USDC → pesos, step by step', fil: 'USDC → pesos, hakbang-hakbang' },
      question: { en: 'How do I cash out to GCash or my bank?', fil: 'Paano mag-cash out sa GCash o sa bank ko?' },
      steps: {
         en: [
            'Send your USDC to an exchange or service — GCrypto (GCash), Coins.ph, PDAX, or Binance P2P.',
            'When sending, always choose Base as the network.',
            'Sell the USDC there, then withdraw pesos to your bank or e-wallet.'
         ],
         fil: [
            'Ipadala ang USDC mo sa exchange o serbisyo — GCrypto (GCash), Coins.ph, PDAX, o Binance P2P.',
            'Kapag nagpapadala, laging piliin ang Base bilang network.',
            'Ibenta ang USDC doon, tapos i-withdraw ang piso sa bank o e-wallet mo.'
         ]
      },
      watchOut: {
         en: 'Choosing the wrong network can lose the funds — this is the single most important detail. Moodeng charges $0 to cash out; the only cost is the exchange\'s own fee.',
         fil: 'Ang maling network ay puwedeng magpawala ng pera — ito ang pinakaimportanteng detalye. $0 ang singil ng Moodeng sa cash out; ang bayad lang ay sa exchange mismo.'
      },
      guide: { path: '/learn/withdrawing-to-your-bank', label: { en: 'Withdrawing to a bank account', fil: 'Pag-withdraw sa bank account' } },
      keywords: ['cash out', 'withdraw', 'gcash', 'bank', 'off-ramp', 'pesos', 'coins.ph']
   },
   {
      id: 'cash-out-cost',
      category: 'cash-out',
      emoji: '🧮',
      title: { en: 'How much does cashing out cost?', fil: 'Magkano ang cash out?' },
      subtitle: { en: 'Moodeng charges $0; exchanges have a small fee', fil: '$0 sa Moodeng; may maliit na fee ang exchange' },
      question: { en: 'How much does it cost to cash out?', fil: 'Magkano ang gastos sa pag-cash out?' },
      intro: {
         en: 'Moodeng itself charges $0 — the only cost is the exchange\'s conversion fee. Coins.ph is the cheapest route we\'ve found in the Philippines: about 0.70% for a full round trip. For a $15 loan taken out and repaid, the all-in cost through Coins.ph is roughly ₱6.50 (about $0.10) — a small trading fee each way, a free PESONet bank cash-out, and the tiny network fee. If you want the pesos instantly, InstaPay adds a flat ₱5 (round trip ≈ ₱11.50, about $0.19). Other services build their margin into the rate, so they usually cost more.',
         fil: '$0 ang singil ng Moodeng mismo — ang tanging gastos ay ang conversion fee ng exchange. Ang Coins.ph ang pinakamura na nakita namin sa Pilipinas: mga 0.70% para sa buong round trip. Sa $15 na loan na hiniram at binayaran, ang all-in na gastos sa Coins.ph ay mga ₱6.50 (mga $0.10) — maliit na trading fee bawat direksyon, libreng PESONet bank cash-out, at maliit na network fee. Kung gusto mo agad ang piso, may flat na ₱5 ang InstaPay (round trip ≈ ₱11.50, mga $0.19). Ang ibang serbisyo ay nasa rate na ang margin nila, kaya kadalasan mas mahal.'
      },
      keywords: ['cash out cost', 'fee', 'how much', 'coins.ph fee', 'instapay']
   },

   // ─── Credit & Trust Score ─────────────────────────────────────────────────
   {
      id: 'trust-score',
      category: 'credit',
      emoji: '⭐',
      title: { en: 'What is a Trust Score?', fil: 'Ano ang Trust Score?' },
      subtitle: { en: 'Your repayment reputation', fil: 'Ang reputasyon mo sa pagbayad' },
      question: { en: 'What is a Trust Score and how is it calculated?', fil: 'Ano ang Trust Score at paano ito kinakalkula?' },
      intro: {
         en: 'Your Trust Score reflects how reliably you repay loans. It rises with on-time, in-full repayments and drops with late payments or defaults. Lenders use it to gauge risk when deciding whether to fund your requests. Because it is tied to your wallet, it travels with you — it is not locked inside one app.',
         fil: 'Ipinapakita ng Trust Score mo kung gaano ka kaaasahan sa pagbayad. Tumataas ito sa on-time at buong bayad at bumababa sa huli o default. Ginagamit ito ng lenders para tantiyahin ang risk kapag magdedesisyon silang i-fund ka. Dahil nakakabit ito sa wallet mo, kasama mo ito — hindi nakakulong sa iisang app.'
      },
      guide: { path: '/learn/understanding-your-trust-score', label: { en: 'Understanding your Trust Score', fil: 'Pag-unawa sa Trust Score' } },
      keywords: ['trust score', 'reputation', 'ts']
   },
   {
      id: 'credit-level',
      category: 'credit',
      emoji: '🎚️',
      title: { en: 'What is a Credit Level?', fil: 'Ano ang Credit Level?' },
      subtitle: { en: '$15 up to $140, step by step', fil: '$15 hanggang $140, hakbang-hakbang' },
      question: { en: 'What is a Credit Level and how do I move up?', fil: 'Ano ang Credit Level at paano tumaas?' },
      intro: {
         en: 'Credit Levels control how much you can borrow at a time. Everyone starts at Level 1 with a $15 limit. You move up by completing a Credit-Building Loan — a loan at your full current limit, repaid in full and on time. Each one raises your limit along the ladder: $15 → $20 → $40 → $60 → $80 → $100 → $120 → $140, which is the current maximum.',
         fil: 'Kinokontrol ng Credit Level kung magkano ang mahihiram mo nang sabay. Lahat ay nagsisimula sa Level 1 na may $15 limit. Tumataas ka sa pamamagitan ng Credit-Building Loan — loan sa buong kasalukuyang limit mo, binayaran nang buo at on time. Bawat isa ay nagtataas ng limit sa hagdan: $15 → $20 → $40 → $60 → $80 → $100 → $120 → $140, na siyang kasalukuyang maximum.'
      },
      guide: { path: '/learn/how-credit-levels-work', label: { en: 'How Credit Levels work', fil: 'Paano gumagana ang Credit Levels' } },
      keywords: ['credit level', 'limit', 'level up', 'increase limit']
   },
   {
      id: 'grow-limit',
      category: 'credit',
      emoji: '📈',
      title: { en: 'Grow my credit limit', fil: 'Palakihin ang credit limit' },
      subtitle: { en: 'From $15 upward', fil: 'Mula $15 pataas' },
      question: { en: 'How do I increase my credit limit?', fil: 'Paano tumaas ang credit limit ko?' },
      steps: {
         en: [
            'Repay on time. On-time repayment earns Trust Points, which move you up the levels.',
            'To move up a level, take a Credit-Building Loan — a loan at your full current limit — and repay it in full and on time.',
            'Credit levels run $15 → $20 → $40 → $60 → $80 → $100 → $120 → $140.',
            'A referral code adds $5 to your starting limit — entered at the start of the loan application.'
         ],
         fil: [
            'Magbayad on time. Ang on-time na bayad ay may Trust Points na nagtataas ng level mo.',
            'Para tumaas ng level, kumuha ng Credit-Building Loan — loan sa buong kasalukuyang limit — at bayaran nang buo at on time.',
            'Ang credit levels ay $15 → $20 → $40 → $60 → $80 → $100 → $120 → $140.',
            'May dagdag na $5 sa starting limit mo ang referral code — inilalagay sa simula ng loan application.'
         ]
      },
      guide: { path: '/learn/how-credit-levels-work', label: { en: 'How Credit Levels work', fil: 'Paano gumagana ang Credit Levels' } },
      keywords: ['increase limit', 'grow', 'higher limit', 'level up']
   },
   {
      id: 'credit-vs-trust-loans',
      category: 'credit',
      emoji: '⚖️',
      title: { en: 'Credit-Building vs Trust-Building loans', fil: 'Credit-Building vs Trust-Building loans' },
      subtitle: { en: 'Which one raises your limit', fil: 'Alin ang nagtataas ng limit' },
      question: { en: "What's the difference between Credit-Building and Trust-Building loans?", fil: 'Ano ang pagkakaiba ng Credit-Building at Trust-Building loans?' },
      intro: {
         en: 'There are two kinds of loans. A Credit-Building Loan is at your full current limit — repaying one on time raises your limit and unlocks the next level. A Trust-Building Loan is any smaller loan below your limit; it still grows your repayment record and reputation with lenders, but it does not raise your Credit Level. Most borrowers use both — trust loans to keep activity healthy, credit loans to grow the limit.',
         fil: 'May dalawang uri ng loan. Ang Credit-Building Loan ay nasa buong kasalukuyang limit mo — kapag binayaran on time, tumataas ang limit at nabubuksan ang susunod na level. Ang Trust-Building Loan ay kahit anong mas maliit sa limit mo; nagpapalago pa rin ito ng record at reputasyon sa lenders, pero hindi nito itinataas ang Credit Level. Karamihan ay gumagamit ng pareho — trust loans para aktibo, credit loans para lumaki ang limit.'
      },
      guide: { path: '/learn/trust-building-vs-credit-building-loans', label: { en: 'Trust-Building vs Credit-Building', fil: 'Trust-Building vs Credit-Building' } },
      keywords: ['credit building', 'trust building', 'full limit', 'difference']
   },
   {
      id: 'repayments-affect-score',
      category: 'credit',
      emoji: '🧾',
      title: { en: 'How repayments affect your score', fil: 'Epekto ng bayad sa score' },
      subtitle: { en: 'On-time full = the most points', fil: 'Buong on-time = pinakamaraming puntos' },
      question: { en: 'How do repayments affect my Trust Score?', fil: 'Paano naaapektuhan ng bayad ang Trust Score ko?' },
      intro: {
         en: 'Every repayment affects your Trust Score, and small loans repaid cleanly are worth more than large loans repaid sloppily. On-time, full repayment earns the maximum 10 points. Partial repayments earn proportionally — 75% = 7, 50% = 5, 25% = 3. Any payment after the deadline earns 0 for that transaction. A default leaves a permanent mark on your public profile, visible to all future lenders.',
         fil: 'Bawat bayad ay may epekto sa Trust Score mo, at mas mahalaga ang maliliit na loan na malinis na binayaran kaysa malalaking loan na palpak. Ang on-time at buong bayad ay may pinakamataas na 10 puntos. Ang partial ay proporsyonal — 75% = 7, 50% = 5, 25% = 3. Ang bayad na huli sa deadline ay 0 para sa transaksyong iyon. Ang default ay nag-iiwan ng permanenteng marka sa public profile mo, nakikita ng lahat ng lender sa hinaharap.'
      },
      guide: { path: '/learn/how-repayments-affect-your-trust-score', label: { en: 'How repayments affect your score', fil: 'Epekto ng bayad sa score' } },
      keywords: ['trust points', 'scoring', 'on time', 'late', 'default']
   },
   {
      id: 'referral-code',
      category: 'credit',
      emoji: '🎟️',
      title: { en: 'Where do I put a referral code?', fil: 'Saan ilalagay ang referral code?' },
      subtitle: { en: '+$5 to your starting limit', fil: '+$5 sa starting limit mo' },
      question: { en: 'Where do I enter a referral code?', fil: 'Saan ko ilalagay ang referral code?' },
      steps: {
         en: [
            'From the Request Board, tap to apply for a loan.',
            'The first step of the application asks for a referral code — type it and tap "Apply code". (This step only appears for verified borrowers.)',
            'No code? Just tap "Continue to application" — the code is optional and there is no penalty for skipping it.'
         ],
         fil: [
            'Mula sa Request Board, i-tap para mag-apply ng loan.',
            'Hihingin ng unang hakbang ang referral code — i-type ito at i-tap ang "Apply code". (Lalabas lang ito para sa verified na borrower.)',
            'Walang code? I-tap lang ang "Continue to application" — opsyonal ang code at walang parusa kung laktawan mo.'
         ]
      },
      watchOut: {
         en: 'A valid referral code adds $5 to your starting credit limit — so a new borrower who normally starts at $15 would start at $20.',
         fil: 'Ang balidong referral code ay nagdadagdag ng $5 sa starting limit mo — kaya ang bagong borrower na karaniwang nasa $15 ay magsisimula sa $20.'
      },
      keywords: ['referral', 'code', 'promo', 'invite', 'bonus']
   },

   // ─── Writing a loan request ───────────────────────────────────────────────
   {
      id: 'reason-in-english',
      category: 'writing-request',
      emoji: '🌏',
      title: { en: 'It says "write it in English"', fil: 'Sabi "write it in English"' },
      subtitle: { en: 'Why, and how to fix it', fil: 'Bakit, at paano ayusin' },
      question: { en: 'My loan reason says to write it in English — what should I do?', fil: 'Sabi ng dahilan ko isulat sa English — ano ang gagawin ko?' },
      intro: {
         en: 'Lenders on Moodeng are in the US and Europe, so a loan reason has to be in English — a request they can\'t read doesn\'t get funded. Tagalog, Taglish, and Bisaya are the usual cause; the form stops there until it\'s rewritten. A borrowed word inside an English sentence is fine ("buying gamot for my mother") — it\'s whole sentences in another language that stop the form. The same applies to "Describe your situation" in the bio step, though the job title itself can stay local ("sari-sari store owner", "jeepney driver").',
         fil: 'Ang mga lender sa Moodeng ay nasa US at Europe, kaya kailangang English ang dahilan ng loan — hindi nafu-fund ang request na hindi nila mabasa. Tagalog, Taglish, at Bisaya ang karaniwang dahilan; hihinto ang form hangga\'t hindi naisusulat muli. Okay lang ang hiram na salita sa loob ng English na pangungusap ("buying gamot for my mother") — ang buong pangungusap sa ibang wika ang humihinto sa form. Pareho rin sa "Describe your situation" sa bio step, pero puwedeng lokal ang job title ("sari-sari store owner", "jeepney driver").'
      },
      keywords: ['english', 'tagalog', 'language', 'reason', 'translate']
   },
   {
      id: 'reason-too-vague',
      category: 'writing-request',
      emoji: '🔍',
      title: { en: 'My reason is "too vague"', fil: 'Masyadong "vague" ang dahilan ko' },
      subtitle: { en: "It's a nudge, not a block", fil: 'Paalala lang, hindi harang' },
      question: { en: "My reason is in English but it still says it's too vague — what do I do?", fil: 'English na ang dahilan ko pero sabi masyadong vague pa rin — ano ang gagawin ko?' },
      intro: {
         en: 'That\'s a different check — the reason names nothing specific ("for personal use", "for my needs"). It\'s a nudge, not a block: the field tells you what to add, and tapping "Make Your Request" a second time posts it anyway. Better to say what the money is actually for and when you get paid — specific reasons get funded more.',
         fil: 'Ibang check iyon — walang tinutukoy na tiyak ang dahilan ("for personal use", "for my needs"). Paalala lang, hindi harang: sinasabi ng field kung ano ang idagdag, at kapag na-tap mo ang "Make Your Request" sa pangalawang beses, mapo-post pa rin. Mas mabuti sabihin kung para saan talaga ang pera at kailan ka sasahod — mas nafu-fund ang tiyak na dahilan.'
      },
      keywords: ['vague', 'reason', 'specific', 'weak']
   },
   {
      id: 'make-request-does-nothing',
      category: 'writing-request',
      emoji: '🚫',
      title: { en: '"Make Your Request" does nothing', fil: 'Walang nangyayari sa "Make Your Request"' },
      subtitle: { en: "You're not verified yet", fil: 'Hindi ka pa verified' },
      question: { en: '"Make Your Request" does nothing when I tap it — why?', fil: 'Walang nangyayari kapag na-tap ko ang "Make Your Request" — bakit?' },
      intro: {
         en: "You aren't verified yet. Tapping the greyed button shakes it and highlights a note above it with a Verify Yourself button attached. Verification is the last step before a request can be sent — complete Verify Your ID and the button activates.",
         fil: 'Hindi ka pa verified. Kapag na-tap mo ang naka-grey na button, mayayanig ito at magha-highlight ng paalala sa itaas na may Verify Yourself button. Ang verification ang huling hakbang bago makapagpadala ng request — kumpletuhin ang Verify Your ID at gagana ang button.'
      },
      guide: { path: '/learn/verification-and-why-its-required', label: { en: 'Verification & Security', fil: 'Verification at Security' } },
      keywords: ['make request', 'button', 'grey', 'nothing happens', 'disabled']
   },

   // ─── Safety & your account ────────────────────────────────────────────────
   {
      id: 'defaults',
      category: 'safety',
      emoji: '⚠️',
      title: { en: 'What happens if a loan is unpaid?', fil: 'Ano kung hindi nabayaran ang loan?' },
      subtitle: { en: 'Default: a permanent public mark', fil: 'Default: permanenteng public na marka' },
      question: { en: 'What happens if I default on a loan?', fil: 'Ano ang mangyayari kung ma-default ang loan ko?' },
      intro: {
         en: 'If a loan isn\'t repaid it can go into default. A default is a permanent public mark on your record, and your account is frozen from new borrowing until things are resolved — a defaulted or overdue borrower is sent to an account-support screen with a Repay Now option at sign-in. The amount owed still never grows (no late fees, no rollover), and Moodeng never contacts family, friends, or coworkers. If your account is frozen and you think it\'s a mistake, message the team.',
         fil: 'Kung hindi mabayaran ang loan, puwede itong mapunta sa default. Ang default ay permanenteng public na marka sa record mo, at na-freeze ang account mo sa bagong paghiram hangga\'t hindi naaayos — ang defaulted o overdue na borrower ay dinadala sa account-support screen na may Repay Now sa pag-sign in. Hindi pa rin lumalaki ang utang (walang late fee, walang rollover), at hindi kailanman kinokontak ng Moodeng ang pamilya, kaibigan, o katrabaho. Kung na-freeze ang account mo at sa tingin mo mali ito, i-message ang team.'
      },
      keywords: ['default', 'unpaid', 'overdue', 'frozen', 'blocked account']
   },
   {
      id: 'safety-reminders',
      category: 'safety',
      emoji: '🛡️',
      title: { en: 'Staying safe on Moodeng', fil: 'Manatiling ligtas sa Moodeng' },
      subtitle: { en: 'The rules that are always true', fil: 'Ang mga tuntuning laging totoo' },
      question: { en: 'How do I stay safe and avoid scams?', fil: 'Paano manatiling ligtas at maiwasan ang scam?' },
      intro: {
         en: 'A few things are always true. Moodeng never holds or moves your money — loans go wallet-to-wallet directly between lender and borrower. Always send USDC on the Base network; the wrong network means lost funds. A Base Account is seedless, so Moodeng will never ask for a "seed phrase" or "recovery phrase" — and no legitimate helper ever will. When you\'re unsure, it\'s always safe to wait and ask rather than guess, especially before sending funds.',
         fil: 'May ilang bagay na laging totoo. Hindi kailanman hinahawakan o inililipat ng Moodeng ang pera mo — dumadaan ang loans wallet-to-wallet nang diretso sa pagitan ng lender at borrower. Laging ipadala ang USDC sa Base network; ang maling network ay nawawalang pera. Ang Base Account ay seedless, kaya hindi kailanman hihingin ng Moodeng ang "seed phrase" o "recovery phrase" — at walang lehitimong katulong ang hihingi nito. Kapag hindi ka sigurado, laging ligtas na maghintay at magtanong kaysa manghula, lalo na bago magpadala ng pera.'
      },
      keywords: ['safety', 'scam', 'seed phrase', 'recovery phrase', 'security']
   },
   {
      id: 'account-settings',
      category: 'safety',
      emoji: '⚙️',
      title: { en: 'Manage your account', fil: 'I-manage ang account mo' },
      subtitle: { en: 'Name, email, password, sign out', fil: 'Pangalan, email, password, sign out' },
      question: { en: 'How do I manage my account and security settings?', fil: 'Paano i-manage ang account at security settings ko?' },
      intro: {
         en: 'Your account is tied to your wallet, so wallet security is account security. From the Account screen you can update your display name, manage your email, change your password, and sign out. If you use the instant wallet, that\'s also where you export your wallet key (Account → Account Settings → Wallet).',
         fil: 'Nakakabit ang account mo sa wallet, kaya ang seguridad ng wallet ay seguridad ng account. Mula sa Account screen puwede mong baguhin ang display name, i-manage ang email, palitan ang password, at mag-sign out. Kung instant wallet ang gamit mo, doon mo rin ie-export ang wallet key (Account → Account Settings → Wallet).'
      },
      guide: { path: '/learn/managing-your-account-and-security-settings', label: { en: 'Managing your account', fil: 'Pag-manage ng account' } },
      keywords: ['account', 'settings', 'password', 'email', 'display name', 'sign out']
   }
];
