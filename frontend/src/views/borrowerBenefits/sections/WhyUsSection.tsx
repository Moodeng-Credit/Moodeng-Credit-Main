import { type JSX } from 'react';



export default function WhyUsSection(): JSX.Element {
   return (
      <div
         id="why-us"
         className="flex flex-col pt-11 pr-3.5 pl-20 mt-20 max-w-full bg-neutral-100 rounded-[60px] w-[1440px] max-md:pl-5 max-md:mt-10"
      >
         <div className="flex flex-wrap gap-5 justify-between items-start self-center max-w-full text-3xl leading-none text-zinc-900 w-[1233px]">
            <div>NO MORE LOAN SHARKS</div>
            <img
               alt=""
               loading="lazy"
               src="https://cdn.builder.io/api/v1/image/assets/e485b3dc4b924975b4554885e21242bb/d9ac94ddf05ac09e55e7d62facd9aa97647f3694d6e028af850f87de982de6bf?apiKey=e485b3dc4b924975b4554885e21242bb"
               className="object-contain shrink-0 mt-4 aspect-[1.35] w-[50px]"
               width={100}
               height={100}
            />
         </div>
         <div className="z-10 mt-6 max-md:max-w-full">
            <div className="flex gap-5 max-md:flex-col">
               <div className="flex flex-col w-6/12 max-md:ml-0 max-md:w-full">
                  <div className="flex flex-col text-zinc-900 max-md:mt-4 max-md:max-w-full">
                     <div className="flex overflow-hidden flex-col py-12 pr-16 pl-8 bg-blue-400 rounded-[30px] max-md:px-5 max-md:max-w-full">
                        <div className="self-start text-4xl leading-none">Empower You</div>
                        <div className="mt-8 text-2xl leading-8 max-md:max-w-full">
                           Build your global credit score on the blockchain. Access it anytime via your smartphone wallet like Metamask.
                        </div>
                     </div>
                     <div className="flex overflow-hidden flex-col py-12 pr-16 pl-8 mt-4 bg-fuchsia-300 rounded-[30px] max-md:px-5 max-md:max-w-full">
                        <div className="self-start text-4xl leading-none">Data Security</div>
                        <div className="mt-8 text-2xl leading-8 max-md:max-w-full">
                           Our blockchain app protects your privacy. In contrast, centralized apps on Google Play or Apple Store allow your
                           data to be sold and stolen.
                        </div>
                     </div>
                     <div className="flex overflow-hidden flex-col px-8 py-11 mt-4 bg-emerald-400 rounded-[30px] max-md:px-5 max-md:max-w-full">
                        <div className="self-start text-4xl leading-none max-md:max-w-full">Borderless Credit History</div>
                        <div className="mt-6 text-2xl leading-8 max-md:max-w-full">
                           Your financial reputation isn't tied to any country. In a Globalized World, it is better to have your finances be
                           completely borderless.
                        </div>
                     </div>
                  </div>
               </div>
               <div className="flex flex-col ml-5 w-6/12 max-md:ml-0 max-md:w-full">
                  <div className="flex flex-col grow text-2xl leading-6 text-center text-black max-md:mt-4 max-md:max-w-full">
                     <img
                        alt=""
                        loading="lazy"
                        src="https://cdn.builder.io/api/v1/image/assets/e485b3dc4b924975b4554885e21242bb/c637e5e1f5ff31348c478a947d562e74584bd750d7002327ad1c8336f34202f1?apiKey=e485b3dc4b924975b4554885e21242bb"
                        className="object-contain max-w-full aspect-[0.78] rounded-[30px] w-[610px]"
                        width={610}
                        height={476}
                     />
                     <div className="overflow-hidden self-end px-10 py-4 max-w-full bg-zinc-300 rounded-[100px] w-[279px] max-md:px-5">
                        This is Moodeng's friend Mecha, taking down a loan shark!
                     </div>
                  </div>
               </div>
            </div>
         </div>
      </div>
   );
}
