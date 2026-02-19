'use client';

import { type FormEvent, useCallback, useEffect, useRef, useState } from 'react';
import { useDispatch } from 'react-redux';

import DatePicker from '@/components/filters/DatePicker';
import { Button } from '@/components/shadcn/button';
import { Input } from '@/components/shadcn/input';
import WorldIDVerification from '@/components/worldId/WorldIDVerification';
import { getEffectiveCreditLimit } from '@/lib/creditLeveling';
import { createLoan } from '@/store/slices/loanSlice';
import type { AppDispatch } from '@/store/store';
import { type User } from '@/types/authTypes';
import { WorldId } from '@/types/authTypes';
import { cn } from '@/lib/utils';

import hippoVerifyImage from '../../../images/hippo_verify.png';

interface RequestLoanModalProps {
   isOpen: boolean;
   onClose: () => void;
   user: User | null;
   isConnected?: boolean;
   onOpenConnect?: () => void;
   onSuccess?: () => void;
}

export default function RequestLoanModal({ isOpen, onClose, user, isConnected = true, onOpenConnect, onSuccess }: RequestLoanModalProps) {
   const [borrowAmount, setBorrowAmount] = useState('');
   const [repaymentAmount, setRepaymentAmount] = useState('');
   const [repaymentDate, setRepaymentDate] = useState<Date | null>(null);
   const [reason, setReason] = useState('');
   const [validationErrors, setValidationErrors] = useState<Record<string, string>>({});

   const dispatch = useDispatch<AppDispatch>();
   const modalRef = useRef<HTMLDivElement>(null);
   const borrowAmountInputRef = useRef<HTMLInputElement>(null);
   const [isSubmitting, setIsSubmitting] = useState(false);

   const isVerified = user?.isWorldId === WorldId.ACTIVE;
   const creditLimit = getEffectiveCreditLimit(user?.cs, isVerified);

   // Focus management - move focus to borrow amount input when modal opens
   useEffect(() => {
      if (isOpen && borrowAmountInputRef.current) {
         borrowAmountInputRef.current.focus();
      }
   }, [isOpen]);

   // Minimum repayment date (24 hours from now, start of day)
   const getMinimumDate = useCallback(() => {
      const tomorrow = new Date();
      tomorrow.setDate(tomorrow.getDate() + 1);
      tomorrow.setHours(0, 0, 0, 0);
      return tomorrow;
   }, []);

   const calculateDays = () => {
      if (!repaymentDate) return 0;
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      const repayDate = new Date(repaymentDate);
      repayDate.setHours(0, 0, 0, 0);
      const diffTime = repayDate.getTime() - today.getTime();
      return Math.ceil(diffTime / (1000 * 60 * 60 * 24));
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
      const minDate = getMinimumDate();
      if (!repaymentDate) {
         errors.repaymentDate = 'Repayment date is required';
      } else {
         const selected = new Date(repaymentDate);
         selected.setHours(0, 0, 0, 0);
         if (selected < minDate) {
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

      if (!repaymentDate) return;

      // Due date at midnight UTC
      const d = new Date(repaymentDate);
      const dueDate = new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate(), 0, 0, 0, 0)).toISOString();

      const loanData = {
         borrowerUserId: user?.id ?? '',
         lenderUserId: '',
         loanAmount: parseFloat(borrowAmount),
         totalRepaymentAmount: parseFloat(repaymentAmount),
         reason: reason.trim(),
         dueDate
      };

      setIsSubmitting(true);
      try {
         await dispatch(createLoan(loanData)).unwrap();
         setBorrowAmount('');
         setRepaymentAmount('');
         setRepaymentDate(null);
         setReason('');
         setValidationErrors({});
         onClose();
         onSuccess?.();
      } catch (error) {
         console.error('Loan request failed:', error);
      } finally {
         setIsSubmitting(false);
      }
   };

   const handleClose = useCallback(() => {
      // Reset form when closing
      setBorrowAmount('');
      setRepaymentAmount('');
      setRepaymentDate(null);
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

   return (
      <div
         className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-[2px]"
         role="dialog"
         aria-modal="true"
         aria-labelledby="modal-title"
      >
         <section
            ref={modalRef}
            className={cn(
               'bg-background rounded-xl shadow-2xl border border-border max-w-md w-full flex flex-col relative overflow-hidden'
            )}
         >
            <button
               type="button"
               onClick={handleClose}
               className="absolute top-4 right-4 z-10 rounded-full p-1.5 text-muted-foreground hover:bg-muted hover:text-foreground transition-colors"
               aria-label="Close modal"
            >
               <svg className="size-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden>
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
               </svg>
            </button>

            <header className="border-b border-border px-6 py-5 pr-12">
               <h2 id="modal-title" className="text-foreground text-xl font-semibold tracking-tight">
                  Set your own terms
               </h2>
               <p className="text-muted-foreground text-sm mt-1 leading-relaxed">
                  Request a loan in USDC.
               </p>
            </header>

            {!isConnected ? (
               <div className="flex items-center justify-between gap-4 px-6 py-4 border-b border-border bg-muted/40">
                  <p className="text-sm text-foreground">Connect your wallet to apply.</p>
                  <Button type="button" size="sm" variant="default" onClick={onOpenConnect} className="shrink-0">
                     Connect wallet
                  </Button>
               </div>
            ) : !isVerified ? (
               <div
                  className="flex items-center gap-5 px-6 py-5 border-b border-border"
                  style={{ backgroundColor: '#FFF6D0' }}
               >
                  <div className="flex-1 min-w-0">
                     <h3 className="text-foreground font-semibold text-base">One quick step to request a loan</h3>
                     <p className="text-muted-foreground text-sm mt-2 leading-relaxed">
                        Complete a one-time verification to start building trust with lenders.
                     </p>
                     <WorldIDVerification>
                        {({ open }) => (
                           <Button
                              type="button"
                              size="sm"
                              onClick={open}
                              className="mt-4 bg-[#6d57ff] hover:bg-[#5b46e0] text-white font-semibold rounded-lg shadow-sm"
                           >
                              Get Started
                           </Button>
                        )}
                     </WorldIDVerification>
                  </div>
                  <div className="shrink-0 w-24 h-24 flex items-center justify-center overflow-hidden rounded-lg">
                     <img src={hippoVerifyImage} alt="" className="h-full w-full object-contain" />
                  </div>
               </div>
            ) : null}

            <form onSubmit={handleSubmit} className="p-6 flex flex-col gap-6">
               {/* Borrow Amount */}
               <div className="space-y-2">
                  <div className="flex justify-between items-center">
                     <label className="text-sm font-medium text-foreground" htmlFor="borrow-amount">
                        Borrow amount
                     </label>
                     <span className="text-xs text-muted-foreground tabular-nums">
                        Limit ${creditLimit.toFixed(2)}
                     </span>
                  </div>
                  <div className="flex rounded-lg border border-input overflow-hidden focus-within:ring-2 focus-within:ring-ring focus-within:ring-offset-2 ring-offset-background">
                     <span
                        aria-hidden
                        className="flex items-center justify-center bg-muted px-4 text-sm font-medium text-muted-foreground border-r border-input"
                     >
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
                        className="flex-1 min-w-0 bg-background px-4 py-2.5 text-sm placeholder:text-muted-foreground focus:outline-none disabled:opacity-50 disabled:cursor-not-allowed"
                        id="borrow-amount"
                        placeholder="Amount"
                        type="text"
                        value={borrowAmount}
                        disabled={!isConnected || !isVerified}
                        aria-describedby={validationErrors.borrowAmount ? 'borrow-amount-error' : undefined}
                     />
                  </div>
                  {validationErrors.borrowAmount ? (
                     <p id="borrow-amount-error" className="text-sm text-destructive">
                        {validationErrors.borrowAmount}
                     </p>
                  ) : null}
               </div>

               {/* Repayment Amount */}
               <div className="space-y-2">
                  <label className="text-sm font-medium text-foreground" htmlFor="repayment-amount">
                     Repayment amount
                  </label>
                  <Input
                     id="repayment-amount"
                     type="text"
                     placeholder="Greater than borrow amount"
                     value={repaymentAmount}
                     disabled={!isConnected || !isVerified}
                     onChange={(e) => {
                        setRepaymentAmount(e.target.value);
                        if (validationErrors.repaymentAmount) {
                           setValidationErrors((prev) => ({ ...prev, repaymentAmount: '' }));
                        }
                     }}
                     aria-describedby={validationErrors.repaymentAmount ? 'repayment-amount-error' : undefined}
                  />
                  {validationErrors.repaymentAmount ? (
                     <p id="repayment-amount-error" className="text-sm text-destructive">
                        {validationErrors.repaymentAmount}
                     </p>
                  ) : null}
               </div>

               {/* Repayment Date */}
               <div className="space-y-2">
                  <label className="text-sm font-medium text-foreground" htmlFor="repayment-date">
                     Repayment date
                  </label>
                  <div className="flex gap-2 flex-wrap items-center">
                     {isVerified && repaymentDate ? (
                        <span className="inline-flex items-center rounded-md bg-muted text-muted-foreground text-sm px-3 py-2 h-10 tabular-nums">
                           {calculateDays()} days
                        </span>
                     ) : null}
                     <div className="flex-1 min-w-[180px]">
                        <DatePicker
                           value={repaymentDate}
                           onChange={(date) => {
                              setRepaymentDate(date);
                              if (validationErrors.repaymentDate) {
                                 setValidationErrors((prev) => ({ ...prev, repaymentDate: '' }));
                              }
                           }}
                           placeholder="Pick repayment date"
                           minDate={getMinimumDate()}
                           disabled={!isConnected || !isVerified}
                        />
                     </div>
                  </div>
                  {isVerified ? (
                     <p className="text-xs text-muted-foreground leading-relaxed">Due at midnight UTC.</p>
                  ) : null}
                  {validationErrors.repaymentDate ? (
                     <p id="repayment-date-error" className="text-sm text-destructive">
                        {validationErrors.repaymentDate}
                     </p>
                  ) : null}
               </div>

               {/* Reason */}
               <div className="space-y-2">
                  <div className="flex justify-between items-center">
                     <label className="text-sm font-medium text-foreground" htmlFor="reason">
                        Reason for borrowing
                     </label>
                     <span className="text-xs text-muted-foreground tabular-nums">{reason.length}/40</span>
                  </div>
                  <textarea
                     id="reason"
                     maxLength={40}
                     rows={3}
                     placeholder="e.g. Car repair, short-term cash flow..."
                     value={reason}
                     disabled={!isConnected || !isVerified}
                     onChange={(e) => {
                        setReason(e.target.value);
                        if (validationErrors.reason) {
                           setValidationErrors((prev) => ({ ...prev, reason: '' }));
                        }
                     }}
                     className={cn(
                        'flex w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed resize-none'
                     )}
                     aria-describedby={validationErrors.reason ? 'reason-error' : undefined}
                  />
                  {validationErrors.reason ? (
                     <p id="reason-error" className="text-sm text-destructive">
                        {validationErrors.reason}
                     </p>
                  ) : null}
               </div>

               <Button
                  type="submit"
                  disabled={!isConnected || !isVerified || isSubmitting}
                  variant={isConnected && isVerified && !isSubmitting ? 'default' : 'secondary'}
                  className="w-full h-11 font-medium"
               >
                  {isSubmitting ? 'Submitting…' : 'Make your request'}
               </Button>
            </form>
         </section>
      </div>
   );
}
