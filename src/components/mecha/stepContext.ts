// Maps the current route to a Mecha "step" so the assistant is step-aware
// (Direction 02, the setup co-pilot) everywhere, without wiring each page.
// The always-mounted launcher reads location → derives a step → feeds it to the
// edge function as context AND drives the proactive nudge.

import { readVerifyFlow } from '@/lib/verifyFlow';

// Chips and nudges are user-visible, so they carry both languages; `page`/`id`
// only go to the model as context and stay English.
export type LocalizedText = { en: string; fil: string };
export type LocalizedList = { en: string[]; fil: string[] };

export const pickText = (t: LocalizedText, locale?: string): string => (locale === 'fil' ? t.fil : t.en);
export const pickList = (l: LocalizedList, locale?: string): string[] => (locale === 'fil' ? l.fil : l.en);

export type MechaStep = {
   /** Stable id sent to the model as context.step. */
   id: string;
   /** Screen name sent as context.page. */
   page: string;
   /** Proactive nudge shown after the user idles on a friction step. */
   nudge?: LocalizedText;
   /** Quick-reply chips seeded for this screen. */
   quickReplies?: LocalizedList;
};

// Longest-prefix match, most specific first.
const STEP_TABLE: Array<{ match: (p: string) => boolean; step: MechaStep }> = [
   {
      match: (p) => p.startsWith('/onboarding/wallet'),
      step: {
         id: 'base-account',
         page: 'Set up / connect your Base Account',
         nudge: {
            en: "Setting up your wallet? Don't download the Coinbase app — I can show you the right way.",
            fil: 'Nagse-set up ng wallet? Huwag i-download ang Coinbase app — ituturo ko sa iyo ang tamang paraan.'
         },
         quickReplies: {
            en: ['Do I need the Coinbase app?', 'How do I create a Base Account?', 'My wallet won’t connect'],
            fil: ['Kailangan ko ba ang Coinbase app?', 'Paano gumawa ng Base Account?', 'Ayaw kumonekta ng wallet ko']
         }
      }
   },
   {
      match: (p) => p === '/verify' || p.startsWith('/verify-'),
      step: {
         id: 'verify',
         page: 'Verify your identity',
         nudge: {
            en: 'Stuck on verifying? I can walk you through it.',
            fil: 'Na-stuck sa pag-verify? Gagabayan kita hakbang-hakbang.'
         },
         quickReplies: {
            en: ['How do I verify my ID?', 'My verification is stuck', 'What is World ID?'],
            fil: ['Paano i-verify ang ID ko?', 'Stuck ang verification ko', 'Ano ang World ID?']
         }
      }
   },
   {
      match: (p) => p.startsWith('/repay'),
      step: {
         id: 'repay',
         page: 'Repay your loan',
         quickReplies: {
            en: ['How do I repay?', 'Where do I buy USDC?', 'What network do I use?'],
            fil: ['Paano magbayad ng loan?', 'Saan ako bibili ng USDC?', 'Anong network ang gagamitin ko?']
         }
      }
   },
   {
      match: (p) => p.startsWith('/withdraw'),
      step: {
         id: 'cash-out',
         page: 'Withdraw / cash out',
         quickReplies: {
            en: ['How do I cash out to GCash?', 'How do I withdraw to my bank?', 'Which network do I pick?'],
            fil: ['Paano mag-cash out sa GCash?', 'Paano mag-withdraw sa bank ko?', 'Anong network ang pipiliin ko?']
         }
      }
   },
   {
      match: (p) => p.startsWith('/request-board') || p.startsWith('/lender/request-board'),
      step: {
         id: 'request-board',
         page: 'Request board',
         quickReplies: {
            en: ['How do I request a loan?', 'How does funding work?', 'What is a Trust Score?'],
            fil: ['Paano mag-request ng loan?', 'Paano gumagana ang funding?', 'Ano ang Trust Score?']
         }
      }
   },
   {
      match: (p) => p.startsWith('/dashboard') || p.startsWith('/lender/dashboard'),
      step: {
         id: 'dashboard',
         page: 'Dashboard',
         quickReplies: {
            en: ['How do I increase my credit limit?', 'How do I get verified?', 'How do I cash out?'],
            fil: ['Paano tumaas ang credit limit ko?', 'Paano magpa-verify?', 'Paano mag-cash out?']
         }
      }
   },
   {
      match: (p) => p.startsWith('/sign-up') || p.startsWith('/onboarding/role') || p.startsWith('/onboarding/welcome'),
      step: {
         id: 'signup',
         page: 'Sign up',
         quickReplies: {
            en: ['How do I get started?', 'What do I need to borrow?', 'Is Moodeng legit?'],
            fil: ['Paano magsimula?', 'Ano ang kailangan para makahiram?', 'Legit ba ang Moodeng?']
         }
      }
   }
];

export const DEFAULT_QUICK_REPLIES: LocalizedList = {
   en: ['How do I get verified?', 'How do I cash out to GCash?', 'How do I increase my credit limit?', 'Is Moodeng legit?'],
   fil: ['Paano magpa-verify?', 'Paano mag-cash out sa GCash?', 'Paano tumaas ang credit limit ko?', 'Legit ba ang Moodeng?']
};

export function stepForLocation(pathname: string): MechaStep | null {
   const found = STEP_TABLE.find((entry) => entry.match(pathname));
   if (found) return found.step;

   // Off a verify route but with an unfinished verify flow in storage → the user
   // started verifying and wandered off. Treat that as the verify step so the
   // nudge still offers to help.
   if (typeof window !== 'undefined' && readVerifyFlow()) {
      return STEP_TABLE.find((e) => e.step.id === 'verify')?.step ?? null;
   }
   return null;
}
