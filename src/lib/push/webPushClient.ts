// Browser side of Web Push: register the worker, hold a subscription, and keep
// the row in Supabase current.
//
// Everything here is defensive. Push is genuinely optional — an in-app browser
// (Telegram, LINE, Messenger) has no PushManager at all, iOS Safari only exposes
// one once the app has been added to the home screen, and a user can revoke the
// permission at any time from browser settings. None of those cases is an error
// worth surfacing; each just means this user is reached by email and Telegram
// instead.

import { getSupabaseBrowserClient, isSupabaseBrowserConfigured } from '@/lib/supabase/client';

const SERVICE_WORKER_URL = '/sw.js';
const SERVICE_WORKER_SCOPE = '/';

export type PushRegistrationOutcome =
   | 'subscribed'
   | 'already-subscribed'
   | 'permission-denied'
   | 'permission-dismissed'
   | 'unsupported'
   | 'not-configured'
   | 'failed';

export type PushPermissionState = 'granted' | 'denied' | 'default' | 'unsupported';

const getVapidPublicKey = () => (import.meta.env.VITE_VAPID_PUBLIC_KEY ?? '').trim();

/**
 * True only when every piece the Push API needs is present. Checked explicitly
 * rather than feature-detecting at the call site, because the failure modes
 * differ by browser and a thrown ReferenceError inside a React effect would take
 * the tree down with it.
 */
export const isPushSupported = (): boolean =>
   typeof window !== 'undefined' &&
   'serviceWorker' in navigator &&
   'PushManager' in window &&
   'Notification' in window;

export const isPushConfigured = (): boolean => getVapidPublicKey().length > 0;

export const getPushPermission = (): PushPermissionState =>
   isPushSupported() ? (Notification.permission as PushPermissionState) : 'unsupported';

// The VAPID public key travels as base64url but PushManager wants raw bytes.
const urlBase64ToUint8Array = (base64Url: string): Uint8Array => {
   const padding = '='.repeat((4 - (base64Url.length % 4)) % 4);
   const base64 = (base64Url + padding).replace(/-/g, '+').replace(/_/g, '/');
   const raw = window.atob(base64);
   const output = new Uint8Array(raw.length);

   for (let index = 0; index < raw.length; index += 1) {
      output[index] = raw.charCodeAt(index);
   }

   return output;
};

const arrayBufferToBase64Url = (buffer: ArrayBuffer | null): string => {
   if (!buffer) {
      return '';
   }

   const bytes = new Uint8Array(buffer);
   let binary = '';
   for (const byte of bytes) {
      binary += String.fromCharCode(byte);
   }

   return window.btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
};

let registrationPromise: Promise<ServiceWorkerRegistration | null> | null = null;

export const registerPushServiceWorker = async (): Promise<ServiceWorkerRegistration | null> => {
   if (!isPushSupported()) {
      return null;
   }

   // Memoised: React StrictMode double-invokes effects in dev, and registering
   // the same worker twice in parallel produces a spurious console error.
   if (!registrationPromise) {
      registrationPromise = navigator.serviceWorker
         .register(SERVICE_WORKER_URL, { scope: SERVICE_WORKER_SCOPE })
         .then((registration) => navigator.serviceWorker.ready.then(() => registration))
         .catch((error) => {
            console.warn('Push service worker registration failed', error);
            registrationPromise = null;
            return null;
         });
   }

   return registrationPromise;
};

const persistSubscription = async (subscription: PushSubscription, locale: string): Promise<boolean> => {
   if (!isSupabaseBrowserConfigured()) {
      return false;
   }

   const json = subscription.toJSON();
   const p256dh = json.keys?.p256dh ?? arrayBufferToBase64Url(subscription.getKey('p256dh'));
   const auth = json.keys?.auth ?? arrayBufferToBase64Url(subscription.getKey('auth'));

   if (!p256dh || !auth) {
      return false;
   }

   const supabase = getSupabaseBrowserClient();
   const { error } = await supabase.rpc('register_push_subscription', {
      p_endpoint: subscription.endpoint,
      p_p256dh: p256dh,
      p_auth: auth,
      p_locale: locale,
      // Only used to make the device list readable in support conversations.
      p_user_agent: navigator.userAgent.slice(0, 400)
   });

   if (error) {
      console.warn('Failed to store push subscription', error.message);
      return false;
   }

   return true;
};

/**
 * Ensures this device is subscribed and its row in Supabase is current.
 *
 * `promptIfNeeded: false` makes the call completely silent — it will refresh an
 * existing subscription but never trigger the browser permission dialog. That is
 * the right default on app start; the dialog belongs behind a deliberate user
 * action, both because a cold prompt converts badly and because a denied
 * permission is permanent until the user digs into browser settings.
 */
export const syncPushSubscription = async (
   options: { locale?: string; promptIfNeeded?: boolean } = {}
): Promise<PushRegistrationOutcome> => {
   const { locale = 'en', promptIfNeeded = false } = options;

   if (!isPushSupported()) {
      return 'unsupported';
   }

   if (!isPushConfigured()) {
      return 'not-configured';
   }

   if (Notification.permission === 'denied') {
      return 'permission-denied';
   }

   if (Notification.permission === 'default') {
      if (!promptIfNeeded) {
         return 'permission-dismissed';
      }

      const permission = await Notification.requestPermission();
      if (permission !== 'granted') {
         return permission === 'denied' ? 'permission-denied' : 'permission-dismissed';
      }
   }

   const registration = await registerPushServiceWorker();
   if (!registration) {
      return 'failed';
   }

   try {
      const existing = await registration.pushManager.getSubscription();

      if (existing) {
         // Still re-persist: the endpoint survives across sessions but the row
         // may be missing (new account on this device) or hold a stale locale.
         const stored = await persistSubscription(existing, locale);
         return stored ? 'already-subscribed' : 'failed';
      }

      const subscription = await registration.pushManager.subscribe({
         // Required by Chrome: every push must result in a visible notification.
         userVisibleOnly: true,
         applicationServerKey: urlBase64ToUint8Array(getVapidPublicKey())
      });

      const stored = await persistSubscription(subscription, locale);
      if (!stored) {
         // Don't leave a live subscription the backend has no record of — it
         // would burn push-service quota delivering to nobody.
         await subscription.unsubscribe().catch(() => undefined);
         return 'failed';
      }

      return 'subscribed';
   } catch (error) {
      console.warn('Push subscription failed', error);
      return 'failed';
   }
};

/** Turns push off for this device and removes the stored subscription. */
export const unsubscribeFromPush = async (): Promise<boolean> => {
   if (!isPushSupported()) {
      return false;
   }

   const registration = await registerPushServiceWorker();
   const subscription = await registration?.pushManager.getSubscription();

   if (!subscription) {
      return true;
   }

   if (isSupabaseBrowserConfigured()) {
      const supabase = getSupabaseBrowserClient();
      const { error } = await supabase.from('push_subscriptions').delete().eq('endpoint', subscription.endpoint);

      if (error) {
         console.warn('Failed to remove push subscription', error.message);
      }
   }

   return subscription.unsubscribe();
};

/** True when this device currently holds a live push subscription. */
export const hasActivePushSubscription = async (): Promise<boolean> => {
   if (!isPushSupported() || Notification.permission !== 'granted') {
      return false;
   }

   const registration = await registerPushServiceWorker();
   return Boolean(await registration?.pushManager.getSubscription());
};
