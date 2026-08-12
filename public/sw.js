/* Moodeng service worker — push notifications only.
 *
 * Deliberately not a caching/offline worker. It exists because the Web Push API
 * requires a service worker to receive a push event, and nothing more: adding a
 * fetch handler here would put a cache in front of a financial app, which is a
 * much bigger decision than turning on notifications.
 *
 * The payload it receives is the JSON produced by
 * supabase/functions/_shared/pushMessages.ts.
 */

const DEFAULT_ICON = '/moodenglogo.png';
// Android renders the badge as a monochrome silhouette in the status bar.
const DEFAULT_BADGE = '/moodenglogo.png';
const FALLBACK_URL = '/dashboard';

self.addEventListener('install', () => {
   // Take over immediately so a returning user isn't stuck on an older worker
   // that predates a copy change.
   self.skipWaiting();
});

self.addEventListener('activate', (event) => {
   event.waitUntil(self.clients.claim());
});

const parsePayload = (event) => {
   if (!event.data) {
      return null;
   }

   try {
      return event.data.json();
   } catch {
      // A push service health-check or a malformed send: show nothing rather
      // than a notification the user can't act on.
      return null;
   }
};

self.addEventListener('push', (event) => {
   const payload = parsePayload(event);

   if (!payload || !payload.title) {
      return;
   }

   event.waitUntil(
      self.registration.showNotification(payload.title, {
         body: payload.body ?? '',
         icon: payload.icon ?? DEFAULT_ICON,
         badge: payload.badge ?? DEFAULT_BADGE,
         // Same tag replaces rather than stacks, so an hourly reminder cron can
         // retry without burying the lock screen.
         tag: payload.tag ?? payload.type ?? 'moodeng',
         renotify: true,
         requireInteraction: Boolean(payload.requireInteraction),
         data: {
            url: payload.url ?? FALLBACK_URL,
            type: payload.type ?? null
         }
      })
   );
});

self.addEventListener('notificationclick', (event) => {
   event.notification.close();

   const targetUrl = (event.notification.data && event.notification.data.url) || FALLBACK_URL;

   event.waitUntil(
      self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clientList) => {
         // Reuse an already-open Moodeng tab where possible — opening a second
         // one drops the user's in-progress state (wallet connection, forms).
         for (const client of clientList) {
            if (client.url.startsWith(self.location.origin) && 'focus' in client) {
               if ('navigate' in client) {
                  return client.navigate(targetUrl).then((navigated) => (navigated ? navigated.focus() : client.focus()));
               }
               return client.focus();
            }
         }

         return self.clients.openWindow(targetUrl);
      })
   );
});

/* The push service can rotate a subscription on its own (browser update, key
 * rotation). Re-subscribe with the same server key so pushes keep arriving; the
 * new endpoint is written back to Supabase by usePushNotifications the next time
 * the app is opened, since the worker has no authenticated session of its own. */
self.addEventListener('pushsubscriptionchange', (event) => {
   const applicationServerKey =
      event.oldSubscription && event.oldSubscription.options
         ? event.oldSubscription.options.applicationServerKey
         : null;

   if (!applicationServerKey) {
      return;
   }

   event.waitUntil(self.registration.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey }));
});
