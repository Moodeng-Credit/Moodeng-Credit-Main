import { useEffect, useState } from 'react';

import { usePushNotifications } from '@/hooks/usePushNotifications';

import { getPushPermission, isPushConfigured, isPushSupported, needsHomeScreenForPush } from '@/lib/push/webPushClient';
import { TurnOnRemindersBanner } from '@/views/dashboard-v2/components/DashboardV2Banners';

// Set the first time this card is shown on a device. It's a one-time ask: whether the lender turns
// push on or just closes the success screen, we never show it again. They still get the repayment
// email, and can turn push on later from notification settings.
const SEEN_STORAGE_KEY = 'moodeng-repaid-push-card-seen';

const hasSeenCard = () => {
   try {
      return window.localStorage.getItem(SEEN_STORAGE_KEY) === '1';
   } catch {
      return false;
   }
};

const markCardSeen = () => {
   try {
      window.localStorage.setItem(SEEN_STORAGE_KEY, '1');
   } catch {
      // Private-mode storage failure just means we may ask once more after a later funding.
   }
};

type Variant = 'enable' | 'home-screen';

// Only ask when the answer is still open: the browser hasn't been asked yet, or it's iPhone Safari
// where push needs the app on the Home Screen first. Already allowed or blocked means no card.
const pickVariant = (): Variant | null => {
   if (hasSeenCard()) return null;
   if (isPushSupported() && isPushConfigured()) {
      return getPushPermission() === 'default' ? 'enable' : null;
   }
   return needsHomeScreenForPush() ? 'home-screen' : null;
};

interface Props {
   userId: string | null | undefined;
   borrowerName: string;
}

/**
 * "Get notified when you're repaid" — the borrower dashboard's reminders card, shown on the lender's
 * funding success screen, the moment they most want to know when the money comes back. Our own card
 * first, so the browser's permission dialog only appears after the lender has tapped Turn on (a
 * dismissed or blocked browser dialog can cost us the channel on that device for good).
 */
export default function RepaidPushCard({ userId, borrowerName }: Props) {
   // Decided once on mount, so marking the card seen below doesn't make it vanish mid-screen.
   const [variant, setVariant] = useState(pickVariant);
   const push = usePushNotifications(userId, { autoPrompt: false });

   useEffect(() => {
      if (variant) markCardSeen();
   }, [variant]);

   if (!variant) return null;

   const handleEnable = async () => {
      await push.enable();
      setVariant(null);
   };

   return (
      <TurnOnRemindersBanner
         language="en"
         variant={variant}
         isBusy={push.isBusy}
         onEnable={() => void handleEnable()}
         className="w-full border border-[#ece8ff]"
         copy={{
            title: 'Get notified when you’re repaid',
            body: `We’ll let you know the moment ${borrowerName} pays you back.`,
            homeScreenTitle: 'Get notified on your iPhone',
            homeScreenBody: 'Tap Share, then “Add to Home Screen”. Open Moodeng from your Home Screen to get notified when you’re repaid.'
         }}
      />
   );
}
