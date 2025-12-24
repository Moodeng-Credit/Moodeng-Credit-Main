import { type JSX } from 'react';

export default function LoanOptionsSection(): JSX.Element {
   return (
      <div className="w-full px-4 md:px-8 lg:px-16 py-8 md:py-16 bg-[#171420]">
         <div className="max-w-7xl mx-auto">
            <h2 className="[font-family:'PP_Telegraf-Regular',Helvetica] font-normal text-[#f6f6f6] text-2xl md:text-3xl lg:text-4xl tracking-[0] leading-snug text-center mb-8 md:mb-12">
               Loan Options for a New Era
            </h2>

            {/* Comparison Tables */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 md:gap-8">
               {/* Traditional Loans */}
               <div className="rounded-[20px] md:rounded-[30px] overflow-hidden bg-gradient-to-br from-purple-600 to-purple-800 p-6 md:p-8">
                  <h3 className="[font-family:'Poppins',Helvetica] font-medium text-white text-2xl md:text-3xl tracking-[-1.04px] leading-[60px] mb-6">
                     Traditional Loans
                  </h3>
                  <div className="space-y-4">
                     <div className="flex items-center justify-between p-4 bg-white bg-opacity-10 rounded-[15px]">
                        <span className="text-white font-bold">High Interest Rates</span>
                        <span className="text-red-400">❌</span>
                     </div>
                     <div className="flex items-center justify-between p-4 bg-white bg-opacity-10 rounded-[15px]">
                        <span className="text-white font-bold">Collateral Required</span>
                        <span className="text-red-400">❌</span>
                     </div>
                     <div className="flex items-center justify-between p-4 bg-white bg-opacity-10 rounded-[15px]">
                        <span className="text-white font-bold">Only Local Lenders</span>
                        <span className="text-red-400">❌</span>
                     </div>
                     <div className="flex items-center justify-center p-4 bg-gradient-to-r from-purple-500 to-pink-500 rounded-[100px] mt-6">
                        <span className="[font-family:'Poppins',Helvetica] font-semibold text-white text-2xl">20%+ 📈</span>
                     </div>
                  </div>
               </div>

               {/* Moodeng Loans */}
               <div className="rounded-[20px] md:rounded-[30px] overflow-hidden bg-gradient-to-br from-green-500 to-cyan-500 p-6 md:p-8">
                  <h3 className="[font-family:'Poppins',Helvetica] font-medium text-white text-2xl md:text-3xl tracking-[-1.04px] leading-[60px] mb-6">
                     Moodeng Loans
                  </h3>
                  <div className="space-y-4">
                     <div className="flex items-center justify-between p-4 bg-white bg-opacity-10 rounded-[15px]">
                        <span className="text-white font-bold">Competitive Rates</span>
                        <span className="text-green-300">✓</span>
                     </div>
                     <div className="flex items-center justify-between p-4 bg-white bg-opacity-10 rounded-[15px]">
                        <span className="text-white font-bold">No Collateral Needed</span>
                        <span className="text-green-300">✓</span>
                     </div>
                     <div className="flex items-center justify-between p-4 bg-white bg-opacity-10 rounded-[15px]">
                        <span className="text-white font-bold">Access Lenders Globally</span>
                        <span className="text-green-300">✓</span>
                     </div>
                     <div className="flex items-center justify-center p-4 bg-gradient-to-r from-green-400 to-blue-400 rounded-[100px] mt-6">
                        <span className="[font-family:'Poppins',Helvetica] font-semibold text-white text-2xl">Competitive 📊</span>
                     </div>
                  </div>
               </div>
            </div>

            {/* VS Section */}
            <div className="text-center my-8 md:my-12">
               <div className="inline-block bg-gradient-to-r from-blue-500 to-purple-500 px-8 py-4 rounded-full">
                  <span className="[font-family:'Poppins',Helvetica] font-bold text-white text-2xl md:text-3xl">VS</span>
               </div>
            </div>

            {/* Second Comparison */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 md:gap-8">
               {/* Traditional */}
               <div className="rounded-[20px] md:rounded-[30px] bg-gradient-to-br from-gray-700 to-gray-900 p-6 md:p-8">
                  <h4 className="[font-family:'Poppins',Helvetica] font-medium text-white text-xl md:text-2xl mb-4">
                     Traditional
                  </h4>
                  <ul className="space-y-3 text-white">
                     <li className="flex items-center gap-2">
                        <span className="text-red-400">✗</span>
                        <span>High Interest Rates</span>
                     </li>
                     <li className="flex items-center gap-2">
                        <span className="text-red-400">✗</span>
                        <span>Collateral Required</span>
                     </li>
                     <li className="flex items-center gap-2">
                        <span className="text-red-400">✗</span>
                        <span>Only Local Lenders in Local Currency</span>
                     </li>
                  </ul>
               </div>

               {/* Moodeng */}
               <div className="rounded-[20px] md:rounded-[30px] bg-gradient-to-br from-indigo-600 to-blue-600 p-6 md:p-8">
                  <h4 className="[font-family:'Poppins',Helvetica] font-medium text-white text-xl md:text-2xl mb-4">
                     Moodeng
                  </h4>
                  <ul className="space-y-3 text-white">
                     <li className="flex items-center gap-2">
                        <span className="text-green-300">✓</span>
                        <span>Competitive Rates</span>
                     </li>
                     <li className="flex items-center gap-2">
                        <span className="text-green-300">✓</span>
                        <span>No Collateral Needed</span>
                     </li>
                     <li className="flex items-center gap-2">
                        <span className="text-green-300">✓</span>
                        <span>Access Lenders Globally in $</span>
                     </li>
                  </ul>
               </div>
            </div>
         </div>
      </div>
   );
}
