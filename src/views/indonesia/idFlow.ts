import { useCallback, useContext } from 'react';

import { QueryClient, QueryClientContext, useQuery } from '@tanstack/react-query';
import { useSelector } from 'react-redux';

import { fetchIdOnboarding, ID_ONBOARDING_QUERY_KEY } from '@/hooks/useIdOnboarding';

import { useOptionalLocalization } from '@/i18n/LocalizationProvider';
import { ID_PATHS, ID_STEP_ORDER, type IdOnboarding, type IdStepKey, type IdTrackSwitch } from '@/lib/idTrack';
import { getSupabaseBrowserClient } from '@/lib/supabase/client';
import type { RootState } from '@/store/store';

/**
 * Client-side glue for the Indonesia track screens (/id, /id/onboarding): the sign-up intent that
 * survives the Telegram OAuth round trip, the Didit return marker, the language pick and the step
 * labels. Types, rules and the server error texts live in src/lib/idTrack.ts.
 */

export type IdLang = 'id' | 'en';

/** Bahasa Indonesia unless the visitor switched to English (`?lang=en` / the toggle). */
export const useIdLang = (): IdLang => {
   const localization = useOptionalLocalization();
   return !localization || localization.locale === 'id' ? 'id' : 'en';
};

/** Picks the right string from a small `{ id, en }` copy table. */
export const pick = <T>(lang: IdLang, table: { id: T; en: T }): T => table[lang];

// ── sign-up intent ──────────────────────────────────────────────────────────────────────────────
// Set by the /id Telegram button; read by /auth/telegram/callback after the session exists. Local
// storage (not session) because some in-app browsers hand oauth.telegram.org a fresh tab.
export const ID_TRACK_INTENT_KEY = 'moodeng.idTrackIntent';
const INTENT_TTL_MS = 60 * 60 * 1000;

export const setIdTrackIntent = (): void => {
   try {
      window.localStorage.setItem(ID_TRACK_INTENT_KEY, String(Date.now()));
   } catch {
      // Storage blocked: the callback lands on the normal path; /id still works for a signed-in user.
   }
};

export const hasIdTrackIntent = (): boolean => {
   try {
      const at = Number(window.localStorage.getItem(ID_TRACK_INTENT_KEY));
      return Number.isFinite(at) && at > 0 && Date.now() - at < INTENT_TTL_MS;
   } catch {
      return false;
   }
};

export const clearIdTrackIntent = (): void => {
   try {
      window.localStorage.removeItem(ID_TRACK_INTENT_KEY);
   } catch {
      // ignore
   }
};

// ── Didit return ────────────────────────────────────────────────────────────────────────────────
// Didit sends everyone back to /verify (DIDIT_CALLBACK_URL). The KYC step marks the attempt so /verify
// can hand an Indonesia-track borrower straight back to /id/onboarding?step=kyc.
const ID_KYC_RETURN_KEY = 'moodeng.idKycReturn';
const KYC_RETURN_TTL_MS = 6 * 60 * 60 * 1000;
export const ID_KYC_RETURN_PATH = `${ID_PATHS.onboarding}?step=kyc`;

export const markIdKycReturn = (): void => {
   try {
      window.localStorage.setItem(ID_KYC_RETURN_KEY, String(Date.now()));
   } catch {
      // ignore
   }
};

/** True (once) when the last Didit session was opened from the Indonesia KYC step. */
export const takeIdKycReturn = (): boolean => {
   try {
      const at = Number(window.localStorage.getItem(ID_KYC_RETURN_KEY));
      window.localStorage.removeItem(ID_KYC_RETURN_KEY);
      return Number.isFinite(at) && at > 0 && Date.now() - at < KYC_RETURN_TTL_MS;
   } catch {
      return false;
   }
};

// ── wallet ──────────────────────────────────────────────────────────────────────────────────────
/**
 * The returnTo token for the Indonesia onboarding: /onboarding/wallet (WalletConnected sends them back
 * to /id/onboarding?step=walt) and the Didit session (/verify sends them back to ?step=kyc).
 */
export const ID_RETURN_TO = 'id-onboarding';

/**
 * Tells the server a step the app saves itself is done, so the Telegram bot sends the
 * "✅ done — next step" message (loan-access action id_step). Best effort: never throws.
 */
export const reportIdStep = async (step: 'telegram' | 'about' | 'facebook' | 'walt'): Promise<void> => {
   try {
      await getSupabaseBrowserClient().functions.invoke('loan-access', { body: { action: 'id_step', step } });
   } catch (err) {
      console.warn('[idTrack] id_step report failed', err);
   }
};
export const ID_WALLET_RETURN_TO = ID_RETURN_TO;
export const ID_WALLET_SETUP_PATH = `/onboarding/wallet?returnTo=${ID_WALLET_RETURN_TO}`;

// ── steps ───────────────────────────────────────────────────────────────────────────────────────
export const ID_STEP_LABELS: Record<IdStepKey, { id: string; en: string }> = {
   telegram: { id: 'Telegram', en: 'Telegram' },
   whatsapp: { id: 'WhatsApp', en: 'WhatsApp' },
   facebook: { id: 'Facebook', en: 'Facebook' },
   about: { id: 'Tentang kamu', en: 'About you' },
   income: { id: 'Bukti penghasilan', en: 'Proof of income' },
   kyc: { id: 'KTP + wajah', en: 'ID + face' },
   walt: { id: 'Dompet Walt', en: 'Walt wallet' },
   call: { id: 'Video call', en: 'Video call' }
};

export const isIdStepKey = (value: string | null | undefined): value is IdStepKey =>
   Boolean(value) && (ID_STEP_ORDER as readonly string[]).includes(value as string);

export const idStepPath = (step?: IdStepKey): string => (step ? `${ID_PATHS.onboarding}?step=${step}` : ID_PATHS.onboarding);

/** The step the screen opens on when no ?step= is given. */
export const currentIdStep = (data: IdOnboarding): IdStepKey => (isIdStepKey(data.next) ? data.next : 'call');

/** Still has something to do before applying (or is waiting on the team). */
export const idOnboardingUnfinished = (data: IdOnboarding | undefined): boolean =>
   Boolean(data && data.market === 'ID' && data.next !== 'apply');

// ── queries that also work without a QueryClientProvider ────────────────────────────────────────
// The journey hook (and so the loan form, /verify, the sign-in pages) now asks whether someone is on
// the Indonesia track. Screens rendered on their own (tests, previews) have no QueryClientProvider, so
// these fall back to a private client instead of throwing.
const fallbackQueryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
const useAnyQueryClient = (): QueryClient => useContext(QueryClientContext) ?? fallbackQueryClient;

/**
 * Same as useIdOnboarding() (same cache key), but safe on screens without a QueryClientProvider. Used by
 * the app-wide hooks (journey, sign-in redirects) so every screen can ask "is this an Indonesia-track
 * borrower?". `isIndo` is false for everyone else and while loading.
 */
export function useIdTrackStatus(options: { poll?: boolean } = {}) {
   const userId = useSelector((state: RootState) => state.auth.user?.id);
   const client = useAnyQueryClient();
   const query = useQuery(
      {
         queryKey: [ID_ONBOARDING_QUERY_KEY, userId],
         queryFn: fetchIdOnboarding,
         enabled: Boolean(userId),
         staleTime: 15_000,
         refetchInterval: options.poll ? 5_000 : false
      },
      client
   );
   const refresh = useCallback(() => client.invalidateQueries({ queryKey: [ID_ONBOARDING_QUERY_KEY] }), [client]);
   return {
      data: query.data,
      isIndo: query.data?.market === 'ID',
      isLoading: Boolean(userId) && query.isLoading,
      refresh
   };
}

/**
 * Indonesia track: someone on it who hasn't reached "apply" yet always goes back to their onboarding,
 * wherever they signed in. Null for everyone else (and when the check fails).
 */
export const fetchIdTrackPath = async (): Promise<string | null> => {
   try {
      const status = await fetchIdOnboarding();
      return status.market === 'ID' && status.next !== 'apply' ? ID_PATHS.onboarding : null;
   } catch {
      return null;
   }
};

// ── the switch (public) ─────────────────────────────────────────────────────────────────────────
export const fetchIdTrackSwitch = async (): Promise<IdTrackSwitch> => {
   const { data, error } = await getSupabaseBrowserClient().rpc('get_id_track');
   if (error) return 'off';
   return data === 'on' || data === 'test' ? data : 'off';
};

/** get_id_track(): 'off' | 'test' | 'on'. Anyone can read it (signed out too). */
export const useIdTrackSwitch = (enabled = true) =>
   useQuery({ queryKey: ['id-track-switch'], queryFn: fetchIdTrackSwitch, staleTime: 60_000, enabled }, useAnyQueryClient());

/** Phone set to an Indonesian time zone or language: only then ask the server for the IP country. */
export const looksIndonesian = (): boolean => {
   try {
      const zone = Intl.DateTimeFormat().resolvedOptions().timeZone ?? '';
      if (['Asia/Jakarta', 'Asia/Pontianak', 'Asia/Makassar', 'Asia/Jayapura'].includes(zone)) return true;
   } catch {
      // ignore
   }
   return typeof navigator !== 'undefined' && (navigator.languages ?? [navigator.language]).some((l) => /^(id|in)\b/i.test(l ?? ''));
};

// ── phone numbers ───────────────────────────────────────────────────────────────────────────────
/** What they typed after the fixed +62, as digits: a leading 0 or 62 is dropped (0812… / 62812…). */
export const normalizeIdMobile = (raw: string): string => {
   let digits = raw.replace(/\D/g, '');
   if (digits.startsWith('62')) digits = digits.slice(2);
   if (digits.startsWith('0')) digits = digits.slice(1);
   return digits;
};

/** Indonesian mobile after +62: starts with 8, 9–13 digits in all. */
export const isIdMobile = (digits: string): boolean => /^8\d{8,12}$/.test(digits);

export const formatIdMobile = (digits: string): string => {
   const d = digits.replace(/\D/g, '');
   const local = d.startsWith('62') ? d.slice(2) : d;
   return `+62 ${local.replace(/(\d{3})(\d{3,4})(\d{0,6})/, (_m, a: string, b: string, c: string) => [a, b, c].filter(Boolean).join(' '))}`;
};

// ── app links ───────────────────────────────────────────────────────────────────────────────────
export const TELEGRAM_PLAY_STORE_URL = 'https://play.google.com/store/apps/details?id=org.telegram.messenger';
export const TELEGRAM_APP_STORE_URL = 'https://apps.apple.com/app/telegram-messenger/id686449807';

// ── look ────────────────────────────────────────────────────────────────────────────────────────
/** The gold main-button gradient (text #4a2a00). */
export const GOLD_GRADIENT = 'linear-gradient(180deg, #ffe27a 0%, #ffbe1a 100%)';

/** Big, phone-friendly text input. */
export const inputClass =
   'min-h-[52px] w-full rounded-[14px] border-2 border-[#ecdfb8] bg-white px-3 text-[18px] text-[#2b2116] outline-none focus:border-[#ffbe1a] dark:border-[#3a3048] dark:bg-[#120e1a] dark:text-[#f5efe3]';
