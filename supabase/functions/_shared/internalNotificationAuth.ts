type SupabaseRpcClient = {
   rpc: (name: string, args: Record<string, unknown>) => PromiseLike<{ data: unknown; error: { message: string } | null }>;
};

export type InternalAuthorizationResult =
   | { authorized: true; status: 200; error: null }
   | { authorized: false; status: 401 | 500; error: string };

export const getRequestSecret = (req: Request) => {
   const explicitSecret = req.headers.get('x-notification-secret')?.trim();
   if (explicitSecret) {
      return explicitSecret;
   }

   const apiKey = req.headers.get('apikey')?.trim();
   if (apiKey) {
      return apiKey;
   }

   const authorization = req.headers.get('Authorization') ?? '';
   const bearerToken = authorization.replace(/^Bearer\s+/i, '').trim();
   return bearerToken || null;
};

export const authorizeInternalRequest = async (supabase: SupabaseRpcClient, req: Request): Promise<InternalAuthorizationResult> => {
   const requestSecret = getRequestSecret(req);
   if (!requestSecret) {
      return { authorized: false, status: 401, error: 'Unauthorized' };
   }

   const expectedSecret =
      Deno.env.get('INTERNAL_NOTIFICATION_SECRET') ??
      Deno.env.get('MOODENG_INTERNAL_CRON_SECRET') ??
      Deno.env.get('SUPABASE_SECRET_KEY') ??
      Deno.env.get('TELEGRAM_NOTIFICATION_SECRET');
   if (expectedSecret && requestSecret === expectedSecret) {
      return { authorized: true, status: 200, error: null };
   }

   const { data, error } = await supabase.rpc('verify_internal_notification_secret', { candidate: requestSecret });
   if (error) {
      return { authorized: false, status: 500, error: error.message };
   }

   if (data !== true) {
      return { authorized: false, status: 401, error: 'Unauthorized' };
   }

   return { authorized: true, status: 200, error: null };
};
