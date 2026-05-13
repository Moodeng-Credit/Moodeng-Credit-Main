import { type JSX } from 'react';

const solutionIcon =
   'https://cdn.builder.io/api/v1/image/assets/e485b3dc4b924975b4554885e21242bb/bb78f5953512a02e5ea863cfdb833e99428413a656289baf88ecadb54194f7f7?apiKey=e485b3dc4b924975b4554885e21242bb';

const walletImage =
   'https://cdn.builder.io/api/v1/image/assets/e485b3dc4b924975b4554885e21242bb/99fc5ff0e4c5c7d1a71a15472e04cefca458634b10b9ab5baab8fd45692d9e8d?apiKey=e485b3dc4b924975b4554885e21242bb';

const solutionPoints = [
   {
      title: 'Portable wallet history',
      body: 'Repayment activity can travel with overseas workers through their wallet.'
   },
   {
      title: 'Transparent loan behavior',
      body: 'Lenders can review onchain repayment signals instead of starting from zero.'
   },
   {
      title: 'Small loans, real signal',
      body: 'Microloans create a practical path for borrowers to build proof over time.'
   }
];

export default function Web3WalletSection(): JSX.Element {
   return (
      <section className="lender-web3-section mt-4 w-full max-w-[1064px] rounded-2xl">
         <div className="lender-web3-card rounded-[28px] bg-stone-100 p-8 text-neutral-900 shadow-sm max-md:p-5">
            <div className="grid gap-8 md:grid-cols-[1fr_0.72fr] md:items-center">
               <div>
                  <div className="flex items-center gap-3 text-md-b2 font-semibold uppercase tracking-[0.14em] text-stone-600">
                     <img alt="" loading="lazy" src={solutionIcon} className="size-10 object-contain" width={47} height={62} />
                     <span>Our solution</span>
                  </div>

                  <h2 className="mt-6 text-4xl font-semibold leading-tight tracking-normal text-neutral-950 max-md:text-3xl">
                     Credit history that can move with a wallet.
                  </h2>

                  <p className="mt-4 max-w-[34rem] text-lg leading-7 text-stone-600 max-md:text-base max-md:leading-6">
                     Moodeng turns small, transparent repayments into a portable credit record borrowers can keep building, even while
                     working abroad.
                  </p>

                  <div className="mt-6 grid gap-3">
                     {solutionPoints.map((point) => (
                        <div key={point.title} className="lender-web3-point rounded-[16px] p-4">
                           <strong className="block text-md-b2 text-neutral-950">{point.title}</strong>
                           <span className="mt-1 block text-md-b2 leading-6 text-stone-600">{point.body}</span>
                        </div>
                     ))}
                  </div>
               </div>

               <div className="lender-illustration-visual lender-illustration-visual--wallet">
                  <div className="lender-web3-image-wrap overflow-hidden rounded-[22px] bg-white">
                     <img
                        loading="lazy"
                        src={walletImage}
                        alt="Moodeng Credit wallet illustration"
                        className="h-full w-full object-cover object-top"
                        width={321}
                        height={321}
                     />
                  </div>
                  <div className="lender-illustration-stage" aria-hidden="true" />
               </div>
            </div>
         </div>
      </section>
   );
}
