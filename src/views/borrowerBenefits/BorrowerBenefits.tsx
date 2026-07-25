

import { type CSSProperties, type JSX, useEffect, useMemo, useState } from 'react';

import FastGlobalAccessSection from '@/views/borrowerBenefits/sections/FastGlobalAccessSection';
import HeroSection from '@/views/borrowerBenefits/sections/HeroSection';
import OurMissionSection from '@/views/borrowerBenefits/sections/OurMissionSection';
import OurRoadmapSection from '@/views/borrowerBenefits/sections/OurRoadmapSection';
import StartBuildingCreditSection from '@/views/borrowerBenefits/sections/StartBuildingCreditSection';
import WhatPeopleSaySection from '@/views/borrowerBenefits/sections/WhatPeopleSaySection';
import WhyUsSection from '@/views/borrowerBenefits/sections/WhyUsSection';
import YourCapitalSection from '@/views/borrowerBenefits/sections/YourCapitalSection';
import '@/views/borrowerBenefits/styles/BorrowerBenefits.css';

import { usePageSeo } from '@/hooks/usePageSeo';

export default function BorrowerBenefits(): JSX.Element {
   const [readingProgress, setReadingProgress] = useState(0);

   usePageSeo({
      title: 'Borrower Benefits | Moodeng Credit',
      description:
         'Why borrowers choose Moodeng Credit: fast global access to small USDC loans, our mission and roadmap, and building verifiable credit as you repay.',
      canonicalPath: '/benefits'
   });

   useEffect(() => {
      if (location.hash) {
         const element = document.getElementById(location.hash.replace('#', ''));
         if (element) {
            element.scrollIntoView({ behavior: 'smooth' });
         }
      }
   }, []);

   useEffect(() => {
      const updateReadingProgress = () => {
         const documentHeight = document.documentElement.scrollHeight - window.innerHeight;

         if (documentHeight <= 0) {
            setReadingProgress(0);
            return;
         }

         const progress = (window.scrollY / documentHeight) * 100;
         setReadingProgress(Math.min(100, Math.max(0, Math.round(progress))));
      };

      updateReadingProgress();
      window.addEventListener('scroll', updateReadingProgress, { passive: true });
      window.addEventListener('resize', updateReadingProgress);

      return () => {
         window.removeEventListener('scroll', updateReadingProgress);
         window.removeEventListener('resize', updateReadingProgress);
      };
   }, []);

   const progressStyle = useMemo(
      () => ({ '--borrower-benefits-reading-progress': `${readingProgress}%` }) as CSSProperties,
      [readingProgress]
   );

   return (
      <>
         <div id="benefits" className="flex overflow-hidden flex-col bg-zinc-900">
            <div
               className="borrower-benefits-reading-progress"
               style={progressStyle}
               aria-label={`Borrower benefits reading progress ${readingProgress}%`}
            >
               <span>{readingProgress}%</span>
            </div>
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
      </>
   );
}
