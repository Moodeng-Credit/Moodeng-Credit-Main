import { type JSX, useEffect, useState } from 'react';

import { useNavigate } from 'react-router-dom';

import Loading from '@/components/Loading';
import { setLastUsedAuth } from '@/lib/lastUsedAuth';
import { clearLineState, getLineRedirectUri, readLineState } from '@/lib/lineAuth';
import { getSupabaseBrowserClient } from '@/lib/supabase/client';

export default function LineCallbackPage(): JSX.Element {
   const navigate = useNavigate();
   const [error, setError] = useState<string | null>(null);

   useEffect(() => {
      const run = async () => {
         const params = new URLSearchParams(window.location.search);
         const code = params.get('code');
         const state = params.get('state');
         const lineError = params.get('error_description') || params.get('error');

         if (lineError) {
            setError(lineError);
            return;
         }

         const expectedState = readLineState();
         clearLineState();

         if (!code) {
            setError('Missing LINE authorization code. Please try again.');
            return;
         }
         if (!state || !expectedState || state !== expectedState) {
            setError('LINE login state mismatch. Please try again.');
            return;
         }

         const supabase = getSupabaseBrowserClient();

         const { data, error: fnError } = await supabase.functions.invoke('line-login', {
            body: { code, redirectUri: getLineRedirectUri() }
         });

         if (fnError) {
            setError(fnError.message || 'LINE login failed.');
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

         setLastUsedAuth('line');

         const { data: sessionData } = await supabase.auth.getSession();
         const userId = sessionData?.session?.user?.id;

         if (userId) {
            const { data: profile } = await supabase
               .from('users')
               .select('username')
               .eq('id', userId)
               .maybeSingle();

            if (profile?.username) {
               navigate('/dashboard', { replace: true });
            } else {
               navigate('/onboarding/role', { replace: true });
            }
         } else {
            navigate('/onboarding/role', { replace: true });
         }
      };

      run().catch((err: unknown) => {
         setError(err instanceof Error ? err.message : 'Unexpected error during LINE login.');
      });
   }, [navigate]);

   if (error) {
      return (
         <div className="flex min-h-screen flex-col items-center justify-center gap-4 px-6 text-center">
            <p className="text-lg font-semibold text-red-600">LINE login failed</p>
            <p className="text-sm text-gray-600">{error}</p>
            <a href="/sign-in" className="text-sm font-medium text-[#6010D2] underline">
               Back to sign in
            </a>
         </div>
      );
   }

   return <Loading />;
}
