import { useEffect, useRef } from 'react';

import { useSelector } from 'react-redux';
import { useLocation } from 'react-router-dom';

import { useToast } from '@/components/ToastSystem/hooks/useToast';
import { TOAST_TYPES } from '@/components/ToastSystem/types';

import { useLocalization } from '@/i18n';
import {
   hideCrispLauncher,
   identifyCrisp,
   isCrispEnabled,
   loadCrisp,
   onCrispMessageReceived,
   openSupportChat,
   resetCrispSession,
   setCrispLocale,
   showCrispLauncher
} from '@/lib/support/crisp';
import type { RootState } from '@/store/store';

// Always-mounted host for the Crisp chat widget — the replacement for
// <MechaLauncher />. It owns three jobs and nothing else:
//
//   1. load the widget once the app is idle (never on the critical path),
//   2. keep the Crisp session tagged with who the borrower is, so an operator
//      opening the conversation already sees their wallet, verification state
//      and credit level instead of asking for them,
//   3. surface an operator's reply as an in-app toast, not just a widget badge.
//
// The launcher bubble itself is Crisp's own — its colours, avatar, greeting and
// availability text are configured in the Crisp dashboard rather than here, so
// support copy can change without a deploy.

// Internal tooling: the widget has no business sitting over the admin console.
const HIDE_LAUNCHER_PREFIXES = ['/admin'];

export default function CrispChat(): null {
   const location = useLocation();
   const { locale } = useLocalization();
   const { showToast } = useToast();
   const user = useSelector((state: RootState) => state.auth.user);
   const isAuthChecked = useSelector((state: RootState) => state.auth.isAuthChecked);

   // Load once the browser is idle so the widget never competes with first paint
   // on the low-end Android handsets most of our borrowers are on.
   useEffect(() => {
      if (!isCrispEnabled) return;
      const idle = window.requestIdleCallback?.(() => loadCrisp(), { timeout: 4000 });
      const timer = idle === undefined ? window.setTimeout(loadCrisp, 2500) : undefined;
      return () => {
         if (idle !== undefined) window.cancelIdleCallback?.(idle);
         if (timer !== undefined) window.clearTimeout(timer);
      };
   }, []);

   // An operator replied. Crisp already badges its own launcher, but a badge on a
   // collapsed bubble is easy to miss — this is the "there's a message waiting"
   // signal the borrower actually notices, and tapping it opens the thread.
   const showToastRef = useRef(showToast);
   showToastRef.current = showToast;
   useEffect(() => {
      if (!isCrispEnabled) return;
      onCrispMessageReceived(() => {
         showToastRef.current(
            TOAST_TYPES.INFO,
            'Message from Moodeng Support',
            'The team replied to your chat. Tap to read it.',
            'Open chat',
            () => openSupportChat()
         );
      });
   }, []);

   // Match the widget chrome to the language the user picked in-app.
   useEffect(() => {
      setCrispLocale(locale);
   }, [locale]);

   // Keep the launcher out of the admin console, and restore it everywhere else.
   useEffect(() => {
      if (!isCrispEnabled) return;
      if (HIDE_LAUNCHER_PREFIXES.some((prefix) => location.pathname.startsWith(prefix))) {
         hideCrispLauncher();
      } else {
         showCrispLauncher();
      }
   }, [location.pathname]);

   // Identity sync. Runs on login and on any profile change that an operator
   // would care about; `isAuthChecked` gates it so we don't tag the session with
   // the empty default user during boot.
   useEffect(() => {
      if (!isCrispEnabled || !isAuthChecked || !user?.id) return;
      identifyCrisp({
         email: user.email,
         nickname: user.displayName || user.username,
         data: {
            user_id: user.id,
            username: user.username,
            role: user.userRole ?? 'unset',
            credit_level: user.cs,
            active_loans: user.nal,
            max_active_loans: user.mal,
            account_status: user.accountStatus ?? 'active',
            world_id: user.isWorldId,
            didit_kyc: user.isDidit ?? 'none',
            wallet: user.walletAddress ?? 'not connected',
            wallet_provider: user.walletProvider ?? 'none',
            telegram: user.telegramUsername ?? 'not linked',
            joined: user.createdAt
         },
         segments: [user.userRole ?? 'unset-role', user.walletAddress ? 'wallet-connected' : 'no-wallet']
      });
   }, [
      isAuthChecked,
      user?.id,
      user?.email,
      user?.username,
      user?.displayName,
      user?.userRole,
      user?.cs,
      user?.nal,
      user?.mal,
      user?.accountStatus,
      user?.isWorldId,
      user?.isDidit,
      user?.walletAddress,
      user?.walletProvider,
      user?.telegramUsername,
      user?.createdAt
   ]);

   // Logout: drop the thread so the next person on a shared phone — a normal case
   // for our borrowers — doesn't inherit the previous user's support history.
   const previousUserId = useRef<string>('');
   useEffect(() => {
      if (!isAuthChecked) return;
      const currentUserId = user?.id ?? '';
      if (previousUserId.current && !currentUserId) resetCrispSession();
      previousUserId.current = currentUserId;
   }, [isAuthChecked, user?.id]);

   return null;
}
