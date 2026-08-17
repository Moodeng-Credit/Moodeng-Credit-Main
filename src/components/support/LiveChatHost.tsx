import { useEffect, useRef } from 'react';

import { useSelector } from 'react-redux';
import { useLocation } from 'react-router-dom';

import { useToast } from '@/components/ToastSystem/hooks/useToast';
import { TOAST_TYPES } from '@/components/ToastSystem/types';

import {
   hideSupportLauncher,
   identifySupport,
   isSupportChatEnabled,
   loadSupportChat,
   onSupportMessageReceived,
   resetSupportSession,
   showSupportLauncher
} from '@/lib/support/liveChat';
import type { RootState } from '@/store/store';

// Always-mounted host for the live chat widget — the replacement for
// <MechaLauncher />. It owns three jobs and nothing else:
//
//   1. load the widget once the app is idle (never on the critical path),
//   2. keep the chat session tagged with who the borrower is, so an agent
//      opening the conversation already sees their wallet, verification state
//      and credit level instead of asking for them,
//   3. surface an agent's reply as an in-app toast, not just a widget badge.
//
// The launcher bubble itself is the vendor's own — its colours, avatar, greeting
// and availability text are configured in the support dashboard rather than
// here, so support copy can change without a deploy. The whole component is
// inert when live chat is unconfigured (see isSupportChatEnabled).

// The persistent launcher bubble belongs on the help destinations — /support
// (the "Help & Support Center" that the lender dashboard, request board, history
// and most in-app "help" links point at) and /help (the answers hub). Everywhere
// else it stays hidden and support is *summoned* — via openSupportChat() from the
// "Ask us" error buttons, the support-contacts modal, and an operator-reply toast
// — rather than following the borrower around every screen. A chat bubble you
// can't dismiss on a page you didn't ask for help on reads as spam, not support.
const SHOW_LAUNCHER_PREFIXES = ['/support', '/help'];

export default function LiveChatHost(): null {
   const location = useLocation();
   const { showToast } = useToast();
   const user = useSelector((state: RootState) => state.auth.user);
   const isAuthChecked = useSelector((state: RootState) => state.auth.isAuthChecked);

   // Load once the browser is idle so the widget never competes with first paint
   // on the low-end Android handsets most of our borrowers are on.
   useEffect(() => {
      if (!isSupportChatEnabled) return;
      const idle = window.requestIdleCallback?.(() => loadSupportChat(), { timeout: 4000 });
      const timer = idle === undefined ? window.setTimeout(loadSupportChat, 2500) : undefined;
      return () => {
         if (idle !== undefined) window.cancelIdleCallback?.(idle);
         if (timer !== undefined) window.clearTimeout(timer);
      };
   }, []);

   // An agent replied. The widget already badges its own launcher, but a badge on
   // a collapsed bubble is easy to miss — this is the "there's a message waiting"
   // signal the borrower actually notices, and tapping it opens the thread.
   const showToastRef = useRef(showToast);
   showToastRef.current = showToast;
   useEffect(() => {
      if (!isSupportChatEnabled) return;
      onSupportMessageReceived(() => {
         // buttonAction is a string action key dispatched by handleToastAction —
         // NOT a callback. 'open_support_chat' maps there to openSupportChat().
         showToastRef.current(
            TOAST_TYPES.INFO,
            'Message from Moodeng Support',
            'The team replied to your chat. Tap to read it.',
            'Open chat',
            'open_support_chat'
         );
      });
   }, []);

   // Show the persistent launcher only on the help hub; hide it everywhere else.
   // openSupportChat() still summons the widget on demand from any screen (error
   // cards, the support modal, the reply toast), so support is always one tap
   // away — it just isn't a bubble parked on top of every unrelated page.
   useEffect(() => {
      if (!isSupportChatEnabled) return;
      if (SHOW_LAUNCHER_PREFIXES.some((prefix) => location.pathname.startsWith(prefix))) {
         showSupportLauncher();
      } else {
         hideSupportLauncher();
      }
   }, [location.pathname]);

   // Identity sync. Runs on login and on any profile change that an agent would
   // care about; `isAuthChecked` gates it so we don't tag the session with the
   // empty default user during boot.
   useEffect(() => {
      if (!isSupportChatEnabled || !isAuthChecked || !user?.id) return;
      identifySupport({
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
      if (previousUserId.current && !currentUserId) resetSupportSession();
      previousUserId.current = currentUserId;
   }, [isAuthChecked, user?.id]);

   return null;
}
