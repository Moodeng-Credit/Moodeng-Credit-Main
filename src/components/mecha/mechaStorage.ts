// Lightweight persistence for Mecha so a reload (common on flaky PH mobile) does
// not wipe an in-progress support chat, and a Filipino user's TL choice sticks.
//
// - Conversation lives in sessionStorage (per-tab, cleared when the tab closes —
//   the right lifetime for a transient support thread).
// - The chosen language lives in localStorage (a real preference worth keeping
//   across visits).

import type { FeedbackVote, MechaMessage } from '@/components/mecha/useMechaChat';

const THREAD_PREFIX = 'mecha_thread_';
const LOCALE_KEY = 'mecha_locale';

export interface PersistedThread {
   messages: MechaMessage[];
   feedback: Record<string, FeedbackVote>;
}

const threadKey = (surface: string) => `${THREAD_PREFIX}${surface}`;

export function loadThread(surface: string): PersistedThread | null {
   try {
      const raw = sessionStorage.getItem(threadKey(surface));
      if (!raw) return null;
      const parsed = JSON.parse(raw) as Partial<PersistedThread>;
      if (!Array.isArray(parsed.messages)) return null;
      return {
         messages: parsed.messages,
         feedback: parsed.feedback && typeof parsed.feedback === 'object' ? parsed.feedback : {}
      };
   } catch {
      return null;
   }
}

export function saveThread(surface: string, thread: PersistedThread): void {
   try {
      if (thread.messages.length === 0) {
         sessionStorage.removeItem(threadKey(surface));
         return;
      }
      sessionStorage.setItem(threadKey(surface), JSON.stringify(thread));
   } catch {
      /* storage full or unavailable — persistence is best-effort */
   }
}

export function clearThread(surface: string): void {
   try {
      sessionStorage.removeItem(threadKey(surface));
   } catch {
      /* ignore */
   }
}

// Highest numeric suffix among ids like "m7", so restored threads keep minting
// unique ids instead of colliding from 0.
export function maxMessageSeq(messages: MechaMessage[]): number {
   return messages.reduce((max, m) => {
      const n = Number.parseInt(m.id.replace(/^m/, ''), 10);
      return Number.isFinite(n) && n > max ? n : max;
   }, 0);
}

export function loadMechaLocale(fallback: string): string {
   try {
      return localStorage.getItem(LOCALE_KEY) || fallback;
   } catch {
      return fallback;
   }
}

export function saveMechaLocale(code: string): void {
   try {
      localStorage.setItem(LOCALE_KEY, code);
   } catch {
      /* ignore */
   }
}
