import { type ChangeEvent, type MouseEvent, useCallback, useState } from 'react';

import { useDispatch, useSelector } from 'react-redux';
import { useNavigate } from 'react-router-dom';
import { useAccount, useSwitchChain } from 'wagmi';

import { TOAST_TYPES } from '@/components/ToastSystem/types';
import { useToast } from '@/components/ToastSystem/hooks/useToast';

import useWallet, { type PaymentMethod } from '@/hooks/useWallet';

import { parseDateSafely } from '@/utils/dateFormatters';
import { formatNumber, toNumber } from '@/utils/decimalHelpers';

import { ALLOWED_CHAIN_DISPLAY_NAME } from '@/config/wagmiConfig';
import { ensureAllowedChain } from '@/lib/ensureAllowedChain';
import { areWalletAddressesEqual, getBaseWalletLockStatus } from '@/lib/walletProvider';
import { confirmLoanPayment, getUserLoans, PaymentNotConfirmedError } from '@/store/slices/loanSlice';
import type { AppDispatch, RootState } from '@/store/store';
import { ERROR_CODES } from '@/types/errorCodes';
import { getToastKeyFromErrorCode } from '@/types/errorToastMapping';
import type { Loan } from '@/types/loanTypes';

function UserPay({ loan }: { loan: Loan }) {
   const navigate = useNavigate();
   const user = useSelector((state: RootState) => state.auth.user);
   const userId = user.id;
   const [repaidAmountToAdd, setRepaidAmountToAdd] = useState('');
   const [isProcessing, setIsProcessing] = useState(false);
   const time = parseDateSafely(loan.createdAt).toISOString();
   const { payUsdc } = useWallet();
   const dispatch = useDispatch<AppDispatch>();
   const { showToast, showToastByConfig } = useToast();
   const account = useAccount();
   const { switchChainAsync } = useSwitchChain();
   const { isConnected } = account;
   const baseWalletLock = getBaseWalletLockStatus(user);

   const executeRepayment = useCallback(
      async (amount: string, method: PaymentMethod) => {
         if (isProcessing) {
            return;
         }

         // Only the wagmi path needs the chain guard up front; Base Pay switches to Base itself.
         if (method === 'wallet' && !(await ensureAllowedChain(account.chainId, switchChainAsync))) {
            showToastByConfig(getToastKeyFromErrorCode(ERROR_CODES.NETWORK_REQUIRED));
            return;
         }

         const newRepaidAmount = toNumber(loan.repaidAmount) + Number(amount);
         const totalOwed = toNumber(loan.totalRepaymentAmount);
         // Note: the final repaid amount / status is computed server-side in confirm-loan-payment
         // from the actual on-chain transfer; here we only gate against overpayment.

         if (
            loan.loanStatus === 'Lent' &&
            loan.repaymentStatus !== 'Paid' &&
            parseFloat(amount) > 0 &&
            newRepaidAmount <= totalOwed // Don't allow overpayment
         ) {
            setIsProcessing(true);
            const transferCoin = loan.coin?.trim() || 'USDC';
            // Recipient is always the lender's on-file funding wallet, chosen by us — the payer's
            // wallet choice never changes where the money lands.
            const outcome = await payUsdc({
               method,
               to: loan.lenderWallet || '',
               usdAmount: amount.toString(),
               loanId: loan.id,
               coin: transferCoin
            });

            if (outcome) {
               // Relaxed lock: record whoever actually paid and log a mismatch with the locked
               // Base wallet rather than blocking (Base Pay can't pre-guarantee the payer).
               const payer = outcome.payer?.trim() || account.address?.trim();
               if (payer && baseWalletLock.address && !areWalletAddressesEqual(payer, baseWalletLock.address)) {
                  console.warn('[repay] paid from a wallet other than the locked Base Account', {
                     loanId: loan.id,
                     payer,
                     lockedWallet: baseWalletLock.address
                  });
               }

               try {
                  // Server verifies the on-chain transfer before writing status.
                  await dispatch(
                     confirmLoanPayment({
                        loanId: loan.id,
                        hash: outcome.hash,
                        method,
                        action: 'repay'
                     })
                  ).unwrap();
                  await dispatch(getUserLoans({ userId }));
                  showToastByConfig('repayment_success');
                  setRepaidAmountToAdd('');
               } catch (updateError: unknown) {
                  if (updateError instanceof PaymentNotConfirmedError) {
                     // Sent but not yet confirmed on-chain — reconciler finishes it. Not a failure.
                     showToast(
                        TOAST_TYPES.INFO,
                        'Still confirming',
                        'Your payment was sent and is taking a moment to confirm. This will update automatically.'
                     );
                  } else {
                     const errorMessage = updateError instanceof Error ? updateError.message : 'Unknown error';
                     console.error('[CRITICAL] Transaction succeeded but database update failed:', errorMessage);
                     console.error(
                        '[RECONCILIATION REQUIRED] Loan ID:',
                        loan.id,
                        '| Payment Amount:',
                        amount,
                        '| Hash:',
                        outcome.hash
                     );
                     showToastByConfig(getToastKeyFromErrorCode(ERROR_CODES.TRANSACTION_FAILED));
                  }
               } finally {
                  setIsProcessing(false);
               }
            } else {
               setIsProcessing(false);
            }
         } else {
            setIsProcessing(false);
         }
      },
      [
         isProcessing,
         account.chainId,
         account.address,
         switchChainAsync,
         loan.repaidAmount,
         loan.totalRepaymentAmount,
         loan.loanStatus,
         loan.repaymentStatus,
         loan.coin,
         loan.lenderWallet,
         loan.id,
         baseWalletLock.address,
         payUsdc,
         dispatch,
         userId,
         showToast,
         showToastByConfig
      ]
   );

   const handleBorrow = async (e: MouseEvent<HTMLButtonElement>) => {
      e.preventDefault();

      // The borrower's locked Base wallet is their identity + receiving address; they must have
      // set one up. It's NOT enforced as the paying wallet — Base Pay reveals the payer only
      // after payment, so we relax the pre-check and record who actually paid. See
      // [[base-pay-migration]].
      if (!baseWalletLock.hasStoredWallet) {
         navigate('/onboarding/wallet', { state: { returnTo: 'repay' } });
         return;
      }

      // Already connected → pay from that wallet in one signature. Otherwise Base Pay: one popup
      // fusing Base Account sign-in and the USDC send, so repayment is one tap even cold.
      await executeRepayment(repaidAmountToAdd, isConnected ? 'wallet' : 'base');
   };

   return (
      <main className="flex flex-col py-7 w-full bg-white dark:bg-[#21162c] rounded-3xl border border-solid border-neutral-200 dark:border-[#2e203d] shadow-[0px_2px_8px_rgba(0,0,0,0.25)] overflow-hidden py-5 rounded-2xl max-w-[473px]">
         <section className="flex flex-col px-5 w-full">
            <h1 className="self-start text-2xl font-medium leading-none text-black dark:text-[#f0e9f8]">Loan Repayment</h1>
            <div className="flex gap-10 items-center mt-8">
               <div className="flex flex-col self-stretch my-auto">
                  <div className="text-sm leading-loose text-black text-opacity-60 dark:text-[#9d88b8]">Total Due</div>
                  <div className="mt-1.5 text-base font-medium leading-loose text-black dark:text-[#f0e9f8]">
                     ${formatNumber(loan.totalRepaymentAmount)}
                  </div>
               </div>
               <div className="flex flex-col self-stretch my-auto">
                  <div className="text-sm leading-loose text-black text-opacity-60 dark:text-[#9d88b8]">Amount Paid</div>
                  <div className="mt-1.5 text-base font-medium leading-loose text-black dark:text-[#f0e9f8]">
                     ${formatNumber(loan.repaidAmount)}
                     <span className="text-sm leading-6 text-black dark:text-[#9d88b8]">
                        {' ($' + formatNumber(toNumber(loan.totalRepaymentAmount) - toNumber(loan.repaidAmount)) + ' Remaining)'}
                     </span>
                  </div>
               </div>
               <div className="flex flex-col self-stretch my-auto">
                  <div className="text-sm leading-loose text-black text-opacity-60 dark:text-[#9d88b8]">Due Date</div>
                  <div className="mt-1.5 text-base font-medium leading-loose text-black dark:text-[#f0e9f8]">{time.split('T')[0]}</div>
               </div>
            </div>
         </section>
         <hr className="mt-5 w-full border border-solid border-zinc-300 dark:border-[#2e203d] min-h-[1px]" />
         <section className="flex flex-col px-5 mt-5 w-full">
            <h2 className="self-start text-lg font-medium leading-loose text-black dark:text-[#f0e9f8]">Repayment Information</h2>
            <div className="flex overflow-hidden gap-10 p-4 mt-2.5 w-full whitespace-nowrap rounded-lg bg-neutral-100 dark:bg-[#281b35]">
               <div className="flex flex-1 gap-4 items-center">
                  <div className="self-stretch my-auto text-sm leading-loose text-black text-opacity-60 dark:text-[#9d88b8]">
                     Stablecoin
                  </div>
                  <div className="flex gap-1.5 items-center self-stretch my-auto text-base font-medium leading-loose text-black dark:text-[#f0e9f8]">
                     <img
                        loading="lazy"
                        src="https://cdn.builder.io/api/v1/image/assets/e485b3dc4b924975b4554885e21242bb/36b2768ece14cc8c27f15df886baeb4d8561b26fdb09d2a7fd36f57790e94282?apiKey=e485b3dc4b924975b4554885e21242bb"
                        alt=""
                        className="object-contain shrink-0 self-stretch my-auto w-7 aspect-square"
                        width={100}
                        height={100}
                     />
                     <div className="self-stretch my-auto">{loan.coin}</div>
                  </div>
               </div>
               <div className="flex flex-1 gap-1.5 items-center self-start">
                  <div className="self-stretch my-auto text-sm leading-loose text-black text-opacity-60 dark:text-[#9d88b8]">Network</div>
                  <img
                     loading="lazy"
                     src="https://cdn.builder.io/api/v1/image/assets/e485b3dc4b924975b4554885e21242bb/4ba089761d655b916ff23874ab3595e64d2f358d02957d03b3aaa8c77195070b?apiKey=e485b3dc4b924975b4554885e21242bb"
                     alt=""
                     className="object-contain shrink-0 self-stretch my-auto w-6 aspect-square"
                     width={100}
                     height={100}
                  />
                  <div className="self-stretch my-auto text-base font-medium leading-loose text-black dark:text-[#f0e9f8]">
                     {ALLOWED_CHAIN_DISPLAY_NAME}
                  </div>
               </div>
            </div>
            <label htmlFor="repayment" className="block text-sm font-medium text-gray-700 dark:text-[#9d88b8]">
               Repayment Amount
            </label>
            <input
               type="number"
               min="0"
               id="repaidAmountToAdd"
               name="repaidAmountToAdd"
               placeholder="Enter custom amount"
               value={repaidAmountToAdd}
               onChange={(e: ChangeEvent<HTMLInputElement>) => setRepaidAmountToAdd(e.target.value)}
               className="mt-1 p-2 w-full border rounded-md focus:border-gray-200 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-gray-300 transition-colors duration-300 dark:bg-[#1e1535] dark:border-[#2e203d] dark:text-[#f0e9f8]"
            />
            <button
               onClick={handleBorrow}
               disabled={isProcessing || !repaidAmountToAdd || parseFloat(repaidAmountToAdd) <= 0}
               className="overflow-hidden gap-5 self-stretch p-5 mt-8 text-base font-medium leading-none text-center text-white bg-blue-600 rounded-lg disabled:opacity-50 disabled:cursor-not-allowed"
            >
               {isProcessing ? 'Processing...' : 'Repay Now'}
            </button>
            <p className="mt-5 text-sm leading-6 text-black text-opacity-60 dark:text-[#9d88b8]">
               You can repay any amount at any time before the due date. Ensure full repayment by the due date to maintain your credit
               score.
            </p>
         </section>
      </main>
   );
}

export default UserPay;
