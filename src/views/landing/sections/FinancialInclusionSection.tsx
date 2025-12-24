import { type JSX } from 'react';

export default function FinancialInclusionSection(): JSX.Element {
   return (
      <div className="w-full px-4 md:px-8 lg:px-16 py-8 md:py-16">
         <div className="max-w-7xl mx-auto bg-white rounded-[30px] md:rounded-[60px] overflow-hidden">
            {/* Header Section */}
            <div className="p-6 md:p-12 bg-white">
               <h2 className="[font-family:'PP_Telegraf-Regular',Helvetica] font-normal text-[#171420] text-2xl md:text-3xl tracking-[0] leading-8 mb-6 md:mb-0">
                  POWER TOOLS FOR FINANCIAL INCLUSION
               </h2>
            </div>

            {/* Content Grid */}
            <div className="p-6 md:p-12">
               {/* Three Column Cards for Large Screens, Stack on Mobile */}
               <div className="grid grid-cols-1 md:grid-cols-3 gap-6 md:gap-8 mb-8">
                  {/* Card 1 - Best Way to Build Credit */}
                  <div className="rounded-[20px] md:rounded-[30px] overflow-hidden bg-gradient-to-br from-purple-100 to-blue-100 p-6 md:p-8">
                     <h3 className="[font-family:'PP_Telegraf-Regular',Helvetica] font-normal text-[#171420] text-sm md:text-base opacity-50 mb-3">
                        BEST WAY TO BUILD CREDIT
                     </h3>
                     <p className="[font-family:'PP_Telegraf-Regular',Helvetica] font-normal text-[#171420] text-xl md:text-3xl tracking-[0] leading-snug mb-6">
                        Direct Lender-to-Borrower $15 microloans. Unlock more credit when you repay.
                     </p>
                     <div className="text-2xl font-bold text-white bg-gradient-to-r from-purple-500 to-blue-500 inline-block px-4 py-2 rounded">
                        Start
                     </div>
                  </div>

                  {/* Card 2 - Cheaper Loans */}
                  <div className="rounded-[20px] md:rounded-[30px] overflow-hidden bg-gradient-to-br from-cyan-100 to-teal-100 p-6 md:p-8">
                     <h3 className="[font-family:'PP_Telegraf-Regular',Helvetica] font-normal text-[#171420] text-sm md:text-base opacity-50 mb-3">
                        CHEAPER LOANS
                     </h3>
                     <p className="[font-family:'PP_Telegraf-Regular',Helvetica] font-normal text-[#171420] text-xl md:text-3xl tracking-[0] leading-snug">
                        Enjoy lower rates as your credit score improves
                     </p>
                  </div>

                  {/* Card 3 - Micro-Loan Management */}
                  <div className="rounded-[20px] md:rounded-[30px] overflow-hidden bg-gradient-to-br from-amber-100 to-orange-100 p-6 md:p-8">
                     <h3 className="[font-family:'PP_Telegraf-Regular',Helvetica] font-normal text-[#171420] text-sm md:text-base opacity-50 mb-3">
                        MICRO-LOAN MANAGEMENT
                     </h3>
                     <p className="[font-family:'PP_Telegraf-Regular',Helvetica] font-normal text-[#171420] text-xl md:text-3xl tracking-[0] leading-snug">
                        Get funded in a digital wallet like Metamask, with stablecoins like USDT or USDC
                     </p>
                  </div>
               </div>

               {/* Features Grid */}
               <div className="grid grid-cols-2 md:grid-cols-4 gap-4 md:gap-6 mb-8">
                  <div className="p-4 rounded-[15px] bg-gray-50 text-center">
                     <p className="[font-family:'PP_Telegraf-Regular',Helvetica] font-bold text-[#171420] text-sm md:text-base">
                        No Collateral
                     </p>
                  </div>
                  <div className="p-4 rounded-[15px] bg-gray-50 text-center">
                     <p className="[font-family:'PP_Telegraf-Regular',Helvetica] font-bold text-[#171420] text-sm md:text-base">
                        No Deposit
                     </p>
                  </div>
                  <div className="p-4 rounded-[15px] bg-gray-50 text-center">
                     <p className="[font-family:'PP_Telegraf-Regular',Helvetica] font-bold text-[#171420] text-sm md:text-base">
                        No Fees
                     </p>
                  </div>
                  <div className="p-4 rounded-[15px] bg-gray-50 text-center">
                     <p className="[font-family:'PP_Telegraf-Regular',Helvetica] font-bold text-[#171420] text-sm md:text-base">
                        Super Competitive
                     </p>
                  </div>
               </div>

               {/* Set Your Terms Section */}
               <div className="rounded-[20px] md:rounded-[30px] bg-gradient-to-r from-indigo-100 to-purple-100 p-6 md:p-8">
                  <h3 className="[font-family:'PP_Telegraf-Regular',Helvetica] font-normal text-[#171420] text-sm md:text-base opacity-50 mb-3">
                     SET YOUR TERMS
                  </h3>
                  <p className="[font-family:'PP_Telegraf-Regular',Helvetica] font-normal text-[#171420] text-xl md:text-3xl tracking-[0] leading-snug mb-6">
                     Get the Freedom to Choose Your...
                  </p>
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                     <div className="text-center p-4 bg-white rounded-[15px]">
                        <p className="font-bold text-[#171420] text-lg md:text-2xl">Interest Rate</p>
                     </div>
                     <div className="text-center p-4 bg-white rounded-[15px]">
                        <p className="font-bold text-[#171420] text-lg md:text-2xl">Payback Time</p>
                     </div>
                     <div className="text-center p-4 bg-white rounded-[15px]">
                        <p className="font-bold text-[#171420] text-lg md:text-2xl">$ Repayment</p>
                     </div>
                  </div>
               </div>
            </div>
         </div>
      </div>
   );
}
