import { useEffect, useMemo } from 'react';

import { format, isValid, parseISO } from 'date-fns';

import { usePushNotifications } from '@/hooks/usePushNotifications';

import { formatCurrency } from '@/utils/decimalHelpers';

import { getPushPermission, isPushConfigured, isPushSupported, needsHomeScreenForPush } from '@/lib/push/webPushClient';

// Same look as the dashboard's milestone popup (Figma "Milestone_9.23version", milestone_verified_popup):
// dimmed overlay, white-to-lavender card, italic underlined title, big art, gradient pill, round close.
const PRIMARY_GRADIENT = 'linear-gradient(77.66deg, #9584ff 0.5%, #6b55f7 98.16%)';
const CLOSE_ICON = '/dashboard-v2/icon-close-large.png';

// Set the first time the push ask is shown on a device. It's a one-time ask: whether the lender turns
// push on or just closes the popup, we never ask again. They still get the repayment email, and can
// turn push on later from notification settings.
const SEEN_STORAGE_KEY = 'moodeng-repaid-push-card-seen';

const hasSeenAsk = () => {
   try {
      return window.localStorage.getItem(SEEN_STORAGE_KEY) === '1';
   } catch {
      return false;
   }
};

const markAskSeen = () => {
   try {
      window.localStorage.setItem(SEEN_STORAGE_KEY, '1');
   } catch {
      // Private-mode storage failure just means we may ask once more after a later funding.
   }
};

type PushAsk = 'enable' | 'home-screen' | null;

// Only ask when the answer is still open: the browser hasn't been asked yet, or it's iPhone Safari
// where push needs the app on the Home Screen first. Already allowed or blocked means no ask.
const pickPushAsk = (): PushAsk => {
   if (hasSeenAsk()) return null;
   if (isPushSupported() && isPushConfigured()) {
      return getPushPermission() === 'default' ? 'enable' : null;
   }
   return needsHomeScreenForPush() ? 'home-screen' : null;
};

interface Props {
   userId: string | null | undefined;
   borrowerName: string;
   totalRepayment: number;
   dueDate?: string | null;
   onClose: () => void;
}

/**
 * Shown to a lender right after they fund a loan. The moment they most want to know when the money
 * comes back, so it doubles as the one-time push ask: our own button first, so the browser's permission
 * dialog only appears after the lender has said yes (a dismissed or blocked browser dialog can cost us
 * the channel on that device for good).
 */
export default function LenderFundedPopup({ userId, borrowerName, totalRepayment, dueDate, onClose }: Props) {
   // Decided once on mount, so marking the ask seen below doesn't change the popup mid-screen.
   const pushAsk = useMemo(pickPushAsk, []);
   const push = usePushNotifications(userId, { autoPrompt: false });

   useEffect(() => {
      if (pushAsk) markAskSeen();
   }, [pushAsk]);

   useEffect(() => {
      const onKeyDown = (event: KeyboardEvent) => {
         if (event.key === 'Escape') onClose();
      };
      window.addEventListener('keydown', onKeyDown);
      return () => window.removeEventListener('keydown', onKeyDown);
   }, [onClose]);

   const due = dueDate ? parseISO(dueDate) : null;
   const repaysLine = `${borrowerName} repays you $${formatCurrency(totalRepayment)}${due && isValid(due) ? ` by ${format(due, 'MMM d')}` : ''}.`;

   const content =
      pushAsk === 'enable'
         ? {
              heading: 'Want to know when you’re repaid?',
              body: repaysLine,
              art: '/icons/bell-ringing-3d.png',
              cta: 'Notify Me When Repaid'
           }
         : pushAsk === 'home-screen'
           ? {
                heading: 'Get notified on your iPhone',
                body: 'Tap Share, then “Add to Home Screen”. Open Moodeng from there to get notified when you’re repaid.',
                art: '/icons/add-to-home-screen-3d.png',
                cta: 'Got It'
             }
           : { heading: 'Thanks for lending!', body: repaysLine, art: '/icons/check-3d.png', cta: 'Done' };

   const handleCta = async () => {
      if (pushAsk === 'enable') await push.enable();
      onClose();
   };

   return (
      <div
         className="fixed inset-0 z-[80] flex overflow-y-auto overscroll-contain bg-black/80 px-5 py-6"
         role="dialog"
         aria-modal="true"
         aria-labelledby="lender-funded-popup-title"
         onClick={onClose}
      >
         <div className="m-auto flex w-full max-w-[400px] flex-col items-center" onClick={(event) => event.stopPropagation()}>
            {/* Usernames run to 45 characters with no spaces, so let them break anywhere and cap at two lines. */}
            <p className="mb-2 line-clamp-2 max-w-[350px] text-center text-[26px] font-black italic leading-9 text-[#4c239f] underline decoration-[#7e6afa] decoration-4 underline-offset-8 [overflow-wrap:anywhere]">
               You funded {borrowerName}!
            </p>
            <div className="w-full rounded-[26px] bg-gradient-to-b from-[#f3ecff] via-white via-40% to-white shadow-[0_-1px_0_0_#fff]">
               <div className="flex flex-col items-center gap-[9px] px-5 pb-6 pt-[18px] text-center">
                  <div className="w-full text-[#594d65] [overflow-wrap:anywhere]">
                     <p id="lender-funded-popup-title" className="text-[24px] font-bold leading-6">
                        {content.heading}
                     </p>
                     <p className="mt-1 text-[20px] leading-6">{content.body}</p>
                  </div>
                  <img src={content.art} alt="" className="h-[94px] w-[94px] object-contain" />
                  <button
                     type="button"
                     onClick={() => void handleCta()}
                     disabled={push.isBusy}
                     className="flex h-[52px] w-full max-w-[346px] items-center justify-center rounded-[35px] px-5 text-[20px] font-semibold tracking-[-0.4px] text-white transition active:scale-[0.99] disabled:opacity-60"
                     style={{ backgroundImage: PRIMARY_GRADIENT }}
                  >
                     {content.cta}
                  </button>
               </div>
            </div>
            <button type="button" onClick={onClose} className="mt-14 h-[50px] w-[50px]" aria-label="Close">
               <img src={CLOSE_ICON} alt="" className="h-[50px] w-[50px]" />
            </button>
         </div>
      </div>
   );
}
