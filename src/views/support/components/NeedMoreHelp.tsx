import { Link } from 'react-router-dom';

import { ICON_MASK_BASE, TELEGRAM_SUPPORT_URL } from '@/views/support/constants';

export default function NeedMoreHelp() {
   return (
      <div className="flex w-full flex-col gap-md-2">
         <div className="bg-md-primary-100 rounded-md-input flex items-start gap-md-1 w-full overflow-hidden">
            <img src="/hippos/thinking.png" alt="" className="h-[160px] w-[131px] object-cover object-center shrink-0" />
            <div className="flex-1 min-w-0 flex flex-col gap-md-1 p-md-3 self-stretch">
               <p className="text-md-h5 font-semibold text-md-heading">Need more help?</p>
               <p className="text-md-b2 text-md-neutral-1200">Our support team is available 24/7 to assist you.</p>
               <a
                  href={TELEGRAM_SUPPORT_URL}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="bg-md-primary-1200 rounded-md-lg flex items-center justify-center gap-md-1 px-md-4 py-md-2 self-start transition-all duration-150 hover:brightness-105 active:scale-[0.97] active:brightness-95 focus:outline-none focus-visible:ring-2 focus-visible:ring-md-primary-1200"
               >
                  <span className="text-md-b1 font-semibold text-md-neutral-100">Get In Touch</span>
                  <div
                     className="w-6 h-6 bg-md-neutral-100"
                     style={{
                        ...ICON_MASK_BASE,
                        WebkitMaskImage: "url('/icons/chevron-right.svg')",
                        maskImage: "url('/icons/chevron-right.svg')"
                     }}
                  />
               </a>
            </div>
         </div>

         <Link
            to="/team"
            className="flex w-full items-center justify-between rounded-md-input border border-md-primary-500 bg-md-neutral-100 px-md-3 py-md-2 text-left shadow-md-card transition-all duration-150 hover:border-md-primary-900 hover:bg-md-primary-100/60 active:scale-[0.985] focus:outline-none focus-visible:ring-2 focus-visible:ring-md-primary-1200"
         >
            <span className="flex min-w-0 flex-col">
               <span className="text-md-b1 font-semibold text-md-heading">Meet the Moodeng Credit team</span>
               <span className="text-md-b3 font-medium text-md-neutral-1200">See the people building borrower trust.</span>
            </span>
            <span
               className="ml-md-2 h-6 w-6 shrink-0 bg-md-primary-1200"
               aria-hidden="true"
               style={{
                  ...ICON_MASK_BASE,
                  WebkitMaskImage: "url('/icons/chevron-right.svg')",
                  maskImage: "url('/icons/chevron-right.svg')"
               }}
            />
         </Link>
      </div>
   );
}
