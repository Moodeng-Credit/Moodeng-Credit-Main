import type { ReactNode } from 'react';

import { Ellipsis, Share, SquarePlus } from 'lucide-react';

import { detectInAppBrowser } from '@/lib/inAppBrowser';

// iOS only allows web push from a site added to the Home Screen, and there's no API to add it for
// the user, so we show them how. Inside Facebook/Messenger/Instagram there's no Share → Add to Home
// Screen at all, so they first have to hop out to Safari.
const inlineIcon = 'mx-0.5 inline-block size-[18px] -translate-y-px align-middle text-[#6b55f7]';

export default function AddToHomeScreenSteps() {
   const inApp = detectInAppBrowser();
   const steps: { key: string; content: ReactNode }[] = [
      ...(inApp.isInApp
         ? [
              {
                 key: 'safari',
                 content: (
                    <>
                       Tap <Ellipsis className={inlineIcon} aria-label="the ••• menu" /> {inApp.appName ? `in ${inApp.appName} ` : ''}and
                       choose <b>Open in Safari</b>.
                    </>
                 )
              }
           ]
         : []),
      {
         key: 'share',
         content: (
            <>
               Tap the <b>Share</b> button <Share className={inlineIcon} aria-hidden="true" /> in Safari’s toolbar.
            </>
         )
      },
      {
         key: 'add-to-home',
         content: (
            <>
               Scroll down and tap <b>Add to Home Screen</b> <SquarePlus className={inlineIcon} aria-hidden="true" />.
            </>
         )
      },
      {
         key: 'add',
         content: (
            <>
               Tap <b>Add</b> in the top right.
            </>
         )
      },
      {
         key: 'turn-on',
         content: (
            <>
               Open <b>Moodeng</b> from your Home Screen and tap <b>Turn On</b>.
            </>
         )
      }
   ];

   return (
      <ol className="w-full space-y-3 text-left">
         {steps.map((step, index) => (
            <li key={step.key} className="flex items-start gap-3 text-[16px] leading-[22px] text-[#594d65]">
               <span className="flex size-[26px] shrink-0 items-center justify-center rounded-full bg-[#efeaff] text-[14px] font-bold text-[#6b55f7]">
                  {index + 1}
               </span>
               <span className="pt-0.5">{step.content}</span>
            </li>
         ))}
      </ol>
   );
}
