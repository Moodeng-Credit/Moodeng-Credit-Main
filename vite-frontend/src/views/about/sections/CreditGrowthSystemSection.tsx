import { type JSX } from 'react';


import { Link } from 'react-router-dom';

import ActionButton from '@/components/ui/ActionButton';

import { creditSystemButtons } from '@/config/buttonConfig';

export default function CreditGrowthSystemSection(): JSX.Element {
   return (
      <div
         id="system"
         className="flex overflow-hidden flex-col px-24 py-16 mt-20 max-w-full bg-blend-normal bg-neutral-100 rounded-[60px] w-[1425px] max-md:px-5 max-md:mt-10"
      >
         <div className="flex overflow-hidden flex-wrap gap-2.5 items-start w-full text-4xl leading-none bg-blend-normal min-h-[37px] text-zinc-900">
            <div className="overflow-hidden grow shrink bg-blend-normal min-w-[240px] w-[1151px] max-md:max-w-full">
               CREDIT GROWTH SYSTEM
            </div>
            <img
               alt=""
               loading="lazy"
               src="https://cdn.builder.io/api/v1/image/assets/e485b3dc4b924975b4554885e21242bb/51641852f20ced6f518211c7293b22bb9a9b24e39937ccccd134e24b29cfc7bb?apiKey=e485b3dc4b924975b4554885e21242bb"
               className="object-contain shrink-0 bg-blend-normal aspect-[1.35] w-[50px]"
               width={100}
               height={100}
            />
         </div>
         <div className="flex overflow-hidden flex-col items-center px-20 mt-16 w-full bg-blend-normal max-md:px-5 max-md:mt-10">
            <div className="flex flex-col justify-center items-center max-w-full w-[900px]">
               <div className="flex flex-col justify-center self-stretch w-full max-md:max-w-full">
                  <div className="flex flex-col justify-center self-center w-full text-center text-black">
                     <div className="text-4xl font-extrabold leading-none max-md:max-w-full">
                        Grow Your Credit Limit Through Step Borrowing
                     </div>
                     <div className="mt-3 text-2xl leading-8 max-md:max-w-full">
                        At <span className="font-black">Moodeng</span>, we reward responsible borrowing by increasing your credit limit with
                        successful repayments.
                     </div>
                  </div>
                  <div className="flex flex-col p-5 mt-8 w-full bg-white rounded-xl border border-indigo-700 border-solid max-md:max-w-full">
                     <div className="pr-16 pb-px pl-16 text-2xl font-extrabold text-center text-indigo-700 max-md:px-5 max-md:max-w-full">
                        Your Credit Limit Grows with Every $20 You Borrow and Repay!
                     </div>
                     <div className="px-20 pb-px mt-4 text-base text-center text-indigo-700 max-md:px-5 max-md:max-w-full">
                        The more you borrow and repay, the more you can borrow in the future.
                     </div>
                     <div className="flex relative justify-between items-start mt-10 max-md:max-w-full">
                        <div className="flex absolute inset-x-0 top-3 z-0 shrink-0 h-0.5 bg-white min-w-[240px] w-[860px] max-md:max-w-full">
                           <svg width="869" height="19" viewBox="0 0 869 19" fill="none" xmlns="http://www.w3.org/2000/svg">
                              <rect x="0.5" y="9" width="860" height="2" fill="#3F51B5" />
                              <path d="M859.5 0L868.833 9.33333L859.5 18.6667" fill="#3F51B5" />
                           </svg>
                        </div>
                        <div className="flex z-0 flex-col flex-1 shrink items-center text-center text-indigo-700 whitespace-nowrap basis-0">
                           <div className="flex flex-col pb-2.5 w-10 text-base text-white min-h-[50px]">
                              <div className="self-stretch px-4 pt-2 w-full h-10 bg-indigo-700 rounded-3xl min-h-[40px]">1</div>
                           </div>
                           <div className="pb-px text-xl">$15</div>
                           <div className="text-sm">Start</div>
                        </div>
                        <div className="flex z-0 flex-col flex-1 shrink items-center text-center text-indigo-700 basis-0">
                           <div className="flex flex-col pb-2.5 w-10 text-base text-white whitespace-nowrap min-h-[50px]">
                              <div className="self-stretch px-4 pt-2 w-full h-10 bg-indigo-700 rounded-3xl min-h-[40px]">2</div>
                           </div>
                           <div className="pb-px text-xl whitespace-nowrap">$20</div>
                           <div className="text-sm">Connect</div>
                           <div className="flex flex-col pt-1.5 text-sm">
                              <div>Borrow + Repay Original $20 to unlock $40</div>
                           </div>
                        </div>
                        <div className="flex z-0 flex-col flex-1 shrink items-center px-1 basis-0">
                           <div className="flex flex-col pb-2.5 w-10 text-base text-center text-white whitespace-nowrap min-h-[50px]">
                              <div className="self-stretch px-4 pt-2 w-full h-10 bg-indigo-700 rounded-3xl min-h-[40px]">3</div>
                           </div>
                           <div className="pb-px text-xl text-center text-indigo-700 whitespace-nowrap">$40</div>
                           <div className="text-sm text-center text-indigo-700">Grow</div>
                           <div className="flex flex-col items-start pt-1.5">
                              <div className="flex min-h-[17px]" />
                           </div>
                        </div>
                        <div className="flex z-0 flex-col flex-1 shrink items-center px-0.5 basis-0">
                           <div className="flex flex-col pb-2.5 w-10 text-base text-center text-white whitespace-nowrap min-h-[50px]">
                              <div className="self-stretch px-4 pt-2 w-full h-10 bg-indigo-700 rounded-3xl min-h-[40px]">4</div>
                           </div>
                           <div className="pb-px text-xl text-center text-indigo-700 whitespace-nowrap">$60</div>
                           <div className="text-sm text-center text-indigo-700">Build</div>
                           <div className="flex flex-col pt-1.5">
                              <div className="flex min-h-[17px]" />
                           </div>
                        </div>
                        <div className="flex z-0 flex-col flex-1 shrink items-center px-1 basis-0">
                           <div className="flex flex-col pb-2.5 w-10 text-base text-center text-white whitespace-nowrap min-h-[50px]">
                              <div className="self-stretch px-4 pt-2 w-full h-10 bg-indigo-700 rounded-3xl min-h-[40px]">5</div>
                           </div>
                           <div className="pb-px text-xl text-center text-indigo-700 whitespace-nowrap">$80</div>
                           <div className="text-sm text-center text-indigo-700">Expand</div>
                           <div className="flex flex-col items-start pt-1.5">
                              <div className="flex min-h-[17px]" />
                           </div>
                        </div>
                        <div className="flex z-0 flex-col flex-1 shrink items-center basis-0">
                           <div className="flex flex-col pb-2.5 w-10 text-base text-center text-white whitespace-nowrap min-h-[50px]">
                              <div className="self-stretch px-4 pt-2 w-full h-10 bg-indigo-700 rounded-3xl min-h-[40px]">6</div>
                           </div>
                           <div className="pb-px text-xl text-center text-indigo-700 whitespace-nowrap">$100</div>
                           <div className="text-sm text-center text-indigo-700">Unlock</div>
                           <div className="flex flex-col items-start pt-1.5">
                              <div className="flex min-h-[17px]" />
                           </div>
                        </div>
                        <div className="flex z-0 flex-col flex-1 shrink items-center text-center text-indigo-700 basis-0">
                           <div className="flex flex-col pb-2.5 w-10 text-base text-white whitespace-nowrap min-h-[50px]">
                              <div className="self-stretch px-4 pt-2 w-full h-10 bg-indigo-700 rounded-3xl min-h-[40px]">7</div>
                           </div>
                           <div className="pb-px text-xl whitespace-nowrap">$120+</div>
                           <div className="text-sm">Ongoing Growth</div>
                           <div className="flex flex-col pt-1.5 text-sm">
                              <div className="px-4">Keep going forever and grow!</div>
                           </div>
                        </div>
                     </div>
                  </div>
               </div>
               <div className="flex flex-col justify-center mt-8 w-full max-w-[902px] max-md:max-w-full">
                  <div className="flex flex-wrap gap-10 justify-center items-start w-full max-md:max-w-full">
                     <div className="flex flex-col grow shrink min-w-[240px] w-[370px] max-md:max-w-full">
                        <div className="text-3xl leading-none text-neutral-900">Build Your Credit, Step by Step</div>
                        <div className="mt-3.5 text-xs tracking-normal leading-loose text-black text-opacity-80 max-md:max-w-full">
                           Unlock Your Financial Potential with Moodeng's Unique Borrowing System
                        </div>
                     </div>
                     <div className="flex gap-3.5 justify-center items-center text-2xl leading-none text-center whitespace-nowrap min-w-[240px]">
                        {creditSystemButtons.length > 0 ? (
                           creditSystemButtons.map((button) => <ActionButton key={button.text} button={button} />)
                        ) : (
                           <>
                              <div className="overflow-hidden self-stretch px-14 py-6 my-auto bg-indigo-500 rounded-[114px] text-neutral-100 w-[194px] max-md:px-5">
                                 <Link to="/dashboard#request">Borrow</Link>
                              </div>
                              <div className="overflow-hidden self-stretch px-16 py-6 my-auto bg-emerald-400 rounded-[114px] text-zinc-900 w-[182px] max-md:px-5">
                                 <Link to="/dashboard#request">Lend</Link>
                              </div>
                           </>
                        )}
                     </div>
                  </div>
                  <div className="flex flex-wrap gap-5 justify-center items-center mt-6 w-full max-md:max-w-full">
                     <div className="flex overflow-hidden flex-col grow shrink items-start self-stretch px-5 py-7 my-auto bg-white rounded-2xl min-w-[240px] w-[230px] max-md:px-5">
                        <img
                           alt=""
                           loading="lazy"
                           src="https://cdn.builder.io/api/v1/image/assets/e485b3dc4b924975b4554885e21242bb/b725d82d60bc3b6ec342f9ece31e0aeba8ce29f39d86430b0a7ded9aae48884b?apiKey=e485b3dc4b924975b4554885e21242bb"
                           className="object-contain aspect-[0.99] rounded-[3951px] w-[66px]"
                           width={66}
                           height={67}
                        />
                        <div className="mt-3 text-base leading-6 text-neutral-900">If I borrow $35 instead of $40 can I unlock $60? </div>
                        <div className="self-stretch mt-4 text-sm leading-5 text-zinc-500">
                           Borrowing under $40 won't unlock $60 - it shows you are not ready. But, you can borrow smaller amounts to prove
                           yourself.
                        </div>
                     </div>
                     <div className="flex overflow-hidden flex-col grow shrink self-stretch px-5 py-7 my-auto bg-white rounded-2xl min-w-[240px] w-[230px] max-md:px-5">
                        <div className="flex flex-col justify-center items-center px-3.5 bg-fuchsia-300 rounded-full h-[67px] w-[67px]">
                           <img
                              alt=""
                              loading="lazy"
                              src="https://cdn.builder.io/api/v1/image/assets/e485b3dc4b924975b4554885e21242bb/80d4256ca7d208d1577d4349fc643c094b08f40fd36b27afa832e2c8cc55505e?apiKey=e485b3dc4b924975b4554885e21242bb"
                              className="object-contain w-full aspect-[0.79]"
                              width={67}
                              height={53}
                           />
                        </div>
                        <div className="mt-3 text-base leading-6 text-neutral-900">
                           Does borrowing or repaying more unlock the next level??
                        </div>
                        <div className="mt-4 text-sm leading-5 text-zinc-500">
                           The only thing relevant to unlocking the next level is the amount you borrowed. Not the amount you repaid.
                        </div>
                     </div>
                     <div className="flex overflow-hidden flex-col grow shrink items-start self-stretch px-5 pt-7 pb-12 my-auto bg-white rounded-2xl min-w-[240px] w-[230px] max-md:px-5">
                        <div className="flex flex-col justify-center items-center px-2.5 bg-emerald-400 rounded-full h-[67px] w-[67px]">
                           <img
                              alt=""
                              loading="lazy"
                              src="https://cdn.builder.io/api/v1/image/assets/e485b3dc4b924975b4554885e21242bb/88425fd4c9dfda3ebc14876b9d41413a45340d35ac6dc6ad7ce5449f1056c6a5?apiKey=e485b3dc4b924975b4554885e21242bb"
                              className="object-contain w-full aspect-[0.89]"
                              width={67}
                              height={60}
                           />
                        </div>
                        <div className="mt-3 text-base leading-6 text-neutral-900 w-[245px]">
                           Can I skip a level by borrowing more than required?
                        </div>
                        <div className="self-stretch mt-4 text-sm leading-5 text-zinc-500">
                           No, each level must be unlocked step-by-step with consistent borrowing.
                        </div>
                     </div>
                  </div>
               </div>
               <div className="mt-8 max-w-full rounded-3xl w-[805px]">
                  <div className="flex gap-5 max-md:flex-col">
                     <div className="flex flex-col w-[74%] max-md:ml-0 max-md:w-full">
                        <div className="mt-9 text-2xl leading-8 text-black max-md:mt-10 max-md:max-w-full">
                           <span className="font-extrabold">Why Our Cumulative System Benefits You</span>
                           <br />
                           <br />
                           <ul className="list-disc ml-[5%]">
                              <li>Flexibility to take multiple smaller loans</li>
                              <li>Build credit at your own pace</li>
                              <li>Reward for consistent borrowing and repayment</li>
                              <li>Clear path to accessing larger loan amounts</li>
                           </ul>
                        </div>
                     </div>
                     <div className="flex flex-col ml-5 w-[26%] max-md:ml-0 max-md:w-full">
                        <img
                           alt=""
                           loading="lazy"
                           src="https://cdn.builder.io/api/v1/image/assets/e485b3dc4b924975b4554885e21242bb/73519d7687e7177605b4f32f0fab51d5e296870c8bddcbe9deb1d6bba48e23aa?apiKey=e485b3dc4b924975b4554885e21242bb"
                           className="object-contain grow shrink-0 max-w-full rounded-3xl aspect-[0.94] w-[200px] max-md:mt-10"
                           width={200}
                           height={213}
                        />
                     </div>
                  </div>
               </div>
            </div>
         </div>
      </div>
   );
}
