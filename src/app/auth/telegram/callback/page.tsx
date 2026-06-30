import { type JSX, useEffect, useState } from 'react';

import { useNavigate } from 'react-router-dom';

import Loading from '@/components/Loading';
import { getSupabaseBrowserClient } from '@/lib/supabase/client';

export default function TelegramCallbackPage(): JSX.Element {
   const navigate = useNavigate();
   const [error, setError] = useState<string | null>(null);

   useEffect(() => {
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
            setError('Missing Telegram auth data. Please try again.');
            return;
         }

         const supabase = getSupabaseBrowserClient();

         const { data, error: fnError } = await supabase.functions.invoke('telegram-login', {
            body: { authData: params }
         });

         if (fnError) {
            setError(fnError.message || 'Telegram login failed.');
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
               navigate('/dashboard', { replace: true });
            } else {
               navigate('/onboarding/role', { replace: true });
            }
         } else {
            navigate('/onboarding/role', { replace: true });
         }
      };

      run().catch((err: unknown) => {
         setError(err instanceof Error ? err.message : 'Unexpected error during Telegram login.');
      });
   }, [navigate]);

   if (error) {
      return (
         <div className="flex min-h-screen flex-col items-center justify-center gap-4 px-6 text-center">
            <p className="text-lg font-semibold text-red-600">Telegram login failed</p>
            <p className="text-sm text-gray-600">{error}</p>
            <a href="/sign-in" className="text-sm font-medium text-[#6010D2] underline">
               Back to sign in
            </a>
         </div>
      );
   }

   return <Loading />;
}
