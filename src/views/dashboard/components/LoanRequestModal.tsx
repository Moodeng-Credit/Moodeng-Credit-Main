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

import {
   Briefcase,
   BriefcaseBusiness,
   Bus,
   CalendarDays,
   Check,
   CheckCircle,
   ChevronLeft,
   ChevronRight,
   Clock3,
   FileText,
   HelpCircle,
   Lightbulb,
   ShieldCheck,
   Stethoscope,
   Ticket,
   TriangleAlert,
   Users,
   WalletCards,
   X
} from 'lucide-react';
import { DayPicker } from 'react-day-picker';
import { useDispatch } from 'react-redux';
import { useNavigate } from 'react-router-dom';

import AskMechaButton from '@/components/mecha/AskMechaButton';
import { TOAST_TYPES } from '@/components/ToastSystem/config/toastConfig';
import { useToast } from '@/components/ToastSystem/hooks/useToast';
import UserAvatar, { PLACEHOLDER_AVATAR } from '@/components/UserAvatar';
import { useVerifyYourself } from '@/components/verification/VerifyYourselfModal';

import type { BorrowerContextState } from '@/lib/borrowerContextFit';
import { suggestedReturnRange } from '@/lib/loanPricing';
import { checkReasonQuality } from '@/lib/reasonQuality';
import { uploadAvatarForCurrentUser } from '@/lib/supabase/avatarStorage';
import { getSupabaseBrowserClient } from '@/lib/supabase/client';
import { getVerificationUiState, VERIFICATION_STATE_CTA } from '@/lib/verificationUiState';
import { updateUser } from '@/store/slices/authSlice';
import type { AppDispatch } from '@/store/store';
import { type User } from '@/types/authTypes';
import AvatarUploadModal from '@/views/account/AvatarUploadModal';

import { termsTooltipIconSrc } from './termsTooltipIcon';

interface LoanRequestModalProps {
   clickOutsideRef: RefObject<HTMLDivElement>;
   isOpen: boolean;
   onClose: () => void;
   showVerify: boolean;
   isPending?: boolean;
   user: User;
   loanAmount: string;
   setLoanAmount: (value: string) => void;
   totalRepaymentAmount: string;
   setTotalRepaymentAmount: (value: string) => void;
   reason: string;
   setReason: (value: string) => void;
   reasonWarning?: string;
   days: string;
   today: string;
   handleDays: (e: ChangeEvent<HTMLInputElement>) => void;
   handleSubmit: (e: FormEvent<HTMLFormElement>, borrowerContext?: BorrowerContextState) => void;
   onReferralApplied?: (referral: AppliedReferralCode | null) => void;
   onReferralRedeemed?: () => Promise<void>;
   isSubmitting: boolean;
   availableCreditLimit: number;
   canUseReferralBoost?: boolean;
   requireBorrowerContextStep?: boolean;
   startOnBorrowerContextStep?: boolean;
   startOnReferralStep?: boolean;
}

export type AppliedReferralCode = {
   id: string;
   code: string;
   boostAmount: number;
};

type DismissGestureMode = 'down' | 'side' | 'referral';

export type BorrowerContextOption = {
   description?: string;
   icon?: typeof BriefcaseBusiness;
   label: string;
   pillLabel?: string;
   value: string;
};

export type BorrowerContextMultiOption = BorrowerContextOption & {
   icon: typeof BriefcaseBusiness;
};

const REFERRAL_TEST_CODES: Record<string, AppliedReferralCode> = {
   BELLE: { id: 'referral-test-belle', code: 'BELLE', boostAmount: 5 }
};

export const inputShellClass =
   'border-md-neutral-600 bg-md-neutral-100 shadow-md-card overflow-hidden rounded-md-input border border-solid transition duration-150 ease-out focus-within:border-md-primary-900 focus-within:ring-2 focus-within:ring-md-primary-100 focus:border-md-primary-900 focus:ring-2 focus:ring-md-primary-100';

export const emptyBorrowerContext: BorrowerContextState = {
   incomeSetup: '',
   paydayWindow: '',
   cashGaps: [],
   monthlyIncome: '',
   monthlyExpenses: ''
};

export const incomeSetupOptions: BorrowerContextOption[] = [
   {
      label: 'I have a regular job',
      value: 'full_time',
      description: 'Full-time or part-time with a fixed employer',
      icon: Briefcase
   },
   {
      label: 'I work for myself',
      value: 'self_employed',
      description: 'Freelance, gig work, self-employed, or contract',
      icon: Ticket
   },
   {
      label: 'My income varies',
      value: 'irregular',
      description: 'Irregular, seasonal, or mixed sources',
      icon: WalletCards
   },
   {
      label: 'Something else',
      value: 'contract',
      description: 'Describe your situation in your own words',
      icon: FileText
   }
];

export const paydayWindowOptions: BorrowerContextOption[] = [
   { label: '1st-5th', value: '1_5', icon: Clock3 },
   { label: '10th-15th', value: '10_15', icon: Clock3 },
   { label: '15th-20th', value: '15_20', icon: Clock3 },
   { label: '25th-30th', value: '25_30', icon: Clock3 },
   { label: 'It varies', value: 'varies', icon: Clock3 }
];

export const cashGapOptions: BorrowerContextMultiOption[] = [
   { label: 'Gap before payday', value: 'gap_before_payday', icon: Clock3 },
   { label: 'Bills before payday', value: 'bills_before_payday', icon: FileText },
   { label: 'Family needs', value: 'family_needs', icon: Users },
   { label: 'Transport costs', value: 'transport', icon: Bus },
   { label: 'Medical expenses', value: 'medical', icon: Stethoscope },
   { label: 'Emergency costs', value: 'emergency_costs', icon: TriangleAlert },
   { label: 'Work supplies', value: 'work_supplies', icon: Briefcase }
];

export const monthlyIncomeOptions: BorrowerContextOption[] = [
   { label: 'Under $200', value: 'under_200', icon: Clock3 },
   { label: '$200–$400', value: '200_400', icon: Clock3 },
   { label: '$400–$700', value: '400_700', icon: Clock3 },
   { label: 'Over $700', value: '700_plus', icon: Clock3 }
];

export const monthlyExpensesOptions: BorrowerContextOption[] = [
   { label: 'Under $50', value: 'under_50', icon: Clock3 },
   { label: '$50–$150', value: '50_150', icon: Clock3 },
   { label: '$150–$300', value: '150_300', icon: Clock3 },
   { label: 'Over $300', value: '300_plus', icon: Clock3 }
];

export type PaydayConfig = { type: string; start: number | null; end: number | null };
export const PAYDAY_WINDOW_TO_CONFIG: Record<string, PaydayConfig> = {
   '1_5': { type: 'mid-month', start: 1, end: 5 },
   '10_15': { type: 'mid-month', start: 10, end: 15 },
   '15_20': { type: 'mid-month', start: 15, end: 20 },
   '25_30': { type: 'end-of-month', start: 25, end: 30 },
   varies: { type: 'irregular', start: null, end: null }
};
export const INCOME_SETUP_TO_TYPE: Record<string, string> = {
   full_time: 'full-time',
   self_employed: 'freelance',
   irregular: 'none',
   contract: 'part-time'
};
export const mapBorrowerContextForSave = (ctx: BorrowerContextState) => {
   const payday = PAYDAY_WINDOW_TO_CONFIG[ctx.paydayWindow];
   return {
      incomeType: INCOME_SETUP_TO_TYPE[ctx.incomeSetup] ?? ctx.incomeSetup,
      paydayType: payday?.type ?? ctx.paydayWindow,
      paydayStart: payday?.start ?? null,
      paydayEnd: payday?.end ?? null,
      gapReasons: ctx.cashGaps,
      monthlyIncome: ctx.monthlyIncome,
      monthlyExpenses: ctx.monthlyExpenses,
      otherIncome: ctx.otherIncome || undefined,
      profession: ctx.profession || undefined,
      incomeDescription: ctx.incomeDescription || undefined
   };
};

type TooltipId = 'terms' | 'limit' | 'usdc';

const tooltipCopy: Record<TooltipId, string> = {
   terms: 'Choose how much you want to borrow, when you will repay, and why you need the loan.',
   limit: 'Your current maximum borrow amount. Repaying loans on time can help increase this limit.',
   usdc: 'USDC is digital dollars accepted by major exchanges, making borrowing and lending easier across countries.'
};

const isIgnorableMilestoneError = (error: { code?: string; message?: string }) =>
   error.code === 'PGRST202' ||
   error.code === 'P0002' ||
   error.code === '23514' ||
   error.message?.includes('record_milestone_completion') ||
   error.message?.includes('Milestone not found') ||
   error.message?.includes('Milestone criteria not met');

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

function BorrowerContextLoanStep({
   page,
   context,
   currentAvatarBackground,
   currentAvatarUrl,
   isSubmitting,
   isSavingProfile,
   monthlyIncome,
   monthlyExpenses,
   onBack,
   onNextPage,
   onCashGapToggle,
   onContinue,
   onIncomeSelect,
   onMonthlyIncomeSelect,
   onMonthlyExpensesSelect,
   onOtherIncomeChange,
   onProfessionChange,
   onIncomeDescriptionChange,
   onPaydaySelect,
   onProfileImageClick,
   onProfileNameChange,
   profileName,
   profileSaveError
}: {
   page: 1 | 2;
   context: BorrowerContextState;
   currentAvatarBackground?: string | null;
   currentAvatarUrl?: string | null;
   isSubmitting: boolean;
   isSavingProfile: boolean;
   onBack: () => void;
   onNextPage: () => void;
   monthlyIncome: string;
   monthlyExpenses: string;
   onCashGapToggle: (value: string) => void;
   onContinue: () => void;
   onIncomeSelect: (value: string) => void;
   onMonthlyIncomeSelect: (value: string) => void;
   onMonthlyExpensesSelect: (value: string) => void;
   onOtherIncomeChange: (value: string) => void;
   onProfessionChange: (value: string) => void;
   onIncomeDescriptionChange: (value: string) => void;
   onPaydaySelect: (value: string) => void;
   onProfileImageClick: () => void;
   onProfileNameChange: (value: string) => void;
   profileName: string;
   profileSaveError: string;
}) {
   const [hasOtherIncome, setHasOtherIncome] = useState<boolean>(Boolean(context.otherIncome));
   // Page 1 needs the "how do you work?" choice; page 2 needs payday + at least one help reason.
   const page1Complete = Boolean(context.incomeSetup);
   const page2Complete = Boolean(context.paydayWindow && monthlyIncome && monthlyExpenses && context.cashGaps.length > 0);
   const isBusy = isSubmitting || isSavingProfile;

   const backButton = (
      <button
         className="inline-flex min-h-[52px] items-center justify-center gap-md-1 rounded-[16px] border border-[#ded6e8] bg-[#f8f4fc] text-md-b1 font-[590] text-md-heading transition hover:bg-[#f3ecfa] active:scale-[0.98] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-md-primary-900 focus-visible:ring-offset-2"
         onClick={onBack}
         type="button"
      >
         <ChevronLeft className="size-5" strokeWidth={2} />
         Back
      </button>
   );

   if (page === 1) {
      return (
         <div className="flex min-h-0 flex-col gap-5">
            <section className="rounded-[20px] border border-[#e7d8ff] bg-[#f8f4fc] p-4">
               <div className="mb-3">
                  <p className="text-[12px] font-[590] leading-[18px] text-[#5d16c9]">Public borrower profile</p>
                  <p className="mt-0.5 text-[13px] font-normal leading-5 text-[#695b7b]">
                     This is the identity lenders see beside your request.
                  </p>
               </div>
               <button
                  className="flex w-full items-center gap-3 border-b border-[#e7d8ff] pb-4 text-left transition active:scale-[0.99] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-md-primary-900 focus-visible:ring-offset-2"
                  onClick={onProfileImageClick}
                  type="button"
               >
                  <UserAvatar
                     alt="Profile image"
                     backgroundColor={currentAvatarBackground ?? undefined}
                     clickable={false}
                     size={48}
                     src={currentAvatarUrl || PLACEHOLDER_AVATAR}
                  />
                  <div className="min-w-0 flex-1">
                     <p className="text-[15px] font-[590] leading-5 text-[#26143f]">Profile image</p>
                     <p className="mt-0.5 text-[12px] font-normal leading-[18px] text-[#695b7b]">Tap to choose a photo or avatar.</p>
                  </div>
                  <TrustBadge label="+15" earned={Boolean(currentAvatarUrl)} />
               </button>

               <label className="mt-4 flex flex-col gap-2">
                  <span className="flex items-center justify-between gap-md-2">
                     <span className="text-[15px] font-[590] leading-5 text-[#26143f]">Name shown to lenders</span>
                     <TrustBadge label="+10" earned={Boolean(profileName.trim())} />
                  </span>
                  <input
                     className="min-h-[48px] rounded-[14px] border border-[#d8d0e2] bg-white px-3 py-2 text-md-b1 font-normal text-[#26143f] placeholder:text-[#8a7c9c] focus:border-md-primary-900 focus:outline-none focus:ring-2 focus:ring-md-primary-100"
                     maxLength={30}
                     onChange={(event) => onProfileNameChange(event.target.value)}
                     placeholder="e.g. Maya, Jay, or a friendly nickname"
                     type="text"
                     value={profileName}
                  />
                  <span className="flex items-start justify-between gap-md-2 text-[12px] font-normal leading-[18px] text-[#695b7b]">
                     <span>Use a first name or friendly nickname.</span>
                     <span className="shrink-0">{profileName.length}/30</span>
                  </span>
                  {profileSaveError ? (
                     <span className="text-md-b3 font-medium leading-[18px] text-md-red-500">{profileSaveError}</span>
                  ) : null}
               </label>
            </section>

            <BorrowerContextRadioSection
               label="How would you describe your work?"
               onSelect={onIncomeSelect}
               options={incomeSetupOptions}
               selectedValue={context.incomeSetup}
            />

            {context.incomeSetup === 'contract' ? (
               <div className="flex flex-col gap-1.5">
                  <p className="text-md-b2 font-[590] text-md-heading">Describe your situation</p>
                  <p className="text-md-b3 text-md-neutral-700">Tell lenders how you earn, in your own words.</p>
                  <textarea
                     autoFocus
                     className="w-full resize-none rounded-md-input border border-md-neutral-600 bg-md-neutral-100 px-md-3 py-md-2 text-md-b2 text-md-heading placeholder:text-md-neutral-600 shadow-md-card focus:border-md-primary-900 focus:outline-none focus:ring-2 focus:ring-md-primary-100"
                     maxLength={200}
                     rows={3}
                     onChange={(e) => onIncomeDescriptionChange(e.target.value)}
                     placeholder="e.g. I run a small online shop and income changes month to month"
                     value={context.incomeDescription ?? ''}
                  />
               </div>
            ) : null}

            <div className="flex flex-col gap-2">
               <div>
                  <p className="text-[15px] font-[590] leading-5 text-md-heading">What do you do for work?</p>
                  <p className="mt-0.5 text-[12px] leading-[18px] text-md-neutral-1200">
                     Be specific, for example teacher or market vendor.
                  </p>
               </div>
               <input
                  className="min-h-[48px] w-full rounded-[14px] border border-[#d8d0e2] bg-white px-3 py-2 text-md-b2 text-md-heading placeholder:text-md-neutral-600 focus:border-md-primary-900 focus:outline-none focus:ring-2 focus:ring-md-primary-100"
                  maxLength={60}
                  onChange={(e) => onProfessionChange(e.target.value)}
                  placeholder="e.g. teacher"
                  type="text"
                  value={context.profession ?? ''}
               />
            </div>

            {!page1Complete ? (
               <p className="text-md-b3 font-medium leading-[18px] text-md-primary-1200">Still needed: how you describe your work.</p>
            ) : null}

            <div className="grid grid-cols-[104px_minmax(0,1fr)] gap-3">
               {backButton}
               <button
                  className="inline-flex min-h-[52px] items-center justify-center gap-md-1 rounded-[16px] bg-md-primary-1200 px-md-4 py-md-3 text-md-b1 font-[590] text-md-neutral-100 transition hover:bg-[#5200c8] active:scale-[0.98] disabled:cursor-not-allowed disabled:bg-md-neutral-600 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-md-primary-900 focus-visible:ring-offset-2"
                  disabled={!page1Complete || isBusy}
                  onClick={onNextPage}
                  type="button"
               >
                  {isBusy ? (
                     'Checking…'
                  ) : (
                     <>
                        Continue
                        <ChevronRight className="size-5" strokeWidth={2} />
                     </>
                  )}
               </button>
            </div>
         </div>
      );
   }

   return (
      <div className="flex min-h-0 flex-col gap-5">
         <BorrowerContextChipSection
            helper="Helps lenders see that repayment timing makes sense."
            label="When do you usually get paid?"
            onSelect={onPaydaySelect}
            options={paydayWindowOptions}
            selectedValues={[context.paydayWindow]}
         />

         <BorrowerContextChipSection
            label="What is your approximate monthly income?"
            helper="Helps lenders gauge repayment capacity."
            onSelect={onMonthlyIncomeSelect}
            options={monthlyIncomeOptions}
            selectedValues={[monthlyIncome]}
         />

         <BorrowerContextChipSection
            label="What do your recurring expenses cost per month?"
            helper="Helps lenders understand your financial commitments."
            onSelect={onMonthlyExpensesSelect}
            options={monthlyExpensesOptions}
            selectedValues={[monthlyExpenses]}
         />

         <div className="flex flex-col gap-3 border-t border-[#e7e0ec] pt-4">
            <div className="flex items-center justify-between">
               <div>
                  <p className="text-[15px] font-[590] leading-5 text-md-heading">Any other income sources?</p>
                  <p className="mt-0.5 text-[12px] leading-[18px] text-md-neutral-1200">
                     For example tutoring, delivery, or market trading.
                  </p>
               </div>
               <div className="flex gap-md-2">
                  {(['No', 'Yes'] as const).map((opt) => (
                     <button
                        key={opt}
                        type="button"
                        onClick={() => {
                           const next = opt === 'Yes';
                           setHasOtherIncome(next);
                           if (!next) onOtherIncomeChange('');
                        }}
                        className={`min-h-9 rounded-md-pill border px-4 py-1.5 text-[13px] font-[590] transition ${
                           (opt === 'Yes') === hasOtherIncome
                              ? 'border-md-primary-900 bg-md-primary-100 text-md-primary-1200'
                              : 'border-[#d8d0e2] bg-white text-md-neutral-1400'
                        }`}
                     >
                        {opt}
                     </button>
                  ))}
               </div>
            </div>
            {hasOtherIncome && (
               <input
                  autoFocus
                  className="min-h-[48px] w-full rounded-[14px] border border-[#d8d0e2] bg-white px-3 py-2 text-md-b2 text-md-heading placeholder:text-md-neutral-600 focus:border-md-primary-900 focus:outline-none focus:ring-2 focus:ring-md-primary-100"
                  maxLength={60}
                  onChange={(e) => onOtherIncomeChange(e.target.value)}
                  placeholder="e.g. tutoring on weekends"
                  type="text"
                  value={context.otherIncome ?? ''}
               />
            )}
         </div>

         <BorrowerContextChipSection
            caption="Pick all that apply."
            label="What do you usually need short-term help with?"
            multi
            onSelect={onCashGapToggle}
            options={cashGapOptions}
            selectedValues={context.cashGaps}
         />

         {!page2Complete ? (
            <p className="text-md-b3 font-medium leading-[18px] text-md-primary-1200">
               Still needed:{' '}
               {[
                  !context.paydayWindow ? 'when you get paid' : null,
                  !monthlyIncome ? 'your monthly income' : null,
                  !monthlyExpenses ? 'your monthly expenses' : null,
                  context.cashGaps.length === 0 ? 'what you need help with' : null
               ]
                  .filter(Boolean)
                  .join(', ')}
               .
            </p>
         ) : null}

         <div className="grid grid-cols-[104px_minmax(0,1fr)] gap-3">
            {backButton}
            <button
               className="inline-flex min-h-[52px] items-center justify-center gap-md-1 rounded-[16px] bg-md-primary-1200 px-md-4 py-md-3 text-md-b1 font-[590] text-md-neutral-100 transition hover:bg-[#5200c8] active:scale-[0.98] disabled:cursor-not-allowed disabled:bg-md-neutral-600 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-md-primary-900 focus-visible:ring-offset-2"
               disabled={!page2Complete || isBusy}
               onClick={onContinue}
               type="button"
            >
               {isSavingProfile ? 'Saving profile...' : isSubmitting ? 'Submitting...' : 'Submit request'}
            </button>
         </div>
      </div>
   );
}

// Compact reward pill: a coin dot + the points, right-aligned in its own column so it can
// never wrap into the label it sits beside (the old inline "+15 Trust Points" pill broke
// awkwardly on narrow phones). `shrink-0` keeps it intact when space is tight.
function TrustBadge({ label, earned = false }: { label: string; earned?: boolean }) {
   // Two states so the pill is live feedback: "available" (soft) until the field is filled,
   // then "earned" (solid green + check) so the reward visibly lights up when you complete it.
   if (earned) {
      return (
         <span className="inline-flex shrink-0 items-center gap-[4px] rounded-md-pill bg-md-green-700 px-[8px] py-[3px] text-md-b4 font-[700] text-md-neutral-100 shadow-[0_2px_8px_rgba(26,164,91,0.35)]">
            <Check className="size-[11px]" strokeWidth={3} aria-hidden="true" />
            {label}
         </span>
      );
   }
   return (
      <span className="inline-flex shrink-0 items-center gap-[4px] rounded-md-pill bg-md-green-100 px-[8px] py-[3px] text-md-b4 font-[700] text-md-green-900">
         <span aria-hidden="true" className="size-[10px] rounded-full bg-md-green-700" />
         {label}
      </span>
   );
}

// Inline, red field-level error shown directly under a terms input. role="alert" so screen
// readers announce it the moment it appears (the whole point is feedback the user can't miss).
function FieldError({ message }: { message: string }) {
   return (
      <div role="alert" className="flex items-start gap-1.5 text-md-b3 font-medium leading-[18px] text-md-red-500">
         <TriangleAlert className="mt-[1px] size-4 shrink-0" strokeWidth={2} aria-hidden="true" />
         <span>{message}</span>
      </div>
   );
}

// Non-blocking hint shown only when a valid repayment offers less back than loans of this size
// usually need to get funded quickly. Silent when the offer is in (or above) range — priced right
// means no noise. Never blocks submission.
function ReturnHint({ lo, hi }: { lo: number; hi: number }) {
   return (
      <div className="flex items-start gap-1.5 rounded-md-md bg-md-yellow-100 px-md-2 py-md-1 text-md-b3 font-normal leading-[18px] text-md-yellow-700">
         <Lightbulb className="mt-[1px] size-4 shrink-0" strokeWidth={2} aria-hidden="true" />
         <span>
            Loans around this size usually offer{' '}
            <span className="font-semibold">
               ${lo}–{hi}
            </span>{' '}
            back to get funded quickly. You can still submit.
         </span>
      </div>
   );
}

// Three-dot progress rail shown at the bottom of the multi-step request flow:
// step 1 = terms, step 2 = bio page 1, step 3 = bio page 2. Completed steps turn green,
// the current step is a purple ring, upcoming steps are grey — so borrowers can see the
// request is progressing and that a tap did something.
const STEP_LABELS = ['Your terms', 'About you', 'Repayment context'];
function StepDots({ current }: { current: 1 | 2 | 3 }) {
   return (
      <div role="group" aria-label={`Loan request progress: step ${current} of 3, ${STEP_LABELS[current - 1]}`}>
         <div className="flex items-center justify-center" aria-hidden="true">
            {[1, 2, 3].map((step) => {
               const isDone = step < current;
               const isNow = step === current;
               return (
                  <div key={step} className="flex items-center">
                     <span
                        className={`grid size-[22px] place-items-center rounded-full text-md-b4 font-[700] transition ${
                           isDone
                              ? 'bg-md-green-700 text-md-neutral-100'
                              : isNow
                                ? 'bg-md-primary-1200 text-md-neutral-100 ring-4 ring-md-primary-100'
                                : 'border-2 border-md-neutral-500 bg-md-neutral-300 text-md-neutral-600'
                        }`}
                     >
                        {isDone ? <Check className="size-3.5" strokeWidth={3} /> : step}
                     </span>
                     {step < 3 ? (
                        <span className={`h-[3px] w-[44px] rounded-full ${step < current ? 'bg-md-green-700' : 'bg-md-neutral-400'}`} />
                     ) : null}
                  </div>
               );
            })}
         </div>
      </div>
   );
}

export function BorrowerContextRadioSection({
   label,
   onSelect,
   options,
   selectedValue
}: {
   label: string;
   onSelect: (value: string) => void;
   options: BorrowerContextOption[];
   selectedValue: string;
}) {
   return (
      <fieldset className="flex flex-col gap-3">
         <legend className="text-[15px] font-[590] leading-5 text-md-heading">{label}</legend>
         <div className="grid grid-cols-1 gap-2">
            {options.map((option) => (
               <BorrowerContextRadioCard
                  key={option.value}
                  isSelected={selectedValue === option.value}
                  onClick={() => onSelect(option.value)}
                  option={option}
               />
            ))}
         </div>
      </fieldset>
   );
}

function BorrowerContextRadioCard({
   isSelected,
   onClick,
   option
}: {
   isSelected: boolean;
   onClick: () => void;
   option: BorrowerContextOption;
}) {
   return (
      <button
         aria-pressed={isSelected}
         className={`grid min-h-[64px] w-full grid-cols-[minmax(0,1fr)_22px] items-center gap-3 rounded-[16px] border px-4 py-3 text-left transition active:scale-[0.99] focus:outline-none focus-visible:ring-2 focus-visible:ring-md-primary-900 focus-visible:ring-offset-1 ${
            isSelected
               ? 'border-md-primary-900 bg-[#f3e8ff] text-md-primary-1200 shadow-[0_6px_16px_rgba(96,16,210,0.08)]'
               : 'border-[#ded6e8] bg-white text-md-neutral-1200 hover:border-[#cbbce0]'
         }`}
         onClick={onClick}
         type="button"
      >
         <span className="min-w-0">
            <span className={`block text-[14px] font-[590] leading-5 ${isSelected ? 'text-md-primary-1200' : 'text-md-heading'}`}>
               {option.label}
            </span>
            {option.description ? (
               <span className="mt-0.5 block text-[12px] font-normal leading-[18px] text-md-neutral-1200">{option.description}</span>
            ) : null}
         </span>
         <span
            className={`flex size-5 shrink-0 items-center justify-center rounded-md-pill border ${
               isSelected ? 'border-md-primary-1200 bg-md-primary-1200 text-md-neutral-100' : 'border-md-neutral-700 bg-md-neutral-100'
            }`}
         >
            {isSelected ? <Check className="size-3.5" strokeWidth={2.6} /> : null}
         </span>
      </button>
   );
}

export function BorrowerContextChipSection({
   caption,
   helper,
   label,
   multi = false,
   onSelect,
   options,
   selectedValues
}: {
   caption?: string;
   helper?: string;
   label: string;
   multi?: boolean;
   onSelect: (value: string) => void;
   options: BorrowerContextOption[];
   selectedValues: string[];
}) {
   return (
      <fieldset className="flex flex-col gap-3 border-t border-[#e7e0ec] pt-4">
         <legend className="sr-only">{label}</legend>
         <div className="flex flex-col gap-0.5">
            <span className="text-[15px] font-[590] leading-5 text-md-heading">{label}</span>
            {caption ? <span className="text-[12px] font-normal leading-[18px] text-md-neutral-1200">{caption}</span> : null}
            {helper ? <span className="text-[12px] font-normal leading-[18px] text-md-neutral-1200">{helper}</span> : null}
         </div>
         <div className="flex flex-wrap gap-2">
            {options.map((option) => (
               <BorrowerContextChoiceChip
                  key={option.value}
                  isSelected={selectedValues.includes(option.value)}
                  label={option.pillLabel ?? option.label}
                  multi={multi}
                  onClick={() => onSelect(option.value)}
               />
            ))}
         </div>
      </fieldset>
   );
}

function BorrowerContextChoiceChip({
   isSelected,
   label,
   multi,
   onClick
}: {
   isSelected: boolean;
   label: string;
   multi: boolean;
   onClick: () => void;
}) {
   return (
      <button
         aria-pressed={isSelected}
         className={`inline-flex min-h-[38px] items-center justify-center gap-[6px] rounded-md-pill border px-3 py-2 text-[13px] font-[590] leading-[18px] transition active:scale-[0.98] focus:outline-none focus-visible:ring-2 focus-visible:ring-md-primary-900 focus-visible:ring-offset-1 ${
            isSelected
               ? 'border-md-primary-900 bg-[#f3e8ff] text-md-primary-1200 shadow-[0_4px_10px_rgba(96,16,210,0.08)]'
               : 'border-[#d8d0e2] bg-white text-md-neutral-1400 hover:border-[#bfaed5]'
         }`}
         onClick={onClick}
         type="button"
      >
         {label}
         {multi && isSelected ? <Check className="size-3.5" strokeWidth={2.6} /> : null}
      </button>
   );
}

export default function LoanRequestModal({
   clickOutsideRef,
   isOpen,
   onClose,
   showVerify,
   isPending = false,
   user,
   loanAmount,
   setLoanAmount,
   totalRepaymentAmount,
   setTotalRepaymentAmount,
   reason,
   setReason,
   reasonWarning,
   days,
   today,
   handleDays,
   handleSubmit,
   onReferralApplied,
   onReferralRedeemed,
   isSubmitting,
   availableCreditLimit,
   canUseReferralBoost = true,
   requireBorrowerContextStep = true,
   startOnBorrowerContextStep = false,
   startOnReferralStep = true
}: LoanRequestModalProps) {
   const dispatch = useDispatch<AppDispatch>();
   const navigate = useNavigate();
   const { showToast } = useToast();
   const { open: openVerify, modal: verifyModal } = useVerifyYourself();
   const formRef = useRef<HTMLFormElement | null>(null);
   const dateInputRef = useRef<HTMLInputElement | null>(null);
   const reasonTextareaRef = useRef<HTMLTextAreaElement | null>(null);
   const dismissGestureRef = useRef<{ x: number; y: number; mode: DismissGestureMode } | null>(null);
   const dismissOffsetRef = useRef({ x: 0, y: 0 });
   const [dismissOffset, setDismissOffset] = useState({ x: 0, y: 0 });
   const [isCalendarOpen, setIsCalendarOpen] = useState(false);
   const [activeTooltip, setActiveTooltip] = useState<TooltipId | null>(null);
   const [showReferralStep, setShowReferralStep] = useState(startOnReferralStep);
   const [referralCode, setReferralCode] = useState('');
   const [appliedReferral, setAppliedReferral] = useState<AppliedReferralCode | null>(null);
   const [referralCodeError, setReferralCodeError] = useState('');
   const [isApplyingReferralCode, setIsApplyingReferralCode] = useState(false);
   const [showBorrowerContextStep, setShowBorrowerContextStep] = useState(startOnBorrowerContextStep);
   // The bio step is split into two short pages so borrowers never face one long scroll.
   const [bioPage, setBioPage] = useState<1 | 2>(1);
   useEffect(() => {
      if (!showBorrowerContextStep) return;
      formRef.current?.scrollTo({ top: 0 });
   }, [bioPage, showBorrowerContextStep]);
   // Inline, per-field validation for the terms step — shown under each field instead of a
   // toast that could hide behind the card. Checked before the borrower can advance/submit.
   const [termErrors, setTermErrors] = useState<{ amount?: string; repayment?: string; date?: string; reason?: string }>({});
   const [borrowerContext, setBorrowerContext] = useState<BorrowerContextState>(emptyBorrowerContext);
   const [borrowerContextPromptSeen, setBorrowerContextPromptSeen] = useState(false);
   const [borrowerProfileName, setBorrowerProfileName] = useState(user.displayName ?? user.username ?? '');
   const [borrowerProfileError, setBorrowerProfileError] = useState('');
   const [showBorrowerAvatarModal, setShowBorrowerAvatarModal] = useState(false);
   const [isSavingBorrowerProfile, setIsSavingBorrowerProfile] = useState(false);
   const [isSavingBorrowerAvatar, setIsSavingBorrowerAvatar] = useState(false);
   // Momentary — drives the shake when an unverified borrower taps "Make Your Request".
   const [verifyNudge, setVerifyNudge] = useState(false);

   const isVerified = !showVerify;
   const verifyUiState = getVerificationUiState(user);
   const verifyPendingTitle =
      verifyUiState === 'review'
         ? 'Manual review in progress'
         : verifyUiState === 'unfinished'
           ? 'Verification not finished'
           : verifyUiState === 'declined'
             ? "Verification didn't pass"
             : 'Verification in progress';
   const verifyPendingBody =
      verifyUiState === 'review'
         ? 'A human reviewer is double-checking your documents — this can take up to 1 business day.'
         : verifyUiState === 'unfinished'
           ? 'You left before finishing all the steps. Tap below to continue or start over.'
           : verifyUiState === 'declined'
             ? "We couldn't verify your identity. Tap below to try again or contact us."
             : "Your documents are being reviewed. We'll notify you once confirmed.";
   const verifyPendingCta = `${VERIFICATION_STATE_CTA[verifyUiState]} →`;
   const limitAmount = Math.max(availableCreditLimit, 0);
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
   const isRepaymentDateFilled = Boolean(inferLoanDate(typedDateDigits, todayDate, maxLoanDate, allowYearEditing));
   const hasReferralCode = referralCode.trim().length > 0;
   const hasAppliedReferralCode = appliedReferral !== null;
   const hasReferralCodeError = referralCodeError.length > 0;
   const isReferralTestMode = import.meta.env.DEV && new URLSearchParams(window.location.search).has('referralTest');
   const referralPrimaryActionText =
      hasAppliedReferralCode || !hasReferralCode ? 'Continue to application' : hasReferralCodeError ? 'Try again' : 'Apply code';
   const shouldShowReferralStep = showReferralStep && isVerified && canUseReferralBoost;
   const canContinueBorrowerContext = Boolean(
      borrowerContext.incomeSetup &&
      borrowerContext.paydayWindow &&
      borrowerContext.monthlyIncome &&
      borrowerContext.monthlyExpenses &&
      borrowerContext.cashGaps.length > 0
   );
   const currentBorrowerDisplayName = user.displayName ?? user.username ?? '';
   const isPreviewUser = user.email.endsWith('@moodeng.local') || user.id.includes('preview');

   // The 3-dot progress rail is only meaningful when the borrower goes through the full
   // terms → bio-1 → bio-2 journey. Returning borrowers (bio already saved) submit straight
   // from the terms step, so no rail is shown for them, and never on the optional referral step.
   const isMultiStepRequestFlow = requireBorrowerContextStep && !user.incomeType && isVerified;
   const showStepProgress = isMultiStepRequestFlow && !shouldShowReferralStep;
   const currentStep: 1 | 2 | 3 = showBorrowerContextStep ? (bioPage === 1 ? 2 : 3) : 1;

   useEffect(() => {
      setTypedDate(selectedDateLabel);
      setTypedDateDigits(selectedDateDigits);
   }, [selectedDateLabel, selectedDateDigits]);

   useEffect(() => {
      setCalendarMonth(selectedCalendarDate ?? todayDate);
   }, [selectedDate, today]);

   useEffect(() => {
      if (!isOpen) return;

      setShowReferralStep(startOnReferralStep && isVerified && canUseReferralBoost);
      setShowBorrowerContextStep(startOnBorrowerContextStep);
      setBioPage(1);
      setTermErrors({});
      setBorrowerContext(emptyBorrowerContext);
      setBorrowerContextPromptSeen(false);
      setBorrowerProfileName(user.displayName ?? user.username ?? '');
      setBorrowerProfileError('');
      setShowBorrowerAvatarModal(false);
      setReferralCode('');
      setAppliedReferral(null);
      setReferralCodeError('');
      setIsApplyingReferralCode(false);
      onReferralApplied?.(null);
   }, [
      canUseReferralBoost,
      isOpen,
      isVerified,
      onReferralApplied,
      startOnBorrowerContextStep,
      startOnReferralStep,
      user.displayName,
      user.username
   ]);

   useEffect(() => {
      if (!isOpen || shouldShowReferralStep) return;

      window.requestAnimationFrame(() => {
         if (!formRef.current) return;

         formRef.current.scrollTop = 0;
      });
   }, [isOpen, shouldShowReferralStep, showVerify]);

   // Lock the page behind the modal while it's open. Without this, over-scrolling inside the
   // modal chains through to the Request Board underneath (it scrolls instead of the card).
   // Paired with `overscroll-contain` on the modal's own scroll areas below.
   useEffect(() => {
      if (!isOpen) return undefined;

      const previousOverflow = document.body.style.overflow;
      document.body.style.overflow = 'hidden';
      return () => {
         document.body.style.overflow = previousOverflow;
      };
   }, [isOpen]);

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

   // Escape closes the modal — standard keyboard affordance. An open calendar closes first;
   // an open tooltip is handled by the effect above, so we defer to it that press.
   useEffect(() => {
      if (!isOpen) return undefined;
      const onKeyDown = (event: globalThis.KeyboardEvent) => {
         if (event.key !== 'Escape') return;
         if (isCalendarOpen) {
            setIsCalendarOpen(false);
            return;
         }
         if (activeTooltip) return;
         onClose();
      };
      document.addEventListener('keydown', onKeyDown);
      return () => document.removeEventListener('keydown', onKeyDown);
   }, [isOpen, isCalendarOpen, activeTooltip, onClose]);

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

   // Clear the date error as soon as a valid repayment date is entered (typed or picked).
   useEffect(() => {
      if (isRepaymentDateFilled) setTermErrors((prev) => (prev.date ? { ...prev, date: undefined } : prev));
   }, [isRepaymentDateFilled]);

   // The low-effort reason check (DeepSeek) runs at final submit — which happens from the bio
   // step — but its warning renders under the reason field on the terms step. If we're on the
   // bio step when it fires, bounce back to terms once so the borrower actually sees it (and the
   // "Ask Mecha to word this" link), instead of a silent no-op. Once-only, so tapping submit a
   // second time to post anyway still works; resets when the reason is edited (warning clears).
   const bouncedForReasonWarningRef = useRef(false);
   useEffect(() => {
      if (!reasonWarning) {
         bouncedForReasonWarningRef.current = false;
         return;
      }
      if (showBorrowerContextStep && !bouncedForReasonWarningRef.current) {
         bouncedForReasonWarningRef.current = true;
         setShowBorrowerContextStep(false);
      }
   }, [reasonWarning, showBorrowerContextStep]);

   const formatReferralBoost = (boostAmount: number) => {
      const amount = Number(boostAmount);
      return Number.isInteger(amount) ? amount.toFixed(0) : amount.toFixed(2);
   };

   const handleReferralCodeChange = (value: string) => {
      setReferralCode(value);
      setReferralCodeError('');

      if (appliedReferral && value.trim().toUpperCase() !== appliedReferral.code) {
         setAppliedReferral(null);
         onReferralApplied?.(null);
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
               onReferralApplied?.(null);
               setReferralCodeError('Referral code incorrect. If you have issues, contact support.');
               return false;
            }

            setAppliedReferral(testReferral);
            onReferralApplied?.(testReferral);
            setReferralCodeError('');
            return true;
         }

         const supabase = getSupabaseBrowserClient();
         const { data, error } = await supabase.rpc('redeem_referral_code', { code_input: cleanCode }).single();

         if (error) throw error;

         if (!data) {
            setAppliedReferral(null);
            onReferralApplied?.(null);
            setReferralCodeError('Referral code incorrect. If you have issues, contact support.');
            return false;
         }

         const nextReferral = {
            id: data.id,
            code: data.code,
            boostAmount: Number(data.boost_amount)
         };

         setReferralCode(nextReferral.code);
         setAppliedReferral(nextReferral);
         onReferralApplied?.(nextReferral);
         setReferralCodeError('');
         await onReferralRedeemed?.();
         return true;
      } catch (error) {
         console.error('Error validating referral code:', (error as Error).message || error);
         setAppliedReferral(null);
         onReferralApplied?.(null);
         const message = (error as Error).message || '';
         setReferralCodeError(message.includes('Referral code') ? message : "We couldn't check that code. Please try again.");
         return false;
      } finally {
         setIsApplyingReferralCode(false);
      }
   };

   const handleReferralPrimaryAction = async () => {
      if (!hasReferralCode || hasAppliedReferralCode) {
         setShowReferralStep(false);
         return;
      }

      await applyReferralCode();
   };

   const recordBorrowerProfileMilestone = async (milestoneId: 'profile-name-added' | 'profile-image-added') => {
      if (isPreviewUser || !user.id) return;

      try {
         const supabase = getSupabaseBrowserClient();
         const { error } = await supabase.rpc('record_milestone_completion', {
            user_id_input: user.id,
            milestone_id_input: milestoneId,
            metadata_input: {
               source: 'loan_request_profile_step'
            }
         });

         if (error && !isIgnorableMilestoneError(error)) {
            console.error(`Failed to record ${milestoneId} milestone:`, error.message);
         }
      } catch (error) {
         console.error(`Failed to record ${milestoneId} milestone:`, error);
      }
   };

   const saveBorrowerProfile = async () => {
      const trimmedProfileName = borrowerProfileName.trim();
      if (!trimmedProfileName || isPreviewUser) return true;
      if (trimmedProfileName === currentBorrowerDisplayName) {
         await recordBorrowerProfileMilestone('profile-name-added');
         return true;
      }

      setIsSavingBorrowerProfile(true);
      setBorrowerProfileError('');
      try {
         const result = await dispatch(updateUser({ displayName: trimmedProfileName }));
         if (updateUser.fulfilled.match(result)) {
            await recordBorrowerProfileMilestone('profile-name-added');
            return true;
         }

         throw new Error(result.error?.message || 'Failed to save profile name.');
      } catch (error) {
         setBorrowerProfileError(error instanceof Error ? error.message : 'Failed to save profile name.');
         return false;
      } finally {
         setIsSavingBorrowerProfile(false);
      }
   };

   const handleBorrowerAvatarSave = async (file: File, avatarBackground: string) => {
      setIsSavingBorrowerAvatar(true);
      setBorrowerProfileError('');
      try {
         if (isPreviewUser) {
            setShowBorrowerAvatarModal(false);
            return;
         }

         const avatarUrl = await uploadAvatarForCurrentUser(file);
         const result = await dispatch(updateUser({ avatarUrl, avatarBackground }));
         if (updateUser.fulfilled.match(result)) {
            await recordBorrowerProfileMilestone('profile-image-added');
            setShowBorrowerAvatarModal(false);
            return;
         }

         throw new Error(result.error?.message || 'Failed to update profile image.');
      } finally {
         setIsSavingBorrowerAvatar(false);
      }
   };

   // Inline validation of the terms fields (amount, repayment, date, reason). Runs on the
   // terms step before the borrower can advance to the bio step or submit — so a missing
   // reason (the #1 confusion) is caught right here, under the field, not via a toast that
   // hides behind the next card.
   const REASON_MIN_LENGTH = 40;
   // Per-field "valid" flags — drive the green success border so each box confirms when it's
   // correctly filled (feedback the borrower can see), separate from the red error state.
   const parsedAmountNum = Number(loanAmount);
   const parsedRepayNum = Number(totalRepaymentAmount);
   const amountValid = Boolean(loanAmount) && !Number.isNaN(parsedAmountNum) && parsedAmountNum > 0 && parsedAmountNum <= limitAmount;
   const repaymentValid =
      Boolean(totalRepaymentAmount) &&
      !Number.isNaN(parsedRepayNum) &&
      !Number.isNaN(parsedAmountNum) &&
      parsedRepayNum >= parsedAmountNum + 1;
   // Length is necessary but not sufficient: 46 characters of "dwadwadwad" used to earn a
   // green "Looks good". The shape check keeps the field honest — it withholds the tick (and
   // says what's missing) without blocking, since the DeepSeek check on submit is the real gate.
   const reasonMeetsLength = reason.trim().length >= REASON_MIN_LENGTH;
   const reasonQuality = checkReasonQuality(reason);
   const reasonValid = reasonMeetsLength && reasonQuality.ok;
   const validateTerms = (): boolean => {
      const errors: typeof termErrors = {};

      const amount = Number(loanAmount);
      if (!loanAmount || Number.isNaN(amount) || amount <= 0) {
         errors.amount = 'Enter how much you want to borrow.';
      } else if (amount > limitAmount) {
         errors.amount = `That's above your current limit of $${limitAmount}.`;
      }

      const repayment = Number(totalRepaymentAmount);
      if (!totalRepaymentAmount || Number.isNaN(repayment)) {
         errors.repayment = 'Enter the amount you will repay.';
      } else if (!Number.isNaN(amount) && repayment < amount + 1) {
         errors.repayment = 'Repayment must be at least $1 more than you borrow.';
      }

      if (!isRepaymentDateFilled) {
         errors.date = 'Choose when you will repay.';
      }

      const trimmedReason = reason.trim();
      if (!trimmedReason) {
         errors.reason = 'Please add a reason so lenders know what the loan is for.';
      } else if (trimmedReason.length < REASON_MIN_LENGTH) {
         errors.reason = `Please add a little more — at least ${REASON_MIN_LENGTH} characters (${trimmedReason.length}/${REASON_MIN_LENGTH}).`;
      }

      setTermErrors(errors);

      // Make sure the first problem is actually seen: if the borrower tapped submit from the
      // bottom of the form, scroll the first invalid field into view (the error is inline, not
      // a toast, so it must be on-screen to help).
      const firstInvalidId = (['amount', 'repayment', 'date', 'reason'] as const)
         .filter((key) => errors[key])
         .map((key) => ({ amount: 'borrow-amount', repayment: 'repayment-amount', date: 'repaymentDate', reason: 'reason' })[key])[0];
      if (firstInvalidId) {
         window.requestAnimationFrame(() => {
            document.getElementById(firstInvalidId)?.scrollIntoView({ behavior: 'smooth', block: 'center' });
         });
      }

      return Object.keys(errors).length === 0;
   };

   const handleLoanFormSubmit = (event: FormEvent<HTMLFormElement>) => {
      if (isSubmitting) {
         event.preventDefault();
         return;
      }

      // The submit button stays tappable while unverified on purpose: a dead grey button
      // teaches nothing. Answer the tap — shake the button, pulse the note right above it
      // that says why, and bring both on screen. Deliberately no toast: it lands bottom-right,
      // straight on top of the "Verify Yourself" button we're sending them to.
      if (!isVerified) {
         event.preventDefault();
         setVerifyNudge(true);
         window.setTimeout(() => setVerifyNudge(false), 1200);
         document.getElementById('loan-verify-blocker')?.scrollIntoView({ behavior: 'smooth', block: 'center' });
         return;
      }

      // On the terms step, validate its own fields inline before going anywhere. Skipped once
      // we're on the bio step (terms were already validated to get there).
      if (!showBorrowerContextStep && !validateTerms()) {
         event.preventDefault();
         return;
      }

      // Borrowers who already saved their bio context (income/payday/etc.) shouldn't be
      // re-prompted on every loan request — that data lives on their profile and persists.
      // Returning users can update it from Account Settings instead.
      const hasSavedBorrowerContext = Boolean(user.incomeType);

      if (requireBorrowerContextStep && !hasSavedBorrowerContext && !borrowerContextPromptSeen && !showBorrowerContextStep) {
         event.preventDefault();
         setShowBorrowerContextStep(true);
         setBioPage(1);
         return;
      }

      handleSubmit(event, showBorrowerContextStep ? borrowerContext : undefined);
   };

   // Synchronous guard — prevents double-tap on "Save bio info" from firing twice
   // before isSavingProfile state has a chance to re-render and disable the button.
   const isBioSubmittingRef = useRef(false);
   const [isCheckingBio, setIsCheckingBio] = useState(false);
   // Tracks the exact profession+situation text we've already warned about, so a second
   // tap of the same input goes through (a nudge to clarify, not a hard block).
   const bioInputWarnedRef = useRef<string>('');

   // Runs the shared low-effort check on a single bio free-text field. Fails open so a
   // slow/unavailable check never traps a borrower mid-request.
   const checkBioInput = async (text: string, kind: 'profession' | 'situation'): Promise<{ ok: boolean; hint: string }> => {
      try {
         const { data } = await getSupabaseBrowserClient().functions.invoke('check-loan-input', {
            body: { text, kind }
         });
         return { ok: data?.ok !== false, hint: data?.hint ?? '' };
      } catch (error) {
         console.error('check-loan-input (bio) failed, allowing:', error);
         return { ok: true, hint: '' };
      }
   };

   // Low-effort gate on the borrower's free-text bio input (profession + "describe your
   // situation") — the "CSR"/"nothing" case. Both fields live on bio page 1, so this runs on
   // page 1's Continue (not the final submit) — the borrower sees it where the field is.
   // Same soft nudge as the loan reason: warn once, then let a second tap of the same text through.
   // Returns true = ok to proceed, false = we warned (stop here).
   const runBioInputLowEffortCheck = async (): Promise<boolean> => {
      const professionText = borrowerContext.profession?.trim() ?? '';
      const situationText = borrowerContext.incomeDescription?.trim() ?? '';
      const bioSignature = `${professionText}||${situationText}`;
      if (bioInputWarnedRef.current === bioSignature) return true;

      setIsCheckingBio(true);
      let hint = '';
      try {
         if (professionText) {
            const r = await checkBioInput(professionText, 'profession');
            if (!r.ok) hint = r.hint;
         }
         if (!hint && situationText) {
            const r = await checkBioInput(situationText, 'situation');
            if (!r.ok) hint = r.hint;
         }
      } finally {
         setIsCheckingBio(false);
      }

      if (hint) {
         bioInputWarnedRef.current = bioSignature;
         showToast(
            TOAST_TYPES.WARNING,
            'Add more to your info',
            hint || 'Some of your info looks too short for lenders to understand — tap again to continue anyway.',
            'OK',
            'acknowledge'
         );
         return false;
      }
      return true;
   };

   const handleBioPage1Continue = async () => {
      if (!borrowerContext.incomeSetup) return;
      if (isBioSubmittingRef.current) return;
      isBioSubmittingRef.current = true;
      try {
         if (await runBioInputLowEffortCheck()) setBioPage(2);
      } finally {
         isBioSubmittingRef.current = false;
      }
   };

   const handleBorrowerContextContinue = async () => {
      if (!canContinueBorrowerContext) return;
      if (isBioSubmittingRef.current) return;
      isBioSubmittingRef.current = true;

      try {
         const isProfileSaved = await saveBorrowerProfile();
         if (!isProfileSaved) return;

         setBorrowerContextPromptSeen(true);
         // Call handleLoanFormSubmit directly — requestSubmit() silently fails on older iOS Safari
         handleLoanFormSubmit({ preventDefault: () => {} } as React.FormEvent<HTMLFormElement>);
      } finally {
         isBioSubmittingRef.current = false;
      }
   };

   const handleBorrowerContextBack = () => {
      // From bio page 2, Back returns to page 1; from page 1, Back returns to the terms step.
      if (bioPage === 2) {
         setBioPage(1);
         return;
      }
      setShowBorrowerContextStep(false);
   };

   const handleCashGapToggle = (value: string) => {
      setBorrowerContext((current) => {
         const hasValue = current.cashGaps.includes(value);
         return {
            ...current,
            cashGaps: hasValue ? current.cashGaps.filter((gap) => gap !== value) : [...current.cashGaps, value]
         };
      });
   };

   if (!isOpen) return null;

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
         (gesture.mode === 'down' && dismissOffsetRef.current.y > 88) || (gesture.mode === 'side' && dismissOffsetRef.current.x > 76);
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
      <div className="fixed inset-0 z-[70] flex items-end justify-center overflow-hidden overscroll-contain bg-[#1f1b29]/32 sm:items-center sm:px-5 sm:py-6">
         <section
            ref={clickOutsideRef}
            className="relative mx-auto flex max-h-[94dvh] w-full max-w-[440px] flex-col overflow-hidden rounded-t-[28px] border border-[#e7e0ec] bg-[#fdfcfd] shadow-[0_24px_80px_rgba(44,19,82,0.18)] transition-transform duration-150 ease-out sm:max-h-[calc(100dvh-48px)] sm:rounded-[24px]"
            style={{ transform: `translate(${dismissOffset.x}px, ${dismissOffset.y}px)` }}
         >
            {!shouldShowReferralStep ? (
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
            <div className="pointer-events-none absolute left-1/2 top-2 z-20 h-1 w-11 -translate-x-1/2 rounded-full bg-[#cec6d7] sm:hidden" />
            <header
               className="flex touch-none cursor-grab select-none items-center justify-between border-b border-[#e7e0ec] px-5 pb-4 pt-6 active:cursor-grabbing sm:pt-4"
               onPointerDown={(event) => startDismissGesture(event, 'down')}
               onPointerMove={moveDismissGesture}
               onPointerUp={endDismissGesture}
               onPointerCancel={endDismissGesture}
            >
               <div className="flex min-w-0 items-center gap-md-1 pr-3">
                  {shouldShowReferralStep ? (
                     <h2 className="text-md-h6 text-md-heading">Referral Boost</h2>
                  ) : showBorrowerContextStep ? (
                     <div className="min-w-0">
                        <h2 className="text-[22px] font-[590] leading-[26px] tracking-[-0.44px] text-md-heading">How lenders see you</h2>
                        <p className="mt-1 text-[13px] font-normal leading-[18px] text-md-neutral-1200">
                           Add practical context without sharing private details.
                        </p>
                     </div>
                  ) : (
                     <>
                        <h2 className="text-[22px] font-[590] leading-[26px] tracking-[-0.44px] text-md-heading">Set your loan terms</h2>
                        <InfoTooltip
                           activeTooltip={activeTooltip}
                           arrowClassName="right-[42px] top-[-5px] rotate-45"
                           iconClassName="h-[18px] w-[18px]"
                           iconSrc={termsTooltipIconSrc}
                           id="terms"
                           label="Explain setting loan terms"
                           panelClassName="right-[-40px] top-full mt-md-1"
                           setActiveTooltip={setActiveTooltip}
                        />
                     </>
                  )}
               </div>
               <button
                  aria-label="Close loan form"
                  onClick={(event) => {
                     event.stopPropagation();
                     onClose();
                  }}
                  onPointerDown={(event) => event.stopPropagation()}
                  className="flex size-10 shrink-0 items-center justify-center rounded-full text-md-neutral-1200 transition duration-150 ease-out hover:bg-md-primary-100 hover:text-md-primary-1200 active:scale-95 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-md-primary-900 focus-visible:ring-offset-2 dark:text-[#f8f4ff] dark:hover:bg-[#2a2235] dark:hover:text-white dark:focus-visible:ring-offset-[#1b1525]"
                  type="button"
               >
                  <X aria-hidden="true" className="h-6 w-6" strokeWidth={2} />
               </button>
            </header>

            {shouldShowReferralStep ? (
               <div
                  className="flex min-h-0 touch-pan-y flex-col gap-md-2 overflow-y-auto overscroll-contain p-md-2 text-md-b2 text-md-heading"
                  onPointerDown={(event) => startDismissGesture(event, 'referral')}
                  onPointerMove={moveDismissGesture}
                  onPointerUp={endDismissGesture}
                  onPointerCancel={endDismissGesture}
               >
                  <div className="flex items-start gap-md-2 rounded-md-lg border border-md-neutral-400 bg-[#faf7ff] p-md-2">
                     <div className="flex min-w-0 flex-1 flex-col gap-md-1">
                        <span className="w-fit rounded-full bg-md-primary-100 px-md-2 py-md-0 text-md-b3 font-normal text-md-primary-900">
                           Optional
                        </span>
                        <div>
                           <h3 className="text-md-h6 font-medium leading-[26px] text-md-heading">Have a referral code?</h3>
                           <p className="mt-md-0 text-md-b3 font-normal leading-[20px] text-md-neutral-1200">
                              Add it now for a higher starting limit.
                           </p>
                        </div>
                     </div>
                     <img
                        alt=""
                        aria-hidden="true"
                        className="-my-md-1 h-[112px] w-[112px] shrink-0 self-center object-contain"
                        src="/hippos/referral-boost.png"
                     />
                  </div>

                  <div className="inline-flex w-fit items-center gap-md-1 rounded-full bg-[#d7f5df] px-md-2 py-md-0 text-md-b3 font-medium text-[#178447]">
                     <CheckCircle aria-hidden="true" className="h-4 w-4" strokeWidth={2} />
                     <span>+$5 Credit Limit Boost</span>
                  </div>

                  <label className="sr-only" htmlFor="referral-code">
                     Referral code
                  </label>
                  <div
                     className={`flex items-center gap-md-2 rounded-md-input border border-solid bg-md-neutral-100 px-md-3 py-md-1 shadow-md-card transition duration-150 ease-out focus-within:ring-2 ${
                        hasReferralCodeError
                           ? 'border-md-red-500 focus-within:ring-md-red-100'
                           : hasAppliedReferralCode
                             ? 'border-[#178447] focus-within:ring-[#d7f5df]'
                             : 'border-md-neutral-600 focus-within:border-md-primary-900 focus-within:ring-md-primary-100'
                     }`}
                  >
                     <Ticket
                        aria-hidden="true"
                        className={`h-6 w-6 shrink-0 ${hasReferralCodeError ? 'text-md-red-500' : 'text-md-primary-900'}`}
                        strokeWidth={1.7}
                     />
                     <input
                        className="min-w-0 flex-1 bg-transparent text-md-b1 font-normal text-md-heading placeholder:text-md-neutral-1200 focus:outline-none"
                        id="referral-code"
                        onChange={(event: ChangeEvent<HTMLInputElement>) => handleReferralCodeChange(event.target.value)}
                        placeholder="Enter code"
                        type="text"
                        value={referralCode}
                     />
                  </div>

                  {hasReferralCodeError ? (
                     <div className="rounded-md-md bg-md-red-100 px-md-2 py-md-1 text-md-b3 font-normal text-md-red-500">
                        {referralCodeError}
                     </div>
                  ) : hasAppliedReferralCode ? (
                     <div className="flex items-center gap-md-1 rounded-md-md bg-[#eefbf2] px-md-2 py-md-1 text-md-b3 font-normal text-[#178447]">
                        <CheckCircle aria-hidden="true" className="h-4 w-4" strokeWidth={2} />
                        <span>
                           Code {appliedReferral.code} applied: +${formatReferralBoost(appliedReferral.boostAmount)} starting limit
                        </span>
                     </div>
                  ) : null}

                  <button
                     className="w-full rounded-md-lg bg-md-primary-1200 px-md-4 py-md-2 text-md-b1 font-medium text-md-neutral-100 transition duration-150 ease-out hover:bg-[#5200c8] active:scale-[0.98] disabled:cursor-not-allowed disabled:bg-md-neutral-600 disabled:opacity-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-md-primary-900 focus-visible:ring-offset-2"
                     disabled={isApplyingReferralCode}
                     onClick={handleReferralPrimaryAction}
                     type="button"
                  >
                     {isApplyingReferralCode ? 'Checking code...' : referralPrimaryActionText}
                  </button>

                  <p className="text-center text-md-b3 font-normal text-md-neutral-1200">No code needed. You can continue normally.</p>
               </div>
            ) : (
               <form
                  ref={formRef}
                  onSubmit={handleLoanFormSubmit}
                  className="flex min-h-0 flex-col gap-5 overflow-y-auto overscroll-contain px-5 py-5 text-md-b2 text-md-heading"
               >
                  {showBorrowerContextStep ? (
                     <BorrowerContextLoanStep
                        page={bioPage}
                        context={borrowerContext}
                        currentAvatarBackground={user.avatarBackground}
                        currentAvatarUrl={user.avatarUrl}
                        isSubmitting={isSubmitting}
                        isSavingProfile={isSavingBorrowerProfile || isCheckingBio}
                        monthlyIncome={borrowerContext.monthlyIncome ?? ''}
                        monthlyExpenses={borrowerContext.monthlyExpenses ?? ''}
                        onBack={handleBorrowerContextBack}
                        onNextPage={handleBioPage1Continue}
                        onCashGapToggle={handleCashGapToggle}
                        onContinue={handleBorrowerContextContinue}
                        onIncomeSelect={(value) =>
                           setBorrowerContext((current) => ({
                              ...current,
                              incomeSetup: value,
                              // Drop the free-text explanation if they move off "Something else".
                              incomeDescription: value === 'contract' ? current.incomeDescription : ''
                           }))
                        }
                        onMonthlyIncomeSelect={(v) => setBorrowerContext((prev) => ({ ...prev, monthlyIncome: v }))}
                        onMonthlyExpensesSelect={(v) => setBorrowerContext((prev) => ({ ...prev, monthlyExpenses: v }))}
                        onOtherIncomeChange={(v) => setBorrowerContext((prev) => ({ ...prev, otherIncome: v }))}
                        onProfessionChange={(v) => setBorrowerContext((prev) => ({ ...prev, profession: v }))}
                        onIncomeDescriptionChange={(v) => setBorrowerContext((prev) => ({ ...prev, incomeDescription: v }))}
                        onPaydaySelect={(value) => setBorrowerContext((current) => ({ ...current, paydayWindow: value }))}
                        onProfileImageClick={() => setShowBorrowerAvatarModal(true)}
                        onProfileNameChange={(value) => {
                           setBorrowerProfileName(value);
                           setBorrowerProfileError('');
                        }}
                        profileName={borrowerProfileName}
                        profileSaveError={borrowerProfileError}
                     />
                  ) : (
                     <>
                        {showVerify ? (
                           <div
                              className="flex items-center gap-md-2 overflow-hidden rounded-md-lg border border-md-neutral-400 bg-[#fff6d0] px-md-3 py-md-2"
                              data-tour-target="loan-verification-card"
                           >
                              <div className="flex min-w-0 max-w-[220px] flex-1 flex-col gap-md-1">
                                 <div className="flex flex-col gap-md-0">
                                    <p className="whitespace-nowrap text-md-b2 font-medium text-md-primary-2000">
                                       {isPending ? verifyPendingTitle : 'One quick step to request a loan'}
                                    </p>
                                    <p className="text-md-b3 font-normal text-md-neutral-1400">
                                       {isPending
                                          ? verifyPendingBody
                                          : 'Complete a one-time verification to start building trust with lenders.'}
                                    </p>
                                 </div>
                                 <button
                                    onClick={isPending ? () => navigate('/verify') : openVerify}
                                    className="w-fit rounded-[12px] bg-md-primary-1200 px-md-2 py-md-1 text-md-b2 font-semibold text-md-neutral-100 transition duration-150 ease-out hover:bg-[#5200c8] active:scale-[0.97] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-md-primary-900 focus-visible:ring-offset-2"
                                    type="button"
                                 >
                                    {isPending ? verifyPendingCta : 'Verify Yourself'}
                                 </button>
                              </div>
                              <img
                                 alt=""
                                 aria-hidden="true"
                                 className="h-[86px] w-[96px] shrink-0 object-contain"
                                 src="/hippos/welcome.png"
                              />
                           </div>
                        ) : null}
                        {!isPending && verifyModal}

                        <div className="flex flex-col gap-md-1" data-tour-target="loan-borrow-amount">
                           <div className="flex items-center justify-between gap-md-2">
                              <label className="text-md-b2 font-[590] text-md-heading" htmlFor="borrow-amount">
                                 Borrow Amount
                              </label>
                              <div className="flex items-center gap-md-0 rounded-md-md bg-md-primary-100 px-md-1 py-md-0 text-md-b3 font-normal text-[#3e0a88] dark:border dark:border-[#7c4ed8]/40 dark:bg-[#2a1740] dark:text-[#f8f4ff]">
                                 <span>Current Limit: ${limitAmount || '0'}</span>
                                 <InfoTooltip
                                    activeTooltip={activeTooltip}
                                    arrowClassName="left-1/2 top-[-5px] -translate-x-1/2 rotate-45"
                                    iconClassName="h-4 w-4"
                                    id="limit"
                                    label="Explain current borrow limit"
                                    panelClassName="right-0 top-full mt-md-1"
                                    setActiveTooltip={setActiveTooltip}
                                 />
                              </div>
                           </div>
                           <div
                              className={`flex items-center ${inputShellClass} ${termErrors.amount ? '!border-md-red-500' : amountValid ? '!border-md-primary-900' : ''}`}
                           >
                              <span
                                 aria-hidden="true"
                                 className="flex min-w-[112px] items-center justify-center gap-md-1 self-stretch border-r border-md-neutral-600 bg-[#2775ca] px-md-3 py-md-2 text-md-b1 font-normal text-md-neutral-100"
                              >
                                 <UsdcIcon />
                                 USDC
                              </span>
                              <input
                                 onChange={(e: ChangeEvent<HTMLInputElement>) => {
                                    setLoanAmount(e.target.value);
                                    if (termErrors.amount) setTermErrors((prev) => ({ ...prev, amount: undefined }));
                                 }}
                                 onFocus={scrollFieldIntoView}
                                 className="min-w-0 flex-1 bg-transparent px-md-3 py-md-2 text-md-b1 font-normal text-md-heading placeholder:text-md-neutral-1200 focus:outline-none"
                                 id="borrow-amount"
                                 inputMode="decimal"
                                 placeholder="Set your desired amount"
                                 type="text"
                                 value={loanAmount}
                              />
                           </div>
                           {termErrors.amount ? <FieldError message={termErrors.amount} /> : null}
                           <div className="flex justify-end gap-md-1 text-md-b3 font-normal text-md-neutral-1200">
                              <InfoTooltip
                                 activeTooltip={activeTooltip}
                                 iconClassName="h-4 w-4"
                                 iconStrokeWidth={1.35}
                                 id="usdc"
                                 label="Explain USDC loans"
                                 panelClassName="left-1/2 top-full mt-md-1 -translate-x-1/2"
                                 setActiveTooltip={setActiveTooltip}
                              />
                              <span>All loans are issued and repaid in USDC.</span>
                           </div>
                        </div>

                        <div className="flex flex-col gap-md-1" data-tour-target="loan-repayment-amount">
                           <label className="text-md-b2 font-[590] text-md-heading" htmlFor="repayment-amount">
                              Set Repayment Amount
                           </label>
                           <input
                              onChange={(e: ChangeEvent<HTMLInputElement>) => {
                                 setTotalRepaymentAmount(e.target.value);
                                 if (termErrors.repayment) setTermErrors((prev) => ({ ...prev, repayment: undefined }));
                              }}
                              onFocus={scrollFieldIntoView}
                              className={`${inputShellClass} px-md-3 py-md-2 text-md-b1 font-normal text-md-heading placeholder:text-md-neutral-1200 focus:outline-none ${
                                 termErrors.repayment ? '!border-md-red-500' : repaymentValid ? '!border-md-primary-900' : ''
                              }`}
                              id="repayment-amount"
                              inputMode="decimal"
                              placeholder="Must be more than the borrowed amount"
                              type="text"
                              value={totalRepaymentAmount}
                           />
                           {termErrors.repayment ? <FieldError message={termErrors.repayment} /> : null}
                           {(() => {
                              // Live clarity: once both amounts are valid, spell out what the borrower will
                              // repay and how much of that is the lender's return — Moodeng adds $0, so this
                              // makes the deal transparent while they set their own terms.
                              const borrowNum = Number(loanAmount);
                              const repayNum = Number(totalRepaymentAmount);
                              const extra = repayNum - borrowNum;
                              if (termErrors.repayment || !loanAmount || !totalRepaymentAmount) return null;
                              if (Number.isNaN(borrowNum) || Number.isNaN(repayNum) || borrowNum <= 0 || extra <= 0) return null;
                              const fmt = (n: number) => (Number.isInteger(n) ? String(n) : n.toFixed(2));
                              return (
                                 <p className="text-md-b3 font-normal leading-[18px] text-md-neutral-1200">
                                    You’ll repay <span className="font-semibold text-md-heading">${fmt(repayNum)}</span> — that’s{' '}
                                    <span className="font-semibold text-md-primary-1200">${fmt(extra)}</span> to your lender.
                                 </p>
                              );
                           })()}
                           {(() => {
                              const borrowNum = Number(loanAmount);
                              const repayNum = Number(totalRepaymentAmount);
                              const range = suggestedReturnRange(borrowNum);
                              const offer = repayNum - borrowNum;
                              // Only when the repayment is otherwise valid (passes the $1 minimum, so
                              // no error is showing) but still below the typical return for this size.
                              const show =
                                 !termErrors.repayment &&
                                 Boolean(totalRepaymentAmount) &&
                                 Number.isFinite(borrowNum) &&
                                 borrowNum > 0 &&
                                 Number.isFinite(repayNum) &&
                                 offer >= 1 &&
                                 range !== null &&
                                 offer < range.lo;
                              return show && range ? <ReturnHint lo={range.lo} hi={range.hi} /> : null;
                           })()}
                        </div>

                        <div className="flex flex-col gap-md-1" data-tour-target="loan-repayment-date">
                           <label className="text-md-b2 font-[590] text-md-heading" htmlFor="repaymentDate">
                              Set Repayment Date
                           </label>
                           <div className="relative">
                              <div
                                 className={`relative flex items-center ${inputShellClass} ${termErrors.date ? '!border-md-red-500' : isRepaymentDateFilled ? '!border-md-primary-900' : ''}`}
                              >
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
                                    aria-expanded={isCalendarOpen}
                                    aria-label="Open repayment date calendar"
                                    className={`absolute inset-y-0 right-0 flex w-[56px] items-center justify-center border-l border-md-primary-1200 transition duration-150 ease-out active:bg-[#4b00b8] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-md-primary-900 focus-visible:ring-offset-2 ${
                                       isCalendarOpen || isRepaymentDateFilled
                                          ? 'bg-md-primary-1200 text-md-neutral-100 hover:bg-[#5200c8]'
                                          : 'bg-md-neutral-100 text-md-primary-900 hover:bg-md-primary-100'
                                    }`}
                                    onClick={() => setIsCalendarOpen((isOpen) => !isOpen)}
                                    type="button"
                                 >
                                    <CalendarDays aria-hidden="true" className="h-6 w-6" strokeWidth={1.6} />
                                 </button>
                              </div>
                           </div>
                           {termErrors.date ? <FieldError message={termErrors.date} /> : null}
                           {/* Quick-pick common short terms — typing DD/MM on mobile is the fiddliest field.
                               Each fills a valid future date via the same handler the calendar uses. */}
                           <div className="mt-md-0 flex flex-wrap gap-md-1">
                              {[
                                 { label: '4 weeks', days: 28 },
                                 { label: '1 month', days: 30 },
                                 { label: '2 months', days: 60 }
                              ].map(({ label, days: offset }) => {
                                 const date = addDays(todayDate, offset);
                                 const isActive = selectedDate === formatDateInputValue(date);
                                 return (
                                    <button
                                       key={label}
                                       type="button"
                                       aria-pressed={isActive}
                                       onClick={() => selectCalendarDate(date)}
                                       className={`inline-flex min-h-[32px] items-center justify-center rounded-md-pill border px-md-2 py-[5px] text-md-b3 font-medium leading-[18px] transition active:scale-[0.98] focus:outline-none focus-visible:ring-2 focus-visible:ring-md-primary-900 focus-visible:ring-offset-1 ${
                                          isActive
                                             ? 'border-md-primary-900 bg-md-primary-100 text-md-primary-1200 shadow-[0_5px_12px_rgba(105,48,232,0.08)]'
                                             : 'border-md-neutral-700 bg-md-neutral-100 text-md-neutral-1400'
                                       }`}
                                    >
                                       {label}
                                    </button>
                                 );
                              })}
                           </div>
                        </div>

                        <div className="flex flex-col gap-md-1" data-tour-target="loan-reason">
                           <label className="text-md-b2 font-[590] text-md-heading" htmlFor="reason">
                              Reason for Borrowing
                           </label>
                           <div
                              className={`${inputShellClass} flex flex-col px-md-3 py-md-2 ${termErrors.reason ? '!border-md-red-500' : reasonValid ? '!border-md-primary-900' : ''}`}
                           >
                              <textarea
                                 ref={reasonTextareaRef}
                                 maxLength={200}
                                 onChange={(e: ChangeEvent<HTMLTextAreaElement>) => {
                                    setReason(e.target.value);
                                    resizeReasonTextarea(e.target);
                                    if (termErrors.reason) setTermErrors((prev) => ({ ...prev, reason: undefined }));
                                 }}
                                 onFocus={scrollFieldIntoView}
                                 className="min-h-[48px] resize-none overflow-hidden bg-transparent text-md-b1 font-normal text-md-heading placeholder:text-md-neutral-1200 focus:outline-none"
                                 id="reason"
                                 placeholder="Why do you need this loan?"
                                 rows={1}
                                 value={reason}
                              />
                              <div className="mt-md-2 flex items-start justify-between gap-md-2 text-md-b3 font-normal leading-[18px] text-md-neutral-1200 select-none">
                                 {(() => {
                                    const trimmedLength = reason.trim().length;
                                    const remaining = REASON_MIN_LENGTH - trimmedLength;
                                    // Guide live: while short, show how many more characters are needed; once the
                                    // minimum is met, confirm it — so they learn before submitting, not after.
                                    if (trimmedLength > 0 && remaining > 0) {
                                       return (
                                          <span className="font-medium text-md-primary-1200">
                                             {remaining} more character{remaining === 1 ? '' : 's'} to go
                                          </span>
                                       );
                                    }
                                    if (trimmedLength >= REASON_MIN_LENGTH) {
                                       if (!reasonQuality.ok) {
                                          return (
                                             <span className="inline-flex items-start gap-1.5 font-medium text-[#92400e]">
                                                <TriangleAlert className="mt-[1px] size-4 shrink-0" strokeWidth={2} aria-hidden="true" />
                                                {reasonQuality.hint}
                                             </span>
                                          );
                                       }
                                       return (
                                          <span className="inline-flex items-center gap-1 font-medium text-md-primary-1200">
                                             <Check className="size-4 shrink-0" strokeWidth={2.6} aria-hidden="true" />
                                             Looks good
                                          </span>
                                       );
                                    }
                                    return <span>At least 40 characters — short and specific helps lenders trust it.</span>;
                                 })()}
                                 <span className="shrink-0">{reason.length}/200</span>
                              </div>
                              {termErrors.reason ? (
                                 <div
                                    role="alert"
                                    className="mt-md-1 flex items-start gap-1.5 text-md-b3 font-medium leading-[18px] text-md-red-500"
                                 >
                                    <TriangleAlert className="mt-[1px] size-4 shrink-0" strokeWidth={2} aria-hidden="true" />
                                    <span>{termErrors.reason}</span>
                                 </div>
                              ) : null}
                              {reasonWarning ? (
                                 <div className="mt-md-1 border-t border-[#f0c98a] pt-md-1">
                                    <div className="flex items-start gap-1.5 text-md-b3 font-medium leading-[18px] text-[#92400e]">
                                       <TriangleAlert className="mt-[1px] size-4 shrink-0" strokeWidth={2} aria-hidden="true" />
                                       <span>{reasonWarning}</span>
                                    </div>
                                    {/* Hand the borrower straight to Mecha to fix it — the effort check
                                        (check-loan-input) and Mecha share the same DeepSeek brain. */}
                                    <div className="mt-1.5 pl-[22px]">
                                       <AskMechaButton
                                          variant="link"
                                          label="Ask Mecha to help me word this"
                                          context={{ page: 'Loan request', step: 'loan-request' }}
                                          seedUserMessage={`I'm writing a loan request and my reason ("${reason}") was flagged as too vague. How do I write a clear reason that lenders will trust?`}
                                       />
                                    </div>
                                 </div>
                              ) : null}
                           </div>
                        </div>

                        {/* Unverified borrowers used to meet a grey button that did nothing when
                            tapped — the only explanation was the yellow card scrolled far above.
                            Say it here, where the tap happens, with the way out attached. */}
                        {!isVerified ? (
                           <div
                              className={`flex flex-col gap-md-1 rounded-md-lg border border-[#f0c98a] bg-[#fff6d0] px-md-3 py-md-2 ${
                                 verifyNudge ? 'blocked-tap-attention' : ''
                              }`}
                              id="loan-verify-blocker"
                           >
                              <div className="flex items-start gap-1.5 text-md-b3 font-medium leading-[18px] text-[#92400e]">
                                 <TriangleAlert className="mt-[1px] size-4 shrink-0" strokeWidth={2} aria-hidden="true" />
                                 <span>
                                    {isPending
                                       ? 'Your verification is still being checked — you can send this request once it clears.'
                                       : "You're not verified yet. Verification is the last step before you can send this request."}
                                 </span>
                              </div>
                              <button
                                 className="w-fit rounded-[12px] bg-md-primary-1200 px-md-2 py-md-1 text-md-b2 font-semibold text-md-neutral-100 transition duration-150 ease-out hover:bg-[#5200c8] active:scale-[0.97] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-md-primary-900 focus-visible:ring-offset-2"
                                 onClick={isPending ? () => navigate('/verify') : openVerify}
                                 type="button"
                              >
                                 {isPending ? verifyPendingCta : 'Verify Yourself'}
                              </button>
                           </div>
                        ) : null}
                        {/* Deliberately not aria-disabled: the button *does* act — it explains why it
                            can't submit yet. Point screen readers at that explanation instead. */}
                        <button
                           aria-describedby={isVerified ? undefined : 'loan-verify-blocker'}
                           className={`w-full rounded-md-lg px-md-4 py-md-3 text-md-b1 font-medium text-md-neutral-100 ${
                              isVerified && !isSubmitting
                                 ? 'bg-md-primary-1200 transition duration-150 ease-out hover:bg-[#5200c8] active:scale-[0.98] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-md-primary-900 focus-visible:ring-offset-2'
                                 : 'bg-md-neutral-600'
                           } ${verifyNudge ? 'blocked-tap-shake' : ''}`}
                           type="submit"
                           disabled={isSubmitting}
                        >
                           {isSubmitting ? 'Submitting...' : 'Make Your Request'}
                        </button>
                     </>
                  )}
               </form>
            )}
            {showStepProgress ? (
               <div className="shrink-0 border-t border-md-neutral-400 bg-md-neutral-100 px-md-3 py-md-2">
                  <StepDots current={currentStep} />
               </div>
            ) : null}
         </section>
         {isCalendarOpen ? (
            <div
               aria-label="Choose repayment date"
               aria-modal="true"
               className="fixed inset-0 z-[90] flex items-center justify-center bg-[#1f1b29]/20 px-[21px]"
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
                        className="rounded-md-md p-md-0 text-md-neutral-1200 transition duration-150 ease-out hover:bg-md-primary-100 hover:text-md-primary-1200 active:scale-95 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-md-primary-900"
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
                        className="rounded-md-md p-md-0 text-md-neutral-1200 transition duration-150 ease-out hover:bg-md-primary-100 hover:text-md-primary-1200 active:scale-95 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-md-primary-900"
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
                           'grid h-9 w-9 place-items-center rounded-md-md text-md-b3 font-normal text-md-heading transition duration-150 ease-out hover:bg-md-primary-100 hover:text-md-primary-1200 active:scale-95 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-md-primary-900',
                        selected: '[&>button]:bg-md-primary-1200 [&>button]:text-md-neutral-100',
                        today: '[&>button]:border [&>button]:border-md-primary-900',
                        outside: '[&>button]:text-md-neutral-600',
                        disabled: '[&>button]:cursor-not-allowed [&>button]:text-md-neutral-600 [&>button]:opacity-40'
                     }}
                  />
               </div>
            </div>
         ) : null}
         <AvatarUploadModal
            currentAvatar={user.avatarUrl}
            currentAvatarBackground={user.avatarBackground}
            isOpen={showBorrowerAvatarModal}
            isSaving={isSavingBorrowerAvatar}
            onClose={() => setShowBorrowerAvatarModal(false)}
            onSave={handleBorrowerAvatarSave}
         />
      </div>
   );
}
