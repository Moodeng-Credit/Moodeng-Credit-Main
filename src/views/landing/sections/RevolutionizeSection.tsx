import { type JSX } from 'react';

import Image from 'next/image';
import { useRouter } from 'next/navigation';

import ActionButton from '@/components/ui/ActionButton';

import { revolutionizeButtons } from '@/config/buttonConfig';

export default function RevolutionizeSection(): JSX.Element {
   const router = useRouter();
   return (
      <div className="relative w-[1440px] h-[1073px] overflow-hidden">
         <div className="relative w-[1236px] h-[997px] top-[100px] left-[102px]">
            <div className="absolute w-[1236px] h-[918px] top-[79px] left-0 overflow-hidden">
               <div className="relative w-[1541px] h-[1044px]">
                  <div className="absolute w-[1541px] h-[1044px] top-0 left-0">
                     <div className="absolute w-[610px] h-[1044px] top-0 left-0">
                        <div className="relative h-[938px] top-[106px] bg-[#111111] rounded-[30px]" />
                     </div>
                     <div className="absolute w-[610px] h-[782px] top-28 left-2">
                        <div className="absolute w-[610px] h-[250px] top-0 left-0 bg-[#57c2ff] rounded-[30px] overflow-hidden">
                           <div className="relative w-[550px] h-[180px] top-10 left-[30px] overflow-hidden">
                              <p className="absolute w-[554px] h-[42px] -top-px left-0 [font-family:'PP_Telegraf-Regular',Helvetica] font-normal text-[#171420] text-[40px] tracking-[0] leading-[42px] whitespace-nowrap">
                                 A New Era of Microloans
                              </p>
                              <p className="absolute w-[552px] h-[117px] top-14 left-0 [font-family:'PP_Telegraf-Regular',Helvetica] font-normal text-[#171420] text-[22.9px] tracking-[0] leading-8">
                                 <span className="font-bold">No hidden fees, no surprises, and no changes. </span>
                                 <span className="[font-family:'PP_Telegraf-Regular',Helvetica] font-normal text-[#171420] text-[22.9px] tracking-[0] leading-8">
                                    Everything is safely tracked on our blockchain, so you always know exactly what you&#39;re paying.
                                 </span>
                              </p>
                           </div>
                        </div>
                        <div className="absolute w-[610px] h-[250px] top-[266px] left-0 bg-[#f093ff] rounded-[30px] overflow-hidden">
                           <div className="relative w-[561px] h-[180px] top-10 left-[30px]">
                              <div className="absolute w-[550px] h-[42px] -top-px left-0 [font-family:'PP_Telegraf-Regular',Helvetica] font-normal text-[#171420] text-[40px] tracking-[0] leading-[42px] whitespace-nowrap">
                                 Next-Level Credit Score
                              </div>
                              <p className="absolute w-[547px] h-[117px] top-14 left-0 [font-family:'PP_Telegraf-Regular',Helvetica] font-normal text-[#171420] text-[22.9px] tracking-[0] leading-8">
                                 <span className="[font-family:'PP_Telegraf-Regular',Helvetica] font-normal text-[#171420] text-[22.9px] tracking-[0] leading-8">
                                    Your privacy matters.{' '}
                                 </span>
                                 <span className="[font-family:'PP_Telegraf-Regular',Helvetica] font-bold text-[#171420] text-[22.9px] tracking-[0] leading-8">
                                    Moodeng never collects your name, contacts, social media, SIM, or photos.
                                 </span>
                                 <span className="[font-family:'PP_Telegraf-Regular',Helvetica] font-normal text-[#171420] text-[22.9px] tracking-[0] leading-8">
                                    {' '}
                                    Your credit is based on repayments, not personal data.
                                 </span>
                              </p>
                           </div>
                        </div>
                        <div className="absolute w-[610px] h-[250px] top-[532px] left-0 bg-[#4de5a6] rounded-[30px] overflow-hidden">
                           <div className="relative w-[550px] h-[180px] top-10 left-[30px]">
                              <div className="absolute w-[509px] h-[42px] -top-px left-0 [font-family:'PP_Telegraf-Regular',Helvetica] font-normal text-[#171420] text-[40px] tracking-[0] leading-[42px]">
                                 Community Lending
                              </div>
                              <p className="absolute w-[523px] h-24 top-[66px] left-0 [font-family:'PP_Telegraf-Regular',Helvetica] font-normal text-[#171420] text-[22.9px] tracking-[0] leading-8">
                                 <span className="[font-family:'PP_Telegraf-Regular',Helvetica] font-bold text-[#171420] text-[22.9px] tracking-[0] leading-8">
                                    Connect with real people, not corporations
                                 </span>
                                 <span className="[font-family:'PP_Telegraf-Regular',Helvetica] font-normal text-[#171420] text-[22.9px] tracking-[0] leading-8">
                                    . Our platform unites ethical{' '}
                                 </span>
                                 <span className="[font-family:'PP_Telegraf-Regular',Helvetica] font-bold text-[#171420] text-[22.9px] tracking-[0] leading-8">
                                    real
                                 </span>
                                 <span className="[font-family:'PP_Telegraf-Regular',Helvetica] font-normal text-[#171420] text-[22.9px] tracking-[0] leading-8">
                                    {' '}
                                    people who want to help, offering fairer terms and a personal touch.
                                 </span>
                              </p>
                           </div>
                        </div>
                     </div>
                     <div className="absolute w-[1236px] h-[37px] top-11 left-[305px] overflow-hidden">
                        <div className="absolute w-[1044px] h-8 -top-px left-0 [font-family:'PP_Telegraf-Regular',Helvetica] font-normal text-[#f6f6f6] text-[40px] tracking-[0] leading-[3rem] whitespace-nowrap">
                           FAIR, TRANSPARENT &amp; EMPOWERED
                        </div>
                        <Image
                           className="absolute w-[50px] h-[37px] top-[4800px] left-[3798px] object-cover"
                           alt="Svg"
                           src="https://c.animaapp.com/VPWnEuWR/img/vector-79@2x.png"
                           width={50}
                           height={37}
                        />
                     </div>
                  </div>
                  <div className="absolute w-[532px] h-[103px] top-[106px] left-[704px]">
                     <div className="relative h-[90px] bg-white rounded-[30px] overflow-hidden">
                        <div className="absolute w-[427px] h-[42px] top-[23px] left-[78px] [font-family:'PP_Telegraf-Regular',Helvetica] font-normal text-[#171420] text-[40px] tracking-[0] leading-[42px] whitespace-nowrap">
                           The Moodeng shortcut
                        </div>
                        <Image
                           className="absolute w-10 h-10 top-[26px] left-6"
                           alt="Svg"
                           src="https://c.animaapp.com/VPWnEuWR/img/svg-1782751338-638.svg"
                           width={40}
                           height={40}
                        />
                     </div>
                  </div>
                  <div className="absolute w-[413px] h-[612px] top-[210px] left-[769px] bg-white rounded-[18px] overflow-hidden border border-solid border-[#dddddd]">
                     <div className="absolute w-[413px] h-[108px] top-0 left-0 border-b [border-bottom-style:solid] border-[#dddddd]">
                        <div className="inline-flex flex-col items-start gap-0.5 relative top-[25px] left-[25px]">
                           <div className="inline-flex items-center gap-1.5 relative flex-[0_0_auto]">
                              <div className="relative w-fit mt-[-1.00px] [font-family:'DM_Sans',Helvetica] font-normal text-black text-xl tracking-[0] leading-[30px] whitespace-nowrap">
                                 FactoryWorker87
                              </div>
                              <div className="relative w-[21.02px] h-[21.02px]">
                                 <div className="relative w-[21px] h-5 bg-[url(https://c.animaapp.com/VPWnEuWR/img/star-4.svg)] bg-[100%_100%]">
                                    <Image
                                       className="absolute w-2 h-[5px] top-2 left-1.5"
                                       alt="Vector"
                                       src="https://c.animaapp.com/VPWnEuWR/img/vector-4-1.svg"
                                       width={100}
                                       height={100}
                                    />
                                 </div>
                              </div>
                           </div>
                           <div className="relative w-fit [font-family:'DM_Sans',Helvetica] font-normal text-[#000000cc] text-base tracking-[0] leading-[26px] whitespace-nowrap">
                              June 13, 2024
                           </div>
                        </div>
                     </div>
                     <p className="absolute w-[363px] top-[132px] left-[25px] [font-family:'Geist-Medium',Helvetica] font-bold text-black text-xl tracking-[0] leading-[30px]">
                        Need gas money to get to clinical rotations this week
                     </p>
                     <div className="inline-flex items-center gap-[7px] absolute top-[213px] left-[25px]">
                        <div className="w-[325px] bg-[#24b054] relative h-2.5 rounded-[100px]" />
                        <div className="w-[31px] bg-[#2154e8] relative h-2.5 rounded-[100px]" />
                     </div>
                     <div className="inline-flex items-center gap-2.5 absolute top-[238px] left-[25px]">
                        <div className="relative w-3 h-3 bg-[#24b054] rounded-md" />
                        <div className="relative w-fit mt-[-1.00px] [font-family:'DM_Sans',Helvetica] font-normal text-[#070707] text-base leading-6 tracking-[0] whitespace-nowrap">
                           Past loans : 30
                        </div>
                     </div>
                     <div className="inline-flex items-center gap-2.5 absolute top-[238px] left-[255px]">
                        <div className="relative w-3 h-3 bg-[#2154e8] rounded-md" />
                        <div className="relative w-fit mt-[-1.00px] [font-family:'DM_Sans',Helvetica] font-normal text-[#070707] text-base leading-6 tracking-[0] whitespace-nowrap">
                           Active loans : 2
                        </div>
                     </div>
                     <div className="absolute w-[46px] h-[46px] top-[541px] left-[25px] rounded-md overflow-hidden border border-solid border-[#dddddd]">
                        <svg
                           className="!absolute !top-[11px] !left-[11px] !w-6 !h-6"
                           fill="none"
                           height="25"
                           viewBox="0 0 24 25"
                           width="24"
                           xmlns="http://www.w3.org/2000/svg"
                        >
                           <path
                              d="M7.24487 15.6067L10.238 11.7166L13.6522 14.3985L16.5813 10.6182"
                              stroke="black"
                              strokeLinecap="round"
                              strokeLinejoin="round"
                              strokeWidth="1.5"
                           />
                           <circle
                              cx="19.9954"
                              cy="5.02547"
                              r="1.9222"
                              stroke="black"
                              strokeLinecap="round"
                              strokeLinejoin="round"
                              strokeWidth="1.5"
                           />
                           <path
                              d="M14.9245 3.94531H7.65679C4.64535 3.94531 2.77808 6.07804 2.77808 9.08948V17.1719C2.77808 20.1833 4.60874 22.3069 7.65679 22.3069H16.2609C19.2724 22.3069 21.1396 20.1833 21.1396 17.1719V10.133"
                              stroke="black"
                              strokeLinecap="round"
                              strokeLinejoin="round"
                              strokeWidth="1.5"
                           />
                        </svg>
                     </div>
                     <div className="absolute w-[413px] h-[106px] top-[410px] left-0 bg-white border-t [border-top-style:solid] border-b [border-bottom-style:solid] border-[#dddddd]">
                        <div className="flex flex-col w-[62px] items-start gap-0.5 absolute top-[25px] left-[25px]">
                           <div className="relative w-fit mt-[-1.00px] [font-family:'DM_Sans',Helvetica] font-normal text-[#07070799] text-base tracking-[0] leading-6 whitespace-nowrap">
                              Amount
                           </div>
                           <div className="relative w-fit [font-family:'DM_Sans',Helvetica] font-medium text-[#070707] text-xl tracking-[0] leading-[30px] whitespace-nowrap">
                              $300
                           </div>
                        </div>
                        <div className="flex flex-col w-[66px] items-start gap-0.5 absolute top-[25px] left-[184px]">
                           <div className="relative w-fit mt-[-1.00px] [font-family:'DM_Sans',Helvetica] font-normal text-[#07070799] text-base tracking-[0] leading-6 whitespace-nowrap">
                              Payback
                           </div>
                           <div className="relative w-fit [font-family:'DM_Sans',Helvetica] font-medium text-[#070707] text-xl tracking-[0] leading-[30px] whitespace-nowrap">
                              $350
                           </div>
                        </div>
                        <div className="inline-flex flex-col items-start gap-0.5 absolute top-[25px] left-[347px]">
                           <div className="relative w-fit mt-[-1.00px] [font-family:'DM_Sans',Helvetica] font-normal text-[#07070799] text-base tracking-[0] leading-6 whitespace-nowrap">
                              Days
                           </div>
                           <div className="relative w-fit [font-family:'DM_Sans',Helvetica] font-medium text-[#070707] text-xl tracking-[0] leading-[30px] whitespace-nowrap">
                              80
                           </div>
                        </div>
                     </div>
                     <button className="all-[unset] box-border flex w-[302px] h-[46px] items-center justify-center gap-5 px-5 py-[18px] absolute top-[544px] left-[87px] bg-[#2154e8] rounded-lg overflow-hidden">
                        <div
                           onClick={() => router.push('/dashboard#request')}
                           className="relative w-fit mt-[-5.50px] mb-[-5.50px] [font-family:'DM_Sans',Helvetica] font-medium text-white text-base text-center tracking-[0] leading-[normal]"
                        >
                           Send Your Help
                        </div>
                     </button>
                     <div className="inline-flex items-center gap-2.5 absolute top-[287px] left-[25px]">
                        <svg
                           className="!relative !w-6 !h-6"
                           fill="none"
                           height="24"
                           viewBox="0 0 24 24"
                           width="24"
                           xmlns="http://www.w3.org/2000/svg"
                        >
                           <path
                              d="M16.4242 5.56204C15.8072 3.78004 14.1142 2.50004 12.1222 2.50004C9.6092 2.49004 7.5632 4.51804 7.5522 7.03104V7.05104V9.19804"
                              stroke="#138332"
                              strokeLinecap="round"
                              strokeLinejoin="round"
                              strokeWidth="1.5"
                           />
                           <path
                              clipRule="evenodd"
                              d="M15.933 21.0004H8.292C6.198 21.0004 4.5 19.3024 4.5 17.2074V12.9194C4.5 10.8244 6.198 9.12644 8.292 9.12644H15.933C18.027 9.12644 19.725 10.8244 19.725 12.9194V17.2074C19.725 19.3024 18.027 21.0004 15.933 21.0004Z"
                              fillRule="evenodd"
                              stroke="#138332"
                              strokeLinecap="round"
                              strokeLinejoin="round"
                              strokeWidth="1.5"
                           />
                           <path
                              d="M12.1127 13.9526V16.1746"
                              stroke="#138332"
                              strokeLinecap="round"
                              strokeLinejoin="round"
                              strokeWidth="1.5"
                           />
                        </svg>
                        <div className="relative w-fit mt-[-1.00px] [font-family:'DM_Sans',Helvetica] font-medium text-[#128331] text-base tracking-[0] leading-6 whitespace-nowrap">
                           $300.00 credit unlocked
                        </div>
                     </div>
                  </div>
               </div>
            </div>
            <div className="absolute w-[1095px] h-[100px] top-0 left-2 bg-[#111111] rounded-[30px] overflow-hidden">
               <p className="absolute w-[909px] h-[42px] top-3 left-[88px] [font-family:'PP_Telegraf-Regular',Helvetica] font-normal text-white text-5xl tracking-[0] leading-[42px] whitespace-nowrap">
                  REVOLUTIONIZE MICROLOANS <br />
                  &amp; REIMAGINE CREDIT
               </p>
               <Image
                  className="absolute w-[57px] h-[75px] top-0 left-[23px]"
                  alt="Emoji light bulb"
                  src="https://c.animaapp.com/VPWnEuWR/img/---emoji--light-bulb-@2x.png"
                  width={57}
                  height={75}
               />
            </div>
            <div className="absolute top-0 left-[927px]">
               {revolutionizeButtons.map((button) => (
                  <ActionButton key={button.text} button={button} />
               ))}
            </div>
         </div>
      </div>
   );
}
