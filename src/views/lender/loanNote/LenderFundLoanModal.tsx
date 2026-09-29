import { useState } from 'react';

import { useConnectModal } from '@rainbow-me/rainbowkit';
import { useQuery } from '@tanstack/react-query';
import { ChevronRight, Send, X } from 'lucide-react';
import { useSelector } from 'react-redux';
import { useNavigate } from 'react-router-dom';
import { useAccount } from 'wagmi';

import Loading from '@/components/Loading';
import UserAvatar from '@/components/UserAvatar';

import { txExplorerUrl } from '@/config/loanFundingConfig';
import { getLoanNotePageData } from '@/lib/loanNotes/api';
import type { LoanNotePageData } from '@/lib/loanNotes/types';
import type { RootState } from '@/store/store';
import LendChecklistModal from '@/views/dashboard/components/LendChecklistModal';
import { type BuyResult, useBuyLoanNote } from '@/views/lender/loanNote/useBuyLoanNote';

const usd = (n: number) => `${n.toLocaleString(undefined, { maximumFractionDigits: 2 })} USDC`;

interface Props {
   loanId: string;
   onClose: () => void;
}

/**
 * Dashboard funding popup: a focused modal letting a logged-in lender fund one specific
 * borrower's existing Moodeng loan (buy the Loan Note) without going through the request
 * board. Repayments later auto-route to the lender — no claim step.
 */
export default function LenderFundLoanModal({ loanId, onClose }: Props) {
   const navigate = useNavigate();
   const { address } = useAccount();
   const { openConnectModal } = useConnectModal();
   const { buy, busy, step } = useBuyLoanNote();
   const userId = useSelector((state: RootState) => state.auth.user?.id);
   const [success, setSuccess] = useState<BuyResult | null>(null);
   // Buying a Loan Note is a two-call contract flow (approve + buyLoanNote) — there's no
   // Base-Pay-style single popup for it, so a lender with no wallet gets the same explicit
   // connect-then-confirm checklist used for "Use a different wallet" on the request board.
   const [showWalletChecklist, setShowWalletChecklist] = useState(false);

   const { data, isLoading } = useQuery<LoanNotePageData | null>({
      queryKey: ['loan-note-popup', loanId, userId ?? null, address ?? null],
      queryFn: () => getLoanNotePageData(loanId, { userId, walletAddress: address }),
      enabled: Boolean(loanId)
   });

   const borrowerName = data?.borrowerDisplayName ?? 'this borrower';

   const handleSupport = async () => {
      if (!data) return;
      if (!address) {
         setShowWalletChecklist(true);
         return;
      }
      const result = await buy(data);
      if (result) setSuccess(result);
   };

   const handleConfirmFromChecklist = async () => {
      if (!data) return;
      const result = await buy(data);
      if (result) setSuccess(result);
      setShowWalletChecklist(false);
   };

   return (
      <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/50 p-4" role="dialog" aria-modal="true" onClick={busy ? undefined : onClose}>
         <div className="w-full max-w-md rounded-[24px] border border-[#f0f0f0] bg-white p-md-4 shadow-[0px_11px_24px_0px_rgba(0,0,0,0.02)]" onClick={(e) => e.stopPropagation()}>
            <button type="button" onClick={onClose} disabled={busy} className="float-right text-md-neutral-1000 hover:text-md-neutral-1700" aria-label="Close">
               <X className="h-5 w-5" aria-hidden="true" />
            </button>

            {isLoading ? (
               <Loading />
            ) : !data ? (
               <div className="py-8 text-center text-md-b2 text-md-neutral-700">This loan is no longer available.</div>
            ) : success ? (
               <div className="flex flex-col items-center gap-4 text-center">
                  <img src="/icons/check-3d.png" alt="" className="size-[72px]" />
                  <div>
                     <h2 className="text-md-h5 font-semibold text-md-heading">Thank you for funding</h2>
                     <p className="mt-md-2 text-md-b2 text-[#6d6d6d]">
                        You funded {borrowerName}’s loan. If they repay, the repayment is automatically sent to your wallet.
                     </p>
                  </div>
                  <dl className="w-full space-y-md-1 rounded-[16px] border border-[#f0f0f0] p-md-3 text-left">
                     <Row label="Loan Note ID" value={`#${success.loanNoteId}`} />
                     <Row label="You paid" value={usd(success.purchaseAmount)} />
                     <Row label="Expected repayment" value={usd(success.expectedRepayment)} />
                     <Row label="IOU points earned" value={`${success.iouPoints.toLocaleString()} pts`} />
                  </dl>
                  {success.txHash ? (
                     <a
                        href={txExplorerUrl(success.txHash)}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-md-b3 font-semibold text-md-primary-1200 underline underline-offset-2"
                     >
                        View transaction on Basescan ↗
                     </a>
                  ) : null}
                  {!success.synced ? (
                     <p className="rounded-[16px] bg-[rgba(255,237,161,0.35)] p-md-3 text-md-b3 text-[#8a6d00]">
                        Confirmed on-chain — you own the Loan Note. We’re syncing it to your dashboard; your funds and points are safe.
                     </p>
                  ) : null}
                  <button
                     type="button"
                     onClick={() => navigate('/lender/supported')}
                     className="flex w-full items-center justify-center gap-2 rounded-md-lg bg-md-primary-1200 py-md-3 text-md-b1 font-semibold text-md-neutral-100 transition-all duration-150 hover:brightness-110 active:scale-[0.98] active:brightness-90"
                  >
                     View My Funded Loans
                     <ChevronRight className="w-5 h-5" />
                  </button>
               </div>
            ) : (
               <>
                  <h2 className="text-md-h5 font-semibold text-md-heading">Fund {borrowerName}’s loan</h2>
                  <div className="mt-md-3 flex items-center gap-md-2">
                     <UserAvatar src={data.borrowerAvatarUrl ?? undefined} alt={borrowerName} size={48} />
                     <div>
                        <div className="text-md-b1 font-semibold text-md-heading">{borrowerName}</div>
                        {data.borrowerUsername ? <div className="text-md-b3 text-md-neutral-700">@{data.borrowerUsername}</div> : null}
                     </div>
                  </div>

                  {data.loanPurpose ? <p className="mt-md-2 text-md-b2 text-[#6d6d6d]">{data.loanPurpose}</p> : null}

                  <div className="mt-md-3 bg-white border border-[#f0f0f0] rounded-[12px] p-3 grid grid-cols-3 gap-2 text-center">
                     <div>
                        <p className="text-[12px] font-medium leading-[18px] tracking-[-0.24px] text-[#585858]">You pay</p>
                        <p className="mt-1 text-[20px] font-semibold leading-[1.2] tracking-[-0.04em] text-md-heading">{usd(data.listingPrice)}</p>
                     </div>
                     <div>
                        <p className="text-[12px] font-medium leading-[18px] tracking-[-0.24px] text-[#585858]">You receive</p>
                        <p className="mt-1 text-[20px] font-semibold leading-[1.2] tracking-[-0.04em] text-md-heading">{usd(data.expectedRepayment)}</p>
                     </div>
                     <div>
                        <p className="text-[12px] font-medium leading-[18px] tracking-[-0.24px] text-[#585858]">IOU points</p>
                        <p className="mt-1 text-[20px] font-semibold leading-[1.2] tracking-[-0.04em] text-md-heading">{data.iouPointsReward.toLocaleString()}</p>
                     </div>
                  </div>

                  <p className="mt-md-3 rounded-[16px] bg-md-primary-100/60 px-3 py-2.5 text-md-b3 font-medium text-md-neutral-1500">
                     If {borrowerName} repays, the repayment is automatically sent to your wallet — you don’t need to claim anything.
                  </p>

                  <button
                     type="button"
                     onClick={handleSupport}
                     disabled={busy || (!data.isSellable && !data.ownsLoanNote)}
                     className="mt-md-3 flex w-full items-center justify-center gap-2 rounded-md-lg bg-md-primary-1200 py-md-3 text-md-b1 font-semibold text-md-neutral-100 transition-all duration-150 hover:brightness-110 active:scale-[0.98] active:brightness-90 disabled:cursor-not-allowed disabled:opacity-50"
                  >
                     {step === 'checking'
                        ? 'Checking balance…'
                        : step === 'approving'
                          ? 'Approving USDC…'
                          : step === 'buying'
                            ? 'Confirming purchase…'
                            : step === 'recording'
                              ? 'Finalizing…'
                              : busy
                                ? 'Processing…'
                                : `Fund ${borrowerName}’s loan`}
                     {!busy ? <Send className="w-5 h-5" /> : null}
                  </button>
               </>
            )}
         </div>

         {showWalletChecklist && data ? (
            <LendChecklistModal
               title="Fund this loan"
               amountLabel={usd(data.listingPrice)}
               borrowerName={borrowerName}
               connected={Boolean(address)}
               connectedAddress={address}
               isProcessing={busy}
               onConnect={() => openConnectModal?.()}
               onConfirm={handleConfirmFromChecklist}
               onClose={() => setShowWalletChecklist(false)}
            />
         ) : null}
      </div>
   );
}

function Row({ label, value }: { label: string; value: string }) {
   return (
      <div className="flex items-center justify-between">
         <dt className="text-md-b2 text-[#585858]">{label}</dt>
         <dd className="text-md-b2 font-semibold text-md-heading">{value}</dd>
      </div>
   );
}
