import { ICON_MASK_BASE, TELEGRAM_URL } from '@/views/support/constants';

export default function NeedMoreHelp() {
   return (
      <div className="bg-md-primary-100 rounded-md-input flex items-start gap-md-1 w-full overflow-hidden">
         <img src="/hippos/thinking.png" alt="" className="h-[160px] w-[131px] object-cover object-center shrink-0" />
         <div className="flex-1 min-w-0 flex flex-col gap-md-1 p-md-3 self-stretch">
            <p className="text-md-h5 font-semibold text-md-heading">Need more help?</p>
            <p className="text-md-b2 text-md-neutral-1200">Our support team is available 24/7 to assist you.</p>
            <a
               href={TELEGRAM_URL}
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
   );
}
