import { useEffect, useMemo, useState } from 'react';

import { Facebook, X } from 'lucide-react';
import posthog from 'posthog-js';
import { useSelector } from 'react-redux';

import { useToast } from '@/components/ToastSystem/hooks/useToast';
import { TOAST_TYPES } from '@/components/ToastSystem/types';

import { getAuthRedirectUrl } from '@/lib/authRedirect';
import { isFacebookPrimaryHere } from '@/lib/facebookAuth';
import {
   FACEBOOK_CONNECT_COPY,
   type FacebookConnectLanguage,
   facebookConnectErrorText,
   markFacebookConnectPending,
   takeFacebookConnectResult
} from '@/lib/facebookConnect';
import { detectInAppBrowser } from '@/lib/inAppBrowser';
import { getSupabaseBrowserClient } from '@/lib/supabase/client';
import type { RootState } from '@/store/store';

const DISMISS_KEY = 'moodeng:fb-connect-dismissed';
const DISMISS_FOR_MS = 7 * 24 * 60 * 60 * 1000;

function track(event: string, props: Record<string, unknown> = {}) {
   if (!import.meta.env.PROD) return;
   const inApp = detectInAppBrowser();
   posthog.capture(event, { app: inApp.appName ?? 'browser', os: inApp.os, ...props });
}

function readDismissed(userId: string): boolean {
   try {
      const at = Number(window.localStorage.getItem(`${DISMISS_KEY}:${userId}`));
      return Number.isFinite(at) && at > 0 && Date.now() - at < DISMISS_FOR_MS;
   } catch {
      return false;
   }
}

/**
 * Dashboard card: "Next time, just tap Facebook" → attaches Facebook to the account the borrower is in
 * now (see lib/facebookConnect). Shown only where Facebook login works (isFacebookPrimaryHere: normal
 * browsers + Facebook/Messenger/Instagram, not TikTok/LINE/Telegram web views) and only while the
 * account has no Facebook yet. After the trip, the result is checked against the server (getUserIdentities
 * calls /user), not the cached session — /auth/confirm keeps the existing session on the way back.
 *
 * If "Confirm email" is ever turned OFF, the takeover guard (20261016120000) wipes the password and
 * sessions of an account with an unproven email when ANY OAuth identity is linked — this card included.
 */
export function ConnectFacebookLoginCard({ language }: { language: FacebookConnectLanguage }) {
   const { showToast } = useToast();
   const userId = useSelector((state: RootState) => state.auth.user?.id);
   const copy = FACEBOOK_CONNECT_COPY[language];
   const allowedHere = useMemo(() => isFacebookPrimaryHere(detectInAppBrowser()), []);
   const [state, setState] = useState<'checking' | 'show' | 'hidden'>('checking');
   const [isWorking, setIsWorking] = useState(false);
   const [error, setError] = useState('');

   useEffect(() => {
      if (!userId) return;
      let cancelled = false;
      (async () => {
         const result = takeFacebookConnectResult();
         const { data, error: identitiesError } = await getSupabaseBrowserClient().auth.getUserIdentities();
         if (cancelled) return;
         if (identitiesError || !data) {
            setState('hidden');
            return;
         }
         const hasFacebook = data.identities.some((identity) => identity.provider === 'facebook');
         const isGuest = data.identities.length === 0 || data.identities.every((identity) => identity.provider === 'anonymous');
         if (result.pending) {
            if (hasFacebook) {
               track('facebook_connected');
               showToast(TOAST_TYPES.SUCCESS, copy.doneTitle, copy.doneBody);
            } else {
               track('facebook_connect_failed', { error: result.error ?? 'no_identity' });
               setError(facebookConnectErrorText(language, result.error));
            }
         }
         if (hasFacebook || isGuest || !allowedHere || (!result.pending && readDismissed(userId))) {
            setState('hidden');
            return;
         }
         setState('show');
         track('facebook_connect_shown');
      })().catch(() => {
         if (!cancelled) setState('hidden');
      });
      return () => {
         cancelled = true;
      };
      // Runs once per account; copy/showToast are stable for the page's life.
      // eslint-disable-next-line react-hooks/exhaustive-deps
   }, [userId, allowedHere]);

   if (state !== 'show' || !userId) return null;

   const connect = async () => {
      if (isWorking) return;
      setIsWorking(true);
      setError('');
      track('facebook_connect_tapped');
      markFacebookConnectPending();
      const { error: linkError } = await getSupabaseBrowserClient()
         .auth.linkIdentity({ provider: 'facebook', options: { redirectTo: getAuthRedirectUrl(), scopes: 'email,public_profile' } })
         .catch((err: unknown) => ({ error: err instanceof Error ? err : new Error(String(err)) }));
      if (linkError) {
         // Never left the page (e.g. manual linking switched off): clear the marker and say so here.
         takeFacebookConnectResult();
         track('facebook_connect_failed', { error: linkError.message });
         setError(facebookConnectErrorText(language, linkError.message));
         setIsWorking(false);
      }
      // On success the browser goes to Facebook — leave the button busy.
   };

   const dismiss = () => {
      try {
         window.localStorage.setItem(`${DISMISS_KEY}:${userId}`, String(Date.now()));
      } catch {
         // Storage blocked: hidden for this visit only.
      }
      track('facebook_connect_dismissed');
      setState('hidden');
   };

   return (
      <section
         aria-label={copy.title}
         className="relative mx-5 rounded-[8px] bg-white px-3 py-3.5 shadow-[0_1px_2px_rgba(28,5,61,0.06)] dark:bg-[#1E1530]"
      >
         <button
            type="button"
            onClick={dismiss}
            aria-label="Not now"
            className="absolute right-1.5 top-1.5 flex h-7 w-7 items-center justify-center rounded-full text-[#90a1b9] hover:bg-black/5 dark:hover:bg-white/10"
         >
            <X className="h-4 w-4" aria-hidden="true" />
         </button>
         <div className="flex items-center gap-3 pr-5">
            <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-[#e7f0ff] dark:bg-[#102a3f]">
               <Facebook className="h-5 w-5 text-[#0866FF]" aria-hidden="true" />
            </span>
            <span className="min-w-0 flex-1">
               <span className="block text-[16px] font-semibold leading-6 text-[#0f172b] dark:text-white">{copy.title}</span>
               <span className="block text-[14px] leading-[18px] text-[#45556c] dark:text-[#c8b8e8]">{copy.body}</span>
            </span>
            <button
               type="button"
               onClick={() => void connect()}
               disabled={isWorking}
               className="shrink-0 rounded-full bg-[#6b55f7] px-3 py-1.5 text-[13px] font-bold text-white disabled:opacity-60"
            >
               {isWorking ? copy.working : copy.button}
            </button>
         </div>
         {error ? <p className="mt-2 text-[13px] font-medium leading-5 text-[#B91C1C]">{error}</p> : null}
      </section>
   );
}
