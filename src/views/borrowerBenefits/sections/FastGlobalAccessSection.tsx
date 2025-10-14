import { type JSX } from 'react';

import Image from 'next/image';

export default function FastGlobalAccessSection(): JSX.Element {
   return (
      <div className="flex flex-col py-10 mt-20 max-w-full w-[1068px] max-md:mt-10">
         <div className="text-5xl leading-none text-center text-neutral-100 max-md:max-w-full max-md:text-4xl">Fast Global Access</div>
         <div className="flex flex-col mt-7 w-full text-2xl leading-none text-violet-100 max-md:pr-5 max-md:max-w-full">
            <div className="flex z-10 flex-wrap gap-10 justify-center items-center w-full max-md:max-w-full">
               <div className="flex gap-2 items-start self-stretch my-auto">
                  <Image
                     alt=""
                     loading="lazy"
                     src="https://cdn.builder.io/api/v1/image/assets/e485b3dc4b924975b4554885e21242bb/68b8a3d664d9cddfcaad323cdf8060b1cbc394035925642f7e3a3288ae711e2c?apiKey=e485b3dc4b924975b4554885e21242bb"
                     className="object-contain shrink-0 aspect-square w-[29px]"
                     width={100}
                     height={100}
                  />
                  <div className="">Own credit</div>
               </div>
               <div className="flex gap-2 items-center self-stretch my-auto">
                  <Image
                     alt=""
                     loading="lazy"
                     src="https://cdn.builder.io/api/v1/image/assets/e485b3dc4b924975b4554885e21242bb/a917966497141c5f35849f89593562ca146cb3abb3421a6d00b4e1466e8edcb9?apiKey=e485b3dc4b924975b4554885e21242bb"
                     className="object-contain shrink-0 self-stretch my-auto aspect-square w-[29px]"
                     width={100}
                     height={100}
                  />
                  <div className="self-stretch my-auto">Global use</div>
               </div>
               <div className="flex gap-2 items-center self-stretch my-auto">
                  <Image
                     alt=""
                     loading="lazy"
                     src="https://cdn.builder.io/api/v1/image/assets/e485b3dc4b924975b4554885e21242bb/a917966497141c5f35849f89593562ca146cb3abb3421a6d00b4e1466e8edcb9?apiKey=e485b3dc4b924975b4554885e21242bb"
                     className="object-contain shrink-0 self-stretch my-auto aspect-square w-[29px]"
                     width={100}
                     height={100}
                  />
                  <div className="self-stretch my-auto">Full control</div>
               </div>
            </div>
         </div>
      </div>
   );
}
