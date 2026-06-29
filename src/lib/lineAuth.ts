const LINE_AUTHORIZE_URL = 'https://access.line.me/oauth2/v2.1/authorize';

export const LINE_OAUTH_STATE_KEY = 'line_oauth_state';

/** Max number of concurrent in-flight login states we remember at once. */
const MAX_TRACKED_STATES = 10;

/** Public LINE Login channel id (safe to expose to the browser). */
export function getLineChannelId(): string {
   const id = import.meta.env.VITE_LINE_CHANNEL_ID as string | undefined;
   return typeof id === 'string' ? id.trim() : '';
}

export function isLineConfigured(): boolean {
   const id = getLineChannelId();
   return id.length > 0 && !id.startsWith('encrypted:');
}

/**
 * Exact redirect URI registered in the LINE Developers console. Must match
 * byte-for-byte between the authorize request and the token exchange.
 *
 * Built from the CURRENT origin (not VITE_REDIRECT_URL) so the OAuth round-trip
 * returns to the same origin that initiated it. Every origin we serve from
 * (localhost, staging.dashboard.moodeng.app, dashboard.moodeng.app, moodeng.app)
 * is registered in the LINE console.
 */
export function getLineRedirectUri(): string {
   const origin = typeof window !== 'undefined' ? window.location.origin : '';
   return `${origin}/auth/line/callback`;
}

// --- state persistence -------------------------------------------------------
//
// We persist a SET of recently-issued CSRF states, not a single value. A single
// shared slot (one cookie / one localStorage key) cannot survive *concurrent*
// logins: opening LINE login in a second tab overwrites the first tab's state,
// so when the first tab returns its `state` no longer matches and the callback
// reports a spurious "state mismatch". Tracking a small rolling set lets every
// in-flight login round-trip independently while keeping CSRF protection (the
// returned state must still have been minted by THIS browser, is high-entropy,
// and is short-lived).
//
// Storage layers, in order of reliability across an OAuth redirect:
//   - cookie:        SameSite=Lax, sent on the top-level GET redirect back from
//                    LINE; survives returns into a fresh tab where per-tab
//                    sessionStorage would be empty.
//   - localStorage:  shared across tabs, survives reloads.
//   - sessionStorage: belt-and-suspenders for the same-tab case.
// States are comma-joined; UUIDs contain no commas so no escaping is needed.

function cookieAttributes(): string {
   const secure =
      typeof window !== 'undefined' && window.location.protocol === 'https:' ? '; Secure' : '';
   // 10-minute lifetime. Lax so the cookie rides the redirect back from LINE.
   return `; path=/; max-age=600; SameSite=Lax${secure}`;
}

function readCookieStates(): string[] {
   if (typeof document === 'undefined') return [];
   const match = document.cookie.match(new RegExp(`(?:^|; )${LINE_OAUTH_STATE_KEY}=([^;]*)`));
   if (!match?.[1]) return [];
   return decodeURIComponent(match[1]).split(',').filter(Boolean);
}

function readStorageStates(store: Storage | undefined): string[] {
   try {
      const raw = store?.getItem(LINE_OAUTH_STATE_KEY);
      return raw ? raw.split(',').filter(Boolean) : [];
   } catch {
      return [];
   }
}

/** Union of every known state across all stores. */
function readAllStates(): string[] {
   const all = [
      ...readCookieStates(),
      ...readStorageStates(typeof localStorage !== 'undefined' ? localStorage : undefined),
      ...readStorageStates(typeof sessionStorage !== 'undefined' ? sessionStorage : undefined)
   ];
   return Array.from(new Set(all));
}

/** Overwrite every store with `states` (empty array clears them). */
function persistStates(states: string[]): void {
   const value = states.join(',');
   if (typeof document !== 'undefined') {
      if (states.length === 0) {
         document.cookie = `${LINE_OAUTH_STATE_KEY}=${cookieAttributes().replace('max-age=600', 'max-age=0')}`;
      } else {
         document.cookie = `${LINE_OAUTH_STATE_KEY}=${value}${cookieAttributes()}`;
      }
   }
   try {
      if (states.length === 0) {
         localStorage.removeItem(LINE_OAUTH_STATE_KEY);
         sessionStorage.removeItem(LINE_OAUTH_STATE_KEY);
      } else {
         localStorage.setItem(LINE_OAUTH_STATE_KEY, value);
         sessionStorage.setItem(LINE_OAUTH_STATE_KEY, value);
      }
   } catch {
      // storage disabled — cookie still covers us
   }
}

/** Remember a freshly-issued CSRF `state` (kept alongside other in-flight ones). */
export function writeLineState(state: string): void {
   const next = [...readAllStates().filter((s) => s !== state), state].slice(-MAX_TRACKED_STATES);
   persistStates(next);
}

/**
 * Verify a returned `state` and consume it (one-time use). Returns true if the
 * state was one we issued. Other in-flight states are preserved so logins in
 * other tabs can still complete.
 */
export function consumeLineState(returned: string | null | undefined): boolean {
   if (!returned) return false;
   const all = readAllStates();
   if (!all.includes(returned)) return false;
   persistStates(all.filter((s) => s !== returned));
   return true;
}

/** Clear every stored CSRF state (e.g. on hard logout). */
export function clearLineState(): void {
   persistStates([]);
}

/**
 * Kicks off the LINE Login OAuth flow by redirecting the browser to LINE's
 * authorize endpoint. A random `state` is stored (cookie + storage) for CSRF
 * protection and verified on the callback page.
 */
export function startLineLogin(): void {
   const channelId = getLineChannelId();
   const state = crypto.randomUUID();
   writeLineState(state);

   const params = new URLSearchParams({
      response_type: 'code',
      client_id: channelId,
      redirect_uri: getLineRedirectUri(),
      state,
      scope: 'profile openid email'
   });

   window.location.href = `${LINE_AUTHORIZE_URL}?${params.toString()}`;
}
