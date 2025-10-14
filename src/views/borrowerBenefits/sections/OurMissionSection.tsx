import { type JSX } from 'react';

import Image from 'next/image';
import Link from 'next/link';

export default function OurMissionSection(): JSX.Element {
   return (
      <div
         id="mission"
         className="flex overflow-hidden flex-col justify-center px-20 py-16 mt-20 max-w-full bg-neutral-100 rounded-[60px] w-[1440px] max-md:px-5 max-md:mt-10"
      >
         <div className="flex flex-col max-md:max-w-full">
            <div className="flex flex-wrap gap-5 justify-between text-3xl leading-none uppercase text-zinc-900 max-md:max-w-full">
               <div className="my-auto">Our Mission</div>
               <Image
                  alt=""
                  loading="lazy"
                  src="https://cdn.builder.io/api/v1/image/assets/e485b3dc4b924975b4554885e21242bb/f95e6bde12059349a6566180e5bcbdf7ae944286308ddb07bbdbeef12dd4aee9?apiKey=e485b3dc4b924975b4554885e21242bb"
                  className="object-contain shrink-0 aspect-[1.35] w-[50px]"
                  width={100}
                  height={100}
               />
            </div>
            <div className="mt-6 max-md:max-w-full">
               <div className="flex gap-5 max-md:flex-col">
                  <div className="flex flex-col w-6/12 max-md:ml-0 max-md:w-full">
                     <div className="flex flex-col mt-2 max-md:mt-10 max-md:max-w-full">
                        <div className="text-2xl leading-8 text-zinc-900 max-md:max-w-full">
                           Dr. Muhammad Yunus won a Nobel Prize for creating opportunities through small loans. We're bringing his vision to
                           life with cutting-edge technology. <br />
                           <br />
                           By using <span className="font-bold">Moodeng</span>, you're building a fairer financial world. Say goodbye to
                           predatory apps that overcharge. We're restoring trust in personal finance, one transaction at a time.
                        </div>
                        <div className="overflow-hidden self-start px-7 py-3.5 mt-16 text-2xl leading-none text-center bg-indigo-500 rounded-[100px] text-neutral-100 max-md:px-5 max-md:mt-10">
                           <Link href="/">Get started</Link>
                        </div>
                     </div>
                  </div>
                  <div className="flex flex-col ml-5 w-6/12 max-md:ml-0 max-md:w-full">
                     <div className="flex overflow-hidden relative flex-col grow justify-center items-end px-20 py-4 min-h-[418px] max-md:px-5 max-md:mt-10 max-md:max-w-full">
                        <Image
                           alt=""
                           loading="lazy"
                           src="https://cdn.builder.io/api/v1/image/assets/e485b3dc4b924975b4554885e21242bb/b2c51438d1210e817aaed45564e6153b0440ad073629369776a57a641c0c172d?apiKey=e485b3dc4b924975b4554885e21242bb"
                           className="object-cover absolute inset-0 size-full"
                           width={418}
                           height={418}
                        />
                        <Image
                           alt=""
                           loading="lazy"
                           src="https://cdn.builder.io/api/v1/image/assets/e485b3dc4b924975b4554885e21242bb/d6479afde9cb46f4426ae44142747454e05d7017ae1741d248c8d8e56468a602?apiKey=e485b3dc4b924975b4554885e21242bb"
                           className="object-contain z-10 max-w-full aspect-[0.84] rounded-[50px] w-[323px]"
                           width={323}
                           height={271}
                        />
                     </div>
                  </div>
               </div>
            </div>
         </div>
      </div>
   );
}
