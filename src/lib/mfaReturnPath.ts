export const MFA_DEFAULT_RETURN_PATH = '/dashboard';

/**
 * Resolves where to send a user after they clear the MFA challenge.
 *
 * ProtectedRoute stashes the blocked location in router state, but that value must never be
 * trusted as-is: anything that isn't a plain internal path (protocol-relative `//evil.com`,
 * an absolute URL, a backslash-smuggled host) has to collapse to the dashboard, or the
 * challenge screen becomes an open-redirect once a user clears 2FA.
 */
export function safeMfaReturnPath(from: unknown): string {
   if (!from || typeof from !== 'object') return MFA_DEFAULT_RETURN_PATH;

   const { pathname, search } = from as { pathname?: unknown; search?: unknown };
   if (typeof pathname !== 'string' || pathname.length === 0) return MFA_DEFAULT_RETURN_PATH;

   // Must be a single-slash-rooted path. `//host` and `/\host` are both browser-resolvable
   // as remote origins, so they are rejected rather than normalized.
   if (!pathname.startsWith('/')) return MFA_DEFAULT_RETURN_PATH;
   if (pathname.startsWith('//') || pathname.startsWith('/\\')) return MFA_DEFAULT_RETURN_PATH;

   // A path carrying its own scheme or authority never came from our router.
   if (/^\/+[a-z][a-z0-9+.-]*:/i.test(pathname) || pathname.includes('://')) return MFA_DEFAULT_RETURN_PATH;

   // Never bounce the user straight back into the challenge they just cleared.
   if (pathname === '/mfa-challenge') return MFA_DEFAULT_RETURN_PATH;

   const suffix = typeof search === 'string' && search.startsWith('?') ? search : '';
   return `${pathname}${suffix}`;
}
