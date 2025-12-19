import { type JSX } from 'react';

import ActionButton from '@/components/ui/ActionButton';

import { heroSectionButtons } from '@/config/buttonConfig';

export default function YourCapitalSection(): JSX.Element {
   return (
      <div className="flex flex-col items-center py-10 mt-20 max-w-full w-[1440px] max-md:mt-10">
         <div className="flex overflow-hidden flex-col items-center px-20 pt-2 w-full max-md:px-5">
            <div className="flex flex-col max-w-full w-[1079px]">
               <div className="self-center text-5xl leading-none text-center text-neutral-100 max-md:max-w-full max-md:text-4xl">
                  Your Capital, Your Way
               </div>
               <div className="flex flex-wrap gap-10 justify-center items-center mt-9 w-full text-2xl leading-none text-violet-100 max-md:max-w-full">
                  <div className="flex gap-2 items-center self-stretch my-auto">
                     <img
                        alt=""
                        loading="lazy"
                        src="https://cdn.builder.io/api/v1/image/assets/e485b3dc4b924975b4554885e21242bb/96d834ff3f92bb0b26442fb209e19b053cb90c843f4b5a4117d2fff2bc4ffd64?apiKey=e485b3dc4b924975b4554885e21242bb"
                        className="object-contain shrink-0 self-stretch my-auto aspect-square w-[30px]"
                        width={100}
                        height={100}
                     />
                     <div className="self-stretch my-auto">Grow score</div>
                  </div>
                  <div className="flex gap-2 items-start self-stretch my-auto">
                     <img
                        alt=""
                        loading="lazy"
                        src="https://cdn.builder.io/api/v1/image/assets/e485b3dc4b924975b4554885e21242bb/7b26bb85bf15a72309eea69087f84da8b1b15c7a90e6ac7c23a70ddda7a885b2?apiKey=e485b3dc4b924975b4554885e21242bb"
                        className="object-contain shrink-0 aspect-square w-[30px]"
                        width={100}
                        height={100}
                     />
                     <div className="">Best rates</div>
                  </div>
                  <div className="flex gap-2 items-center self-stretch my-auto">
                     <img
                        alt=""
                        loading="lazy"
                        src="https://cdn.builder.io/api/v1/image/assets/e485b3dc4b924975b4554885e21242bb/a9c48537a3495505eeb9929006324f5dbdb1ec42b7ce8b51129ca1ab7464525f?apiKey=e485b3dc4b924975b4554885e21242bb"
                        className="object-contain shrink-0 self-stretch my-auto aspect-square w-[30px]"
                        width={100}
                        height={100}
                     />
                     <div className="self-stretch my-auto">Data safe</div>
                  </div>
               </div>
            </div>
         </div>
         <div className="flex flex-wrap gap-3 items-center pr-9 pl-9 mt-20 max-w-full text-2xl leading-none text-center whitespace-nowrap text-zinc-900 w-[878px] max-md:px-5 max-md:mt-10">
            <img
               className="w-[46px] h-[46px]"
               alt="Background"
               src="https://c.animaapp.com/VPWnEuWR/img/background.svg"
               width={46}
               height={46}
            />
            {heroSectionButtons.map((button) => (
               <ActionButton key={button.text} button={button} />
            ))}
         </div>
      </div>
   );
}
