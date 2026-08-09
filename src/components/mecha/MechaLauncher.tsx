import { type JSX, useCallback, useEffect, useMemo, useRef, useState } from 'react';

import { useLocation } from 'react-router-dom';

import { useLocalization } from '@/i18n';

import MechaChatPanel from '@/components/mecha/MechaChatPanel';
import { getMechaCopy } from '@/components/mecha/mechaCopy';
import { MECHA_CLOSE_EVENT, MECHA_OPEN_EVENT, type MechaContext, type MechaOpenDetail } from '@/components/mecha/mechaBus';
import { DEFAULT_QUICK_REPLIES, pickList, stepForLocation } from '@/components/mecha/stepContext';
import { loadMechaLocale, saveMechaLocale } from '@/components/mecha/mechaStorage';
import { useMechaChat } from '@/components/mecha/useMechaChat';

import '@/components/mecha/mecha.css';

// On-demand host for the Mecha panel.
//
// Mecha used to own a floating bubble and a proactive nudge, and it was the
// destination for the Help button. That is no longer true: Crisp (see
// components/support/CrispChat.tsx) owns the persistent launcher and every
// "I have a problem" path, because those users need a human, not a doc lookup.
//
// What Mecha is still good at is the writing job — rephrasing a vague loan
// reason, translating one into English — where an instant AI answer beats
// waiting on an operator. So the panel survives, but it is now *only* reachable
// through an explicit openMecha() call from a component that wants it. No
// bubble, no nudge, nothing on screen until the user asks for it, which also
// means there is exactly one floating launcher in the app.

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
   const [override, setOverride] = useState<MechaContext | null>(null);

   // Fresh context at send-time: an explicit openMecha(context) wins, else the route step.
   const contextRef = useRef<MechaContext>({});
   contextRef.current = override ?? (step ? { page: step.page, step: step.id } : {});
   const getContext = useCallback((): MechaContext => contextRef.current, []);

   const chat = useMechaChat({ locale, getContext, persistKey: 'bubble' });
   const { send, seedGreeting, reset } = chat;

   const open = useCallback(() => setIsOpen(true), []);
   const close = useCallback(() => setIsOpen(false), []);

   const restart = useCallback(() => {
      reset();
      setOverride(null);
   }, [reset]);

   // Trigger-from-anywhere bus (the loan-request wording helpers today).
   useEffect(() => {
      const onOpen = (e: Event) => {
         const detail = (e as CustomEvent<MechaOpenDetail>).detail ?? {};
         if (detail.context) setOverride(detail.context);
         if (detail.greeting) seedGreeting(detail.greeting);
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

   if (!isOpen) return null;

   const quickReplies = pickList(step?.quickReplies ?? DEFAULT_QUICK_REPLIES, locale);

   return (
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
   );
}
