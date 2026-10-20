import { useEffect, useRef } from 'react';

import { useDispatch } from 'react-redux';

import { logoutUser } from '@/store/slices/authSlice';
import type { AppDispatch } from '@/store/store';

// moodeng.app/sign-out — the static home page's "Sign out" button (public/landing/continue-banner.js).
// Signs out, then back to the home page.
export default function SignOutPage() {
   const dispatch = useDispatch<AppDispatch>();
   const started = useRef(false);

   useEffect(() => {
      if (started.current) return;
      started.current = true;
      void dispatch(logoutUser()).finally(() => window.location.replace('/'));
   }, [dispatch]);

   return (
      <div className="flex min-h-screen items-center justify-center bg-white dark:bg-[#08040f]">
         <img alt="" className="h-24 w-auto animate-pulse" src="/hippos/connect/hello.png" />
      </div>
   );
}
