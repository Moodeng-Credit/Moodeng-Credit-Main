import { type FormEvent, useCallback, useEffect, useRef, useState } from 'react';

import WorldIDVerification from '@/components/worldId/WorldIDVerification';
import { getEffectiveCreditLimit } from '@/lib/creditLeveling';
import { useApiMutation } from '@/lib/api/hooks';
import { API_ENDPOINTS } from '@/config/apiEndpoints';
import { type User } from '@/types/authTypes';
import { createLoanSchema } from '@/lib/schemas/loans';

interface RequestLoanModalProps {
   isOpen: boolean;
   onClose: () => void;
   user: User | null;
}

export default function RequestLoanModal({ isOpen, onClose, user }: RequestLoanModalProps) {
   const [borrowAmount, setBorrowAmount] = useState('');
   const [repaymentAmount, setRepaymentAmount] = useState('');
   const [repaymentDate, setRepaymentDate] = useState('');
   const [reason, setReason] = useState('');
   const [validationErrors, setValidationErrors] = useState<Record<string, string>>({});

   const modalRef = useRef<HTMLDivElement>(null);
   const borrowAmountInputRef = useRef<HTMLInputElement>(null);

   const createLoanMutation = useApiMutation(API_ENDPOINTS.LOANS.CREATE);

   const isVerified = user?.wld || false;
   const creditLimit = getEffectiveCreditLimit(user?.cs, isVerified);

   // Focus management - move focus to borrow amount input when modal opens
   useEffect(() => {
      if (isOpen && borrowAmountInputRef.current) {
         borrowAmountInputRef.current.focus();
      }
   }, [isOpen]);

   // Get minimum date (24 hours from now)
   const getMinimumDate = () => {
      const tomorrow = new Date();
      tomorrow.setDate(tomorrow.getDate() + 1);
      return tomorrow.toISOString().split('T')[0];
   };

   const calculateDays = () => {
      if (!repaymentDate) return 0;
      const today = new Date();
      const repayDate = new Date(repaymentDate);
      const diffTime = Math.abs(repayDate.getTime() - today.getTime());
      const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
      return diffDays;
   };

   const validateForm = () => {
      const errors: Record<string, string> = {};

      // Validate borrow amount
      const borrowAmountNum = parseFloat(borrowAmount);
      if (!borrowAmount || isNaN(borrowAmountNum)) {
         errors.borrowAmount = 'Borrow amount is required and must be a number';
      } else if (borrowAmountNum <= 0) {
         errors.borrowAmount = 'Borrow amount must be greater than 0';
      } else if (borrowAmountNum > creditLimit) {
         errors.borrowAmount = `Borrow amount cannot exceed your limit of $${creditLimit}`;
      }

      // Validate repayment amount
      const repaymentAmountNum = parseFloat(repaymentAmount);
      if (!repaymentAmount || isNaN(repaymentAmountNum)) {
         errors.repaymentAmount = 'Repayment amount is required and must be a number';
      } else if (repaymentAmountNum <= borrowAmountNum) {
         errors.repaymentAmount = 'Repayment amount must be greater than borrow amount';
      }

      // Validate repayment date
      if (!repaymentDate) {
         errors.repaymentDate = 'Repayment date is required';
      } else {
         const selectedDate = new Date(repaymentDate);
         const minDate = new Date();
         minDate.setDate(minDate.getDate() + 1);
         minDate.setHours(0, 0, 0, 0);
         selectedDate.setHours(0, 0, 0, 0);
         
         if (selectedDate < minDate) {
            errors.repaymentDate = 'Repayment date must be at least 24 hours from now';
         }
      }

      // Validate reason
      if (!reason.trim()) {
         errors.reason = 'Reason for borrowing is required';
      } else if (reason.length > 40) {
         errors.reason = 'Reason cannot exceed 40 characters';
      }

      setValidationErrors(errors);
      return Object.keys(errors).length === 0;
   };

   const handleSubmit = async (e: FormEvent<HTMLFormElement>) => {
      e.preventDefault();

      if (!isVerified) {
         return;
      }

      if (!validateForm()) {
         return;
      }

      const days = calculateDays();

      try {
         // Validate with Zod schema
         const loanData = createLoanSchema.parse({
            borrowerUserId: user?.id,
            loanAmount: parseFloat(borrowAmount),
            totalRepaymentAmount: parseFloat(repaymentAmount),
            reason: reason.trim(),
            days: days,
            coin: 'USDC'
         });

         await createLoanMutation.mutateAsync(loanData);

         // Reset form and close modal on success
         setBorrowAmount('');
         setRepaymentAmount('');
         setRepaymentDate('');
         setReason('');
         setValidationErrors({});
         onClose();
      } catch (error) {
         console.error('Loan request failed:', error);
      }
   };

   const handleClose = useCallback(() => {
      // Reset form when closing
      setBorrowAmount('');
      setRepaymentAmount('');
      setRepaymentDate('');
      setReason('');
      setValidationErrors({});
      onClose();
   }, [onClose]);

   // Click outside to close
   useEffect(() => {
      const handleClickOutside = (event: MouseEvent) => {
         if (modalRef.current && !modalRef.current.contains(event.target as Node)) {
            handleClose();
         }
      };

      if (isOpen) {
         document.addEventListener('mousedown', handleClickOutside);
      }

      return () => {
         document.removeEventListener('mousedown', handleClickOutside);
      };
   }, [isOpen, handleClose]);

   if (!isOpen) return null;

   const isSubmitting = createLoanMutation.isPending;

   return (
      <div 
         className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50"
         role="dialog"
         aria-modal="true"
         aria-labelledby="modal-title"
      >
         <section
            ref={modalRef}
            className="bg-white rounded-2xl shadow-md max-w-md mx-auto flex flex-col relative"
            style={{ minWidth: isVerified ? '400px' : '320px' }}
         >
            <button
               onClick={handleClose}
               className="absolute top-3 right-4 text-gray-600 hover:text-gray-800 z-10 text-2xl"
               aria-label="Close modal"
            >
               ✖
            </button>

            <header className="bg-[#1E56FF] rounded-t-2xl px-6 py-4 flex items-center justify-center gap-2">
               <h2 id="modal-title" className="text-white font-extrabold text-lg leading-6">
                  Set Your Own Terms
               </h2>
            </header>

            {!isVerified ? (
               <div className="bg-[#FFD7DD] text-[#D94A5B] text-sm font-semibold flex items-center justify-between px-4 py-2 rounded-t-none rounded-b-md select-none">
                  <div className="flex items-center gap-2">
                     <i className="fas fa-id-card" aria-hidden="true"></i>
                     <span>One quick step to request a loan.</span>
                  </div>
                  <WorldIDVerification>
                     {({ open }) => (
                        <button
                           onClick={open}
                           className="bg-[#FF5A6E] text-white text-xs font-extrabold rounded-md px-3 py-1 cursor-pointer"
                           style={{ minWidth: '44px', minHeight: '44px' }}
                        >
                           Get Verified
                        </button>
                     )}
                  </WorldIDVerification>
               </div>
            ) : null}

            <form onSubmit={handleSubmit} className="p-6 flex flex-col gap-5 text-gray-800 text-sm font-semibold">
               {/* Borrow Amount */}
               <div className="flex justify-between items-center">
                  <label className="text-gray-800 font-semibold text-sm" htmlFor="borrow-amount">
                     Borrow amount
                  </label>
                  <div className="flex items-center gap-1 bg-[#E6E9FF] text-[#1E56FF] text-xs font-semibold rounded-md px-2 py-1 select-none">
                     <span>Current Limit: ${creditLimit.toFixed(2)}</span>
                  </div>
               </div>

               <div className="flex border-solid border border-gray-300 rounded-md overflow-hidden">
                  <span
                     aria-hidden="true"
                     className="flex items-center justify-center bg-[#E6E9FF] text-[#1E56FF] px-4 text-base"
                  >
                     <i className="fas fa-dollar-sign"></i>
                     USDC
                  </span>
                  <input
                     ref={borrowAmountInputRef}
                     onChange={(e) => {
                        setBorrowAmount(e.target.value);
                        if (validationErrors.borrowAmount) {
                           setValidationErrors((prev) => ({ ...prev, borrowAmount: '' }));
                        }
                     }}
                     className="flex-1 px-4 py-2 text-gray-700 text-sm font-normal focus:outline-none"
                     id="borrow-amount"
                     placeholder="Set your desired amount"
                     type="text"
                     value={borrowAmount}
                     disabled={!isVerified}
                     aria-describedby={validationErrors.borrowAmount ? 'borrow-amount-error' : undefined}
                  />
               </div>
               {validationErrors.borrowAmount ? (
                  <p id="borrow-amount-error" className="text-red-500 text-xs mt-1">
                     {validationErrors.borrowAmount}
                  </p>
               ) : null}

               {/* Repayment Amount */}
               <label className="font-semibold text-gray-800 text-sm" htmlFor="repayment-amount">
                  Repayment Amount
               </label>
               <input
                  onChange={(e) => {
                     setRepaymentAmount(e.target.value);
                     if (validationErrors.repaymentAmount) {
                        setValidationErrors((prev) => ({ ...prev, repaymentAmount: '' }));
                     }
                  }}
                  className="border border-gray-300 rounded-md px-4 py-2 text-gray-700 text-sm font-normal focus:outline-none"
                  id="repayment-amount"
                  placeholder="Must be more than Borrowed amount..."
                  type="text"
                  value={repaymentAmount}
                  disabled={!isVerified}
                  aria-describedby={validationErrors.repaymentAmount ? 'repayment-amount-error' : undefined}
               />
               {validationErrors.repaymentAmount ? (
                  <p id="repayment-amount-error" className="text-red-500 text-xs mt-1">
                     {validationErrors.repaymentAmount}
                  </p>
               ) : null}

               {/* Repayment Date */}
               <label className="font-semibold text-gray-800 text-sm" htmlFor="repayment-date">
                  Repayment Date
               </label>
               <div className="flex flex-col gap-2">
                  <div className="flex gap-3">
                     {isVerified && repaymentDate ? (
                        <button
                           className="bg-[#D6E1FF] text-[#1E56FF] font-semibold rounded-md px-5 py-2 text-sm select-none"
                           type="button"
                        >
                           {calculateDays()} Days
                        </button>
                     ) : null}
                     <input
                        onChange={(e) => {
                           setRepaymentDate(e.target.value);
                           if (validationErrors.repaymentDate) {
                              setValidationErrors((prev) => ({ ...prev, repaymentDate: '' }));
                           }
                        }}
                        placeholder="MM/DD/YYYY"
                        type="date"
                        min={getMinimumDate()}
                        id="repayment-date"
                        className="flex-1 border border-gray-300 rounded-md px-4 py-2 text-gray-700 text-sm font-normal focus:outline-none"
                        value={repaymentDate}
                        disabled={!isVerified}
                        style={{ minHeight: '44px' }}
                        aria-describedby={validationErrors.repaymentDate ? 'repayment-date-error' : undefined}
                     />
                  </div>
                  {isVerified ? <p className="text-xs text-gray-500">Date will be set to midnight UTC+00</p> : null}
               </div>
               {validationErrors.repaymentDate ? (
                  <p id="repayment-date-error" className="text-red-500 text-xs mt-1">
                     {validationErrors.repaymentDate}
                  </p>
               ) : null}

               {/* Reason for Borrowing */}
               <label className="font-semibold text-gray-800 text-sm" htmlFor="reason">
                  Reason For Borrowing
               </label>
               <textarea
                  maxLength={40}
                  onChange={(e) => {
                     setReason(e.target.value);
                     if (validationErrors.reason) {
                        setValidationErrors((prev) => ({ ...prev, reason: '' }));
                     }
                  }}
                  className="border border-gray-300 rounded-md px-4 py-2 text-gray-700 text-sm font-normal resize-none focus:outline-none"
                  id="reason"
                  placeholder="My car broke down I need help..."
                  rows={4}
                  value={reason}
                  disabled={!isVerified}
                  aria-describedby={validationErrors.reason ? 'reason-error' : undefined}
               ></textarea>
               <div className="text-right text-xs text-gray-400 font-normal select-none">{reason.length} / 40</div>
               {validationErrors.reason ? (
                  <p id="reason-error" className="text-red-500 text-xs mt-1">
                     {validationErrors.reason}
                  </p>
               ) : null}

               {/* Submit Button */}
               <button
                  className={`${isVerified && !isSubmitting ? 'bg-[#1E56FF]' : 'bg-gray-400 cursor-not-allowed'} text-white font-extrabold text-sm rounded-md py-3 mt-2 w-full`}
                  type="submit"
                  disabled={!isVerified || isSubmitting}
                  style={{ minHeight: '44px' }}
               >
                  {isSubmitting ? 'Submitting...' : 'Make Your Request'}
               </button>
            </form>
         </section>
      </div>
   );
}
