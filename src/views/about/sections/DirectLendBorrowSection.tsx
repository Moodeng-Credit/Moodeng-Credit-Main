import { type JSX } from 'react';

import Image from 'next/image';

export default function DirectLendBorrowSection(): JSX.Element {
   return (
      <div className="flex flex-col px-20 pt-6 pb-24 mt-20 max-w-full w-[1264px] max-md:px-5 max-md:mt-10">
         <div className="flex flex-col max-md:max-w-full">
            <div className="self-center text-4xl text-center text-white max-md:max-w-full">How Direct Lend & Borrow Works</div>
            <div className="mt-28 max-md:mt-10 max-md:max-w-full">
               <div className="flex gap-5 max-md:flex-col">
                  <div className="flex flex-col w-[22%] max-md:ml-0 max-md:w-full">
                     <div className="flex relative flex-col px-11 py-24 mt-7 text-3xl text-center text-white whitespace-nowrap aspect-square max-md:px-5 max-md:mt-10">
                        <Image
                           alt=""
                           loading="lazy"
                           src="https://cdn.builder.io/api/v1/image/assets/e485b3dc4b924975b4554885e21242bb/9cb588d4fc7188a686c4abc0cbcc8130312b79f2fc02bc61cd27599696614c3f?apiKey=e485b3dc4b924975b4554885e21242bb"
                           className="object-contain absolute inset-0 size-full"
                           width={100}
                           height={100}
                        />
                        <p className="sticky">Borrower</p>
                     </div>
                  </div>
                  <div className="flex flex-col ml-5 w-[56%] max-md:ml-0 max-md:w-full">
                     <div className="flex flex-col items-center w-full text-2xl text-center text-white max-md:mt-2.5 max-md:max-w-full">
                        <div>Funds in USDT/USDC</div>
                        <svg
                           className="self-stretch mt-3.5 w-full aspect-[8.4] max-md:max-w-full"
                           width="574"
                           height="73"
                           viewBox="0 0 574 73"
                           fill="none"
                           xmlns="http://www.w3.org/2000/svg"
                        >
                           <path d="M3.6001 66.4C193.2 -17.8667 382.8 -17.8667 572.4 66.4" stroke="#4169E1" strokeWidth="4.74" />
                           <path
                              fillRule="evenodd"
                              clipRule="evenodd"
                              d="M2.70036 69.8047L25.5954 72.5589L27.8971 67.2744L7.86342 64.8644L15.921 46.3649L10.1982 45.6764L0.989826 66.8182C0.684731 67.519 0.693536 68.2273 1.01431 68.7873C1.33508 69.3474 1.94155 69.7133 2.70036 69.8047Z"
                              fill="#4169E1"
                           />
                        </svg>
                        <svg
                           className="self-stretch mt-14 w-full aspect-[8.4] max-md:mt-10 max-md:max-w-full"
                           width="573"
                           height="73"
                           viewBox="0 0 573 73"
                           fill="none"
                           xmlns="http://www.w3.org/2000/svg"
                        >
                           <path d="M570.4 6.60001C380.8 90.8667 191.2 90.8667 1.6001 6.60001" stroke="#4169E1" strokeWidth="4.74" />
                           <path
                              fillRule="evenodd"
                              clipRule="evenodd"
                              d="M570.46 4.787L547.891 0.0534644L545.138 5.11795L564.887 9.25989L555.252 26.9892L560.893 28.1723L571.904 7.91083C572.269 7.23924 572.322 6.53288 572.051 5.94707C571.78 5.36127 571.208 4.94399 570.46 4.787Z"
                              fill="#4169E1"
                           />
                        </svg>
                        <div className="mt-2">Repayment + Interest</div>
                        <div className="flex overflow-hidden gap-2.5 justify-center items-center px-7 py-2.5 mt-3.5 bg-amber-500 rounded-[555px] max-md:px-5">
                           <div className="self-stretch my-auto">Credit Score Improves</div>
                           <Image
                              alt=""
                              loading="lazy"
                              src="https://cdn.builder.io/api/v1/image/assets/e485b3dc4b924975b4554885e21242bb/74468dc87694573da910810782b85ae001cabf498799ed50cd246f13a7556916?apiKey=e485b3dc4b924975b4554885e21242bb"
                              className="object-contain shrink-0 self-stretch my-auto aspect-[0.56] w-[27px]"
                              width={100}
                              height={100}
                           />
                        </div>
                     </div>
                  </div>
                  <div className="flex flex-col ml-5 w-[22%] max-md:ml-0 max-md:w-full">
                     <div className="flex relative flex-col px-16 py-24 mt-7 text-3xl text-center text-white whitespace-nowrap aspect-square max-md:px-5 max-md:mt-10">
                        <Image
                           alt=""
                           loading="lazy"
                           src="https://cdn.builder.io/api/v1/image/assets/e485b3dc4b924975b4554885e21242bb/9eca2ffd3b5bc37a22e620f26b1e785938b01c7cf0219c0a27edbc3f71a8a5ff?apiKey=e485b3dc4b924975b4554885e21242bb"
                           className="object-contain absolute inset-0 size-full"
                           width={100}
                           height={100}
                        />
                        <p className="sticky">Lender</p>
                     </div>
                  </div>
               </div>
            </div>
         </div>
      </div>
   );
}
