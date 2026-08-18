// Best-effort, client-side "is this user in the Philippines?" check, used to
// scope the location/device fraud capture to our core PH market for now.
//
// This is a PROXY for presence in PH, not true nationality (we don't store
// nationality yet). It intentionally errs toward the market: any one PH signal
// is enough. A Filipino travelling abroad may fall out of it; that's acceptable
// for a soft feature gate. NOT a security control — trivially spoofable.
//
// Signals (any one is enough):
//  - device timezone is Asia/Manila
//  - a browser language carries the -PH region (en-PH, fil-PH, tl-PH, …)
//  - the app locale has been set to Filipino ('fil')
//  - a manual override for testing from outside PH (see below)

// Lets the team (in Asia/Bangkok) exercise the PH-only flow: set
// localStorage.setItem('force_ph', '1') in the browser console, or append
// ?ph=1 to the URL once. Clear with localStorage.removeItem('force_ph').
const hasTestOverride = (): boolean => {
   try {
      if (typeof window === 'undefined') return false;
      const params = new URLSearchParams(window.location.search);
      if (params.get('ph') === '1') {
         window.localStorage?.setItem('force_ph', '1');
      }
      return window.localStorage?.getItem('force_ph') === '1';
   } catch {
      return false;
   }
};

const timezoneIsManila = (): boolean => {
   try {
      return Intl.DateTimeFormat().resolvedOptions().timeZone === 'Asia/Manila';
   } catch {
      return false;
   }
};

const hasPhLanguageRegion = (): boolean => {
   try {
      const tags = [...(navigator.languages ?? []), navigator.language].filter(Boolean);
      // Match the -PH region subtag (e.g. en-PH, fil-PH, tl-PH), case-insensitive.
      return tags.some((tag) => /-ph$/i.test(tag) || /-ph-/i.test(tag));
   } catch {
      return false;
   }
};

/**
 * True when the visitor looks like they're in the Philippines (our target
 * market). `locale` is the active app locale from useLocalization(); pass it so
 * a user who explicitly chose Filipino counts even on a mismatched device.
 */
export const isLikelyPhilippines = (locale?: string): boolean => {
   if (hasTestOverride()) return true;
   if (locale === 'fil') return true;
   return timezoneIsManila() || hasPhLanguageRegion();
};
