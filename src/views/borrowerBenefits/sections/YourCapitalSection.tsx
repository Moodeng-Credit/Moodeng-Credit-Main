import { type JSX } from 'react';

import { Link } from 'react-router-dom';

const benefits = ['Small loans', 'Gradual growth', 'No bank file'];

export default function YourCapitalSection(): JSX.Element {
   return (
      <div className="borrower-capital-section flex flex-col items-center py-10 mt-20 max-w-full w-[1440px] max-md:mt-0">
         <div className="flex overflow-hidden flex-col items-center px-20 pt-2 w-full max-md:px-5">
            <div className="flex flex-col max-w-full w-[1079px]">
               <div className="self-center text-5xl font-semibold leading-tight text-center text-neutral-100 max-md:max-w-full max-md:text-4xl">
                  Start Small. Grow by Repaying.
               </div>
               <p className="mx-auto mt-5 max-w-[680px] text-center text-xl leading-8 text-violet-100 max-md:text-left max-md:text-md-b1">
                  Moodeng starts with manageable microloans. Repay clearly, unlock more room over time, and show future lenders a record
                  built from real behavior instead of paperwork.
               </p>
               <div className="mx-auto grid max-w-[760px] grid-cols-3 gap-3 mt-9 w-full text-md-b1 leading-6 text-violet-100 max-md:grid-cols-1">
                  {benefits.map((benefit) => (
                     <div key={benefit} className="flex items-center gap-3 rounded-[18px] border border-white/10 bg-white/[0.045] p-4">
                        <span className="inline-flex size-8 shrink-0 items-center justify-center rounded-full bg-[#55c2ff] text-lg font-bold text-[#171420]">
                           ✓
                        </span>
                        <div>{benefit}</div>
                     </div>
                  ))}
               </div>
            </div>
         </div>
         <div className="flex flex-wrap gap-3 items-center justify-center mt-12 max-w-full text-md-b1 font-semibold w-[878px] max-md:w-full max-md:flex-col max-md:px-5 max-md:mt-8">
            <Link
               to="/request-board"
               className="inline-flex h-14 min-w-[220px] items-center justify-center rounded-md-pill bg-md-primary-1200 px-md-5 text-white shadow-md-card max-md:w-full"
            >
               Explore loans
            </Link>
            <a
               href="https://moodeng-credit.gitbook.io/moodeng-credit"
               target="_blank"
               rel="noreferrer"
               className="inline-flex h-14 min-w-[180px] items-center justify-center rounded-md-pill border border-md-primary-1200 bg-white px-md-5 text-md-primary-1200 max-md:w-full"
            >
               Get help
            </a>
         </div>
      </div>
   );
}
