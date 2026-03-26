import { useEffect } from 'react';
import type { JSX } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { ChevronLeft, ChevronRight, Eye, HelpCircle, Play, Sparkles, Zap } from 'lucide-react';
import { useSelector } from 'react-redux';

import type { RootState } from '@/store/store';

export default function WelcomeOnboardingPage(): JSX.Element {
   const navigate = useNavigate();
   const user = useSelector((s: RootState) => s.auth.user);

   useEffect(() => {
      if (user?.id && !user.userRole) {
         navigate('/onboarding/role', { replace: true });
      }
   }, [user?.id, user?.userRole, navigate]);

   const goRequestBoard = () => navigate('/dashboard', { replace: true });

   return (
      <div className="relative isolate flex min-h-screen flex-col bg-gradient-to-b from-[#FBFAFD] to-[#FFFFFF] font-sans antialiased">
         {/* Full-width top bar */}
         <header className="flex w-full shrink-0 items-center justify-between gap-6 border-b border-[#E8E5EF]/80 bg-[#FBFAFD]/95 px-5 py-4 backdrop-blur-sm sm:px-8">
            <button
               type="button"
               onClick={() => navigate('/onboarding/role')}
               className="flex h-12 w-12 shrink-0 items-center justify-center text-[#1C053D] hover:opacity-80"
               aria-label="Back"
            >
               <ChevronLeft className="h-6 w-6" strokeWidth={2} />
            </button>
            <h1 className="min-w-0 flex-1 text-center text-[28px] font-[590] leading-[1.1] tracking-[-0.02em] text-[#1C053D]">
               Onboarding
            </h1>
            <Link
               to="/faq"
               className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-white shadow-[0px_2px_4px_rgba(27,28,29,0.04)] transition-opacity hover:opacity-90"
               aria-label="Help"
            >
               <HelpCircle className="h-6 w-6 text-[#8336F0]" strokeWidth={2} />
            </Link>
         </header>

         <main className="w-full flex-1">
            <div className="mx-auto max-w-6xl px-5 py-6 pb-12 sm:px-8 lg:px-10">
               <img
                  src="/auth-screen.png"
                  alt=""
                  className="mb-5 h-[96px] w-[110px] shrink-0 object-contain sm:h-[110px] sm:w-[126px]"
               />

               <div className="mb-6 flex flex-col gap-1 lg:mb-8">
                  <h2 className="max-w-3xl text-[34px] font-[590] leading-[1.2] tracking-[-0.04em] text-[#040033]">
                     You&apos;re building a reputation your wallet can carry anywhere.
                  </h2>
                  <p className="max-w-3xl text-base font-[510] leading-6 tracking-[-0.02em] text-[#6D6D6D]">
                     Borrow responsibly. Build trust. Unlock more over time.
                  </p>
               </div>

               {/* Two cards: stacked on mobile, two columns on large screens */}
               <div className="grid grid-cols-1 gap-5 lg:grid-cols-2 lg:gap-6 lg:items-stretch">
                  <section className="flex flex-col gap-5 rounded-xl border border-[#8336F0] bg-[rgba(105,17,229,0.1)] p-5">
                     <div className="flex gap-4">
                        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-[14px] bg-[#9810FA] text-white">
                           <Zap className="h-5 w-5" strokeWidth={1.75} fill="none" aria-hidden />
                        </div>
                        <div className="flex min-w-0 flex-1 flex-col gap-2">
                           <div className="flex flex-wrap items-center gap-2">
                              <h3 className="text-lg font-[590] leading-[1.2] tracking-[-0.04em] text-[#040033]">
                                 Get Started Now
                              </h3>
                              <span className="rounded bg-[#D6BCFA] px-2 py-1 text-xs font-[590] leading-[1.2] tracking-[-0.02em] text-[#6010D2]">
                                 Recommended
                              </span>
                           </div>
                           <p className="text-base font-normal leading-6 tracking-[-0.02em] text-[#470B9A]">
                              Set up your account and verify your identity to access credit
                           </p>
                        </div>
                     </div>

                     <div className="mt-auto flex flex-col gap-4">
                        <Link
                           to="/dashboard"
                           className="flex h-14 w-full items-center justify-center gap-2 rounded-2xl bg-[#6010D2] text-base font-[590] leading-6 tracking-[-0.02em] text-[#FDFCFD] transition-opacity hover:opacity-95"
                        >
                           <Sparkles className="h-6 w-6 shrink-0 text-[#FDFCFD]" strokeWidth={1.5} aria-hidden />
                           Start Setup
                        </Link>
                        <button
                           type="button"
                           onClick={() => navigate('/guide')}
                           className="flex h-6 w-full items-center justify-center gap-2 text-sm font-[590] leading-[21px] tracking-[-0.02em] text-[#6010D2] hover:underline"
                        >
                           <span className="relative flex h-6 w-6 shrink-0 items-center justify-center">
                              <span className="absolute h-[18px] w-[18px] rounded-full bg-[rgba(105,17,229,0.1)]" aria-hidden />
                              <Play className="relative h-3.5 w-3.5 fill-[#6010D2] text-[#6010D2]" aria-hidden />
                           </span>
                           Watch Tutorial
                        </button>
                     </div>
                  </section>

                  <section className="flex flex-col gap-5 rounded-xl border border-[#0076EB] bg-[rgba(0,118,235,0.1)] p-5">
                     <div className="flex gap-4">
                        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-[14px] bg-[#155DFC] text-white">
                           <Eye className="h-5 w-5" strokeWidth={1.67} aria-hidden />
                        </div>
                        <div className="flex min-w-0 flex-1 flex-col gap-2">
                           <div className="flex flex-wrap items-center gap-2">
                              <h3 className="text-lg font-[590] leading-[1.2] tracking-[-0.04em] text-[#040033]">
                                 Check It Out First
                              </h3>
                              <span className="rounded bg-[#A3D1FF] px-2 py-1 text-xs font-[590] leading-[1.2] tracking-[-0.02em] text-[#0053A5]">
                                 No commitment
                              </span>
                           </div>
                           <p className="text-base font-normal leading-6 tracking-[-0.02em] text-[#0053A5]">
                              Explore features, compare rates, and see how it all works
                           </p>

                           <div className="mt-2 flex flex-col gap-2.5 pt-2">
                              <div className="flex items-center gap-2">
                                 <span className="h-[6px] w-[6px] shrink-0 rounded-full bg-[#155DFC]" aria-hidden />
                                 <button
                                    type="button"
                                    onClick={goRequestBoard}
                                    className="text-left text-sm font-[590] leading-[21px] tracking-[-0.02em] text-[#00305F] hover:underline"
                                 >
                                    Browse Features
                                 </button>
                              </div>
                              <div className="flex items-center gap-2">
                                 <span className="h-[6px] w-[6px] shrink-0 rounded-full bg-[#155DFC]" aria-hidden />
                                 <button
                                    type="button"
                                    onClick={() => navigate('/benefits')}
                                    className="text-left text-sm font-[590] leading-[21px] tracking-[-0.02em] text-[#00305F] hover:underline"
                                 >
                                    View rates
                                 </button>
                              </div>
                              <div className="flex items-center gap-2">
                                 <span className="h-[6px] w-[6px] shrink-0 rounded-full bg-[#155DFC]" aria-hidden />
                                 <button
                                    type="button"
                                    onClick={() => navigate('/guide')}
                                    className="text-left text-sm font-[590] leading-[21px] tracking-[-0.02em] text-[#00305F] hover:underline"
                                 >
                                    Learn How It Works!
                                 </button>
                              </div>
                           </div>
                        </div>
                     </div>

                     <button
                        type="button"
                        onClick={goRequestBoard}
                        className="mt-auto flex h-14 w-full items-center justify-center gap-2 rounded-2xl border border-[#0076EB] bg-white text-base font-[590] leading-6 tracking-[-0.02em] text-[#0076EB] transition-colors hover:bg-blue-50/50"
                     >
                        Explore Moodeng
                        <ChevronRight className="h-6 w-6 shrink-0 text-[#0064C8]" strokeWidth={1.5} aria-hidden />
                     </button>
                  </section>
               </div>
            </div>
         </main>
      </div>
   );
}
