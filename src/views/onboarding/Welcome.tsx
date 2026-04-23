import { useSelector } from 'react-redux';
import { useNavigate } from 'react-router-dom';

import type { RootState } from '@/store/store';
import { OnboardingHeader } from '@/views/onboarding/OnboardingHeader';

export default function Welcome() {
   const navigate = useNavigate();
   const user = useSelector((state: RootState) => state.auth.user);

   return (
      <div className="min-h-screen bg-gradient-to-b from-[#fbfafd] to-white flex flex-col max-w-[440px] mx-auto w-full">
         <OnboardingHeader title="Onboarding" />

         <div className="flex flex-col gap-md-4 p-md-4">
            <img
               src="/hippos/welcome.png"
               alt="Moodeng hippo"
               className="w-[110px] h-[96px] object-cover"
            />

            <div className="flex flex-col gap-md-0 w-full">
               {user?.userRole === 'lender' ? (
                  <>
                     <h2 className="text-md-display text-md-heading">
                        Lend to real people and help them build credit.
                     </h2>
                     <p className="text-md-b1 text-md-neutral-700 font-medium">
                        Earn onchain — powered by Base.
                     </p>
                  </>
               ) : (
                  <>
                     <h2 className="text-md-display text-md-heading">
                        You're building a reputation your wallet can carry anywhere.
                     </h2>
                     <p className="text-md-b1 text-md-neutral-700 font-medium">
                        Borrow responsibly. Build trust. Unlock more over time.
                     </p>
                  </>
               )}
            </div>

            <div className="flex flex-col gap-md-4 p-md-4 rounded-[12px] border border-md-primary-900 bg-md-primary-900/10 w-full">
               <div className="flex gap-md-3 items-start w-full">
                  <div className="size-10 rounded-md-sm-md bg-md-primary-2100 inline-flex items-center justify-center shrink-0">
                     <span
                        className="block size-5 bg-white"
                        style={{
                           WebkitMaskImage: "url('/icons/lightning.svg')",
                           maskImage: "url('/icons/lightning.svg')",
                           WebkitMaskRepeat: 'no-repeat',
                           maskRepeat: 'no-repeat',
                           WebkitMaskPosition: 'center',
                           maskPosition: 'center',
                           WebkitMaskSize: 'contain',
                           maskSize: 'contain'
                        }}
                     />
                  </div>
                  <div className="flex flex-col gap-md-1 flex-1 min-w-0">
                     <div className="flex flex-wrap items-center gap-md-1">
                        <h3 className="text-md-h5 text-md-heading">Get Started Now</h3>
                        <span className="inline-flex items-center justify-center px-md-1 py-md-0 rounded-md-sm bg-md-primary-300 text-md-b3 font-semibold text-md-primary-1200">
                           Recommended
                        </span>
                     </div>
                     <p className="text-md-b1 text-md-primary-1500">
                        Set up your account and verify your identity to access credit
                     </p>
                  </div>
               </div>

               <div className="flex flex-col gap-md-3 w-full">
                  <button
                     type="button"
                     onClick={() => navigate('/onboarding/wallet')}
                     className="flex items-center justify-center gap-md-1 w-full px-md-4 py-md-3 rounded-md-lg bg-md-primary-1200 text-md-b1 font-semibold text-md-neutral-100"
                  >
                     <span
                        className="block size-6 bg-md-neutral-100"
                        style={{
                           WebkitMaskImage: "url('/icons/lightning.svg')",
                           maskImage: "url('/icons/lightning.svg')",
                           WebkitMaskRepeat: 'no-repeat',
                           maskRepeat: 'no-repeat',
                           WebkitMaskPosition: 'center',
                           maskPosition: 'center',
                           WebkitMaskSize: 'contain',
                           maskSize: 'contain'
                        }}
                     />
                     Start Setup
                  </button>

                  {false && (
                     <button
                        type="button"
                        className="inline-flex items-center justify-center gap-md-1 w-full text-md-b2 font-semibold text-md-primary-1200"
                     >
                        <span
                           className="block size-6 bg-md-primary-1200"
                           style={{
                              WebkitMaskImage: "url('/icons/play.svg')",
                              maskImage: "url('/icons/play.svg')",
                              WebkitMaskRepeat: 'no-repeat',
                              maskRepeat: 'no-repeat',
                              WebkitMaskPosition: 'center',
                              maskPosition: 'center',
                              WebkitMaskSize: 'contain',
                              maskSize: 'contain'
                           }}
                        />
                        Watch Tutorial
                     </button>
                  )}
               </div>
            </div>

            <div className="flex flex-col gap-md-4 p-md-4 rounded-[12px] border border-md-blue-600 bg-md-blue-600/10 w-full">
               <div className="flex gap-md-3 items-start w-full">
                  <div className="size-10 rounded-md-sm-md bg-md-blue-700 inline-flex items-center justify-center shrink-0">
                     <span
                        className="block size-5 bg-white"
                        style={{
                           WebkitMaskImage: "url('/icons/eye.svg')",
                           maskImage: "url('/icons/eye.svg')",
                           WebkitMaskRepeat: 'no-repeat',
                           maskRepeat: 'no-repeat',
                           WebkitMaskPosition: 'center',
                           maskPosition: 'center',
                           WebkitMaskSize: 'contain',
                           maskSize: 'contain'
                        }}
                     />
                  </div>
                  <div className="flex flex-col gap-md-1 flex-1 min-w-0">
                     <div className="flex flex-wrap items-center gap-md-1">
                        <h3 className="text-md-h5 text-md-heading">Check It Out First</h3>
                        <span className="inline-flex items-center justify-center px-md-1 py-md-0 rounded-md-sm bg-md-blue-200 text-md-b3 font-semibold text-md-blue-800">
                           No commitment
                        </span>
                     </div>
                     <p className="text-md-b1 text-md-blue-800">
                        Explore features, compare rates, and see how it all works
                     </p>
                     <ul className="flex flex-col gap-md-0 pt-md-1">
                        {['Browse Features', 'View rates', 'Learn How It Works!'].map((item) => (
                           <li key={item} className="flex gap-md-1 items-center text-md-b2 font-semibold text-md-blue-1000">
                              <span className="size-[6px] rounded-full bg-md-blue-700 shrink-0" />
                              {item}
                           </li>
                        ))}
                     </ul>
                  </div>
               </div>

               <button
                  type="button"
                  onClick={() => navigate('/request-board')}
                  className="flex items-center justify-center gap-md-1 w-full px-md-4 py-md-3 rounded-md-lg border border-md-blue-600 text-md-b1 font-semibold text-md-blue-600"
               >
                  Explore Moodeng
                  <span
                     className="block size-6 bg-md-blue-600"
                     style={{
                        WebkitMaskImage: "url('/icons/chevron-right.svg')",
                        maskImage: "url('/icons/chevron-right.svg')",
                        WebkitMaskRepeat: 'no-repeat',
                        maskRepeat: 'no-repeat',
                        WebkitMaskPosition: 'center',
                        maskPosition: 'center',
                        WebkitMaskSize: 'contain',
                        maskSize: 'contain'
                     }}
                  />
               </button>
            </div>
         </div>
      </div>
   );
}
