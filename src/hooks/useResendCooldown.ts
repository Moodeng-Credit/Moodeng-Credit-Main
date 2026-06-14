import { useCallback, useEffect, useState } from 'react';

const RESEND_COOLDOWN_MS = 60_000;

function readSecondsLeft(storageKey: string): number {
   if (typeof window === 'undefined') return 0;
   try {
      const availableAt = Number(window.localStorage.getItem(storageKey)) || 0;
      return Math.max(0, Math.ceil((availableAt - Date.now()) / 1000));
   } catch {
      return 0;
   }
}

/**
 * Hard-lock countdown for "resend code" style buttons.
 *
 * Requesting a new password-reset code invalidates the previous one, so a user who
 * impatiently spams resend can break the very code already on its way to their inbox.
 * This enforces a 60s cooldown that:
 *   - disables the button the instant a code is sent,
 *   - never resets backward, and
 *   - survives tab switches and page refreshes (timestamp persisted in localStorage).
 */
export function useResendCooldown(storageKey: string) {
   // Hydrate synchronously from localStorage so a page that loads while the cooldown
   // is active renders its locked state immediately, instead of flashing the
   // unlocked state for one frame until the effect below catches up.
   const [secondsLeft, setSecondsLeft] = useState(() => readSecondsLeft(storageKey));

   const recompute = useCallback(() => {
      const remaining = readSecondsLeft(storageKey);
      setSecondsLeft(remaining);
      return remaining;
   }, [storageKey]);

   const startCooldown = useCallback(() => {
      if (typeof window === 'undefined') return;
      const availableAt = Date.now() + RESEND_COOLDOWN_MS;
      try {
         window.localStorage.setItem(storageKey, String(availableAt));
      } catch {
         // Storage unavailable — fall back to in-memory countdown for this session.
      }
      setSecondsLeft(Math.ceil(RESEND_COOLDOWN_MS / 1000));
   }, [storageKey]);

   useEffect(() => {
      recompute();
      const interval = window.setInterval(recompute, 1000);
      const onFocus = () => recompute();
      window.addEventListener('focus', onFocus);
      document.addEventListener('visibilitychange', onFocus);
      return () => {
         window.clearInterval(interval);
         window.removeEventListener('focus', onFocus);
         document.removeEventListener('visibilitychange', onFocus);
      };
   }, [recompute]);

   return { secondsLeft, isCoolingDown: secondsLeft > 0, startCooldown };
}
