import { useCallback, useEffect, useRef, useState } from 'react';

import { LoaderCircle, ShieldCheck, X } from 'lucide-react';
import { loadStripeOnramp } from '@stripe/crypto';
import type { StripeOnramp } from '@stripe/crypto';

import {
   STRIPE_PUBLISHABLE_KEY,
   STRIPE_UNSUPPORTED_REGION_CODE
} from '@/config/stripeOnrampConfig';
import { getSupabaseBrowserClient } from '@/lib/supabase/client';

/**
 * Module-level so the Stripe onramp script is fetched once per page load rather than on
 * every open of the sheet. `loadStripeOnramp` injects the script from crypto-js.stripe.com;
 * it must not be bundled or self-hosted (Stripe can change it without notice).
 */
let stripeOnrampPromise: Promise<StripeOnramp | null> | null = null;
const getStripeOnramp = (): Promise<StripeOnramp | null> => {
   stripeOnrampPromise ??= loadStripeOnramp(STRIPE_PUBLISHABLE_KEY);
   return stripeOnrampPromise;
};

interface StripeOnrampModalProps {
   onClose: () => void;
   walletAddress?: string;
}

type Phase = 'loading' | 'ready' | 'complete' | 'error';

export default function StripeOnrampModal({ onClose, walletAddress }: StripeOnrampModalProps) {
   const [phase, setPhase] = useState<Phase>('loading');
   const [errorMessage, setErrorMessage] = useState<string | null>(null);
   const mountRef = useRef<HTMLDivElement | null>(null);

   // The onramp is mounted imperatively into a container Stripe owns, so React must not try
   // to reconcile its subtree. This ref-guard also stops StrictMode's double-effect in dev
   // from minting two sessions (each one is a real API call against the live key).
   const mountedSessionRef = useRef(false);

   useEffect(() => {
      const handleEscape = (e: KeyboardEvent) => {
         if (e.key === 'Escape') onClose();
      };
      document.addEventListener('keydown', handleEscape);
      return () => document.removeEventListener('keydown', handleEscape);
   }, [onClose]);

   useEffect(() => {
      if (mountedSessionRef.current) return;
      mountedSessionRef.current = true;

      let cancelled = false;

      const start = async () => {
         try {
            const supabase = getSupabaseBrowserClient();
            const { data, error } = await supabase.functions.invoke('stripe-onramp-session', {
               body: walletAddress ? { address: walletAddress } : {}
            });

            const payload = data as { clientSecret?: string; error?: string; code?: string } | null;
            const clientSecret = payload?.clientSecret;

            if (error || !clientSecret) {
               // The edge function forwards Stripe's own supportability verdict, so a
               // customer outside the US/EU gets told that specifically rather than a
               // generic failure they can't act on.
               if (payload?.code === STRIPE_UNSUPPORTED_REGION_CODE) {
                  throw new Error(
                     'Stripe card purchases aren’t available in your country yet. Try the Coinbase option below — it covers more regions.'
                  );
               }
               if (payload?.code === 'NO_WALLET') {
                  throw new Error('Connect a wallet first so we know where to send your USDC.');
               }
               throw new Error('Couldn’t start the card purchase. Try the Coinbase option below.');
            }

            const stripeOnramp = await getStripeOnramp();
            if (cancelled) return;

            if (!stripeOnramp || !mountRef.current) {
               throw new Error('Couldn’t load Stripe. Check your connection and try again.');
            }

            // Match the app's theme so the embedded widget doesn't flash a white panel into
            // a dark sheet. `useTheme` is the writer of this class; read it rather than
            // instantiating a second copy of that hook's state.
            const theme = document.documentElement.classList.contains('dark') ? 'dark' : 'light';

            const session = stripeOnramp.createSession({ clientSecret, appearance: { theme } });

            session.addEventListener('onramp_ui_loaded', () => {
               if (!cancelled) setPhase('ready');
            });

            session.addEventListener('onramp_session_updated', (event) => {
               const status = event.payload.session.status;
               // `fulfillment_processing` means the card cleared — the USDC transfer to Base
               // follows within seconds. Show success there rather than at
               // `fulfillment_complete` so the customer isn't left staring at a spinner.
               if (status === 'fulfillment_processing' || status === 'fulfillment_complete') {
                  if (!cancelled) setPhase('complete');
               }
            });

            session.mount(mountRef.current);
         } catch (err) {
            if (cancelled) return;
            setErrorMessage(err instanceof Error ? err.message : 'Something went wrong.');
            setPhase('error');
         }
      };

      void start();

      return () => {
         cancelled = true;
      };
   }, [walletAddress]);

   const handleBackdrop = useCallback(() => {
      // Don't let a stray backdrop tap kill a half-finished KYC/payment flow — the customer
      // would lose their entered details. The X is the deliberate exit.
      if (phase === 'ready') return;
      onClose();
   }, [phase, onClose]);

   return (
      <div className="fixed inset-0 z-[90] flex items-end justify-center sm:items-center">
         <button
            className="absolute inset-0 bg-[#12071f]/50 backdrop-blur-sm"
            onClick={handleBackdrop}
            aria-label="Close overlay"
         />

         <section
            role="dialog"
            aria-modal="true"
            aria-labelledby="stripe-onramp-title"
            className="relative flex max-h-[92vh] w-full max-w-[440px] flex-col overflow-hidden rounded-t-[28px] bg-white shadow-[0_-8px_32px_rgba(20,18,24,0.22)] sm:rounded-[28px] dark:bg-[#1b1525]"
         >
            <div className="flex items-center justify-between border-b border-md-neutral-300 px-4 py-3">
               <div className="min-w-0">
                  <h2 id="stripe-onramp-title" className="text-[15px] font-semibold text-md-heading">
                     Buy USDC with card
                  </h2>
                  <p className="mt-0.5 flex items-center gap-1 text-[11px] text-md-neutral-800">
                     <ShieldCheck className="h-3 w-3 shrink-0" />
                     Secured by Stripe &middot; delivered on Base
                  </p>
               </div>
               <button
                  onClick={onClose}
                  className="rounded-full p-1 transition-colors hover:bg-md-neutral-200 active:bg-md-neutral-300"
                  aria-label="Close"
               >
                  <X className="h-5 w-5 text-md-neutral-1400" strokeWidth={2} />
               </button>
            </div>

            <div className="min-h-[420px] flex-1 overflow-y-auto px-4 py-4">
               {phase === 'loading' && (
                  <div className="flex h-[380px] flex-col items-center justify-center gap-3">
                     <LoaderCircle className="h-7 w-7 animate-spin text-md-primary-1200" />
                     <p className="text-[13px] font-medium text-md-neutral-1200">Opening secure checkout…</p>
                  </div>
               )}

               {phase === 'error' && (
                  <div className="flex h-[380px] flex-col items-center justify-center gap-3 px-4 text-center">
                     <p className="text-[13px] font-medium leading-snug text-md-red-500" role="alert">
                        {errorMessage}
                     </p>
                     <button
                        onClick={onClose}
                        className="rounded-xl bg-md-primary-1200 px-4 py-2 text-[13px] font-semibold text-white"
                     >
                        Back to funding options
                     </button>
                  </div>
               )}

               {phase === 'complete' && (
                  <div className="flex h-[380px] flex-col items-center justify-center gap-3 px-4 text-center">
                     <div className="flex h-12 w-12 items-center justify-center rounded-full bg-[#e6f9ef]">
                        <ShieldCheck className="h-6 w-6 text-[#1a8c4e]" />
                     </div>
                     <p className="text-[15px] font-semibold text-md-heading">Payment confirmed</p>
                     <p className="text-[12px] leading-snug text-md-neutral-800">
                        Your USDC is on its way to your wallet on Base. It usually lands within a minute.
                     </p>
                     <button
                        onClick={onClose}
                        className="mt-1 rounded-xl bg-md-primary-1200 px-4 py-2 text-[13px] font-semibold text-white"
                     >
                        Done
                     </button>
                  </div>
               )}

               {/* Stripe owns this node once mounted. It stays in the tree across phases —
                   unmounting it would tear down a live payment session — and is only hidden
                   when another phase is showing. */}
               <div
                  ref={mountRef}
                  className={phase === 'ready' ? 'block' : 'hidden'}
                  aria-hidden={phase !== 'ready'}
               />
            </div>
         </section>
      </div>
   );
}
