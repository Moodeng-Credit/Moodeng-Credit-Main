// Signed unsubscribe links for Admin → Campaigns emails. The token is an HMAC of the user id, so a
// link only ever unsubscribes the person it was sent to. Keyed by UNSUBSCRIBE_SECRET when set, else
// the service-role key (present in every function, never sent to clients).

const SUPABASE_URL = (Deno.env.get('SUPABASE_URL') ?? '').replace(/\/$/, '');

const keyBytes = () => new TextEncoder().encode(Deno.env.get('UNSUBSCRIBE_SECRET') || Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || '');

const toBase64Url = (bytes: Uint8Array) =>
   btoa(String.fromCharCode(...bytes))
      .replace(/\+/g, '-')
      .replace(/\//g, '_')
      .replace(/=+$/, '');

export const unsubscribeToken = async (userId: string): Promise<string> => {
   const key = await crypto.subtle.importKey('raw', keyBytes(), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
   const sig = new Uint8Array(await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(`unsubscribe:${userId}`)));
   return toBase64Url(sig.slice(0, 18));
};

// Constant-time compare, so the check doesn't leak how much of a guessed token was right.
export const isValidUnsubscribeToken = async (userId: string, token: string): Promise<boolean> => {
   const expected = await unsubscribeToken(userId);
   if (token.length !== expected.length) return false;
   let diff = 0;
   for (let i = 0; i < expected.length; i++) diff |= expected.charCodeAt(i) ^ token.charCodeAt(i);
   return diff === 0;
};

export const unsubscribeUrl = async (userId: string) =>
   `${SUPABASE_URL}/functions/v1/email-unsubscribe?u=${encodeURIComponent(userId)}&t=${await unsubscribeToken(userId)}`;
