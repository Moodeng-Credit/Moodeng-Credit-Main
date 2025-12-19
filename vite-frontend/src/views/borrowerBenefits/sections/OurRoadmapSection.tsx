import { type JSX } from 'react';

export default function OurRoadmapSection(): JSX.Element {
   return (
      <div className="flex flex-col justify-center px-20 py-28 mt-20 max-w-full w-[1440px] max-md:px-5 max-md:py-24 max-md:mt-10">
         <div className="flex flex-col items-start -mb-5 max-md:mb-2.5 max-md:max-w-full">
            <div className="text-3xl leading-none text-neutral-100">Our Roadmap</div>
            <div className="mt-16 text-2xl leading-none text-neutral-100 max-md:mt-10 max-md:max-w-full">
               Together We are Going to Make the World Better
            </div>
            <div className="self-stretch mt-16 max-md:mt-10 max-md:max-w-full">
               <div className="flex max-md:flex-col">
                  <div className="flex flex-col w-[25%] max-md:ml-0 max-md:w-full">
                     <div className="flex overflow-hidden flex-col grow pt-12 pr-8 pb-11 pl-4 w-full h-full bg-indigo-500 rounded-[30px] max-md:pr-5 max-md:mt-3.5">
                        <div className="text-xl leading-8 mb-10 uppercase text-zinc-900 text-opacity-50 w-[245px] max-md:ml-2">
                           STEP #1: Build Credit Scores
                        </div>
                        <div className="text-2xl leading-7 text-neutral-100 max-md:mt-10">
                           Start with microloans, build creditworthiness gradually.
                        </div>
                     </div>
                  </div>
                  <div className="flex flex-col ml-5 w-[25%] max-md:ml-0 max-md:w-full">
                     <div className="flex overflow-hidden flex-col items-start pt-12 pr-16 pb-11 pl-6 w-full h-full leading-7 bg-blue-400 rounded-[30px] max-md:px-5 max-md:mt-3.5">
                        <div className="text-xl uppercase mb-10 text-zinc-900 text-opacity-50 w-[150px]">STEP #2: GET INSURANCE</div>
                        <div className="text-2xl text-neutral-100 max-md:mt-10">Help everyone get insurance if you need it.</div>
                     </div>
                  </div>
                  <div className="flex flex-col ml-5 w-[25%] max-md:ml-0 max-md:w-full">
                     <div className="flex overflow-hidden flex-col px-6 pt-12 pb-11 w-full h-full leading-7 bg-fuchsia-300 rounded-[30px] max-md:px-5 max-md:mt-3.5">
                        <div className="text-xl uppercase mb-10 text-zinc-900 text-opacity-50 w-[251px]">STEP #3: GET MORE INSURANCE</div>
                        <div className="text-2xl text-neutral-100 max-md:mt-10">Lenders can get more risk protection.</div>
                     </div>
                  </div>
                  <div className="flex flex-col ml-5 w-[25%] max-md:ml-0 max-md:w-full">
                     <div className="flex overflow-hidden flex-col px-6 pt-12 pb-11 w-full h-full bg-amber-500 rounded-[30px] max-md:px-5 max-md:mt-3.5">
                        <div className="text-xl leading-7 mb-10 uppercase text-zinc-900 text-opacity-50">STEP #4: Govern Ourselves</div>
                        <div className="text-2xl leading-7 text-neutral-100 max-md:mt-10">
                           We can work together as a community to govern this app.{' '}
                        </div>
                     </div>
                  </div>
               </div>
            </div>
         </div>
      </div>
   );
}
