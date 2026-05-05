import { type JSX } from 'react';

const roadmapSteps = [
   {
      phase: 'Now',
      title: 'Start with verified repayment records',
      description: 'Make small loan requests and repayments easier to review, so borrowers can build a visible history inside Moodeng.'
   },
   {
      phase: 'Next',
      title: 'Shape a portable credit profile',
      description:
         'Turn repayment behavior, wallet history, and borrower context into a clearer profile borrowers can understand and share.'
   },
   {
      phase: 'Later',
      title: 'Build toward a credit passport',
      description:
         'Create borrower-controlled summaries that could help explain reliability outside Moodeng, without exposing unnecessary data.'
   },
   {
      phase: 'Goal',
      title: 'Open doors to real-world credit',
      description:
         'Work toward partner and lender pathways where strong Moodeng history can support better loan conversations in the future.'
   }
];

export default function OurRoadmapSection(): JSX.Element {
   return (
      <section className="borrower-roadmap-section flex flex-col justify-center px-20 py-20 mt-12 max-w-full w-[1440px] max-md:px-5 max-md:py-14 max-md:mt-0">
         <div className="flex flex-col items-start max-md:max-w-full">
            <div className="text-md-b2 font-semibold uppercase tracking-[0.16em] text-md-primary-300">Our roadmap</div>
            <h2 className="mt-4 max-w-[760px] text-5xl font-semibold leading-tight text-neutral-100 max-md:text-4xl">
               From Moodeng credit to a portable credit passport
            </h2>
            <p className="mt-5 max-w-[760px] text-xl leading-8 text-violet-100 max-md:text-md-b1">
               The goal is not to promise instant bank approval. It is to help borrowers turn reliable repayment behavior into a record that
               can become more useful over time.
            </p>

            <div className="mt-10 grid w-full grid-cols-4 gap-4 max-lg:grid-cols-2 max-md:grid-cols-1">
               {roadmapSteps.map((step, index) => (
                  <article key={step.title} className="rounded-[24px] border border-white/10 bg-white/[0.045] p-5 text-violet-100">
                     <div className="flex items-center justify-between gap-4">
                        <span className="text-md-b2 font-semibold uppercase tracking-[0.14em] text-md-primary-300">{step.phase}</span>
                        <span className="flex size-8 items-center justify-center rounded-full bg-md-primary-300 text-md-b2 font-bold text-[#171420]">
                           {index + 1}
                        </span>
                     </div>
                     <h3 className="mt-8 text-2xl font-semibold leading-tight text-neutral-100">{step.title}</h3>
                     <p className="mt-3 text-md-b1 leading-7 text-violet-100/80">{step.description}</p>
                  </article>
               ))}
            </div>

            <div className="mt-6 rounded-[24px] border border-md-primary-300/30 bg-md-primary-300/10 p-5 text-md-b1 leading-7 text-violet-100">
               This is a product direction, not a guarantee. Real-world lenders decide their own approvals, but Moodeng can make borrower
               history clearer, more portable, and easier to evaluate.
            </div>
         </div>
      </section>
   );
}
