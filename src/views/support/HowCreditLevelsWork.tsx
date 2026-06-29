import { type CSSProperties, type JSX, useEffect, useMemo, useState } from 'react';

import { Link } from 'react-router-dom';

import NeedMoreHelp from '@/views/support/components/NeedMoreHelp';

import '@/views/academy/AcademyGuide.css';
import '@/views/creditLevelingGuide/CreditLevelingGuide.css';
import '@/views/support/HowCreditLevelsWork.css';

/** Where this guide is rendered from. `public` is the crawlable marketing route. */
export type CreditLevelsVariant = 'support' | 'public';

const PAGE_TITLE = 'How Credit Levels Work on Moodeng Credit';
const PAGE_DESCRIPTION =
   'Credit Levels set how much you can borrow on Moodeng Credit. Learn how limits grow $15 → $20 → $40 → $60, what a Credit Growth Loan is, and how to unlock your next level.';
// The public marketing route is the canonical home for this content so search
// engines index one URL even though it also renders inside the in-app support area.
const CANONICAL_PATH = '/learn/how-credit-levels-work';

const levels = [
   { level: 'Level 1', limit: '$15', state: 'Start', note: 'Everyone starts here', unlock: 'Verify with World ID and make your first request.' },
   { level: 'Level 2', limit: '$20', state: 'Next', note: 'First unlock', unlock: 'Repay a $15 Credit Growth Loan in full and on time.' },
   { level: 'Level 3', limit: '$40', state: 'Locked', note: 'Keep climbing', unlock: 'Repay a $20 Credit Growth Loan in full and on time.' },
   { level: 'Level 4', limit: '$60', state: 'Locked', note: 'Higher limit', unlock: 'Repay a $40 Credit Growth Loan in full and on time.' }
];

const pillars = [
   {
      icon: 'wallet',
      eyebrow: 'What it is',
      title: 'A level is a limit',
      lead: 'Your level sets the most you can borrow at once.',
      detail: 'Level 1 unlocks $15 — small on purpose, since you have no history yet.'
   },
   {
      icon: 'trending',
      eyebrow: 'How you grow',
      title: 'Repay your full limit',
      lead: 'A full-limit loan repaid on time raises your cap.',
      detail: 'That single clean repayment is what moves you up — nothing else does.'
   },
   {
      icon: 'stairs',
      eyebrow: 'The pace',
      title: 'One level at a time',
      lead: 'Limits step up $15 → $20 → $40 → $60.',
      detail: 'No skipping or buying ahead — each level is earned from the one before.'
   }
];

const loanTypes = [
   {
      tone: 'trust',
      tag: 'Below your current limit',
      title: 'Trust-Building Loan',
      altName: null,
      definition: 'Any loan for less than your current limit. It lets you prove you repay reliably without borrowing your full cap.',
      effectLimit: 'Stays the same',
      effectTrust: 'Goes up',
      useWhen: 'You need a smaller amount, or want to build a track record before going for your full limit.'
   },
   {
      tone: 'credit',
      tag: 'Your full current limit',
      title: 'Credit-Building Loan',
      altName: 'also called a Credit Growth Loan',
      definition: 'A loan for your full current limit, repaid on the agreed terms by the due date. This is the level-up loan.',
      effectLimit: 'Unlocks the next level',
      effectTrust: 'Goes up',
      useWhen: 'You are confident you can repay on time and want to grow your borrowing limit.'
   }
];

const journey = [
   { phase: 'Cycle 1', title: 'Borrow $15 · repay on time', detail: 'Your first Credit Growth Loan clears cleanly. Your limit unlocks $20.' },
   { phase: 'Cycle 2', title: 'Borrow $20 · repay on time', detail: 'A second on-time repayment. Your limit unlocks $40.' },
   { phase: 'Cycle 3', title: 'Borrow $40 · repay on time', detail: 'Your track record is building and lenders fund you faster. Your limit unlocks $60.' },
   { phase: 'Reached', title: 'Borrowing at $60', detail: 'Four clean cycles take you from $15 to $60 — plus a Trust Score that travels with your wallet.' }
];

const tips = [
   { kind: 'do', text: 'Request your full current limit only when you are confident you can repay it.' },
   { kind: 'do', text: 'Pick a repayment date you can comfortably hit. Repaying early is always fine.' },
   { kind: 'dont', text: 'Do not take a full-limit loan you are unsure about — one missed repayment pauses your progress.' },
   { kind: 'dont', text: 'Do not expect extra or early payments to skip a level. Growth is always one step at a time.' }
] as const;

const takeaways = [
   'Everyone starts at Level 1 with a $15 borrowing limit.',
   'Limits grow one step at a time: $15 → $20 → $40 → $60.',
   'Only a full-limit Credit Growth Loan, repaid on time, levels you up.',
   'Smaller loans build your Trust Score but keep your limit the same.'
];

const relatedGuides = [
   {
      slug: 'understanding-your-trust-score',
      title: 'Understanding your Trust Score',
      blurb: 'How reliable repayment becomes a portable reputation lenders trust.'
   },
   {
      slug: 'trust-building-vs-credit-building-loans',
      title: 'Trust-Building vs Credit-Building loans',
      blurb: 'The difference between the two loan types and when to use each.'
   },
   {
      slug: 'how-repayments-affect-your-trust-score',
      title: 'How repayments affect your Trust Score',
      blurb: 'Exactly how on-time, partial, and late repayments are scored.'
   }
];

const faqs = [
   {
      q: 'What is a Credit Level on Moodeng?',
      a: 'A Credit Level is your borrowing limit. Everyone starts at Level 1 with a $15 limit, and the limit grows as you complete Credit Growth Loans.'
   },
   {
      q: 'How do I move to the next level?',
      a: 'Take a Credit Growth Loan at your full current limit and repay it in full and on time. A clean repayment unlocks the next limit — $15 → $20 → $40 → $60.'
   },
   {
      q: 'Does borrowing a small amount level me up?',
      a: 'No. Borrowing below your limit is a Trust-Building Loan. It improves your reputation with lenders but does not raise your Credit Level. Only a full-limit Credit Growth Loan advances you.'
   },
   {
      q: 'Can I skip levels by repaying early or paying extra?',
      a: 'No. Moodeng advances one level at a time. Paying extra or repaying early does not skip a step — each new limit is earned by repaying the level before it.'
   },
   {
      q: 'Why does the limit start at only $15?',
      a: 'Small starting limits keep risk low for the lenders funding someone with no track record yet. As you prove reliable repayment, your limit and lender confidence grow together.'
   },
   {
      q: 'How long does it take to reach the $60 level?',
      a: 'There is no fixed timeline. Each level needs one full-limit loan repaid on time, so the pace depends on how quickly you borrow and repay. Borrowers who repay cleanly can climb in just a few loan cycles.'
   },
   {
      q: 'What happens if I miss a repayment?',
      a: 'A late or missed repayment lowers your Trust Score and can pause your progress. Lenders weigh the missed repayment heavily, so keeping payments on time matters more than borrowing size.'
   },
   {
      q: 'Does my Credit Level ever reset?',
      a: 'Your progress is tied to your wallet and repayment history, so it travels with you. Missed repayments do not erase your level, but they lower your Trust Score and can slow further growth.'
   }
];

interface QuizQuestion {
   q: string;
   options: string[];
   answer: number;
   correctLine: string;
   wrongLine: string;
}

const quizQuestions: QuizQuestion[] = [
   {
      q: 'What borrowing limit does everyone start with?',
      options: ['$5', '$15', '$50', '$100'],
      answer: 1,
      correctLine: 'Yep — everyone starts at $15. Small, but the climb begins here.',
      wrongLine: 'Close, but no. Level 1 starts everyone at a $15 limit.'
   },
   {
      q: 'Which loan actually levels you up?',
      options: ['Any small loan', 'A full-limit Credit Growth Loan', 'Paying a fee', 'Logging in daily'],
      answer: 1,
      correctLine: 'Exactly — only a full-limit Credit Growth Loan, repaid on time, bumps your cap.',
      wrongLine: 'Nice try! Only a full-limit Credit Growth Loan raises your level.'
   },
   {
      q: 'Your limit is $20. You borrow $10 and repay on time. What happens?',
      options: ['You jump to $40', 'Limit stays $20, trust grows', 'You drop to $15', 'Nothing, ever'],
      answer: 1,
      correctLine: 'Right! Small loans build trust — they just don’t raise your limit.',
      wrongLine: 'Not quite — a sub-limit loan builds trust but keeps your limit at $20.'
   },
   {
      q: 'Can you skip from $15 straight to $60?',
      options: ['Yes, pay 4× up front', 'No — one level at a time', 'Only on weekends', 'Yes, with a coupon'],
      answer: 1,
      correctLine: 'Correct — Moodeng climbs one level at a time. No shortcuts.',
      wrongLine: 'Nope — there are no shortcuts. It’s one level at a time.'
   },
   {
      q: 'What slows your climb the most?',
      options: ['Repaying early', 'A late or missed repayment', 'Borrowing your full limit', 'Asking questions'],
      answer: 1,
      correctLine: 'You got it — a missed repayment pauses progress and dents your Trust Score.',
      wrongLine: 'Actually it’s a late or missed repayment — that’s what pauses your climb.'
   }
];

const quizResultTiers = [
   { min: 5, title: 'Credit Level Legend', blurb: 'Flawless run. You could teach the hippos.', hippo: '/hippos/party.png' },
   { min: 3, title: 'Rising Star', blurb: 'Solid! You’ve basically got this down.', hippo: '/hippos/thumb-up-right.png' },
   { min: 0, title: 'Just getting started', blurb: 'No worries — scroll back up and you’ll ace the rematch.', hippo: '/hippos/thinking.png' }
];

function CreditLevelsQuiz(): JSX.Element {
   const [current, setCurrent] = useState(0);
   const [selected, setSelected] = useState<number | null>(null);
   const [score, setScore] = useState(0);
   const [finished, setFinished] = useState(false);

   const question = quizQuestions[current];
   const isAnswered = selected !== null;
   const isLast = current === quizQuestions.length - 1;

   const handleSelect = (index: number) => {
      if (isAnswered) return;
      setSelected(index);
      if (index === question.answer) {
         setScore((value) => value + 1);
      }
   };

   const handleNext = () => {
      if (isLast) {
         setFinished(true);
         return;
      }
      setCurrent((value) => value + 1);
      setSelected(null);
   };

   const handleReset = () => {
      setCurrent(0);
      setSelected(null);
      setScore(0);
      setFinished(false);
   };

   if (finished) {
      const tier = quizResultTiers.find((item) => score >= item.min) ?? quizResultTiers[quizResultTiers.length - 1];
      return (
         <div className="hclw-quiz hclw-quiz--result">
            <img src={tier.hippo} alt="" className="hclw-quiz__result-hippo" />
            <span className="hclw-quiz__score">
               {score}
               <b>/{quizQuestions.length}</b>
            </span>
            <h3>{tier.title}</h3>
            <p>{tier.blurb}</p>
            <button type="button" className="hclw-quiz__again" onClick={handleReset}>
               Play again
            </button>
         </div>
      );
   }

   return (
      <div className="hclw-quiz">
         <div className="hclw-quiz__meta">
            <span>
               Question {current + 1} of {quizQuestions.length}
            </span>
            <div className="hclw-quiz__dots" aria-hidden="true">
               {quizQuestions.map((item, index) => (
                  <span key={item.q} className={index <= current ? 'is-on' : undefined} />
               ))}
            </div>
         </div>

         <p className="hclw-quiz__q">{question.q}</p>

         <div className="hclw-quiz__options" role="group" aria-label="Answer choices">
            {question.options.map((option, index) => {
               let stateClass = '';
               if (isAnswered) {
                  if (index === question.answer) stateClass = 'is-correct';
                  else if (index === selected) stateClass = 'is-wrong';
                  else stateClass = 'is-dim';
               }
               return (
                  <button
                     type="button"
                     key={option}
                     className={`hclw-quiz__option ${stateClass}`}
                     onClick={() => handleSelect(index)}
                     disabled={isAnswered}
                  >
                     <span className="hclw-quiz__letter">{String.fromCharCode(65 + index)}</span>
                     {option}
                  </button>
               );
            })}
         </div>

         {isAnswered ? (
            <div className={`hclw-quiz__feedback ${selected === question.answer ? 'is-correct' : 'is-wrong'}`}>
               <p>{selected === question.answer ? question.correctLine : question.wrongLine}</p>
               <button type="button" className="hclw-quiz__next" onClick={handleNext}>
                  {isLast ? 'See my score' : 'Next question'}
               </button>
            </div>
         ) : null}
      </div>
   );
}

interface BreadcrumbCrumb {
   name: string;
   path: string;
}

function getBreadcrumbs(variant: CreditLevelsVariant): BreadcrumbCrumb[] {
   if (variant === 'public') {
      return [{ name: 'Academy', path: '/academy' }];
   }
   return [
      { name: 'Support', path: '/support' },
      { name: 'Guides', path: '/support/guides' }
   ];
}

/** Inject SEO meta tags + JSON-LD while the page is mounted, then restore. */
function useGuideSeo(variant: CreditLevelsVariant): void {
   useEffect(() => {
      const previousTitle = document.title;
      document.title = `${PAGE_TITLE} | Moodeng Credit`;

      const created: HTMLElement[] = [];
      const touched: Array<{ el: HTMLMetaElement; previous: string | null }> = [];

      const setMeta = (selector: string, attr: 'name' | 'property', key: string, content: string) => {
         let el = document.head.querySelector<HTMLMetaElement>(selector);
         if (el) {
            touched.push({ el, previous: el.getAttribute('content') });
         } else {
            el = document.createElement('meta');
            el.setAttribute(attr, key);
            document.head.appendChild(el);
            created.push(el);
         }
         el.setAttribute('content', content);
      };

      setMeta('meta[name="description"]', 'name', 'description', PAGE_DESCRIPTION);
      setMeta('meta[property="og:title"]', 'property', 'og:title', PAGE_TITLE);
      setMeta('meta[property="og:description"]', 'property', 'og:description', PAGE_DESCRIPTION);
      setMeta('meta[property="og:type"]', 'property', 'og:type', 'article');

      const origin = window.location.origin;
      const canonicalUrl = `${origin}${CANONICAL_PATH}`;
      setMeta('meta[property="og:url"]', 'property', 'og:url', canonicalUrl);

      let canonical = document.head.querySelector<HTMLLinkElement>('link[rel="canonical"]');
      const previousCanonical = canonical?.getAttribute('href') ?? null;
      const canonicalCreated = !canonical;
      if (!canonical) {
         canonical = document.createElement('link');
         canonical.setAttribute('rel', 'canonical');
         document.head.appendChild(canonical);
      }
      canonical.setAttribute('href', canonicalUrl);

      const breadcrumbTrail = getBreadcrumbs(variant);
      const jsonLd = document.createElement('script');
      jsonLd.type = 'application/ld+json';
      jsonLd.textContent = JSON.stringify([
         {
            '@context': 'https://schema.org',
            '@type': 'Article',
            headline: PAGE_TITLE,
            description: PAGE_DESCRIPTION,
            author: { '@type': 'Organization', name: 'Moodeng Credit' },
            publisher: { '@type': 'Organization', name: 'Moodeng Credit' },
            mainEntityOfPage: canonicalUrl
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
               ...breadcrumbTrail.map((crumb, index) => ({
                  '@type': 'ListItem',
                  position: index + 1,
                  name: crumb.name,
                  item: `${origin}${crumb.path}`
               })),
               {
                  '@type': 'ListItem',
                  position: breadcrumbTrail.length + 1,
                  name: 'How Credit Levels work',
                  item: canonicalUrl
               }
            ]
         }
      ]);
      document.head.appendChild(jsonLd);
      created.push(jsonLd);

      return () => {
         document.title = previousTitle;
         for (const { el, previous } of touched) {
            if (previous === null) el.removeAttribute('content');
            else el.setAttribute('content', previous);
         }
         for (const el of created) el.remove();
         if (canonical) {
            if (canonicalCreated) canonical.remove();
            else if (previousCanonical !== null) canonical.setAttribute('href', previousCanonical);
         }
      };
   }, [variant]);
}

interface HowCreditLevelsWorkProps {
   variant?: CreditLevelsVariant;
}

export default function HowCreditLevelsWork({ variant = 'support' }: HowCreditLevelsWorkProps): JSX.Element {
   const [readingProgress, setReadingProgress] = useState(0);

   useGuideSeo(variant);

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

   const breadcrumbTrail = getBreadcrumbs(variant);

   return (
      <main className="credit-leveling-guide hclw-page">
         <div
            className="academy-reading-progress"
            style={progressStyle}
            aria-label={`Credit Levels guide progress ${readingProgress}%`}
         >
            <span>{readingProgress}%</span>
         </div>

         <nav className="hclw-breadcrumb" aria-label="Breadcrumb">
            {breadcrumbTrail.map((crumb) => (
               <span key={crumb.path} className="hclw-breadcrumb__item">
                  <Link to={crumb.path}>{crumb.name}</Link>
                  <span aria-hidden="true">/</span>
               </span>
            ))}
            <span aria-current="page">How Credit Levels work</span>
         </nav>

         <section className="credit-leveling-hero">
            <div className="credit-leveling-hero__copy">
               <div className="hclw-eyebrow-row">
                  <span className="credit-leveling-kicker">Moodeng Academy</span>
                  <span className="hclw-meta-pill">Updated Jun 2026 · 5 min read</span>
               </div>
               <h1>How Credit Levels work</h1>
               <p>
                  Credit Levels set how much you can borrow at a time. Everyone starts at $15 — then your limit grows
                  each time you take a full-limit loan and repay it on time. Here is exactly how the ladder works and
                  how to climb it.
               </p>
               <ul className="hclw-takeaways" aria-label="Key takeaways">
                  {takeaways.map((point) => (
                     <li key={point}>{point}</li>
                  ))}
               </ul>
               <div className="credit-leveling-hero__actions">
                  <Link to="/request-board">Request a loan</Link>
                  <Link to="/credit-leveling-guide">Deep dive</Link>
               </div>
            </div>

            <figure className="hclw-hero-visual" aria-label="Credit limit growing from fifteen to sixty dollars">
               <svg viewBox="0 0 420 300" role="img" xmlns="http://www.w3.org/2000/svg">
                  <title>Credit limit climbing across four levels</title>
                  <defs>
                     <linearGradient id="hclwBar" x1="0" y1="1" x2="0" y2="0">
                        <stop offset="0%" stopColor="#7c3aed" />
                        <stop offset="100%" stopColor="#33d6a8" />
                     </linearGradient>
                  </defs>
                  {/* baseline */}
                  <line x1="24" y1="262" x2="396" y2="262" stroke="rgba(255,255,255,0.18)" strokeWidth="2" />
                  {[
                     { x: 40, h: 70, limit: '$15', lvl: 'L1' },
                     { x: 138, h: 110, limit: '$20', lvl: 'L2' },
                     { x: 236, h: 165, limit: '$40', lvl: 'L3' },
                     { x: 334, h: 215, limit: '$60', lvl: 'L4' }
                  ].map((bar) => (
                     <g className="hclw-climb-step" key={bar.lvl}>
                        <rect x={bar.x} y={262 - bar.h} width="56" height={bar.h} rx="14" fill="url(#hclwBar)" />
                        <text x={bar.x + 28} y={262 - bar.h - 12} textAnchor="middle" fill="#f7f7fb" fontSize="20" fontWeight="900">
                           {bar.limit}
                        </text>
                        <text x={bar.x + 28} y="284" textAnchor="middle" fill="rgba(237,233,254,0.7)" fontSize="14" fontWeight="800">
                           {bar.lvl}
                        </text>
                     </g>
                  ))}
               </svg>
               <figcaption>Each Credit Growth Loan repaid on time steps your limit up to the next level.</figcaption>
            </figure>
         </section>

         <section className="credit-leveling-section credit-leveling-how-section">
            <div className="hclw-section-head">
               <div className="credit-leveling-section__header">
                  <div className="credit-leveling-kicker">The basics</div>
                  <h2>Three things to know</h2>
                  <p>Credit Levels reward one clear pattern: borrow your full limit, repay it on time, unlock the next limit.</p>
               </div>
               <img src="/hippos/thinking.png" alt="" className="hclw-section-mascot" loading="lazy" />
            </div>
            <div className="credit-leveling-how-list">
               {pillars.map((item) => (
                  <article key={item.step}>
                     <span>{item.step}</span>
                     <div>
                        <h3>{item.title}</h3>
                        <p>{item.body}</p>
                     </div>
                  </article>
               ))}
            </div>
         </section>

         <section className="credit-leveling-section">
            <div className="hclw-section-head">
               <div className="credit-leveling-section__header">
                  <div className="credit-leveling-kicker">The ladder</div>
                  <h2>Your limit grows one level at a time</h2>
                  <p>Everyone starts at Level 1. Each successful Credit Growth Loan unlocks the next borrowing limit.</p>
               </div>
               <img src="/hippos/sitting-down-pointing-hippo.png" alt="" className="hclw-section-mascot" loading="lazy" />
            </div>
            <div className="credit-leveling-ladder" aria-label="Credit level progression">
               {levels.map((item, index) => (
                  <article className={index === 0 ? 'is-current' : undefined} key={item.limit}>
                     <div className="credit-leveling-ladder__top">
                        <span>{item.level}</span>
                        <b>{item.state}</b>
                     </div>
                     <div className="credit-leveling-ladder__limit">{item.limit}</div>
                     <div className="credit-leveling-ladder__body">
                        <strong>{item.note}</strong>
                        <p>{item.unlock}</p>
                     </div>
                  </article>
               ))}
            </div>
         </section>

         <section className="credit-leveling-section">
            <div className="hclw-section-head">
               <div className="credit-leveling-section__header">
                  <div className="credit-leveling-kicker">Two kinds of loan</div>
                  <h2>Trust-Building vs Credit-Building</h2>
                  <p>Moodeng has two loan types. Both lift your Trust Score — but only a full-limit Credit-Building Loan raises your borrowing limit.</p>
               </div>
               <img src="/hippos/thumb-up-right.png" alt="" className="hclw-section-mascot" loading="lazy" />
            </div>
            <div className="hclw-loan-grid">
               {loanTypes.map((loan) => (
                  <article className={`hclw-loan-card hclw-loan-card--${loan.tone}`} key={loan.title}>
                     <span className="hclw-loan-tag">{loan.tag}</span>
                     <h3>{loan.title}</h3>
                     {loan.altName ? <span className="hclw-loan-alt">{loan.altName}</span> : null}
                     <p className="hclw-loan-def">{loan.definition}</p>
                     <div className="hclw-loan-effects">
                        <div>
                           <span>Your limit</span>
                           <strong>{loan.effectLimit}</strong>
                        </div>
                        <div>
                           <span>Trust Score</span>
                           <strong>{loan.effectTrust}</strong>
                        </div>
                     </div>
                     <p className="hclw-loan-when">
                        <b>Use it when:</b> {loan.useWhen}
                     </p>
                  </article>
               ))}
            </div>
            <p className="hclw-loan-footnote">
               Most borrowers use both — Trust-Building Loans to stay active and keep their reputation healthy, Credit-Building Loans
               to climb the ladder over time.
            </p>
         </section>

         <section className="credit-leveling-section hclw-journey-section">
            <div className="hclw-section-head">
               <div className="credit-leveling-section__header">
                  <div className="credit-leveling-kicker">Worked example</div>
                  <h2>From $15 to $60, step by step</h2>
                  <p>Here is what a clean run up the ladder looks like — four full-limit loans, each repaid on time.</p>
               </div>
               <img src="/hippos/borrower-insights-trophy.png" alt="" className="hclw-section-mascot" loading="lazy" />
            </div>
            <ol className="hclw-journey">
               {journey.map((item, index) => (
                  <li className={index === journey.length - 1 ? 'is-final' : undefined} key={item.phase}>
                     <span className="hclw-journey__phase">{item.phase}</span>
                     <div className="hclw-journey__body">
                        <strong>{item.title}</strong>
                        <p>{item.detail}</p>
                     </div>
                  </li>
               ))}
            </ol>
         </section>

         <section className="credit-leveling-section hclw-tips-section">
            <div className="hclw-section-head">
               <div className="credit-leveling-section__header">
                  <div className="credit-leveling-kicker">Level up faster</div>
                  <h2>Do this, not that</h2>
                  <p>A few habits keep your climb steady and protect the Trust Score you are building.</p>
               </div>
               <img src="/hippos/hippo-friendly-lock.png" alt="" className="hclw-section-mascot" loading="lazy" />
            </div>
            <div className="hclw-tips">
               {tips.map((tip) => (
                  <div className={`hclw-tip hclw-tip--${tip.kind}`} key={tip.text}>
                     <span className="hclw-tip__icon" aria-hidden="true">
                        {tip.kind === 'do' ? '✓' : '✕'}
                     </span>
                     <p>{tip.text}</p>
                  </div>
               ))}
            </div>
         </section>

         <section className="credit-leveling-section hclw-faq-section">
            <div className="hclw-section-head">
               <div className="credit-leveling-section__header">
                  <div className="credit-leveling-kicker">FAQ</div>
                  <h2>Credit Levels, answered</h2>
                  <p>Quick answers to the questions borrowers ask most about levelling up.</p>
               </div>
               <img src="/hippos/journal-hippo.png" alt="" className="hclw-section-mascot" loading="lazy" />
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
                  <p>Credit Levels work hand in hand with your Trust Score and repayment history.</p>
               </div>
               <img src="/hippos/community.png" alt="" className="hclw-section-mascot hclw-section-mascot--wide" loading="lazy" />
            </div>
            <div className="hclw-related-grid">
               {relatedGuides.map((item) => (
                  <Link key={item.slug} to={`/support/guides/${item.slug}`} className="hclw-related-card">
                     <strong>{item.title}</strong>
                     <span>{item.blurb}</span>
                     <em aria-hidden="true">Read guide →</em>
                  </Link>
               ))}
            </div>
         </section>

         <section className="credit-leveling-section hclw-quiz-section">
            <div className="hclw-section-head">
               <div className="credit-leveling-section__header">
                  <div className="credit-leveling-kicker">Pop quiz</div>
                  <h2>Are you a Credit Level pro?</h2>
                  <p>Five quick questions. No pressure — your hippo believes in you.</p>
               </div>
               <img src="/hippos/role-selection.png" alt="" className="hclw-section-mascot" loading="lazy" />
            </div>
            <CreditLevelsQuiz />
         </section>

         <section className="credit-leveling-bottom hclw-bottom">
            <div className="hclw-bottom__copy">
               <h2>Ready to grow your limit?</h2>
               <p>Only request your full limit when you are confident you can repay on time. Smaller loans still build trust.</p>
               <Link to="/request-board">Review live requests</Link>
            </div>
            <img src="/hippos/party.png" alt="" className="hclw-bottom__mascot" loading="lazy" />
         </section>

         <div className="hclw-footer-area">
            <NeedMoreHelp />
         </div>
      </main>
   );
}
