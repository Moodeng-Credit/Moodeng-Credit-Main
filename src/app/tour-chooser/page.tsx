import { useState } from 'react';

import { useNavigate } from 'react-router-dom';

const OPTIONS = [
   {
      id: 'borrower' as const,
      title: 'I want to borrow',
      body: "See how to request a short-term USDC loan and build trust through on-time repayment.",
      href: '/request-board?tour=1&tourRole=borrower'
   },
   {
      id: 'lender' as const,
      title: 'I want to lend',
      body: 'See how to fund loan requests, review borrower trust signals, and earn by supporting people you believe in.',
      href: '/request-board?tour=1&tourRole=lender'
   },
   {
      id: 'unsure' as const,
      title: "Not sure yet — just show me around",
      body: 'Get a quick, neutral overview of how Moodeng works before deciding which side to explore.',
      href: '/tour-overview'
   }
];

type TourChoiceId = (typeof OPTIONS)[number]['id'];

export default function TourChooserPage() {
   const navigate = useNavigate();
   const [selected, setSelected] = useState<TourChoiceId | null>(null);

   const handleContinue = () => {
      const choice = OPTIONS.find((option) => option.id === selected);
      if (!choice) return;
      navigate(choice.href);
   };

   return (
      <div className="min-h-screen bg-white flex flex-col max-w-[440px] mx-auto px-5">
         <div className="flex flex-col flex-1 justify-between py-4">
            <div className="flex flex-col gap-5">
               <img src="/hippos/role-selection.png" alt="Moodeng hippo" className="w-[228px] h-[200px] object-cover" />

               <div className="flex flex-col gap-1">
                  <h1 className="text-[34px] font-semibold leading-[1.2] tracking-[-0.04em] text-md-heading">
                     Are you here to borrow or lend?
                  </h1>
                  <p className="text-md-b1 text-md-neutral-700 tracking-[-0.02em]">
                     Pick what you came to do and we&apos;ll walk you through it — no account needed yet.
                  </p>
               </div>

               {OPTIONS.map((option) => (
                  <button
                     key={option.id}
                     type="button"
                     onClick={() => setSelected(option.id)}
                     className={[
                        'flex flex-col gap-3 items-start p-4 rounded-[12px] border w-full text-left transition-colors',
                        selected === option.id ? 'bg-md-primary-900/10 border-md-primary-900' : 'bg-md-neutral-100 border-md-neutral-600'
                     ].join(' ')}
                  >
                     <span className="text-md-h5 font-semibold tracking-[-0.04em] text-md-heading">{option.title}</span>
                     <span className="text-md-b2 text-[#45556c] tracking-[-0.02em] leading-[21px]">{option.body}</span>
                  </button>
               ))}

               <button
                  type="button"
                  disabled={!selected}
                  onClick={handleContinue}
                  className="flex items-center justify-center gap-2 w-full py-4 px-5 rounded-md-lg font-semibold text-md-b1 text-md-neutral-100 tracking-[-0.02em] bg-md-primary-1200 disabled:opacity-50 transition-opacity"
               >
                  Start the tour
               </button>
            </div>

            <button
               type="button"
               onClick={() => navigate('/sign-up')}
               className="text-center text-base font-semibold tracking-[-0.02em] text-[#8336F0] hover:underline py-4"
            >
               Skip — I&apos;ll explore on my own
            </button>
         </div>
      </div>
   );
}
