

import { type JSX, useEffect } from 'react';

import FastGlobalAccessSection from '@/views/borrowerBenefits/sections/FastGlobalAccessSection';
import HeroSection from '@/views/borrowerBenefits/sections/HeroSection';
import OurMissionSection from '@/views/borrowerBenefits/sections/OurMissionSection';
import OurRoadmapSection from '@/views/borrowerBenefits/sections/OurRoadmapSection';
import StartBuildingCreditSection from '@/views/borrowerBenefits/sections/StartBuildingCreditSection';
import WhatPeopleSaySection from '@/views/borrowerBenefits/sections/WhatPeopleSaySection';
import WhyUsSection from '@/views/borrowerBenefits/sections/WhyUsSection';
import YourCapitalSection from '@/views/borrowerBenefits/sections/YourCapitalSection';
import '@/views/borrowerBenefits/styles/BorrowerBenefits.css';

export default function BorrowerBenefits(): JSX.Element {
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
         <div id="benefits" className="flex overflow-hidden flex-col bg-zinc-900">
            <div className="flex flex-col items-center w-full min-h-full max-md:max-w-full">
               <HeroSection />
               <WhyUsSection />
               <FastGlobalAccessSection />
               <YourCapitalSection />
               <OurMissionSection />
               <OurRoadmapSection />
               <StartBuildingCreditSection />
               <WhatPeopleSaySection />
            </div>
         </div>
         <style jsx>{'builder-component { max-width: none !important; }'}</style>
      </>
   );
}
