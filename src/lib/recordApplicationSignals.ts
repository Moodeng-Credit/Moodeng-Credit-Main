import { getSupabaseBrowserClient } from '@/lib/supabase/client';

// Captured at loan-application submit and sent to the record-application-signals
// edge function, which salts the device value and stores both under an
// admin-only table. Never throws into the caller — a borrower must always be
// able to submit a request even if location/fingerprinting fails or is blocked.

type GpsResult = {
   lat: number | null;
   lon: number | null;
   accuracy: number | null;
   status: 'granted' | 'denied' | 'unavailable' | 'timeout';
};

const captureGps = (): Promise<GpsResult> =>
   new Promise((resolve) => {
      if (typeof navigator === 'undefined' || !navigator.geolocation) {
         resolve({ lat: null, lon: null, accuracy: null, status: 'unavailable' });
         return;
      }
      navigator.geolocation.getCurrentPosition(
         (pos) =>
            resolve({
               lat: pos.coords.latitude,
               lon: pos.coords.longitude,
               accuracy: pos.coords.accuracy,
               status: 'granted'
            }),
         (err) =>
            resolve({
               lat: null,
               lon: null,
               accuracy: null,
               status:
                  err.code === err.PERMISSION_DENIED
                     ? 'denied'
                     : err.code === err.TIMEOUT
                       ? 'timeout'
                       : 'unavailable'
            }),
         { enableHighAccuracy: true, timeout: 10000, maximumAge: 0 }
      );
   });

// ThumbmarkJS is loaded lazily so it never weighs down the main bundle — it's
// only needed at the moment of a loan application.
const captureDevice = async (): Promise<string | null> => {
   try {
      const { getThumbmark } = await import('@thumbmarkjs/thumbmarkjs');
      const result = await getThumbmark();
      return result?.thumbmark && result.thumbmark.length > 0 ? result.thumbmark : null;
   } catch {
      return null;
   }
};

/**
 * Fire-and-forget: capture this application's GPS fix + device fingerprint and
 * attach them to the given loan for out-of-band fraud review. Soft-require —
 * a denied/blocked permission still records the *reason* and never blocks the
 * loan. Safe to call after the loan row exists; never throws into the caller.
 */
export const recordApplicationSignals = async (loanId: string): Promise<void> => {
   try {
      const [gps, deviceRaw] = await Promise.all([captureGps(), captureDevice()]);
      const supabase = getSupabaseBrowserClient();
      await supabase.functions
         .invoke('record-application-signals', {
            body: {
               loanId,
               lat: gps.lat,
               lon: gps.lon,
               accuracy: gps.accuracy,
               gpsStatus: gps.status,
               deviceRaw
            }
         })
         .catch(() => undefined);
   } catch {
      // Never let signal capture affect the loan flow.
   }
};
