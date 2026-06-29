import { getAuthRedirectUrl } from '@/lib/authRedirect';

const LINE_AUTHORIZE_URL = 'https://access.line.me/oauth2/v2.1/authorize';

export const LINE_OAUTH_STATE_KEY = 'line_oauth_state';

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
 */
export function getLineRedirectUri(): string {
   return getAuthRedirectUrl('/auth/line/callback');
}

/**
 * Kicks off the LINE Login OAuth flow by redirecting the browser to LINE's
 * authorize endpoint. A random `state` is stored in sessionStorage for CSRF
 * protection and verified on the callback page.
 */
export function startLineLogin(): void {
   const channelId = getLineChannelId();
   const state = crypto.randomUUID();
   sessionStorage.setItem(LINE_OAUTH_STATE_KEY, state);

   const params = new URLSearchParams({
      response_type: 'code',
      client_id: channelId,
      redirect_uri: getLineRedirectUri(),
      state,
      scope: 'profile openid email'
   });

   window.location.href = `${LINE_AUTHORIZE_URL}?${params.toString()}`;
}
