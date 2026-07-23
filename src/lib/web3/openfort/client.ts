// The Openfort SDK singleton.
//
// One instance per tab. Auth is wired declaratively via `thirdPartyAuth`: Openfort
// pulls the user's *existing* Supabase access token through `getAccessToken` whenever
// it needs to authenticate, so there's no second login and no token-mint edge function —
// the borrower's Moodeng session IS their wallet identity. Openfort deterministically
// derives (or recovers) one non-custodial smart account per Supabase user id.

// NB: the SDK's runtime ESM exports this enum only under the aliased name `ThirdPartyOAuthProvider`
// (`ThirdPartyAuthProvider as ThirdPartyOAuthProvider`), even though its .d.ts also exposes the bare
// name — importing the bare name typechecks but throws at runtime. Use the exported alias.
import { Openfort, ThirdPartyOAuthProvider } from '@openfort/openfort-js';

import { getSupabaseBrowserClient, isSupabaseBrowserConfigured } from '@/lib/supabase/client';
import { OPENFORT_PUBLISHABLE_KEY, OPENFORT_SHIELD_PUBLISHABLE_KEY } from '@/lib/web3/openfort/config';

let client: Openfort | null = null;

/**
 * Returns the shared Openfort client, constructing it lazily on first use so the SDK's
 * storage/iframe setup never runs during module load (or in non-browser contexts).
 *
 * `getAccessToken` returns the live Supabase access token, or null when there's no
 * session — Openfort treats null as "not authenticated yet", which is exactly right
 * before the user has logged into Moodeng.
 */
export const getOpenfortClient = (): Openfort => {
   if (client) return client;

   client = new Openfort({
      baseConfiguration: { publishableKey: OPENFORT_PUBLISHABLE_KEY },
      shieldConfiguration: { shieldPublishableKey: OPENFORT_SHIELD_PUBLISHABLE_KEY },
      thirdPartyAuth: {
         provider: ThirdPartyOAuthProvider.SUPABASE,
         getAccessToken: async () => {
            if (!isSupabaseBrowserConfigured()) return null;
            const {
               data: { session }
            } = await getSupabaseBrowserClient().auth.getSession();
            return session?.access_token ?? null;
         }
      }
   });

   return client;
};
