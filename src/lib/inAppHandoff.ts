// Getting an iPhone borrower through the Messenger step inside Facebook's / Messenger's own browser,
// where every way out we tried is blocked (Emma, 2026-10-17): links to other apps (x-safari-https://,
// fb-messenger://) are dropped, the page's copy call is refused, and Safari shares none of this
// browser's storage, so a guest arriving there is signed out. See docs/IOS_INAPP_MESSENGER_PLAN.md.
import { MESSENGER_CODE_PATTERN } from '@/config/contactVerification';

export type CopyResult = { ok: boolean; method: 'exec' | 'clipboard' | 'none' };

// The old copy command, run synchronously inside the tap. Meta's iPhone browser refuses
// navigator.clipboard (nothing copied, no error shown), but this one still works there.
const execCopy = (text: string): boolean => {
   if (typeof document === 'undefined' || !document.body) return false;
   const field = document.createElement('textarea');
   field.value = text;
   field.setAttribute('readonly', '');
   // Off-screen, and 16px so iOS doesn't zoom the page while it's focused.
   field.style.cssText = 'position:fixed;top:0;left:-9999px;opacity:0;font-size:16px;';
   document.body.appendChild(field);
   const selection = document.getSelection();
   const previous = selection && selection.rangeCount > 0 ? selection.getRangeAt(0) : null;
   field.select();
   field.setSelectionRange(0, text.length);
   let ok = false;
   try {
      ok = document.execCommand('copy');
   } catch {
      ok = false;
   }
   document.body.removeChild(field);
   if (previous && selection) {
      selection.removeAllRanges();
      selection.addRange(previous);
   }
   return ok;
};

/**
 * Copy text from a tap, in whichever way this browser allows. Call it straight from the click handler
 * (before any await): both ways need the tap. Resolves `ok: false` when nothing was copied, so the
 * screen can say so instead of pretending.
 */
export const copyTextFromTap = async (text: string): Promise<CopyResult> => {
   if (execCopy(text)) return { ok: true, method: 'exec' };
   try {
      if (typeof navigator !== 'undefined' && navigator.clipboard?.writeText) {
         await navigator.clipboard.writeText(text);
         return { ok: true, method: 'clipboard' };
      }
   } catch {
      // Refused: fall through.
   }
   return { ok: false, method: 'none' };
};

/** True when this browser holds a Supabase session (the @supabase/ssr client keeps it in a cookie). */
export const hasStoredSession = (cookie: string = typeof document !== 'undefined' ? document.cookie : ''): boolean =>
   /(?:^|;\s*)sb-[a-z0-9]+-auth-token(?:\.0)?=/i.test(cookie);

/**
 * The query parameter the Messenger card adds to the page address while it shows the "⋯ → Open in
 * external browser" steps. Facebook's menu opens whatever address the page shows, so Safari arrives
 * with the code even though it can't see this browser's sign-in.
 */
export const FB_CODE_PARAM = 'fbcode';

/** The address to show while the steps are up: this page plus ?fbcode=<code>. */
export const buildArmedUrl = (href: string, code: string): string => {
   const url = new URL(href);
   url.searchParams.set(FB_CODE_PARAM, code);
   return `${url.pathname}${url.search}${url.hash}`;
};

/** The same address without ?fbcode (when the steps close). */
export const stripFbCode = (href: string): string => {
   const url = new URL(href);
   url.searchParams.delete(FB_CODE_PARAM);
   return `${url.pathname}${url.search}${url.hash}`;
};

/**
 * Run once at start-up, before the router: where an address carrying ?fbcode should really go.
 * - No sign-in here (Safari, opened from Facebook's ⋯ menu): our no-sign-in page for that code,
 *   /fb/<code>?from=fb, where the m.me link with the code confirms them by itself.
 * - Signed in (the in-app browser itself, e.g. after a reload): the same page without the parameter.
 * Returns null when there's nothing to do.
 */
export const resolveFbCodeAddress = (href: string, signedIn: boolean): string | null => {
   const url = new URL(href);
   const raw = url.searchParams.get(FB_CODE_PARAM);
   if (raw === null) return null;
   const code = raw.trim().toUpperCase();
   if (!signedIn && MESSENGER_CODE_PATTERN.test(code)) return `/fb/${code}?from=fb`;
   return stripFbCode(href);
};
