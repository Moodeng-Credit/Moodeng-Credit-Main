import { useCallback, useEffect, useRef, useState } from 'react';

import { getSupabaseBrowserClient, isSupabaseBrowserConfigured } from '@/lib/supabase/client';

import { getMechaCopy } from '@/components/mecha/mechaCopy';
import type { MechaContext } from '@/components/mecha/mechaBus';
import { clearThread, loadThread, maxMessageSeq, saveThread } from '@/components/mecha/mechaStorage';

export type MechaRole = 'user' | 'assistant';

export interface MechaMessage {
   id: string;
   role: MechaRole;
   content: string;
   /** On an assistant turn, whether to surface the human hand-off card. */
   offerHuman?: boolean;
   /** Assistant turn produced by a failed request — offer a retry instead. */
   isError?: boolean;
}

export type EscalationState = 'idle' | 'sending' | 'sent' | 'error';
export type FeedbackVote = 'up' | 'down';

interface UseMechaChatOptions {
   locale?: string;
   /** Evaluated at send time so the message carries the user's current screen. */
   getContext?: () => MechaContext;
   /** When set, the thread survives reloads under this per-surface key. */
   persistKey?: string;
}

interface SupportChatResponse {
   reply?: string;
   offer_human?: boolean;
}

export function useMechaChat({ locale, getContext, persistKey }: UseMechaChatOptions = {}) {
   const copy = getMechaCopy(locale);
   // Rehydrate a persisted thread once, on first mount, before first paint.
   const hydrated = useRef(persistKey ? loadThread(persistKey) : null);
   const [messages, setMessages] = useState<MechaMessage[]>(() => hydrated.current?.messages ?? []);
   const [isSending, setIsSending] = useState(false);
   const [escalation, setEscalation] = useState<EscalationState>('idle');
   const [feedback, setFeedback] = useState<Record<string, FeedbackVote>>(() => hydrated.current?.feedback ?? {});
   const idRef = useRef(hydrated.current ? maxMessageSeq(hydrated.current.messages) : 0);
   const nextId = () => `m${(idRef.current += 1)}`;

   // Persist on every change so a mid-chat reload restores the thread.
   useEffect(() => {
      if (persistKey) saveThread(persistKey, { messages, feedback });
   }, [persistKey, messages, feedback]);

   const buildPayload = useCallback(
      (history: MechaMessage[]) => history.map((m) => ({ role: m.role, content: m.content })),
      []
   );

   const currentContext = useCallback((): MechaContext & { locale?: string } => {
      const ctx = getContext?.() ?? {};
      return { ...ctx, locale };
   }, [getContext, locale]);

   // Shared request path: `history` must end on the user turn to answer. Used by
   // both a fresh send and a retry of a failed turn.
   const dispatch = useCallback(
      async (history: MechaMessage[]) => {
         setMessages(history);
         setIsSending(true);
         try {
            if (!isSupabaseBrowserConfigured()) throw new Error('supabase-not-configured');
            const { data, error } = await getSupabaseBrowserClient().functions.invoke('support-chat', {
               body: { messages: buildPayload(history), context: currentContext() }
            });
            if (error) throw error;

            const res = (data ?? null) as SupportChatResponse | null;
            const reply = (res?.reply || '').trim() || copy.errorLine;
            setMessages((prev) => [
               ...prev,
               { id: nextId(), role: 'assistant', content: reply, offerHuman: res?.offer_human === true }
            ]);
         } catch (err) {
            console.warn('[Mecha] chat failed', err);
            setMessages((prev) => [...prev, { id: nextId(), role: 'assistant', content: copy.errorLine, offerHuman: true, isError: true }]);
         } finally {
            setIsSending(false);
         }
      },
      [buildPayload, copy.errorLine, currentContext]
   );

   const send = useCallback(
      async (raw: string) => {
         const text = raw.trim();
         if (!text || isSending) return;
         const userMsg: MechaMessage = { id: nextId(), role: 'user', content: text };
         await dispatch([...messages, userMsg]);
      },
      [dispatch, isSending, messages]
   );

   // Re-send the last question after a failure: drop the error bubble, keep the
   // history ending on the user turn, and dispatch it again.
   const retryLast = useCallback(async () => {
      if (isSending) return;
      const base = messages.length && messages[messages.length - 1].isError ? messages.slice(0, -1) : messages;
      if (!base.some((m) => m.role === 'user')) return;
      await dispatch(base);
   }, [dispatch, isSending, messages]);

   const escalate = useCallback(
      async (contact?: string) => {
         if (escalation === 'sending' || escalation === 'sent') return;
         setEscalation('sending');
         try {
            if (!isSupabaseBrowserConfigured()) throw new Error('supabase-not-configured');
            const { data, error } = await getSupabaseBrowserClient().functions.invoke('support-chat', {
               body: { action: 'escalate', messages: buildPayload(messages), context: currentContext(), contact }
            });
            const res = (data ?? null) as { ok?: boolean } | null;
            if (error || !res?.ok) throw error ?? new Error('escalate-failed');
            setEscalation('sent');
            setMessages((prev) => [...prev, { id: nextId(), role: 'assistant', content: copy.humanSent }]);
         } catch (err) {
            console.warn('[Mecha] escalation failed', err);
            setEscalation('error');
         }
      },
      [buildPayload, copy.humanSent, currentContext, escalation, messages]
   );

   /** Rate an assistant answer. A 👎 also surfaces the human hand-off card. */
   const rate = useCallback(
      (messageId: string, vote: FeedbackVote) => {
         setFeedback((prev) => {
            if (prev[messageId]) return prev; // one vote per answer
            return { ...prev, [messageId]: vote };
         });
         if (vote === 'down') {
            setMessages((prev) => prev.map((m) => (m.id === messageId ? { ...m, offerHuman: true } : m)));
         }
         // Fire-and-forget telemetry; content never leaves the device, just the vote.
         try {
            if (!isSupabaseBrowserConfigured()) return;
            void getSupabaseBrowserClient().functions.invoke('support-chat', {
               body: { action: 'feedback', vote, context: currentContext() }
            });
         } catch {
            /* telemetry only — never bother the user */
         }
      },
      [currentContext]
   );

   /** Show an assistant greeting if the thread is empty (used on open). */
   const seedGreeting = useCallback((text: string) => {
      setMessages((prev) => (prev.length > 0 ? prev : [{ id: nextId(), role: 'assistant', content: text }]));
   }, []);

   const reset = useCallback(() => {
      setMessages([]);
      setEscalation('idle');
      setFeedback({});
      if (persistKey) clearThread(persistKey);
   }, [persistKey]);

   return { messages, isSending, escalation, feedback, send, retryLast, escalate, rate, seedGreeting, reset };
}
