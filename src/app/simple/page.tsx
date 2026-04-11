

import { Link } from 'react-router-dom';

export default function SimplePage() {

   return (
      <div className="bg-[#171420] flex flex-row justify-center w-full">
         <div className="bg-[#171420] w-[1920px] h-[8436px]">
            <div className="flex flex-col w-[1920px] h-[8436px] items-center justify-center relative">
               <div className="relative self-stretch w-full h-16 bg-[#171420]">
                  <div className="flex w-[1431px] items-center justify-between relative top-2 left-[244px]">
                     <div className="inline-flex items-center justify-center gap-[34px] relative flex-[0_0_auto]">
                        <div className="inline-flex items-center justify-center gap-1 relative flex-[0_0_auto]">
                           <img
                              className="relative h-[46.95px] mb-[-8.00px] ml-[-4.00px] w-[42px] object-cover"
                              alt=""
                              src="https://c.animaapp.com/VPWnEuWR/img/file--4--1@2x.png"
                              width={42}
                              height={47}
                           />
                           <Link to="/"
                              className="relative w-fit [font-family:'PP_Telegraf-Ultrabold',Helvetica] font-normal text-white text-2xl tracking-[0] leading-[34px] whitespace-nowrap"
                           >
                              Moodeng Credit
                           </Link>
                        </div>
                        <div className="inline-flex items-center justify-center gap-[34px] relative flex-[0_0_auto]">
                           <Link to="/guide"
                              className="relative w-[100px] h-10 mt-[-1.00px] [font-family:'PP_Telegraf-Regular',Helvetica] font-normal text-white text-xl text-center tracking-[-0.20px] leading-10 whitespace-nowrap"
                           >
                              Guide
                           </Link>
                           <Link to="/benefits"
                              className="relative w-[100px] h-10 mt-[-1.00px] [font-family:'PP_Telegraf-Regular',Helvetica] font-normal text-white text-xl text-center tracking-[-0.20px] leading-10 whitespace-nowrap"
                           >
                              Benefits
                           </Link>
                           <Link to="/whylend"
                              className="relative w-[100px] h-10 mt-[-1.00px] [font-family:'PP_Telegraf-Regular',Helvetica] font-normal text-white text-xl text-center tracking-[-0.20px] leading-10 whitespace-nowrap"
                           >
                              Why Lend
                           </Link>
                           <div className="relative w-[47.62px] h-10 mt-[-1.00px] [font-family:'PP_Telegraf-Regular',Helvetica] font-normal text-white text-xl text-center tracking-[-0.20px] leading-10 whitespace-nowrap">
                              <Link to="https://moodeng-credit.gitbook.io/moodeng-credit">Docs</Link>
                           </div>
                        </div>
                     </div>
                     <div className="inline-flex items-center justify-center gap-4 relative flex-[0_0_auto]">
                        <Link to="/sign-in"
                           className="relative w-[186px] h-[42px] bg-[#171420] rounded-[100px] overflow-hidden flex items-center justify-center [font-family:'PP_Telegraf-Regular',Helvetica] font-normal text-[#f6f6f6] text-[22px] text-center tracking-[0] leading-[22px] whitespace-nowrap"
                        >
                           Log in
                        </Link>
                        <Link to="/sign-in"
                           className="relative w-[186px] h-[42px] bg-[#6d57ff] rounded-[100px] overflow-hidden flex items-center justify-center [font-family:'PP_Telegraf-Regular',Helvetica] font-normal text-white text-[22px] text-center tracking-[0] leading-[22px] whitespace-nowrap"
                        >
                           Sign up
                        </Link>
                     </div>
                  </div>
               </div>
               <div className="text-white text-4xl mt-20">Simple Page - CSS and Navigation working!</div>
            </div>
         </div>
      </div>
   );
}
