import { type JSX } from 'react';

export default function WhyLendSection(): JSX.Element {
   return (
      <div className="w-full px-4 md:px-8 lg:px-16 py-8 md:py-16 bg-[#171420]">
         <div className="max-w-7xl mx-auto bg-white rounded-[30px] md:rounded-[60px] overflow-hidden p-6 md:p-12">
            {/* Header */}
            <div className="mb-8 md:mb-12">
               <h2 className="[font-family:'PP_Telegraf-Regular',Helvetica] font-normal text-[#171420] text-2xl md:text-3xl lg:text-4xl tracking-[0] leading-snug">
                  Why Lend to <span className="font-bold">Real People</span> Directly?
               </h2>
            </div>

            {/* Content Grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 md:gap-8">
               {/* Token Rewards Card */}
               <div className="bg-[#f093ff] rounded-[20px] md:rounded-[30px] p-6 md:p-8">
                  <h3 className="[font-family:'PP_Telegraf-Regular',Helvetica] font-normal text-[#171420] text-2xl md:text-3xl tracking-[0] leading-[42px] mb-3">
                     Token rewards
                  </h3>
                  <p className="[font-family:'PP_Telegraf-Regular',Helvetica] font-normal text-[#171420] text-lg md:text-xl tracking-[0] leading-relaxed">
                     Earn tokens by lending. Help govern the platform you support.
                  </p>
               </div>

               {/* Passive Income Card */}
               <div className="bg-[#ffe635] rounded-[20px] md:rounded-[30px] p-6 md:p-8">
                  <h3 className="[font-family:'PP_Telegraf-Regular',Helvetica] font-normal text-[#171420] text-2xl md:text-3xl tracking-[0] leading-[42px] mb-3">
                     Passive Income
                  </h3>
                  <p className="[font-family:'PP_Telegraf-Regular',Helvetica] font-normal text-[#171420] text-lg md:text-xl tracking-[0] leading-relaxed">
                     Generate returns while supporting borrowers in underserved regions.
                  </p>
               </div>
            </div>

            {/* Decorative Images - Hidden on mobile */}
            <div className="hidden lg:flex justify-between items-end mt-8 opacity-50">
               <img
                  className="w-[100px] h-[130px] object-cover"
                  alt="Catuu"
                  src="https://c.animaapp.com/VPWnEuWR/img/catuu-lighter-hang-1231231231-1@2x.png"
                  width={108}
                  height={135}
               />
               <img
                  className="w-[100px] h-[130px] object-cover"
                  alt="Catuu"
                  src="https://c.animaapp.com/VPWnEuWR/img/catuu-1@2x.png"
                  width={100}
                  height={135}
               />
            </div>
         </div>
      </div>
   );
}
