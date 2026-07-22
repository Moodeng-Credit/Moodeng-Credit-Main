// Detects when the Base Account sign-in page (keys.coinbase.com) is unreachable because the
// user's network is blocking it — not because the user is offline.
//
// Why this exists: in the Philippines, PLDT/Smart DNS-hijack `keys.coinbase.com` to a
// "prohibited access" block page. Its TLS cert is for pldtsmart.com.ph, so the browser sees a
// common-name mismatch (NET::ERR_CERT_COMMON_NAME_INVALID) and the Base Account popup opens to
// a dead white screen — wallet connect silently dead-ends. Switching WiFi→cellular doesn't help
// because Smart *is* PLDT's mobile network, so the same filter applies. The only fixes are a
// resolver that bypasses the block (Cloudflare 1.1.1.1 / WARP) or a different ISP.
//
// The probe is a no-cors GET: it resolves for ANY completed HTTP response (even a 404) and
// rejects only when the request fails at the network/TLS layer — exactly the DNS-hijack /
// cert-error signature. A same-origin control probe runs first so "the device is simply
// offline" is reported as `unknown` rather than misattributed to a Coinbase block.

export type CoinbaseKeysReachability = 'reachable' | 'blocked' | 'unknown';

// The exact host the Base Account SDK opens for signing (see src/lib/baseAccountPopup.ts).
const KEYS_PROBE_URL = 'https://keys.coinbase.com/favicon.ico';
const CONTROL_PROBE_PATH = '/favicon.ico';
const PROBE_TIMEOUT_MS = 6000;
const CACHE_KEY = 'moodeng_coinbase_keys_reachability';

function readCache(): CoinbaseKeysReachability | null {
   try {
      const value = sessionStorage.getItem(CACHE_KEY);
      return value === 'reachable' || value === 'blocked' ? value : null;
   } catch {
      return null;
   }
}

function writeCache(value: CoinbaseKeysReachability): void {
   if (value === 'unknown') return; // never cache a transient/offline result
   try {
      sessionStorage.setItem(CACHE_KEY, value);
   } catch {
      /* sessionStorage unavailable (private mode / blocked storage) — just re-probe next time */
   }
}

export function clearCoinbaseKeysReachabilityCache(): void {
   try {
      sessionStorage.removeItem(CACHE_KEY);
   } catch {
      /* ignore */
   }
}

// Resolves true when the request reaches the server and gets any HTTP response; false when it
// fails at the network/TLS layer or times out. `no-cors` keeps cross-origin probes legal (we
// never read the body) and `no-store` forces a real network hit instead of a cached response.
async function requestCompleted(url: string): Promise<boolean> {
   const controller = new AbortController();
   const timer = setTimeout(() => controller.abort(), PROBE_TIMEOUT_MS);
   try {
      await fetch(url, { mode: 'no-cors', cache: 'no-store', signal: controller.signal, redirect: 'follow' });
      return true;
   } catch {
      return false;
   } finally {
      clearTimeout(timer);
   }
}

/**
 * Check whether `keys.coinbase.com` is reachable from this device.
 * Result is cached per session; pass `force` (e.g. after the user installs a fix) to re-probe.
 */
export async function checkCoinbaseKeysReachability(force = false): Promise<CoinbaseKeysReachability> {
   if (typeof window === 'undefined' || typeof fetch === 'undefined') return 'unknown';

   if (!force) {
      const cached = readCache();
      if (cached) return cached;
   }

   // Control probe: is the device online at all? If our own origin is unreachable the device is
   // offline (or on a captive portal) — that's not a Coinbase block, so report `unknown`.
   const online = await requestCompleted(`${window.location.origin}${CONTROL_PROBE_PATH}`);
   if (!online) return 'unknown';

   const keysReachable = await requestCompleted(KEYS_PROBE_URL);
   const result: CoinbaseKeysReachability = keysReachable ? 'reachable' : 'blocked';
   writeCache(result);
   return result;
}
