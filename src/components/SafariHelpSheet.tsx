import { useEffect, useState } from 'react';

import posthog from 'posthog-js';

import MenuGuide from '@/components/MenuGuide';
import { detectInAppBrowser, SAFARI_HELP_EVENT } from '@/lib/inAppBrowser';

// "Open in Safari" anywhere in the app, inside Facebook's / Messenger's / Instagram's iPhone browser:
// that browser drops the Safari link, so openInSafari asks for the ⋯ guide (MenuGuide) instead, the
// two taps that do work. See openInSafari in src/lib/inAppBrowser.ts.
export default function SafariHelpSheet() {
   const [open, setOpen] = useState<{ copied: boolean } | null>(null);

   useEffect(() => {
      const onHelp = (event: Event) => {
         const detail = (event as CustomEvent<{ copied?: boolean }>).detail ?? {};
         setOpen({ copied: Boolean(detail.copied) });
         try {
            posthog.capture('safari_help_shown', { app: detectInAppBrowser().appName, copied: Boolean(detail.copied), page: window.location.pathname });
         } catch {
            // Analytics unavailable.
         }
      };
      window.addEventListener(SAFARI_HELP_EVENT, onHelp);
      return () => window.removeEventListener(SAFARI_HELP_EVENT, onHelp);
   }, []);

   if (!open) return null;

   return <MenuGuide linkCopied={open.copied} onClose={() => setOpen(null)} os="ios" />;
}
