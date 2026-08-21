import { useEffect } from 'react';

import { ExternalLink, ShieldCheck, X, Zap } from 'lucide-react';

interface BaseNetworkSheetProps {
   isOpen: boolean;
   onClose: () => void;
}

// Why Base matters to Moodeng, in the borrower's own terms. Every loan, repayment, and
// balance in the app lives on Base, so this sheet is the plain-language answer to "what is
// this network and why does it say Base everywhere?" — not a chain-tech explainer.
const POINTS = [
   {
      Icon: Zap,
      title: 'Fast and cheap by design',
      body: 'Base is an Ethereum "layer 2" built by Coinbase. Loans fund and repayments settle in seconds for a fraction of a cent — so more of every peso reaches the person, not the network.'
   },
   {
      Icon: ShieldCheck,
      title: 'Secured by Ethereum',
      body: 'Base inherits Ethereum’s security while staying low-cost. Your USDC balance and loan history are recorded on-chain, where they can’t be quietly changed.'
   }
];

export default function BaseNetworkSheet({ isOpen, onClose }: BaseNetworkSheetProps) {
   useEffect(() => {
      if (!isOpen) return;
      const handleEscape = (e: KeyboardEvent) => {
         if (e.key === 'Escape') onClose();
      };
      document.addEventListener('keydown', handleEscape);
      return () => document.removeEventListener('keydown', handleEscape);
   }, [isOpen, onClose]);

   useEffect(() => {
      if (isOpen) {
         document.body.style.overflow = 'hidden';
      } else {
         document.body.style.overflow = '';
      }
      return () => {
         document.body.style.overflow = '';
      };
   }, [isOpen]);

   if (!isOpen) return null;

   return (
      <div className="fixed inset-0 z-[80] flex flex-col items-center justify-end">
         <button className="absolute inset-0 bg-[#12071f]/40 backdrop-blur-sm" onClick={onClose} aria-label="Close overlay" />
         <section
            role="dialog"
            aria-modal="true"
            aria-labelledby="base-network-title"
            className="relative mx-auto w-full max-w-[440px] rounded-t-[28px] bg-white shadow-[0_-8px_32px_rgba(20,18,24,0.22)] animate-[slideUp_0.25s_ease-out]"
         >
            <div className="pt-2.5 pb-0.5">
               <div className="mx-auto h-1 w-10 rounded-full bg-[#c9c3d4]" />
            </div>

            <div className="flex items-center justify-between px-4 pb-1 pt-2">
               <div className="flex items-center gap-2">
                  <img src="/icons/base-account.svg" alt="" className="size-6 rounded-md-sm" />
                  <h2 id="base-network-title" className="text-[17px] font-semibold text-md-heading">
                     Moodeng runs on Base
                  </h2>
               </div>
               <button
                  onClick={onClose}
                  className="rounded-full p-1 transition-colors hover:bg-md-neutral-200 active:bg-md-neutral-300"
                  aria-label="Close"
               >
                  <X className="h-5 w-5 text-md-neutral-1400" strokeWidth={2} />
               </button>
            </div>

            <div className="flex flex-col gap-3 px-4 pb-6 pt-1" style={{ paddingBottom: 'max(24px, env(safe-area-inset-bottom))' }}>
               <p className="text-[13px] font-medium leading-5 text-md-neutral-1200">
                  Base is the blockchain network Moodeng is built on. Your wallet, your USDC, every loan you fund and every
                  repayment you make all live here.
               </p>

               {POINTS.map(({ Icon, title, body }) => (
                  <div key={title} className="flex items-start gap-3 rounded-xl border border-md-neutral-400 bg-white px-3 py-3">
                     <span className="mt-0.5 flex size-8 shrink-0 items-center justify-center rounded-lg bg-md-blue-200/50 text-md-blue-800">
                        <Icon className="size-[18px]" strokeWidth={2.1} aria-hidden="true" />
                     </span>
                     <div className="min-w-0 flex-1">
                        <p className="text-[14px] font-semibold leading-tight text-md-heading">{title}</p>
                        <p className="mt-0.5 text-[12px] font-medium leading-snug text-md-neutral-1200">{body}</p>
                     </div>
                  </div>
               ))}

               <a
                  href="https://base.org"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex min-h-11 items-center justify-center gap-1.5 rounded-xl bg-md-blue-800 px-3 py-2.5 text-[14px] font-semibold text-white transition-colors hover:bg-md-blue-1000 active:scale-[0.99]"
               >
                  Learn more about Base
                  <ExternalLink className="size-4" aria-hidden="true" />
               </a>
            </div>
         </section>

         <style>{`
            @keyframes slideUp {
               from { transform: translateY(100%); }
               to { transform: translateY(0); }
            }
         `}</style>
      </div>
   );
}
