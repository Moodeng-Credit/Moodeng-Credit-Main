import { useEffect, useMemo, useState } from 'react';

import { format, isValid, parseISO } from 'date-fns';

import AddToHomeScreenSteps from '@/components/funding/AddToHomeScreenSteps';
import LenderPopupShell, { LenderPopupButton, TurnOnButton } from '@/components/funding/LenderPopupShell';
import { useLenderPushTurnOn } from '@/components/funding/useLenderPushTurnOn';

import { usePushNotifications } from '@/hooks/usePushNotifications';

import { formatCurrency } from '@/utils/decimalHelpers';

import { getPushPermission, isPushConfigured, isPushSupported, needsHomeScreenForPush } from '@/lib/push/webPushClient';

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
 * the channel on that device for good). iPhones can't be switched on from here (push needs the app on
 * the Home Screen first), so there the button shows how instead.
 */
export default function LenderFundedPopup({ userId, borrowerName, totalRepayment, dueDate, onClose }: Props) {
   // Decided once on mount, so marking the ask seen below doesn't change the popup mid-screen.
   const pushAsk = useMemo(pickPushAsk, []);
   const push = usePushNotifications(userId, { autoPrompt: false });
   const [showSteps, setShowSteps] = useState(false);
   const { status: turnOnStatus, turnOn } = useLenderPushTurnOn(push.enable, onClose);

   useEffect(() => {
      if (pushAsk) markAskSeen();
   }, [pushAsk]);

   const due = dueDate ? parseISO(dueDate) : null;
   const repaysLine = `${borrowerName} repays you $${formatCurrency(totalRepayment)}${due && isValid(due) ? ` by ${format(due, 'MMM d')}` : ''}.`;

   // Moodeng hugging a paid coin, not the bell: the bell belongs to the Home Screen Turn On popup, and
   // reusing it here made the two steps look like the same screen. iPhone gets the same ask as everyone
   // else; its button just leads to the Home Screen steps, since iOS won't turn push on from Safari.
   const content = pushAsk
      ? {
           heading: 'Want to know when you’re repaid?',
           body: repaysLine,
           art: '/icons/hippo-repaid-coin-3d.png',
           cta: 'Notify Me When Repaid'
        }
      : { heading: 'Thanks for lending!', body: repaysLine, art: '/icons/check-3d.png', cta: 'Done' };

   const handleCta = () => {
      if (pushAsk === 'home-screen') setShowSteps(true);
      else onClose();
   };

   return (
      <LenderPopupShell title={`You funded ${borrowerName}!`} labelledBy="lender-funded-popup-title" onClose={onClose}>
         {showSteps ? (
            <>
               <div className="w-full text-[#594d65]">
                  <p id="lender-funded-popup-title" className="text-[24px] font-bold leading-6">
                     Add Moodeng to your Home Screen
                  </p>
                  <p className="mt-1 text-[16px] leading-[22px]">iPhones only send notifications from apps on your Home Screen.</p>
               </div>
               <AddToHomeScreenSteps />
               <LenderPopupButton onClick={onClose}>Got It</LenderPopupButton>
            </>
         ) : (
            <>
               <div className="w-full text-[#594d65] [overflow-wrap:anywhere]">
                  <p id="lender-funded-popup-title" className="text-[24px] font-bold leading-6">
                     {content.heading}
                  </p>
                  <p className="mt-1 text-[20px] leading-6">{content.body}</p>
               </div>
               <img src={content.art} alt="" className="h-[94px] w-[94px] object-contain" />
               {pushAsk === 'enable' ? (
                  <TurnOnButton label={content.cta} status={turnOnStatus} onTurnOn={() => void turnOn()} onDone={onClose} />
               ) : (
                  <LenderPopupButton onClick={handleCta}>{content.cta}</LenderPopupButton>
               )}
            </>
         )}
      </LenderPopupShell>
   );
}
