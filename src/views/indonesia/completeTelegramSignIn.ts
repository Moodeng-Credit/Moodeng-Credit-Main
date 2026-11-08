import type { QueryClient } from '@tanstack/react-query';

import { ID_ONBOARDING_QUERY_KEY } from '@/hooks/useIdOnboarding';
import { ID_PATHS } from '@/lib/idTrack';
import { setLastUsedAuth } from '@/lib/lastUsedAuth';
import { getSupabaseBrowserClient } from '@/lib/supabase/client';
import { fetchUser } from '@/store/slices/authSlice';
import type { AppDispatch } from '@/store/store';
import { fetchIdTrackPath, reportIdStep } from '@/views/indonesia/idFlow';

/** Only our own pages: a path, never another site (no `//host`, no backslashes). */
export const safeNextPath = (raw: string | null | undefined): string | null =>
   // eslint-disable-next-line no-control-regex
   raw && raw.startsWith('/') && !raw.startsWith('//') && !raw.includes('\\') && !/[\u0000-\u001f\u007f]/.test(raw) ? raw : null;

/**
 * After a Telegram sign-in produced a session (website login callback, or the Telegram-app login on
 * /id): store it, and work out where they go next. From /id (`idIntent`) they join the Indonesia track
 * and land on its onboarding; otherwise the usual dashboard / role picker. Returns the path, or an
 * error message to show.
 */
export const completeTelegramSignIn = async ({
   session,
   idIntent,
   dispatch,
   queryClient,
   next
}: {
   session: { access_token: string; refresh_token: string };
   idIntent: boolean;
   dispatch: AppDispatch;
   queryClient: QueryClient;
   /** Where a bot button pointed (Telegram login_url → /auth/telegram/callback?next=…). */
   next?: string | null;
}): Promise<{ path: string } | { error: string }> => {
   const supabase = getSupabaseBrowserClient();
   const { error: sessionError } = await supabase.auth.setSession(session);
   if (sessionError) return { error: sessionError.message };

   setLastUsedAuth('telegram');

   // From /id (Indonesia track): make sure the profile row exists, join the track, and carry on to its
   // onboarding. Market-ID users are always borrowers, so no role picker.
   if (idIntent) {
      await dispatch(fetchUser())
         .unwrap()
         .catch(() => undefined);
      const { error: joinError } = await supabase.rpc('join_id_track');
      if (joinError) {
         const msg = joinError.message ?? '';
         // Already on the track (e.g. signing back in on a new phone) is fine.
         const onTrack = await fetchIdTrackPath().catch(() => null);
         if (onTrack) return { path: onTrack };
         const reason = msg.includes('id_track_closed')
            ? 'closed'
            : msg.includes('id_track_existing_borrower')
              ? 'existing'
              : msg.includes('lender')
                ? 'lender'
                : 'error';
         return { path: `${ID_PATHS.landing}?joined=${reason}` };
      }
      await dispatch(fetchUser())
         .unwrap()
         .catch(() => undefined);
      await queryClient.invalidateQueries({ queryKey: [ID_ONBOARDING_QUERY_KEY] });
      // Welcome + "next step" from the bot.
      void reportIdStep('telegram');
      return { path: ID_PATHS.onboarding };
   }

   // A bot button: straight to the page it named.
   const nextPath = safeNextPath(next);
   if (nextPath) {
      await dispatch(fetchUser())
         .unwrap()
         .catch(() => undefined);
      return { path: nextPath };
   }

   // Completed profile (username set) → the app; otherwise onboarding.
   const { data: sessionData } = await supabase.auth.getSession();
   const userId = sessionData?.session?.user?.id;
   if (userId) {
      const { data: profile } = await supabase.from('users').select('username').eq('id', userId).maybeSingle();
      if (profile?.username) {
         // Indonesia-track borrowers keep going through their own onboarding until it's done.
         const idPath = await fetchIdTrackPath();
         return { path: idPath ?? '/dashboard' };
      }
   }
   return { path: '/onboarding/role' };
};
