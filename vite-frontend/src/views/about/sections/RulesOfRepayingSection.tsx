import { type JSX } from 'react';

export default function RulesOfRepayingSection(): JSX.Element {
   const rules = [
      {
         title: 'DIRECT',
         description: 'You must pay the lender directly by hitting the repay button.',
         bgColor: 'bg-indigo-500'
      },
      {
         title: 'UP-TO-YOU',
         description: 'Flexible repayments: Any amount up to deadline',
         bgColor: 'bg-emerald-400'
      },
      {
         title: 'RESPONSIBLE',
         description: 'Build credit score with each on-time payment',
         bgColor: 'bg-blue-400'
      },
      {
         title: 'INTEGRITY',
         description: 'Blockchain records all loan transactions',
         bgColor: 'bg-fuchsia-300'
      },
      {
         title: 'TIMELY',
         description: 'Sign up for notifications about your loans',
         bgColor: 'bg-amber-500'
      }
   ];

   return (
      <div
         id="rules"
         className="flex flex-col justify-center px-20 py-28 mt-20 max-w-full w-[1440px] max-md:px-5 max-md:py-24 max-md:mt-10"
      >
         <div className="flex flex-col items-start -mb-5 max-md:mb-2.5 max-md:max-w-full">
            <div className="text-3xl leading-none text-neutral-100">RULES OF REPAYING</div>
            <div className="mt-16 text-2xl leading-none text-neutral-100 max-md:mt-10 max-md:max-w-full">
               Moodeng offers flexible, blockchain-based microloans. Repay responsibly to build your credit score.
            </div>
            <div className="self-stretch mt-16 max-md:mt-10 max-md:max-w-full">
               <div className="flex max-md:flex-col">
                  {rules.map((rule, index) => (
                     <div
                        key={rule.title}
                        className={`flex flex-col ${index > 0 ? 'ml-5' : ''} w-[20%] h-[250px] max-md:ml-0 max-md:w-full`}
                     >
                        <div
                           className={`flex overflow-hidden flex-col grow pt-11 pr-1 pb-24 pl-4 w-full h-full ${rule.bgColor} rounded-[30px] max-md:px-5 max-md:mt-3.5`}
                        >
                           <div className="text-xl leading-8 uppercase mb-5 text-zinc-900 text-opacity-50 w-[90%] max-md:ml-2">
                              {rule.title}
                           </div>
                           <div className="w-[150px] text-[22px] leading-7 text-neutral-100 w-[90%] max-md:mt-10">{rule.description}</div>
                        </div>
                     </div>
                  ))}
               </div>
            </div>
         </div>
      </div>
   );
}
