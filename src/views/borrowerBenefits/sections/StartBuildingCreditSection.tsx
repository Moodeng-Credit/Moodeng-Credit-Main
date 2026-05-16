import { type JSX } from 'react';

import { Link } from 'react-router-dom';

const creditSteps = [
   {
      title: 'Start with a small request',
      description: 'Post a realistic amount and reason so lenders can understand what the loan is for.'
   },
   {
      title: 'Repay what you promised',
      description: 'On-time repayment strengthens the record lenders see the next time you ask for support.'
   },
   {
      title: 'Unlock the next step',
      description: 'Credit-building loans can raise your limit after full repayment, while smaller loans still help build trust.'
   }
];

const firstLoanVideoUrl = 'https://youtu.be/VoFcPS124HE';
const firstLoanEmbedUrl = 'https://www.youtube.com/embed/VoFcPS124HE';

export default function StartBuildingCreditSection(): JSX.Element {
   return (
      <section className="borrower-credit-section flex overflow-hidden flex-col items-center px-20 py-20 mt-20 max-w-full w-[1440px] max-md:px-5 max-md:py-14 max-md:mt-0">
         <div className="flex w-full max-w-[1056px] flex-col">
            <div className="max-w-[760px]">
               <div className="text-md-b2 font-semibold uppercase tracking-[0.16em] text-md-primary-300">Borrower credit</div>
               <h2 className="mt-4 text-5xl font-semibold leading-tight text-neutral-100 max-md:text-4xl">
                  Borrow, repay, and unlock more room over time
               </h2>
               <p className="mt-5 max-w-[680px] text-xl leading-8 text-violet-100 max-md:text-md-b1">
                  The point is not to look rich on day one. Moodeng gives borrowers a way to start with small direct loans, prove repayment,
                  and make future requests easier for lenders to understand.
               </p>
            </div>

            <div className="borrower-loan-video mt-10">
               <div className="borrower-loan-video__copy">
                  <div className="text-md-b2 font-semibold uppercase tracking-[0.16em] text-md-primary-300">Video walkthrough</div>
                  <h3>How to request your first loan</h3>
                  <p>
                     Watch the blackboard walkthrough before you post. It explains what to enter, how terms work, and what happens after
                     your request appears on the board.
                  </p>
                  <a href={firstLoanVideoUrl} target="_blank" rel="noreferrer">
                     Open on YouTube
                  </a>
               </div>
               <div className="borrower-loan-video__frame">
                  <iframe
                     src={firstLoanEmbedUrl}
                     title="How to request your first loan"
                     allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
                     allowFullScreen
                  />
               </div>
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
               Keep it honest: only borrow what you can repay. Moodeng can make your record clearer and more useful, but every lender still
               decides whether a request is worth funding.
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
