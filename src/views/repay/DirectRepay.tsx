import { type ReactNode, useMemo, useState } from 'react';

import { useDispatch, useSelector } from 'react-redux';

import { useLoanData } from '@/hooks/useLoanData';
import { confirmLoanPayment, PaymentNotConfirmedError } from '@/store/slices/loanSlice';
import type { AppDispatch, RootState } from '@/store/store';
import type { Loan } from '@/types/loanTypes';
import { parseDateSafely } from '@/utils/dateFormatters';
import { formatCurrency, toNumber } from '@/utils/decimalHelpers';
import { Card, DoneRow, ErrorText, GoldButton, StepHead } from '@/views/indonesia/ui';

// /repay for a borrower whose wallet the team paused (users.wallet_suspended). No wallet, no
// Base Pay: send USDC on Base straight to the loan's lender wallet, paste the transaction ID, and
// confirm-loan-payment records it like any repayment (any sender; partial payments count).
// Built Nov 2026 for a borrower who said she lost access to her wallet while still owing.

const HASH_RE = /0x[a-fA-F0-9]{64}/;

const remainingOf = (loan: Loan) => Math.max(0, toNumber(loan.totalRepaymentAmount) - toNumber(loan.repaidAmount));

const PREVIEW_LOAN = {
   id: 'preview',
   trackingId: 'LOAN-preview',
   loanStatus: 'Lent',
   repaymentStatus: 'Unpaid',
   totalRepaymentAmount: 120,
   repaidAmount: 0,
   dueDate: '2026-12-10T16:00:00Z',
   lenderWallet: '0xC1022456DFd3BF36af1dA553cd5631F9e76ca8D6'
} as unknown as Loan;

export default function DirectRepay({ preview = false }: { preview?: boolean }) {
   const dispatch = useDispatch<AppDispatch>();
   const user = useSelector((state: RootState) => state.auth.user);
   const loans = useSelector((state: RootState) => state.loans.loans.gloans);
   const { hasFetched } = useLoanData({ userId: user?.id, enabled: Boolean(user?.id) && !preview });

   const openLoans = useMemo(() => {
      if (preview) return [PREVIEW_LOAN];
      return loans
         .filter((loan) => loan.borrowerUser === user?.id && loan.loanStatus === 'Lent' && loan.repaymentStatus !== 'Paid')
         .filter((loan) => remainingOf(loan) > 0)
         .sort((a, b) => parseDateSafely(a.dueDate).getTime() - parseDateSafely(b.dueDate).getTime());
   }, [loans, preview, user?.id]);

   // Soonest-due loan first; its own lender wallet is where the money goes.
   const loan = openLoans[0];
   const owed = loan ? remainingOf(loan) : 0;
   const to = loan?.lenderWallet ?? '';

   const [copied, setCopied] = useState(false);
   const [pasted, setPasted] = useState('');
   const [busy, setBusy] = useState(false);
   const [error, setError] = useState<string | null>(null);
   const [done, setDone] = useState<number | null>(null);

   const copy = async () => {
      try {
         await navigator.clipboard.writeText(to);
         setCopied(true);
      } catch {
         setError('Could not copy. Press and hold the address to copy it.');
      }
   };

   const submit = async () => {
      const hash = pasted.match(HASH_RE)?.[0];
      if (!hash) {
         setError('Paste the transaction ID. It starts with 0x.');
         return;
      }
      if (!loan || preview) return;
      setBusy(true);
      setError(null);
      try {
         const before = owed;
         const updated = await dispatch(confirmLoanPayment({ loanId: loan.id, hash, method: 'wallet', action: 'repay' })).unwrap();
         setDone(Math.max(0, before - remainingOf(updated)));
         setPasted('');
      } catch (err) {
         if (err instanceof PaymentNotConfirmedError || (err as { name?: string })?.name === 'PaymentNotConfirmedError') {
            setError('Still on its way. Try again in a minute.');
         } else {
            setError(err instanceof Error ? err.message : 'Could not check that payment. Message us on Messenger.');
         }
      } finally {
         setBusy(false);
      }
   };

   let body: ReactNode;
   if (!preview && !hasFetched) {
      body = <div className="h-44 rounded-[20px] bg-[#f3ead2] dark:bg-[#1a1524]" />;
   } else if (!loan) {
      body = (
         <Card>
            <DoneRow>{done !== null ? `Got it: $${formatCurrency(done)} paid. You're all paid up.` : "You're all paid up."}</DoneRow>
         </Card>
      );
   } else {
      body = (
         <>
            {done !== null ? (
               <Card>
                  <DoneRow>{`Got it: $${formatCurrency(done)} paid. $${formatCurrency(owed)} left.`}</DoneRow>
               </Card>
            ) : null}
            <Card>
               <p className="text-[15px] font-semibold text-[#7a6a4f] dark:text-[#bfb29a]">1. Send</p>
               <p className="text-[34px] font-extrabold leading-none tracking-[-0.02em]">${formatCurrency(owed)} USDC</p>
               <button
                  type="button"
                  onClick={() => void copy()}
                  className={`flex w-full flex-col gap-1 rounded-[16px] border-2 px-4 py-3 text-left transition active:scale-[0.99] ${
                     copied
                        ? 'border-[#2f9e44] bg-[#eafbef] dark:bg-[#12301e]'
                        : 'border-dashed border-[#e0c97a] bg-[#fffaf0] dark:border-[#4a3d1c] dark:bg-[#100d17]'
                  }`}
               >
                  <span className="break-all font-mono text-[15px] font-bold leading-[20px]">{to}</span>
                  <span className="text-[14px] font-semibold text-[#8a6d1f] dark:text-[#e6cf8f]">{copied ? 'Copied ✓' : 'Tap to copy'}</span>
               </button>
               <p className="rounded-[12px] bg-[#fff1f0] px-3 py-2 text-[14px] font-semibold text-[#b42318] dark:bg-[#3a1512] dark:text-[#ffb4ab]">
                  Base network only. Other networks lose the money.
               </p>
            </Card>
            <Card>
               <p className="text-[15px] font-semibold text-[#7a6a4f] dark:text-[#bfb29a]">2. Paste the transaction ID</p>
               <input
                  value={pasted}
                  onChange={(e) => {
                     setPasted(e.target.value);
                     setError(null);
                  }}
                  placeholder="0x…"
                  autoComplete="off"
                  spellCheck={false}
                  className="min-h-[56px] w-full rounded-[14px] border-2 border-[#f0e6c8] bg-white px-4 font-mono text-[15px] outline-none focus:border-[#e0b43a] dark:border-[#2e2638] dark:bg-[#100d17]"
               />
               {error ? <ErrorText>{error}</ErrorText> : null}
               <GoldButton busy={busy} disabled={!pasted.trim()} onClick={() => void submit()}>
                  I sent it
               </GoldButton>
            </Card>
         </>
      );
   }

   return (
      <main className="min-h-screen bg-[#fffaf0] px-4 pb-28 pt-8 text-[#2b2116] dark:bg-[#100d17] dark:text-[#f5efe3]">
         <div className="mx-auto flex w-full max-w-[440px] flex-col gap-4">
            <StepHead image="/hippos/hippo-wallet.png" title="Pay us directly" subtitle="Your wallet is paused. Send USDC from your exchange." />
            {body}
         </div>
      </main>
   );
}

/** /withdraw and /money while the wallet is paused. */
export function WalletPaused() {
   return (
      <main className="min-h-screen bg-[#fffaf0] px-4 pb-28 pt-8 text-[#2b2116] dark:bg-[#100d17] dark:text-[#f5efe3]">
         <div className="mx-auto flex w-full max-w-[440px] flex-col gap-4">
            <StepHead image="/hippos/hippo-friendly-lock.png" title="Wallet paused" subtitle="Message us on Messenger if you have questions." />
         </div>
      </main>
   );
}

/** Route wrapper: a paused wallet gets `paused` instead of the normal page. */
export function WalletSuspendedGate({ children, paused }: { children: ReactNode; paused: ReactNode }) {
   const suspended = useSelector((state: RootState) => state.auth.user?.walletSuspended === true);
   return suspended ? paused : children;
}
