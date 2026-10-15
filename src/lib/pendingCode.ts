import type { OtpChannel } from '@/store/slices/authSlice';

// The code someone is waiting for (number/email, channel, sign-in or sign-up), kept for 10 minutes
// in localStorage so a Facebook page that gets killed can come back to the code screen.

const PENDING_CODE_KEY = 'moodeng:pending-code';
const PENDING_CODE_TTL_MS = 10 * 60 * 1000;

export type PendingCode = {
   channel: OtpChannel;
   /** E.164 phone or email. */
   target: string;
   mode: 'signin' | 'signup';
   sentAt: number;
   expiresAt: number;
   /** How many times "Resend" was used. */
   resends: number;
};

export function savePendingCode(
   code: Omit<PendingCode, 'sentAt' | 'expiresAt' | 'resends'> & { resends?: number },
   now = Date.now()
): PendingCode {
   const pending: PendingCode = { ...code, resends: code.resends ?? 0, sentAt: now, expiresAt: now + PENDING_CODE_TTL_MS };
   try {
      localStorage.setItem(PENDING_CODE_KEY, JSON.stringify(pending));
   } catch {
      // ignore (private mode / storage disabled)
   }
   return pending;
}

export function readPendingCode(now = Date.now()): PendingCode | null {
   try {
      const saved = JSON.parse(localStorage.getItem(PENDING_CODE_KEY) ?? 'null') as PendingCode | null;
      if (!saved || typeof saved.expiresAt !== 'number' || saved.expiresAt <= now) return null;
      if ((saved.channel !== 'sms' && saved.channel !== 'email') || typeof saved.target !== 'string' || !saved.target) return null;
      return { ...saved, mode: saved.mode === 'signup' ? 'signup' : 'signin', resends: Number(saved.resends) || 0 };
   } catch {
      return null;
   }
}

export function clearPendingCode(): void {
   try {
      localStorage.removeItem(PENDING_CODE_KEY);
   } catch {
      // ignore
   }
}

export const PENDING_CODE_STORAGE_KEY = PENDING_CODE_KEY;
