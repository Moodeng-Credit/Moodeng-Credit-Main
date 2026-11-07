import { type JSX, useCallback, useEffect, useMemo, useState } from 'react';

import { useQueryClient } from '@tanstack/react-query';
import { useDispatch } from 'react-redux';
import { useNavigate } from 'react-router-dom';

import Loading from '@/components/Loading';

import { ID_PATHS } from '@/lib/idTrack';
import { getSupabaseBrowserClient } from '@/lib/supabase/client';
import { takeTelegramCallback } from '@/lib/telegramCallbackStash';
import type { AppDispatch } from '@/store/store';
import { completeTelegramSignIn } from '@/views/indonesia/completeTelegramSignIn';
import { clearIdTrackIntent, hasIdTrackIntent } from '@/views/indonesia/idFlow';

export default function TelegramCallbackPage(): JSX.Element {
   const navigate = useNavigate();
   const dispatch = useDispatch<AppDispatch>();
   const queryClient = useQueryClient();
   const [error, setError] = useState<string | null>(null);
   // Read once on arrival: every failure below clears the intent (so a stale /id tap can't turn a
   // later, unrelated Telegram sign-in into an Indonesia sign-up), but the error screen still needs it.
   const fromId = useMemo(() => hasIdTrackIntent(), []);

   const [pendingSwitch, setPendingSwitch] = useState<{
      session: { access_token: string; refresh_token: string };
      idIntent: boolean;
      next: string | null;
      username: string;
   } | null>(null);

   const finish = useCallback(
      async (session: { access_token: string; refresh_token: string }, idIntent: boolean, next: string | null) => {
         const result = await completeTelegramSignIn({ session, idIntent, dispatch, queryClient, next });
         if ('error' in result) {
            clearIdTrackIntent();
            setError(result.error);
            return;
         }
         navigate(result.path, { replace: true });
      },
      [dispatch, queryClient, navigate]
   );

   useEffect(() => {
      const fail = (message: string) => {
         clearIdTrackIntent();
         setError(message);
      };
      const run = async () => {
         const stashed = takeTelegramCallback();
         let params: Record<string, string> = Object.fromEntries(new URLSearchParams(stashed.search));

         // Telegram's OAuth redirect can return the signed payload either as query
         // params (?id=…&hash=…) or as a `#tgAuthResult=<base64 JSON>` fragment,
         // depending on the flow. Handle both so the plain-redirect tile works.
         if (!params.hash && stashed.hash) {
            const match = stashed.hash.match(/tgAuthResult=([^&]+)/);
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

         // `next` is ours (bot buttons), not part of Telegram's signed data.
         const { next: nextParam, ...authData } = params;
         const { data, error: fnError } = await supabase.functions.invoke('telegram-login', {
            body: { authData }
         });

         if (fnError) {
            fail(fnError.message || 'Telegram login failed.');
            return;
         }
         if (data?.error) {
            fail(data.error as string);
            return;
         }

         const idIntent = hasIdTrackIntent();
         clearIdTrackIntent();
         const next = nextParam ?? new URLSearchParams(window.location.search).get('next');
         // Already signed in as someone else here? Ask before switching accounts (someone could send a
         // link that signs this browser into THEIR account).
         const { data: current } = await supabase.auth.getSession();
         const incomingId = (data.session as { user?: { id?: string } }).user?.id;
         if (current.session && incomingId && current.session.user.id !== incomingId) {
            setPendingSwitch({ session: data.session, idIntent, next, username: params.username ?? params.first_name ?? '' });
            return;
         }
         await finish(data.session, idIntent, next);
      };

      run().catch((err: unknown) => {
         fail(err instanceof Error ? err.message : 'Unexpected error during Telegram login.');
      });
   }, [navigate, dispatch, queryClient, finish]);

   if (pendingSwitch) {
      const who = pendingSwitch.username ? `@${pendingSwitch.username}` : 'Telegram';
      return (
         <div className="flex min-h-screen flex-col items-center justify-center gap-4 px-6 text-center">
            <p className="text-lg font-semibold">Ganti akun? · Switch account?</p>
            <p className="text-sm text-gray-600">
               Kamu sedang masuk dengan akun lain. Lanjut akan keluar dan masuk sebagai {who}.
               <br />
               You’re signed in to another account here. Continuing signs you in as {who} instead.
            </p>
            <div className="flex gap-3">
               <button
                  type="button"
                  className="rounded-xl bg-[#6010D2] px-4 py-2 text-sm font-semibold text-white"
                  onClick={() => {
                     const p = pendingSwitch;
                     setPendingSwitch(null);
                     void finish(p.session, p.idIntent, p.next);
                  }}
               >
                  Lanjut · Continue
               </button>
               <button type="button" className="rounded-xl border px-4 py-2 text-sm font-semibold" onClick={() => navigate('/dashboard', { replace: true })}>
                  Batal · Cancel
               </button>
            </div>
         </div>
      );
   }

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
