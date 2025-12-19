import { type JSX } from 'react';

import ActionButton from '@/components/ui/ActionButton';

import { heroSectionButtons } from '@/config/buttonConfig';

export default function StartBuildingCreditSection(): JSX.Element {
   const buttons = heroSectionButtons.slice(0, 2);
   return (
      <div className="flex overflow-hidden flex-col items-center px-20 pb-16 mt-20 max-w-full w-[1440px] max-md:px-5 max-md:mt-10">
         <div className="flex flex-col items-center max-w-full w-[1056px]">
            <img
               alt=""
               loading="lazy"
               src="https://cdn.builder.io/api/v1/image/assets/e485b3dc4b924975b4554885e21242bb/63818c0d2e2c11f8d3d69636d4fb34a5c246fd06e7e66b3cd3116ca7901b3ba5?apiKey=e485b3dc4b924975b4554885e21242bb"
               className="object-contain z-10 max-w-full aspect-[0.87] w-[138px]"
               width={138}
               height={120}
            />
            <div className="mt-0 ml-3 text-5xl leading-none text-center text-neutral-100 max-md:max-w-full max-md:text-4xl">
               START BUILDING CREDIT
            </div>
            <div className="mt-4 text-5xl leading-none text-center text-neutral-100 max-md:max-w-full max-md:text-4xl">WITH MICROLOANS</div>
            <div className="flex flex-wrap gap-5 justify-between items-start self-stretch mt-10 w-full text-violet-100 max-md:mt-10 max-md:max-w-full">
               <div className="flex flex-col">
                  <div className="flex gap-2.5 text-2xl leading-none">
                     <img
                        alt=""
                        loading="lazy"
                        src="https://cdn.builder.io/api/v1/image/assets/e485b3dc4b924975b4554885e21242bb/fb0a54689529c92feb9f23e7cec346c010963c77da9fe1c12675fbe0bc91d8dc?apiKey=e485b3dc4b924975b4554885e21242bb"
                        className="object-contain shrink-0 aspect-square w-[27px]"
                        width={100}
                        height={100}
                     />
                     <div className="grow shrink my-auto w-full">Small Loans</div>
                  </div>
                  <div className="self-start mt-2 ml-9 text-sm leading-none max-md:ml-2.5">Start</div>
               </div>
               <div className="flex flex-col">
                  <div className="flex gap-2 text-2xl leading-none">
                     <img
                        alt=""
                        loading="lazy"
                        src="https://cdn.builder.io/api/v1/image/assets/e485b3dc4b924975b4554885e21242bb/464d7c692f5705b7d3eaf8f170b12897ccc91a586d121e3dcec1e8498d0a8405?apiKey=e485b3dc4b924975b4554885e21242bb"
                        className="object-contain shrink-0 aspect-square w-[27px]"
                        width={100}
                        height={100}
                     />
                     <div className="grow shrink my-auto w-full">Gradual Growth</div>
                  </div>
                  <div className="self-start mt-2 ml-9 text-sm leading-none max-md:ml-2.5">Build</div>
               </div>
               <div className="flex flex-col">
                  <div className="flex gap-2.5 text-2xl leading-none">
                     <img
                        alt=""
                        loading="lazy"
                        src="https://cdn.builder.io/api/v1/image/assets/e485b3dc4b924975b4554885e21242bb/fb0a54689529c92feb9f23e7cec346c010963c77da9fe1c12675fbe0bc91d8dc?apiKey=e485b3dc4b924975b4554885e21242bb"
                        className="object-contain shrink-0 aspect-square w-[27px]"
                        width={100}
                        height={100}
                     />
                     <div className="grow shrink my-auto w-full">No Deposit</div>
                  </div>
                  <div className="self-start mt-2 ml-9 text-sm leading-none max-md:ml-2.5">Enable</div>
               </div>
               <div className="flex flex-col">
                  <div className="flex gap-2.5 text-2xl leading-none">
                     <img
                        alt=""
                        loading="lazy"
                        src="https://cdn.builder.io/api/v1/image/assets/e485b3dc4b924975b4554885e21242bb/fb0a54689529c92feb9f23e7cec346c010963c77da9fe1c12675fbe0bc91d8dc?apiKey=e485b3dc4b924975b4554885e21242bb"
                        className="object-contain shrink-0 aspect-square w-[27px]"
                        width={100}
                        height={100}
                     />
                     <div className="grow shrink my-auto w-full">No Collateral</div>
                  </div>
                  <div className="self-start mt-2 ml-9 text-sm leading-none max-md:ml-2.5">Trust</div>
               </div>
               <div className="flex flex-col">
                  <div className="flex gap-2.5 text-2xl leading-none">
                     <img
                        alt=""
                        loading="lazy"
                        src="https://cdn.builder.io/api/v1/image/assets/e485b3dc4b924975b4554885e21242bb/fb0a54689529c92feb9f23e7cec346c010963c77da9fe1c12675fbe0bc91d8dc?apiKey=e485b3dc4b924975b4554885e21242bb"
                        className="object-contain shrink-0 aspect-square w-[27px]"
                        width={100}
                        height={100}
                     />
                     <div className="grow shrink my-auto w-full">Trust Building</div>
                  </div>
                  <div className="self-start mt-2 ml-9 text-sm leading-none max-md:ml-2.5">Grow</div>
               </div>
            </div>
            <div className="flex gap-3 items-center mt-10 max-w-full text-2xl leading-none text-center whitespace-nowrap w-[398px]">
               <img
                  className="w-[46px] h-[46px]"
                  alt="Background"
                  src="https://c.animaapp.com/VPWnEuWR/img/background.svg"
                  width={46}
                  height={46}
               />
               {buttons.map((button) => (
                  <ActionButton key={button.text} button={button} />
               ))}
            </div>
         </div>
      </div>
   );
}
