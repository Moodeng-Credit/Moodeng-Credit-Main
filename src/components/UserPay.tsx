'use client';

import { type ChangeEvent, type MouseEvent, useState } from 'react';

import Image from 'next/image';

import { useDispatch, useSelector } from 'react-redux';

import { useToast } from '@/components/ToastSystem/hooks/useToast';

import useWallet from '@/hooks/useWallet';

import { parseDateSafely } from '@/utils/dateFormatters';
import { toNumber } from '@/utils/decimalHelpers';

import { getUserLoans, updateLoanStatus } from '@/store/slices/loanSlice';
import type { AppDispatch, RootState } from '@/store/store';
import { ERROR_CODES } from '@/types/errorCodes';
import { getToastKeyFromErrorCode } from '@/types/errorToastMapping';
import type { Loan } from '@/types/loanTypes';

function UserPay({ loan }: { loan: Loan }) {
   const username = useSelector((state: RootState) => state.auth.username);
   const [repaidAmountToAdd, setRepaidAmountToAdd] = useState('');
   const [isProcessing, setIsProcessing] = useState(false);
   const time = parseDateSafely(loan.createdAt).toISOString();
   const { Transfer } = useWallet();
   const dispatch = useDispatch<AppDispatch>();
   const { showToastByConfig } = useToast();

   const handleBorrow = async (e: MouseEvent<HTMLButtonElement>) => {
      e.preventDefault();

      if (isProcessing) {
         return;
      }

      const newRepaidAmount = toNumber(loan.repaidAmount) + Number(repaidAmountToAdd);
      const totalOwed = toNumber(loan.totalRepaymentAmount);

      const newRepaymentStatus = newRepaidAmount >= totalOwed ? 'Paid' : 'Partial';

      if (
         loan.loanStatus === 'Lent' &&
         loan.repaymentStatus !== 'Paid' &&
         parseFloat(repaidAmountToAdd) > 0 &&
         newRepaidAmount <= totalOwed // Don't allow overpayment
      ) {
         setIsProcessing(true);
         const transactionHash = await Transfer(e, loan.lenderWallet || '', repaidAmountToAdd.toString(), loan.id, loan.block, loan.coin);

         if (transactionHash) {
            try {
               const loanData = {
                  id: loan.id,
                  repaidAmount: newRepaidAmount,
                  repaymentStatus: newRepaymentStatus,
                  hash: transactionHash
               };

               await dispatch(updateLoanStatus(loanData)).unwrap();
               await dispatch(getUserLoans(username || ''));
               showToastByConfig('repayment_success');
               setRepaidAmountToAdd('');
            } catch (updateError: unknown) {
               const errorMessage = updateError instanceof Error ? updateError.message : 'Unknown error';
               console.error('[CRITICAL] Transaction succeeded but database update failed:', errorMessage);
               console.error(
                  '[RECONCILIATION REQUIRED] Loan ID:',
                  loan.id,
                  '| Payment Amount:',
                  repaidAmountToAdd,
                  '| New Repaid Total:',
                  newRepaidAmount.toString(),
                  '| Status:',
                  newRepaymentStatus,
                  '| Hash:',
                  transactionHash
               );
               showToastByConfig(getToastKeyFromErrorCode(ERROR_CODES.TRANSACTION_FAILED));
            } finally {
               setIsProcessing(false);
            }
         } else {
            setIsProcessing(false);
         }
      } else {
         setIsProcessing(false);
      }
   };

   return (
      <main className="flex flex-col py-7 w-full bg-white rounded-3xl border border-solid border-neutral-200 shadow-[0px_2px_8px_rgba(0,0,0,0.25)] flex overflow-hidden flex-col py-5 bg-white rounded-2xl max-w-[473px]">
         <section className="flex flex-col px-5 w-full">
            <h1 className="self-start text-2xl font-medium leading-none text-black">Loan Repayment</h1>
            <div className="flex gap-10 items-center mt-8">
               <div className="flex flex-col self-stretch my-auto">
                  <div className="text-sm leading-loose text-black text-opacity-60">Total Due</div>
                  <div className="mt-1.5 text-base font-medium leading-loose text-black">${loan.totalRepaymentAmount.toString()}</div>
               </div>
               <div className="flex flex-col self-stretch my-auto">
                  <div className="text-sm leading-loose text-black text-opacity-60">Amount Paid</div>
                  <div className="mt-1.5 text-base font-medium leading-loose text-black">
                     ${loan.repaidAmount.toString()}
                     <span className="text-sm leading-6 text-black">
                        {' ($' + (toNumber(loan.totalRepaymentAmount) - toNumber(loan.repaidAmount)).toString() + ' Remaining)'}
                     </span>
                  </div>
               </div>
               <div className="flex flex-col self-stretch my-auto">
                  <div className="text-sm leading-loose text-black text-opacity-60">Due Date</div>
                  <div className="mt-1.5 text-base font-medium leading-loose text-black">{time.split('T')[0]}</div>
               </div>
            </div>
         </section>
         <hr className="mt-5 w-full border border-solid border-zinc-300 min-h-[1px]" />
         <section className="flex flex-col px-5 mt-5 w-full">
            <h2 className="self-start text-lg font-medium leading-loose text-black">Repayment Information</h2>
            <div className="flex overflow-hidden gap-10 p-4 mt-2.5 w-full whitespace-nowrap rounded-lg bg-neutral-100">
               <div className="flex flex-1 gap-4 items-center">
                  <div className="self-stretch my-auto text-sm leading-loose text-black text-opacity-60">Stablecoin</div>
                  <div className="flex gap-1.5 items-center self-stretch my-auto text-base font-medium leading-loose text-black">
                     <Image
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
                  <div className="self-stretch my-auto text-sm leading-loose text-black text-opacity-60">Network</div>
                  <Image
                     loading="lazy"
                     src="https://cdn.builder.io/api/v1/image/assets/e485b3dc4b924975b4554885e21242bb/4ba089761d655b916ff23874ab3595e64d2f358d02957d03b3aaa8c77195070b?apiKey=e485b3dc4b924975b4554885e21242bb"
                     alt=""
                     className="object-contain shrink-0 self-stretch my-auto w-6 aspect-square"
                     width={100}
                     height={100}
                  />
                  <div className="self-stretch my-auto text-base font-medium leading-loose text-black">{loan.block}</div>
               </div>
            </div>
            <label htmlFor="repayment" className="block text-sm font-medium text-gray-700">
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
               className="mt-1 p-2 w-full border rounded-md focus:border-gray-200 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-gray-300 transition-colors duration-300"
            />
            <button
               onClick={handleBorrow}
               disabled={isProcessing || !repaidAmountToAdd || parseFloat(repaidAmountToAdd) <= 0}
               className="overflow-hidden gap-5 self-stretch p-5 mt-8 text-base font-medium leading-none text-center text-white bg-blue-600 rounded-lg disabled:opacity-50 disabled:cursor-not-allowed"
            >
               {isProcessing ? 'Processing...' : 'Repay Now'}
            </button>
            <p className="mt-5 text-sm leading-6 text-black text-opacity-60">
               You can repay any amount at any time before the due date. Ensure full repayment by the due date to maintain your credit
               score.
            </p>
         </section>
      </main>
   );
}

export default UserPay;
