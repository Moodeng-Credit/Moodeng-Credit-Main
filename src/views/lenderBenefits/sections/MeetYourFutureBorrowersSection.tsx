import { type JSX } from 'react';



export default function MeetYourFutureBorrowersSection(): JSX.Element {
   return (
      <div className="pr-6 pl-16 bg-emerald-400 rounded-[60px] max-md:px-5 max-md:max-w-full">
         <div className="flex gap-5 max-md:flex-col">
            <div className="flex flex-col w-3/5 max-md:ml-0 max-md:w-full">
               <div className="flex flex-col self-stretch my-auto max-md:mt-10 max-md:max-w-full">
                  <div className="text-5xl leading-tight text-black max-md:max-w-full max-md:text-4xl">MEET YOUR FUTURE BORROWERS</div>
                  <div className="self-start mt-11 text-2xl leading-7 text-zinc-900 max-md:mt-10 max-md:max-w-full">
                     Tech-savvy borrowers from emerging economies seek better alternatives to local lenders.
                  </div>
               </div>
            </div>
            <div className="flex flex-col ml-5 w-2/5 max-md:ml-0 max-md:w-full">
               <img
                  loading="lazy"
                  src="https://cdn.builder.io/api/v1/image/assets/e485b3dc4b924975b4554885e21242bb/45ad5ed76723d8955bf297795913ba4324596fd1ac8fd84eda5f2caba45e53b1?apiKey=e485b3dc4b924975b4554885e21242bb"
                  alt=""
                  className="object-contain self-stretch my-auto w-full aspect-[1.59] max-md:mt-0 max-md:max-w-full"
                  width={525}
                  height={330}
               />
            </div>
         </div>
      </div>
   );
}
