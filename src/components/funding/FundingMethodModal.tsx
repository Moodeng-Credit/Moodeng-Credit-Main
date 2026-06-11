import { useState } from 'react';

import { useConnectModal } from '@rainbow-me/rainbowkit';
import { keccak256, stringToHex } from 'viem';
import { useAccount } from 'wagmi';

import { TOAST_TYPES } from '@/components/ToastSystem/config/toastConfig';
import { useToast } from '@/components/ToastSystem/hooks/useToast';

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

/**
 * Internal-only "Choose How to Fund This Loan" modal. Shown ONLY to Moodeng funding admins
 * (George / Emma) when they click "Send Your Help" on the request board. Normal lenders
 * never see this — they get the normal lend flow directly.
 *
 *  - Direct Lend: the existing normal wallet-to-wallet lend (no Loan Note, no relay).
 *  - Smart Contract Lend: the Liquidity Relay — Moodeng fronts the borrower via the
 *    LoanManager contract, mints the Loan Note, and lists it at PRINCIPAL so a lender can
 *    later refill that capital. Borrower repayments auto-route to the Note owner.
 */
export default function FundingMethodModal({ target, onClose, onDirectLend, onFunded }: Props) {
   const { showToast } = useToast();
   const { address } = useAccount();
   const { openConnectModal } = useConnectModal();

   const [method, setMethod] = useState<Method>('choose');
   const [busy, setBusy] = useState(false);

   // Smart-contract (relay) form. Sale price defaults to PRINCIPAL (not totalOwed).
   const [principal, setPrincipal] = useState(String(target.principal || ''));
   const [totalOwed, setTotalOwed] = useState(String(target.totalOwed || ''));
   const [salePrice, setSalePrice] = useState(String(target.principal || ''));
   const [dueDate, setDueDate] = useState(target.dueDate ? target.dueDate.slice(0, 10) : '');

   const close = () => {
      if (busy) return;
      onClose();
   };

   const handleDirectLend = () => {
      onClose();
      onDirectLend();
   };

   const handleSmart = async () => {
      if (!target.borrowerWallet) {
         showToast(TOAST_TYPES.ERROR, 'Missing wallet', 'Borrower has no wallet address on file.');
         return;
      }
      if (!address) {
         openConnectModal?.();
         return;
      }
      const principalNum = Number(principal);
      const totalOwedNum = Number(totalOwed);
      const salePriceNum = Number(salePrice);
      if (!(principalNum > 0) || !(totalOwedNum >= principalNum) || !(salePriceNum > 0) || !dueDate) {
         showToast(TOAST_TYPES.ERROR, 'Check loan terms', 'Check amounts, sale price, and due date (total owed ≥ principal).');
         return;
      }
      const dueTs = Math.floor(new Date(`${dueDate}T23:59:59`).getTime() / 1000);
      if (dueTs <= Math.floor(Date.now() / 1000)) {
         showToast(TOAST_TYPES.ERROR, 'Invalid due date', 'Due date must be in the future.');
         return;
      }

      setBusy(true);
      try {
         const service = getLoanManagerService();
         // Originator approves USDC for the principal it fronts (no-op in mock mode).
         await ensureUsdcAllowance(address, usdcToBaseUnits(principalNum));

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
            } catch (listErr) {
               showToast(TOAST_TYPES.WARNING, 'Listing failed', `Loan funded, but listing failed: ${(listErr as Error).message}`);
            }
         }

         await recordAdminFunding({
            loanId: target.loanId,
            fundingMethod: 'smart_contract',
            txHash,
            borrowerWallet: target.borrowerWallet,
            principal: principalNum,
            totalOwed: totalOwedNum,
            dueDate: `${dueDate}T23:59:59.000Z`,
            onchainLoanId: onchainLoanId ?? undefined,
            onchainRequestId: requestId,
            listingPrice: salePriceNum,
            listingTxHash
         });

         showToast(TOAST_TYPES.SUCCESS, 'Loan funded', `Loan Note minted and listed for ${salePriceNum} USDC (Liquidity Relay enabled).`);
         onFunded?.();
         onClose();
      } catch (err) {
         showToast(TOAST_TYPES.ERROR, 'Funding failed', (err as Error).message || 'Failed to create smart contract loan.');
      } finally {
         setBusy(false);
      }
   };

   const upside = Math.max(0, (Number(totalOwed) || 0) - (Number(salePrice) || 0));

   return (
      <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/50 p-4" role="dialog" aria-modal="true" onClick={close}>
         <div className="w-full max-w-lg rounded-2xl bg-white p-6 shadow-xl" onClick={(e) => e.stopPropagation()}>
            <div className="mb-4 flex items-start justify-between">
               <h2 className="text-lg font-semibold text-gray-900">Choose How to Fund This Loan</h2>
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
                     </label>
                     <label className="text-sm">
                        <span className="mb-1 block text-gray-600">Total owed (USDC)</span>
                        <input type="number" min="0" value={totalOwed} onChange={(e) => setTotalOwed(e.target.value)} className={fieldClass} />
                     </label>
                     <label className="text-sm">
                        <span className="mb-1 block text-gray-600">Sale price (USDC)</span>
                        <input type="number" min="0" value={salePrice} onChange={(e) => setSalePrice(e.target.value)} className={fieldClass} />
                     </label>
                     <label className="text-sm">
                        <span className="mb-1 block text-gray-600">Due date</span>
                        <input type="date" value={dueDate} onChange={(e) => setDueDate(e.target.value)} className={fieldClass} />
                     </label>
                  </div>
                  <div className="rounded-lg bg-[#0052FF]/5 p-3 text-xs text-gray-600">
                     <p>
                        A Loan Note (NFT) is minted to Moodeng and listed at the <strong>sale price (defaults to principal)</strong> so a
                        lender can later refill this capital by buying the repayment rights from Moodeng.
                     </p>
                     <p className="mt-1">
                        Expected future lender upside: <strong>{upside.toLocaleString()} USDC</strong> (total owed − sale price)
                     </p>
                  </div>
                  <div className="flex gap-3">
                     <button type="button" onClick={() => setMethod('choose')} disabled={busy} className="flex-1 rounded-lg border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700">
                        Back
                     </button>
                     <button
                        type="button"
                        onClick={handleSmart}
                        disabled={busy}
                        className="flex-1 rounded-lg bg-[#0052FF] px-4 py-2 text-sm font-medium text-white disabled:opacity-50"
                     >
                        {busy ? 'Processing…' : !address ? 'Connect wallet' : 'Smart Contract Lend'}
                     </button>
                  </div>
               </div>
            ) : null}
         </div>
      </div>
   );
}
