import { getSupabaseBrowserClient } from '@/lib/supabase/client';

// Throttle so the common auth chokepoint (which runs on every profile refresh)
// doesn't spam the edge function. One record per session per ~10 minutes is
// plenty for "borrower & lender from the same place" detection.
const THROTTLE_MS = 10 * 60 * 1000;
let lastRecordedAt = 0;

/**
 * Fire-and-forget: asks the backend to log a salted hash of this session's IP
 * (used only for out-of-band fraud detection — never the raw IP, never blocking).
 * Safe to call from any authenticated context; it never throws into the caller.
 */
export const recordSessionIp = (): void => {
   const now = Date.now();
   if (now - lastRecordedAt < THROTTLE_MS) return;
   lastRecordedAt = now;

   try {
      const supabase = getSupabaseBrowserClient();
      void supabase.functions.invoke('record-session-ip').catch(() => undefined);
   } catch {
      // Never let IP logging affect the auth flow.
   }
};
