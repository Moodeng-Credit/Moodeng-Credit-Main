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

/** Server-set marker (app_metadata[key] = value) that this login made or already claimed the account. */
export type LoginOwner = { key: 'telegram_id' | 'line_id'; value: string };

/**
 * A session for `email`, without a password.
 *
 * With `owner`: an existing account that this login didn't make could have been pre-registered by
 * someone else (sign up as telegram_<victim id>@moodeng.app, or as the victim's LINE email, with a
 * password of their choosing). Signing the real person into it would hand that password-holder their
 * account, so first wipe the password and end every session on it. A real email the owner already
 * confirmed is left alone: that's their own account, reached through LINE.
 */
export const mintSession = async (admin: SupabaseClient, email: string, owner?: LoginOwner) => {
   const { data: link, error: linkError } = await admin.auth.admin.generateLink({ type: 'magiclink', email });
   if (linkError) throw linkError;
   const existing = link?.user;
   if (owner && existing?.id && existing.app_metadata?.[owner.key] !== owner.value) {
      const synthetic = /@moodeng\.(app|credit)$/i.test(email);
      if (synthetic || !existing.email_confirmed_at) {
         const { error: resetError } = await admin.auth.admin.updateUserById(existing.id, { password: randomPassword() });
         if (resetError) throw resetError;
         const { error: revokeError } = await admin.rpc('revoke_auth_sessions', { p_user_id: existing.id });
         if (revokeError) throw revokeError;
      }
   }
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
