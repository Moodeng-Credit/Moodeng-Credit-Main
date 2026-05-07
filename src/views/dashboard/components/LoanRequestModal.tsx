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
import { useNavigate } from 'react-router-dom';

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

type TooltipId = 'terms' | 'limit' | 'usdc';

const tooltipCopy: Record<TooltipId, string> = {
   terms: 'Choose how much you want to borrow, when you will repay, and why you need the loan.',
   limit: 'Your current maximum borrow amount. Repaying loans on time can help increase this limit.',
   usdc: 'USDC is digital dollars accepted by major exchanges, making borrowing and lending easier across countries.'
};

const termsTooltipIconSrc = 'data:image/png;base64,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';

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

function InfoTooltip({
   id,
   activeTooltip,
   setActiveTooltip,
   label,
   iconSrc,
   iconClassName = 'h-5 w-5',
   iconStrokeWidth = 1.35,
   panelClassName = 'left-1/2 top-full mt-md-1 -translate-x-1/2',
   arrowClassName = 'left-1/2 top-[-5px] -translate-x-1/2 rotate-45'
}: {
   id: TooltipId;
   activeTooltip: TooltipId | null;
   setActiveTooltip: (id: TooltipId | null) => void;
   label: string;
   iconSrc?: string;
   iconClassName?: string;
   iconStrokeWidth?: number;
   panelClassName?: string;
   arrowClassName?: string;
}) {
   const isOpen = activeTooltip === id;

   return (
      <span className="relative inline-flex">
         <button
            aria-expanded={isOpen}
            aria-label={label}
            className="inline-flex shrink-0 items-center justify-center text-md-primary-900"
            onClick={(event) => {
               event.stopPropagation();
               setActiveTooltip(isOpen ? null : id);
            }}
            onPointerDown={(event) => event.stopPropagation()}
            type="button"
         >
            {iconSrc ? (
               <img alt="" aria-hidden="true" className={iconClassName} src={iconSrc} />
            ) : (
               <HelpCircle aria-hidden="true" className={iconClassName} strokeWidth={iconStrokeWidth} />
            )}
         </button>
         {isOpen ? (
            <span
               className={`absolute z-50 flex w-[220px] max-w-[calc(100vw-64px)] items-center justify-center rounded-[8px] bg-[#360975] p-[10px] text-center text-md-b3 font-normal leading-[18px] text-md-primary-100 shadow-md-card ${panelClassName}`}
               onPointerDown={(event) => event.stopPropagation()}
               role="tooltip"
            >
               {tooltipCopy[id]}
               <span aria-hidden="true" className={`absolute h-3 w-3 bg-[#360975] ${arrowClassName}`} />
            </span>
         ) : null}
      </span>
   );
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
   const navigate = useNavigate();
   const formRef = useRef<HTMLFormElement | null>(null);
   const dateInputRef = useRef<HTMLInputElement | null>(null);
   const reasonTextareaRef = useRef<HTMLTextAreaElement | null>(null);
   const dismissGestureRef = useRef<{ x: number; y: number; mode: 'down' | 'side' } | null>(null);
   const dismissOffsetRef = useRef({ x: 0, y: 0 });
   const [dismissOffset, setDismissOffset] = useState({ x: 0, y: 0 });
   const [isCalendarOpen, setIsCalendarOpen] = useState(false);
   const [activeTooltip, setActiveTooltip] = useState<TooltipId | null>(null);

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

   const startVerificationOnboarding = () => {
      onClose();
      navigate('/verify-world-id');
   };

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

   useEffect(() => {
      if (!isOpen) return undefined;

      const closeTooltip = () => setActiveTooltip(null);
      const closeTooltipOnEscape = (event: globalThis.KeyboardEvent) => {
         if (event.key === 'Escape') closeTooltip();
      };

      document.addEventListener('pointerdown', closeTooltip);
      document.addEventListener('keydown', closeTooltipOnEscape);

      return () => {
         document.removeEventListener('pointerdown', closeTooltip);
         document.removeEventListener('keydown', closeTooltipOnEscape);
      };
   }, [isOpen]);

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
                  <InfoTooltip
                     activeTooltip={activeTooltip}
                     arrowClassName="right-[42px] top-[-5px] rotate-45"
                     iconClassName="h-7 w-7"
                     iconSrc={termsTooltipIconSrc}
                     id="terms"
                     label="Explain setting loan terms"
                     panelClassName="right-[-40px] top-full mt-md-1"
                     setActiveTooltip={setActiveTooltip}
                  />
               </div>
               <button
                  aria-label="Close loan form"
                  onClick={(event) => {
                     event.stopPropagation();
                     onClose();
                  }}
                  onPointerDown={(event) => event.stopPropagation()}
                  className="text-md-neutral-2000 hover:text-md-primary-1200"
                  type="button"
               >
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
                        <button
                           onClick={startVerificationOnboarding}
                           className="w-fit rounded-[12px] bg-md-primary-1200 px-md-2 py-md-1 text-md-b2 font-semibold text-md-neutral-100"
                           type="button"
                        >
                           Get Verified
                        </button>
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
                        <InfoTooltip
                           activeTooltip={activeTooltip}
                           arrowClassName="bottom-[-5px] left-1/2 -translate-x-1/2 rotate-45"
                           iconClassName="h-4 w-4"
                           id="limit"
                           label="Explain current borrow limit"
                           panelClassName="right-0 bottom-full mb-md-1"
                           setActiveTooltip={setActiveTooltip}
                        />
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
                     <span className="relative inline-flex">
                        <button
                           aria-expanded={activeTooltip === 'usdc'}
                           aria-label="Explain USDC loans"
                           className="inline-flex text-md-primary-900"
                           onClick={(event) => {
                              event.stopPropagation();
                              setActiveTooltip(activeTooltip === 'usdc' ? null : 'usdc');
                           }}
                           onPointerDown={(event) => event.stopPropagation()}
                           type="button"
                        >
                           <AlertCircle aria-hidden="true" className="h-4 w-4" strokeWidth={2} />
                        </button>
                        {activeTooltip === 'usdc' ? (
                           <span
                              className="absolute left-0 top-full z-50 mt-md-1 flex w-[260px] max-w-[calc(100vw-64px)] -translate-x-1/2 items-center justify-center rounded-[8px] bg-[#360975] p-[10px] text-center text-md-b2 font-normal leading-[21px] text-md-primary-100 shadow-md-card"
                              onPointerDown={(event) => event.stopPropagation()}
                              role="tooltip"
                           >
                              {tooltipCopy.usdc}
                              <span aria-hidden="true" className="absolute left-1/2 top-[-5px] h-3 w-3 -translate-x-1/2 rotate-45 bg-[#360975]" />
                           </span>
                        ) : null}
                     </span>
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
               onMouseDown={(event) => event.stopPropagation()}
               role="dialog"
            >
               <div
                  className="w-[292px] rounded-md-input border border-md-neutral-600 bg-md-neutral-100 p-md-2 shadow-[0_12px_28px_rgba(20,18,24,0.18)]"
                  onClick={(event) => event.stopPropagation()}
                  onMouseDown={(event) => event.stopPropagation()}
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
