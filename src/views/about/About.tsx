

import { useEffect } from 'react';

import CreditGrowthSystemSection from '@/views/about/sections/CreditGrowthSystemSection';
import DirectLendBorrowSection from '@/views/about/sections/DirectLendBorrowSection';
import MoodengCreditSection from '@/views/about/sections/MoodengCreditSection';
import RulesOfRepayingSection from '@/views/about/sections/RulesOfRepayingSection';
import WelcomeHeroSection from '@/views/about/sections/WelcomeHeroSection';
import '@/views/about/styles/About.css';

export default function About() {
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
         <div id="guide" className="flex overflow-hidden flex-col bg-zinc-900">
            <div className="flex flex-col items-center w-full min-h-full max-md:max-w-full">
               <WelcomeHeroSection />
               <CreditGrowthSystemSection />
               <RulesOfRepayingSection />
               <DirectLendBorrowSection />
               <MoodengCreditSection />
            </div>
         </div>
      </>
   );
}
