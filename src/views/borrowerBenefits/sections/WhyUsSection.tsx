import { type JSX } from 'react';

const borrowerBenefits = [
   {
      eyebrow: '01 / Access',
      title: 'Start with smaller loans',
      description: 'Request practical amounts with terms shown upfront, so borrowing feels clear instead of intimidating.',
      color: 'bg-blue-400'
   },
   {
      eyebrow: '02 / Privacy',
      title: 'Keep your data safer',
      description: 'Build a repayment record from wallet activity without relying on contact-list pressure or hidden app permissions.',
      color: 'bg-fuchsia-300'
   },
   {
      eyebrow: '03 / Portability',
      title: 'Carry your history forward',
      description: 'A reliable repayment trail should be easier to reuse than a score trapped inside one app, lender, or country.',
      color: 'bg-emerald-400'
   }
];

export default function WhyUsSection(): JSX.Element {
   return (
      <div
         id="why-us"
         className="borrower-why-us-section flex flex-col pt-11 pr-3.5 pl-20 mt-20 max-w-full bg-neutral-100 rounded-[60px] w-[1440px] max-md:pl-5 max-md:mt-10"
      >
         <div className="flex flex-wrap gap-5 justify-between items-start self-center max-w-full text-3xl leading-none text-zinc-900 w-[1233px]">
            <div>NO MORE LOAN SHARKS</div>
            <img
               alt=""
               loading="lazy"
               src="https://cdn.builder.io/api/v1/image/assets/e485b3dc4b924975b4554885e21242bb/d9ac94ddf05ac09e55e7d62facd9aa97647f3694d6e028af850f87de982de6bf?apiKey=e485b3dc4b924975b4554885e21242bb"
               className="object-contain shrink-0 mt-4 aspect-[1.35] w-[50px]"
               width={100}
               height={100}
            />
         </div>
         <div className="z-10 mt-6 max-md:max-w-full">
            <div className="flex gap-5 max-md:flex-col">
               <div className="flex flex-col w-6/12 max-md:ml-0 max-md:w-full">
                  <div className="flex flex-col text-zinc-900 max-md:mt-4 max-md:max-w-full">
                     {borrowerBenefits.map((benefit) => (
                        <div
                           key={benefit.title}
                           className={`borrower-benefit-card flex overflow-hidden flex-col rounded-[30px] px-8 py-8 ${benefit.color} max-md:px-5 max-md:max-w-full`}
                        >
                           <div className="text-md-b2 font-semibold uppercase tracking-[0.14em] text-zinc-900/55">{benefit.eyebrow}</div>
                           <div className="mt-8 self-start text-3xl font-semibold leading-tight">{benefit.title}</div>
                           <div className="mt-5 text-xl leading-7 max-md:max-w-full">{benefit.description}</div>
                        </div>
                     ))}
                  </div>
               </div>
               <div className="flex flex-col ml-5 w-6/12 max-md:ml-0 max-md:w-full">
                  <div className="borrower-mecha-story flex flex-col grow text-2xl leading-6 text-center text-black max-md:mt-4 max-md:max-w-full">
                     <img
                        alt=""
                        loading="lazy"
                        src="https://cdn.builder.io/api/v1/image/assets/e485b3dc4b924975b4554885e21242bb/c637e5e1f5ff31348c478a947d562e74584bd750d7002327ad1c8336f34202f1?apiKey=e485b3dc4b924975b4554885e21242bb"
                        className="object-contain max-w-full aspect-[0.78] rounded-[30px] w-[610px]"
                        width={1170}
                        height={1500}
                     />
                     <div className="borrower-mecha-caption mb-10 overflow-hidden self-center px-6 py-4 max-w-full bg-zinc-300 rounded-[32px] w-[340px] text-2xl leading-tight max-md:px-5">
                        This is Moodeng's friend Mecha, taking down a loan shark!
                     </div>
                  </div>
               </div>
            </div>
         </div>
      </div>
   );
}
