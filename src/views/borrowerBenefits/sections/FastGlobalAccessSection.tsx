import { type JSX, useState } from 'react';

const accessItems = [
   {
      title: 'Own credit',
      description: 'Your repayment activity builds around your wallet, so your history is not locked inside one lender or one country.',
      icon: 'https://cdn.builder.io/api/v1/image/assets/e485b3dc4b924975b4554885e21242bb/68b8a3d664d9cddfcaad323cdf8060b1cbc394035925642f7e3a3288ae711e2c?apiKey=e485b3dc4b924975b4554885e21242bb'
   },
   {
      title: 'Global use',
      description: 'A wallet-based record can travel with you, making it easier to show repayment behavior across borders.',
      icon: 'https://cdn.builder.io/api/v1/image/assets/e485b3dc4b924975b4554885e21242bb/a917966497141c5f35849f89593562ca146cb3abb3421a6d00b4e1466e8edcb9?apiKey=e485b3dc4b924975b4554885e21242bb'
   },
   {
      title: 'Full control',
      description: 'You choose what to request and when to repay. Terms should be clear before you commit to a loan.',
      icon: 'https://cdn.builder.io/api/v1/image/assets/e485b3dc4b924975b4554885e21242bb/a917966497141c5f35849f89593562ca146cb3abb3421a6d00b4e1466e8edcb9?apiKey=e485b3dc4b924975b4554885e21242bb'
   }
];

export default function FastGlobalAccessSection(): JSX.Element {
   const [openItem, setOpenItem] = useState(accessItems[0].title);

   return (
      <div className="borrower-fast-global-section flex flex-col mt-0 max-w-full w-[1068px] px-5 pt-12 pb-8">
         <div className="text-[38px] leading-tight text-neutral-100 max-md:max-w-full">Fast Global Access</div>
         <div className="borrower-fast-global-list flex flex-col mt-6 w-full text-xl leading-tight text-violet-100 max-md:max-w-full">
            <div className="grid z-10 grid-cols-1 gap-3 items-center w-full max-md:max-w-full">
               {accessItems.map((item) => {
                  const isOpen = openItem === item.title;

                  return (
                     <button
                        key={item.title}
                        type="button"
                        aria-expanded={isOpen}
                        onClick={() => setOpenItem(isOpen ? '' : item.title)}
                        className="borrower-fast-global-item flex w-full flex-col gap-3 rounded-[18px] border border-white/10 bg-white/5 p-4 text-left transition-colors hover:border-md-primary-300/50 hover:bg-white/[0.075] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-md-primary-300"
                     >
                        <span className="flex w-full items-center gap-2">
                           <img
                              alt=""
                              loading="lazy"
                              src={item.icon}
                              className="object-contain shrink-0 aspect-square w-[29px]"
                              width={100}
                              height={100}
                           />
                           <span className="flex-1 text-violet-100">{item.title}</span>
                           <span className="text-md-b2 text-violet-100/60">{isOpen ? 'Close' : 'Learn more'}</span>
                        </span>
                        {isOpen && <span className="block pl-[37px] text-md-b1 leading-7 text-violet-100/75">{item.description}</span>}
                     </button>
                  );
               })}
            </div>
         </div>
      </div>
   );
}
