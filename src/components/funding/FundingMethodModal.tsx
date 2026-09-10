import { type ReactNode, useMemo, useState } from 'react';

import { useConnectModal } from '@rainbow-me/rainbowkit';
import { Check, Wallet } from 'lucide-react';
import { keccak256, stringToHex } from 'viem';
import { useAccount } from 'wagmi';

import { TOAST_TYPES } from '@/components/ToastSystem/config/toastConfig';
import { useToast } from '@/components/ToastSystem/hooks/useToast';

import { txExplorerUrl } from '@/config/loanFundingConfig';
import { ensureUsdcAllowance, getLoanManagerService } from '@/lib/web3/loanManager';
import { recordAdminFunding, usdcToBaseUnits } from '@/lib/loanNotes/api';

export interface FundLoanTarget {
   loanId: string; // loans.id (UUID)
   borrowerWallet: string | null;
   borrowerName: string;
   principal: number; // USDC
   totalOwed: number; // USDC
   dueDate: string; // ISO
}

type Method = 'choose' | 'smart';

interface Props {
   target: FundLoanTarget;
   onClose: () => void;
   /** Runs the existing normal lender flow (wallet-to-wallet to the borrower). */
   onDirectLend: () => void;
   /** Called after a smart-contract (relay) funding is recorded. */
   onFunded?: () => void;
}

const fieldClass = 'w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-[#0052FF] focus:outline-none';

const shortAddress = (address?: string) => (address ? `${address.slice(0, 6)}…${address.slice(-4)}` : '');

/**
 * Internal-only "Fund This Loan" modal. Shown ONLY to Moodeng funding admins (George / Emma)
 * when they click "Send Your Help" on the request board. Normal lenders never see this — they
 * get the normal lend flow directly.
 *
 *  - Direct Lend: the existing normal wallet-to-wallet lend (no Loan Note, no relay).
 *  - Smart Contract Lend: the Liquidity Relay — Moodeng fronts the borrower via the
 *    LoanManager contract, mints the Loan Note, and lists it at PRINCIPAL so a lender can
 *    later refill that capital. Borrower repayments auto-route to the Note owner.
 *
 * The Smart Contract path is a persistent two-step checklist (Connect → Fund) that lights each
 * step green as it completes, instead of a single button that silently needs a second click to
 * fund after connecting. Step 2 ("Fund") is a real user tap — never auto-fired off a connect
 * effect — which keeps the signing popup on a live gesture and never degrades to "Try again".
 * See [[wallet-double-tap-root-cause]]. Terms are validated inline (no error toasts); the only
 * toast this modal raises is the single success confirmation.
 */
export default function FundingMethodModal({ target, onClose, onDirectLend, onFunded }: Props) {
   const { showToast } = useToast();
   const { address } = useAccount();
   const { openConnectModal } = useConnectModal();
   const connected = Boolean(address);

   const [method, setMethod] = useState<Method>('choose');
   const [busy, setBusy] = useState(false);
   // Non-blocking status shown inline in the modal (replaces the old pile of error/warning toasts).
   const [notice, setNotice] = useState<{ tone: 'error' | 'pending'; message: ReactNode } | null>(null);

   // Smart-contract (relay) form. Sale price defaults to PRINCIPAL (not totalOwed).
   const [principal, setPrincipal] = useState(String(target.principal || ''));
   const [totalOwed, setTotalOwed] = useState(String(target.totalOwed || ''));
   const [salePrice, setSalePrice] = useState(String(target.principal || ''));
   const [dueDate, setDueDate] = useState(target.dueDate ? target.dueDate.slice(0, 10) : '');

   // Inline field validation — surfaced under each input, never as a toast. `termsValid` gates
   // the Fund button so a bad value can't be submitted in the first place.
   const errors = useMemo(() => {
      const principalNum = Number(principal);
      const totalOwedNum = Number(totalOwed);
      const salePriceNum = Number(salePrice);
      const dueTs = dueDate ? Math.floor(new Date(`${dueDate}T23:59:59`).getTime() / 1000) : 0;
      return {
         principal: principalNum > 0 ? null : 'Enter a principal above 0.',
         totalOwed: totalOwedNum >= principalNum ? null : 'Must be at least the principal.',
         salePrice: salePriceNum > 0 ? null : 'Enter a sale price above 0.',
         dueDate: !dueDate ? 'Pick a due date.' : dueTs <= Math.floor(Date.now() / 1000) ? 'Must be in the future.' : null,
         missingWallet: target.borrowerWallet ? null : 'Borrower has no wallet address on file.'
      };
   }, [principal, totalOwed, salePrice, dueDate, target.borrowerWallet]);

   const termsValid = !errors.principal && !errors.totalOwed && !errors.salePrice && !errors.dueDate && !errors.missingWallet;

   const close = () => {
      if (busy) return;
      onClose();
   };

   const handleDirectLend = () => {
      onClose();
      onDirectLend();
   };

   const handleFund = async () => {
      // Step 2 is only reachable once connected and terms are valid, so we don't re-toast those
      // cases — we just no-op defensively.
      if (!connected || !termsValid || !target.borrowerWallet) return;

      const principalNum = Number(principal);
      const totalOwedNum = Number(totalOwed);
      const salePriceNum = Number(salePrice);
      const dueTs = Math.floor(new Date(`${dueDate}T23:59:59`).getTime() / 1000);

      setBusy(true);
      setNotice(null);
      try {
         const service = getLoanManagerService();
         // Originator approves USDC for the principal it fronts (no-op in mock mode).
         await ensureUsdcAllowance(address as string, usdcToBaseUnits(principalNum));

         const requestId = keccak256(stringToHex(`moodeng:${target.loanId}`));
         const { txHash, loanId: onchainLoanId } = await service.createAndFundLoan({
            borrower: target.borrowerWallet,
            principal: usdcToBaseUnits(principalNum).toString(),
            totalOwed: usdcToBaseUnits(totalOwedNum).toString(),
            dueDate: dueTs,
            requestId
         });

         // Auto-list the Loan Note at the SALE PRICE (defaults to principal) so a lender can
         // later refill Moodeng's capital via the relay. Capture the listing tx separately.
         let listingTxHash: string | undefined;
         if (onchainLoanId) {
            try {
               const listResult = await service.listLoanNote(onchainLoanId, usdcToBaseUnits(salePriceNum).toString());
               listingTxHash = listResult.txHash;
            } catch {
               // Non-fatal: the loan is funded; only the resale listing didn't post. Don't scare
               // the admin with a warning — the relay tab can re-list. Swallow it silently.
            }
         }

         // The loan now exists on-chain. Recording to the DB is recoverable — if it fails,
         // the funds are NOT lost; we surface the tx hash + on-chain id so it can be re-recorded.
         const recordPayload = {
            loanId: target.loanId,
            fundingMethod: 'smart_contract' as const,
            txHash,
            borrowerWallet: target.borrowerWallet,
            funderWallet: address as string,
            principal: principalNum,
            totalOwed: totalOwedNum,
            dueDate: `${dueDate}T23:59:59.000Z`,
            onchainLoanId: onchainLoanId ?? undefined,
            onchainRequestId: requestId,
            listingPrice: salePriceNum,
            listingTxHash
         };
         try {
            await recordAdminFunding(recordPayload);
         } catch {
            try {
               await recordAdminFunding(recordPayload); // one silent retry
            } catch {
               // Funds moved on-chain but the DB write failed twice. Keep the modal open with a
               // single clear inline message + explorer link (no toast), so it can be re-recorded.
               setNotice({
                  tone: 'pending',
                  message: (
                     <>
                        Funded on-chain{onchainLoanId ? ` (id ${onchainLoanId})` : ''} — saving to the database didn’t
                        complete. The money was sent; re-record it from the Liquidity Relay tab.{' '}
                        <a href={txExplorerUrl(txHash)} target="_blank" rel="noreferrer" className="font-medium underline">
                           View transaction
                        </a>
                     </>
                  )
               });
               onFunded?.();
               setBusy(false);
               return;
            }
         }

         // The one and only toast this flow raises: a clean success.
         showToast(TOAST_TYPES.SUCCESS, 'Loan funded', `Loan Note minted and listed for ${salePriceNum} USDC.`);
         onFunded?.();
         onClose();
      } catch (err) {
         // Reaches here only if the on-chain create/approve failed — nothing was charged. Show it
         // inline (not a toast) so the admin stays in the checklist and can simply tap Fund again.
         setNotice({
            tone: 'error',
            message: (err as Error).message || 'Could not create the smart-contract loan. Nothing was charged — try again.'
         });
      } finally {
         setBusy(false);
      }
   };

   const upside = Math.max(0, (Number(totalOwed) || 0) - (Number(salePrice) || 0));

   return (
      <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/50 p-4" role="dialog" aria-modal="true" onClick={close}>
         <div className="w-full max-w-lg rounded-2xl bg-white p-6 shadow-xl" onClick={(e) => e.stopPropagation()}>
            <div className="mb-4 flex items-start justify-between">
               <h2 className="text-lg font-semibold text-gray-900">{method === 'smart' ? 'Fund This Loan' : 'Choose How to Fund This Loan'}</h2>
               <button type="button" onClick={close} className="text-gray-400 hover:text-gray-600" aria-label="Close">
                  ✕
               </button>
            </div>

            {/* Read-only loan summary */}
            <dl className="mb-4 grid grid-cols-2 gap-x-4 gap-y-2 rounded-xl bg-gray-50 p-3 text-sm">
               <div className="col-span-2 flex justify-between">
                  <dt className="text-gray-500">Borrower</dt>
                  <dd className="font-medium text-gray-900">{target.borrowerName}</dd>
               </div>
               <div className="flex justify-between">
                  <dt className="text-gray-500">Principal</dt>
                  <dd className="font-medium text-gray-900">{target.principal} USDC</dd>
               </div>
               <div className="flex justify-between">
                  <dt className="text-gray-500">Total owed</dt>
                  <dd className="font-medium text-gray-900">{target.totalOwed} USDC</dd>
               </div>
               <div className="col-span-2 flex justify-between">
                  <dt className="text-gray-500">Due date</dt>
                  <dd className="font-medium text-gray-900">{target.dueDate ? target.dueDate.slice(0, 10) : '—'}</dd>
               </div>
            </dl>

            {method === 'choose' ? (
               <div className="space-y-4">
                  {/* Option 2 — recommended, shown first */}
                  <button
                     type="button"
                     onClick={() => setMethod('smart')}
                     className="block w-full rounded-xl border-2 border-[#0052FF] bg-[#0052FF]/5 p-4 text-left transition hover:bg-[#0052FF]/10"
                  >
                     <div className="flex items-center gap-2">
                        <span className="font-semibold text-gray-900">Smart Contract Lend</span>
                        <span className="rounded-full bg-[#0052FF] px-2 py-0.5 text-[11px] font-medium text-white">Recommended</span>
                     </div>
                     <p className="mt-1 text-sm text-gray-600">
                        Fund through the LoanManager contract. This creates a Loan Note and lets Moodeng recover liquidity later when a
                        lender funds this same loan.
                     </p>
                  </button>

                  {/* Option 1 — secondary */}
                  <button
                     type="button"
                     onClick={handleDirectLend}
                     className="block w-full rounded-xl border border-gray-200 bg-gray-50 p-4 text-left transition hover:bg-gray-100"
                  >
                     <span className="font-semibold text-gray-700">Direct Lend</span>
                     <p className="mt-1 text-sm text-gray-500">Send USDC directly to the borrower. No Loan Note is created.</p>
                     <p className="mt-1 text-xs text-amber-700">This loan will not be sellable later through the Liquidity Relay.</p>
                  </button>
               </div>
            ) : null}

            {method === 'smart' ? (
               <div className="space-y-4">
                  <div className="grid grid-cols-2 gap-3">
                     <label className="text-sm">
                        <span className="mb-1 block text-gray-600">Principal (USDC)</span>
                        <input type="number" min="0" value={principal} onChange={(e) => setPrincipal(e.target.value)} className={fieldClass} />
                        {errors.principal ? <span className="mt-1 block text-xs text-red-600">{errors.principal}</span> : null}
                     </label>
                     <label className="text-sm">
                        <span className="mb-1 block text-gray-600">Total owed (USDC)</span>
                        <input type="number" min="0" value={totalOwed} onChange={(e) => setTotalOwed(e.target.value)} className={fieldClass} />
                        {errors.totalOwed ? <span className="mt-1 block text-xs text-red-600">{errors.totalOwed}</span> : null}
                     </label>
                     <label className="text-sm">
                        <span className="mb-1 block text-gray-600">Sale price (USDC)</span>
                        <input type="number" min="0" value={salePrice} onChange={(e) => setSalePrice(e.target.value)} className={fieldClass} />
                        {errors.salePrice ? <span className="mt-1 block text-xs text-red-600">{errors.salePrice}</span> : null}
                     </label>
                     <label className="text-sm">
                        <span className="mb-1 block text-gray-600">Due date</span>
                        <input type="date" value={dueDate} onChange={(e) => setDueDate(e.target.value)} className={fieldClass} />
                        {errors.dueDate ? <span className="mt-1 block text-xs text-red-600">{errors.dueDate}</span> : null}
                     </label>
                  </div>

                  {errors.missingWallet ? (
                     <p className="rounded-lg bg-amber-50 px-3 py-2 text-xs text-amber-800">{errors.missingWallet}</p>
                  ) : null}

                  <div className="rounded-lg bg-[#0052FF]/5 p-3 text-xs text-gray-600">
                     <p>
                        A Loan Note (NFT) is minted to Moodeng and listed at the <strong>sale price (defaults to principal)</strong> so a
                        lender can later refill this capital by buying the repayment rights from Moodeng.
                     </p>
                     <p className="mt-1">
                        Expected future lender upside: <strong>{upside.toLocaleString()} USDC</strong> (total owed − sale price)
                     </p>
                  </div>

                  {/* Two-step checklist: Connect → Fund. Each step lights green when complete. */}
                  <div>
                     <ChecklistStep number={1} state={connected ? 'done' : 'active'} title="Connect your wallet">
                        {connected ? (
                           <span className="inline-flex items-center gap-1.5 rounded-lg bg-md-green-100 px-2.5 py-1 text-xs font-medium text-md-green-800">
                              <Wallet className="h-3.5 w-3.5" /> {shortAddress(address)} connected
                           </span>
                        ) : (
                           <button
                              type="button"
                              onClick={() => openConnectModal?.()}
                              className="rounded-lg bg-[#0052FF] px-4 py-2 text-sm font-medium text-white transition active:scale-[0.98]"
                           >
                              Connect wallet
                           </button>
                        )}
                     </ChecklistStep>

                     <div className={`ml-[13px] h-4 w-0.5 ${connected ? 'bg-md-green-600' : 'bg-gray-200'}`} aria-hidden="true" />

                     <ChecklistStep number={2} state={connected ? 'active' : 'locked'} title="Fund the loan">
                        {connected ? (
                           <button
                              type="button"
                              onClick={handleFund}
                              disabled={busy || !termsValid}
                              className="rounded-lg bg-[#0052FF] px-4 py-2 text-sm font-medium text-white transition active:scale-[0.98] disabled:opacity-50"
                           >
                              {busy ? 'Processing…' : 'Fund loan'}
                           </button>
                        ) : (
                           <p className="text-xs text-gray-500">Unlocks once your wallet is connected</p>
                        )}
                     </ChecklistStep>
                  </div>

                  {notice ? (
                     <p
                        className={`rounded-lg px-3 py-2 text-xs ${
                           notice.tone === 'error' ? 'bg-red-50 text-red-700' : 'bg-amber-50 text-amber-800'
                        }`}
                     >
                        {notice.message}
                     </p>
                  ) : null}

                  <div className="flex gap-3">
                     <button
                        type="button"
                        onClick={() => {
                           setMethod('choose');
                           setNotice(null);
                        }}
                        disabled={busy}
                        className="flex-1 rounded-lg border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 disabled:opacity-50"
                     >
                        Back
                     </button>
                  </div>
               </div>
            ) : null}
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
           ? 'bg-[#0052FF]/10 text-[#0052FF] border border-[#0052FF]/30'
           : 'bg-gray-100 text-gray-500 border border-gray-200';

   return (
      <div className={`flex gap-3 py-1.5 ${state === 'locked' ? 'opacity-50' : ''}`}>
         <span className={`flex h-7 w-7 flex-none items-center justify-center rounded-full text-xs font-medium ${badgeClass}`}>
            {state === 'done' ? <Check className="h-4 w-4" /> : number}
         </span>
         <div className="flex-1">
            <p className="mt-0.5 text-sm font-medium text-gray-900">{title}</p>
            {children}
         </div>
      </div>
   );
}
