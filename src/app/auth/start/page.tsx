import { type JSX, useEffect, useRef, useState } from 'react';

import { useParams, useSearchParams } from 'react-router-dom';

import Loading from '@/components/Loading';
import { isAllowedReturnPath, setAuthReturnTo } from '@/lib/authReturn';
import { isLineConfigured, startLineLogin } from '@/lib/lineAuth';
import { isTikTokConfigured, startTikTokLogin } from '@/lib/tiktokAuth';

/**
 * /auth/start/:provider?next=/stocks — a doorway into a social login for pages that are not part of the React app
 * (the static money-lesson page). It remembers where to come back to, then starts the provider's OAuth redirect.
 */
export default function AuthStartPage(): JSX.Element {
   const { provider } = useParams<{ provider: string }>();
   const [searchParams] = useSearchParams();
   const [message, setMessage] = useState<string | null>(null);
   const startedRef = useRef(false);

   useEffect(() => {
      if (startedRef.current) return;
      startedRef.current = true;

      const next = searchParams.get('next');
      if (isAllowedReturnPath(next)) setAuthReturnTo(next);

      if (provider === 'tiktok') {
         if (isTikTokConfigured()) startTikTokLogin();
         else setMessage('TikTok login is not switched on yet. Please use LINE or email for now.');
      } else if (provider === 'line') {
         if (isLineConfigured()) startLineLogin();
         else setMessage('LINE login is not available here. Please use another sign-in method.');
      } else {
         setMessage('Unknown sign-in method.');
      }
   }, [provider, searchParams]);

   if (message) {
      const back = isAllowedReturnPath(searchParams.get('next')) ? searchParams.get('next') : null;
      return (
         <div className="flex min-h-screen flex-col items-center justify-center gap-4 px-6 text-center">
            <p className="text-lg font-semibold text-[#141218]">Sign-in unavailable</p>
            <p className="text-sm text-gray-600">{message}</p>
            <a href="/sign-in" className="text-sm font-medium text-[#6010D2] underline">
               Go to sign in
            </a>
            {back ? (
               <a href={back} className="text-sm font-medium text-[#6010D2] underline">
                  Back to the lesson
               </a>
            ) : null}
         </div>
      );
   }

   return <Loading />;
}
