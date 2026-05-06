import {
   type ChangeEvent,
   type ClipboardEvent,
   type FocusEvent,
   type FormEvent,
   type KeyboardEvent,
   type PointerEvent,
   type RefObject,
   useEffect,
   useRef,
   useState
} from 'react';

import { AlertCircle, CalendarDays, ChevronLeft, ChevronRight, HelpCircle, X } from 'lucide-react';
import { DayPicker } from 'react-day-picker';

import WorldIDVerification from '@/components/worldId/WorldIDVerification';
import { getEffectiveCreditLimit } from '@/lib/creditLeveling';

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
   onReferralApplied?: (referral: AppliedReferralCode | null) => void;
   isSubmitting: boolean;
}

export type AppliedReferralCode = {
   id: string;
   code: string;
   boostAmount: number;
};

const inputShellClass =
   'border-md-neutral-600 bg-md-neutral-100 shadow-md-card overflow-hidden rounded-md-input border border-solid';

const parseIsoDate = (value: string) => {
   if (!value) return undefined;

   const [year, month, day] = value.slice(0, 10).split('-').map(Number);
   if (!year || !month || !day) return undefined;

   return new Date(year, month - 1, day);
};

const formatDateInputValue = (date: Date) => {
   const year = date.getFullYear();
   const month = String(date.getMonth() + 1).padStart(2, '0');
   const day = String(date.getDate()).padStart(2, '0');
   return `${year}-${month}-${day}`;
};

const shouldAllowDateYearEditing = (todayDate: Date) => todayDate.getMonth() >= 9;

const formatDateLabel = (date: Date) => {
   const day = String(date.getDate()).padStart(2, '0');
   const month = String(date.getMonth() + 1).padStart(2, '0');
   return `${day}/${month}/${date.getFullYear()}`;
};

const formatDateDigits = (date: Date, allowYearEditing: boolean) => {
   const day = String(date.getDate()).padStart(2, '0');
   const month = String(date.getMonth() + 1).padStart(2, '0');
   return allowYearEditing ? `${day}${month}${date.getFullYear()}` : `${day}${month}`;
};

const getTypedDateDigits = (value: string, allowYearEditing: boolean, assumedYear: number) => {
   if (allowYearEditing) return value.replace(/\D/g, '').slice(0, 8);

   const [dayPart = '', monthPart = ''] = value.replace(new RegExp(`/${assumedYear}$`), '').split('/');
   return `${dayPart}${monthPart}`.replace(/\D/g, '').slice(0, 4);
};

const formatDateMask = (digits: string, allowYearEditing: boolean, assumedYear: number) => {
   if (!digits) return '';

   if (digits.length < 2) return allowYearEditing ? `${digits}/MM/YYYY` : `${digits}/MM/${assumedYear}`;
   if (digits.length === 2) return allowYearEditing ? `${digits}/MM/YYYY` : `${digits}/MM/${assumedYear}`;
   if (digits.length < 4) {
      const value = `${digits.slice(0, 2)}/${digits.slice(2)}`;
      return allowYearEditing ? `${value}/YYYY` : `${value}/${assumedYear}`;
   }

   const day = digits.slice(0, 2);
   const month = digits.slice(2, 4);
   if (!allowYearEditing) return `${day}/${month}/${assumedYear}`;

   const year = digits.slice(4, 8);
   if (!year) return `${day}/${month}/`;
   return `${day}/${month}/${year}`;
};

const getDateCaretPosition = (digits: string, allowYearEditing: boolean) => {
   if (allowYearEditing) {
      if (digits.length <= 2) return digits.length;
      if (digits.length <= 4) return digits.length + 1;
      return digits.length + 2;
   }

   if (digits.length <= 2) return digits.length;
   return Math.min(digits.length + 1, 5);
};

const addDays = (date: Date, days: number) => {
   const nextDate = new Date(date);
   nextDate.setDate(nextDate.getDate() + days);
   return nextDate;
};

const inferLoanDate = (digits: string, todayDate: Date, maxDate: Date, allowYearEditing: boolean) => {
   if (digits.length !== (allowYearEditing ? 8 : 4)) return undefined;

   const day = Number(digits.slice(0, 2));
   const month = Number(digits.slice(2, 4));
   if (!day || !month) return undefined;

   const year = allowYearEditing ? Number(digits.slice(4, 8)) : todayDate.getFullYear();
   if (!year) return undefined;

   const candidate = new Date(year, month - 1, day);
   if (candidate.getMonth() !== month - 1 || candidate.getDate() !== day) return undefined;

   if (candidate < todayDate || candidate > maxDate) return undefined;
   return candidate;
};

function EmptyCalendarNav() {
   return null;
}

const UsdcIcon = () => (
   <svg aria-hidden="true" className="h-6 w-6 shrink-0" fill="none" viewBox="0 0 24 24">
      <path
         d="M9.75 4.75C6.72 5.63 4.5 8.44 4.5 11.75s2.22 6.12 5.25 7M14.25 4.75c3.03.88 5.25 3.69 5.25 7s-2.22 6.12-5.25 7M12 7.75v8M14.25 9.75c-.35-.62-1.08-1-2.04-1-1.11 0-1.96.53-1.96 1.38 0 .89.81 1.17 2.02 1.47 1.33.33 2.23.73 2.23 1.75 0 .93-.91 1.65-2.18 1.65-1.06 0-1.91-.39-2.32-1.08"
         stroke="currentColor"
         strokeLinecap="round"
         strokeLinejoin="round"
         strokeWidth="1.8"
      />
   </svg>
);

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
   isSubmitting
}: LoanRequestModalProps) {
   const formRef = useRef<HTMLFormElement | null>(null);
   const dateInputRef = useRef<HTMLInputElement | null>(null);
   const reasonTextareaRef = useRef<HTMLTextAreaElement | null>(null);
   const dismissGestureRef = useRef<{ x: number; y: number; mode: 'down' | 'side' } | null>(null);
   const dismissOffsetRef = useRef({ x: 0, y: 0 });
   const [dismissOffset, setDismissOffset] = useState({ x: 0, y: 0 });
   const [isCalendarOpen, setIsCalendarOpen] = useState(false);

   const isVerified = !showVerify;
   const limitAmount = getEffectiveCreditLimit(user.cs, isVerified);
   const selectedDate = days ? days.slice(0, 10) : '';
   const selectedCalendarDate = parseIsoDate(selectedDate);
   const todayDate = parseIsoDate(today) ?? new Date();
   const maxLoanDate = addDays(todayDate, 120);
   const allowYearEditing = shouldAllowDateYearEditing(todayDate);
   const assumedYear = todayDate.getFullYear();
   const datePlaceholder = allowYearEditing ? 'DD/MM/YYYY' : `DD/MM/${assumedYear}`;
   const selectedDateLabel = selectedCalendarDate ? formatDateLabel(selectedCalendarDate) : '';
   const selectedDateDigits = selectedCalendarDate ? formatDateDigits(selectedCalendarDate, allowYearEditing) : '';
   const [typedDate, setTypedDate] = useState(selectedDateLabel);
   const [typedDateDigits, setTypedDateDigits] = useState(selectedDateDigits);
   const [calendarMonth, setCalendarMonth] = useState(selectedCalendarDate ?? todayDate);

   useEffect(() => {
      setTypedDate(selectedDateLabel);
      setTypedDateDigits(selectedDateDigits);
   }, [selectedDateLabel, selectedDateDigits]);

   useEffect(() => {
      setCalendarMonth(selectedCalendarDate ?? todayDate);
   }, [selectedDate, today]);

   useEffect(() => {
      if (isOpen) onReferralApplied?.(null);
   }, [isOpen, onReferralApplied]);

   const keepDateCursorInEditablePart = (digits = typedDateDigits) => {
      window.requestAnimationFrame(() => {
         const input = dateInputRef.current;
         if (!input) return;

         const caretPosition = getDateCaretPosition(digits, allowYearEditing);
         input.setSelectionRange(caretPosition, caretPosition);
      });
   };

   const applyTypedDateDigits = (digits: string) => {
      const maxLength = allowYearEditing ? 8 : 4;
      const cleanDigits = digits.replace(/\D/g, '').slice(0, maxLength);
      const value = formatDateMask(cleanDigits, allowYearEditing, assumedYear);
      setTypedDateDigits(cleanDigits);
      setTypedDate(value);
      keepDateCursorInEditablePart(cleanDigits);

      const inferredDate = inferLoanDate(cleanDigits, todayDate, maxLoanDate, allowYearEditing);
      if (!inferredDate) return;

      const normalizedDate = formatDateInputValue(inferredDate);
      handleDays({ target: { value: normalizedDate } } as ChangeEvent<HTMLInputElement>);
   };

   const handleTypedDate = (event: ChangeEvent<HTMLInputElement>) => {
      const digits = getTypedDateDigits(event.target.value, allowYearEditing, assumedYear);
      applyTypedDateDigits(digits);
   };

   const handleDateKeyDown = (event: KeyboardEvent<HTMLInputElement>) => {
      if (/^\d$/.test(event.key)) {
         event.preventDefault();
         applyTypedDateDigits(`${typedDateDigits}${event.key}`);
         return;
      }

      if (event.key === 'Backspace' || event.key === 'Delete') {
         event.preventDefault();
         applyTypedDateDigits(typedDateDigits.slice(0, -1));
      }
   };

   const handleDatePaste = (event: ClipboardEvent<HTMLInputElement>) => {
      const pastedDigits = event.clipboardData.getData('text').replace(/\D/g, '');
      if (!pastedDigits) return;

      event.preventDefault();
      applyTypedDateDigits(`${typedDateDigits}${pastedDigits}`);
   };

   const selectCalendarDate = (date: Date | undefined) => {
      if (!date) return;

      const normalizedDate = formatDateInputValue(date);
      setTypedDate(formatDateLabel(date));
      setTypedDateDigits(formatDateDigits(date, allowYearEditing));
      handleDays({ target: { value: normalizedDate } } as ChangeEvent<HTMLInputElement>);
      setIsCalendarOpen(false);
   };

   const scrollFieldIntoView = (event: FocusEvent<HTMLElement>) => {
      const field = event.currentTarget;

      window.setTimeout(() => {
         const form = formRef.current;
         if (form) {
            const fieldRect = field.getBoundingClientRect();
            const formRect = form.getBoundingClientRect();
            const nextTop = form.scrollTop + fieldRect.top - formRect.top - form.clientHeight / 2 + fieldRect.height / 2;

            form.scrollTo({ behavior: 'smooth', top: Math.max(0, nextTop) });
         }

         field.scrollIntoView({ behavior: 'smooth', block: 'center', inline: 'nearest' });
      }, 90);
   };

   const resizeReasonTextarea = (textarea: HTMLTextAreaElement | null) => {
      if (!textarea) return;

      textarea.style.height = 'auto';
      textarea.style.height = `${textarea.scrollHeight}px`;
   };

   useEffect(() => {
      resizeReasonTextarea(reasonTextareaRef.current);
   }, [reason, isOpen]);

   if (!isOpen) return null;

   const startDismissGesture = (event: PointerEvent<HTMLElement>, mode: 'down' | 'side') => {
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

      dismissGestureRef.current = null;
      dismissOffsetRef.current = { x: 0, y: 0 };
      setDismissOffset({ x: 0, y: 0 });

      if (shouldClose) onClose();
   };

   return (
      <div className="fixed inset-0 z-[70] flex items-start justify-center overflow-y-auto bg-black/20 px-[21px] py-[64px] sm:items-center sm:py-6">
         <section
            ref={clickOutsideRef}
            className="relative mx-auto flex max-h-[calc(100dvh-42px)] w-full max-w-[398px] flex-col overflow-hidden rounded-md-lg border border-md-neutral-400 bg-md-neutral-100 shadow-md-card transition-transform duration-150 ease-out"
            style={{ transform: `translate(${dismissOffset.x}px, ${dismissOffset.y}px)` }}
         >
            <div
               aria-label="Swipe right to close loan form"
               className="absolute bottom-0 left-0 top-0 z-10 w-8 touch-none cursor-ew-resize select-none"
               onPointerDown={(event) => startDismissGesture(event, 'side')}
               onPointerMove={moveDismissGesture}
               onPointerUp={endDismissGesture}
               onPointerCancel={endDismissGesture}
               role="presentation"
            />
            <header
               className="flex touch-none cursor-grab select-none items-center justify-between border-b border-md-neutral-400 p-md-3 active:cursor-grabbing"
               onPointerDown={(event) => startDismissGesture(event, 'down')}
               onPointerMove={moveDismissGesture}
               onPointerUp={endDismissGesture}
               onPointerCancel={endDismissGesture}
            >
               <div className="flex items-center gap-md-1">
                  <h2 className="text-md-h6 text-md-heading">Set Your Own Terms</h2>
                  <HelpCircle aria-hidden="true" className="h-5 w-5 text-md-primary-900" strokeWidth={1.75} />
               </div>
               <button aria-label="Close loan form" onClick={onClose} className="text-md-neutral-2000 hover:text-md-primary-1200" type="button">
                  <X aria-hidden="true" className="h-8 w-8" strokeWidth={2} />
               </button>
            </header>

            <form ref={formRef} onSubmit={handleSubmit} className="flex min-h-0 flex-col gap-md-3 overflow-y-auto p-md-3 text-md-b2 text-md-heading">
               {showVerify ? (
                  <div className="flex items-center gap-md-2 overflow-hidden rounded-md-lg border border-md-neutral-400 bg-[#fff6d0] px-md-3 py-md-2">
                     <div className="flex min-w-0 max-w-[220px] flex-1 flex-col gap-md-1">
                        <div className="flex flex-col gap-md-0">
                           <p className="whitespace-nowrap text-md-b2 font-medium text-md-primary-2000">One quick step to request a loan</p>
                           <p className="text-md-b3 font-normal text-md-neutral-1400">
                              Complete a one-time verification to start building trust with lenders.
                           </p>
                        </div>
                        <WorldIDVerification>
                           {({ open }) => (
                              <button
                                 onClick={open}
                                 className="w-fit rounded-[12px] bg-md-primary-1200 px-md-2 py-md-1 text-md-b2 font-semibold text-md-neutral-100"
                                 type="button"
                              >
                                 Get Verified
                              </button>
                           )}
                        </WorldIDVerification>
                     </div>
                     <img alt="" aria-hidden="true" className="h-[86px] w-[96px] shrink-0 object-contain" src="/hippos/welcome.png" />
                  </div>
               ) : null}

               <div className="flex flex-col gap-md-1">
                  <div className="flex items-center justify-between gap-md-2">
                     <label className="text-md-b2 font-normal text-md-heading" htmlFor="borrow-amount">
                        Borrow Amount
                     </label>
                     <div className="flex items-center gap-md-0 rounded-md-md bg-md-primary-100 px-md-1 py-md-0 text-md-b3 font-normal text-[#3e0a88]">
                        <span>Current Limit: ${limitAmount || '0'}</span>
                        <HelpCircle aria-hidden="true" className="h-4 w-4" strokeWidth={1.75} />
                     </div>
                  </div>
                  <div className={`flex items-center ${inputShellClass}`}>
                     <span
                        aria-hidden="true"
                        className="flex min-w-[112px] items-center justify-center gap-md-1 self-stretch border-r border-md-neutral-600 bg-[#2775ca] px-md-3 py-md-2 text-md-b1 font-normal text-md-neutral-100"
                     >
                        <UsdcIcon />
                        USDC
                     </span>
                     <input
                        onChange={(e: ChangeEvent<HTMLInputElement>) => setLoanAmount(e.target.value)}
                        onFocus={scrollFieldIntoView}
                        className="min-w-0 flex-1 bg-transparent px-md-3 py-md-2 text-md-b1 font-normal text-md-heading placeholder:text-md-neutral-1200 focus:outline-none"
                        id="borrow-amount"
                        inputMode="decimal"
                        placeholder="Set your desired amount"
                        type="text"
                        value={loanAmount}
                     />
                  </div>
                  <div className="flex justify-end gap-md-1 text-md-b3 font-normal text-md-neutral-1200">
                     <AlertCircle aria-hidden="true" className="h-4 w-4 text-md-primary-900" strokeWidth={2} />
                     <span>All loans are issued and repaid in USDC.</span>
                  </div>
               </div>

               <div className="flex flex-col gap-md-1">
                  <label className="text-md-b2 font-normal text-md-heading" htmlFor="repayment-amount">
                     Set Repayment Amount
                  </label>
                  <input
                     onChange={(e: ChangeEvent<HTMLInputElement>) => setTotalRepaymentAmount(e.target.value)}
                     onFocus={scrollFieldIntoView}
                     className={`${inputShellClass} px-md-3 py-md-2 text-md-b1 font-normal text-md-heading placeholder:text-md-neutral-1200 focus:outline-none`}
                     id="repayment-amount"
                     inputMode="decimal"
                     placeholder="Must be more than the borrowed amount"
                     type="text"
                     value={totalRepaymentAmount}
                  />
               </div>

               <div className="flex flex-col gap-md-1">
                  <label className="text-md-b2 font-normal text-md-heading" htmlFor="repaymentDate">
                     Set Repayment Date
                  </label>
                  <div className="relative">
                     <div className={`relative flex items-center ${inputShellClass}`}>
                        <input
                           ref={dateInputRef}
                           aria-label="Selected repayment date"
                           onChange={handleTypedDate}
                           onClick={() => keepDateCursorInEditablePart()}
                           onBlur={() => {
                              if (!typedDate.replace(/\D/g, '')) setTypedDate('');
                           }}
                           onFocus={(event) => {
                              scrollFieldIntoView(event);
                              keepDateCursorInEditablePart();
                           }}
                           onKeyDown={handleDateKeyDown}
                           onPaste={handleDatePaste}
                           onSelect={() => keepDateCursorInEditablePart()}
                           placeholder={datePlaceholder}
                           type="text"
                           value={typedDate}
                           id="repaymentDate"
                           className="min-w-0 flex-1 bg-transparent px-md-3 py-md-2 pr-[64px] text-md-b1 font-normal text-md-heading placeholder:text-md-neutral-1200 focus:outline-none"
                        />
                        <button
                           aria-label="Open repayment date calendar"
                           className="absolute inset-y-0 right-0 flex w-[56px] items-center justify-center border-l border-md-neutral-600 text-md-primary-900"
                           onClick={() => setIsCalendarOpen((isOpen) => !isOpen)}
                           type="button"
                        >
                           <CalendarDays aria-hidden="true" className="h-6 w-6" strokeWidth={1.6} />
                        </button>
                     </div>
                  </div>
               </div>

               <div className="flex flex-col gap-md-1">
                  <label className="text-md-b2 font-normal text-md-heading" htmlFor="reason">
                     Reason For Borrowing
                  </label>
                  <div className={`${inputShellClass} flex flex-col px-md-3 py-md-2`}>
                     <textarea
                        ref={reasonTextareaRef}
                        maxLength={40}
                        onChange={(e: ChangeEvent<HTMLTextAreaElement>) => {
                           setReason(e.target.value);
                           resizeReasonTextarea(e.target);
                        }}
                        onFocus={scrollFieldIntoView}
                        className="min-h-[48px] resize-none overflow-hidden bg-transparent text-md-b1 font-normal text-md-heading placeholder:text-md-neutral-1200 focus:outline-none"
                        id="reason"
                        placeholder="Text"
                        rows={1}
                        value={reason}
                     />
                     <div className="text-right text-md-b3 font-normal text-md-neutral-1200 select-none">{reason.length}/40</div>
                  </div>
               </div>

               <button
                  className={`w-full rounded-md-lg px-md-4 py-md-3 text-md-b1 font-medium text-md-neutral-100 ${
                     isVerified && !isSubmitting ? 'bg-md-primary-1200' : 'cursor-not-allowed bg-md-neutral-600'
                  }`}
                  type="submit"
                  disabled={!isVerified || isSubmitting}
               >
                  {isSubmitting ? 'Submitting...' : 'Make Your Request'}
               </button>
            </form>
         </section>
         {isCalendarOpen ? (
            <div
               aria-label="Choose repayment date"
               aria-modal="true"
               className="fixed inset-0 z-[90] flex items-center justify-center bg-black/20 px-[21px]"
               onClick={() => setIsCalendarOpen(false)}
               role="dialog"
            >
               <div
                  className="w-[292px] rounded-md-input border border-md-neutral-600 bg-md-neutral-100 p-md-2 shadow-[0_12px_28px_rgba(20,18,24,0.18)]"
                  onClick={(event) => event.stopPropagation()}
               >
                  <div className="mb-md-1 flex items-center justify-between">
                     <button
                        aria-label="Previous month"
                        className="rounded-md-md p-md-0 text-md-neutral-1200 hover:bg-md-primary-100 hover:text-md-primary-1200"
                        onClick={() => setCalendarMonth(new Date(calendarMonth.getFullYear(), calendarMonth.getMonth() - 1, 1))}
                        type="button"
                     >
                        <ChevronLeft aria-hidden="true" className="h-5 w-5" />
                     </button>
                     <p className="text-md-b2 font-medium text-md-heading">
                        {calendarMonth.toLocaleString(undefined, { month: 'long', year: 'numeric' })}
                     </p>
                     <button
                        aria-label="Next month"
                        className="rounded-md-md p-md-0 text-md-neutral-1200 hover:bg-md-primary-100 hover:text-md-primary-1200"
                        onClick={() => setCalendarMonth(new Date(calendarMonth.getFullYear(), calendarMonth.getMonth() + 1, 1))}
                        type="button"
                     >
                        <ChevronRight aria-hidden="true" className="h-5 w-5" />
                     </button>
                  </div>
                  <DayPicker
                     mode="single"
                     month={calendarMonth}
                     onMonthChange={setCalendarMonth}
                     selected={selectedCalendarDate}
                     onSelect={selectCalendarDate}
                     disabled={{ before: todayDate, after: maxLoanDate }}
                     fixedWeeks
                     showOutsideDays
                     components={{ Nav: EmptyCalendarNav }}
                     classNames={{
                        root: 'text-md-heading',
                        month_caption: 'hidden',
                        nav: 'hidden',
                        month_grid: 'w-full border-collapse',
                        weekdays: 'grid grid-cols-7',
                        weekday: 'py-md-0 text-center text-md-b4 font-normal text-md-neutral-1200',
                        week: 'grid grid-cols-7',
                        day: 'grid place-items-center p-[1px]',
                        day_button:
                           'grid h-9 w-9 place-items-center rounded-md-md text-md-b3 font-normal text-md-heading hover:bg-md-primary-100 hover:text-md-primary-1200',
                        selected: '[&>button]:bg-md-primary-1200 [&>button]:text-md-neutral-100',
                        today: '[&>button]:border [&>button]:border-md-primary-900',
                        outside: '[&>button]:text-md-neutral-600',
                        disabled: '[&>button]:cursor-not-allowed [&>button]:text-md-neutral-600 [&>button]:opacity-40'
                     }}
                  />
               </div>
            </div>
         ) : null}
      </div>
   );
}
