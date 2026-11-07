import { type JSX, useEffect, useMemo, useState } from 'react';

import { useQueryClient } from '@tanstack/react-query';
import { useDispatch } from 'react-redux';
import { useNavigate } from 'react-router-dom';

import Loading from '@/components/Loading';

import { ID_ONBOARDING_QUERY_KEY } from '@/hooks/useIdOnboarding';
import { ID_PATHS } from '@/lib/idTrack';
import { setLastUsedAuth } from '@/lib/lastUsedAuth';
import { getSupabaseBrowserClient } from '@/lib/supabase/client';
import { fetchUser } from '@/store/slices/authSlice';
import type { AppDispatch } from '@/store/store';
import { clearIdTrackIntent, fetchIdTrackPath, hasIdTrackIntent, reportIdStep } from '@/views/indonesia/idFlow';

export default function TelegramCallbackPage(): JSX.Element {
   const navigate = useNavigate();
   const dispatch = useDispatch<AppDispatch>();
   const queryClient = useQueryClient();
   const [error, setError] = useState<string | null>(null);
   // Read once on arrival: every failure below clears the intent (so a stale /id tap can't turn a
   // later, unrelated Telegram sign-in into an Indonesia sign-up), but the error screen still needs it.
   const fromId = useMemo(() => hasIdTrackIntent(), []);

   useEffect(() => {
      const fail = (message: string) => {
         clearIdTrackIntent();
         setError(message);
      };
      const run = async () => {
         let params: Record<string, string> = Object.fromEntries(new URLSearchParams(window.location.search));

         // Telegram's OAuth redirect can return the signed payload either as query
         // params (?id=…&hash=…) or as a `#tgAuthResult=<base64 JSON>` fragment,
         // depending on the flow. Handle both so the plain-redirect tile works.
         if (!params.hash && window.location.hash) {
            const match = window.location.hash.match(/tgAuthResult=([^&]+)/);
            if (match) {
               try {
                  const b64 = decodeURIComponent(match[1]).replace(/-/g, '+').replace(/_/g, '/');
                  const padded = b64.padEnd(b64.length + ((4 - (b64.length % 4)) % 4), '=');
                  const decoded = JSON.parse(atob(padded)) as Record<string, unknown>;
                  params = Object.fromEntries(Object.entries(decoded).map(([key, value]) => [key, String(value)]));
               } catch {
                  // fall through to the missing-hash error below
               }
            }
         }

         if (!params.hash) {
            fail('Missing Telegram auth data. Please try again.');
            return;
         }

         const supabase = getSupabaseBrowserClient();

         const { data, error: fnError } = await supabase.functions.invoke('telegram-login', {
            body: { authData: params }
         });

         if (fnError) {
            fail(fnError.message || 'Telegram login failed.');
            return;
         }
         if (data?.error) {
            fail(data.error as string);
            return;
         }

         const { error: sessionError } = await supabase.auth.setSession(data.session);
         if (sessionError) {
            fail(sessionError.message);
            return;
         }

         setLastUsedAuth('telegram');

         // Came from /id (Indonesia track): make sure the profile row exists, join the track, and
         // carry on to its onboarding. Market-ID users are always borrowers, so no role picker.
         if (hasIdTrackIntent()) {
            clearIdTrackIntent();
            await dispatch(fetchUser())
               .unwrap()
               .catch(() => undefined);
            const { error: joinError } = await supabase.rpc('join_id_track');
            if (joinError) {
               const msg = joinError.message ?? '';
               const reason = msg.includes('id_track_closed')
                  ? 'closed'
                  : msg.includes('id_track_existing_borrower')
                    ? 'existing'
                    : msg.includes('lender')
                      ? 'lender'
                      : 'error';
               navigate(`${ID_PATHS.landing}?joined=${reason}`, { replace: true });
               return;
            }
            await dispatch(fetchUser())
               .unwrap()
               .catch(() => undefined);
            await queryClient.invalidateQueries({ queryKey: [ID_ONBOARDING_QUERY_KEY] });
            // Welcome + "next step" from the bot (only lands if they allowed bot messages).
            void reportIdStep('telegram');
            navigate(ID_PATHS.onboarding, { replace: true });
            return;
         }

         // Check whether the user has a completed profile (username set) to decide
         // whether to send them to onboarding or straight to the app.
         const { data: sessionData } = await supabase.auth.getSession();
         const userId = sessionData?.session?.user?.id;

         if (userId) {
            const { data: profile } = await supabase
               .from('users')
               .select('username')
               .eq('id', userId)
               .maybeSingle();

            if (profile?.username) {
               // Indonesia-track borrowers keep going through their own onboarding until it's done.
               const idPath = await fetchIdTrackPath();
               navigate(idPath ?? '/dashboard', { replace: true });
            } else {
               navigate('/onboarding/role', { replace: true });
            }
         } else {
            navigate('/onboarding/role', { replace: true });
         }
      };

      run().catch((err: unknown) => {
         fail(err instanceof Error ? err.message : 'Unexpected error during Telegram login.');
      });
   }, [navigate, dispatch, queryClient]);

   if (error) {
      // From /id: back to the Indonesian page (it has the Telegram button again), in Bahasa.
      return (
         <div className="flex min-h-screen flex-col items-center justify-center gap-4 px-6 text-center">
            <p className="text-lg font-semibold text-red-600">{fromId ? 'Login Telegram gagal' : 'Telegram login failed'}</p>
            <p className="text-sm text-gray-600">{error}</p>
            <a href={fromId ? ID_PATHS.landing : '/sign-in'} className="text-sm font-medium text-[#6010D2] underline">
               {fromId ? 'Coba lagi' : 'Back to sign in'}
            </a>
         </div>
      );
   }

   return <Loading />;
}
