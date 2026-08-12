import type { LocalizedText } from '@/i18n/localizedText';

// The six things borrowers actually ask, answered in place.
//
// These used to be buttons that only opened a chat. That put a person in a
// queue for questions we can answer instantly, and — because the answer sat
// behind a wait — most people never got one. So the answer is here, on the page,
// and the human channels are the escape hatch underneath it rather than the
// first step.
//
// SOURCE OF TRUTH: every answer below is a condensed version of
// tools/support-knowledge/troubleshooting.md, the hand-maintained file George
// and Emma keep from real Messenger/Telegram threads (and which the old support
// bot read verbatim). Do not invent new guidance here — fix it there first,
// then mirror it, so the page and the bot never drift apart.
//
// COPY RULES carried over from that file: the ID check is always "Verify Your
// ID" (never "KYC"), and we never give financial advice — how-to only.

export interface HelpTopic {
   id: string;
   emoji: string;
   title: LocalizedText;
   subtitle: LocalizedText;
   /** Sent to the agent as chat context, and pre-filled into Telegram. */
   question: LocalizedText;
   /** Rendered as an ordered list when the answer is a sequence of steps. */
   steps: { en: string[]; fil: string[] };
   /** The one thing people get wrong on this topic. Rendered as a callout. */
   watchOut?: LocalizedText;
   /** In-app guide with the long version. */
   guide?: { path: string; label: LocalizedText };
}

export const HELP_TOPICS: HelpTopic[] = [
   {
      id: 'verify-id',
      emoji: '🪪',
      title: { en: 'Verify your ID', fil: 'I-verify ang ID mo' },
      subtitle: { en: 'The quick 3-minute check', fil: 'Mabilis na 3-minutong check' },
      question: { en: 'How do I verify my ID?', fil: 'Paano i-verify ang ID ko?' },
      steps: {
         en: [
            'In the app, tap "Verify Yourself".',
            'Choose "Verify Your ID" — a photo of your national ID plus a selfie. It takes about 3 minutes.',
            'Already use World App? You can choose "Verify with World ID" instead.',
            'Most checks finish within minutes.'
         ],
         fil: [
            'Sa app, i-tap ang "Verify Yourself".',
            'Piliin ang "Verify Your ID" — larawan ng national ID mo at isang selfie. Mga 3 minuto lang.',
            'Gumagamit ka na ba ng World App? Puwede mong piliin ang "Verify with World ID".',
            'Karamihan ay tapos na sa loob ng ilang minuto.'
         ]
      },
      watchOut: {
         en: 'Signing up and getting verified are two separate steps — signing up alone is not enough. If it gets stuck, retry in Chrome or Safari (not a browser inside Facebook or Messenger) and make sure the photo is clear and well lit.',
         fil: 'Magkaibang hakbang ang pag-sign up at ang pag-verify — hindi sapat ang sign up lang. Kung na-stuck, subukan ulit sa Chrome o Safari (hindi sa browser na nasa loob ng Facebook o Messenger) at siguraduhing malinaw at maliwanag ang larawan.'
      },
      guide: { path: '/learn/verification-and-why-its-required', label: { en: 'Verification & Security', fil: 'Verification at security' } }
   },
   {
      id: 'cash-out',
      emoji: '🏦',
      title: { en: 'Cash out to a bank', fil: 'Mag-cash out sa bank' },
      subtitle: { en: 'USDC → pesos, step by step', fil: 'USDC → pesos, hakbang-hakbang' },
      question: { en: 'How do I cash out to GCash or my bank?', fil: 'Paano mag-cash out sa GCash o sa bank ko?' },
      steps: {
         en: [
            'You borrow USDC on the Base network. To turn it into pesos, send it to an exchange — GCrypto (GCash), Coins.ph, PDAX or Binance P2P.',
            'When sending, always choose "Base" as the network.',
            'Sell the USDC there, then withdraw pesos to your bank or e-wallet.'
         ],
         fil: [
            'Nangungutang ka ng USDC sa Base network. Para gawing piso, ipadala ito sa exchange — GCrypto (GCash), Coins.ph, PDAX o Binance P2P.',
            'Kapag nagpapadala, laging piliin ang "Base" bilang network.',
            'Ibenta ang USDC doon, tapos i-withdraw ang piso sa bank o e-wallet mo.'
         ]
      },
      watchOut: {
         en: 'Choosing the wrong network can lose the funds — this is the single most important detail. Moodeng charges $0 to cash out; the only cost is the exchange’s own fee.',
         fil: 'Kapag mali ang napiling network, puwedeng mawala ang pera — ito ang pinakaimportanteng detalye. $0 ang singil ng Moodeng sa cash out; ang bayad lang ay sa exchange mismo.'
      },
      guide: { path: '/learn/withdrawing-to-your-bank', label: { en: 'Withdrawing to a bank account', fil: 'Pag-withdraw sa bank account' } }
   },
   {
      id: 'wallet-connect',
      emoji: '🔗',
      title: { en: "Wallet won't connect", fil: 'Ayaw kumonekta ng wallet' },
      subtitle: { en: 'The reset that works', fil: 'Ang reset na gumagana' },
      question: {
         en: "My wallet won't connect to Moodeng — what do I do?",
         fil: 'Ayaw kumonekta ng wallet ko sa Moodeng — ano ang gagawin ko?'
      },
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
         en: 'On PLDT and Smart, the Base sign-in is sometimes blocked by the network itself — the page just will not load, or you see a security warning. If that is happening, borrowers can tap "Create your wallet instantly" on the wallet screen instead: no app, no seed phrase, and we cover the network fees.',
         fil: 'Sa PLDT at Smart, minsan hina-block mismo ng network ang Base sign-in — hindi lang mag-lo-load ang page, o may lalabas na security warning. Kung ganito, puwedeng i-tap ng borrower ang "Create your wallet instantly" sa wallet screen: walang app, walang seed phrase, at kami na ang sumasagot sa network fees.'
      }
   },
   {
      id: 'repay',
      emoji: '💸',
      title: { en: 'How to repay', fil: 'Paano magbayad' },
      subtitle: { en: 'Buy USDC + send on Base', fil: 'Bumili ng USDC + ipadala sa Base' },
      question: { en: 'How do I repay my loan?', fil: 'Paano bayaran ang loan ko?' },
      steps: {
         en: [
            "If you don't hold USDC yet, buy some on Binance P2P, Coins.ph, PDAX or GCrypto.",
            'Send it on the Base network to the repayment address shown on your Repay screen.',
            'You can pay in parts — the Repay screen has 25% / 50% / 75% / Full buttons, or a custom amount.'
         ],
         fil: [
            'Kung wala ka pang USDC, bumili sa Binance P2P, Coins.ph, PDAX o GCrypto.',
            'Ipadala ito sa Base network papunta sa repayment address na nakikita sa Repay screen mo.',
            'Puwede kang magbayad nang paunti-unti — may 25% / 50% / 75% / Full na buttons ang Repay screen, o custom na halaga.'
         ]
      },
      watchOut: {
         en: 'Repaying before the due date builds your Trust Score and unlocks higher credit levels. Paying part of it on time still helps — and what you owe never grows: no late fees, no rollover.',
         fil: 'Ang pagbayad bago ang due date ay nagpapataas ng Trust Score mo at nagbubukas ng mas mataas na credit level. Kahit bahagi lang ang nabayaran on time, may naitutulong pa rin — at hindi lumalaki ang utang mo: walang late fee, walang rollover.'
      },
      guide: { path: '/learn/repaying-your-loan', label: { en: 'Ways to repay your loan', fil: 'Mga paraan ng pagbayad' } }
   },
   {
      id: 'credit-limit',
      emoji: '📈',
      title: { en: 'Grow my credit limit', fil: 'Palakihin ang credit limit' },
      subtitle: { en: 'From $15 upward', fil: 'Mula $15 pataas' },
      question: { en: 'How do I increase my credit limit?', fil: 'Paano tumaas ang credit limit ko?' },
      steps: {
         en: [
            'Repay on time. On-time repayment earns Trust Points, and Trust Points move you up the credit levels.',
            'Credit levels run $15 → $20 → $40 → $60.',
            'A full on-time repayment earns the most; a partial on-time payment still earns some.',
            'A referral code adds $5 to your starting limit — entered at the start of the loan application.'
         ],
         fil: [
            'Magbayad on time. Ang on-time na pagbayad ay may Trust Points, at ang Trust Points ang nagtataas ng credit level mo.',
            'Ang credit levels ay $15 → $20 → $40 → $60.',
            'Pinakamalaki ang points sa buong bayad na on time; may points pa rin ang bahagyang bayad na on time.',
            'May dagdag na $5 sa starting limit mo ang referral code — inilalagay sa simula ng loan application.'
         ]
      },
      watchOut: {
         en: 'You can hold more than one loan at once, as long as the new amount fits inside your remaining limit — your level’s limit minus what you already owe.',
         fil: 'Puwede kang magkaroon ng higit sa isang loan nang sabay, basta kasya ang bagong halaga sa natitira mong limit — ang limit ng level mo bawas ang kasalukuyang utang.'
      },
      guide: { path: '/learn/how-credit-levels-work', label: { en: 'How Credit Levels work', fil: 'Paano gumagana ang credit levels' } }
   },
   {
      id: 'coinbase-vs-base',
      emoji: '🟣',
      title: { en: 'Coinbase vs Base', fil: 'Coinbase vs Base' },
      subtitle: { en: 'Which one do I need?', fil: 'Alin ang kailangan ko?' },
      question: {
         en: 'Do I need the Coinbase app or a Base Account?',
         fil: 'Kailangan ko ba ang Coinbase app o Base Account?'
      },
      steps: {
         en: [
            'You need a Base Account. Create it at account.base.app.',
            'You do not need the Coinbase app. Base is a network built by Coinbase, but the app is a different thing.',
            'A Base Account is passwordless and seedless — you sign in with email or a passkey.'
         ],
         fil: [
            'Base Account ang kailangan mo. Gawin ito sa account.base.app.',
            'Hindi mo kailangan ang Coinbase app. Ang Base ay network na ginawa ng Coinbase, pero magkaibang bagay ang app.',
            'Ang Base Account ay walang password at walang seed phrase — email o passkey ang gamit sa pag-sign in.'
         ]
      },
      watchOut: {
         en: 'Because it is seedless, there is no 12-word recovery phrase to lose — and Moodeng will never ask you for a seed or recovery phrase. Nobody legitimate ever will.',
         fil: 'Dahil walang seed, walang 12-word recovery phrase na puwedeng mawala — at hindi kailanman hihingin ng Moodeng ang seed o recovery phrase mo. Walang lehitimong tao ang hihingi nito.'
      },
      guide: { path: '/learn/using-usdc-on-moodeng-credit', label: { en: 'Using USDC on Moodeng', fil: 'Paggamit ng USDC sa Moodeng' } }
   }
];
