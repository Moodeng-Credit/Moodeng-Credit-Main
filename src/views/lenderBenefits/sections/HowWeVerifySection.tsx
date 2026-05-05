import { type JSX } from 'react';

import { BadgeCheck, Fingerprint, ShieldCheck } from 'lucide-react';

export default function HowWeVerifySection(): JSX.Element {
   return (
      <div className="lender-world-verify mt-20 flex max-w-full flex-col justify-center rounded-[44px] px-10 py-10 text-zinc-950 max-md:mt-10 max-md:px-5">
         <div className="grid w-full items-center gap-8 md:grid-cols-[1.15fr_0.85fr]">
            <div>
               <div className="inline-flex items-center gap-2 rounded-full bg-white/70 px-4 py-2 text-sm font-semibold uppercase tracking-[0.12em] text-zinc-700">
                  <ShieldCheck className="size-4" />
                  World ID verification
               </div>
               <h2 className="mt-5 max-w-[760px] text-5xl font-semibold leading-[0.98] tracking-normal max-md:text-4xl">
                  Verified humans, clearer lending signals.
               </h2>
               <p className="mt-5 max-w-[760px] text-2xl leading-snug text-zinc-800 max-md:text-xl">
                  Borrowers verify with World ID before they can request loans. That gives lenders a real-person signal without asking
                  borrowers to hand over private documents to Moodeng.
               </p>

               <div className="mt-7 grid gap-3 sm:grid-cols-3">
                  <div className="lender-world-verify__point">
                     <Fingerprint className="size-5" />
                     <span>Unique person</span>
                  </div>
                  <div className="lender-world-verify__point">
                     <BadgeCheck className="size-5" />
                     <span>One account</span>
                  </div>
                  <div className="lender-world-verify__point">
                     <ShieldCheck className="size-5" />
                     <span>Less bot risk</span>
                  </div>
               </div>
            </div>

            <div className="lender-world-verify__badge" aria-label="World ID">
               <div className="lender-world-verify__orb">W</div>
               <div>
                  <div className="text-sm font-semibold uppercase tracking-[0.16em] text-zinc-500">Verified with</div>
                  <div className="text-4xl font-semibold leading-none">World ID</div>
                  <div className="mt-3 text-base leading-6 text-zinc-600">
                     Borrowers prove uniqueness through World App and Orb availability in the markets we support first.
                  </div>
               </div>
            </div>
         </div>
      </div>
   );
}
