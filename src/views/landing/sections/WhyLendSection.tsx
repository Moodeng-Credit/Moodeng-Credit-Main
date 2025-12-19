import { type JSX } from 'react';

import ActionButton from '@/components/ui/ActionButton';

import { whyLendButtons } from '@/config/buttonConfig';

export default function WhyLendSection(): JSX.Element {
   return (
      <div className="relative w-[1440px] h-[590px] bg-[#171420] overflow-hidden">
         <div className="relative h-[483px] top-[107px] bg-white rounded-[60px] overflow-hidden">
            <div className="absolute w-[1236px] h-[45px] top-11 left-[102px]">
               <div className="absolute w-[1236px] h-[37px] top-0 left-0 bg-white">
                  <p className="absolute w-[694px] h-8 top-0.5 left-0 [font-family:'PP_Telegraf-Regular',Helvetica] font-normal text-[#171420] text-3xl tracking-[0] leading-8 whitespace-nowrap">
                     <span className="[font-family:'PP_Telegraf-Regular',Helvetica] font-normal text-[#171420] text-3xl tracking-[0] leading-8">
                        Why Lend to
                     </span>
                     <span className="[font-family:'PP_Telegraf-Regular',Helvetica] font-bold text-[#171420] text-3xl tracking-[0] leading-8">
                        {' '}
                        Real People{' '}
                     </span>
                     <span className="[font-family:'PP_Telegraf-Regular',Helvetica] font-normal text-[#171420] text-3xl tracking-[0] leading-8">
                        Directly?
                     </span>
                  </p>
                  <img
                     className="absolute w-[50px] h-[37px] top-0 left-[1186px] object-cover"
                     alt="Svg"
                     src="https://c.animaapp.com/VPWnEuWR/img/svg-2.svg"
                     width={50}
                     height={37}
                  />
               </div>
               <div className="absolute top-[3px] left-[958px]">
                  {whyLendButtons.map((button) => (
                     <ActionButton key={button.text} button={button} />
                  ))}
               </div>
            </div>
            <div className="absolute w-[1236px] h-[282px] top-[118px] left-[89px]">
               <div className="absolute w-[1236px] h-[282px] top-0 left-0">
                  <div className="absolute w-[610px] h-[282px] top-0 left-0 bg-[#f093ff] rounded-[30px] overflow-hidden">
                     <div className="relative w-[550px] h-[116px] top-10 left-[30px]">
                        <div className="absolute w-[300px] h-[42px] top-0 left-0 [font-family:'PP_Telegraf-Regular',Helvetica] font-normal text-[#171420] text-[40px] tracking-[0] leading-[42px] whitespace-nowrap">
                           Token rewards
                        </div>
                        <p className="absolute w-[466px] h-[53px] top-14 left-0 [font-family:'PP_Telegraf-Regular',Helvetica] font-normal text-[#171420] text-[23.1px] tracking-[0] leading-8">
                           Earn tokens by lending. Help govern the platform you support.
                        </p>
                     </div>
                  </div>
                  <div className="absolute w-[610px] h-[282px] top-0 left-[626px] bg-[#ffe635] rounded-[30px] overflow-hidden">
                     <div className="relative w-[550px] h-[116px] top-10 left-[30px]">
                        <div className="absolute w-[331px] h-[42px] -top-px left-0 [font-family:'PP_Telegraf-Regular',Helvetica] font-normal text-[#171420] text-[39.7px] tracking-[0] leading-[42px] whitespace-nowrap">
                           Passive Income
                        </div>
                        <p className="absolute w-[507px] h-[53px] top-14 left-0 [font-family:'PP_Telegraf-Regular',Helvetica] font-normal text-[#171420] text-[23.6px] tracking-[0] leading-8">
                           Generate returns while supporting borrowers in underserved regions.
                        </p>
                     </div>
                  </div>
               </div>
               <img
                  className="absolute w-[108px] h-[135px] top-[145px] left-[1102px] object-cover"
                  alt="Catuu lighter hang"
                  src="https://c.animaapp.com/VPWnEuWR/img/catuu-lighter-hang-1231231231-1@2x.png"
                  width={108}
                  height={135}
               />
               <div className="absolute w-[102px] h-[127px] top-[139px] left-[495px]">
                  <div className="relative w-[110px] h-[135px] -left-1 bg-[url(https://c.animaapp.com/VPWnEuWR/img/catuu-1@2x.png)] bg-cover bg-[50%_50%]">
                     <img
                        className="absolute w-10 h-10 top-[79px] left-4 object-cover"
                        alt="Acffc aa f"
                        src="https://c.animaapp.com/VPWnEuWR/img/a5cf6f4c-aa64-458f-be0c-e885084dbb87-transformed-1@2x.png"
                        width={40}
                        height={40}
                     />
                     <img
                        className="absolute w-[47px] h-6 top-[89px] left-[13px] object-cover"
                        alt="Img"
                        src="https://c.animaapp.com/VPWnEuWR/img/oukwgyzftkmjv95wwbf2ww-removebg-preview-1@2x.png"
                        width={100}
                        height={100}
                     />
                  </div>
               </div>
            </div>
         </div>
      </div>
   );
}
