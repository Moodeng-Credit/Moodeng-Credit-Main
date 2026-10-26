// "For the best experience, open Moodeng in Chrome / Safari" — the first screen inside Facebook's,
// Messenger's and Instagram's own browsers, before sign-up (George, 2026-10-18). Leaving for the real
// browser at the very start costs nothing (there's no account yet), while leaving later loses a guest's
// sign-in, so it's only offered to people who aren't signed in. "Continue here" keeps everyone.
// The static home page shows the same screen (public/landing/open-in-browser.js) and shares the
// "continue here" choice through localStorage. Switch: telegram_bot_settings.iab_open_prompt_enabled.

import type { InAppBrowserInfo } from '@/lib/inAppBrowser';

/** Set (to a timestamp) when they tap "Continue here": don't ask again in this browser. */
export const IAB_CONTINUE_KEY = 'md_iab_continue';
/** Added to the address handed to Chrome / Safari, so we can count who actually arrived there. */
export const IAB_ARRIVED_PARAM = 'ia';

const META_APPS = new Set(['Facebook', 'Messenger', 'Instagram']);
const PROMPT_PATHS = new Set(['/sign-in', '/sign-up']);

export const shouldShowOpenInBrowserPrompt = (params: {
   info: InAppBrowserInfo;
   signedIn: boolean;
   continuedHere: boolean;
   enabled: boolean;
   pathname: string;
}): boolean =>
   params.enabled &&
   !params.signedIn &&
   !params.continuedHere &&
   params.info.isInApp &&
   params.info.appName !== null &&
   META_APPS.has(params.info.appName) &&
   (params.info.os === 'android' || params.info.os === 'ios') &&
   PROMPT_PATHS.has(params.pathname.replace(/\/+$/, '') || '/');

/** This address plus ?ia=1 (kept when Facebook's menu opens it in Chrome / Safari). */
export const withArrivedTag = (href: string): string => {
   const url = new URL(href);
   url.searchParams.set(IAB_ARRIVED_PARAM, '1');
   return url.toString();
};

/**
 * The address handed to Chrome / Safari: this page, tagged ?ia=1, carrying the Facebook post's ?src=
 * (saved on the first visit) when the address no longer has it: Chrome can't see this browser's storage.
 */
export const handoffAddress = (href: string): string => {
   const url = new URL(withArrivedTag(href));
   if (!url.searchParams.get('src')) {
      try {
         const saved = JSON.parse(window.localStorage.getItem('md_first_touch') ?? 'null') as { src?: string | null } | null;
         if (saved?.src) url.searchParams.set('src', saved.src);
      } catch {
         // Storage blocked or unreadable: no post tag.
      }
   }
   return url.toString();
};

/** The same address without ?ia. */
export const withoutArrivedTag = (href: string): string => {
   const url = new URL(href);
   url.searchParams.delete(IAB_ARRIVED_PARAM);
   return `${url.pathname}${url.search}${url.hash}`;
};

export const readContinuedHere = (): boolean => {
   try {
      return Boolean(window.localStorage.getItem(IAB_CONTINUE_KEY));
   } catch {
      return false;
   }
};

export const rememberContinuedHere = () => {
   try {
      window.localStorage.setItem(IAB_CONTINUE_KEY, String(Date.now()));
   } catch {
      // Storage blocked: they may see it once more on another page.
   }
};
