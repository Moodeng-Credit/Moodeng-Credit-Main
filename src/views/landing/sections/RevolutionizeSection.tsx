import { type JSX } from 'react';
import { Link } from 'react-router-dom';
import ActionButton from '@/components/ui/ActionButton';
import { revolutionizeButtons } from '@/config/buttonConfig';

export default function RevolutionizeSection(): JSX.Element {
   return (
      <div className="w-full px-4 md:px-8 lg:px-16 py-8 md:py-16">
         <div className="max-w-7xl mx-auto">
            {/* Header */}
            <div className="bg-[#111111] rounded-[20px] md:rounded-[30px] p-6 md:p-8 mb-8 md:mb-12">
               <div className="flex flex-col md:flex-row items-start gap-4 md:gap-6">
                  <span className="text-4xl md:text-5xl">💡</span>
                  <div>
                     <h2 className="[font-family:'PP_Telegraf-Regular',Helvetica] font-normal text-white text-2xl md:text-4xl lg:text-5xl tracking-[0] leading-snug">
                        REVOLUTIONIZE MICROLOANS <br className="hidden md:block" />
                        & REIMAGINE CREDIT
                     </h2>
                  </div>
               </div>
            </div>

            {/* Content Grid */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 md:gap-8 mb-8 md:mb-12">
               {/* Left Column - 3 Cards */}
               <div className="flex flex-col gap-6 md:gap-8">
                  {/* Card 1 - A New Era */}
                  <div className="bg-[#57c2ff] rounded-[20px] md:rounded-[30px] p-6 md:p-8">
                     <h3 className="[font-family:'PP_Telegraf-Regular',Helvetica] font-bold text-[#171420] text-xl md:text-2xl tracking-[0] leading-snug mb-3">
                        A New Era of Microloans
                     </h3>
                     <p className="[font-family:'PP_Telegraf-Regular',Helvetica] font-normal text-[#171420] text-base md:text-lg tracking-[0] leading-relaxed">
                        No hidden fees, no surprises, and no changes. Everything is safely tracked on our blockchain, so you always know exactly what you're paying.
                     </p>
                  </div>

                  {/* Card 2 - Next-Level Credit */}
                  <div className="bg-[#f093ff] rounded-[20px] md:rounded-[30px] p-6 md:p-8">
                     <h3 className="[font-family:'PP_Telegraf-Regular',Helvetica] font-bold text-[#171420] text-xl md:text-2xl tracking-[0] leading-snug mb-3">
                        Next-Level Credit Score
                     </h3>
                     <p className="[font-family:'PP_Telegraf-Regular',Helvetica] font-normal text-[#171420] text-base md:text-lg tracking-[0] leading-relaxed">
                        Your privacy matters. Moodeng never collects your name, contacts, social media, SIM, or photos. Your credit is based on repayments, not personal data.
                     </p>
                  </div>

                  {/* Card 3 - Community Lending */}
                  <div className="bg-[#4de5a6] rounded-[20px] md:rounded-[30px] p-6 md:p-8">
                     <h3 className="[font-family:'PP_Telegraf-Regular',Helvetica] font-bold text-[#171420] text-xl md:text-2xl tracking-[0] leading-snug mb-3">
                        Community Lending
                     </h3>
                     <p className="[font-family:'PP_Telegraf-Regular',Helvetica] font-normal text-[#171420] text-base md:text-lg tracking-[0] leading-relaxed">
                        Connect with real people, not corporations. Our platform unites ethical real people who want to help, offering fairer terms and a personal touch.
                     </p>
                  </div>
               </div>

               {/* Right Column - Loan Card */}
               <div className="lg:col-span-2">
                  <div className="bg-white rounded-[15px] md:rounded-[18px] overflow-hidden border border-solid border-[#dddddd] p-6 md:p-8">
                     {/* Header */}
                     <div className="border-b border-[#dddddd] pb-4 mb-4 md:mb-6">
                        <div className="flex items-center justify-between mb-2">
                           <h4 className="[font-family:'DM_Sans',Helvetica] font-normal text-black text-lg md:text-xl tracking-[0] leading-[30px]">
                              FactoryWorker87
                           </h4>
                           <span className="text-yellow-400">⭐</span>
                        </div>
                        <p className="[font-family:'DM_Sans',Helvetica] font-normal text-[#000000cc] text-sm md:text-base tracking-[0] leading-[26px]">
                           June 13, 2024
                        </p>
                     </div>

                     {/* Content */}
                     <p className="[font-family:'Geist-Medium',Helvetica] font-bold text-black text-lg md:text-xl tracking-[0] leading-[30px] mb-6">
                        Need gas money to get to clinical rotations this week
                     </p>

                     {/* Status Bars */}
                     <div className="mb-4 space-y-2">
                        <div className="flex gap-2">
                           <div className="flex-1 bg-[#24b054] h-2.5 rounded-[100px]" />
                           <div className="w-16 bg-[#2154e8] h-2.5 rounded-[100px]" />
                        </div>
                        <div className="grid grid-cols-2 gap-4 text-sm md:text-base">
                           <div className="flex items-center gap-2">
                              <div className="w-3 h-3 bg-[#24b054] rounded" />
                              <span className="[font-family:'DM_Sans',Helvetica] font-normal text-[#070707]">Past loans: 30</span>
                           </div>
                           <div className="flex items-center gap-2">
                              <div className="w-3 h-3 bg-[#2154e8] rounded" />
                              <span className="[font-family:'DM_Sans',Helvetica] font-normal text-[#070707]">Active loans: 2</span>
                           </div>
                        </div>
                     </div>

                     {/* Amount Details */}
                     <div className="border-y border-[#dddddd] py-4 mb-4 grid grid-cols-3 gap-4">
                        <div>
                           <p className="[font-family:'DM_Sans',Helvetica] font-normal text-[#07070799] text-xs md:text-sm tracking-[0] leading-6 mb-1">
                              Amount
                           </p>
                           <p className="[font-family:'DM_Sans',Helvetica] font-medium text-[#070707] text-lg md:text-xl tracking-[0] leading-[30px]">
                              $300
                           </p>
                        </div>
                        <div>
                           <p className="[font-family:'DM_Sans',Helvetica] font-normal text-[#07070799] text-xs md:text-sm tracking-[0] leading-6 mb-1">
                              Payback
                           </p>
                           <p className="[font-family:'DM_Sans',Helvetica] font-medium text-[#070707] text-lg md:text-xl tracking-[0] leading-[30px]">
                              $350
                           </p>
                        </div>
                        <div>
                           <p className="[font-family:'DM_Sans',Helvetica] font-normal text-[#07070799] text-xs md:text-sm tracking-[0] leading-6 mb-1">
                              Days
                           </p>
                           <p className="[font-family:'DM_Sans',Helvetica] font-medium text-[#070707] text-lg md:text-xl tracking-[0] leading-[30px]">
                              80
                           </p>
                        </div>
                     </div>

                     {/* Credit Unlocked */}
                     <div className="flex items-center gap-2 mb-4 text-sm md:text-base">
                        <span>🔒</span>
                        <p className="[font-family:'DM_Sans',Helvetica] font-medium text-[#128331]">
                           $300.00 credit unlocked
                        </p>
                     </div>

                     {/* Button */}
                     <Link to="/dashboard#request"
                        className="w-full bg-[#2154e8] text-white [font-family:'DM_Sans',Helvetica] font-medium text-center py-3 rounded-lg hover:bg-blue-700 transition-colors"
                     >
                        Send Your Help
                     </Link>
                  </div>
               </div>
            </div>

            {/* Fair, Transparent Section */}
            <div className="text-center">
               <h3 className="[font-family:'PP_Telegraf-Regular',Helvetica] font-normal text-[#f6f6f6] text-2xl md:text-3xl lg:text-4xl tracking-[0] leading-snug">
                  FAIR, TRANSPARENT & EMPOWERED
               </h3>
            </div>
         </div>
      </div>
   );
}
