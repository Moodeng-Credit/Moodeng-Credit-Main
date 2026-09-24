/**
 * True on hosts where in-progress "preview" affordances (e.g. the dashboard v2
 * state-switcher bar) should be shown: local dev and Vercel preview deploys.
 * On the real production domain (moodeng.app) this is false, so those
 * team-only controls stay hidden from real users.
 */
export const isPreviewHost = (): boolean => {
   if (import.meta.env.DEV) return true;
   if (typeof window === 'undefined') return false;

   return window.location.hostname.endsWith('.vercel.app');
};
