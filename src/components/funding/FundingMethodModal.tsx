import { type ReactNode, useEffect, useMemo, useRef, useState } from 'react';

import { useConnectModal } from '@rainbow-me/rainbowkit';
import { Check, ChevronLeft, ExternalLink, Landmark, Send, Wallet, X } from 'lucide-react';
import { keccak256, stringToHex } from 'viem';
import { useAccount } from 'wagmi';

import { PaymentProgressOverlay } from '@/components/loading/PaymentProgressRing';
import { VAULT_LENS_MIN_MS, VaultLensLoader } from '@/components/loading/VaultLensLoader';
import { TOAST_TYPES } from '@/components/ToastSystem/config/toastConfig';
import { useToast } from '@/components/ToastSystem/hooks/useToast';

import { txExplorerUrl } from '@/config/loanFundingConfig';
import { type PaymentStage, holdAtFull, useStagedProgress } from '@/hooks/useStagedProgress';
import { ensureUsdcAllowance, getLoanManagerService } from '@/lib/web3/loanManager';
import { recordAdminFunding, usdcToBaseUnits } from '@/lib/loanNotes/api';
import IdBoardFund from '@/views/dashboard/components/IdBoardFund';
import { BITREPO_VAULT_URL, type VaultStatus, drawFromVault, readVaultStatus, vaultBorrowerId } from '@/lib/web3/bitrepoVault';

export interface FundLoanTarget {
   loanId: string; // loans.id (UUID)
   borrowerUserId?: string | null;
   borrowerWallet: string | null;
   borrowerName: string;
   principal: number; // USDC
   totalOwed: number; // USDC
   dueDate: string; // ISO
   /** 'ID' = Indonesia track: paid to the borrower's Walt on BNB Chain, never to a Base wallet. */
   market?: 'ID' | null;
}

type Method = 'choose' | 'smart' | 'vault';

interface Props {
   target: FundLoanTarget;
   onClose: () => void;
   /** Runs the existing normal lender flow (wallet-to-wallet to the borrower). */
   onDirectLend: () => void;
   /** Called after a smart-contract (relay) funding is recorded. */
   onFunded?: () => void;
}

const fieldClass =
   'min-h-[48px] w-full rounded-[14px] border border-[#d8d0e2] bg-white px-3 py-2 text-md-b2 text-md-heading focus:border-md-primary-900 focus:outline-none focus:ring-2 focus:ring-md-primary-100';
const primaryButton =
   'flex w-full items-center justify-center gap-2 rounded-md-lg bg-md-primary-1200 py-md-3 text-md-b1 font-semibold text-md-neutral-100 transition-all duration-150 hover:brightness-110 active:scale-[0.98] active:brightness-90 disabled:cursor-not-allowed disabled:opacity-50';
const backButton =
   'flex w-full items-center justify-center gap-1 rounded-md-lg border border-[#e6e1ec] py-md-3 text-md-b2 font-semibold text-md-neutral-1500 transition hover:bg-[#faf8fc] disabled:opacity-50';

// Connecting a wallet can remount the request board (and drop this modal). Remember which loan's
// modal was open, and on which tab, so the card can reopen it right where the admin left off.
const FUND_RESUME_KEY = 'moodeng:fund-modal-resume';
const FUND_RESUME_TTL_MS = 5 * 60 * 1000;

export function readFundResume(loanId: string): Method | null {
   try {
      const raw = window.sessionStorage.getItem(FUND_RESUME_KEY);
      if (!raw) return null;
      const saved = JSON.parse(raw) as { loanId?: string; method?: Method; at?: number };
      if (saved.loanId !== loanId || !saved.method || Date.now() - (saved.at ?? 0) > FUND_RESUME_TTL_MS) return null;
      return saved.method;
   } catch {
      return null;
   }
}

function saveFundResume(loanId: string, method: Method) {
   try {
      window.sessionStorage.setItem(FUND_RESUME_KEY, JSON.stringify({ loanId, method, at: Date.now() }));
   } catch {
      /* storage blocked: the modal just won't reopen on its own */
   }
}

export function clearFundResume() {
   try {
      window.sessionStorage.removeItem(FUND_RESUME_KEY);
   } catch {
      /* ignore */
   }
}

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

   const [method, setMethod] = useState<Method>(() => readFundResume(target.loanId) ?? 'choose');
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

   // BitRepo vault: what it can lend right now, and whether the connected wallet may draw (OPERATOR_ROLE).
   const [vault, setVault] = useState<VaultStatus | null>(null);
   // The wallet the current `vault` status was read for. Right after connecting, `vault` still holds
   // the read made with no wallet (canDraw=false); until the re-read lands we're "checking", not "can't draw".
   const [vaultFor, setVaultFor] = useState<string | null | undefined>(undefined);
   const [vaultError, setVaultError] = useState<string | null>(null);
   useEffect(() => {
      if (method !== 'vault') return;
      let cancelled = false;
      setVaultError(null);
      readVaultStatus(address)
         .then((status) => {
            if (cancelled) return;
            setVault(status);
            setVaultFor(address ?? null);
         })
         .catch(() => {
            if (!cancelled) setVaultError('Couldn’t read the BitRepo vault. Check your connection and try again.');
         });
      return () => {
         cancelled = true;
      };
   }, [method, address]);

   const vaultChecking = method === 'vault' && !vaultError && vaultFor !== (address ?? null);
   const vaultAvailable = vault ? Number(vault.availableToDraw) / 1e6 : null;
   const vaultIssue = (() => {
      if (!vault || vaultChecking) return null;
      if (vault.paused) return 'BitRepo has paused draws on the vault.';
      if (Number(principal) > (vaultAvailable ?? 0)) return `The vault can lend ${vaultAvailable?.toFixed(2)} USDC right now.`;
      const dueTs = dueDate ? Math.floor(new Date(`${dueDate}T23:59:59`).getTime() / 1000) : 0;
      const maxDays = Math.floor(vault.termLimitSeconds / 86400);
      if (dueTs > Math.floor(Date.now() / 1000) + vault.termLimitSeconds) return `The vault allows due dates up to ${maxDays} days away.`;
      if (connected && !vault.canDraw) return `This wallet (${shortAddress(address)}) can’t draw from the vault. Connect Moodeng’s lending wallet.`;
      return null;
   })();
   const vaultReady = termsValid && Boolean(vault) && !vaultChecking && !vaultIssue;

   // Magnifier loader while the vault check runs, kept up long enough to play every scene (and end
   // on the lone pandesal) even when the check is instant. The draw itself uses the hippo runner.
   const [checkRingVisible, setCheckRingVisible] = useState(false);
   const checkStartedAt = useRef(0);
   useEffect(() => {
      if (vaultChecking) {
         checkStartedAt.current = performance.now();
         setCheckRingVisible(true);
         return undefined;
      }
      const elapsed = performance.now() - checkStartedAt.current;
      const timer = window.setTimeout(() => setCheckRingVisible(false), Math.max(900, VAULT_LENS_MIN_MS - elapsed));
      return () => window.clearTimeout(timer);
   }, [vaultChecking]);
   const [drawStage, setDrawStage] = useState<PaymentStage | null>(null);
   const ringStage: PaymentStage | null = drawStage ?? (vaultChecking ? 'sent' : checkRingVisible ? 'done' : null);
   const ringPercent = useStagedProgress(ringStage);

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

   const handleVaultDraw = async () => {
      if (!connected || !vaultReady || !target.borrowerWallet) return;
      const principalNum = Number(principal);
      const totalOwedNum = Number(totalOwed);
      const dueTs = Math.floor(new Date(`${dueDate}T23:59:59`).getTime() / 1000);

      setBusy(true);
      setNotice(null);
      setDrawStage('signing');
      let txHash: `0x${string}`;
      try {
         txHash = await drawFromVault({
            loanId: target.loanId,
            recipient: target.borrowerWallet,
            amount: usdcToBaseUnits(principalNum),
            dueDate: dueTs,
            totalDue: usdcToBaseUnits(totalOwedNum),
            borrowerId: vaultBorrowerId(target.borrowerUserId || target.loanId),
            onSubmitted: () => setDrawStage('sent')
         });
      } catch (err) {
         // Nothing left the vault: the draw reverted, or the wallet popup was closed.
         setDrawStage(null);
         setNotice({ tone: 'error', message: (err as Error).message || 'The vault draw didn’t go through. Nothing was sent — try again.' });
         setBusy(false);
         return;
      }

      const recordPayload = {
         loanId: target.loanId,
         fundingMethod: 'credit_line' as const,
         txHash,
         borrowerWallet: target.borrowerWallet,
         funderWallet: address as string,
         principal: principalNum,
         totalOwed: totalOwedNum,
         dueDate: `${dueDate}T23:59:59.000Z`
      };
      setDrawStage('recording');
      try {
         await recordAdminFunding(recordPayload).catch(() => recordAdminFunding(recordPayload));
      } catch {
         setDrawStage(null);
         // The borrower has the money; only our record is missing. Keep the tx visible so it can be re-recorded.
         setNotice({
            tone: 'pending',
            message: (
               <>
                  Sent from the vault — saving it to our records didn’t complete. Tap Draw again only after checking the{' '}
                  <a href={txExplorerUrl(txHash)} target="_blank" rel="noreferrer" className="font-medium underline">
                     transaction
                  </a>
                  ; a second draw for this loan is refused by the vault.
               </>
            )
         });
         onFunded?.();
         setBusy(false);
         return;
      }

      setDrawStage('done');
      await holdAtFull();
      showToast(TOAST_TYPES.SUCCESS, 'Loan funded', `${principalNum} USDC sent from the BitRepo vault.`);
      onFunded?.();
      onClose();
      setBusy(false);
   };

   const upside = Math.max(0, (Number(totalOwed) || 0) - (Number(salePrice) || 0));

   const backToChoose = () => {
      setMethod('choose');
      setNotice(null);
   };

   const isIndo = target.market === 'ID';
   const title = isIndo || method === 'vault' ? 'Vault Lend' : method === 'smart' ? 'Smart Contract Lend' : 'How do you want to fund this?';

   const ringTitle = drawStage
      ? drawStage === 'signing'
         ? 'Confirm in your wallet'
         : drawStage === 'sent'
           ? `Sending ${Number(principal) || 0} USDC`
           : drawStage === 'recording'
             ? 'Saving the loan'
             : 'Sent!'
      : ringPercent >= 100
        ? 'Vault ready'
        : 'Checking the vault';
   const ringHint = drawStage
      ? drawStage === 'signing'
         ? 'Approve the draw in your wallet app.'
         : drawStage === 'done'
           ? undefined
           : 'This takes a few seconds — keep this open.'
      : connected
        ? `Making sure ${shortAddress(address)} can draw.`
        : 'Reading what the vault can lend.';

   const noticeBox = notice ? (
      <p
         className={`rounded-[16px] px-md-3 py-2.5 text-md-b3 ${
            notice.tone === 'error' ? 'bg-[#fff1f1] text-[#b42318]' : 'bg-[rgba(255,237,161,0.35)] text-[#8a6d00]'
         }`}
      >
         {notice.message}
      </p>
   ) : null;

   const warningBox = (message: string | null) =>
      message ? <p className="rounded-[16px] bg-[rgba(255,237,161,0.35)] px-md-3 py-2.5 text-md-b3 text-[#8a6d00]">{message}</p> : null;

   const connectStep = (stepTitle: string) => (
      <ChecklistStep number={1} state={connected ? 'done' : 'active'} title={connected ? 'Wallet connected' : stepTitle}>
         {connected ? (
            <span className="mt-1 inline-flex items-center gap-1.5 rounded-md-pill bg-md-green-100 px-3 py-1 text-md-b3 font-semibold text-md-green-800">
               <Wallet className="h-3.5 w-3.5" aria-hidden="true" /> {shortAddress(address)} connected
            </span>
         ) : (
            <button
               type="button"
               onClick={() => {
                  saveFundResume(target.loanId, method);
                  openConnectModal?.();
               }}
               className="mt-2 inline-flex h-11 items-center justify-center gap-1.5 rounded-md-pill bg-md-primary-1200 px-md-4 text-md-b2 font-semibold text-md-neutral-100 transition active:scale-[0.98]"
            >
               <Wallet className="h-4 w-4" aria-hidden="true" /> Connect wallet
            </button>
         )}
      </ChecklistStep>
   );

   return (
      <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/50 p-4" role="dialog" aria-modal="true" onClick={close}>
         <div
            className="relative max-h-[92vh] w-full max-w-md overflow-y-auto rounded-[24px] border border-[#f0f0f0] bg-white p-md-4 shadow-[0px_11px_24px_0px_rgba(0,0,0,0.02)]"
            onClick={(e) => e.stopPropagation()}
         >
            {method === 'vault' && drawStage ? <PaymentProgressOverlay percent={ringPercent} title={ringTitle} hint={ringHint} /> : null}
            {method === 'vault' && !drawStage && ringStage ? <VaultLensLoader percent={ringPercent} title={ringTitle} hint={ringHint} /> : null}

            <div className="mb-md-3 flex items-center gap-2">
               {method !== 'choose' ? (
                  <button
                     type="button"
                     onClick={backToChoose}
                     disabled={busy}
                     className="-ml-1 rounded-full p-1 text-md-neutral-1000 hover:bg-[#f5f2f8] hover:text-md-neutral-1700 disabled:opacity-50"
                     aria-label="Back"
                  >
                     <ChevronLeft className="h-5 w-5" aria-hidden="true" />
                  </button>
               ) : null}
               <h2 className="flex-1 text-md-h5 font-semibold text-md-heading">{title}</h2>
               <button type="button" onClick={close} disabled={busy} className="text-md-neutral-1000 hover:text-md-neutral-1700" aria-label="Close">
                  <X className="h-5 w-5" aria-hidden="true" />
               </button>
            </div>

            {/* Read-only loan summary */}
            <div className="mb-md-3 rounded-[16px] border border-[#f0f0f0] p-md-3">
               <div className="flex items-center justify-between">
                  <span className="text-md-b2 text-[#585858]">Borrower</span>
                  <span className="text-md-b1 font-semibold text-md-heading">{target.borrowerName}</span>
               </div>
               <div className="mt-md-2 grid grid-cols-3 gap-2 text-center">
                  <SummaryStat label="Principal" value={`${target.principal} USDC`} />
                  <SummaryStat label="Total owed" value={`${target.totalOwed} USDC`} />
                  <SummaryStat label="Due" value={target.dueDate ? target.dueDate.slice(0, 10) : '—'} />
               </div>
            </div>

            {/* Indonesia: the vault's USDC is bridged to BNB Chain and sent to the borrower's Walt. */}
            {isIndo ? (
               <div className="space-y-md-2">
                  <p className="text-md-b3 text-md-neutral-1500">
                     The vault’s USDC goes from Base to BNB Chain and lands in the borrower’s Walt as the exact loan amount. They repay us in Walt as usual.
                  </p>
                  <IdBoardFund
                     loanId={target.loanId}
                     amount={target.principal}
                     onFunded={() => {
                        onFunded?.();
                        onClose();
                     }}
                  />
               </div>
            ) : null}

            {method === 'choose' && !isIndo ? (
               <div className="space-y-md-2">
                  {/* BitRepo vault — recommended: the money comes straight from the vault, not our wallet */}
                  <button
                     type="button"
                     onClick={() => setMethod('vault')}
                     className="block w-full rounded-md-lg border-2 border-md-primary-1200 bg-md-primary-100 p-4 text-left transition-all duration-150 active:scale-[0.99]"
                  >
                     <div className="flex items-center gap-2">
                        <Landmark className="h-5 w-5 text-md-primary-1200" aria-hidden="true" />
                        <span className="text-md-b1 font-semibold text-md-heading">Vault Lend</span>
                        <span className="rounded-md-pill bg-md-primary-1200 px-2 py-0.5 text-[11px] font-semibold text-md-neutral-100">Recommended</span>
                     </div>
                     <p className="mt-1 text-md-b3 text-md-neutral-1500">
                        BitRepo’s vault sends USDC straight to the borrower — not from your wallet. Borrowers repay us as usual; then pay the vault from Admin →
                        Credit line.
                     </p>
                  </button>

                  <button
                     type="button"
                     onClick={() => setMethod('smart')}
                     className="block w-full rounded-md-lg border border-[#f0f0f0] p-4 text-left transition-all duration-150 hover:bg-[#faf8fc] active:scale-[0.99]"
                  >
                     <span className="text-md-b1 font-semibold text-md-heading">Smart Contract Lend</span>
                     <p className="mt-1 text-md-b3 text-md-neutral-1200">
                        Fund through the LoanManager contract. Creates a Loan Note so Moodeng can recover liquidity later when a moo-lender funds this loan.
                     </p>
                  </button>

                  <button
                     type="button"
                     onClick={handleDirectLend}
                     className="block w-full rounded-md-lg border border-[#f0f0f0] p-4 text-left transition-all duration-150 hover:bg-[#faf8fc] active:scale-[0.99]"
                  >
                     <span className="text-md-b1 font-semibold text-md-heading">Direct Lend</span>
                     <p className="mt-1 text-md-b3 text-md-neutral-1200">Send USDC directly to the borrower. No Loan Note is created.</p>
                     <p className="mt-1 text-md-b3 text-[#8a6d00]">Not sellable later through the Liquidity Relay.</p>
                  </button>
               </div>
            ) : null}

            {method === 'vault' ? (
               <div className="space-y-md-3">
                  <div className="grid grid-cols-2 gap-3">
                     <Field label="Principal (USDC)" error={errors.principal}>
                        <input type="number" min="0" value={principal} onChange={(e) => setPrincipal(e.target.value)} className={fieldClass} />
                     </Field>
                     <Field label="Total owed (USDC)" error={errors.totalOwed}>
                        <input type="number" min="0" value={totalOwed} onChange={(e) => setTotalOwed(e.target.value)} className={fieldClass} />
                     </Field>
                     <Field label="Due date" error={errors.dueDate} wide>
                        <input type="date" value={dueDate} onChange={(e) => setDueDate(e.target.value)} className={fieldClass} />
                     </Field>
                  </div>

                  {warningBox(errors.missingWallet)}

                  <div className="rounded-[16px] bg-md-primary-100/60 px-md-3 py-2.5">
                     <div className="flex items-center justify-between">
                        <span className="text-md-b3 font-medium text-md-neutral-1500">Available in the vault</span>
                        <span className="text-md-b1 font-semibold text-md-heading tabular-nums">
                           {vaultAvailable == null ? (vaultError ? '—' : '…') : `${vaultAvailable.toFixed(2)} USDC`}
                        </span>
                     </div>
                     <p className="mt-1 text-md-b3 text-md-neutral-1200">
                        {target.borrowerWallet ? `Sends to ${shortAddress(target.borrowerWallet)}. ` : ''}
                        The vault charges 15%/yr on what’s out; the rest of the total owed is our margin.{' '}
                        <a
                           href={BITREPO_VAULT_URL}
                           target="_blank"
                           rel="noreferrer"
                           className="inline-flex items-center gap-0.5 font-semibold text-md-primary-1200 underline underline-offset-2"
                        >
                           Open vault <ExternalLink className="h-3 w-3" aria-hidden="true" />
                        </a>
                     </p>
                  </div>

                  {warningBox(vaultError || vaultIssue)}

                  <div>
                     {connectStep('Connect Moodeng’s lending wallet')}
                     <div className={`ml-[15px] h-4 w-0.5 ${connected ? 'bg-md-green-600' : 'bg-[#e6e1ec]'}`} aria-hidden="true" />
                     <ChecklistStep number={2} state={connected ? 'active' : 'locked'} title="Draw from the vault" highlight={connected}>
                        {connected ? (
                           <div className="mt-2 space-y-2">
                              <p className="text-md-b3 text-md-neutral-1200">Next step: send the loan to the borrower.</p>
                              <button
                                 type="button"
                                 onClick={handleVaultDraw}
                                 disabled={busy || !vaultReady}
                                 className={`${primaryButton} ${vaultReady && !busy ? 'shadow-[0_0_0_4px_rgba(103,30,226,0.18)]' : ''}`}
                              >
                                 {busy ? 'Sending…' : vaultChecking ? 'Checking the vault…' : `Send ${Number(principal) || 0} USDC to borrower`}
                                 {!busy && !vaultChecking ? <Send className="h-5 w-5" aria-hidden="true" /> : null}
                              </button>
                           </div>
                        ) : (
                           <p className="text-md-b3 text-md-neutral-1000">Unlocks once your wallet is connected</p>
                        )}
                     </ChecklistStep>
                  </div>

                  {noticeBox}
                  <button type="button" onClick={backToChoose} disabled={busy} className={backButton}>
                     <ChevronLeft className="h-4 w-4" aria-hidden="true" /> Back
                  </button>
               </div>
            ) : null}

            {method === 'smart' ? (
               <div className="space-y-md-3">
                  <div className="grid grid-cols-2 gap-3">
                     <Field label="Principal (USDC)" error={errors.principal}>
                        <input type="number" min="0" value={principal} onChange={(e) => setPrincipal(e.target.value)} className={fieldClass} />
                     </Field>
                     <Field label="Total owed (USDC)" error={errors.totalOwed}>
                        <input type="number" min="0" value={totalOwed} onChange={(e) => setTotalOwed(e.target.value)} className={fieldClass} />
                     </Field>
                     <Field label="Sale price (USDC)" error={errors.salePrice}>
                        <input type="number" min="0" value={salePrice} onChange={(e) => setSalePrice(e.target.value)} className={fieldClass} />
                     </Field>
                     <Field label="Due date" error={errors.dueDate}>
                        <input type="date" value={dueDate} onChange={(e) => setDueDate(e.target.value)} className={fieldClass} />
                     </Field>
                  </div>

                  {warningBox(errors.missingWallet)}

                  <div className="rounded-[16px] bg-md-primary-100/60 px-md-3 py-2.5 text-md-b3 text-md-neutral-1200">
                     <p>
                        A Loan Note (NFT) is minted to Moodeng and listed at the <strong>sale price (defaults to principal)</strong> so a moo-lender can later
                        refill this capital by buying the repayment rights.
                     </p>
                     <p className="mt-1">
                        Future moo-lender upside: <strong className="text-md-heading">{upside.toLocaleString()} USDC</strong> (total owed − sale price)
                     </p>
                  </div>

                  {/* Two-step checklist: Connect → Fund. Each step lights green when complete. */}
                  <div>
                     {connectStep('Connect your wallet')}
                     <div className={`ml-[15px] h-4 w-0.5 ${connected ? 'bg-md-green-600' : 'bg-[#e6e1ec]'}`} aria-hidden="true" />
                     <ChecklistStep number={2} state={connected ? 'active' : 'locked'} title="Fund the loan">
                        {connected ? null : <p className="text-md-b3 text-md-neutral-1000">Unlocks once your wallet is connected</p>}
                     </ChecklistStep>
                  </div>

                  {noticeBox}

                  <button type="button" onClick={handleFund} disabled={!connected || busy || !termsValid} className={primaryButton}>
                     {busy ? 'Processing…' : 'Fund loan'}
                  </button>
                  <button type="button" onClick={backToChoose} disabled={busy} className={backButton}>
                     <ChevronLeft className="h-4 w-4" aria-hidden="true" /> Back
                  </button>
               </div>
            ) : null}
         </div>
      </div>
   );
}

function SummaryStat({ label, value }: { label: string; value: string }) {
   return (
      <div className="rounded-[12px] bg-[#faf8fc] px-1 py-2">
         <p className="text-[12px] font-medium leading-[18px] tracking-[-0.24px] text-[#585858]">{label}</p>
         <p className="mt-0.5 text-md-b2 font-semibold text-md-heading tabular-nums">{value}</p>
      </div>
   );
}

function Field({ label, error, wide, children }: { label: string; error: string | null; wide?: boolean; children: ReactNode }) {
   return (
      <label className={`block ${wide ? 'col-span-2' : ''}`}>
         <span className="mb-1 block text-md-b3 font-medium text-[#585858]">{label}</span>
         {children}
         {error ? <span className="mt-1 block text-md-b3 text-[#b42318]">{error}</span> : null}
      </label>
   );
}

function ChecklistStep({
   number,
   state,
   title,
   highlight,
   children
}: {
   number: number;
   state: 'done' | 'active' | 'locked';
   title: string;
   /** The step to do now: outlined card so it stands out from the done/locked ones. */
   highlight?: boolean;
   children: ReactNode;
}) {
   const badgeClass =
      state === 'done'
         ? 'bg-md-green-100 text-md-green-800'
         : state === 'active'
           ? 'border border-md-primary-1200/30 bg-md-primary-100 text-md-primary-1200'
           : 'border border-[#e6e1ec] bg-[#faf8fc] text-md-neutral-1000';

   return (
      <div
         className={`flex gap-3 ${state === 'locked' ? 'py-1 opacity-50' : highlight ? '-mx-2 rounded-[16px] border border-md-primary-1200/40 bg-md-primary-100/50 p-2' : 'py-1'}`}
      >
         <span className={`flex h-8 w-8 flex-none items-center justify-center rounded-full text-md-b3 font-semibold ${badgeClass}`}>
            {state === 'done' ? <Check className="h-4 w-4" aria-hidden="true" /> : number}
         </span>
         <div className="flex-1">
            <p className="mt-1 text-md-b2 font-semibold text-md-heading">{title}</p>
            {children}
         </div>
      </div>
   );
}
