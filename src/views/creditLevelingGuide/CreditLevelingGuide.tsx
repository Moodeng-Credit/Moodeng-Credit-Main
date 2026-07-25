import { type CSSProperties, type JSX, useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';

import { usePageSeo } from '@/hooks/usePageSeo';

import '@/views/academy/AcademyGuide.css';
import '@/views/creditLevelingGuide/CreditLevelingGuide.css';

const levels = [
   { level: 'Level 1', limit: '$15', note: 'Start here', unlock: 'Verify and make your first request', state: 'Current' },
   { level: 'Level 2', limit: '$20', note: 'Next unlock', unlock: 'Borrow $15 and repay funded terms on time', state: 'Next' },
   { level: 'Level 3', limit: '$40', note: 'After that', unlock: 'Borrow $20 and repay funded terms on time', state: 'Locked' },
   { level: 'Level 4', limit: '$60', note: 'Keep building', unlock: 'Borrow $40 and repay funded terms on time', state: 'Locked' }
];

const examples = [
   {
      title: 'Trust-building loan',
      amount: '$10 of $15',
      result: 'Builds repayment history',
      body: 'Useful when you need less than your full limit. It can help lenders trust you, but it does not raise your credit level.',
      tone: 'trust'
   },
   {
      title: 'Credit-building loan',
      amount: '$15 of $15',
      result: 'Can unlock $20',
      body: 'This is the level-up loan. You borrow your full current limit and repay the funded terms on time.',
      tone: 'credit'
   },
   {
      title: 'Late or missed repayment',
      amount: 'Past due',
      result: 'Can pause progress',
      body: 'Your level does not become the main signal anymore. Lenders will care about the missed repayment first.',
      tone: 'risk'
   }
];

const rules = [
   'Borrowing below your limit builds trust, not your next level.',
   'Borrowing your full current limit is what can unlock the next level.',
   'You still need to repay the accepted terms clearly and on time.',
   'Paying extra does not skip levels. Moodeng moves one level at a time.'
];

const howItWorks = [
   {
      step: '01',
      title: 'Use the full current limit',
      body: 'If your current level allows $15, the credit-building request is $15.'
   },
   {
      step: '02',
      title: 'Repay the accepted terms on time',
      body: 'The repayment has to match the funded loan and land before the due date.'
   },
   {
      step: '03',
      title: 'Unlock the next level',
      body: 'A clean repayment can move you to the next borrowing limit. Smaller loans still build trust.'
   }
];

export default function CreditLevelingGuide(): JSX.Element {
   const [readingProgress, setReadingProgress] = useState(0);

   usePageSeo({
      title: 'Credit Leveling Guide | Moodeng Credit',
      description:
         'How Moodeng credit levels work: repay a full-limit loan on time to unlock the next level, from $15 up to $60, plus trust-building vs credit-building loans.',
      canonicalPath: '/credit-leveling-guide'
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
      <main className="credit-leveling-guide">
         <div className="academy-reading-progress" style={progressStyle} aria-label={`Credit leveling guide progress ${readingProgress}%`}>
            <span>{readingProgress}%</span>
         </div>

         <section className="credit-leveling-hero">
            <div className="credit-leveling-hero__copy">
               <div className="credit-leveling-kicker">Moodeng Academy</div>
               <h1>How to unlock your next Credit Level</h1>
               <p>
                  Credit Leveling is not a list of buttons to press. It is one simple rule: use your full current limit,
                  repay the funded terms on time, then unlock the next limit.
               </p>
               <div className="credit-leveling-hero__actions">
                  <Link to="/request-board">See Request Board</Link>
                  <Link to="/academy">Back to Academy</Link>
               </div>
            </div>

            <div className="credit-leveling-rule" aria-label="Main credit leveling rule">
               <span>The rule</span>
               <div className="credit-leveling-formula" aria-hidden="true">
                  <strong>Full limit</strong>
                  <b>+</b>
                  <strong>On-time repayment</strong>
                  <b>=</b>
                  <strong>Next level</strong>
               </div>
               <p>If your limit is $15, a $15 credit-building loan can unlock $20. A smaller loan builds trust, but it does not level you up.</p>
            </div>
         </section>

         <section className="credit-leveling-section credit-leveling-how-section">
            <div className="credit-leveling-section__header">
               <div className="credit-leveling-kicker">How it works</div>
               <h2>The level-up path is simple</h2>
               <p>Credit Leveling rewards one specific pattern: a full-limit request followed by a clean repayment.</p>
            </div>
            <div className="credit-leveling-how-list" aria-label="How credit leveling works">
               {howItWorks.map((item) => (
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
            <div className="credit-leveling-section__header">
               <div className="credit-leveling-kicker">Credit ladder</div>
               <h2>Your limit grows one level at a time</h2>
               <p>Everyone starts small. Each successful credit-building loan unlocks the next borrowing limit.</p>
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
            <div className="credit-leveling-section__header">
               <div className="credit-leveling-kicker">Examples</div>
               <h2>If your current limit is $15</h2>
               <p>The amount you request changes what kind of loan it is.</p>
            </div>
            <div className="credit-leveling-example-grid">
               {examples.map((example) => (
                  <article className={`credit-leveling-example credit-leveling-example--${example.tone}`} key={example.title}>
                     <span>{example.amount}</span>
                     <h3>{example.title}</h3>
                     <strong>{example.result}</strong>
                     <p>{example.body}</p>
                  </article>
               ))}
            </div>
         </section>

         <section className="credit-leveling-section credit-leveling-rules-section">
            <div className="credit-leveling-section__header">
               <div className="credit-leveling-kicker">What counts</div>
               <h2>The clean version</h2>
            </div>
            <div className="credit-leveling-rules">
               {rules.map((rule) => (
                  <div key={rule}>{rule}</div>
               ))}
            </div>
         </section>

         <section className="credit-leveling-bottom">
            <h2>Ready to build the next level?</h2>
            <p>Only request the full limit when you are confident you can repay. Smaller loans are still useful for trust.</p>
            <Link to="/request-board">Review live requests</Link>
         </section>
      </main>
   );
}
