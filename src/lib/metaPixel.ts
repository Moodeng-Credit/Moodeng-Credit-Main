// Meta pixel conversion events for the "Moodeng Credit | SEA" dataset. The pixel itself (and its
// PageViews) loads from public/meta-pixel.js; this only adds the events ads can optimize for.
// Best-effort: if the pixel is blocked or storage is unavailable, nothing is sent and nothing breaks.

type Fbq = (command: 'track', event: string, params?: Record<string, unknown>) => void;

const REGISTRATION_SENT_KEY = 'md_meta_registration_sent';
// An account counts as just created if it's younger than this when the app first sees it signed in.
const NEW_ACCOUNT_WINDOW_MS = 30 * 60 * 1000;

const fbq = (): Fbq | null => {
   if (typeof window === 'undefined') return null;
   const fn = (window as Window & { fbq?: Fbq }).fbq;
   return typeof fn === 'function' ? fn : null;
};

export const trackMetaEvent = (event: string, params?: Record<string, unknown>) => {
   try {
      fbq()?.('track', event, params);
   } catch {
      // Pixel failed: skip.
   }
};

/** Once per account on this browser: CompleteRegistration, only if the account was just created. */
export const trackNewAccount = (userId: string, createdAt: string | undefined, now = Date.now()) => {
   try {
      if (!createdAt) return;
      const created = new Date(createdAt).getTime();
      if (Number.isNaN(created) || now - created > NEW_ACCOUNT_WINDOW_MS) return;
      if (window.localStorage.getItem(REGISTRATION_SENT_KEY) === userId) return;
      window.localStorage.setItem(REGISTRATION_SENT_KEY, userId);
      trackMetaEvent('CompleteRegistration');
   } catch {
      // Storage blocked: skip.
   }
};
