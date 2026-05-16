import { type JSX } from 'react';

export default function HeroSection(): JSX.Element {
   return (
      <div className="flex overflow-hidden flex-col items-center px-20 mt-2 w-full text-zinc-900 max-md:px-5 max-md:mt-10 max-md:max-w-full">
         <div className="flex overflow-hidden flex-col items-start px-20 pt-16 pb-28 max-w-full bg-emerald-400 rounded-[60px] w-[1440px] max-md:px-5 max-md:pb-24">
            <div className="flex flex-col mb-0 max-w-full max-md:mb-2.5">
               <div className="self-start text-7xl leading-none uppercase max-md:max-w-full max-md:text-4xl">
                  Microloans with USDC to build your credit
               </div>
               <div className="mt-4 text-3xl leading-8 max-md:mt-10 max-md:max-w-full">
                  <span className="font-extrabold">Moodeng</span> connects borrowers directly with people willing to lend. There is no
                  escrow desk and no middle-man setting the rules: you request, a lender funds, and your repayment record grows from there.
               </div>
            </div>
         </div>
      </div>
   );
}
