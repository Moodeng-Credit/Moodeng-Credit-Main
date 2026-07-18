// Detects when the app is running inside a social/messaging in-app browser (a WebView),
// e.g. the browser embedded in Facebook, Messenger, Instagram, LINE or TikTok.
//
// Why this matters: Google deliberately blocks OAuth from embedded WebViews (it returns
// `403: disallowed_useragent`), and wallet deep-links (Base/Coinbase) don't return control
// to a WebView either. So users who open our link from a Messenger/Facebook post hit a dead
// end at sign-in. The only real fix is to get them out into the system browser — this module
// provides the detection and the break-out.

export type MobileOs = 'ios' | 'android' | 'other';

export interface InAppBrowserInfo {
   /** True when we believe the page is inside an embedded WebView rather than a real browser. */
   isInApp: boolean;
   os: MobileOs;
   /** Human-readable host app when we can name it (e.g. "Messenger"), else null. */
   appName: string | null;
   /**
    * True only when we can programmatically force the user out (Android via an intent URL).
    * On iOS there is no reliable API to hand off to Safari, so the UI must show instructions.
    */
   canBreakOut: boolean;
}

function detectOs(ua: string): MobileOs {
   if (/iPhone|iPad|iPod/i.test(ua)) return 'ios';
   if (/Android/i.test(ua)) return 'android';
   return 'other';
}

// Ordered most-specific first: Messenger's UA also contains the Facebook (FBAN/FBAV) markers,
// so it must be tested before the generic Facebook check.
function detectAppName(ua: string): string | null {
   if (/\bFBAN\/Messenger|MessengerForiOS|MessengerLite|\bMessenger\//i.test(ua)) return 'Messenger';
   if (/\bFBAN|\bFBAV|FB_IAB|FB4A|FBIOS/i.test(ua)) return 'Facebook';
   if (/Instagram/i.test(ua)) return 'Instagram';
   if (/\bLine\//i.test(ua)) return 'LINE';
   if (/musical_ly|Bytedance|TikTok|BytedanceWebview/i.test(ua)) return 'TikTok';
   if (/Twitter/i.test(ua)) return 'X (Twitter)';
   if (/Snapchat/i.test(ua)) return 'Snapchat';
   if (/KAKAOTALK/i.test(ua)) return 'KakaoTalk';
   return null;
}

/**
 * Inspect a user-agent string and decide whether we're in an in-app browser.
 * Accepts an explicit `userAgent` for testing; defaults to `navigator.userAgent`.
 */
export function detectInAppBrowser(userAgent?: string): InAppBrowserInfo {
   const ua = userAgent ?? (typeof navigator !== 'undefined' ? navigator.userAgent : '');
   const os = detectOs(ua);
   const appName = detectAppName(ua);

   // A named social app is a definite in-app browser. As a fallback, the Android WebView
   // marker "; wv" also indicates an embedded browser even when the host app isn't named.
   const isAndroidWebView = os === 'android' && /;\s*wv\b/i.test(ua);
   const isInApp = appName !== null || isAndroidWebView;

   return {
      isInApp,
      os,
      appName,
      canBreakOut: isInApp && os === 'android'
   };
}

/**
 * Build an Android `intent://` URL that opens the given https URL in Chrome, falling back to
 * the default browser (or the Play Store) if Chrome isn't installed.
 */
export function buildAndroidIntentUrl(url: string): string {
   const parsed = new URL(url);
   const hostAndPath = `${parsed.host}${parsed.pathname}${parsed.search}${parsed.hash}`;
   const fallback = encodeURIComponent(url);
   return `intent://${hostAndPath}#Intent;scheme=https;package=com.android.chrome;S.browser_fallback_url=${fallback};end`;
}

/**
 * Attempt to open `url` in the system browser, escaping the current WebView.
 * Returns true if a hand-off was attempted (Android intent), false when the caller should
 * instead show manual instructions (iOS and everything else can't be forced).
 */
export function openInSystemBrowser(url: string, info?: InAppBrowserInfo): boolean {
   if (typeof window === 'undefined') return false;
   const detected = info ?? detectInAppBrowser();

   if (detected.os === 'android') {
      try {
         window.location.href = buildAndroidIntentUrl(url);
         return true;
      } catch {
         return false;
      }
   }

   return false;
}
