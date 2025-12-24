import { type JSX } from 'react';

export default function CreditRebornSection(): JSX.Element {
   return (
      <div className="w-full px-4 md:px-8 lg:px-16 py-8 md:py-16 bg-[#171420]">
         <div className="max-w-7xl mx-auto rounded-[20px] md:rounded-[30px] overflow-hidden bg-cover bg-center p-6 md:p-8 lg:p-12"
              style={{backgroundImage: 'url(https://c.animaapp.com/VPWnEuWR/img/ibsgfmymxgphasvaumtopmmos-svg-3.svg)'}}>
            
            {/* Title */}
            <h2 className="[font-family:'PP_Telegraf-Regular',Helvetica] font-normal text-[#212121] text-3xl md:text-4xl lg:text-5xl tracking-[-1.04px] leading-[60px] mb-8 md:mb-12">
               Credit Reborn.
            </h2>

            {/* Three Column Grid for Stats */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6 md:gap-8">
               
               {/* Card 1 - Repayment Rate */}
               <div className="rounded-[20px] md:rounded-[30px] overflow-hidden p-6 md:p-8 bg-white bg-opacity-95">
                  <div className="text-4xl md:text-5xl font-normal text-white mb-3">
                     🥇 95%+
                  </div>
                  <h3 className="[font-family:'Cabin_Condensed',Helvetica] font-bold text-white text-2xl md:text-3xl tracking-[0] leading-[26px] mb-4">
                     Repayment Rate
                  </h3>
                  <p className="[font-family:'Cabin_Condensed',Helvetica] font-normal text-white text-sm md:text-base tracking-[0] leading-6">
                     New borrowers want to build their credit to unlock more credit
                  </p>
               </div>

               {/* Card 2 - High Returns */}
               <div className="rounded-[20px] md:rounded-[30px] overflow-hidden p-6 md:p-8 bg-white bg-opacity-95">
                  <div className="text-4xl md:text-5xl font-normal text-white mb-3">
                     📉 15%+APR
                  </div>
                  <h3 className="[font-family:'Cabin_Condensed',Helvetica] font-bold text-white text-2xl md:text-3xl tracking-[0] leading-[26px] mb-4">
                     High stablecoin returns
                  </h3>
                  <p className="[font-family:'Cabin_Condensed',Helvetica] font-normal text-white text-sm md:text-base tracking-[0] leading-6">
                     Get bang for your buck with strong reward incentives
                  </p>
               </div>

               {/* Card 3 - Be Helpful */}
               <div className="rounded-[20px] md:rounded-[30px] overflow-hidden p-6 md:p-8 bg-white bg-opacity-95">
                  <div className="text-4xl md:text-5xl font-normal text-white mb-3">
                     🌎 Be Helpful
                  </div>
                  <h3 className="[font-family:'Cabin_Condensed',Helvetica] font-bold text-white text-2xl md:text-3xl tracking-[0] leading-[26px] mb-4">
                     Credit Building
                  </h3>
                  <p className="[font-family:'Cabin_Condensed',Helvetica] font-normal text-white text-sm md:text-base tracking-[0] leading-6">
                     Impact people positively when they're in financial need
                  </p>
               </div>
            </div>
         </div>
      </div>
   );
}
