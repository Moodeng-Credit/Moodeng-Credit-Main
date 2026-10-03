// Shared check for functions only the scheduler (pg_cron) or our own server code may call.
// Same rule as loan-due-notifications: the caller sends the internal secret as a bearer token or as
// x-notification-secret, matched against the env secret or the vault (verify_internal_notification_secret).
// The gateway's JWT check alone isn't enough: the public anon key is a valid project JWT.

// deno-lint-ignore no-explicit-any
type SupabaseClient = any;

const getRequestSecret = (req: Request) => {
   const authorization = req.headers.get('Authorization') ?? '';
   const bearerToken = authorization.replace(/^Bearer\s+/i, '').trim();
   return bearerToken || req.headers.get('x-notification-secret');
};

/** True only for the scheduler / our server. Checks x-notification-secret first, then the bearer token. */
export const isInternalRequest = async (supabase: SupabaseClient, req: Request): Promise<boolean> => {
   const candidates = [req.headers.get('x-notification-secret'), getRequestSecret(req)].filter(
      (value, index, all): value is string => Boolean(value) && all.indexOf(value) === index
   );
   const expected = Deno.env.get('SUPABASE_SECRET_KEY') ?? Deno.env.get('TELEGRAM_NOTIFICATION_SECRET');
   for (const candidate of candidates) {
      if (expected && candidate === expected) return true;
      const { data, error } = await supabase.rpc('verify_internal_notification_secret', { candidate });
      if (!error && data === true) return true;
   }
   return false;
};
