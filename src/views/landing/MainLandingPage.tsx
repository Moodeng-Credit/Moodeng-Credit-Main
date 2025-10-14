'use client';

import { type JSX } from 'react';

import CreditRebornSection from '@/views/landing/sections/CreditRebornSection';
import FinancialInclusionSection from '@/views/landing/sections/FinancialInclusionSection';
import HeroSection from '@/views/landing/sections/HeroSection';
import LoanOptionsSection from '@/views/landing/sections/LoanOptionsSection';
import OurPartnershipsSection from '@/views/landing/sections/OurPartnershipsSection';
import PartnersSection from '@/views/landing/sections/PartnersSection';
import RevolutionizeSection from '@/views/landing/sections/RevolutionizeSection';
import StartBuildingSection from '@/views/landing/sections/StartBuildingSection';
import WhatPeopleSaySection from '@/views/landing/sections/WhatPeopleSaySection';
import WhyLendSection from '@/views/landing/sections/WhyLendSection';
import '@/views/landing/styles/MainLandingPage.css';

export default function MainLandingPage(): JSX.Element {
   return (
      <div className="bg-[#171420] flex flex-row justify-center w-full">
         <div className="bg-[#171420] w-[1920px]">
            <div className="flex flex-col w-[1920px]  items-center relative">
               <HeroSection />
               <PartnersSection />
               <FinancialInclusionSection />
               <RevolutionizeSection />
               <LoanOptionsSection />
               <WhyLendSection />
               <CreditRebornSection />
               <OurPartnershipsSection />
               <WhatPeopleSaySection />
               <StartBuildingSection />
            </div>
         </div>
      </div>
   );
}
