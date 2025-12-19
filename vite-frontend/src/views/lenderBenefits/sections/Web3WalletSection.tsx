import { type JSX } from 'react';



import Bsvg from '@/views/lenderBenefits/config/Bsvg';

export default function Web3WalletSection(): JSX.Element {
   return (
      <div className="flex z-0 flex-col mt-4 w-full rounded-2xl max-w-[1064px] max-md:max-w-full">
         <div className="px-10 pt-4 pb-8 rounded-2xl bg-stone-100 shadow-[0px_60px_160px_rgba(0,0,0,0.05)] max-md:px-5 max-md:max-w-full">
            <div className="flex gap-5 max-md:flex-col">
               <Bsvg />
               <div className="flex flex-col w-[66%] max-md:ml-0 max-md:w-full">
                  <div className="flex flex-col mt-4 w-full max-md:mt-8 max-md:max-w-full">
                     <div className="self-start text-5xl font-bold tracking-tighter text-neutral-900 max-md:max-w-full max-md:text-4xl mr-[-50px]">
                        Web3 Wallet-Based Credit Scores: Powered by Microloans
                     </div>
                     <div className="flex gap-5 justify-between items-center mt-6">
                        <div className="flex flex-col items-start self-stretch pb-4 w-[60%]">
                           <div className="self-stretch flex flex-col gap-4 text-lg font-medium tracking-tight leading-6 text-stone-600">
                              <p>This way, borrower is credit travels anywhere, in a smartphone.</p>
                              <p>Transparent, blockchain-based credit history.</p>
                              <p>Microloan system to help people build credit from the ground up.</p>
                           </div>
                           <div className="flex z-10 gap-1 items-end mt-3 text-xl font-semibold text-center text-black">
                              <img
                                 loading="lazy"
                                 src="https://cdn.builder.io/api/v1/image/assets/e485b3dc4b924975b4554885e21242bb/bb78f5953512a02e5ea863cfdb833e99428413a656289baf88ecadb54194f7f7?apiKey=e485b3dc4b924975b4554885e21242bb"
                                 alt=""
                                 className="object-contain shrink-0 aspect-[0.76] w-[47px]"
                                 width={100}
                                 height={62}
                              />
                              <div>Our Solution</div>
                           </div>
                           <img
                              loading="lazy"
                              src="https://cdn.builder.io/api/v1/image/assets/e485b3dc4b924975b4554885e21242bb/4df40bbe0988056f440073a4efab81c3a8ec59dc498fb2cbe86f40a9d5432c46?apiKey=e485b3dc4b924975b4554885e21242bbwidth=1000"
                              alt=""
                              className="object-contain mt-0 ml-2 w-px aspect-square max-md:ml-2.5"
                              width={400}
                              height={400}
                              quality={100}
                           />
                        </div>
                     </div>
                  </div>
               </div>
               <div className="flex flex-col ml-5 w-[34%] max-md:ml-0 max-md:w-full">
                  <div className="flex flex-col w-full max-md:mt-4">
                     <div className="flex gap-3">
                        <img
                           loading="lazy"
                           src="https://cdn.builder.io/api/v1/image/assets/e485b3dc4b924975b4554885e21242bb/99fc5ff0e4c5c7d1a71a15472e04cefca458634b10b9ab5baab8fd45692d9e8d?apiKey=e485b3dc4b924975b4554885e21242bb"
                           alt=""
                           className="object-cover grow shrink-0 aspect-[1] basis-0 w-fit"
                           width={321}
                           height={321}
                        />
                     </div>
                  </div>
               </div>
            </div>
         </div>
      </div>
   );
}
