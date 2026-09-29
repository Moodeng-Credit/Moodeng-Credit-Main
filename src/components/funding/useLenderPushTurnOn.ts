import { useCallback, useEffect, useRef, useState } from 'react';

import type { PushRegistrationOutcome } from '@/lib/push/webPushClient';

export type TurnOnStatus = 'idle' | 'busy' | 'on' | 'error';

// Long enough to see the green check land before the popup closes itself.
const CLOSE_AFTER_ON_MS = 1500;

/**
 * The lender popups' "turn push on" tap. `enable()` only reports subscribed once our backend has
 * stored the subscription (register_push_subscription), so "on" means the server can really reach
 * this device, not just that the browser said yes. Declining the browser dialog just closes the
 * popup; a failed save says so instead of pretending it worked.
 */
export function useLenderPushTurnOn(enable: () => Promise<PushRegistrationOutcome>, onDone: () => void) {
   const [status, setStatus] = useState<TurnOnStatus>('idle');
   const closeTimer = useRef<number | null>(null);

   useEffect(
      () => () => {
         if (closeTimer.current !== null) window.clearTimeout(closeTimer.current);
      },
      []
   );

   const turnOn = useCallback(async () => {
      setStatus('busy');
      const outcome = await enable();
      if (outcome === 'subscribed' || outcome === 'already-subscribed') {
         setStatus('on');
         closeTimer.current = window.setTimeout(onDone, CLOSE_AFTER_ON_MS);
      } else if (outcome === 'failed') {
         setStatus('error');
      } else {
         onDone();
      }
   }, [enable, onDone]);

   return { status, turnOn };
}
