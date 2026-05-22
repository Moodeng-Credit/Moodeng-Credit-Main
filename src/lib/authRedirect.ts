const LOCAL_HOSTS = new Set(['localhost', '127.0.0.1', '::1']);

type RuntimeLocation = {
   hostname: string;
   origin: string;
};

export function buildAuthRedirectUrl(path = '/auth/confirm', configuredRedirectUrl?: string, currentLocation?: RuntimeLocation): string {
   const redirectPath = path.startsWith('/') ? path : `/${path}`;

   if (currentLocation && LOCAL_HOSTS.has(currentLocation.hostname)) {
      return `${currentLocation.origin}${redirectPath}`;
   }

   const fallbackOrigin = currentLocation?.origin ?? 'http://localhost:3000';

   if (!configuredRedirectUrl) {
      return `${fallbackOrigin}${redirectPath}`;
   }

   try {
      const redirectUrl = new URL(configuredRedirectUrl, fallbackOrigin);
      redirectUrl.pathname = redirectPath;
      redirectUrl.search = '';
      redirectUrl.hash = '';
      return redirectUrl.toString();
   } catch {
      return `${fallbackOrigin}${redirectPath}`;
   }
}

export function getAuthRedirectUrl(path = '/auth/confirm'): string {
   const currentLocation = typeof window !== 'undefined' ? window.location : undefined;
   const configuredRedirectUrl = import.meta.env.VITE_REDIRECT_URL as string | undefined;

   return buildAuthRedirectUrl(path, configuredRedirectUrl, currentLocation);
}
