import { ID_STEP_ORDER, type IdNext, type IdOnboarding } from '@/lib/idTrack';
import { isUserVerified } from '@/lib/isUserVerified';
import { getVerificationUiState } from '@/lib/verificationUiState';
import { hasWalletAddressOnAccount } from '@/lib/walletProvider';
import type { User } from '@/types/authTypes';

/**
 * A borrower's way to their first loan (the pre-KYC gate, src/hooks/usePreKycGate.ts):
 *
 *   Onboarding — 3 steps
 *     1. Set up your wallet
 *     2. Connect Messenger (+ tell us about you)
 *     3. Book your 15-min call → the team taps ✅ after it
 *   Then: apply for a loan — fill in the request; verifying your ID (KYC) is the last step of sending it.
 *
 * One place decides where a borrower is and what their next button says and does, so the request
 * board, dashboard, Account settings, the loan form and the app-wide "next step" bar never disagree.
 */
export type JourneyStage =
   | 'wallet' // no wallet yet
   | 'messenger' // held by the gate, Messenger not connected
   | 'about' // held by the gate, Messenger connected, bio not filled in
   | 'book_call' // held by the gate, ready to book (or rebook) the call
   | 'call_booked' // held by the gate, call booked — waiting for the call / the team's ✅
   | 'apply' // through onboarding, not ID-verified yet: apply; the ID check comes at the end of the request
   | 'id_with_didit' // ID check submitted / in review / unfinished / declined / duplicate
   | 'id_track' // Indonesia track (src/lib/idTrack.ts): their own 8-step onboarding at /id/onboarding
   | 'verified';

export type JourneyAction = 'wallet' | 'connect' | 'apply' | 'verify_status' | 'id_onboarding' | 'none';

export const ONBOARDING_STEPS = 3;

export type Journey = {
   stage: JourneyStage;
   /** Onboarding step 1–3, or null once onboarding is done. */
   step: 1 | 2 | 3 | null;
   /** True while onboarding is unfinished (wallet → Messenger → bio → call → ✅). */
   onboarding: boolean;
   /** Button label, e.g. "Book your call". Callers add the arrow. */
   cta: string;
   title: string;
   body: string;
   action: JourneyAction;
};

type JourneyUser = Pick<
   User,
   | 'isWorldId'
   | 'isWorldIdPassport'
   | 'isDidit'
   | 'diditIdStatus'
   | 'diditSubmittedAt'
   | 'loanAccessStatus'
   | 'hasVerifiedContact'
   | 'incomeType'
   | 'walletAddress'
>;

const onboardingStage = (
   stage: JourneyStage,
   step: 1 | 2 | 3,
   cta: string,
   title: string,
   body: string,
   action: JourneyAction
): Journey => ({ stage, step, onboarding: true, cta, title, body, action });

export function getJourney(user: JourneyUser | null | undefined, isGated: boolean): Journey {
   if (user && isUserVerified(user)) {
      return { stage: 'verified', step: null, onboarding: false, cta: 'Apply for a loan', title: "You're verified", body: 'You can request loans.', action: 'apply' };
   }
   if (user && !hasWalletAddressOnAccount(user)) {
      return onboardingStage('wallet', 1, 'Set up your wallet', 'Set up your wallet', 'Your loans arrive here — it takes a few seconds.', 'wallet');
   }
   if (user && isGated) {
      if (user.loanAccessStatus === 'pending') {
         return onboardingStage(
            'call_booked',
            3,
            'See call details',
            'See you on the call',
            "Right after your 15-min call, you can apply for your loan.",
            'connect'
         );
      }
      if (!user.hasVerifiedContact) {
         return onboardingStage(
            'messenger',
            2,
            'Connect Messenger',
            'Connect Messenger',
            'So the team can reach you — we only use it to message you about your loan.',
            'connect'
         );
      }
      if (!user.incomeType) {
         return onboardingStage('about', 2, 'Tell us about you', 'Tell us about you', 'A few quick questions about your work and payday.', 'connect');
      }
      return onboardingStage(
         'book_call',
         3,
         'Book your call',
         'Book your 15-min call',
         'Meet the team on a quick video call — then you can apply for your loan.',
         'connect'
      );
   }
   const uiState = getVerificationUiState(user);
   if (uiState !== 'unverified') {
      return {
         stage: 'id_with_didit',
         step: null,
         onboarding: false,
         cta: 'View ID check',
         title: 'Your ID check',
         body: 'See where your ID verification stands.',
         action: 'verify_status'
      };
   }
   return {
      stage: 'apply',
      step: null,
      onboarding: false,
      cta: 'Apply for a loan',
      title: 'Ready to apply',
      body: "Apply for a loan — you'll verify your ID (about 2 minutes, one time) when you send your request.",
      action: 'apply'
   };
}

const ID_NEXT_COPY: Record<IdNext, { id: string; en: string }> = {
   telegram: { id: 'Hubungkan Telegram', en: 'Connect Telegram' },
   whatsapp: { id: 'Hubungkan WhatsApp', en: 'Connect WhatsApp' },
   facebook: { id: 'Hubungkan Facebook', en: 'Connect Facebook' },
   about: { id: 'Isi tentang kamu', en: 'Tell us about you' },
   income: { id: 'Kirim bukti penghasilan', en: 'Send proof of income' },
   kyc: { id: 'Cek KTP + wajah', en: 'Check your ID + face' },
   walt: { id: 'Tambah dompet Walt', en: 'Add your Walt wallet' },
   call: { id: 'Pesan video call', en: 'Book your video call' },
   waiting: { id: 'Lihat status', en: 'See your status' },
   apply: { id: 'Ajukan pinjaman', en: 'Apply for a loan' }
};

/**
 * Indonesia track: the next of their 8 onboarding steps (or waiting on the team after the call).
 * Once approved (next = 'apply') callers use the normal journey instead.
 */
export function getIdJourney(data: Pick<IdOnboarding, 'next' | 'steps'>, lang: 'id' | 'en'): Journey {
   const done = ID_STEP_ORDER.filter((k) => data.steps[k]).length;
   const cta = ID_NEXT_COPY[data.next][lang];
   const waiting = data.next === 'waiting';
   return {
      stage: 'id_track',
      step: null,
      onboarding: data.next !== 'apply',
      cta,
      title: waiting ? (lang === 'id' ? 'Menunggu tim' : 'Waiting on the team') : cta,
      body: waiting
         ? lang === 'id'
            ? 'Setelah video call, tim akan menyetujui kamu.'
            : 'After your video call, the team approves you.'
         : lang === 'id'
           ? `Langkah ${Math.min(done + 1, ID_STEP_ORDER.length)} dari ${ID_STEP_ORDER.length}`
           : `Step ${Math.min(done + 1, ID_STEP_ORDER.length)} of ${ID_STEP_ORDER.length}`,
      action: 'id_onboarding'
   };
}
