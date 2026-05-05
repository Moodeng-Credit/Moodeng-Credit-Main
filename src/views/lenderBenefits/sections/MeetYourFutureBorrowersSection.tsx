import { type JSX } from 'react';

export default function MeetYourFutureBorrowersSection(): JSX.Element {
   return (
      <div className="lender-borrower-intro rounded-[32px] bg-emerald-400 px-10 py-8 text-zinc-950 max-md:px-5">
         <div className="grid gap-6 md:grid-cols-[1.05fr_0.95fr] md:items-center">
            <div>
               <p className="text-md-b2 font-semibold uppercase tracking-[0.14em] text-emerald-950/70">First borrower communities</p>
               <h2 className="mt-4 max-w-[680px] text-5xl font-semibold leading-tight tracking-normal max-md:text-3xl">
                  Meet overseas Filipinos and Southeast Asians building credit abroad.
               </h2>
               <p className="mt-5 max-w-[640px] text-2xl leading-8 text-zinc-900 max-md:text-base max-md:leading-6">
                  We are starting with workers and migrants in places where World ID verification is practical, including South Korea,
                  Taiwan, Japan, Singapore, and other Orb-supported cities.
               </p>
               <div className="mt-6 flex flex-wrap gap-2 text-md-b2 font-semibold">
                  {['Filipino workers', 'SEA migrants', 'Orb verified', 'USDC microloans'].map((label) => (
                     <span key={label} className="rounded-full bg-white/80 px-3 py-2 shadow-sm">
                        {label}
                     </span>
                  ))}
               </div>
            </div>
            <div className="lender-borrower-intro__image overflow-hidden rounded-[24px] bg-white/70 p-3">
               <img
                  loading="lazy"
                  src="https://cdn.builder.io/api/v1/image/assets/e485b3dc4b924975b4554885e21242bb/45ad5ed76723d8955bf297795913ba4324596fd1ac8fd84eda5f2caba45e53b1?apiKey=e485b3dc4b924975b4554885e21242bb"
                  alt="Borrower community illustration"
                  className="h-full w-full object-contain"
                  width={525}
                  height={330}
               />
            </div>
         </div>
      </div>
   );
}
