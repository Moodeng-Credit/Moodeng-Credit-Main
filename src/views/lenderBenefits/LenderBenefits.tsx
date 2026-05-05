import { useEffect } from 'react';

import CommunityHeroSection from '@/views/lenderBenefits/sections/CommunityHeroSection';
import FeaturesSection from '@/views/lenderBenefits/sections/FeaturesSection';
import HowWeVerifySection from '@/views/lenderBenefits/sections/HowWeVerifySection';
import LendingIncentivesSection from '@/views/lenderBenefits/sections/LendingIncentivesSection';
import MeetYourFutureBorrowersSection from '@/views/lenderBenefits/sections/MeetYourFutureBorrowersSection';
import MostNeededSection from '@/views/lenderBenefits/sections/MostNeededSection';
import ProblemSection from '@/views/lenderBenefits/sections/ProblemSection';
import VerfiyStatsSection from '@/views/lenderBenefits/sections/VerfiyStatsSection';
import VerifyIdentitySection from '@/views/lenderBenefits/sections/VerifyIdentitySection';
import Web3WalletSection from '@/views/lenderBenefits/sections/Web3WalletSection';
import '@/views/lenderBenefits/styles/LenderBenefits.css';

export default function LenderBenefits() {
   useEffect(() => {
      if (location.hash) {
         const element = document.getElementById(location.hash.replace('#', ''));
         if (element) {
            element.scrollIntoView({ behavior: 'smooth' });
         }
      }
   }, []);

   return (
      <>
         <div id="why-lend" className="flex min-h-screen flex-col overflow-x-hidden bg-zinc-900">
            <div className="flex flex-col items-center w-full min-h-full max-md:max-w-full">
               <CommunityHeroSection />

               <section
                  id="problem"
                  className="lender-story-section flex relative flex-col items-center mt-16 max-w-full w-[1064px] max-md:mt-0"
               >
                  <ProblemSection />
                  <Web3WalletSection />
                  <LendingIncentivesSection />
               </section>

               <section className="lender-borrowers-section flex flex-col pt-10 mt-16 max-w-full rounded-none w-[1440px] max-md:mt-0">
                  <MeetYourFutureBorrowersSection />
                  <MostNeededSection />
               </section>

               <section className="lender-verify-section flex flex-col items-center w-full">
                  <HowWeVerifySection />
                  <VerfiyStatsSection />
                  <VerifyIdentitySection />
               </section>

               <FeaturesSection />
            </div>
         </div>
      </>
   );
}
