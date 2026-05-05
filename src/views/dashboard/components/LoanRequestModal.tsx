

import { type ChangeEvent, type FormEvent, type PointerEvent, type RefObject, useEffect, useRef, useState } from 'react';

import WorldIDVerification from '@/components/worldId/WorldIDVerification';
import { getEffectiveCreditLimit } from '@/lib/creditLeveling';
import { getSupabaseBrowserClient } from '@/lib/supabase/client';

import { type User } from '@/types/authTypes';

type DismissGestureMode = 'down' | 'side' | 'referral';

export type AppliedReferralCode = {
   id: string;
   code: string;
   boostAmount: number;
};

const REFERRAL_TEST_CODES: Record<string, AppliedReferralCode> = {
   BELLE: { id: 'referral-test-belle', code: 'BELLE', boostAmount: 5 }
};

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
   onReferralApplied: (referral: AppliedReferralCode | null) => void;
   isSubmitting: boolean;
   startOnReferralStep?: boolean;
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
   onReferralApplied,
   isSubmitting,
   startOnReferralStep = true
}: LoanRequestModalProps) {
   const dismissGestureRef = useRef<{ x: number; y: number; mode: DismissGestureMode } | null>(null);
   const dismissOffsetRef = useRef({ x: 0, y: 0 });
   const [dismissOffset, setDismissOffset] = useState({ x: 0, y: 0 });
   const [showReferralStep, setShowReferralStep] = useState(startOnReferralStep);
   const [referralCode, setReferralCode] = useState('');
   const [appliedReferral, setAppliedReferral] = useState<AppliedReferralCode | null>(null);
   const [referralCodeError, setReferralCodeError] = useState('');
   const [isApplyingReferralCode, setIsApplyingReferralCode] = useState(false);

   useEffect(() => {
      if (!isOpen) return;

      setShowReferralStep(startOnReferralStep);
      setReferralCode('');
      setAppliedReferral(null);
      setReferralCodeError('');
      setIsApplyingReferralCode(false);
      onReferralApplied(null);
   }, [isOpen, onReferralApplied, startOnReferralStep]);

   if (!isOpen) return null;

   const isVerified = !showVerify;
   const limitAmount = getEffectiveCreditLimit(user.cs, isVerified);
   const selectedDate = days ? days.slice(0, 10) : '';
   const hasReferralCode = referralCode.trim().length > 0;
   const hasAppliedReferralCode = appliedReferral !== null;
   const hasReferralCodeError = referralCodeError.length > 0;
   const isReferralTestMode = import.meta.env.DEV && new URLSearchParams(window.location.search).has('referralTest');
   const referralPrimaryActionText = hasAppliedReferralCode ? 'Continue' : hasReferralCodeError ? 'Try again' : hasReferralCode ? 'Apply code' : 'Skip';

   const formatReferralBoost = (boostAmount: number) => {
      const amount = Number(boostAmount);
      return Number.isInteger(amount) ? amount.toFixed(0) : amount.toFixed(2);
   };

   const handleReferralCodeChange = (value: string) => {
      setReferralCode(value);
      setReferralCodeError('');

      if (appliedReferral && value.trim().toUpperCase() !== appliedReferral.code) {
         setAppliedReferral(null);
         onReferralApplied(null);
      }
   };

   const applyReferralCode = async (): Promise<boolean> => {
      const cleanCode = referralCode.trim().toUpperCase();

      if (!cleanCode) return false;

      setReferralCode(cleanCode);
      setIsApplyingReferralCode(true);

      try {
         if (isReferralTestMode) {
            const testReferral = REFERRAL_TEST_CODES[cleanCode];

            if (!testReferral) {
               setAppliedReferral(null);
               onReferralApplied(null);
               setReferralCodeError('Referral code incorrect. If you have issues, contact support.');
               return false;
            }

            setAppliedReferral(testReferral);
            onReferralApplied(testReferral);
            setReferralCodeError('');
            return true;
         }

         const supabase = getSupabaseBrowserClient();
         const { data, error } = await supabase
            .from('referral_codes')
            .select('id, code, boost_amount')
            .eq('code', cleanCode)
            .maybeSingle();

         if (error) throw error;

         if (!data) {
            setAppliedReferral(null);
            onReferralApplied(null);
            setReferralCodeError('Referral code incorrect. If you have issues, contact support.');
            return false;
         }

         const nextReferral = {
            id: data.id,
            code: data.code,
            boostAmount: Number(data.boost_amount)
         };

         setAppliedReferral(nextReferral);
         onReferralApplied(nextReferral);
         setReferralCodeError('');
         return true;
      } catch (error) {
         console.error('Error validating referral code:', (error as Error).message || error);
         setAppliedReferral(null);
         onReferralApplied(null);
         setReferralCodeError("We couldn't check that code. Please try again.");
         return false;
      } finally {
         setIsApplyingReferralCode(false);
      }
   };

   const continueToLoanForm = async () => {
      if (hasReferralCode && !hasAppliedReferralCode) {
         const didApply = await applyReferralCode();
         if (!didApply) return;
      }

      setShowReferralStep(false);
   };

   const isInteractiveReferralTarget = (target: EventTarget | null) =>
      target instanceof HTMLElement && Boolean(target.closest('input, button, textarea, select, a'));

   const startDismissGesture = (event: PointerEvent<HTMLElement>, mode: DismissGestureMode) => {
      if (mode === 'referral' && isInteractiveReferralTarget(event.target)) return;

      dismissGestureRef.current = { x: event.clientX, y: event.clientY, mode };
      dismissOffsetRef.current = { x: 0, y: 0 };
      event.currentTarget.setPointerCapture(event.pointerId);
   };

   const moveDismissGesture = (event: PointerEvent<HTMLElement>) => {
      const gesture = dismissGestureRef.current;
      if (!gesture) return;

      const deltaX = event.clientX - gesture.x;
      const deltaY = event.clientY - gesture.y;
      const nextOffset =
         gesture.mode === 'down'
            ? { x: 0, y: Math.max(0, deltaY) }
            : gesture.mode === 'referral'
              ? { x: Math.max(-120, Math.min(120, deltaX)), y: 0 }
              : { x: Math.max(0, deltaX), y: 0 };

      dismissOffsetRef.current = nextOffset;
      setDismissOffset(nextOffset);
   };

   const endDismissGesture = (event: PointerEvent<HTMLElement>) => {
      const gesture = dismissGestureRef.current;
      if (!gesture) return;

      event.currentTarget.releasePointerCapture(event.pointerId);
      const shouldClose =
         (gesture.mode === 'down' && dismissOffsetRef.current.y > 88) ||
         (gesture.mode === 'side' && dismissOffsetRef.current.x > 76);
      const shouldSkipReferral = gesture.mode === 'referral' && dismissOffsetRef.current.x > 88;
      const shouldCancelReferral = gesture.mode === 'referral' && dismissOffsetRef.current.x < -88;

      dismissGestureRef.current = null;
      dismissOffsetRef.current = { x: 0, y: 0 };
      setDismissOffset({ x: 0, y: 0 });

      if (shouldSkipReferral) {
         setShowReferralStep(false);
         return;
      }

      if (shouldClose || shouldCancelReferral) onClose();
   };

   return (
      <div className="fixed inset-0 z-[70] flex items-center justify-center bg-black bg-opacity-50 px-3 py-4">
         <section
            ref={clickOutsideRef}
            className="relative mx-auto flex max-h-full min-w-0 w-full max-w-md flex-col overflow-hidden rounded-2xl bg-white shadow-md transition-transform duration-150 ease-out"
            style={{
               transform: `translate(${dismissOffset.x}px, ${dismissOffset.y}px)`
            }}
         >
            {!showReferralStep ? (
               <div
                  aria-label="Swipe right to close loan form"
                  className="absolute bottom-0 left-0 top-0 z-10 w-8 touch-none cursor-ew-resize select-none"
                  onPointerDown={(event) => startDismissGesture(event, 'side')}
                  onPointerMove={moveDismissGesture}
                  onPointerUp={endDismissGesture}
                  onPointerCancel={endDismissGesture}
                  role="presentation"
               />
            ) : null}
            <button onClick={onClose} className="absolute top-3 right-4 text-white hover:text-gray-800 z-10 text-2xl">
               ✖
            </button>
            <header
               className="flex touch-none cursor-grab select-none items-center justify-center gap-2 rounded-t-2xl bg-[#1E56FF] px-4 py-3 active:cursor-grabbing sm:px-6 sm:py-4"
               onPointerDown={(event) => startDismissGesture(event, 'down')}
               onPointerMove={moveDismissGesture}
               onPointerUp={endDismissGesture}
               onPointerCancel={endDismissGesture}
            >
               {showReferralStep ? (
                  <h2 className="text-[clamp(1rem,4vw,1.125rem)] font-extrabold leading-6 text-white">Referral Boost</h2>
               ) : (
                  <>
                     <h2 className="text-[clamp(1rem,4vw,1.125rem)] font-extrabold leading-6 text-white">Set Your Own Terms</h2>
                     <button aria-label="Help info" className="text-white text-sm font-semibold focus:outline-none" type="button">
                        <i className="fas fa-question-circle"></i>
                     </button>
                  </>
               )}
            </header>

            {showVerify ? (
               <div className="flex items-center justify-between gap-2 rounded-b-md bg-[#FFD7DD] px-4 py-2 text-[13px] font-semibold leading-tight text-[#D94A5B] select-none">
                  <div className="flex min-w-0 items-center gap-2">
                     <i className="fas fa-id-card"></i>
                     <span>Verification Required for Borrowers</span>
                  </div>
                  <WorldIDVerification>
                     {({ open }) => (
                        <button
                           onClick={open}
                           className="shrink-0 cursor-pointer whitespace-nowrap rounded-md bg-[#FF5A6E] px-3 py-1 text-xs font-extrabold text-white"
                        >
                           Click Here
                        </button>
                     )}
                  </WorldIDVerification>
               </div>
            ) : null}

            {showReferralStep ? (
               <div
                  className="touch-pan-y p-6 flex flex-col gap-5 text-gray-800 text-sm font-semibold"
                  onPointerDown={(event) => startDismissGesture(event, 'referral')}
                  onPointerMove={moveDismissGesture}
                  onPointerUp={endDismissGesture}
                  onPointerCancel={endDismissGesture}
               >
                  <div className="flex items-start gap-4">
                     <div className="min-w-0 flex-1">
                        <span className="inline-flex rounded-md bg-[#E6E9FF] px-2 py-1 text-xs font-semibold text-[#1E56FF]">Optional</span>
                        <h3 className="mt-3 text-lg font-extrabold leading-6 text-gray-800">Have a referral code?</h3>
                        <p className="mt-1 text-sm font-normal leading-5 text-gray-500">Add it before you apply for a higher starting limit.</p>
                     </div>
                     <img src="/hippos/referral-boost.png" alt="" className="h-20 w-20 shrink-0 object-contain" />
                  </div>

                  <div className="inline-flex w-fit items-center gap-2 rounded-md bg-[#D4F4DD] px-3 py-2 text-sm font-semibold text-[#2B9B5F]">
                     <i className="fas fa-check"></i>
                     <span>+$5 Credit Limit Boost</span>
                  </div>

                  <label className="sr-only" htmlFor="referral-code">
                     Referral code
                  </label>
                  <div
                     className={`flex items-center gap-3 rounded-md border bg-white px-4 py-2 ${
                        hasReferralCodeError ? 'border-[#D94A5B]' : hasAppliedReferralCode ? 'border-[#2B9B5F]' : 'border-gray-300'
                     }`}
                  >
                     <i className={`fas fa-ticket-alt ${hasReferralCodeError ? 'text-[#D94A5B]' : 'text-[#1E56FF]'}`}></i>
                     <input
                        id="referral-code"
                        value={referralCode}
                        onChange={(event: ChangeEvent<HTMLInputElement>) => handleReferralCodeChange(event.target.value)}
                        placeholder="Enter code"
                        className="min-w-0 flex-1 bg-transparent text-sm font-normal text-gray-700 placeholder:text-gray-400 focus:outline-none"
                        type="text"
                     />
                  </div>

                  {hasReferralCodeError ? (
                     <div className="flex items-center gap-2 rounded-md bg-[#FFF1F2] px-3 py-2 text-xs font-semibold text-[#D94A5B]">
                        <i className="fas fa-circle-exclamation"></i>
                        <span>{referralCodeError}</span>
                     </div>
                  ) : hasAppliedReferralCode ? (
                     <div className="flex items-center gap-2 rounded-md bg-[#F0FDF4] px-3 py-2 text-xs font-semibold text-[#2B9B5F]">
                        <i className="fas fa-check-circle"></i>
                        <span>
                           Code {appliedReferral.code} applied: +${formatReferralBoost(appliedReferral.boostAmount)} starting limit
                        </span>
                     </div>
                  ) : null}

                  <button
                     className="w-full rounded-md bg-[#1E56FF] py-3 text-sm font-extrabold text-white hover:opacity-90 disabled:opacity-70"
                     type="button"
                     disabled={isApplyingReferralCode}
                     onClick={continueToLoanForm}
                  >
                     {isApplyingReferralCode ? 'Checking code...' : referralPrimaryActionText}
                  </button>
                  <p className="text-center text-xs font-medium text-gray-400">No code? You can still apply as normal.</p>
               </div>
            ) : (
            <form
               onSubmit={handleSubmit}
               className="flex min-h-0 flex-col gap-4 overflow-y-auto p-4 text-[clamp(0.8125rem,3.5vw,0.875rem)] font-semibold text-gray-800 sm:gap-5 sm:p-6"
            >
               {hasAppliedReferralCode ? (
                  <div className="flex items-center gap-2 rounded-xl bg-[#F0FDF4] px-3 py-2 text-sm font-bold text-[#2B9B5F]">
                     <i className="fas fa-check-circle"></i>
                     <span>
                        Referral {appliedReferral.code} added: +${formatReferralBoost(appliedReferral.boostAmount)} starting limit
                     </span>
                  </div>
               ) : null}
               <div className="flex flex-wrap items-center justify-between gap-2">
                  <label className="font-semibold text-gray-800" htmlFor="borrow-amount">
                     Borrow amount
                  </label>
                  <div className="flex items-center gap-1 rounded-md bg-[#E6E9FF] px-2 py-1 text-[clamp(0.6875rem,3vw,0.75rem)] font-semibold text-[#1E56FF] select-none">
                     <button aria-label="Limit info" className="focus:outline-none" type="button">
                        <i className="fas fa-question-circle"></i>
                     </button>
                     <span>Limit: ${limitAmount || '0'}</span>
                  </div>
               </div>
               <div className="flex min-w-0 overflow-hidden rounded-md border border-solid border-gray-300">
                  <span aria-hidden="true" className="flex shrink-0 items-center justify-center bg-[#E6E9FF] px-3 text-[clamp(0.875rem,3.8vw,1rem)] text-[#1E56FF] sm:px-4">
                     <i className="fas fa-dollar-sign"></i>
                     USD
                  </span>
                  <input
                     onChange={(e: ChangeEvent<HTMLInputElement>) => setLoanAmount(e.target.value)}
                     className="min-w-0 flex-1 px-3 py-2 text-[inherit] font-normal text-gray-700 focus:outline-none sm:px-4"
                     id="borrow-amount"
                     placeholder="Set your desired amount"
                     type="text"
                     value={loanAmount}
                  />
               </div>
               <label className="font-semibold text-gray-800" htmlFor="repayment-amount">
                  Set Repayment amount
               </label>
               <input
                  onChange={(e: ChangeEvent<HTMLInputElement>) => setTotalRepaymentAmount(e.target.value)}
                  className="rounded-md border border-gray-300 px-3 py-2 text-[inherit] font-normal text-gray-700 focus:outline-none sm:px-4"
                  id="repayment-amount"
                  placeholder="Must be more than borrowed amount..."
                  type="text"
                  value={totalRepaymentAmount}
               />
               <label className="font-semibold text-gray-800">Repayment Date</label>
               <div className="flex flex-col gap-2">
                  <div className="flex flex-col gap-3 sm:flex-row">
                     <button className="rounded-md bg-[#D6E1FF] px-4 py-2 text-[inherit] font-semibold text-[#1E56FF] select-none sm:px-5" type="button">
                        {isVerified && days
                           ? `${Math.ceil((new Date(days).getTime() - Date.now()) / (1000 * 60 * 60 * 24))} Days`
                           : '5 Days'}
                     </button>
                     <div className="flex min-w-0 flex-1 overflow-hidden rounded-md border border-gray-300">
                        <input
                           onChange={handleDays}
                           placeholder="DD/MM/YY"
                           type="date"
                           min={today}
                           value={selectedDate}
                           id="repaymentDate"
                           className="min-w-0 flex-1 px-3 py-2 text-[inherit] font-normal text-gray-700 focus:outline-none sm:px-4"
                        />
                     </div>
                  </div>
                  <p className="text-xs text-gray-500">Date will be set to midnight UTC+00</p>
               </div>
               <label className="font-semibold text-gray-800" htmlFor="reason">
                  Reason for Borrowing
               </label>
               <div className="flex flex-col gap-2">
                  <textarea
                     maxLength={40}
                     onChange={(e: ChangeEvent<HTMLTextAreaElement>) => setReason(e.target.value)}
                     className="resize-none rounded-md border border-gray-300 px-3 py-2 text-[inherit] font-normal text-gray-700 focus:outline-none sm:px-4"
                     id="reason"
                     placeholder="My car broke down I need help..."
                     rows={3}
                     value={reason}
                  ></textarea>
                  <div className="text-right text-xs font-normal text-gray-400 select-none">{reason.length} / 40</div>
               </div>
               <button
                  className={`${isVerified && !isSubmitting ? 'bg-[#1E56FF]' : 'bg-gray-400 cursor-not-allowed'} w-full rounded-md py-3 text-sm font-extrabold text-white`}
                  type="submit"
                  disabled={!isVerified || isSubmitting}
               >
                  {isSubmitting ? 'Submitting...' : 'Make Your Request'}
               </button>
            </form>
            )}
         </section>
      </div>
   );
}
