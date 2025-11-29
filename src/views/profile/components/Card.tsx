'use client';

import { useState } from 'react';

import { useRouter } from 'next/navigation';

import { useDispatch, useSelector } from 'react-redux';

import { Prisma } from '@/generated/prisma/client/client';

import { ConfirmationModal } from '@/components/ui/ConfirmationModal';
import Modal from '@/components/ui/Modal';
import UserPay from '@/components/UserPay';

import { calculateDaysRemaining, calculateDueDate, formatDate } from '@/utils/dateFormatters';
import { getLoanBadgeStyles } from '@/utils/loanStatusFormatters';

import { deleteLoan, getUserLoans } from '@/store/slices/loanSlice';
import type { AppDispatch, RootState } from '@/store/store';
import type { Loan } from '@/types/loanTypes';

export default function Card({ type, loan }: { type: boolean; loan: Loan }) {
   const username = useSelector((state: RootState) => state.auth.username);
   const [showDel, setShowDel] = useState(false);
   const [showPay, setShowPay] = useState(false);
   const dispatch = useDispatch<AppDispatch>();
   const router = useRouter();

   const differenceInDays = calculateDaysRemaining(loan.createdAt, loan.days);
   const dueDate = calculateDueDate(loan.createdAt, loan.days);
   const postedDate = formatDate(loan.createdAt);
   const badgeStyles = getLoanBadgeStyles(loan.loanStatus, loan.repaymentStatus, differenceInDays);

   const handleDelete = async () => {
      const id = loan.id;
      await dispatch(deleteLoan(id))
         .unwrap()
         .then(async () => {
            await dispatch(getUserLoans(username || ''));
         })
         .catch((error: Error) => {
            console.error('Error deleting loan:', error.message || error);
         });
   };

   return type && loan.loanStatus === 'Lent' ? (
      <div className="bg-white rounded-xl max-w-[320px] w-full h-full flex flex-col shadow-md">
         <div className="p-5 pb-3 flex justify-between items-start">
            <div>
               <h3 className="font-extrabold text-[15px] leading-[18px] text-[#0B1033]">{loan.reason}</h3>
               <p className="text-[13px] leading-[16px] text-[#6B7280] mt-2">
                  You Funded <span className="font-extrabold">${loan.loanAmount.toString()}</span> to{' '}
                  <em>
                     <a onClick={() => router.push('/user/' + loan.borrowerUser)} className="text-[#2563EB] underline">
                        {loan.borrowerUser}
                     </a>
                  </em>
               </p>
            </div>
         </div>
         <div className="bg-[#DBEAFE] text-[#2563EB] text-center text-[14px] leading-[18px] font-normal py-2 border-t border-b border-[#BFDBFE]">
            <i className="fas fa-info-circle mr-1"></i>
            Due on <strong>{dueDate}</strong> (
            {loan.repaymentStatus === 'Paid'
               ? 'Fully Repaid'
               : (differenceInDays > 0 ? differenceInDays : '0') + (differenceInDays > 1 ? ' Days Left' : ' Day Left')}
            )
         </div>
         <div className="p-5 pt-4">
            <p className="text-[13px] leading-[16px] font-normal text-[#6B7280] mb-1">Repayment Progress</p>
            <p className="text-[36px] font-extrabold text-[#2563EB] leading-[44px]">
               ${loan.totalRepaymentAmount.toString()}
               <span className="text-[#6B7280] font-normal text-[24px]">/${loan.repaidAmount.toString()}</span>
            </p>
            <p className="text-[12px] leading-[15px] font-semibold text-[#6B7280] mt-1">
               <span className="font-extrabold">${new Prisma.Decimal(loan.totalRepaymentAmount).minus(loan.repaidAmount).toString()}.00</span> Remaining for Complete Payback
            </p>
            <div className="w-full h-4 rounded-full bg-[#D9D9D9] mt-3 overflow-hidden">
               <div
                  className="h-4 rounded-l-full bg-[#15803D]"
                  style={{ width: `${new Prisma.Decimal(loan.totalRepaymentAmount).times(100).div(loan.repaidAmount).toNumber()}%` }}
               ></div>
            </div>
         </div>
         <button
            onClick={() => router.push('/user/' + loan.borrowerUser)}
            className="bg-[#2563EB] text-white font-extrabold text-[14px] leading-[18px] py-3 rounded-b-xl w-full flex items-center justify-center gap-2"
            type="button"
         >
            Borrow Insight
            <i className="fas fa-external-link-alt text-white text-sm"></i>
         </button>
      </div>
   ) : (
      <div className="bg-white rounded-xl max-w-[320px] w-full h-full flex flex-col shadow-md">
         <div className="p-5 pb-3 flex justify-between items-start">
            <div>
               <h3 className="font-extrabold text-[15px] leading-[18px] text-[#0B1033]">
                  Unexpected car repair,
                  <br />
                  waiting for reimbursement
               </h3>
               <p className="text-[12px] leading-[15px] text-[#6B7280] mt-1">posted on {postedDate}</p>
            </div>
         </div>
         <div
            className={`text-center text-[14px] leading-[18px] font-normal py-2 border-t border-b ${badgeStyles.bgClass} ${badgeStyles.textClass} ${badgeStyles.borderClass}`}
         >
            <i className="fas fa-exclamation-circle mr-1"></i>
            {loan.loanStatus === 'Requested'
               ? 'Waiting for Funding'
               : loan.repaymentStatus === 'Paid'
                 ? 'Fully Repaid'
                 : (differenceInDays > 0 ? differenceInDays : '0') + (differenceInDays > 1 ? ' Days Left' : ' Day Left')}
         </div>
         <div className="p-5 pt-4 border-b border-[#E5E7EB] grid grid-cols-3 text-center text-[13px] leading-[16px] font-normal text-[#6B7280]">
            <div>
               <p>Asking</p>
               <p className="mt-1 text-[18px] font-normal text-[#0B1033]">${loan.loanAmount.toString()}</p>
            </div>
            <div className="flex items-center justify-center space-x-1 text-[#6B7280]">
               <span>→</span>
            </div>
            <div>
               <p>Payback</p>
               <p className="mt-1 text-[16px] font-normal text-[#166534]">${loan.repaidAmount.toString()}</p>
            </div>
            <div></div>
            <div>
               <p>Due on</p>
               <p className="mt-1 text-[16px] font-normal text-[#B91C1C]">{dueDate}</p>
            </div>
            <div></div>
         </div>
         <button
            onClick={() =>
               loan.loanStatus === 'Requested'
                  ? setShowDel(true)
                  : loan.repaymentStatus !== 'Paid'
                    ? setShowPay(true)
                    : console.log('Fully Repaid')
            }
            className={`${loan.loanStatus === 'Requested' ? 'bg-red-600' : loan.repaymentStatus !== 'Paid' ? 'bg-blue-600' : 'bg-green-600'} text-white font-extrabold text-[14px] leading-[18px] py-3 rounded-b-xl w-full`}
            type="button"
         >
            {loan.loanStatus === 'Requested' ? 'Delete' : loan.repaymentStatus !== 'Paid' ? 'Repay' : 'Repaid'} Loan
         </button>
         <Modal isOpen={Boolean(showPay && loan.repaymentStatus !== 'Paid')} onClose={() => setShowPay(false)} showCloseButton>
            <UserPay loan={loan} />
         </Modal>
         <ConfirmationModal
            isOpen={showDel}
            onClose={() => setShowDel(false)}
            onConfirm={handleDelete}
            title="Delete Loan Request?"
            message="Are you sure you want to delete this loan request? This action cannot be undone."
            confirmText="Delete Request"
            cancelText="Cancel"
            confirmButtonClass="bg-red-500 text-white"
         />
      </div>
   );
}
