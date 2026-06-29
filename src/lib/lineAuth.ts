const LINE_AUTHORIZE_URL = 'https://access.line.me/oauth2/v2.1/authorize';

export const LINE_OAUTH_STATE_KEY = 'line_oauth_state';

/**
 * Cookie `domain` attribute so the state cookie is shared across every
 * moodeng.app subdomain (apex, dashboard, staging.dashboard). If login is ever
 * initiated on one subdomain and LINE returns to another, a host-only cookie
 * would be invisible to the callback and produce a spurious "state mismatch".
 *
 * Returns '' for hosts where a `.moodeng.app` cookie can't be set (localhost,
 * preview deploys) — there a host-only cookie is correct and a foreign domain
 * attribute would be silently rejected by the browser.
 */
function lineStateCookieDomain(): string {
   if (typeof window === 'undefined') return '';
   const host = window.location.hostname;
   return host === 'moodeng.app' || host.endsWith('.moodeng.app')
      ? '; domain=.moodeng.app'
      : '';
}

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

/**
 * Persist the CSRF `state` so the callback can verify it after the round-trip.
 *
 * Uses a cookie as the primary store because `sessionStorage` is NOT reliable
 * across an OAuth redirect on every browser (mobile in-app browsers / Safari can
 * return into a fresh tab where per-tab sessionStorage is empty, producing a
 * spurious "state mismatch"). A `SameSite=Lax` cookie is sent on the top-level
 * GET redirect back from LINE and survives those cases. sessionStorage/localStorage
 * are kept as belt-and-suspenders fallbacks.
 */
export function writeLineState(state: string): void {
   if (typeof document !== 'undefined') {
      // 10-minute lifetime; cleared on the callback. Lax so it rides the redirect back.
      document.cookie = `${LINE_OAUTH_STATE_KEY}=${state}; path=/; max-age=600; SameSite=Lax${lineStateCookieDomain()}`;
   }
   try {
      sessionStorage.setItem(LINE_OAUTH_STATE_KEY, state);
      localStorage.setItem(LINE_OAUTH_STATE_KEY, state);
   } catch {
      // storage disabled — cookie still covers us
   }
}

/** Read the stored CSRF state from any available store (cookie first). */
export function readLineState(): string | null {
   if (typeof document !== 'undefined') {
      const match = document.cookie.match(new RegExp(`(?:^|; )${LINE_OAUTH_STATE_KEY}=([^;]*)`));
      if (match?.[1]) return decodeURIComponent(match[1]);
   }
   try {
      return sessionStorage.getItem(LINE_OAUTH_STATE_KEY) ?? localStorage.getItem(LINE_OAUTH_STATE_KEY);
   } catch {
      return null;
   }
}

/** Clear the stored CSRF state from every store. */
export function clearLineState(): void {
   if (typeof document !== 'undefined') {
      document.cookie = `${LINE_OAUTH_STATE_KEY}=; path=/; max-age=0; SameSite=Lax${lineStateCookieDomain()}`;
   }
   try {
      sessionStorage.removeItem(LINE_OAUTH_STATE_KEY);
      localStorage.removeItem(LINE_OAUTH_STATE_KEY);
   } catch {
      // ignore
   }
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
