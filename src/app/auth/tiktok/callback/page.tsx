import { type JSX, useEffect, useRef, useState } from 'react';

import { useNavigate } from 'react-router-dom';

import Loading from '@/components/Loading';
import { consumeAuthReturnTo } from '@/lib/authReturn';
import { setLastUsedAuth } from '@/lib/lastUsedAuth';
import { getSupabaseBrowserClient } from '@/lib/supabase/client';
import { consumeTikTokState, getTikTokRedirectUri } from '@/lib/tiktokAuth';

export default function TikTokCallbackPage(): JSX.Element {
   const navigate = useNavigate();
   const [error, setError] = useState<string | null>(null);
   // The auth code is single-use; guard against the effect running twice (StrictMode / remount).
   const handledRef = useRef(false);

   useEffect(() => {
      if (handledRef.current) return;
      handledRef.current = true;

      const run = async () => {
         const params = new URLSearchParams(window.location.search);
         const code = params.get('code');
         const state = params.get('state');
         const tiktokError = params.get('error_description') || params.get('error');

         if (tiktokError) {
            setError(tiktokError);
            return;
         }
         if (!code) {
            setError('Missing TikTok authorization code. Please try again.');
            return;
         }
         if (!consumeTikTokState(state)) {
            setError('TikTok login state mismatch. Please try again.');
            return;
         }

         const supabase = getSupabaseBrowserClient();

         const { data, error: fnError } = await supabase.functions.invoke('tiktok-login', {
            body: { code, redirectUri: getTikTokRedirectUri() }
         });

         if (fnError) {
            setError(fnError.message || 'TikTok login failed.');
            return;
         }
         if (data?.error) {
            setError(data.error as string);
            return;
         }

         const { error: sessionError } = await supabase.auth.setSession(data.session);
         if (sessionError) {
            setError(sessionError.message);
            return;
         }

         setLastUsedAuth('tiktok');

         // Started from the money-lesson page? Send them back there (full load: /stocks is a static page).
         const back = consumeAuthReturnTo();
         if (back) {
            window.location.replace(back);
            return;
         }

         const { data: sessionData } = await supabase.auth.getSession();
         const userId = sessionData?.session?.user?.id;

         if (userId) {
            const { data: profile } = await supabase.from('users').select('username').eq('id', userId).maybeSingle();
            navigate(profile?.username ? '/dashboard' : '/onboarding/role', { replace: true });
         } else {
            navigate('/onboarding/role', { replace: true });
         }
      };

      run().catch((err: unknown) => {
         setError(err instanceof Error ? err.message : 'Unexpected error during TikTok login.');
      });
   }, [navigate]);

   if (error) {
      return (
         <div className="flex min-h-screen flex-col items-center justify-center gap-4 px-6 text-center">
            <p className="text-lg font-semibold text-red-600">TikTok login failed</p>
            <p className="text-sm text-gray-600">{error}</p>
            <a href="/sign-in" className="text-sm font-medium text-[#6010D2] underline">
               Back to sign in
            </a>
         </div>
      );
   }

   return <Loading />;
}
