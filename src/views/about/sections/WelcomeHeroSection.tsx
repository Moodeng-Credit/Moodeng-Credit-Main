import { type JSX } from 'react';

import Image from 'next/image';

import ActionButton from '@/components/ui/ActionButton';

import { aboutHeroButtons } from '@/config/buttonConfig';

export default function WelcomeHeroSection(): JSX.Element {
   return (
      <div className="flex flex-col h-[1086px] items-start w-[1425px] relative">
         <div className="h-[438px] bg-[#f7c9ff] rounded-[60px] overflow-hidden w-[1425px] relative">
            <div className="relative w-[1274px] h-[361px] top-[17px] left-[53px]">
               <div className="absolute w-[1272px] h-[361px] top-0 left-0">
                  <div className="absolute w-[1221px] h-[318px] top-[43px] left-[49px]">
                     <div className="relative w-[961px] h-[301px] top-[17px] left-14">
                        <div className="absolute w-[425px] h-[83px] top-[51px] left-[513px] bg-[#33d6a8] rounded-2xl z-2" />

                        <div className="absolute w-[961px] h-[301px] top-0 left-0">
                           <div className="absolute w-[502px] h-[301px] top-0 left-0">
                              <Image
                                 className="absolute w-[168px] h-[218px] top-[83px] left-[334px] object-cover"
                                 alt="Screenshot"
                                 src="https://c.animaapp.com/wawSHnKX/img/screenshot-2024-09-19-at-15-51-16-removebg-preview-1.png"
                                 width={168}
                                 height={218}
                              />

                              <Image
                                 className="absolute w-[323px] h-[165px] top-0 left-0"
                                 alt="Vector"
                                 src="https://c.animaapp.com/wawSHnKX/img/vector.svg"
                                 width={323}
                                 height={165}
                              />
                           </div>

                           <p className="absolute w-[392px] top-[60px] left-[537px] [font-family:'PP_Telegraf-Regular',Helvetica] font-normal text-white text-xl tracking-[0] leading-8 z-3">
                              To get funded, you need to write why you need it, so someone will fund you.
                           </p>

                           <Image
                              className="w-[146px] h-[136px] top-[165px] left-48 absolute object-cover"
                              alt=""
                              src="https://c.animaapp.com/wawSHnKX/img/file--4--1-1.png"
                              width={146}
                              height={136}
                           />
                        </div>

                        <div className="absolute w-[376px] h-[83px] top-[193px] left-[519px] bg-[#ffe635] rounded-2xl" />
                     </div>
                  </div>

                  <div className="absolute w-[660px] h-8 top-0 left-0 [font-family:'Telex',Helvetica] font-normal text-[#171420] text-3xl tracking-[0] leading-8 whitespace-nowrap">
                     Welcome to Moodeng Academy
                  </div>
               </div>

               <div className="absolute w-[1120px] h-[285px] top-[77px] left-[155px]">
                  <div className="absolute w-[289px] h-32 top-0 left-0">
                     <Image
                        className="absolute w-[52px] h-11 top-[55px] left-[237px]"
                        alt="Group"
                        src="https://c.animaapp.com/wawSHnKX/img/group-26086621@2x.png"
                        width={100}
                        height={100}
                     />

                     <p className="absolute w-[249px] h-32 top-0 left-0 [font-family:'PP_Telegraf-Regular',Helvetica] font-normal text-white text-xl tracking-[0] leading-8">
                        <span className="[font-family:'PP_Telegraf-Regular',Helvetica] font-normal text-white text-xl tracking-[0] leading-8">
                           Hi there! I am Mecha! Leader of the Mechas, here to help{' '}
                        </span>

                        <span className="[font-family:'PP_Telegraf-Regular',Helvetica] font-bold text-white text-xl tracking-[0] leading-8">
                           Moodeng
                        </span>

                        <span className="[font-family:'PP_Telegraf-Regular',Helvetica] font-normal text-white text-xl tracking-[0] leading-8">
                           {' '}
                           explain how her platform works!{' '}
                        </span>
                     </p>
                  </div>

                  <p className="absolute w-[328px] top-[184px] left-[487px] [font-family:'PP_Telegraf-Regular',Helvetica] font-normal text-black text-xl tracking-[0] leading-8">
                     And make sure to submit a request within your credit limit.
                  </p>

                  <Image
                     className="absolute w-[23px] h-[25px] top-[84px] left-[455px]"
                     alt="Bubble point"
                     src="https://c.animaapp.com/wawSHnKX/img/bubble-point.svg"
                     width={23}
                     height={25}
                  />

                  <Image
                     className="absolute w-5 h-6 top-[188px] left-[458px]"
                     alt="Bubble point"
                     src="https://c.animaapp.com/wawSHnKX/img/bubble-point-1.svg"
                     width={20}
                     height={24}
                  />

                  <div className="absolute w-[188px] h-[285px] top-0 left-[928px]">
                     <div className="relative w-[190px] h-[285px]">
                        <div className="absolute w-[190px] h-[285px] top-0 left-0">
                           <div className="relative w-[188px] h-[285px]">
                              <div className="absolute w-[188px] h-[285px] top-0 left-0 bg-[#ffffff1a] shadow-[0px_2px_2px_#00000040]">
                                 <div className="relative w-[168px] h-[272px] top-[7px] left-2.5 bg-white rounded-md overflow-hidden">
                                    <div className="absolute w-[158px] h-[29px] top-[5px] left-[5px] bg-[#f1f1f1] rounded-md overflow-hidden border-[0.5px] border-solid border-[#dddddd]">
                                       <button className="all-[unset] box-border flex w-[78px] h-[23px] gap-2.5 px-2.5 py-[9px] absolute top-[3px] left-[3px] bg-[#040033] rounded items-center justify-center overflow-hidden">
                                          <div className="relative w-fit mt-[-1.00px] mb-[-1.00px] [font-family:'PP_Telegraf-Regular',Helvetica] font-normal text-white text-[7px] text-center tracking-[0] leading-[7px] whitespace-nowrap">
                                             Ask For Help
                                          </div>
                                       </button>

                                       <div className="absolute top-2.5 left-[98px] text-[#00000099] text-[7px] leading-[7px] whitespace-nowrap [font-family:'PP_Telegraf-Regular',Helvetica] font-normal text-center tracking-[0]">
                                          Offer Help
                                       </div>
                                    </div>

                                    <div className="flex w-[158px] items-center gap-2.5 px-2.5 py-[7.5px] absolute top-[74px] left-[5px] bg-white rounded border-[0.5px] border-solid border-[#dddddd]">
                                       <p className="relative w-fit mt-[-0.50px] [font-family:'PP_Telegraf-Regular',Helvetica] font-normal text-[#00000099] text-[7px] tracking-[0] leading-[9px] whitespace-nowrap">
                                          How much do you need today? i.e. $15
                                       </p>
                                    </div>

                                    <div className="flex w-[158px] items-center gap-2.5 px-2.5 py-[7.5px] absolute top-[164px] left-[5px] bg-white rounded border-[0.5px] border-solid border-[#dddddd]">
                                       <p className="relative w-fit mt-[-0.50px] [font-family:'PP_Telegraf-Regular',Helvetica] font-normal text-[#00000099] text-[7px] tracking-[0] leading-[9px] whitespace-nowrap">
                                          Enter how much you will payback? i.e. $17
                                       </p>
                                    </div>

                                    <div className="flex w-[158px] items-center gap-2.5 px-2.5 py-[7.5px] absolute top-[196px] left-[5px] bg-white rounded border-[0.5px] border-solid border-[#dddddd]">
                                       <p className="relative w-fit mt-[-0.50px] [font-family:'PP_Telegraf-Regular',Helvetica] font-normal text-[#00000099] text-[7px] tracking-[0] leading-[9px] whitespace-nowrap">
                                          Type your reason? i.e. an emergency, etc.
                                       </p>
                                    </div>

                                    <div className="inline-flex items-center gap-[3px] absolute top-[103px] left-[5px]">
                                       <div className="inline-flex items-center justify-center gap-[5px] px-1.5 py-[5px] relative flex-[0_0_auto] bg-[#f1f1f1] rounded border-[0.5px] border-solid border-[#ffffff33]">
                                          <div className="relative w-fit mt-[-0.50px] [font-family:'PP_Telegraf-Regular',Helvetica] font-normal text-[#585858] text-[7px] tracking-[0] leading-3 whitespace-nowrap">
                                             $10
                                          </div>
                                       </div>

                                       <div className="inline-flex items-center justify-center gap-[5px] px-1.5 py-[5px] relative flex-[0_0_auto] bg-[#f1f1f1] rounded border-[0.5px] border-solid border-[#ffffff33]">
                                          <div className="mt-[-0.50px] text-[#585858] text-[7px] leading-3 whitespace-nowrap relative w-fit [font-family:'PP_Telegraf-Regular',Helvetica] font-normal tracking-[0]">
                                             $15
                                          </div>
                                       </div>

                                       <div className="inline-flex items-center justify-center gap-[5px] px-1.5 py-[5px] relative flex-[0_0_auto] bg-[#f1f1f1] rounded border-[0.5px] border-solid border-[#ffffff33]">
                                          <div className="mt-[-0.50px] text-[#585858] text-[7px] leading-3 whitespace-nowrap relative w-fit [font-family:'PP_Telegraf-Regular',Helvetica] font-normal tracking-[0]">
                                             $20
                                          </div>
                                       </div>

                                       <div className="inline-flex items-center justify-center gap-[5px] px-1.5 py-[5px] relative flex-[0_0_auto] bg-[#f1f1f1] rounded border-[0.5px] border-solid border-[#ffffff33]">
                                          <div className="mt-[-0.50px] text-[#585858] text-[7px] leading-3 whitespace-nowrap relative w-fit [font-family:'PP_Telegraf-Regular',Helvetica] font-normal tracking-[0]">
                                             $40
                                          </div>
                                       </div>

                                       <div className="inline-flex items-center justify-center gap-[5px] px-1.5 py-[5px] relative flex-[0_0_auto] bg-[#f1f1f1] rounded border-[0.5px] border-solid border-[#ffffff33]">
                                          <div className="relative w-fit mt-[-0.50px] [font-family:'PP_Telegraf-Regular',Helvetica] font-normal text-[#585858] text-[7px] tracking-[0] leading-3 whitespace-nowrap">
                                             Other
                                          </div>
                                       </div>
                                    </div>

                                    <div className="flex w-[158px] items-center justify-between px-[7.5px] py-1 absolute top-[132px] left-[5px] bg-white rounded border-[0.5px] border-solid border-[#dddddd]">
                                       <div className="inline-flex flex-col items-start justify-center gap-[3px] relative flex-[0_0_auto]">
                                          <div className="relative w-fit mt-[-0.50px] [font-family:'PP_Telegraf-Regular',Helvetica] text-[#00000099] text-[6px] leading-[6px] font-normal tracking-[0] whitespace-nowrap">
                                             Repayment timeline
                                          </div>

                                          <div className="relative w-fit [font-family:'PP_Telegraf-Regular',Helvetica] font-normal text-black text-[7px] tracking-[0] leading-[7px] whitespace-nowrap">
                                             dd/mm/yy
                                          </div>
                                       </div>

                                       <svg
                                          className="!relative !w-3 !h-3"
                                          fill="none"
                                          height="13"
                                          viewBox="0 0 13 13"
                                          width="13"
                                          xmlns="http://www.w3.org/2000/svg"
                                       >
                                          <path
                                             d="M2.04639 5.20223H10.9584"
                                             stroke="#110000"
                                             strokeLinecap="round"
                                             strokeLinejoin="round"
                                             strokeWidth="0.75"
                                          />

                                          <path
                                             d="M8.72098 7.15486H8.72562"
                                             stroke="#110000"
                                             strokeLinecap="round"
                                             strokeLinejoin="round"
                                             strokeWidth="0.75"
                                          />

                                          <path
                                             d="M6.50223 7.15486H6.50687"
                                             stroke="#110000"
                                             strokeLinecap="round"
                                             strokeLinejoin="round"
                                             strokeWidth="0.75"
                                          />

                                          <path
                                             d="M4.27884 7.15486H4.28348"
                                             stroke="#110000"
                                             strokeLinecap="round"
                                             strokeLinejoin="round"
                                             strokeWidth="0.75"
                                          />

                                          <path
                                             d="M8.72098 9.09822H8.72562"
                                             stroke="#110000"
                                             strokeLinecap="round"
                                             strokeLinejoin="round"
                                             strokeWidth="0.75"
                                          />

                                          <path
                                             d="M6.50223 9.09822H6.50687"
                                             stroke="#110000"
                                             strokeLinecap="round"
                                             strokeLinejoin="round"
                                             strokeWidth="0.75"
                                          />

                                          <path
                                             d="M4.27884 9.09822H4.28348"
                                             stroke="#110000"
                                             strokeLinecap="round"
                                             strokeLinejoin="round"
                                             strokeWidth="0.75"
                                          />

                                          <path
                                             d="M8.52188 1.5V3.14539"
                                             stroke="#110000"
                                             strokeLinecap="round"
                                             strokeLinejoin="round"
                                             strokeWidth="0.75"
                                          />

                                          <path
                                             d="M4.48282 1.5V3.14539"
                                             stroke="#110000"
                                             strokeLinecap="round"
                                             strokeLinejoin="round"
                                             strokeWidth="0.75"
                                          />

                                          <path
                                             clipRule="evenodd"
                                             d="M8.61913 2.28955H4.38548C2.91714 2.28955 2 3.10752 2 4.61106V9.13589C2 10.6631 2.91714 11.5 4.38548 11.5H8.6145C10.0875 11.5 11 10.6773 11 9.17371V4.61106C11.0046 3.10752 10.0921 2.28955 8.61913 2.28955Z"
                                             fillRule="evenodd"
                                             stroke="#110000"
                                             strokeLinecap="round"
                                             strokeLinejoin="round"
                                             strokeWidth="0.75"
                                          />
                                       </svg>
                                    </div>

                                    <button className="all-[unset] box-border flex w-[158px] gap-2.5 px-2.5 py-2 absolute top-[234px] left-[5px] bg-[#2154e8] rounded items-center justify-center overflow-hidden">
                                       <div className="relative w-fit text-white text-[8px] leading-[8px] whitespace-nowrap [font-family:'PP_Telegraf-Regular',Helvetica] font-normal text-center tracking-[0]">
                                          Submit Request
                                       </div>
                                    </button>

                                    <div className="flex w-[100px] h-2.5 items-center gap-0.5 px-1 py-px absolute top-10 left-3 bg-[#e2f7f5] rounded">
                                       <div className="relative w-2 h-2">
                                          <Image
                                             className="absolute w-[7px] h-[5px] top-px left-px"
                                             alt="Style"
                                             src="https://c.animaapp.com/wawSHnKX/img/style-1.svg"
                                             width={7}
                                             height={5}
                                          />
                                       </div>

                                       <p className="relative w-fit mt-[-3.00px] mb-[-3.00px] [font-family:'Geist',Helvetica] font-medium text-black text-[5.8px] tracking-[0] leading-[15px] whitespace-nowrap">
                                          Your available credit limit: $15
                                       </p>
                                    </div>
                                 </div>
                              </div>

                              <div className="absolute top-16 left-6 [font-family:'Geist',Helvetica] font-medium text-black text-[10px] tracking-[0] leading-[15px] whitespace-nowrap">
                                 Set Your Own Terms
                              </div>
                           </div>
                        </div>

                        <div className="absolute w-[190px] h-[285px] top-0 left-0">
                           <div className="relative w-[188px] h-[285px]">
                              <div className="absolute w-[188px] h-[285px] top-0 left-0 bg-[#ffffff1a] shadow-[0px_2px_2px_#00000040]">
                                 <div className="relative w-[168px] h-[272px] top-[7px] left-2.5 bg-white rounded-md overflow-hidden">
                                    <div className="absolute w-[158px] h-[29px] top-[5px] left-[5px] bg-[#f1f1f1] rounded-md overflow-hidden border-[0.5px] border-solid border-[#dddddd]">
                                       <button className="all-[unset] box-border flex w-[78px] h-[23px] gap-2.5 px-2.5 py-[9px] absolute top-[3px] left-[3px] bg-[#040033] rounded items-center justify-center overflow-hidden">
                                          <div className="relative w-fit mt-[-1.00px] mb-[-1.00px] [font-family:'PP_Telegraf-Regular',Helvetica] font-normal text-white text-[7px] text-center tracking-[0] leading-[7px] whitespace-nowrap">
                                             Ask For Help
                                          </div>
                                       </button>

                                       <div className="absolute top-2.5 left-[98px] text-[#00000099] text-[7px] leading-[7px] whitespace-nowrap [font-family:'PP_Telegraf-Regular',Helvetica] font-normal text-center tracking-[0]">
                                          Offer Help
                                       </div>
                                    </div>

                                    <div className="flex w-[315px] items-center gap-2.5 px-2.5 py-[7.5px] absolute top-[74px] left-[5px] bg-white rounded border-[0.5px] border-solid border-[#dddddd]">
                                       <div className="relative w-fit mt-[-0.50px] [font-family:'PP_Telegraf-Regular',Helvetica] font-normal text-[#00000099] text-[7px] tracking-[0] leading-[9px] whitespace-nowrap">
                                          Enter amount, i.e. $15
                                       </div>
                                    </div>

                                    <div className="flex w-[158px] items-center gap-2.5 px-2.5 py-[7.5px] absolute top-[164px] left-[5px] bg-white rounded border-[0.5px] border-solid border-[#dddddd]">
                                       <p className="relative w-fit mt-[-0.50px] [font-family:'PP_Telegraf-Regular',Helvetica] font-normal text-[#00000099] text-[7px] tracking-[0] leading-[9px] whitespace-nowrap">
                                          Enter amount to repay, i.e. $18
                                       </p>
                                    </div>

                                    <div className="flex w-[158px] items-center gap-2.5 px-2.5 py-[7.5px] absolute top-[196px] left-[5px] bg-white rounded border-[0.5px] border-solid border-[#dddddd]">
                                       <p className="relative w-fit mt-[-0.50px] [font-family:'PP_Telegraf-Regular',Helvetica] font-normal text-[#00000099] text-[7px] tracking-[0] leading-[9px] whitespace-nowrap">
                                          Enter reason i.e. an emergency, etc.
                                       </p>
                                    </div>

                                    <div className="inline-flex items-center gap-[3px] absolute top-[103px] left-[5px]">
                                       <div className="inline-flex items-center justify-center gap-[5px] px-1.5 py-[5px] relative flex-[0_0_auto] bg-[#f1f1f1] rounded border-[0.5px] border-solid border-[#ffffff33]">
                                          <div className="mt-[-0.50px] text-[#585858] text-[7px] leading-3 whitespace-nowrap relative w-fit [font-family:'PP_Telegraf-Regular',Helvetica] font-normal tracking-[0]">
                                             $10
                                          </div>
                                       </div>

                                       <div className="inline-flex items-center justify-center gap-[5px] px-1.5 py-[5px] relative flex-[0_0_auto] bg-[#f1f1f1] rounded border-[0.5px] border-solid border-[#ffffff33]">
                                          <div className="mt-[-0.50px] text-[#585858] text-[7px] leading-3 whitespace-nowrap relative w-fit [font-family:'PP_Telegraf-Regular',Helvetica] font-normal tracking-[0]">
                                             $15
                                          </div>
                                       </div>

                                       <div className="inline-flex items-center justify-center gap-[5px] px-1.5 py-[5px] relative flex-[0_0_auto] bg-[#f1f1f1] rounded border-[0.5px] border-solid border-[#ffffff33]">
                                          <div className="mt-[-0.50px] text-[#585858] text-[7px] leading-3 whitespace-nowrap relative w-fit [font-family:'PP_Telegraf-Regular',Helvetica] font-normal tracking-[0]">
                                             $20
                                          </div>
                                       </div>

                                       <div className="inline-flex items-center justify-center gap-[5px] px-1.5 py-[5px] relative flex-[0_0_auto] bg-[#f1f1f1] rounded border-[0.5px] border-solid border-[#ffffff33]">
                                          <div className="mt-[-0.50px] text-[#585858] text-[7px] leading-3 whitespace-nowrap relative w-fit [font-family:'PP_Telegraf-Regular',Helvetica] font-normal tracking-[0]">
                                             $40
                                          </div>
                                       </div>

                                       <div className="inline-flex items-center justify-center gap-[5px] px-1.5 py-[5px] relative flex-[0_0_auto] bg-[#f1f1f1] rounded border-[0.5px] border-solid border-[#ffffff33]">
                                          <div className="mt-[-0.50px] text-[7px] leading-3 relative w-fit [font-family:'PP_Telegraf-Regular',Helvetica] font-normal text-[#585858] tracking-[0] whitespace-nowrap">
                                             Other
                                          </div>
                                       </div>
                                    </div>

                                    <div className="flex w-[158px] items-center justify-between px-[7.5px] py-1 absolute top-[132px] left-[5px] bg-white rounded border-[0.5px] border-solid border-[#dddddd]">
                                       <div className="inline-flex flex-col items-start justify-center gap-[3px] relative flex-[0_0_auto]">
                                          <div className="relative w-fit mt-[-0.50px] [font-family:'PP_Telegraf-Regular',Helvetica] text-[#00000099] text-[6px] leading-[6px] font-normal tracking-[0] whitespace-nowrap">
                                             Repayment timeline
                                          </div>

                                          <div className="relative w-fit [font-family:'PP_Telegraf-Regular',Helvetica] font-normal text-black text-[7px] tracking-[0] leading-[7px] whitespace-nowrap">
                                             dd/mm/yy
                                          </div>
                                       </div>

                                       <svg
                                          className="!relative !w-3 !h-3"
                                          fill="none"
                                          height="13"
                                          viewBox="0 0 13 13"
                                          width="13"
                                          xmlns="http://www.w3.org/2000/svg"
                                       >
                                          <path
                                             d="M2.04639 5.20223H10.9584"
                                             stroke="#110000"
                                             strokeLinecap="round"
                                             strokeLinejoin="round"
                                             strokeWidth="0.75"
                                          />

                                          <path
                                             d="M8.72098 7.15486H8.72562"
                                             stroke="#110000"
                                             strokeLinecap="round"
                                             strokeLinejoin="round"
                                             strokeWidth="0.75"
                                          />

                                          <path
                                             d="M6.50223 7.15486H6.50687"
                                             stroke="#110000"
                                             strokeLinecap="round"
                                             strokeLinejoin="round"
                                             strokeWidth="0.75"
                                          />

                                          <path
                                             d="M4.27884 7.15486H4.28348"
                                             stroke="#110000"
                                             strokeLinecap="round"
                                             strokeLinejoin="round"
                                             strokeWidth="0.75"
                                          />

                                          <path
                                             d="M8.72098 9.09822H8.72562"
                                             stroke="#110000"
                                             strokeLinecap="round"
                                             strokeLinejoin="round"
                                             strokeWidth="0.75"
                                          />

                                          <path
                                             d="M6.50223 9.09822H6.50687"
                                             stroke="#110000"
                                             strokeLinecap="round"
                                             strokeLinejoin="round"
                                             strokeWidth="0.75"
                                          />

                                          <path
                                             d="M4.27884 9.09822H4.28348"
                                             stroke="#110000"
                                             strokeLinecap="round"
                                             strokeLinejoin="round"
                                             strokeWidth="0.75"
                                          />

                                          <path
                                             d="M8.52188 1.5V3.14539"
                                             stroke="#110000"
                                             strokeLinecap="round"
                                             strokeLinejoin="round"
                                             strokeWidth="0.75"
                                          />

                                          <path
                                             d="M4.48282 1.5V3.14539"
                                             stroke="#110000"
                                             strokeLinecap="round"
                                             strokeLinejoin="round"
                                             strokeWidth="0.75"
                                          />

                                          <path
                                             clipRule="evenodd"
                                             d="M8.61913 2.28955H4.38548C2.91714 2.28955 2 3.10752 2 4.61106V9.13589C2 10.6631 2.91714 11.5 4.38548 11.5H8.6145C10.0875 11.5 11 10.6773 11 9.17371V4.61106C11.0046 3.10752 10.0921 2.28955 8.61913 2.28955Z"
                                             fillRule="evenodd"
                                             stroke="#110000"
                                             strokeLinecap="round"
                                             strokeLinejoin="round"
                                             strokeWidth="0.75"
                                          />
                                       </svg>
                                    </div>

                                    <button className="all-[unset] box-border flex w-[158px] gap-2.5 px-2.5 py-2 absolute top-[234px] left-[5px] bg-[#2154e8] rounded items-center justify-center overflow-hidden">
                                       <div className="relative w-fit text-white text-[8px] leading-[8px] whitespace-nowrap [font-family:'PP_Telegraf-Regular',Helvetica] font-normal text-center tracking-[0]">
                                          Submit Request
                                       </div>
                                    </button>

                                    <div className="flex w-[100px] h-2.5 items-center gap-0.5 px-1 py-px absolute top-10 left-3 bg-[#e2f7f5] rounded">
                                       <div className="relative w-2 h-2">
                                          <Image
                                             className="absolute w-[7px] h-[5px] top-px left-px"
                                             alt="Style"
                                             src="https://c.animaapp.com/wawSHnKX/img/style-1.svg"
                                             width={7}
                                             height={5}
                                          />
                                       </div>

                                       <p className="relative w-fit mt-[-3.00px] mb-[-3.00px] [font-family:'Geist',Helvetica] font-medium text-black text-[5.8px] tracking-[0] leading-[15px] whitespace-nowrap">
                                          Your available credit limit: $15
                                       </p>
                                    </div>
                                 </div>
                              </div>

                              <div className="absolute top-16 left-6 [font-family:'Geist',Helvetica] font-medium text-black text-[10px] tracking-[0] leading-[15px] whitespace-nowrap">
                                 Set Your Own Terms
                              </div>
                           </div>
                        </div>

                        <Image
                           className="absolute w-2.5 h-[9px] top-[66px] left-[124px] object-cover"
                           alt=""
                           src="https://c.animaapp.com/wawSHnKX/img/image-2.png"
                           width={100}
                           height={100}
                        />
                     </div>
                  </div>
               </div>
            </div>
         </div>

         <div className="relative w-[1425px] h-[748px] overflow-hidden">
            <div className="relative w-[1084px] h-[571px] top-[92px] left-[154px]">
               <div className="absolute w-[265px] h-[42px] top-0.5 left-[819px]">
                  <div className="h-[42px]">
                     <div className="relative w-[265px] h-[42px] bg-[#f6f6f6] rounded-[100px] overflow-hidden">
                        {aboutHeroButtons.length > 0
                           ? aboutHeroButtons.map((button) => <ActionButton key={button.text} button={button} />)
                           : null}
                     </div>
                  </div>
               </div>

               {/* Rest of the complex visual elements */}
               <div className="absolute w-[974px] h-[571px] top-0 left-0">
                  {/* Phone mockups and visual elements - keeping original structure */}
                  <div className="absolute w-[532px] h-[278px] top-[194px] left-[442px] bg-white rounded-[10px] shadow-[0px_0px_10px_#ffffff1a]">
                     <div className="relative w-[528px] h-[218px] top-10 left-5">
                        <div className="flex flex-col w-[492px] items-start pt-0 pb-px px-0 absolute top-0 left-0">
                           <div className="relative w-fit mt-[-1.00px] [font-family:'Arial-Bold',Helvetica] font-bold text-[#333333] text-2xl tracking-[0] leading-[normal] whitespace-nowrap">
                              How It Works
                           </div>
                        </div>

                        <div className="flex flex-col w-[492px] items-start pt-0 pb-px px-0 absolute top-12 left-0">
                           <p className="relative w-fit mt-[-1.00px] [font-family:'Arial-Regular',Helvetica] font-bold text-[#333333] text-base tracking-[0] leading-[normal] whitespace-nowrap">
                              1. Enter your loan amount
                           </p>
                        </div>

                        <div className="flex flex-col w-[492px] items-start pt-0 pb-px px-0 absolute top-[82px] left-0">
                           <div className="relative w-fit mt-[-1.00px] [font-family:'Arial-Regular',Helvetica] font-bold text-[#333333] text-base tracking-[0] leading-[normal] whitespace-nowrap">
                              2. Choose repayment timeline
                           </div>
                        </div>

                        <div className="flex flex-col w-[492px] items-start pt-0 pb-px px-0 absolute top-[116px] left-0">
                           <div className="relative w-fit mt-[-1.00px] [font-family:'Arial-Regular',Helvetica] font-bold text-[#333333] text-base tracking-[0] leading-[normal] whitespace-nowrap">
                              3. Specify payback amount
                           </div>
                        </div>

                        <div className="flex flex-col w-[492px] items-start pt-0 pb-px px-0 absolute top-[150px] left-0">
                           <p className="relative w-fit mt-[-1.00px] [font-family:'Arial-Regular',Helvetica] font-bold text-[#333333] text-base tracking-[0] leading-[normal] whitespace-nowrap">
                              4. Explain your reason for the loan
                           </p>
                        </div>

                        <div className="flex flex-col w-[492px] items-start pt-0 pb-px px-0 absolute top-[184px] left-0">
                           <div className="relative w-fit mt-[-1.00px] [font-family:'Arial-Regular',Helvetica] font-bold text-[#333333] text-base tracking-[0] leading-[normal] whitespace-nowrap">
                              5. Submit your request
                           </div>
                        </div>

                        <Image
                           className="w-[284px] h-[218px] top-0 left-[244px] absolute object-cover"
                           alt="Screenshot"
                           src="https://c.animaapp.com/wawSHnKX/img/screenshot-2024-09-19-at-15-51-16-removebg-preview-3.png"
                           width={284}
                           height={218}
                        />
                     </div>
                  </div>

                  {/* Large phone mockup section */}
                  <div className="absolute w-[375px] h-[571px] top-0 left-0">
                     <div className="relative w-[377px] h-[571px]">
                        <div className="absolute w-[377px] h-[571px] top-0 left-0">
                           <div className="relative w-[375px] h-[571px]">
                              <div className="absolute w-[375px] h-[571px] top-0 left-0 bg-[#ffffff1a] shadow-[0px_4px_4px_#00000040]">
                                 <div className="relative w-[335px] h-[543px] top-3.5 left-5 bg-white rounded-xl overflow-hidden">
                                    <div className="absolute w-[315px] h-[58px] top-2.5 left-2.5 bg-[#f1f1f1] rounded-xl overflow-hidden border border-solid border-[#dddddd]">
                                       <button className="all-[unset] box-border flex w-[157px] h-[46px] gap-5 px-5 py-[18px] absolute top-1.5 left-1.5 bg-[#040033] rounded-lg items-center justify-center overflow-hidden">
                                          <div className="relative w-fit mt-[-2.00px] mb-[-2.00px] text-white text-sm leading-[14px] whitespace-nowrap [font-family:'PP_Telegraf-Regular',Helvetica] font-normal text-center tracking-[0]">
                                             Ask For Help
                                          </div>
                                       </button>

                                       <div className="absolute top-[21px] left-[197px] text-[#00000099] text-sm leading-[14px] whitespace-nowrap [font-family:'PP_Telegraf-Regular',Helvetica] font-normal text-center tracking-[0]">
                                          Offer Help
                                       </div>
                                    </div>

                                    <div className="flex w-[315px] items-center gap-5 px-5 py-[15px] absolute top-[148px] left-2.5 bg-white rounded-lg border border-solid border-[#dddddd]">
                                       <p className="relative w-fit mt-[-1.00px] [font-family:'PP_Telegraf-Regular',Helvetica] font-normal text-[#00000099] text-sm tracking-[0] leading-[18px] whitespace-nowrap">
                                          How much do you need today? i.e. $15
                                       </p>
                                    </div>

                                    <div className="flex w-[315px] items-center gap-5 px-5 py-[15px] absolute top-[328px] left-2.5 bg-white rounded-lg border border-solid border-[#dddddd]">
                                       <p className="relative w-fit mt-[-1.00px] [font-family:'PP_Telegraf-Regular',Helvetica] font-normal text-[#00000099] text-sm tracking-[0] leading-[18px] whitespace-nowrap">
                                          Enter how much you will payback? i.e. $17
                                       </p>
                                    </div>

                                    <div className="flex w-[315px] items-center gap-5 px-5 py-[15px] absolute top-[391px] left-2.5 bg-white rounded-lg border border-solid border-[#dddddd]">
                                       <p className="relative w-fit mt-[-1.00px] [font-family:'PP_Telegraf-Regular',Helvetica] font-normal text-[#00000099] text-sm tracking-[0] leading-[18px] whitespace-nowrap">
                                          Type your reason? i.e. an emergency, etc.
                                       </p>
                                    </div>

                                    <div className="inline-flex items-center gap-1.5 absolute top-[206px] left-2.5">
                                       <div className="inline-flex items-center justify-center gap-2.5 px-3 py-2.5 relative flex-[0_0_auto] bg-[#f1f1f1] rounded-lg border border-solid border-[#ffffff33]">
                                          <div className="mt-[-1.00px] text-[#585858] text-sm leading-6 whitespace-nowrap relative w-fit [font-family:'PP_Telegraf-Regular',Helvetica] font-normal tracking-[0]">
                                             $10
                                          </div>
                                       </div>

                                       <div className="inline-flex items-center justify-center gap-2.5 px-3 py-2.5 relative flex-[0_0_auto] bg-[#f1f1f1] rounded-lg border border-solid border-[#ffffff33]">
                                          <div className="mt-[-1.00px] text-[#585858] text-sm leading-6 whitespace-nowrap relative w-fit [font-family:'PP_Telegraf-Regular',Helvetica] font-normal tracking-[0]">
                                             $15
                                          </div>
                                       </div>

                                       <div className="inline-flex items-center justify-center gap-2.5 px-3 py-2.5 relative flex-[0_0_auto] bg-[#f1f1f1] rounded-lg border border-solid border-[#ffffff33]">
                                          <div className="mt-[-1.00px] text-[#585858] text-sm leading-6 whitespace-nowrap relative w-fit [font-family:'PP_Telegraf-Regular',Helvetica] font-normal tracking-[0]">
                                             $20
                                          </div>
                                       </div>

                                       <div className="inline-flex items-center justify-center gap-2.5 px-3 py-2.5 relative flex-[0_0_auto] bg-[#f1f1f1] rounded-lg border border-solid border-[#ffffff33]">
                                          <div className="mt-[-1.00px] text-[#585858] text-sm leading-6 whitespace-nowrap relative w-fit [font-family:'PP_Telegraf-Regular',Helvetica] font-normal tracking-[0]">
                                             $40
                                          </div>
                                       </div>

                                       <div className="inline-flex items-center justify-center gap-2.5 px-3 py-2.5 relative flex-[0_0_auto] bg-[#f1f1f1] rounded-lg border border-solid border-[#ffffff33]">
                                          <div className="mt-[-1.00px] text-sm leading-6 relative w-fit [font-family:'PP_Telegraf-Regular',Helvetica] font-normal text-[#585858] tracking-[0] whitespace-nowrap">
                                             Other
                                          </div>
                                       </div>
                                    </div>

                                    <div className="flex w-[315px] items-center justify-between px-[15px] py-2 absolute top-[265px] left-2.5 bg-white rounded-lg border border-solid border-[#dddddd]">
                                       <div className="inline-flex flex-col items-start justify-center gap-1.5 relative flex-[0_0_auto]">
                                          <div className="relative w-fit mt-[-1.00px] [font-family:'PP_Telegraf-Regular',Helvetica] font-normal text-[#00000099] text-xs tracking-[0] leading-3 whitespace-nowrap">
                                             Repayment timeline
                                          </div>

                                          <div className="relative w-fit [font-family:'PP_Telegraf-Regular',Helvetica] font-normal text-black text-sm tracking-[0] leading-[14px] whitespace-nowrap">
                                             dd/mm/yy
                                          </div>
                                       </div>

                                       <svg
                                          className="!relative !w-6 !h-6"
                                          fill="none"
                                          height="24"
                                          viewBox="0 0 24 24"
                                          width="24"
                                          xmlns="http://www.w3.org/2000/svg"
                                       >
                                          <path
                                             d="M3.09264 9.40426H20.9166"
                                             stroke="#110000"
                                             strokeLinecap="round"
                                             strokeLinejoin="round"
                                             strokeWidth="1.5"
                                          />

                                          <path
                                             d="M16.4421 13.3097H16.4513"
                                             stroke="#110000"
                                             strokeLinecap="round"
                                             strokeLinejoin="round"
                                             strokeWidth="1.5"
                                          />

                                          <path
                                             d="M12.0046 13.3097H12.0139"
                                             stroke="#110000"
                                             strokeLinecap="round"
                                             strokeLinejoin="round"
                                             strokeWidth="1.5"
                                          />

                                          <path
                                             d="M7.55789 13.3097H7.56716"
                                             stroke="#110000"
                                             strokeLinecap="round"
                                             strokeLinejoin="round"
                                             strokeWidth="1.5"
                                          />

                                          <path
                                             d="M16.4421 17.1962H16.4513"
                                             stroke="#110000"
                                             strokeLinecap="round"
                                             strokeLinejoin="round"
                                             strokeWidth="1.5"
                                          />

                                          <path
                                             d="M12.0046 17.1962H12.0139"
                                             stroke="#110000"
                                             strokeLinecap="round"
                                             strokeLinejoin="round"
                                             strokeWidth="1.5"
                                          />

                                          <path
                                             d="M7.55789 17.1962H7.56716"
                                             stroke="#110000"
                                             strokeLinecap="round"
                                             strokeLinejoin="round"
                                             strokeWidth="1.5"
                                          />

                                          <path
                                             d="M16.0437 2V5.29078"
                                             stroke="#110000"
                                             strokeLinecap="round"
                                             strokeLinejoin="round"
                                             strokeWidth="1.5"
                                          />

                                          <path
                                             d="M7.96551 2V5.29078"
                                             stroke="#110000"
                                             strokeLinecap="round"
                                             strokeLinejoin="round"
                                             strokeWidth="1.5"
                                          />

                                          <path
                                             clipRule="evenodd"
                                             d="M16.2383 3.5792H7.77096C4.83427 3.5792 3 5.21513 3 8.22222V17.2719C3 20.3262 4.83427 22 7.77096 22H16.229C19.175 22 21 20.3546 21 17.3475V8.22222C21.0092 5.21513 19.1842 3.5792 16.2383 3.5792Z"
                                             fillRule="evenodd"
                                             stroke="#110000"
                                             strokeLinecap="round"
                                             strokeLinejoin="round"
                                             strokeWidth="1.5"
                                          />
                                       </svg>
                                    </div>

                                    <button className="all-[unset] box-border flex w-[315px] gap-5 px-5 py-4 absolute top-[469px] left-2.5 bg-[#2154e8] rounded-lg items-center justify-center overflow-hidden">
                                       <div className="relative w-fit text-white text-base leading-4 whitespace-nowrap [font-family:'PP_Telegraf-Regular',Helvetica] font-normal text-center tracking-[0]">
                                          Submit Request
                                       </div>
                                    </button>

                                    <div className="flex w-[200px] h-5 items-center gap-1 px-2 py-0.5 absolute top-20 left-[25px] bg-[#e2f7f5] rounded-lg">
                                       <div className="relative w-4 h-4">
                                          <Image
                                             className="absolute w-[13px] h-[11px] top-[3px] left-px"
                                             alt="Style"
                                             src="https://c.animaapp.com/wawSHnKX/img/style-3.svg"
                                             width={13}
                                             height={11}
                                          />
                                       </div>

                                       <p className="relative w-fit mt-[-6.00px] mb-[-6.00px] [font-family:'Geist',Helvetica] font-medium text-black text-[11.5px] tracking-[0] leading-[30px] whitespace-nowrap">
                                          Your available credit limit: $15
                                       </p>
                                    </div>
                                 </div>
                              </div>

                              <div className="absolute top-[127px] left-12 [font-family:'Geist',Helvetica] font-medium text-black text-xl tracking-[0] leading-[30px] whitespace-nowrap">
                                 Set Your Own Terms
                              </div>
                           </div>
                        </div>

                        {/* Duplicate phone mockup */}
                        <div className="absolute w-[377px] h-[571px] top-0 left-0">
                           <div className="relative w-[375px] h-[571px]">
                              <div className="absolute w-[375px] h-[571px] top-0 left-0 bg-[#ffffff1a] shadow-[0px_4px_4px_#00000040]">
                                 <div className="relative w-[335px] h-[543px] top-3.5 left-5 bg-white rounded-xl overflow-hidden">
                                    <div className="absolute w-[315px] h-[58px] top-2.5 left-2.5 bg-[#f1f1f1] rounded-xl overflow-hidden border border-solid border-[#dddddd]">
                                       <button className="all-[unset] box-border flex w-[157px] h-[46px] gap-5 px-5 py-[18px] absolute top-1.5 left-1.5 bg-[#040033] rounded-lg items-center justify-center overflow-hidden">
                                          <div className="relative w-fit mt-[-2.00px] mb-[-2.00px] text-white text-sm leading-[14px] whitespace-nowrap [font-family:'PP_Telegraf-Regular',Helvetica] font-normal text-center tracking-[0]">
                                             Ask For Help
                                          </div>
                                       </button>

                                       <div className="absolute top-[21px] left-[197px] text-[#00000099] text-sm leading-[14px] whitespace-nowrap [font-family:'PP_Telegraf-Regular',Helvetica] font-normal text-center tracking-[0]">
                                          Offer Help
                                       </div>
                                    </div>

                                    <div className="flex w-[315px] items-center gap-5 px-5 py-[15px] absolute top-[148px] left-2.5 bg-white rounded-lg border border-solid border-[#dddddd]">
                                       <div className="relative w-fit mt-[-1.00px] [font-family:'PP_Telegraf-Regular',Helvetica] font-normal text-[#00000099] text-sm tracking-[0] leading-[18px] whitespace-nowrap">
                                          Enter amount, i.e. $15
                                       </div>
                                    </div>

                                    <div className="flex w-[315px] items-center gap-5 px-5 py-[15px] absolute top-[328px] left-2.5 bg-white rounded-lg border border-solid border-[#dddddd]">
                                       <p className="relative w-fit mt-[-1.00px] [font-family:'PP_Telegraf-Regular',Helvetica] font-normal text-[#00000099] text-sm tracking-[0] leading-[18px] whitespace-nowrap">
                                          Enter amount to repay, i.e. $18
                                       </p>
                                    </div>

                                    <div className="flex w-[315px] items-center gap-5 px-5 py-[15px] absolute top-[391px] left-2.5 bg-white rounded-lg border border-solid border-[#dddddd]">
                                       <p className="relative w-fit mt-[-1.00px] [font-family:'PP_Telegraf-Regular',Helvetica] font-normal text-[#00000099] text-sm tracking-[0] leading-[18px] whitespace-nowrap">
                                          Enter reason i.e. an emergency, etc.
                                       </p>
                                    </div>

                                    <div className="inline-flex items-center gap-1.5 absolute top-[206px] left-2.5">
                                       <div className="inline-flex items-center justify-center gap-2.5 px-3 py-2.5 relative flex-[0_0_auto] bg-[#f1f1f1] rounded-lg border border-solid border-[#ffffff33]">
                                          <div className="mt-[-1.00px] text-[#585858] text-sm leading-6 whitespace-nowrap relative w-fit [font-family:'PP_Telegraf-Regular',Helvetica] font-normal tracking-[0]">
                                             $10
                                          </div>
                                       </div>

                                       <div className="inline-flex items-center justify-center gap-2.5 px-3 py-2.5 relative flex-[0_0_auto] bg-[#f1f1f1] rounded-lg border border-solid border-[#ffffff33]">
                                          <div className="mt-[-1.00px] text-[#585858] text-sm leading-6 whitespace-nowrap relative w-fit [font-family:'PP_Telegraf-Regular',Helvetica] font-normal tracking-[0]">
                                             $15
                                          </div>
                                       </div>

                                       <div className="inline-flex items-center justify-center gap-2.5 px-3 py-2.5 relative flex-[0_0_auto] bg-[#f1f1f1] rounded-lg border border-solid border-[#ffffff33]">
                                          <div className="mt-[-1.00px] text-[#585858] text-sm leading-6 whitespace-nowrap relative w-fit [font-family:'PP_Telegraf-Regular',Helvetica] font-normal tracking-[0]">
                                             $20
                                          </div>
                                       </div>

                                       <div className="inline-flex items-center justify-center gap-2.5 px-3 py-2.5 relative flex-[0_0_auto] bg-[#f1f1f1] rounded-lg border border-solid border-[#ffffff33]">
                                          <div className="mt-[-1.00px] text-[#585858] text-sm leading-6 whitespace-nowrap relative w-fit [font-family:'PP_Telegraf-Regular',Helvetica] font-normal tracking-[0]">
                                             $40
                                          </div>
                                       </div>

                                       <div className="inline-flex items-center justify-center gap-2.5 px-3 py-2.5 relative flex-[0_0_auto] bg-[#f1f1f1] rounded-lg border border-solid border-[#ffffff33]">
                                          <div className="mt-[-1.00px] text-sm leading-6 relative w-fit [font-family:'PP_Telegraf-Regular',Helvetica] font-normal text-[#585858] tracking-[0] whitespace-nowrap">
                                             Other
                                          </div>
                                       </div>
                                    </div>

                                    <div className="flex w-[315px] items-center justify-between px-[15px] py-2 absolute top-[265px] left-2.5 bg-white rounded-lg border border-solid border-[#dddddd]">
                                       <div className="inline-flex flex-col items-start justify-center gap-1.5 relative flex-[0_0_auto]">
                                          <div className="relative w-fit mt-[-1.00px] [font-family:'PP_Telegraf-Regular',Helvetica] font-normal text-[#00000099] text-xs tracking-[0] leading-3 whitespace-nowrap">
                                             Repayment timeline
                                          </div>

                                          <div className="relative w-fit [font-family:'PP_Telegraf-Regular',Helvetica] font-normal text-black text-sm tracking-[0] leading-[14px] whitespace-nowrap">
                                             dd/mm/yy
                                          </div>
                                       </div>

                                       <svg
                                          className="!relative !w-6 !h-6"
                                          fill="none"
                                          height="24"
                                          viewBox="0 0 24 24"
                                          width="24"
                                          xmlns="http://www.w3.org/2000/svg"
                                       >
                                          <path
                                             d="M3.09264 9.40426H20.9166"
                                             stroke="#110000"
                                             strokeLinecap="round"
                                             strokeLinejoin="round"
                                             strokeWidth="1.5"
                                          />

                                          <path
                                             d="M16.4421 13.3097H16.4513"
                                             stroke="#110000"
                                             strokeLinecap="round"
                                             strokeLinejoin="round"
                                             strokeWidth="1.5"
                                          />

                                          <path
                                             d="M12.0046 13.3097H12.0139"
                                             stroke="#110000"
                                             strokeLinecap="round"
                                             strokeLinejoin="round"
                                             strokeWidth="1.5"
                                          />

                                          <path
                                             d="M7.55789 13.3097H7.56716"
                                             stroke="#110000"
                                             strokeLinecap="round"
                                             strokeLinejoin="round"
                                             strokeWidth="1.5"
                                          />

                                          <path
                                             d="M16.4421 17.1962H16.4513"
                                             stroke="#110000"
                                             strokeLinecap="round"
                                             strokeLinejoin="round"
                                             strokeWidth="1.5"
                                          />

                                          <path
                                             d="M12.0046 17.1962H12.0139"
                                             stroke="#110000"
                                             strokeLinecap="round"
                                             strokeLinejoin="round"
                                             strokeWidth="1.5"
                                          />

                                          <path
                                             d="M7.55789 17.1962H7.56716"
                                             stroke="#110000"
                                             strokeLinecap="round"
                                             strokeLinejoin="round"
                                             strokeWidth="1.5"
                                          />

                                          <path
                                             d="M16.0437 2V5.29078"
                                             stroke="#110000"
                                             strokeLinecap="round"
                                             strokeLinejoin="round"
                                             strokeWidth="1.5"
                                          />

                                          <path
                                             d="M7.96551 2V5.29078"
                                             stroke="#110000"
                                             strokeLinecap="round"
                                             strokeLinejoin="round"
                                             strokeWidth="1.5"
                                          />

                                          <path
                                             clipRule="evenodd"
                                             d="M16.2383 3.5792H7.77096C4.83427 3.5792 3 5.21513 3 8.22222V17.2719C3 20.3262 4.83427 22 7.77096 22H16.229C19.175 22 21 20.3546 21 17.3475V8.22222C21.0092 5.21513 19.1842 3.5792 16.2383 3.5792Z"
                                             fillRule="evenodd"
                                             stroke="#110000"
                                             strokeLinecap="round"
                                             strokeLinejoin="round"
                                             strokeWidth="1.5"
                                          />
                                       </svg>
                                    </div>

                                    <button className="all-[unset] box-border flex w-[315px] gap-5 px-5 py-4 absolute top-[469px] left-2.5 bg-[#2154e8] rounded-lg items-center justify-center overflow-hidden">
                                       <div className="relative w-fit text-white text-base leading-4 whitespace-nowrap [font-family:'PP_Telegraf-Regular',Helvetica] font-normal text-center tracking-[0]">
                                          Submit Request
                                       </div>
                                    </button>

                                    <div className="flex w-[200px] h-5 items-center gap-1 px-2 py-0.5 absolute top-20 left-[25px] bg-[#e2f7f5] rounded-lg">
                                       <div className="relative w-4 h-4">
                                          <Image
                                             className="absolute w-[13px] h-[11px] top-[3px] left-px"
                                             alt="Style"
                                             src="https://c.animaapp.com/wawSHnKX/img/style-3.svg"
                                             width={13}
                                             height={11}
                                          />
                                       </div>

                                       <p className="relative w-fit mt-[-6.00px] mb-[-6.00px] [font-family:'Geist',Helvetica] font-medium text-black text-[11.5px] tracking-[0] leading-[30px] whitespace-nowrap">
                                          Your available credit limit: $15
                                       </p>
                                    </div>
                                 </div>
                              </div>

                              <div className="absolute top-[127px] left-12 [font-family:'Geist',Helvetica] font-medium text-black text-xl tracking-[0] leading-[30px] whitespace-nowrap">
                                 Set Your Own Terms
                              </div>
                           </div>
                        </div>

                        <Image
                           className="absolute w-5 h-[18px] top-[131px] left-[247px] object-cover"
                           alt=""
                           src="https://c.animaapp.com/wawSHnKX/img/image-2-1.png"
                           width={100}
                           height={100}
                        />
                     </div>
                  </div>
               </div>

               {/* Visual connecting elements */}
               <div className="absolute w-[136px] h-[109px] top-[182px] left-80">
                  <div className="relative w-[131px] h-[102px] top-[7px] left-[5px]">
                     <Image
                        className="absolute w-[18px] h-[17px] top-0 left-0"
                        alt="Vector"
                        src="https://c.animaapp.com/wawSHnKX/img/vector-1.svg"
                        width={18}
                        height={17}
                     />

                     <div className="absolute w-[120px] h-[94px] top-[7px] left-[11px]">
                        <div className="relative w-[151px] h-0.5 top-[46px] left-[-15px] bg-[#00cc92] rotate-[38.02deg]" />
                     </div>
                  </div>
               </div>

               <div className="absolute w-32 h-[124px] top-[274px] left-[322px] rotate-[-34.76deg]">
                  <div className="relative h-[124px]">
                     <div className="w-[116px] top-[54px] left-[26px] bg-[#6d57ff] rotate-[40.74deg] absolute h-0.5" />

                     <div className="absolute w-[105px] h-[93px] top-0 left-[23px]">
                        <Image
                           className="absolute w-4 h-5 top-[3px] left-1 rotate-[34.76deg]"
                           alt="Vector"
                           src="https://c.animaapp.com/wawSHnKX/img/vector-2.svg"
                           width={16}
                           height={20}
                        />

                        <div className="w-[116px] top-[54px] left-[3px] bg-[#6d57ff] rotate-[40.74deg] absolute h-0.5" />
                     </div>

                     <div className="absolute w-[110px] h-[82px] top-[42px] left-0">
                        <Image
                           className="absolute w-[15px] h-5 top-[3px] left-1 rotate-[34.76deg]"
                           alt="Vector"
                           src="https://c.animaapp.com/wawSHnKX/img/vector-3.svg"
                           width={100}
                           height={100}
                        />

                        <div className="w-[116px] top-12 left-[5px] bg-[#ffdd00] rotate-[35.17deg] absolute h-0.5" />
                     </div>
                  </div>
               </div>

               <div className="absolute w-[157px] h-[61px] top-[396px] left-[302px]">
                  <Image
                     className="absolute w-[33px] h-[33px] top-7 left-0"
                     alt="Group"
                     src="https://c.animaapp.com/wawSHnKX/img/group-26086640@2x.png"
                     width={33}
                     height={33}
                  />

                  <div className="w-[141px] top-[21px] left-[19px] bg-[#48abdd] rotate-[-17.25deg] absolute h-0.5" />
               </div>
            </div>
         </div>
      </div>
   );
}
