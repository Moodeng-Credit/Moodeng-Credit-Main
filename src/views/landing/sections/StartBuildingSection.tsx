import { type JSX } from 'react';
import ActionButton from '@/components/ui/ActionButton';
import { financialInclusionButtons } from '@/config/buttonConfig';

export default function StartBuildingSection(): JSX.Element {
   const buttons = financialInclusionButtons.slice(0, 2);
   
   return (
      <div className="w-full px-4 md:px-8 lg:px-16 py-12 md:py-16 lg:py-20">
         <div className="max-w-7xl mx-auto">
            {/* Header Section */}
            <div className="text-center mb-12 md:mb-16">
               <h2 className="[font-family:'Inter',Helvetica] font-normal text-[#f6f6f6] text-3xl md:text-4xl lg:text-5xl tracking-[0] leading-[50px] mb-4 flex flex-col md:flex-row items-center justify-center gap-4">
                  <span>START BUILDING CREDIT</span>
                  <img
                     className="w-20 md:w-24 h-24 md:h-28 object-cover"
                     alt="Building Credit"
                     src="https://c.animaapp.com/VPWnEuWR/img/file--4--1-1@2x.png"
                     width={96}
                     height={112}
                  />
               </h2>
               <h3 className="[font-family:'Inter',Helvetica] font-normal text-[#f6f6f6] text-2xl md:text-4xl lg:text-5xl tracking-[0] leading-[50px]">
                  WITH MICROLOANS
               </h3>
            </div>

            {/* Steps Grid */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4 md:gap-6 mb-12 md:mb-16">
               {/* Step 1 */}
               <div className="flex flex-col items-center text-center">
                  <img
                     className="w-8 h-8 mb-3"
                     alt="Small Loans"
                     src="https://c.animaapp.com/VPWnEuWR/img/svg-4.svg"
                     width={27}
                     height={27}
                  />
                  <h4 className="[font-family:'Inter',Helvetica] font-normal text-[#ece9ff] text-xl md:text-2xl tracking-[0] leading-[31.4px] mb-2">
                     Small Loans
                  </h4>
                  <p className="[font-family:'Inter',Helvetica] font-normal text-[#ece9ff] text-xs md:text-sm tracking-[0] leading-[18.3px]">
                     Start
                  </p>
               </div>

               {/* Arrow */}
               <div className="hidden sm:flex items-center justify-center">
                  <img
                     className="w-6 h-6 md:w-8 md:h-8"
                     alt="Arrow"
                     src="https://c.animaapp.com/VPWnEuWR/img/svg-5.svg"
                     width={27}
                     height={27}
                  />
               </div>

               {/* Step 2 */}
               <div className="flex flex-col items-center text-center">
                  <img
                     className="w-8 h-8 mb-3"
                     alt="Gradual Growth"
                     src="https://c.animaapp.com/VPWnEuWR/img/svg-6.svg"
                     width={41}
                     height={27}
                  />
                  <h4 className="[font-family:'Inter',Helvetica] font-normal text-[#ece9ff] text-xl md:text-2xl tracking-[0] leading-[31.4px] mb-2">
                     Gradual Growth
                  </h4>
                  <p className="[font-family:'Inter',Helvetica] font-normal text-[#ece9ff] text-xs md:text-sm tracking-[0] leading-[18.3px]">
                     Build
                  </p>
               </div>

               {/* Arrow */}
               <div className="hidden lg:flex items-center justify-center">
                  <img
                     className="w-6 h-6 md:w-8 md:h-8"
                     alt="Arrow"
                     src="https://c.animaapp.com/VPWnEuWR/img/svg-7.svg"
                     width={27}
                     height={27}
                  />
               </div>

               {/* Step 3 */}
               <div className="flex flex-col items-center text-center">
                  <img
                     className="w-8 h-8 mb-3"
                     alt="No Deposit"
                     src="https://c.animaapp.com/VPWnEuWR/img/svg-8.svg"
                     width={27}
                     height={27}
                  />
                  <h4 className="[font-family:'Inter',Helvetica] font-normal text-[#ece9ff] text-xl md:text-2xl tracking-[0] leading-[31.4px] mb-2">
                     No Collateral
                  </h4>
                  <p className="[font-family:'Inter',Helvetica] font-normal text-[#ece9ff] text-xs md:text-sm tracking-[0] leading-[18.3px]">
                     Trust
                  </p>
               </div>
            </div>

            {/* Call to Action Buttons */}
            <div className="flex flex-col sm:flex-row gap-4 justify-center items-center">
               <img
                  className="w-12 h-12 hidden sm:block"
                  alt="Background"
                  src="https://c.animaapp.com/VPWnEuWR/img/background-1.svg"
                  width={46}
                  height={46}
               />
               <div className="flex flex-col sm:flex-row gap-4">
                  {buttons.map((button) => (
                     <ActionButton key={button.text} button={button} />
                  ))}
               </div>
            </div>
         </div>
      </div>
   );
}
