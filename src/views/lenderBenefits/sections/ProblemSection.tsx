import { type JSX } from 'react';

const dilemmaIcon =
   'https://cdn.builder.io/api/v1/image/assets/e485b3dc4b924975b4554885e21242bb/8cfc628945a40feb21a78f60ccef6475ebab71e17630fddfde10c2583f7451cb?apiKey=e485b3dc4b924975b4554885e21242bbwidth=100';

const problemIcon =
   'https://cdn.builder.io/api/v1/image/assets/e485b3dc4b924975b4554885e21242bb/f79e796f7eda8520b5ec951a1533aadb3b8214a9c6834cd98a8f615377323860?apiKey=054474a0b7744b6389c3319e0a9290c2&width=100';

const borrowerIllustration =
   'https://cdn.builder.io/api/v1/image/assets/e485b3dc4b924975b4554885e21242bb/fd30d6d5d1e9811d55adf78d663141aebb602fe77cf99a6ce1a565aa456f63b4?apiKey=e485b3dc4b924975b4554885e21242bb';

const problemPoints = [
   {
      title: 'Credit gets reset',
      body: 'A Filipino or SEA worker can repay responsibly abroad and still have no useful credit record.',
      tone: 'reset'
   },
   {
      title: 'Good borrowers disappear',
      body: 'Lenders cannot easily see the trust signals that should matter for a small emergency loan.',
      tone: 'invisible'
   },
   {
      title: 'Bad options fill the gap',
      body: 'Quick-loan apps step in with pressure, high costs, and little long-term upside.',
      tone: 'gap'
   }
];

export default function ProblemSection(): JSX.Element {
   return (
      <div className="lender-problem-section grid w-full gap-4 md:grid-cols-[1.15fr_0.85fr]">
         <article className="overflow-hidden rounded-[28px] bg-stone-100 p-8 text-neutral-900 shadow-sm max-md:p-5">
            <div className="flex items-center gap-3 text-md-b2 font-semibold uppercase tracking-[0.14em] text-stone-600">
               <span>A global dilemma</span>
               <img alt="" loading="lazy" src={dilemmaIcon} className="size-10 object-contain" width={40} height={40} />
            </div>

            <div className="mt-10 grid gap-8 md:grid-cols-[0.95fr_1.05fr] md:items-end max-md:mt-8">
               <div>
                  <h2 className="text-4xl font-semibold leading-tight tracking-normal text-neutral-950 max-md:text-3xl">
                     Help workers build credit away from home.
                  </h2>
                  <p className="mt-5 text-xl leading-8 text-stone-700 max-md:text-lg max-md:leading-7">
                     Overseas borrowers often need modest emergency money while their local credit history stays trapped somewhere else.
                     Moodeng helps repayment become a record they can keep building.
                  </p>
                  <div className="lender-problem-callout mt-6 rounded-[18px] bg-white p-4 text-md-b1 font-semibold text-neutral-950 shadow-[inset_0_0_0_1px_rgba(28,25,23,0.06)]">
                     Traditional credit: starts over at zero
                  </div>
               </div>

               <div className="lender-illustration-visual lender-illustration-visual--people">
                  <img
                     alt="A group of people held together in a circular illustration"
                     loading="lazy"
                     src={borrowerIllustration}
                     className="w-full object-contain"
                     width={400}
                     height={494}
                  />
                  <div className="lender-illustration-stage" aria-hidden="true" />
               </div>
            </div>
         </article>

         <article className="lender-problem-card rounded-[28px] bg-stone-100 p-8 text-neutral-900 shadow-sm max-md:p-5">
            <div className="lender-problem-kicker flex items-center gap-3 text-md-b2 font-semibold uppercase tracking-[0.14em] text-stone-600">
               <img alt="" loading="lazy" src={problemIcon} className="size-10 object-contain" width={40} height={40} />
               <span>The problem</span>
            </div>

            <h3 className="mt-8 text-4xl font-semibold leading-tight tracking-normal text-neutral-950 max-md:mt-6 max-md:text-3xl">
               Good repayment rarely travels.
            </h3>
            <p className="mt-3 text-lg leading-7 text-stone-600 max-md:text-base max-md:leading-6">
               That creates a trust gap for borrowers and a missed opportunity for lenders.
            </p>

            <div className="mt-6 grid gap-3 max-md:mt-5">
               {problemPoints.map((point) => (
                  <div
                     key={point.title}
                     className={`lender-problem-point lender-problem-point--${point.tone} flex gap-3 rounded-[16px] p-4 text-stone-700`}
                  >
                     <span className="lender-problem-dot mt-1 size-2.5 shrink-0 rounded-full" />
                     <span>
                        <strong className="block text-md-b2 text-neutral-950">{point.title}</strong>
                        <span className="mt-1 block text-md-b2 leading-6 text-stone-600">{point.body}</span>
                     </span>
                  </div>
               ))}
            </div>
         </article>
      </div>
   );
}
