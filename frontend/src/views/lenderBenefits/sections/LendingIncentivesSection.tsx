import { type JSX } from 'react';



import { type LendingIncentiveItem, lendingIncentivesData } from '@/views/lenderBenefits/config/lendingIncentivesConfig';

interface LendingIncentiveCardProps {
   item: LendingIncentiveItem;
}

function LendingIncentiveCard({ item }: LendingIncentiveCardProps): JSX.Element {
   const imageWidth = 477;
   const imageHeight = 288;

   const contentSection = (
      <div className="flex flex-col w-6/12 max-md:ml-0 max-md:w-full">
         <div
            className={`flex flex-col self-stretch my-auto tracking-tight max-md:mt-10 ${
               item.imagePosition === 'left' ? 'mt-6 text-right max-md:mt-10' : ''
            }`}
         >
            <div
               className={`text-3xl mt-5 font-bold leading-none text-black ${
                  item.imagePosition === 'left' ? 'flex gap-2.5 self-end max-md:mr-1' : ''
               }`}
            >
               {item.titleHighlight ? (
                  <>
                     <div className="flex-auto leading-none mb-2">{item.title}</div>
                     <div className="self-start px-1.5  leading-none whitespace-nowrap bg-orange-200 rounded-lg">{item.titleHighlight}</div>
                  </>
               ) : (
                  item.title
               )}
            </div>
            <div
               className={`text-lg font-medium leading-6 text-stone-600 ${
                  item.imagePosition === 'left' ? 'max-md:max-w-full' : 'max-md:mr-2.5'
               }`}
            >
               {item.description.map((paragraph) => (
                  <div key={paragraph.slice(0, 20)} className="mt-5">
                     {paragraph}
                  </div>
               ))}
            </div>
         </div>
      </div>
   );

   const imageSection = (
      <div className="flex flex-col w-6/12 max-md:ml-0 max-md:w-full">
         <div
            className={`flex shrink-0 max-w-full h-72 rounded-2xl  max-md:mt-10 ${
               item.imagePosition === 'left' ? 'self-start ml-0 pl-0' : 'self-end'
            }`}
         >
            <img
               loading="lazy"
               src={item.image.src}
               alt={item.image.alt}
               className="object-cover w-full rounded-2xl aspect-[1.66]"
               width={imageWidth}
               height={imageHeight}
            />
         </div>
      </div>
   );

   return (
      <div className="flex z-0 flex-col justify-center py-px mt-4 w-full rounded-none max-w-[1064px] max-md:max-w-full">
         <div className={`rounded-2xl bg-stone-100 max-md:max-w-full ${item.imagePosition === 'left' ? 'pr-20' : 'pl-12'} max-md:px-5`}>
            <div className="flex gap-5 max-md:flex-col">
               {item.imagePosition === 'left' ? (
                  <>
                     {imageSection}
                     {contentSection}
                  </>
               ) : (
                  <>
                     {contentSection}
                     {imageSection}
                  </>
               )}
            </div>
         </div>
      </div>
   );
}

export default function LendingIncentivesSection(): JSX.Element {
   return (
      <>
         {lendingIncentivesData.map((item) => (
            <LendingIncentiveCard key={item.id} item={item} />
         ))}
      </>
   );
}
