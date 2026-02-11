const isProduction = import.meta.env.MODE === 'production';

const COOKIE_CONFIG = {
   name: 'token',
   path: '/',
   httpOnly: true,
   sameSite: isProduction ? 'None' : 'Lax',
   secure: isProduction
} as const;

function buildCookieString(includeHttpOnly: boolean, value = '', includeExpiry = false): string {
   const { name, path, httpOnly, sameSite, secure } = COOKIE_CONFIG;
   const parts = [
      `${name}=${value}`,
      `Path=${path}`,
      includeExpiry && 'Expires=Thu, 01 Jan 1970 00:00:00 GMT',
      includeExpiry && 'Max-Age=0',
      includeHttpOnly && httpOnly && 'HttpOnly',
      secure && 'Secure',
      `SameSite=${sameSite}`
   ].filter(Boolean);

   return parts.join('; ');
}

export function setAuthCookie(response: Response, token: string): void {
   response.headers.set('Set-Cookie', buildCookieString(true, token));
}

export function clearAuthCookie(response: Response): void {
   response.headers.set('Set-Cookie', buildCookieString(true, '', true));
}

export function clearAuthCookieClient(): void {
   if (typeof document !== 'undefined') {
      document.cookie = buildCookieString(false, '', true);
   }
}
