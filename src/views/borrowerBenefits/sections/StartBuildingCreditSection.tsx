import { type JSX } from 'react';

import { Link } from 'react-router-dom';

const creditSteps = [
   {
      title: 'Request a small loan',
      description: 'Choose an amount you can realistically repay. Loan terms are shown before you commit.'
   },
   {
      title: 'Repay on schedule',
      description: 'On-time repayments create a clear record tied to your wallet activity.'
   },
   {
      title: 'Build portable trust',
      description: 'Your repayment history can help future lenders understand your reliability.'
   }
];

export default function StartBuildingCreditSection(): JSX.Element {
   return (
      <section className="borrower-credit-section flex overflow-hidden flex-col items-center px-20 py-20 mt-20 max-w-full w-[1440px] max-md:px-5 max-md:py-14 max-md:mt-0">
         <div className="flex w-full max-w-[1056px] flex-col">
            <div className="max-w-[760px]">
               <div className="text-md-b2 font-semibold uppercase tracking-[0.16em] text-md-primary-300">Borrower credit</div>
               <h2 className="mt-4 text-5xl font-semibold leading-tight text-neutral-100 max-md:text-4xl">
                  Build a repayment history one small loan at a time
               </h2>
               <p className="mt-5 max-w-[680px] text-xl leading-8 text-violet-100 max-md:text-md-b1">
                  Moodeng is not a magic credit score or a guaranteed approval engine. It is a transparent way to request small loans, repay
                  them, and make that record easier for future lenders to evaluate.
               </p>
            </div>

            <div className="mt-10 grid grid-cols-3 gap-4 max-md:grid-cols-1">
               {creditSteps.map((step, index) => (
                  <div
                     key={step.title}
                     className="rounded-[24px] border border-white/10 bg-white/[0.045] p-6 text-violet-100 shadow-md-card"
                  >
                     <div className="flex size-10 items-center justify-center rounded-full bg-md-primary-300 text-md-b1 font-semibold text-[#171420]">
                        {index + 1}
                     </div>
                     <h3 className="mt-8 text-2xl font-semibold leading-tight text-neutral-100">{step.title}</h3>
                     <p className="mt-3 text-md-b1 leading-7 text-violet-100/85">{step.description}</p>
                  </div>
               ))}
            </div>

            <div className="mt-8 rounded-[24px] border border-md-primary-300/30 bg-md-primary-300/10 p-6 text-md-b1 leading-7 text-violet-100">
               Keep it honest: only borrow what you can repay. Your repayment history helps build trust, but it does not erase lending risk
               or promise instant credit.
            </div>

            <div className="mt-8 flex flex-wrap gap-3 max-md:flex-col">
               <Link
                  to="/request-board"
                  className="inline-flex h-14 min-w-[220px] items-center justify-center rounded-md-pill bg-md-primary-1200 px-md-5 text-md-b1 font-semibold text-white shadow-md-card max-md:w-full"
               >
                  Explore loans
               </Link>
               <a
                  href="https://moodeng-credit.gitbook.io/moodeng-credit"
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex h-14 min-w-[180px] items-center justify-center rounded-md-pill border border-md-primary-300/50 bg-transparent px-md-5 text-md-b1 font-semibold text-violet-100 max-md:w-full"
               >
                  Read the guide
               </a>
            </div>
         </div>
      </section>
   );
}
