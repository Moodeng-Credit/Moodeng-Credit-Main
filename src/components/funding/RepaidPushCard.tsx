import { useEffect, useState } from 'react';

import { Bell, BellRing, Share } from 'lucide-react';

import { usePushNotifications } from '@/hooks/usePushNotifications';

import { getPushPermission, isPushConfigured, isPushSupported, needsHomeScreenForPush } from '@/lib/push/webPushClient';

// Set the first time this card is shown on a device. It's a one-time ask: whether the lender turns
// push on, taps "Not now" or just closes the success screen, we never show it again. They still get
// the repayment email, and can turn push on later from notification settings.
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
 * "Get notified when you're repaid" — shown on the lender's funding success screen, the moment they
 * most want to know when the money comes back. Our own card first, so the browser's permission
 * dialog only appears after the lender has said yes (a dismissed or blocked browser dialog can cost
 * us the channel on that device for good).
 */
export default function RepaidPushCard({ userId, borrowerName }: Props) {
   // Decided once on mount, so marking the card seen below doesn't make it vanish mid-screen.
   const [variant, setVariant] = useState(pickVariant);
   const [isEnabled, setIsEnabled] = useState(false);
   const push = usePushNotifications(userId, { autoPrompt: false });

   useEffect(() => {
      if (variant) markCardSeen();
   }, [variant]);

   if (!variant) return null;

   if (isEnabled) {
      return (
         <div className="flex w-full items-center gap-md-2 rounded-[16px] bg-[#efeaff] p-md-3 text-left text-md-b3 font-semibold text-[#4b3bc0]">
            <BellRing className="size-5 shrink-0" aria-hidden="true" />
            You’re all set. We’ll notify you when {borrowerName} repays.
         </div>
      );
   }

   const handleEnable = async () => {
      const outcome = await push.enable();
      if (outcome === 'subscribed' || outcome === 'already-subscribed') {
         setIsEnabled(true);
      } else {
         setVariant(null);
      }
   };

   const Icon = variant === 'home-screen' ? Share : Bell;

   return (
      <div className="w-full rounded-[16px] border border-[#e4ddff] bg-[#f7f5ff] p-md-3 text-left">
         <div className="flex items-start gap-md-2">
            <span className="flex size-10 shrink-0 items-center justify-center rounded-full bg-[#efeaff]">
               <Icon className="size-5 text-[#6b55f7]" aria-hidden="true" />
            </span>
            <div className="min-w-0">
               <p className="text-md-b2 font-semibold text-md-heading">Get notified when you’re repaid</p>
               <p className="mt-0.5 text-md-b3 text-[#45556c]">
                  {variant === 'home-screen'
                     ? 'On iPhone, tap Share, then “Add to Home Screen”. Open Moodeng from your Home Screen and turn on notifications in Settings.'
                     : `We’ll send a notification the moment ${borrowerName} pays you back.`}
               </p>
            </div>
         </div>
         <div className="mt-md-3 flex items-center justify-end gap-md-2">
            <button
               type="button"
               onClick={() => setVariant(null)}
               className="rounded-md-lg px-md-3 py-md-2 text-md-b3 font-semibold text-[#6d6d6d] transition hover:text-md-heading"
            >
               {variant === 'home-screen' ? 'Got it' : 'Not now'}
            </button>
            {variant === 'enable' ? (
               <button
                  type="button"
                  onClick={() => void handleEnable()}
                  disabled={push.isBusy}
                  className="rounded-md-lg bg-[#6b55f7] px-md-3 py-md-2 text-md-b3 font-semibold text-white transition hover:brightness-110 active:scale-[0.98] disabled:opacity-60"
               >
                  Turn on
               </button>
            ) : null}
         </div>
      </div>
   );
}
