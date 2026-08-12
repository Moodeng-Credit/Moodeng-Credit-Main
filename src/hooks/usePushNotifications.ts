import { useCallback, useEffect, useState } from 'react';

import { useLocalization } from '@/i18n';
import {
   getPushPermission,
   hasActivePushSubscription,
   isPushConfigured,
   isPushSupported,
   syncPushSubscription,
   unsubscribeFromPush,
   type PushPermissionState,
   type PushRegistrationOutcome
} from '@/lib/push/webPushClient';

// Set once we've shown this device the permission dialog, so a user who
// dismissed it isn't asked again on every page load. Chrome and Safari both
// start ignoring repeat prompts anyway, and a dismissal that hardens into a
// block costs us the channel permanently.
const PROMPT_STORAGE_KEY = 'moodeng-push-prompted';

// Long enough for the dashboard to paint and for the user to have some idea what
// the app is before a system dialog lands on top of it.
const AUTO_PROMPT_DELAY_MS = 6000;

const hasBeenPrompted = () => {
   try {
      return window.localStorage.getItem(PROMPT_STORAGE_KEY) === '1';
   } catch {
      return false;
   }
};

const markPrompted = () => {
   try {
      window.localStorage.setItem(PROMPT_STORAGE_KEY, '1');
   } catch {
      // Private-mode storage failure just means we may ask once more later.
   }
};

export type PushNotificationsState = {
   isSupported: boolean;
   permission: PushPermissionState;
   isSubscribed: boolean;
   isBusy: boolean;
   /** Prompts for permission if needed, then subscribes this device. */
   enable: () => Promise<PushRegistrationOutcome>;
   disable: () => Promise<void>;
};

/**
 * Keeps this device's push subscription in sync with the signed-in user.
 *
 * Two distinct jobs, and they are not the same call:
 *  - every time an authenticated session appears, silently re-persist the
 *    existing subscription (the row may be missing after a re-install, or belong
 *    to whoever used this phone last, or carry a stale locale);
 *  - once per device, and only if the browser has never been asked, raise the
 *    permission dialog.
 *
 * Passing a null userId (signed out) does nothing — we never want to attach a
 * device to no account, or leave a stale one attached to a previous one.
 */
export function usePushNotifications(userId: string | null | undefined): PushNotificationsState {
   const { locale } = useLocalization();
   const [permission, setPermission] = useState<PushPermissionState>(() => getPushPermission());
   const [isSubscribed, setIsSubscribed] = useState(false);
   const [isBusy, setIsBusy] = useState(false);

   const isSupported = isPushSupported() && isPushConfigured();

   const refreshState = useCallback(async () => {
      setPermission(getPushPermission());
      setIsSubscribed(await hasActivePushSubscription());
   }, []);

   // Silent re-sync on sign-in. Never prompts.
   useEffect(() => {
      if (!isSupported || !userId) {
         return;
      }

      let cancelled = false;

      void syncPushSubscription({ locale, promptIfNeeded: false }).then(() => {
         if (!cancelled) {
            void refreshState();
         }
      });

      return () => {
         cancelled = true;
      };
   }, [isSupported, userId, locale, refreshState]);

   // First-run prompt, once per device.
   useEffect(() => {
      if (!isSupported || !userId || getPushPermission() !== 'default' || hasBeenPrompted()) {
         return;
      }

      const timer = window.setTimeout(() => {
         markPrompted();
         void syncPushSubscription({ locale, promptIfNeeded: true }).then(() => void refreshState());
      }, AUTO_PROMPT_DELAY_MS);

      return () => window.clearTimeout(timer);
   }, [isSupported, userId, locale, refreshState]);

   const enable = useCallback(async (): Promise<PushRegistrationOutcome> => {
      setIsBusy(true);
      try {
         markPrompted();
         const outcome = await syncPushSubscription({ locale, promptIfNeeded: true });
         await refreshState();
         return outcome;
      } finally {
         setIsBusy(false);
      }
   }, [locale, refreshState]);

   const disable = useCallback(async () => {
      setIsBusy(true);
      try {
         await unsubscribeFromPush();
         await refreshState();
      } finally {
         setIsBusy(false);
      }
   }, [refreshState]);

   return { isSupported, permission, isSubscribed, isBusy, enable, disable };
}
