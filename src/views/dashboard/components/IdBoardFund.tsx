import { useEffect, useState } from 'react';

import { Send } from 'lucide-react';

import { callWaltPayout, waltPayoutErrorText, type WaltPayoutResult } from '@/app/admin/WaltPayoutCard';

/**
 * Request board, Indonesia-track request, Moodeng's funding accounts only: one "Fund" button that pays
 * the borrower's Walt from Moodeng's payout wallet on BNB Chain (admin-fund-loan → walt_payout_auto →
 * payNow, at most once per loan, same limits as Admin → Requests → "Pay now").
 *
 * Two taps (Fund → Confirm) because it moves money. A borrower with no Walt deposit address saved can't
 * be paid this way: the Walt Transfer card in the admin Telegram chat still works for them.
 */
type Phase = 'idle' | 'confirm' | 'sending' | 'paying' | 'done' | 'error';

const NO_ADDRESS =
   'No Walt address saved yet. Pay this one from the Walt Transfer card in Telegram, or ask them to paste their Walt deposit address in the bot.';

export default function IdBoardFund({ loanId, amount, onFunded }: { loanId: string; amount: number; onFunded: () => void }) {
   const [phase, setPhase] = useState<Phase>('idle');
   const [message, setMessage] = useState<string | null>(null);

   const apply = (res: WaltPayoutResult) => {
      if (!res.ok) {
         setMessage(res.error === 'no_walt_address' ? NO_ADDRESS : waltPayoutErrorText(res.error));
         setPhase('error');
         return;
      }
      if (res.state === 'found' || res.funded) {
         setPhase('done');
         onFunded();
         return;
      }
      setPhase(res.state === 'paying' ? 'paying' : 'idle');
   };

   // Sent, not confirmed on BNB Chain yet: look again every 8 s (the server job also checks every 5 min).
   useEffect(() => {
      if (phase !== 'paying') return undefined;
      const id = window.setInterval(() => {
         void callWaltPayout({ action: 'walt_payout_check', loanId }).then(apply);
      }, 8_000);
      return () => window.clearInterval(id);
      // eslint-disable-next-line react-hooks/exhaustive-deps
   }, [phase, loanId]);

   const fund = async () => {
      if (phase === 'idle' || phase === 'error') {
         setMessage(null);
         setPhase('confirm');
         return;
      }
      if (phase !== 'confirm') return;
      setPhase('sending');
      apply(await callWaltPayout({ action: 'walt_payout_auto', loanId }));
   };

   if (phase === 'done') {
      return (
         <div className="w-full rounded-md-lg bg-[#2f9e44] py-md-3 text-center text-md-b1 font-semibold text-white">
            Sent to their Walt ✅
         </div>
      );
   }

   const busy = phase === 'sending' || phase === 'paying';
   return (
      <div className="flex w-full flex-col gap-2">
         <button
            type="button"
            onClick={() => void fund()}
            disabled={busy}
            className="flex w-full items-center justify-center gap-2 rounded-md-lg bg-[#ffd75a] py-md-3 text-md-b1 font-semibold text-[#4a2a00] transition-all duration-150 hover:brightness-105 active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-60"
         >
            {phase === 'sending'
               ? 'Sending…'
               : phase === 'paying'
                 ? 'Sent. Confirming on chain…'
                 : phase === 'confirm'
                   ? `Confirm: send $${amount} now`
                   : `Fund $${amount} to their Walt`}
            {!busy ? <Send className="h-5 w-5" /> : null}
         </button>
         {phase === 'confirm' ? (
            <button type="button" onClick={() => setPhase('idle')} className="text-md-b2 text-md-neutral-1200 underline">
               Cancel
            </button>
         ) : null}
         {message ? <p className="text-md-b2 text-[#b42318]">{message}</p> : null}
      </div>
   );
}
