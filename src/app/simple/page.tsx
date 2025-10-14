'use client';

import React from 'react';

import Image from 'next/image';
import Link from 'next/link';
import { useRouter } from 'next/navigation';

export default function SimplePage() {
   const router = useRouter();

   return (
      <div className="bg-[#171420] flex flex-row justify-center w-full">
         <div className="bg-[#171420] w-[1920px] h-[8436px]">
            <div className="flex flex-col w-[1920px] h-[8436px] items-center justify-center relative">
               <div className="relative self-stretch w-full h-16 bg-[#171420]">
                  <div className="flex w-[1431px] items-center justify-between relative top-2 left-[244px]">
                     <div className="inline-flex items-center justify-center gap-[34px] relative flex-[0_0_auto]">
                        <div className="inline-flex items-center justify-center gap-1 relative flex-[0_0_auto]">
                           <Image
                              className="relative h-[46.95px] mb-[-8.00px] ml-[-4.00px] w-[42px] object-cover"
                              alt=""
                              src="https://c.animaapp.com/VPWnEuWR/img/file--4--1@2x.png"
                              width={42}
                              height={47}
                           />
                           <div
                              onClick={() => router.push('/')}
                              className="relative w-fit [font-family:'PP_Telegraf-Ultrabold',Helvetica] font-normal text-white text-2xl tracking-[0] leading-[34px] whitespace-nowrap"
                           >
                              Moodeng Credit
                           </div>
                        </div>
                        <div className="inline-flex items-center justify-center gap-[34px] relative flex-[0_0_auto]">
                           <div
                              onClick={() => router.push('/guide')}
                              className="relative w-[100px] h-10 mt-[-1.00px] [font-family:'PP_Telegraf-Regular',Helvetica] font-normal text-white text-xl text-center tracking-[-0.20px] leading-10 whitespace-nowrap"
                           >
                              Guide
                           </div>
                           <div
                              onClick={() => router.push('/benefits')}
                              className="relative w-[100px] h-10 mt-[-1.00px] [font-family:'PP_Telegraf-Regular',Helvetica] font-normal text-white text-xl text-center tracking-[-0.20px] leading-10 whitespace-nowrap"
                           >
                              Benefits
                           </div>
                           <div
                              onClick={() => router.push('/whylend')}
                              className="relative w-[100px] h-10 mt-[-1.00px] [font-family:'PP_Telegraf-Regular',Helvetica] font-normal text-white text-xl text-center tracking-[-0.20px] leading-10 whitespace-nowrap"
                           >
                              Why Lend
                           </div>
                           <div className="relative w-[47.62px] h-10 mt-[-1.00px] [font-family:'PP_Telegraf-Regular',Helvetica] font-normal text-white text-xl text-center tracking-[-0.20px] leading-10 whitespace-nowrap">
                              <Link href="https://moodeng-credit.gitbook.io/moodeng-credit">Docs</Link>
                           </div>
                        </div>
                     </div>
                     <div className="inline-flex items-center justify-center gap-4 relative flex-[0_0_auto]">
                        <div className="relative w-[186px] h-[42px] bg-[#171420] rounded-[100px] overflow-hidden">
                           <div
                              onClick={() => router.push('/login')}
                              className="absolute w-[163px] h-[22px] top-[9px] left-[11px] [font-family:'PP_Telegraf-Regular',Helvetica] font-normal text-[#f6f6f6] text-[22px] text-center tracking-[0] leading-[22px] whitespace-nowrap"
                           >
                              Log in
                           </div>
                        </div>
                        <div className="relative w-[186px] h-[42px] bg-[#6d57ff] rounded-[100px] overflow-hidden">
                           <div
                              onClick={() => router.push('/login')}
                              className="absolute w-[163px] h-[22px] top-[11px] left-[11px] [font-family:'PP_Telegraf-Regular',Helvetica] font-normal text-white text-[22px] text-center tracking-[0] leading-[22px] whitespace-nowrap"
                           >
                              Sign up
                           </div>
                        </div>
                     </div>
                  </div>
               </div>
               <div className="text-white text-4xl mt-20">Simple Page - CSS and Navigation working!</div>
            </div>
         </div>
      </div>
   );
}
