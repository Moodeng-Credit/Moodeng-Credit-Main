import { type JSX, useState } from 'react';

import { Link } from 'react-router-dom';

import { usePageSeo } from '@/hooks/usePageSeo';

import NeedMoreHelp from '@/views/support/components/NeedMoreHelp';
import '@/views/support/QrCashoutGuide.css';

// Shareable guide for the cash-out to your own bank's QR (/withdraw?to=qr). Public at
// /learn/cash-out-with-your-bank-qr (no login), and the same page opens in-app from Support → Guides.
// English + Filipino toggle; few words per step, one gold button.

export const QR_CASHOUT_GUIDE_SLUG = 'cash-out-with-your-bank-qr';
const CASHOUT_LINK = '/withdraw?to=qr';

type Lang = 'en' | 'fil';

type Step = { title: string; text: string; path?: string; img?: string };

const COPY: Record<
   Lang,
   {
      eyebrow: string;
      title: string;
      lead: string;
      chips: string[];
      needTitle: string;
      need: string[];
      stepsTitle: string;
      steps: Step[];
      firstTitle: string;
      first: string[];
      feesTitle: string;
      fees: string;
      helpTitle: string;
      help: { q: string; a: string }[];
      cta: string;
      ctaNote: string;
   }
> = {
   en: {
      eyebrow: 'Cash out guide',
      title: 'Cash out to your bank with a QR',
      lead: 'Turn your USDC into pesos, straight to your own bank. All you need is the QR from your bank app.',
      chips: ['₱50 – ₱5,000', 'Any InstaPay bank', 'Moodeng fee ₱0'],
      needTitle: 'What you need',
      need: ['USDC in your Moodeng wallet', 'A PH bank app with InstaPay / QR Ph', 'The QR must be in your own name'],
      stepsTitle: 'How to do it',
      steps: [
         {
            title: 'Open your bank app',
            text: 'BPI, BDO, UnionBank, Tonik, GoTyme, Maya Bank… any bank with InstaPay.',
            img: '/cashout-guides/qr/step1-receive.svg'
         },
         {
            title: 'Save your Receive QR',
            path: 'Receive → QR Ph → Save QR',
            text: 'A screenshot works too.',
            img: '/cashout-guides/qr/step2-save.svg'
         },
         {
            title: 'Open Moodeng → Withdraw',
            path: 'Withdraw → Your bank’s QR',
            text: 'Tap “Upload your QR” and pick the picture. Or scan it with the camera.'
         },
         {
            title: 'Type the pesos',
            text: 'From ₱50 up to ₱5,000. Then tap “Get my price”.'
         },
         {
            title: 'Check the price, then Confirm',
            text: 'You see what you send, each fee, and what you get. Nothing moves until you tap Confirm.'
         },
         {
            title: 'Wait for the pesos',
            text: 'Usually a few minutes. You can leave the page; it keeps going.'
         }
      ],
      firstTitle: 'First time only',
      first: [
         'Type your email and the code we send.',
         'Tap “Use my Moodeng ID” so you don’t do the ID check again.',
         'Fill a short form: phone and nationality.'
      ],
      feesTitle: 'Fees',
      fees: 'About 2–3% in total, paid to Stableyard and their payout partner. Moodeng takes ₱0. The exact amount is on the price screen before you confirm.',
      helpTitle: 'If something goes wrong',
      help: [
         { q: '“This QR can’t be used yet.”', a: 'Tap “Use my account number instead”, or message us.' },
         { q: '“No QR in that picture.”', a: 'Save the QR again or take a clearer screenshot.' },
         { q: '“More than you have.”', a: 'Lower the pesos, or tap “All”.' }
      ],
      cta: 'Cash out now',
      ctaNote: 'Opens Moodeng. Log in if asked.'
   },
   fil: {
      eyebrow: 'Gabay sa cash out',
      title: 'Mag-cash out sa bank mo gamit ang QR',
      lead: 'Gawing piso ang USDC mo, diretso sa sarili mong bank. Kailangan mo lang ang QR galing sa bank app mo.',
      chips: ['₱50 – ₱5,000', 'Kahit anong InstaPay bank', 'Moodeng fee ₱0'],
      needTitle: 'Kailangan mo',
      need: ['USDC sa Moodeng wallet mo', 'PH bank app na may InstaPay / QR Ph', 'Dapat nakapangalan sa iyo ang QR'],
      stepsTitle: 'Paano gawin',
      steps: [
         {
            title: 'Buksan ang bank app mo',
            text: 'BPI, BDO, UnionBank, Tonik, GoTyme, Maya Bank… kahit anong bank na may InstaPay.',
            img: '/cashout-guides/qr/step1-receive.svg'
         },
         {
            title: 'I-save ang Receive QR mo',
            path: 'Receive → QR Ph → Save QR',
            text: 'Puwede rin ang screenshot.',
            img: '/cashout-guides/qr/step2-save.svg'
         },
         {
            title: 'Buksan ang Moodeng → Withdraw',
            path: 'Withdraw → Your bank’s QR',
            text: 'I-tap ang “Upload your QR” at piliin ang picture. O i-scan gamit ang camera.'
         },
         {
            title: 'I-type kung ilang piso',
            text: 'Mula ₱50 hanggang ₱5,000. Tapos i-tap ang “Get my price”.'
         },
         {
            title: 'Tingnan ang presyo, tapos Confirm',
            text: 'Makikita mo ang ipapadala mo, bawat fee, at ang matatanggap mo. Walang gagalaw hangga’t hindi mo tina-tap ang Confirm.'
         },
         {
            title: 'Hintayin ang piso',
            text: 'Kadalasan ilang minuto lang. Puwede mong iwan ang page; tuloy pa rin ito.'
         }
      ],
      firstTitle: 'Sa unang beses lang',
      first: [
         'I-type ang email mo at ang code na ipapadala namin.',
         'I-tap ang “Use my Moodeng ID” para hindi ka na mag-ID check ulit.',
         'Sagutan ang maikling form: phone at nationality.'
      ],
      feesTitle: 'Mga fee',
      fees: 'Mga 2–3% lahat, para sa Stableyard at sa payout partner nila. ₱0 ang kinukuha ng Moodeng. Makikita mo ang eksaktong halaga sa price screen bago ka mag-confirm.',
      helpTitle: 'Kung may problema',
      help: [
         { q: '“This QR can’t be used yet.”', a: 'I-tap ang “Use my account number instead”, o mag-message sa amin.' },
         { q: '“No QR in that picture.”', a: 'I-save ulit ang QR o kumuha ng mas malinaw na screenshot.' },
         { q: '“More than you have.”', a: 'Bawasan ang piso, o i-tap ang “All”.' }
      ],
      cta: 'Mag-cash out na',
      ctaNote: 'Bubuksan ang Moodeng. Mag-log in kung hihingin.'
   }
};

const PAGE_DESCRIPTION =
   'Turn USDC into pesos straight to your own Philippine bank: save the InstaPay / QR Ph Receive QR from your bank app, upload it on Moodeng, type the pesos and confirm. ₱50 to ₱5,000, Moodeng fee ₱0.';

function initialLang(): Lang {
   if (typeof window === 'undefined') return 'en';
   const q = new URLSearchParams(window.location.search).get('lang');
   return q === 'fil' || q === 'tl' ? 'fil' : 'en';
}

export default function QrCashoutGuide({ variant = 'public' }: { variant?: 'public' | 'app' }): JSX.Element {
   const [lang, setLang] = useState<Lang>(initialLang);
   const c = COPY[lang];

   usePageSeo({
      title: 'Cash out to your bank with a QR | Moodeng Credit',
      description: PAGE_DESCRIPTION,
      canonicalPath: `/learn/${QR_CASHOUT_GUIDE_SLUG}`,
      jsonLd: [
         {
            '@context': 'https://schema.org',
            '@type': 'HowTo',
            name: COPY.en.title,
            description: PAGE_DESCRIPTION,
            step: COPY.en.steps.map((s, i) => ({ '@type': 'HowToStep', position: i + 1, name: s.title, text: s.text }))
         }
      ]
   });

   return (
      <main className={`qr-guide${variant === 'app' ? ' qr-guide--app' : ''}`}>
         {variant === 'public' ? (
            <nav className="qr-guide__breadcrumb" aria-label="Breadcrumb">
               <Link to="/academy">Academy</Link>
               <span aria-hidden="true">/</span>
               <Link to="/learn">Guides</Link>
               <span aria-hidden="true">/</span>
               <span aria-current="page">QR cash out</span>
            </nav>
         ) : null}

         <div className="qr-guide__lang" role="group" aria-label="Language">
            {(['en', 'fil'] as const).map((l) => (
               <button key={l} type="button" aria-pressed={lang === l} onClick={() => setLang(l)}>
                  {l === 'en' ? 'English' : 'Filipino'}
               </button>
            ))}
         </div>

         <header className="qr-guide__hero">
            <img src="/dashboard-v2/moo-cashout.png" alt="" className="qr-guide__hero-art" />
            <p className="qr-guide__eyebrow">{c.eyebrow}</p>
            <h1>{c.title}</h1>
            <p className="qr-guide__lead">{c.lead}</p>
            <ul className="qr-guide__chips">
               {c.chips.map((chip) => (
                  <li key={chip}>{chip}</li>
               ))}
            </ul>
         </header>

         <section className="qr-guide__card">
            <h2>{c.needTitle}</h2>
            <ul className="qr-guide__checks">
               {c.need.map((item) => (
                  <li key={item}>{item}</li>
               ))}
            </ul>
         </section>

         <section>
            <h2 className="qr-guide__h2">{c.stepsTitle}</h2>
            <ol className="qr-guide__steps">
               {c.steps.map((s, i) => (
                  <li key={s.title} className="qr-guide__card qr-guide__step">
                     <div className="qr-guide__step-head">
                        <span className="qr-guide__num">{i + 1}</span>
                        <div>
                           <h3>{s.title}</h3>
                           {s.path ? <p className="qr-guide__path">{s.path}</p> : null}
                           <p>{s.text}</p>
                        </div>
                     </div>
                     {s.img ? <img src={s.img} alt="" className="qr-guide__step-img" loading="lazy" /> : null}
                  </li>
               ))}
            </ol>
         </section>

         <section className="qr-guide__card qr-guide__card--soft">
            <h2>{c.firstTitle}</h2>
            <ol className="qr-guide__mini">
               {c.first.map((item) => (
                  <li key={item}>{item}</li>
               ))}
            </ol>
         </section>

         <section className="qr-guide__card">
            <h2>{c.feesTitle}</h2>
            <p>{c.fees}</p>
         </section>

         <section className="qr-guide__card">
            <h2>{c.helpTitle}</h2>
            <dl className="qr-guide__help">
               {c.help.map((h) => (
                  <div key={h.q}>
                     <dt>{h.q}</dt>
                     <dd>{h.a}</dd>
                  </div>
               ))}
            </dl>
         </section>

         <div className="qr-guide__cta">
            <Link to={CASHOUT_LINK} className="qr-guide__gold">
               {c.cta}
            </Link>
            <p>{c.ctaNote}</p>
         </div>

         <div className="qr-guide__needhelp">
            <NeedMoreHelp />
         </div>
      </main>
   );
}
