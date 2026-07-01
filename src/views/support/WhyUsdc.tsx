import { type CSSProperties, type JSX, useEffect, useMemo, useState } from 'react';

import { Link } from 'react-router-dom';

import NeedMoreHelp from '@/views/support/components/NeedMoreHelp';

import { usePageSeo } from '@/hooks/usePageSeo';

import '@/views/academy/AcademyGuide.css';
import '@/views/creditLevelingGuide/CreditLevelingGuide.css';
import '@/views/support/HowCreditLevelsWork.css';
import '@/views/support/WhyUsdc.css';

const PAGE_TITLE = 'Why Moodeng Uses USDC';
const PAGE_DESCRIPTION =
   'USDC is a regulated digital dollar pegged 1:1 to the US dollar. Learn why Moodeng Credit uses it — gasless wallet-to-wallet transfers, stable loan values, bank-grade security, and how USDC works in the real world and in DeFi.';
// Public marketing route is the canonical home so search engines index one URL.
const CANONICAL_PATH = '/learn/why-we-use-usdc';

/** The four reasons Moodeng settles loans in USDC — the "examples" of why it wins. */
const pillars = [
   {
      icon: 'transfer',
      eyebrow: 'Wallet to wallet',
      title: 'Free transfers, no middleman',
      lead: 'USDC moves directly between two wallets — no bank in between.',
      detail: 'On Base, sending USDC is gasless, so a $20 loan arrives as $20. No wire fees, no cut taken along the way.'
   },
   {
      icon: 'chip',
      eyebrow: 'Technology',
      title: 'Programmable, always-on money',
      lead: 'USDC is a digital dollar that settles on a blockchain in seconds, 24/7.',
      detail: 'It runs on open networks (Moodeng uses Base) and can move across chains — so value travels as easily as a message.'
   },
   {
      icon: 'shield',
      eyebrow: 'Security',
      title: 'Regulated and fully backed',
      lead: 'Every USDC is backed 1:1 by cash and short-term US Treasuries.',
      detail: 'Circle, its issuer, publishes independent monthly reserve attestations. Balances are also verifiable on-chain by anyone.'
   },
   {
      icon: 'compass',
      eyebrow: 'Usability',
      title: 'A dollar that holds its value',
      lead: 'One USDC is always worth one dollar, so loan amounts never drift.',
      detail: 'You can hold, send, and receive it from almost anywhere without relying on a traditional bank account.'
   }
] as const;

/** Real-world vs DeFi — the "which is which" the user asked us to make explicit. */
const useCases = [
   {
      tone: 'real',
      tag: 'The everyday economy',
      title: 'Real-world use',
      subtitle: 'Payments & money movement',
      definition:
         'Using USDC the way you use cash or a bank transfer — paying people, sending money across borders, or cashing out to your local currency.',
      examples: ['Send money to family abroad in seconds', 'Pay a merchant that accepts stablecoins', 'Cash out to a bank or exchange'],
      moodeng: 'On Moodeng, this is how loans work: a lender sends you USDC, and you repay in USDC.'
   },
   {
      tone: 'defi',
      tag: 'On-chain finance',
      title: 'DeFi use',
      subtitle: 'Decentralized finance',
      definition:
         'DeFi means "decentralized finance" — financial apps that run on smart contracts instead of a bank. You can lend, borrow, or swap USDC directly from your wallet.',
      examples: ['Lend USDC to earn yield', 'Provide liquidity to a trading pool', 'Borrow against crypto you already hold'],
      moodeng: 'Moodeng is community lending, not a DeFi yield product — but USDC lets it plug into this wider ecosystem.'
   }
] as const;

/** Plain-language glossary — the definitions the user explicitly requested. */
const glossary = [
   {
      term: 'Stablecoin',
      def: 'A cryptocurrency designed to hold a steady value. USDC is pegged 1:1 to the US dollar, so it does not swing like Bitcoin.'
   },
   {
      term: 'Wallet-to-wallet transfer',
      def: 'Sending funds straight from one crypto wallet to another, with no bank or payment processor sitting in the middle.'
   },
   {
      term: 'Gas (and “gasless”)',
      def: 'Gas is the small network fee to move crypto. On Base, USDC transfers are sponsored, so they feel gasless — you pay nothing.'
   },
   {
      term: 'Real-world use',
      def: 'Spending or sending USDC like ordinary money: payments, remittances, and cashing out to local currency.'
   },
   {
      term: 'DeFi',
      def: 'Decentralized finance — lending, borrowing, and trading run by smart contracts on a blockchain instead of a bank.'
   },
   {
      term: 'Staking',
      def: 'Locking up a crypto token to help secure a proof-of-stake blockchain, earning rewards in return. USDC is not a staking token.'
   },
   {
      term: 'Yield',
      def: 'The return you earn by putting USDC to work — for example, lending it out in DeFi. Yield is a payout, not network security.'
   }
] as const;

const faqs = [
   {
      q: 'What is USDC?',
      a: 'USDC is a regulated stablecoin — a digital dollar issued by Circle and pegged 1:1 to the US dollar. Each USDC is backed by cash and short-term US Treasuries, with independent monthly reserve attestations.'
   },
   {
      q: 'Why does Moodeng use USDC instead of regular money?',
      a: 'USDC keeps loan values stable, moves wallet-to-wallet in seconds, and is gasless on Base — so a $20 loan is still exactly $20 when you repay it, with no bank fees eating into it.'
   },
   {
      q: 'Is USDC safe?',
      a: 'USDC is issued by the most licensed stablecoin company in the world and is backed 1:1 by highly liquid reserves. Those reserves are attested monthly by independent accounting firms, and every balance is verifiable on-chain.'
   },
   {
      q: 'What is the difference between staking and yield?',
      a: 'Staking means locking a token to help secure a proof-of-stake blockchain in exchange for rewards. Yield is the return you earn by lending or supplying USDC in DeFi. USDC is not a staking token, but it can earn yield.'
   },
   {
      q: 'What is the difference between real-world use and DeFi use?',
      a: 'Real-world use is spending or sending USDC like cash — payments, remittances, cashing out. DeFi use is putting USDC into smart-contract apps to lend, borrow, or swap without a bank. Moodeng loans are real-world use.'
   },
   {
      q: 'Do I pay fees to send USDC on Moodeng?',
      a: 'No. Moodeng uses a Base Account on Base, where USDC transfers are gasless. You do not pay network fees to receive a loan or make a repayment.'
   },
   {
      q: 'Does Moodeng offer USDC staking or yield?',
      a: 'No. Moodeng is community lending — USDC is used to fund and repay loans. Staking and yield live in the wider crypto ecosystem, not inside Moodeng.'
   }
];

const relatedGuides = [
   {
      slug: 'using-usdc-on-moodeng-credit',
      title: 'Using USDC on Moodeng Credit',
      blurb: 'A quick guide to how USDC is used for loans and repayments in the app.'
   },
   {
      slug: 'how-to-request-your-first-loan',
      title: 'How to request your first loan',
      blurb: 'Set up your Base Account, connect your wallet, and send your first request.'
   },
   {
      slug: 'how-credit-levels-work',
      title: 'How Credit Levels work',
      blurb: 'How your borrowing limit grows $15 → $20 → $40 → $60 as you repay.'
   }
];

function PillarIcon({ name }: { name: string }): JSX.Element {
   const props = {
      width: 26,
      height: 26,
      viewBox: '0 0 24 24',
      fill: 'none',
      stroke: 'currentColor',
      strokeWidth: 2,
      strokeLinecap: 'round' as const,
      strokeLinejoin: 'round' as const
   };
   if (name === 'transfer') {
      return (
         <svg {...props} aria-hidden="true">
            <polyline points="4 7 20 7" />
            <polyline points="16 3 20 7 16 11" />
            <polyline points="20 17 4 17" />
            <polyline points="8 13 4 17 8 21" />
         </svg>
      );
   }
   if (name === 'chip') {
      return (
         <svg {...props} aria-hidden="true">
            <rect x="7" y="7" width="10" height="10" rx="2" />
            <path d="M10 2v3M14 2v3M10 19v3M14 19v3M2 10h3M2 14h3M19 10h3M19 14h3" />
         </svg>
      );
   }
   if (name === 'shield') {
      return (
         <svg {...props} aria-hidden="true">
            <path d="M12 3l7 3v5c0 4.5-3 7.5-7 9-4-1.5-7-4.5-7-9V6l7-3Z" />
            <path d="M9.5 12l1.8 1.8L15 10" />
         </svg>
      );
   }
   return (
      <svg {...props} aria-hidden="true">
         <circle cx="12" cy="12" r="9" />
         <polygon points="15.5 8.5 10.5 10.5 8.5 15.5 13.5 13.5" />
      </svg>
   );
}

export default function WhyUsdc(): JSX.Element {
   const [readingProgress, setReadingProgress] = useState(0);

   usePageSeo({
      title: `${PAGE_TITLE} | Moodeng Credit`,
      description: PAGE_DESCRIPTION,
      canonicalPath: CANONICAL_PATH,
      jsonLd: [
         {
            '@context': 'https://schema.org',
            '@type': 'Article',
            headline: PAGE_TITLE,
            description: PAGE_DESCRIPTION,
            author: { '@type': 'Organization', name: 'Moodeng Credit' },
            publisher: { '@type': 'Organization', name: 'Moodeng Credit' },
            mainEntityOfPage: `https://moodeng.app${CANONICAL_PATH}`
         },
         {
            '@context': 'https://schema.org',
            '@type': 'FAQPage',
            mainEntity: faqs.map((item) => ({
               '@type': 'Question',
               name: item.q,
               acceptedAnswer: { '@type': 'Answer', text: item.a }
            }))
         },
         {
            '@context': 'https://schema.org',
            '@type': 'BreadcrumbList',
            itemListElement: [
               { '@type': 'ListItem', position: 1, name: 'Academy', item: 'https://moodeng.app/academy' },
               { '@type': 'ListItem', position: 2, name: 'Why Moodeng uses USDC', item: `https://moodeng.app${CANONICAL_PATH}` }
            ]
         }
      ]
   });

   useEffect(() => {
      const updateReadingProgress = () => {
         const documentHeight = document.documentElement.scrollHeight - window.innerHeight;
         if (documentHeight <= 0) {
            setReadingProgress(0);
            return;
         }
         const progress = (window.scrollY / documentHeight) * 100;
         setReadingProgress(Math.min(100, Math.max(0, Math.round(progress))));
      };

      updateReadingProgress();
      window.addEventListener('scroll', updateReadingProgress, { passive: true });
      window.addEventListener('resize', updateReadingProgress);

      return () => {
         window.removeEventListener('scroll', updateReadingProgress);
         window.removeEventListener('resize', updateReadingProgress);
      };
   }, []);

   const progressStyle = useMemo(
      () => ({ '--academy-reading-progress': `${readingProgress}%` }) as CSSProperties,
      [readingProgress]
   );

   return (
      <main className="credit-leveling-guide hclw-page why-usdc">
         <div className="academy-reading-progress" style={progressStyle} aria-label={`Why USDC guide progress ${readingProgress}%`}>
            <span>{readingProgress}%</span>
         </div>

         <nav className="hclw-breadcrumb" aria-label="Breadcrumb">
            <span className="hclw-breadcrumb__item">
               <Link to="/academy">Academy</Link>
               <span aria-hidden="true">/</span>
            </span>
            <span aria-current="page">Why we use USDC</span>
         </nav>

         <section className="credit-leveling-hero">
            <div className="credit-leveling-hero__copy">
               <div className="hclw-eyebrow-row">
                  <span className="credit-leveling-kicker">Moodeng Academy</span>
                  <span className="hclw-meta-pill">Updated Jul 2026 · 6 min read</span>
               </div>
               <h1>Why Moodeng uses USDC</h1>
               <p>
                  Every loan on Moodeng is sent and repaid in USDC — a regulated digital dollar pegged 1:1 to the US
                  dollar. Here is what that means, and why it makes small loans faster, cheaper, and safer.
               </p>
               <div className="credit-leveling-hero__actions">
                  <Link to="/request-board">Request a loan</Link>
                  <a href="#definitions">See the definitions</a>
               </div>
            </div>

            <figure className="why-usdc-hero-visual" aria-label="One USDC always equals one US dollar">
               <div className="why-usdc-coin">
                  <span className="why-usdc-coin__mark">$</span>
                  <span className="why-usdc-coin__ticker">USDC</span>
               </div>
               <div className="why-usdc-peg">
                  <b>1 USDC</b>
                  <span className="why-usdc-peg__eq">=</span>
                  <b>$1.00</b>
               </div>
               <p className="why-usdc-peg__note">Backed 1:1 by cash &amp; short-term US Treasuries</p>
            </figure>
         </section>

         <section className="credit-leveling-section why-usdc-what">
            <div className="hclw-section-head">
               <div className="credit-leveling-section__header">
                  <div className="credit-leveling-kicker">Start here</div>
                  <h2>What is USDC?</h2>
                  <p>
                     USDC (USD Coin) is a <strong>stablecoin</strong>: a cryptocurrency built to stay worth exactly one
                     US dollar. It is issued by Circle, backed fully by cash and short-term US Treasuries, and its
                     reserves are attested by independent accounting firms every month. Because it lives on a
                     blockchain, it can move between wallets in seconds — while staying as steady as the dollar it
                     tracks.
                  </p>
               </div>
               <img src="/hippos/thinking.png" alt="" className="hclw-section-mascot" loading="lazy" />
            </div>
         </section>

         <section className="credit-leveling-section credit-leveling-how-section">
            <div className="hclw-section-head">
               <div className="credit-leveling-section__header">
                  <div className="credit-leveling-kicker">The reasons</div>
                  <h2>Four reasons we chose USDC</h2>
                  <p>Free transfers, solid technology, real security, and a value that never drifts.</p>
               </div>
               <img src="/hippos/thumb-up-right.png" alt="" className="hclw-section-mascot" loading="lazy" />
            </div>
            <div className="hclw-pillars why-usdc-pillars">
               {pillars.map((item, index) => (
                  <article className="hclw-pillar" key={item.title}>
                     <div className="hclw-pillar__top">
                        <span className="hclw-pillar__icon">
                           <PillarIcon name={item.icon} />
                        </span>
                        <span className="hclw-pillar__index">0{index + 1}</span>
                     </div>
                     <span className="hclw-pillar__eyebrow">{item.eyebrow}</span>
                     <h3>{item.title}</h3>
                     <p className="hclw-pillar__lead">{item.lead}</p>
                     <p className="hclw-pillar__detail">{item.detail}</p>
                  </article>
               ))}
            </div>
         </section>

         <section className="credit-leveling-section">
            <div className="hclw-section-head">
               <div className="credit-leveling-section__header">
                  <div className="credit-leveling-kicker">Where it is used</div>
                  <h2>Real-world use vs DeFi use</h2>
                  <p>USDC works in two worlds. Here is which is which — and where Moodeng fits.</p>
               </div>
               <img src="/hippos/community.png" alt="" className="hclw-section-mascot hclw-section-mascot--wide" loading="lazy" />
            </div>
            <div className="hclw-loan-grid">
               {useCases.map((item) => (
                  <article className={`hclw-loan-card why-usdc-usecase why-usdc-usecase--${item.tone}`} key={item.title}>
                     <span className="hclw-loan-tag">{item.tag}</span>
                     <h3>{item.title}</h3>
                     <span className="hclw-loan-alt">{item.subtitle}</span>
                     <p className="hclw-loan-def">{item.definition}</p>
                     <ul className="why-usdc-usecase__list">
                        {item.examples.map((ex) => (
                           <li key={ex}>{ex}</li>
                        ))}
                     </ul>
                     <p className="hclw-loan-when">
                        <b>On Moodeng:</b> {item.moodeng}
                     </p>
                  </article>
               ))}
            </div>
         </section>

         <section className="credit-leveling-section why-usdc-glossary-section" id="definitions">
            <div className="hclw-section-head">
               <div className="credit-leveling-section__header">
                  <div className="credit-leveling-kicker">Definitions</div>
                  <h2>The words, in plain English</h2>
                  <p>Staking and yield get mixed up a lot — so do payments and DeFi. Here is what each one really means.</p>
               </div>
               <img src="/hippos/journal-hippo.png" alt="" className="hclw-section-mascot" loading="lazy" />
            </div>
            <div className="why-usdc-glossary">
               {glossary.map((item) => (
                  <div className="why-usdc-term" key={item.term}>
                     <dt>{item.term}</dt>
                     <dd>{item.def}</dd>
                  </div>
               ))}
            </div>
            <div className="why-usdc-callout">
               <strong>Staking vs yield, side by side:</strong> Staking secures a blockchain and pays rewards for doing
               so — you cannot stake USDC that way. Yield is simply the return for lending or supplying USDC in DeFi.
               Moodeng does neither: it uses USDC to fund and repay community loans.
            </div>
         </section>

         <section className="credit-leveling-section hclw-faq-section">
            <div className="hclw-section-head">
               <div className="credit-leveling-section__header">
                  <div className="credit-leveling-kicker">FAQ</div>
                  <h2>USDC, answered</h2>
                  <p>Quick answers to what borrowers ask most about the dollar behind their loans.</p>
               </div>
               <img src="/hippos/sitting-down-pointing-hippo.png" alt="" className="hclw-section-mascot" loading="lazy" />
            </div>
            <div className="hclw-faq">
               {faqs.map((item, index) => (
                  <details key={item.q} open={index === 0}>
                     <summary>{item.q}</summary>
                     <p>{item.a}</p>
                  </details>
               ))}
            </div>
         </section>

         <section className="credit-leveling-section hclw-related-section">
            <div className="hclw-section-head">
               <div className="credit-leveling-section__header">
                  <div className="credit-leveling-kicker">Keep learning</div>
                  <h2>Related guides</h2>
                  <p>USDC is the money layer under everything you do on Moodeng.</p>
               </div>
               <img src="/hippos/party.png" alt="" className="hclw-section-mascot" loading="lazy" />
            </div>
            <div className="hclw-related-grid">
               {relatedGuides.map((item) => (
                  <Link key={item.slug} to={`/learn/${item.slug}`} className="hclw-related-card">
                     <strong>{item.title}</strong>
                     <span>{item.blurb}</span>
                     <em aria-hidden="true">Read guide →</em>
                  </Link>
               ))}
            </div>
         </section>

         <section className="credit-leveling-bottom hclw-bottom">
            <div className="hclw-bottom__copy">
               <h2>Ready to borrow in stable dollars?</h2>
               <p>Your loan arrives as USDC and you repay in USDC — gasless on Base, and always worth what it says.</p>
               <Link to="/request-board">Review live requests</Link>
            </div>
            <img src="/hippos/thumb-up-right.png" alt="" className="hclw-bottom__mascot" loading="lazy" />
         </section>

         <div className="hclw-footer-area">
            <NeedMoreHelp />
         </div>
      </main>
   );
}
