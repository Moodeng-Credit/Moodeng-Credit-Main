const LOCAL_HOSTS = new Set(['localhost', '127.0.0.1', '::1']);

export function getAuthRedirectUrl(path = '/auth/confirm'): string {
   if (typeof window !== 'undefined' && LOCAL_HOSTS.has(window.location.hostname)) {
      return `${window.location.origin}${path}`;
   }

   return import.meta.env.VITE_REDIRECT_URL || (typeof window !== 'undefined' ? `${window.location.origin}${path}` : `http://localhost:3000${path}`);
}
