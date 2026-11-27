import { useEffect, useState } from 'react';

import HippoStory from '@/app/screen/HippoStory';

// Shown while /onboarding/connect checks the account (user, Indonesia track, pre-KYC gate) instead of a
// blank page. PostHog, 2026-11-23: that page took ~7.6s at p75 on phones, and a white screen that long
// reads as "my phone is broken". Waits a beat first so a quick load doesn't flash the hippo.
const SHOW_AFTER_MS = 300;

export default function ConnectLoading() {
   const [show, setShow] = useState(false);
   useEffect(() => {
      const t = window.setTimeout(() => setShow(true), SHOW_AFTER_MS);
      return () => window.clearTimeout(t);
   }, []);
   return (
      <div className="connect-ui mx-auto flex min-h-screen w-full max-w-[440px] flex-col items-center justify-center bg-white px-4 dark:bg-[#100d17]">
         {show ? <HippoStory kind="grow" tone="light" /> : null}
      </div>
   );
}
