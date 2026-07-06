import { type ReactNode } from 'react';

import { Check, Send, Wallet, X } from 'lucide-react';

interface LendChecklistModalProps {
   amountLabel: string;
   borrowerName: string;
   /** Step 1 is done once a wallet is connected. */
   connected: boolean;
   connectedAddress?: string;
   /** Step 2 is running (the USDC send is in flight). */
   isProcessing: boolean;
   /** Opens the wallet picker for step 1. */
   onConnect: () => void;
   /** Fires the USDC send for step 2. Only tappable once connected — a real tap, never auto-fired. */
   onConfirm: () => void;
   onClose: () => void;
}

const shortAddress = (address?: string) => (address ? `${address.slice(0, 6)}…${address.slice(-4)}` : '');

/**
 * Guided two-step modal for the "use a different wallet" (non-Base) lend path. Non-Base wallets
 * genuinely need connect-then-sign; this presents it as one persistent checklist that lights each
 * step green and advances, instead of a modal that appears and vanishes. Crucially, step 2 is a
 * real user tap — never auto-fired from a connect effect — so the signing popup opens on a live
 * gesture and never degrades to Base's "Try again". See [[wallet-double-tap-root-cause]].
 */
export default function LendChecklistModal({
   amountLabel,
   borrowerName,
   connected,
   connectedAddress,
   isProcessing,
   onConnect,
   onConfirm,
   onClose
}: LendChecklistModalProps) {
   return (
      <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/50 p-4" onClick={onClose}>
         <div
            className="w-full max-w-sm overflow-hidden rounded-2xl bg-white shadow-lg"
            style={{ minWidth: '300px' }}
            onClick={(e) => e.stopPropagation()}
         >
            <div className="flex items-start justify-between px-5 pb-2 pt-5">
               <div>
                  <h3 className="text-lg font-medium text-md-heading">Send your help</h3>
                  <p className="text-md-b3 text-md-neutral-800">
                     {amountLabel} to {borrowerName} · two quick steps
                  </p>
               </div>
               <button
                  type="button"
                  onClick={onClose}
                  aria-label="Close"
                  className="text-md-neutral-800 transition hover:text-md-neutral-1200"
               >
                  <X className="h-5 w-5" />
               </button>
            </div>

            <div className="px-5 pb-4">
               <ChecklistStep number={1} state={connected ? 'done' : 'active'} title="Connect your wallet">
                  {connected ? (
                     <span className="inline-flex items-center gap-1.5 rounded-lg bg-md-green-100 px-2.5 py-1 text-md-b3 font-medium text-md-green-800">
                        <Wallet className="h-3.5 w-3.5" /> {shortAddress(connectedAddress)} connected
                     </span>
                  ) : (
                     <>
                        <p className="mb-2 text-md-b3 text-md-neutral-800">MetaMask, Trust, or another</p>
                        <button
                           type="button"
                           onClick={onConnect}
                           className="rounded-lg bg-md-primary-1200 px-4 py-2 text-md-b2 font-medium text-md-neutral-100 transition active:scale-[0.98]"
                        >
                           Connect
                        </button>
                     </>
                  )}
               </ChecklistStep>

               <div className={`ml-[13px] h-4 w-0.5 ${connected ? 'bg-md-green-600' : 'bg-md-neutral-300'}`} aria-hidden="true" />

               <ChecklistStep number={2} state={connected ? 'active' : 'locked'} title="Confirm the payment">
                  {connected ? (
                     <>
                        <p className="mb-2 text-md-b3 text-md-neutral-800">Approve {amountLabel} in your wallet</p>
                        <button
                           type="button"
                           disabled={isProcessing}
                           onClick={onConfirm}
                           className="inline-flex items-center gap-2 rounded-lg bg-md-primary-1200 px-4 py-2 text-md-b2 font-medium text-md-neutral-100 transition active:scale-[0.98] disabled:opacity-60"
                        >
                           {isProcessing ? 'Sending…' : `Send ${amountLabel}`}
                           {!isProcessing && <Send className="h-4 w-4" />}
                        </button>
                     </>
                  ) : (
                     <p className="text-md-b3 text-md-neutral-800">Unlocks once you connect</p>
                  )}
               </ChecklistStep>
            </div>

            <div className="border-t border-md-neutral-200 bg-md-neutral-100 px-5 py-3">
               <p className="text-md-b3 text-md-neutral-800">
                  <span className="font-medium">Tip:</span> Base Account does both steps in one tap.
               </p>
            </div>
         </div>
      </div>
   );
}

function ChecklistStep({
   number,
   state,
   title,
   children
}: {
   number: number;
   state: 'done' | 'active' | 'locked';
   title: string;
   children: ReactNode;
}) {
   const badgeClass =
      state === 'done'
         ? 'bg-md-green-100 text-md-green-800'
         : state === 'active'
           ? 'bg-md-primary-100 text-md-primary-1200 border border-md-primary-300'
           : 'bg-md-neutral-200 text-md-neutral-800 border border-md-neutral-300';

   return (
      <div className={`flex gap-3 py-1.5 ${state === 'locked' ? 'opacity-50' : ''}`}>
         <span className={`flex h-7 w-7 flex-none items-center justify-center rounded-full text-md-b3 font-medium ${badgeClass}`}>
            {state === 'done' ? <Check className="h-4 w-4" /> : number}
         </span>
         <div className="flex-1">
            <p className="mt-0.5 text-md-b1 font-medium text-md-heading">{title}</p>
            {children}
         </div>
      </div>
   );
}
