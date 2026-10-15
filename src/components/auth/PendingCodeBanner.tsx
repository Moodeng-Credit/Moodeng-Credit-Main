import { useEffect, useState } from 'react';

import { ChevronRight, X } from 'lucide-react';
import { useSelector } from 'react-redux';
import { Link, useLocation } from 'react-router-dom';

import { buildEmailConfirmationPath, buildPhoneCodePath } from '@/lib/authPaths';
import { clearPendingCode, type PendingCode, readPendingCode } from '@/lib/pendingCode';
import type { RootState } from '@/store/store';

/**
 * "Finish logging in: enter your code". Facebook's browser often kills the page while someone
 * reads their texts/email; when they come back (to the landing page, sign-in, anywhere) and are
 * not signed in, this takes them back to the code screen for the next 10 minutes.
 */
export function PendingCodeBanner() {
   const location = useLocation();
   const isSignedIn = useSelector((state: RootState) => Boolean(state.auth.user?.id));
   const [pending, setPending] = useState<PendingCode | null>(() => readPendingCode());

   useEffect(() => {
      setPending(readPendingCode());
   }, [location.pathname]);

   if (!pending || isSignedIn || location.pathname.startsWith('/auth/')) return null;

   const to = pending.channel === 'sms' ? buildPhoneCodePath(pending.target) : buildEmailConfirmationPath(pending.target);

   return (
      <div className="fixed inset-x-0 top-0 z-[70] flex justify-center px-3 pt-[max(env(safe-area-inset-top),8px)]">
         <div className="flex w-full max-w-[440px] items-center gap-2 rounded-2xl bg-[#250650] py-2 pl-4 pr-2 text-white shadow-[0_8px_24px_rgba(36,14,62,0.25)]">
            <Link to={to} className="flex min-w-0 flex-1 items-center gap-1 text-sm font-semibold">
               <span className="truncate">Finish logging in: enter your code</span>
               <ChevronRight className="h-4 w-4 shrink-0" aria-hidden />
            </Link>
            <button
               type="button"
               aria-label="Dismiss"
               onClick={() => {
                  clearPendingCode();
                  setPending(null);
               }}
               className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full hover:bg-white/10"
            >
               <X className="h-4 w-4" />
            </button>
         </div>
      </div>
   );
}
