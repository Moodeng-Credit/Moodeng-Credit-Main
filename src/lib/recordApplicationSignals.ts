import { getSupabaseBrowserClient } from '@/lib/supabase/client';

// Captured at loan-application submit and sent to the record-application-signals
// edge function, which salts the device value and stores both under an
// admin-only table. Never throws into the caller — a borrower must always be
// able to submit a request even if location/fingerprinting fails or is blocked.

type GpsResult = {
   lat: number | null;
   lon: number | null;
   accuracy: number | null;
   // 'skipped' = the borrower declined our own priming step, so we never even
   // fired the browser prompt (distinct from 'denied' = they blocked it).
   status: 'granted' | 'denied' | 'unavailable' | 'timeout' | 'skipped';
};

export type CapturedSignals = { gps: GpsResult; deviceRaw: string | null };

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
               status: err.code === err.PERMISSION_DENIED ? 'denied' : err.code === err.TIMEOUT ? 'timeout' : 'unavailable'
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
 * Capture the application's device fingerprint (always, silent) and — only if
 * `wantGps` — the GPS fix. `wantGps` is driven by our own priming step: when the
 * borrower taps "Not now" we pass false and never fire the browser prompt.
 * Never throws.
 */
export const captureApplicationSignals = async (wantGps: boolean): Promise<CapturedSignals> => {
   try {
      const [gps, deviceRaw] = await Promise.all([
         wantGps ? captureGps() : Promise.resolve<GpsResult>({ lat: null, lon: null, accuracy: null, status: 'skipped' }),
         captureDevice()
      ]);
      return { gps, deviceRaw };
   } catch {
      return { gps: { lat: null, lon: null, accuracy: null, status: 'unavailable' }, deviceRaw: null };
   }
};

/**
 * Fire-and-forget: attach already-captured signals to the given loan. Safe to
 * call after the loan row exists; never throws into the caller.
 */
export const sendApplicationSignals = async (loanId: string, captured: CapturedSignals): Promise<void> => {
   try {
      const supabase = getSupabaseBrowserClient();
      await supabase.functions
         .invoke('record-application-signals', {
            body: {
               loanId,
               lat: captured.gps.lat,
               lon: captured.gps.lon,
               accuracy: captured.gps.accuracy,
               gpsStatus: captured.gps.status,
               deviceRaw: captured.deviceRaw
            }
         })
         .catch(() => undefined);
   } catch {
      // Never let signal capture affect the loan flow.
   }
};
