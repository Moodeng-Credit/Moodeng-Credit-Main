const TIKTOK_AUTHORIZE_URL = 'https://www.tiktok.com/v2/auth/authorize/';

export const TIKTOK_OAUTH_STATE_KEY = 'tiktok_oauth_state';

/** Max number of concurrent in-flight login states we remember at once. */
const MAX_TRACKED_STATES = 10;

/**
 * Public TikTok Login Kit client key (safe to expose to the browser; the client SECRET stays server-side in the
 * tiktok-login edge function). Currently the Sandbox app's key: it only works for the Sandbox target users until
 * TikTok approves the Production app, then swap in the Production key (and TIKTOK_CLIENT_KEY/SECRET in Supabase).
 */
const TIKTOK_CLIENT_KEY = 'sbaww8ikhon8a2tvwm';

/**
 * Show TikTok buttons to everyone. Keep false while on the Sandbox key (other people's logins would fail);
 * until then the buttons only appear after visiting any page with ?tiktok=1 (cleared with ?tiktok=0).
 * Keep in sync with public/landing/auth-providers.json.
 */
const TIKTOK_PUBLIC = false;
export const TIKTOK_TEST_FLAG_KEY = 'moodeng:tiktok-test';

export function getTikTokClientKey(): string {
   const key = import.meta.env.VITE_TIKTOK_CLIENT_KEY as string | undefined;
   const fromEnv = typeof key === 'string' ? key.trim() : '';
   return fromEnv && !fromEnv.startsWith('encrypted:') ? fromEnv : TIKTOK_CLIENT_KEY;
}

export function isTikTokConfigured(): boolean {
   const key = getTikTokClientKey();
   return key.length > 0 && !key.startsWith('encrypted:');
}

/** Whether to show TikTok login buttons: everyone once TIKTOK_PUBLIC is on, otherwise only testers (?tiktok=1). */
export function isTikTokButtonVisible(): boolean {
   if (!isTikTokConfigured()) return false;
   if (TIKTOK_PUBLIC) return true;
   try {
      const flag = new URLSearchParams(window.location.search).get('tiktok');
      if (flag === '1') localStorage.setItem(TIKTOK_TEST_FLAG_KEY, '1');
      if (flag === '0') localStorage.removeItem(TIKTOK_TEST_FLAG_KEY);
      return localStorage.getItem(TIKTOK_TEST_FLAG_KEY) === '1';
   } catch {
      return false;
   }
}

/**
 * Exact redirect URI registered in the TikTok developer portal. It must match byte-for-byte between the
 * authorize request and the token exchange, and TikTok only accepts https URIs — so TikTok login can only
 * be completed on a registered https origin (never localhost).
 */
export function getTikTokRedirectUri(): string {
   const origin = typeof window !== 'undefined' ? window.location.origin : '';
   return `${origin}/auth/tiktok/callback`;
}

// CSRF state: a small rolling SET of recently issued states (not a single slot), kept in a cookie, localStorage
// and sessionStorage, so logins started in two tabs don't invalidate each other. Same approach as lineAuth.ts.

function cookieAttributes(): string {
   const secure = typeof window !== 'undefined' && window.location.protocol === 'https:' ? '; Secure' : '';
   return `; path=/; max-age=600; SameSite=Lax${secure}`;
}

function readCookieStates(): string[] {
   if (typeof document === 'undefined') return [];
   const match = document.cookie.match(new RegExp(`(?:^|; )${TIKTOK_OAUTH_STATE_KEY}=([^;]*)`));
   if (!match?.[1]) return [];
   return decodeURIComponent(match[1]).split(',').filter(Boolean);
}

function readStorageStates(store: Storage | undefined): string[] {
   try {
      const raw = store?.getItem(TIKTOK_OAUTH_STATE_KEY);
      return raw ? raw.split(',').filter(Boolean) : [];
   } catch {
      return [];
   }
}

function readAllStates(): string[] {
   return Array.from(
      new Set([
         ...readCookieStates(),
         ...readStorageStates(typeof localStorage !== 'undefined' ? localStorage : undefined),
         ...readStorageStates(typeof sessionStorage !== 'undefined' ? sessionStorage : undefined)
      ])
   );
}

function persistStates(states: string[]): void {
   const value = states.join(',');
   if (typeof document !== 'undefined') {
      document.cookie =
         states.length === 0
            ? `${TIKTOK_OAUTH_STATE_KEY}=${cookieAttributes().replace('max-age=600', 'max-age=0')}`
            : `${TIKTOK_OAUTH_STATE_KEY}=${value}${cookieAttributes()}`;
   }
   try {
      if (states.length === 0) {
         localStorage.removeItem(TIKTOK_OAUTH_STATE_KEY);
         sessionStorage.removeItem(TIKTOK_OAUTH_STATE_KEY);
      } else {
         localStorage.setItem(TIKTOK_OAUTH_STATE_KEY, value);
         sessionStorage.setItem(TIKTOK_OAUTH_STATE_KEY, value);
      }
   } catch {
      // storage disabled — the cookie still covers us
   }
}

export function writeTikTokState(state: string): void {
   persistStates([...readAllStates().filter((s) => s !== state), state].slice(-MAX_TRACKED_STATES));
}

/** Verify a returned `state` and consume it (one-time use). True only if THIS browser issued it. */
export function consumeTikTokState(returned: string | null | undefined): boolean {
   if (!returned) return false;
   const all = readAllStates();
   if (!all.includes(returned)) return false;
   persistStates(all.filter((s) => s !== returned));
   return true;
}

/** Redirects the browser to TikTok's authorize page. Scope `user.info.basic` = open id, display name, avatar. */
export function startTikTokLogin(): void {
   const state = crypto.randomUUID();
   writeTikTokState(state);

   const params = new URLSearchParams({
      client_key: getTikTokClientKey(),
      scope: 'user.info.basic',
      response_type: 'code',
      redirect_uri: getTikTokRedirectUri(),
      state
   });

   window.location.href = `${TIKTOK_AUTHORIZE_URL}?${params.toString()}`;
}
