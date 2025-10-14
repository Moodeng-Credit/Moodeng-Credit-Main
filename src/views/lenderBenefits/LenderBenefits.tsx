'use client';

import { useEffect } from 'react';

import StartBuildingCreditSection from '@/views/borrowerBenefits/sections/StartBuildingCreditSection';
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
         <div id="why-lend" className="flex overflow-hidden flex-col bg-zinc-900">
            <div className="flex flex-col items-center w-full min-h-full max-md:max-w-full">
               <CommunityHeroSection />

               <div id="problem" className="flex relative flex-col items-center mt-20 max-w-full w-[1064px] max-md:mt-10">
                  <ProblemSection />
                  <Web3WalletSection />
                  <LendingIncentivesSection />
               </div>

               <div className="flex flex-col pt-10 mt-20 max-w-full rounded-none w-[1440px] max-md:mt-10">
                  <MeetYourFutureBorrowersSection />
                  <MostNeededSection />
               </div>

               <HowWeVerifySection />
               <VerfiyStatsSection />
               <VerifyIdentitySection />

               <FeaturesSection />

               <StartBuildingCreditSection />
            </div>
         </div>{' '}
         <style jsx>{'builder-component { max-width: none !important; }'}</style>{' '}
      </>
   );
}
