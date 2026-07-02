import type { IDKitErrorCodes, IDKitResult } from '@worldcoin/idkit';

export type WorldIdRequestStatus = {
   type: string;
   result?: IDKitResult;
   error?: IDKitErrorCodes;
};

export type PreparedWorldIdRequest = {
   connectorURI: string;
   pollOnce: () => Promise<WorldIdRequestStatus>;
   /** Epoch ms after which the request's rp signature is too close to expiry to launch safely. */
   usableUntilMs: number;
};

/**
 * The backend signs rp signatures with a 5-minute TTL (DEFAULT_RP_SIGNATURE_TTL_SEC in
 * supabase/functions/verify-worldid). A request launched near that deadline expires while the
 * user is still inside World App, so treat requests as stale this long before the real expiry.
 */
export const REQUEST_EXPIRY_SAFETY_MS = 30_000;

/** How long before a cached request goes stale that we proactively create a fresh one. */
export const REQUEST_KEEP_WARM_LEAD_MS = 60_000;

export const getRequestUsableUntilMs = (rpExpiresAtSec: number) => rpExpiresAtSec * 1000 - REQUEST_EXPIRY_SAFETY_MS;

export const isPreparedRequestStale = (request: Pick<PreparedWorldIdRequest, 'usableUntilMs'>, nowMs = Date.now()) =>
   request.usableUntilMs <= nowMs;

/**
 * iOS Safari will not hand a World ID universal link to the installed World App when the
 * navigation happens inside a programmatically opened tab (`window.open`). It treats it as a
 * plain web navigation and falls back to the App Store / an "Open with World" prompt that goes
 * nowhere. On iOS we must navigate the current tab in direct response to the tap instead.
 */
export const isIOSDevice = () =>
   typeof navigator !== 'undefined' &&
   (/iP(hone|ad|od)/.test(navigator.userAgent) ||
      (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1));

export const isAndroidDevice = () => typeof navigator !== 'undefined' && /Android/i.test(navigator.userAgent);

// Mobile browsers (iOS + Android) only hand a World ID universal link to the installed
// World App when the navigation happens on the current tab in direct response to the tap.
// A programmatic new tab/popup is downgraded to the App Store / Play Store fallback page —
// the "sent me to the Play Store, then a second attempt opened the app" double-launch bug.
export const needsCurrentTabWorldAppLaunch = () => isIOSDevice() || isAndroidDevice();

/**
 * `return_to` target for World App. Uses the current URL with a marker fragment: if World App
 * bounces the user back by navigating this same tab, a fragment-only change does not reload the
 * SPA, so the in-flight poll loop (and all verification state) survives the round trip.
 */
export const buildWorldIdReturnToUrl = (href: string) => {
   try {
      const url = new URL(href);
      url.hash = 'worldid-return';
      return url.toString();
   } catch {
      return href;
   }
};
