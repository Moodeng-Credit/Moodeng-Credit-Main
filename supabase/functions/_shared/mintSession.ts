// Server-side session minting for the social logins (Telegram, LINE).
//
// These logins used to sign the user in with a password derived from their provider id plus a prefix of
// a server secret. For Telegram that prefix was the start of the PUBLIC bot id, so anyone who knew a
// victim's Telegram id could compute the password and sign in with the public anon key. Now the edge
// function, having verified the provider's signature, mints the session itself: an admin magic-link
// token (never emailed) is exchanged for a session on the spot. No password is ever used; new accounts
// get a random one nobody knows.

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

// deno-lint-ignore no-explicit-any
type SupabaseClient = any;

const randomPassword = () => {
   const bytes = new Uint8Array(32);
   crypto.getRandomValues(bytes);
   return Array.from(bytes, (b) => b.toString(16).padStart(2, '0')).join('');
};

/** Creates the auth user if it doesn't exist yet (random, unknown password). Returns false if it already did. */
export const ensureAuthUser = async (admin: SupabaseClient, email: string, metadata: Record<string, unknown>): Promise<boolean> => {
   const { error } = await admin.auth.admin.createUser({ email, password: randomPassword(), email_confirm: true, user_metadata: metadata });
   if (!error) return true;
   if (/already (been )?registered|already exists|email_exists/i.test(error.message ?? '') || error.status === 422) return false;
   throw error;
};

/** A session for `email`, without a password. */
export const mintSession = async (admin: SupabaseClient, email: string) => {
   const { data: link, error: linkError } = await admin.auth.admin.generateLink({ type: 'magiclink', email });
   if (linkError) throw linkError;
   const tokenHash = link?.properties?.hashed_token;
   if (!tokenHash) throw new Error('Could not create a sign-in token');
   // Exchange on a throwaway client: verifyOtp switches the client it runs on to the user's session,
   // and the admin client must keep acting with the service key afterwards.
   const exchange = createClient(Deno.env.get('SUPABASE_URL') ?? '', Deno.env.get('SUPABASE_ANON_KEY') ?? '', {
      auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false }
   });
   const { data, error } = await exchange.auth.verifyOtp({ type: 'magiclink', token_hash: tokenHash });
   if (error) throw error;
   if (!data?.session) throw new Error('Could not create a session');
   return data.session;
};
