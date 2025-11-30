'use client';

import { type ChangeEvent, type FormEvent, type RefObject } from 'react';

import WorldIDVerification from '@/components/worldId/WorldIDVerification';

import { type User } from '@/types/authTypes';

interface LoanRequestModalProps {
   clickOutsideRef: RefObject<HTMLDivElement>;
   isOpen: boolean;
   onClose: () => void;
   showVerify: boolean;
   user: User;
   loanAmount: string;
   setLoanAmount: (value: string) => void;
   totalRepaymentAmount: string;
   setTotalRepaymentAmount: (value: string) => void;
   reason: string;
   setReason: (value: string) => void;
   days: string;
   today: string;
   handleDays: (e: ChangeEvent<HTMLInputElement>) => void;
   handleSubmit: (e: FormEvent<HTMLFormElement>) => void;
   isSubmitting: boolean;
}

export default function LoanRequestModal({
   clickOutsideRef,
   isOpen,
   onClose,
   showVerify,
   user,
   loanAmount,
   setLoanAmount,
   totalRepaymentAmount,
   setTotalRepaymentAmount,
   reason,
   setReason,
   days,
   today,
   handleDays,
   handleSubmit,
   isSubmitting
}: LoanRequestModalProps) {
   if (!isOpen) return null;

   const isVerified = !showVerify;
   const modalWidth = isVerified ? '400px' : '320px';
   const limitAmount = isVerified ? user.cs : 15;

   return (
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50">
         <section
            ref={clickOutsideRef}
            className="bg-white rounded-2xl shadow-md max-w-md mx-auto flex flex-col relative"
            style={{ minWidth: modalWidth }}
         >
            <button onClick={onClose} className="absolute top-3 right-4 text-white hover:text-gray-800 z-10 text-2xl">
               ✖
            </button>
            <header className="bg-[#1E56FF] rounded-t-2xl px-6 py-4 flex items-center justify-center gap-2">
               <h2 className="text-white font-extrabold text-lg leading-6">Set Your Own Terms</h2>
               <button aria-label="Help info" className="text-white text-sm font-semibold focus:outline-none" type="button">
                  <i className="fas fa-question-circle"></i>
               </button>
            </header>

            {showVerify ? (
               <div className="bg-[#FFD7DD] text-[#D94A5B] text-sm font-semibold flex items-center justify-between px-4 py-2 rounded-t-none rounded-b-md select-none">
                  <div className="flex items-center gap-2">
                     <i className="fas fa-id-card"></i>
                     <span>Verification Required for Borrowers</span>
                  </div>
                  <WorldIDVerification>
                     {({ open }) => (
                        <button
                           onClick={open}
                           className="bg-[#FF5A6E] text-white text-xs font-extrabold rounded-md px-3 py-1 cursor-pointer"
                        >
                           Click Here
                        </button>
                     )}
                  </WorldIDVerification>
               </div>
            ) : null}

            <form onSubmit={handleSubmit} className="p-6 flex flex-col gap-5 text-gray-800 text-sm font-semibold">
               <div className="flex justify-between items-center">
                  <label className="text-gray-800 font-semibold text-sm" htmlFor="borrow-amount">
                     Borrow amount
                  </label>
                  <div className="flex items-center gap-1 bg-[#E6E9FF] text-[#1E56FF] text-xs font-semibold rounded-md px-2 py-1 select-none">
                     <button aria-label="Limit info" className="focus:outline-none" type="button">
                        <i className="fas fa-question-circle"></i>
                     </button>
                     <span>Limit: ${limitAmount?.toFixed(2) || '0.00'}</span>
                  </div>
               </div>
               <div className="flex border-solid border border-gray-300 rounded-md overflow-hidden">
                  <span aria-hidden="true" className="flex items-center justify-center bg-[#E6E9FF] text-[#1E56FF] px-4 text-base">
                     <i className="fas fa-dollar-sign"></i>
                     USD
                  </span>
                  <input
                     onChange={(e: ChangeEvent<HTMLInputElement>) => setLoanAmount(e.target.value)}
                     className="flex-1 px-4 py-2 text-gray-700 text-sm font-normal focus:outline-none"
                     id="borrow-amount"
                     placeholder="Set your desired amount"
                     type={isVerified ? 'number' : 'text'}
                     min={isVerified ? '0' : undefined}
                     value={loanAmount}
                  />
               </div>
               <label className="font-semibold text-gray-800 text-sm" htmlFor="repayment-amount">
                  Set Repayment amount
               </label>
               <input
                  onChange={(e: ChangeEvent<HTMLInputElement>) => setTotalRepaymentAmount(e.target.value)}
                  className="border border-gray-300 rounded-md px-4 py-2 text-gray-700 text-sm font-normal focus:outline-none"
                  id="repayment-amount"
                  placeholder="Must be more than Borrowed amount..."
                  type={isVerified ? 'number' : 'text'}
                  min={isVerified ? '0' : undefined}
                  value={totalRepaymentAmount}
               />
               <label className="font-semibold text-gray-800 text-sm">Repayment Date</label>
               <div className="flex gap-3">
                  <button className="bg-[#D6E1FF] text-[#1E56FF] font-semibold rounded-md px-5 py-2 text-sm select-none" type="button">
                     {isVerified ? `${days} Days` : '5 Days'}
                  </button>
                  {isVerified ? (
                     <input
                        onChange={handleDays}
                        placeholder="DD/MM/YY"
                        type="date"
                        min={today}
                        id="repaymentDate"
                        className="flex-1 border border-gray-300 rounded-md px-4 py-2 text-gray-700 text-sm font-normal focus:outline-none"
                     />
                  ) : (
                     <>
                        <input
                           className="flex-1 border border-gray-300 rounded-md px-4 py-2 text-gray-700 text-sm font-normal focus:outline-none"
                           placeholder="DD/MM/YY"
                           type="text"
                        />
                        <button
                           aria-label="Calendar"
                           className="flex items-center justify-center border border-gray-300 rounded-md px-3 text-gray-700"
                           type="button"
                        >
                           <i className="far fa-calendar-alt"></i>
                        </button>
                     </>
                  )}
               </div>
               <label className="font-semibold text-gray-800 text-sm" htmlFor="reason">
                  Reason for Borrowing
               </label>
               <textarea
                  maxLength={40}
                  onChange={(e: ChangeEvent<HTMLTextAreaElement>) => setReason(e.target.value)}
                  className="border border-gray-300 rounded-md px-4 py-2 text-gray-700 text-sm font-normal resize-none focus:outline-none"
                  id="reason"
                  placeholder="My car broke down I need help..."
                  rows={4}
                  value={reason}
               ></textarea>
               <div className="text-right text-xs text-gray-400 font-normal select-none">{reason.length} / 40</div>
               <button
                  className={`${isVerified && !isSubmitting ? 'bg-[#1E56FF]' : 'bg-gray-400 cursor-not-allowed'} text-white font-extrabold text-sm rounded-md py-3 mt-2 w-full`}
                  type="submit"
                  disabled={!isVerified || isSubmitting}
               >
                  {isSubmitting ? 'Submitting...' : 'Make Your Request'}
               </button>
            </form>
         </section>
      </div>
   );
}
