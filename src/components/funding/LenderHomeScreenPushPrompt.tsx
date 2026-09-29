import { useEffect, useMemo, useState } from 'react';

import LenderPopupShell, { LenderPopupButton } from '@/components/funding/LenderPopupShell';

import { usePushNotifications } from '@/hooks/usePushNotifications';

import { getPushPermission, isIosHomeScreenApp, isPushConfigured, isPushSupported } from '@/lib/push/webPushClient';

// Home Screen web apps keep their own storage, separate from Safari, so this is "asked once in the
// Home Screen app", whatever happened in Safari before.
const SEEN_STORAGE_KEY = 'moodeng-lender-home-screen-push-seen';

const hasSeenPrompt = () => {
   try {
      return window.localStorage.getItem(SEEN_STORAGE_KEY) === '1';
   } catch {
      return false;
   }
};

const markPromptSeen = () => {
   try {
      window.localStorage.setItem(SEEN_STORAGE_KEY, '1');
   } catch {
      // Private-mode storage failure just means we may ask once more on a later launch.
   }
};

const shouldPrompt = () =>
   isIosHomeScreenApp() && isPushSupported() && isPushConfigured() && getPushPermission() === 'default' && !hasSeenPrompt();

/**
 * The last step of the iPhone guide in LenderFundedPopup: a lender who has added Moodeng to the Home
 * Screen and opened it from there. iOS only shows the "Allow notifications?" dialog after a tap, never
 * on load, so this gives them the one tap it needs. Asked once.
 */
export default function LenderHomeScreenPushPrompt({ userId }: { userId: string }) {
   const eligible = useMemo(shouldPrompt, []);
   const [isOpen, setIsOpen] = useState(eligible);
   const push = usePushNotifications(userId, { autoPrompt: false });

   useEffect(() => {
      if (eligible) markPromptSeen();
   }, [eligible]);

   if (!isOpen) return null;

   const close = () => setIsOpen(false);
   const handleTurnOn = async () => {
      await push.enable();
      close();
   };

   return (
      <LenderPopupShell title="You’re on the Home Screen!" labelledBy="lender-home-screen-push-title" onClose={close}>
         <div className="w-full text-[#594d65]">
            <p id="lender-home-screen-push-title" className="text-[24px] font-bold leading-6">
               Turn on notifications
            </p>
            <p className="mt-1 text-[20px] leading-6">Get notified the moment a borrower repays you.</p>
         </div>
         <img src="/icons/bell-ringing-3d.png" alt="" className="h-[94px] w-[94px] object-contain" />
         <LenderPopupButton onClick={() => void handleTurnOn()} disabled={push.isBusy}>
            Turn On
         </LenderPopupButton>
      </LenderPopupShell>
   );
}
