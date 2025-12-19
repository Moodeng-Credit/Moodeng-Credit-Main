import { type JSX } from 'react';



export default function HowWeVerifySection(): JSX.Element {
   return (
      <div className="flex flex-col justify-center px-56 py-6 mt-20 max-w-full bg-emerald-500 rounded-[60px] w-[1440px] max-md:px-5 max-md:mt-10">
         <div className="flex flex-col w-full">
            <div className="flex flex-col items-center max-md:max-w-full">
               <div className="self-stretch text-4xl font-extrabold text-center text-black max-md:max-w-full">
                  How do we VERIFY YOUR future BORROWERS?
               </div>
               <div className="flex flex-col px-3 pt-10 mt-6 max-w-full text-3xl leading-9 text-center text-zinc-900 w-[950px]">
                  <div className="mt-0 max-md:max-w-full">
                     <span className="font-extrabold">Three verifications</span> including facial scans are{' '}
                     <span className="font-extrabold">required</span> <span className="font-extrabold">to submit a borrow request.</span>{' '}
                     Once approved, borrowers receive an{' '}
                     <img
                        alt=""
                        loading="lazy"
                        src="https://cdn.builder.io/api/v1/image/assets/e485b3dc4b924975b4554885e21242bb/25d9bece50ac40c1477fd7f2dbe5338c31b2da7a1edde19f6df817b7b9850cdb?apiKey=e485b3dc4b924975b4554885e21242bb"
                        className="inline z-10"
                        width={100}
                        height={75}
                     />{' '}
                     icon. <br />
                     Lenders do not require verification.
                  </div>
               </div>
               <div className="flex flex-col mt-6 max-w-full rounded-none w-[800px]">
                  <div className="flex gap-8 px-10 py-3 bg-black rounded-[29px] max-md:px-5">
                     <div className="flex gap-3 my-auto text-2xl font-medium leading-none text-white">
                        <img
                           alt=""
                           loading="lazy"
                           src="https://cdn.builder.io/api/v1/image/assets/e485b3dc4b924975b4554885e21242bb/f1ec9eb29a26aa8b2d02553889a1954d8c6b01a49c316e8341bcf61ea3f81a3e?apiKey=e485b3dc4b924975b4554885e21242bb"
                           className="object-contain shrink-0 aspect-[1.15] w-[30px]"
                           width={30}
                           height={26}
                        />
                        <div className="basis-auto">Secured by</div>
                     </div>
                     <div className="flex flex-auto gap-10 text-base leading-6 text-white text-opacity-80">
                        <img
                           alt=""
                           loading="lazy"
                           src="https://cdn.builder.io/api/v1/image/assets/e485b3dc4b924975b4554885e21242bb/4660c606b5d407fa6beff6ebeb02b5adf76370d1c53a302ea479ebd879c2e374?apiKey=e485b3dc4b924975b4554885e21242bb"
                           className="object-contain shrink-0 max-w-full aspect-[3.08] w-[169px]"
                           width={100}
                           height={55}
                        />
                        <div className="my-auto">trust, control and safety for digital identity</div>
                     </div>
                  </div>
               </div>
            </div>
         </div>
      </div>
   );
}
