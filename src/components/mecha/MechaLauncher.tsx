import { type JSX, useCallback, useEffect, useMemo, useRef, useState } from 'react';

import { useLocation } from 'react-router-dom';

import { useLocalization } from '@/i18n';

import { poseSrc } from '@/components/mecha/mechaAssets';
import MechaChatPanel from '@/components/mecha/MechaChatPanel';
import { getMechaCopy } from '@/components/mecha/mechaCopy';
import {
   MECHA_CLOSE_EVENT,
   MECHA_OPEN_EVENT,
   MECHA_SIGNAL_EVENT,
   type MechaContext,
   type MechaOpenDetail,
   hasMechaProblemSignal
} from '@/components/mecha/mechaBus';
import { DEFAULT_QUICK_REPLIES, type LocalizedText, pickList, pickText, stepForLocation } from '@/components/mecha/stepContext';
import { loadMechaLocale, saveMechaLocale } from '@/components/mecha/mechaStorage';
import { useMechaChat } from '@/components/mecha/useMechaChat';

import '@/components/mecha/mecha.css';

// Bubble is suppressed on these route prefixes: /help embeds the panel already,
// and /admin is an internal tool.
const HIDE_ON_PREFIXES = ['/help', '/admin'];
// The proactive floating bubble/nudge is deliberately scoped to onboarding only.
// Everywhere else (request board, dashboard, repay, withdraw, account, …) Mecha stays
// out of the way — it was popping up mid-task and blocking the loan-request form. The
// panel is still reachable everywhere via explicit "Ask Mecha" buttons (openMecha) and
// the Help page, which don't depend on this bubble.
const ONBOARDING_BUBBLE_PREFIXES = ['/onboarding', '/verify', '/sign-up'];
// Routes where the bottom nav is present — raise the bubble so it clears it.
const OVER_NAV_PREFIXES = ['/request-board', '/repay', '/dashboard', '/lender/', '/history', '/account', '/support', '/user/'];
// How long a user idles on a friction step before Mecha offers a nudge.
const NUDGE_DELAY_MS = 22000;

const nudgeSeenKey = (stepId: string) => `mecha_nudge_${stepId}`;

export default function MechaLauncher(): JSX.Element | null {
   const location = useLocation();
   const { locale: appLocale } = useLocalization();
   // Mecha-scoped language: a saved choice wins, else the app locale; switchable
   // via the in-chat flags without changing the whole app's language.
   const [locale, setLocale] = useState<string>(() => loadMechaLocale(appLocale));
   const changeLocale = useCallback((code: string) => {
      saveMechaLocale(code);
      setLocale(code);
   }, []);
   const copy = getMechaCopy(locale);

   const step = useMemo(() => stepForLocation(location.pathname), [location.pathname]);
   const [isOpen, setIsOpen] = useState(false);
   const [nudge, setNudge] = useState<LocalizedText | null>(null);
   const [override, setOverride] = useState<MechaContext | null>(null);
   // Problem-gated bubble: hidden while everything works; appears once the user hits a
   // problem (error toast / explicit openMecha) and stays for the session. Friction steps
   // (wallet connect, verify) always show it — that's where people get stuck.
   const [problemSignaled, setProblemSignaled] = useState<boolean>(() => hasMechaProblemSignal());

   useEffect(() => {
      const onSignal = () => setProblemSignaled(true);
      window.addEventListener(MECHA_SIGNAL_EVENT, onSignal);
      return () => window.removeEventListener(MECHA_SIGNAL_EVENT, onSignal);
   }, []);

   // Clear any visible nudge when the route changes, so a nudge raised on an onboarding
   // step can never linger onto the next screen (the bug where the "setting up your wallet"
   // tip appeared over the loan-request form on the Request Board).
   useEffect(() => {
      setNudge(null);
   }, [location.pathname]);

   // Fresh context at send-time: an explicit openMecha(context) wins, else the route step.
   const contextRef = useRef<MechaContext>({});
   contextRef.current = override ?? (step ? { page: step.page, step: step.id } : {});
   const getContext = useCallback((): MechaContext => contextRef.current, []);

   const chat = useMechaChat({ locale, getContext, persistKey: 'bubble' });
   const { send, seedGreeting, reset } = chat;

   const open = useCallback(() => {
      setNudge(null);
      setIsOpen(true);
   }, []);

   const close = useCallback(() => setIsOpen(false), []);

   const restart = useCallback(() => {
      reset();
      setOverride(null);
   }, [reset]);

   // Trigger-from-anywhere bus (error cards, in-app-browser notice, verify steps).
   useEffect(() => {
      const onOpen = (e: Event) => {
         const detail = (e as CustomEvent<MechaOpenDetail>).detail ?? {};
         if (detail.context) setOverride(detail.context);
         if (detail.greeting) seedGreeting(detail.greeting);
         // An explicit open means the user needed help — keep the bubble around after close.
         setProblemSignaled(true);
         open();
         if (detail.seedUserMessage) void send(detail.seedUserMessage);
      };
      const onClose = () => close();
      window.addEventListener(MECHA_OPEN_EVENT, onOpen);
      window.addEventListener(MECHA_CLOSE_EVENT, onClose);
      return () => {
         window.removeEventListener(MECHA_OPEN_EVENT, onOpen);
         window.removeEventListener(MECHA_CLOSE_EVENT, onClose);
      };
   }, [close, open, seedGreeting, send]);

   // Proactive nudge: after idling on a friction step, offer help once per step per session.
   useEffect(() => {
      if (isOpen || !step?.nudge) return;
      let seen = false;
      try {
         seen = sessionStorage.getItem(nudgeSeenKey(step.id)) === '1';
      } catch {
         /* storage unavailable */
      }
      if (seen) return;

      const timer = window.setTimeout(() => {
         setNudge(step.nudge ?? null);
         try {
            sessionStorage.setItem(nudgeSeenKey(step.id), '1');
         } catch {
            /* ignore */
         }
      }, NUDGE_DELAY_MS);
      return () => window.clearTimeout(timer);
   }, [isOpen, step]);

   const hidden = HIDE_ON_PREFIXES.some((p) => location.pathname.startsWith(p));
   if (hidden) return null;

   const overNav = OVER_NAV_PREFIXES.some((p) => location.pathname.startsWith(p));
   const bubbleBottom = { bottom: `calc(env(safe-area-inset-bottom, 0px) + ${overNav ? 92 : 20}px)` };
   const quickReplies = pickList(step?.quickReplies ?? DEFAULT_QUICK_REPLIES, locale);
   // Onboarding-only: the proactive bubble appears only while the user is in the onboarding
   // funnel (wallet, verify, sign-up), and only when there's a reason to — a friction-step
   // nudge or a problem hit on that screen. Outside onboarding it never shows, so it can't
   // block the loan-request form or any other in-app task. Explicit "Ask Mecha" buttons and
   // the Help page open the panel directly and are unaffected by this gate.
   const onOnboarding = ONBOARDING_BUBBLE_PREFIXES.some((p) => location.pathname.startsWith(p));
   const showBubble = onOnboarding && (problemSignaled || Boolean(step?.nudge));

   return (
      <>
         {/* Launcher bubble + proactive nudge */}
         {!isOpen && showBubble ? (
            <div className="fixed right-4 z-[90] flex flex-col items-end gap-2" style={bubbleBottom}>
               {nudge ? (
                  <div className="mecha-nudge relative mb-1 max-w-[240px] rounded-2xl rounded-br-md border border-[#e6ddf6] bg-white px-3.5 py-2.5 text-[13px] leading-snug text-[#1b0a36] shadow-[0_10px_30px_rgba(27,10,54,0.18)] dark:border-[#40354F] dark:bg-[#17121F] dark:text-[#F8F4FF]">
                     <button
                        type="button"
                        onClick={() => setNudge(null)}
                        aria-label={copy.closeLabel}
                        className="absolute -right-2 -top-2 flex h-5 w-5 items-center justify-center rounded-full bg-[#efe9fb] text-[#5b5470] dark:bg-[#2a2235] dark:text-[#B5ACBE]"
                     >
                        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" aria-hidden="true">
                           <path d="M6 6l12 12M18 6L6 18" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" />
                        </svg>
                     </button>
                     <button type="button" onClick={open} className="block text-left">
                        {pickText(nudge, locale)}
                     </button>
                  </div>
               ) : null}
               <button
                  type="button"
                  onClick={open}
                  aria-label={copy.openLabel}
                  className="mecha-fab flex h-14 w-14 items-center justify-center overflow-hidden rounded-full border-2 border-white bg-[#6c3fe0] shadow-[0_10px_30px_rgba(108,63,224,0.45)] transition-transform hover:scale-105 active:scale-95 dark:border-[#2a2235]"
               >
                  {/* When Mecha is actively nudging, he points — drawing the eye to the tip. */}
                  <img
                     key={nudge ? 'point' : 'idle'}
                     src={nudge ? poseSrc('point') : poseSrc('present')}
                     alt=""
                     className={`h-11 w-11 object-contain${nudge ? ' mecha-pose-pop' : ''}`}
                  />
               </button>
            </div>
         ) : null}

         {/* Docked panel */}
         {isOpen ? (
            <div
               role="dialog"
               aria-label={copy.openLabel}
               className="mecha-panel fixed inset-x-0 bottom-0 top-14 z-[10001] flex flex-col overflow-hidden rounded-t-3xl border border-[#efe9fb] bg-white shadow-[0_-10px_40px_rgba(27,10,54,0.25)] dark:border-[#2a2235] dark:bg-[#17121F] sm:inset-x-auto sm:bottom-6 sm:right-5 sm:top-auto sm:h-[600px] sm:max-h-[82vh] sm:w-[390px] sm:rounded-3xl"
            >
               <MechaChatPanel
                  locale={locale}
                  messages={chat.messages}
                  isSending={chat.isSending}
                  escalation={chat.escalation}
                  onSend={chat.send}
                  onEscalate={chat.escalate}
                  onRate={chat.rate}
                  onRetry={chat.retryLast}
                  feedback={chat.feedback}
                  onClose={close}
                  onRestart={restart}
                  onLocaleChange={changeLocale}
                  quickReplies={quickReplies}
                  variant="floating"
               />
            </div>
         ) : null}
      </>
   );
}
