import { Link } from 'react-router-dom';

import { isSupportChatEnabled, openSupportChat } from '@/lib/support/liveChat';
import { ICON_MASK_BASE, TELEGRAM_SUPPORT_URL } from '@/views/support/constants';

interface NeedMoreHelpProps {
   showTeamLink?: boolean;
}

export default function NeedMoreHelp({ showTeamLink = false }: NeedMoreHelpProps) {
   // "Get In Touch" is the primary support CTA on the /support hub. It now opens
   // the live chat — the same conversation the /help page starts — so the team is
   // reached the same way from both. It falls back to Telegram only when live
   // chat is unconfigured, so the button is never a dead end.
   const handleGetInTouch = () => {
      if (isSupportChatEnabled) {
         openSupportChat();
      } else {
         window.open(TELEGRAM_SUPPORT_URL, '_blank', 'noopener,noreferrer');
      }
   };

   return (
      <div className="flex w-full flex-col gap-md-2">
         <div className="bg-md-primary-100 rounded-md-input flex items-start gap-md-1 w-full overflow-hidden">
            <div className="flex h-[160px] w-[131px] shrink-0 items-end justify-center pb-md-2">
               <img src="/hippos/thinking.png" alt="" className="h-[150px] w-auto object-contain object-bottom" />
            </div>
            <div className="flex-1 min-w-0 flex flex-col gap-md-1 p-md-3 self-stretch">
               <p className="text-md-h5 font-semibold text-md-heading">Need more help?</p>
               <p className="text-md-b2 text-md-neutral-1200">Message the team and a real person will reply — here and by email.</p>
               <button
                  type="button"
                  onClick={handleGetInTouch}
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
               </button>
            </div>
         </div>

         {showTeamLink ? (
            <Link
               to="/team"
               className="flex w-full items-center justify-between rounded-md-input border border-md-primary-500 bg-md-neutral-100 px-md-3 py-md-2 text-left shadow-md-card transition-all duration-150 hover:border-md-primary-900 hover:bg-md-primary-100/60 active:scale-[0.985] focus:outline-none focus-visible:ring-2 focus-visible:ring-md-primary-1200"
            >
               <span className="flex min-w-0 flex-col">
                  <span className="text-md-b1 font-semibold text-md-heading">Meet the Moodeng Credit Team</span>
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
         ) : null}
      </div>
   );
}
