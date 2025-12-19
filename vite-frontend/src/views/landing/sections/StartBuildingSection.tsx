import { type JSX } from 'react';



import ActionButton from '@/components/ui/ActionButton';

import { financialInclusionButtons } from '@/config/buttonConfig';

export default function StartBuildingSection(): JSX.Element {
   const buttons = financialInclusionButtons.slice(0, 2);
   return (
      <div className="relative w-[1440px] h-[534.77px]">
         <div className="relative h-[469px] top-[34px]">
            <div className="absolute w-[587px] h-[184px] top-1.5 left-[433px]">
               <div className="absolute w-[587px] h-[43px] top-[141px] left-0 [font-family:'Inter',Helvetica] font-normal text-[#f6f6f6] text-[45px] text-center tracking-[0] leading-[50px] whitespace-nowrap">
                  START BUILDING CREDIT
               </div>
               <img
                  className="absolute w-[138px] h-[158px] top-0 left-[225px] object-cover"
                  alt=""
                  src="https://c.animaapp.com/VPWnEuWR/img/file--4--1-1@2x.png"
                  width={138}
                  height={158}
               />
            </div>
            <div className="absolute w-[509px] h-[43px] top-[197px] left-[466px] [font-family:'Inter',Helvetica] font-normal text-[#f6f6f6] text-[45px] text-center tracking-[0] leading-[50px] whitespace-nowrap">
               WITH MICROLOANS
            </div>
            <div className="absolute w-[1068px] h-[50px] top-[279px] left-[186px]">
               <img
                  className="absolute w-[27px] h-[27px] top-0 left-px object-cover"
                  alt="Svg"
                  src="https://c.animaapp.com/VPWnEuWR/img/svg-4.svg"
                  width={27}
                  height={27}
               />
               <div className="absolute w-[200px] h-8 -top-0.5 left-[38px]">
                  <div className="absolute w-[200px] h-[31px] top-px left-0 [font-family:'Inter',Helvetica] font-normal text-[#ece9ff] text-2xl tracking-[0] leading-[31.4px] whitespace-nowrap">
                     Small Loans
                  </div>
                  <img
                     className="absolute w-[27px] h-[27px] top-0 left-[165px] object-cover"
                     alt="Svg"
                     src="https://c.animaapp.com/VPWnEuWR/img/svg-5.svg"
                     width={27}
                     height={27}
                  />
               </div>
               <div className="w-8 h-3 top-[33px] left-[38px] [font-family:'Inter',Helvetica] font-normal text-[#ece9ff] text-[13.9px] leading-[18.3px] whitespace-nowrap absolute tracking-[0]">
                  Start
               </div>
               <div className="absolute w-[182px] h-[31px] -top-px left-[240px] [font-family:'Inter',Helvetica] font-normal text-[#ece9ff] text-2xl tracking-[0] leading-[31.4px] whitespace-nowrap">
                  Gradual Growth
               </div>
               <div className="absolute w-8 h-3 top-[30px] left-[240px] [font-family:'Inter',Helvetica] font-normal text-[#ece9ff] text-[13.9px] tracking-[0] leading-[18.3px] whitespace-nowrap">
                  Build
               </div>
               <div className="absolute w-[165px] h-[31px] -top-px left-[445px]">
                  <img
                     className="absolute w-[41px] h-[27px] top-px left-0 object-cover"
                     alt="Svg"
                     src="https://c.animaapp.com/VPWnEuWR/img/svg-6.svg"
                     width={41}
                     height={27}
                  />
                  <div className="absolute w-[134px] h-[31px] top-0 left-[31px] [font-family:'Inter',Helvetica] font-normal text-[#ece9ff] text-2xl tracking-[0] leading-[31.4px] whitespace-nowrap">
                     No Deposit
                  </div>
               </div>
               <div className="absolute w-[46px] h-3 top-[33px] left-[476px] [font-family:'Inter',Helvetica] font-normal text-[#ece9ff] text-[13.9px] tracking-[0] leading-[18.3px] whitespace-nowrap">
                  Enable
               </div>
               <img
                  className="absolute w-[27px] h-[27px] top-0 left-[631px] object-cover"
                  alt="Svg"
                  src="https://c.animaapp.com/VPWnEuWR/img/svg-7.svg"
                  width={27}
                  height={27}
               />
               <div className="w-[184px] h-[31px] -top-px left-[668px] [font-family:'Inter',Helvetica] font-normal text-[#ece9ff] text-2xl leading-[31.4px] absolute tracking-[0] whitespace-nowrap">
                  No Collateral
               </div>
               <div className="absolute w-[70px] h-3 top-[33px] left-[668px] [font-family:'Inter',Helvetica] font-normal text-[#ece9ff] text-sm tracking-[0] leading-[18.3px] whitespace-nowrap">
                  Trust
               </div>
               <img
                  className="absolute w-[27px] h-[27px] top-0 left-[840px] object-cover"
                  alt="Svg"
                  src="https://c.animaapp.com/VPWnEuWR/img/svg-8.svg"
                  width={27}
                  height={27}
               />
               <div className="absolute w-[162px] h-[31px] -top-px left-[875px] [font-family:'Inter',Helvetica] font-normal text-[#ece9ff] text-2xl tracking-[0] leading-[31.4px] whitespace-nowrap">
                  Trust Building
               </div>
               <div className="absolute w-[70px] h-3 top-[33px] left-[875px] [font-family:'Inter',Helvetica] font-normal text-[#ece9ff] text-sm tracking-[0] leading-[18.3px] whitespace-nowrap">
                  Grow
               </div>
            </div>
            <div className="absolute w-[1051px] h-[46px] top-[363px] left-[194px]">
               <img
                  className="absolute w-[46px] h-[46px] top-0 left-[327px]"
                  alt="Background"
                  src="https://c.animaapp.com/VPWnEuWR/img/background-1.svg"
                  width={46}
                  height={46}
               />
               <div className="absolute top-0.5 left-96 flex gap-4">
                  {buttons.map((button) => (
                     <ActionButton key={button.text} button={button} />
                  ))}
               </div>
            </div>
         </div>
      </div>
   );
}
