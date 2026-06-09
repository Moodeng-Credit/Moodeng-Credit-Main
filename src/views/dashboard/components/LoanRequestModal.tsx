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

import UserAvatar, { PLACEHOLDER_AVATAR } from '@/components/UserAvatar';
import WorldIDVerification from '@/components/worldId/WorldIDVerification';

import type { BorrowerContextState } from '@/lib/borrowerContextFit';
import { uploadAvatarForCurrentUser } from '@/lib/supabase/avatarStorage';
import { getSupabaseBrowserClient } from '@/lib/supabase/client';
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
   '1_5':   { type: 'mid-month',    start: 1,    end: 5   },
   '10_15': { type: 'mid-month',    start: 10,   end: 15  },
   '15_20': { type: 'mid-month',    start: 15,   end: 20  },
   '25_30': { type: 'end-of-month', start: 25,   end: 30  },
   varies:  { type: 'irregular',    start: null, end: null }
};
export const INCOME_SETUP_TO_TYPE: Record<string, string> = {
   full_time:     'full-time',
   self_employed: 'freelance',
   irregular:     'none',
   contract:      'part-time'
};
export const mapBorrowerContextForSave = (ctx: BorrowerContextState) => {
   const payday = PAYDAY_WINDOW_TO_CONFIG[ctx.paydayWindow];
   return {
      incomeType:      INCOME_SETUP_TO_TYPE[ctx.incomeSetup]  ?? ctx.incomeSetup,
      paydayType:      payday?.type  ?? ctx.paydayWindow,
      paydayStart:     payday?.start ?? null,
      paydayEnd:       payday?.end   ?? null,
      gapReasons:      ctx.cashGaps,
      monthlyIncome:   ctx.monthlyIncome,
      monthlyExpenses: ctx.monthlyExpenses,
      otherIncome:     ctx.otherIncome  || undefined,
      profession:      ctx.profession   || undefined,
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
   context,
   currentAvatarBackground,
   currentAvatarUrl,
   isSubmitting,
   isSavingProfile,
   monthlyIncome,
   monthlyExpenses,
   onBack,
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
   context: BorrowerContextState;
   currentAvatarBackground?: string | null;
   currentAvatarUrl?: string | null;
   isSubmitting: boolean;
   isSavingProfile: boolean;
   onBack: () => void;
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
   const canContinue = Boolean(context.incomeSetup && context.paydayWindow && context.cashGaps.length > 0);
   const isBusy = isSubmitting || isSavingProfile;

   return (
      <div className="flex min-h-0 flex-col gap-md-3">
         <section className="rounded-md-input border border-md-primary-300 bg-md-primary-100 px-md-2 py-md-2">
            <div>
	               <p className="text-md-b2 font-[590] text-md-heading">Borrower bio</p>
	               <p className="mt-[2px] text-md-b3 font-normal leading-[18px] text-md-neutral-1200">
	                  Add a friendly name and optional image so lenders can understand the request without private details.
               </p>
            </div>

            <button
               className="mt-md-2 flex w-full items-center gap-md-2 rounded-md-md bg-md-neutral-100 p-md-2 text-left transition hover:bg-md-neutral-200 active:scale-[0.99] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-md-primary-900 focus-visible:ring-offset-1"
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
                  <div className="flex items-center gap-md-1">
                     <p className="text-md-b2 font-[590] text-md-heading">Profile image</p>
                     <TrustBadge label="+15 Trust Points" />
                  </div>
                  <p className="mt-[2px] text-md-b3 font-normal leading-[18px] text-md-neutral-1200">
                     Use a photo, avatar, or anything that shows your character.
                  </p>
               </div>
            </button>

            <label className="mt-md-2 flex flex-col gap-md-1">
               <span className="flex items-center gap-md-1 text-md-b2 font-[590] text-md-heading">
                  Your name
                  <TrustBadge label="+10 Trust Points" />
               </span>
               <input
                  className="min-h-[48px] rounded-md-input border border-md-neutral-600 bg-md-neutral-100 px-md-3 py-md-2 text-md-b1 font-normal text-md-heading shadow-md-card placeholder:text-md-neutral-1200 focus:border-md-primary-900 focus:outline-none focus:ring-2 focus:ring-md-primary-100"
                  maxLength={30}
                  onChange={(event) => onProfileNameChange(event.target.value)}
                  placeholder="e.g. Maya, Jay, or a friendly nickname"
                  type="text"
                  value={profileName}
               />
               <span className="flex items-start justify-between gap-md-2 text-md-b3 font-normal leading-[18px] text-md-neutral-1200">
                  <span>This is the name lenders see with your requests.</span>
                  <span className="shrink-0">{profileName.length}/30</span>
               </span>
               {profileSaveError ? <span className="text-md-b3 font-medium leading-[18px] text-md-red-500">{profileSaveError}</span> : null}
            </label>
         </section>

         {!canContinue ? (
            <div className="flex flex-wrap items-center gap-md-1 text-md-b3 font-medium leading-[18px] text-md-primary-1200">
               <span>Fill in work, payday, and help sections to continue.</span>
               <TrustBadge label="+10 Trust Points" />
            </div>
         ) : null}

         <BorrowerContextRadioSection
            label="How would you describe your work?"
            onSelect={onIncomeSelect}
            options={incomeSetupOptions}
            selectedValue={context.incomeSetup}
         />

         {context.incomeSetup === 'contract' ? (
            <div className="flex flex-col gap-1.5">
               <p className="text-md-b2 font-semibold text-md-heading">Describe your situation</p>
               <p className="text-md-b3 text-md-neutral-700">Tell lenders how you earn, in your own words.</p>
               <textarea
                  autoFocus
                  className="w-full resize-none rounded-md-input border border-md-neutral-400 bg-md-neutral-100 px-md-3 py-md-2 text-md-b2 text-md-heading placeholder:text-md-neutral-600 focus:border-md-primary-900 focus:outline-none"
                  maxLength={200}
                  rows={3}
                  onChange={(e) => onIncomeDescriptionChange(e.target.value)}
                  placeholder="e.g. I run a small online shop and income changes month to month"
                  value={context.incomeDescription ?? ''}
               />
            </div>
         ) : null}

         <div className="flex flex-col gap-1.5">
            <p className="text-md-b2 font-semibold text-md-heading">What do you do for work?</p>
            <p className="text-md-b3 text-md-neutral-700">e.g. teacher, nurse, market vendor, driver</p>
            <input
               className="w-full rounded-md-input border border-md-neutral-400 bg-md-neutral-100 px-md-3 py-md-2 text-md-b2 text-md-heading placeholder:text-md-neutral-600 focus:border-md-primary-900 focus:outline-none"
               maxLength={60}
               onChange={(e) => onProfessionChange(e.target.value)}
               placeholder="e.g. teacher"
               type="text"
               value={context.profession ?? ''}
            />
         </div>

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

         <div className="flex flex-col gap-md-2">
            <div className="flex items-center justify-between">
               <div>
                  <p className="text-md-b2 font-semibold text-md-heading">Any other income sources?</p>
                  <p className="text-md-b3 text-md-neutral-700">e.g. tutoring, delivery, market trading</p>
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
                        className={`rounded-md-pill px-4 py-1.5 text-md-b2 font-semibold transition ${
                           (opt === 'Yes') === hasOtherIncome
                              ? 'bg-md-primary-1200 text-white'
                              : 'border border-md-neutral-400 text-md-neutral-800'
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
                  className="w-full rounded-md-input border border-md-neutral-400 bg-md-neutral-100 px-md-3 py-md-2 text-md-b2 text-md-heading placeholder:text-md-neutral-600 focus:border-md-primary-900 focus:outline-none"
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

         <div>
            <div className="grid grid-cols-[104px_minmax(0,1fr)] gap-md-2">
               <button
                  className="inline-flex min-h-[48px] items-center justify-center gap-md-1 rounded-md-lg border border-md-neutral-400 bg-md-neutral-100 text-md-b1 font-medium text-md-heading shadow-md-card transition active:scale-[0.98] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-md-primary-900 focus-visible:ring-offset-2"
                  onClick={onBack}
                  type="button"
               >
                  <ChevronLeft className="size-5" strokeWidth={2} />
                  Back
               </button>
               <button
                  className="inline-flex min-h-[56px] items-center justify-center gap-md-1 rounded-md-lg bg-md-primary-1200 px-md-4 py-md-3 text-md-b1 font-[590] text-md-neutral-100 transition active:scale-[0.98] disabled:cursor-not-allowed disabled:bg-md-neutral-600 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-md-primary-900 focus-visible:ring-offset-2"
                  disabled={!canContinue || isBusy}
                  onClick={onContinue}
                  type="button"
               >
	                  {isSavingProfile ? 'Saving profile...' : isSubmitting ? 'Submitting...' : 'Save bio info'}
               </button>
            </div>
         </div>
      </div>
   );
}

function TrustBadge({ label }: { label: string }) {
   return <span className="rounded-md-pill bg-md-primary-1200 px-[6px] py-[2px] text-md-b4 font-[590] text-md-neutral-100">{label}</span>;
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
      <fieldset className="flex flex-col gap-md-1">
         <legend className="text-md-b2 font-[590] text-md-heading">{label}</legend>
         <div className="flex flex-col gap-md-1">
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
         className={`grid min-h-[58px] w-full grid-cols-[minmax(0,1fr)_22px] items-center gap-md-2 rounded-md-input border px-md-2 py-md-1 text-left transition active:scale-[0.99] focus:outline-none focus-visible:ring-2 focus-visible:ring-md-primary-900 focus-visible:ring-offset-1 ${
            isSelected
               ? 'border-md-primary-900 bg-md-primary-100 text-md-primary-1200 shadow-[0_8px_18px_rgba(105,48,232,0.08)]'
               : 'border-md-neutral-500 bg-md-neutral-100 text-md-neutral-1200'
         }`}
         onClick={onClick}
         type="button"
      >
         <span className="min-w-0">
            <span className={`block text-md-b2 font-[590] ${isSelected ? 'text-md-primary-1200' : 'text-md-heading'}`}>{option.label}</span>
            {option.description ? (
               <span className="mt-[2px] block text-md-b3 font-normal text-md-neutral-1200">{option.description}</span>
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
      <fieldset className="flex flex-col gap-md-1 border-t border-md-neutral-400 pt-md-2">
         <legend className="sr-only">{label}</legend>
         <div className="flex flex-col gap-[2px]">
            <span className="text-md-b2 font-[590] text-md-heading">{label}</span>
            {caption ? <span className="text-md-b3 font-normal text-md-neutral-1200">{caption}</span> : null}
            {helper ? <span className="text-md-b3 font-normal text-md-neutral-1200">{helper}</span> : null}
         </div>
         <div className="flex flex-wrap gap-md-1">
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
         className={`inline-flex min-h-[32px] items-center justify-center gap-[6px] rounded-md-pill border px-md-2 py-[5px] text-md-b3 font-medium leading-[18px] transition active:scale-[0.98] focus:outline-none focus-visible:ring-2 focus-visible:ring-md-primary-900 focus-visible:ring-offset-1 ${
            isSelected
               ? 'border-md-primary-900 bg-md-primary-100 text-md-primary-1200 shadow-[0_5px_12px_rgba(105,48,232,0.08)]'
               : 'border-md-neutral-700 bg-md-neutral-100 text-md-neutral-1400'
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
   onReferralRedeemed,
   isSubmitting,
   availableCreditLimit,
   canUseReferralBoost = true,
   requireBorrowerContextStep = true,
   startOnBorrowerContextStep = false,
   startOnReferralStep = true
}: LoanRequestModalProps) {
   const dispatch = useDispatch<AppDispatch>();
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
   const [borrowerContext, setBorrowerContext] = useState<BorrowerContextState>(emptyBorrowerContext);
   const [borrowerContextPromptSeen, setBorrowerContextPromptSeen] = useState(false);
   const [borrowerProfileName, setBorrowerProfileName] = useState(user.displayName ?? user.username ?? '');
   const [borrowerProfileError, setBorrowerProfileError] = useState('');
   const [showBorrowerAvatarModal, setShowBorrowerAvatarModal] = useState(false);
   const [isSavingBorrowerProfile, setIsSavingBorrowerProfile] = useState(false);
   const [isSavingBorrowerAvatar, setIsSavingBorrowerAvatar] = useState(false);

   const isVerified = !showVerify;
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
      borrowerContext.incomeSetup && borrowerContext.paydayWindow && borrowerContext.cashGaps.length > 0
   );
   const currentBorrowerDisplayName = user.displayName ?? user.username ?? '';
   const isPreviewUser = user.email.endsWith('@moodeng.local') || user.id.includes('preview');

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

   const handleLoanFormSubmit = (event: FormEvent<HTMLFormElement>) => {
      if (!isVerified || isSubmitting) {
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
         return;
      }

      handleSubmit(event, showBorrowerContextStep ? borrowerContext : undefined);
   };

   // Synchronous guard — prevents double-tap on "Save bio info" from firing twice
   // before isSavingProfile state has a chance to re-render and disable the button.
   const isBioSubmittingRef = useRef(false);

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
      <div className="fixed inset-0 z-[70] flex items-start justify-center overflow-y-auto bg-[#1f1b29]/20 px-[21px] py-[64px] sm:items-center sm:py-6">
         <section
            ref={clickOutsideRef}
            className="relative mx-auto flex max-h-[calc(100dvh-42px)] w-full max-w-[398px] flex-col overflow-hidden rounded-md-lg border border-md-neutral-400 bg-md-neutral-100 shadow-md-card transition-transform duration-150 ease-out"
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
            <header
               className="flex touch-none cursor-grab select-none items-center justify-between border-b border-md-neutral-400 p-md-3 active:cursor-grabbing"
               onPointerDown={(event) => startDismissGesture(event, 'down')}
               onPointerMove={moveDismissGesture}
               onPointerUp={endDismissGesture}
               onPointerCancel={endDismissGesture}
            >
               <div className="flex items-center gap-md-1">
                  {shouldShowReferralStep ? (
                     <h2 className="text-md-h6 text-md-heading">Referral Boost</h2>
                  ) : showBorrowerContextStep ? (
                     <div>
                        <h2 className="text-md-h6 font-[590] leading-[24px] text-md-heading">How lenders see you</h2>
                        <p className="text-md-b3 font-normal leading-[18px] text-md-neutral-1200">
	                           Share simple bio details so lenders can understand your request.
                        </p>
                     </div>
                  ) : (
                     <>
                        <h2 className="text-md-h6 text-md-heading">Set Your Own Terms</h2>
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
                  className="rounded-full p-1 text-md-neutral-2000 transition duration-150 ease-out hover:bg-md-primary-100 hover:text-md-primary-1200 active:scale-95 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-md-primary-900 focus-visible:ring-offset-2 dark:text-[#f8f4ff] dark:hover:bg-[#2a2235] dark:hover:text-white dark:focus-visible:ring-offset-[#1b1525]"
                  type="button"
               >
                  <X aria-hidden="true" className="h-6 w-6" strokeWidth={2} />
               </button>
            </header>

            {shouldShowReferralStep ? (
               <div
                  className="flex min-h-0 touch-pan-y flex-col gap-md-2 overflow-y-auto p-md-2 text-md-b2 text-md-heading"
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
                  className="flex min-h-0 flex-col gap-md-3 overflow-y-auto p-md-3 text-md-b2 text-md-heading"
               >
                  {showBorrowerContextStep ? (
                     <BorrowerContextLoanStep
                        context={borrowerContext}
                        currentAvatarBackground={user.avatarBackground}
                        currentAvatarUrl={user.avatarUrl}
                        isSubmitting={isSubmitting}
                        isSavingProfile={isSavingBorrowerProfile}
                        monthlyIncome={borrowerContext.monthlyIncome ?? ''}
                        monthlyExpenses={borrowerContext.monthlyExpenses ?? ''}
                        onBack={handleBorrowerContextBack}
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
                                       One quick step to request a loan
                                    </p>
                                    <p className="text-md-b3 font-normal text-md-neutral-1400">
                                       Complete a one-time verification to start building trust with lenders.
                                    </p>
                                 </div>
                                 <WorldIDVerification onSuccess={() => undefined}>
                                    {({ open }) => (
                                       <button
                                          onClick={open}
                                          className="w-fit rounded-[12px] bg-md-primary-1200 px-md-2 py-md-1 text-md-b2 font-semibold text-md-neutral-100 transition duration-150 ease-out hover:bg-[#5200c8] active:scale-[0.97] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-md-primary-900 focus-visible:ring-offset-2"
                                          type="button"
                                       >
                                          Get Verified
                                       </button>
                                    )}
                                 </WorldIDVerification>
                              </div>
                              <img
                                 alt=""
                                 aria-hidden="true"
                                 className="h-[86px] w-[96px] shrink-0 object-contain"
                                 src="/hippos/welcome.png"
                              />
                           </div>
                        ) : null}

                        <div className="flex flex-col gap-md-1" data-tour-target="loan-borrow-amount">
                           <div className="flex items-center justify-between gap-md-2">
                              <label className="text-md-b2 font-normal text-md-heading" htmlFor="borrow-amount">
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
                              <InfoTooltip
                                 activeTooltip={activeTooltip}
                                 iconClassName="h-4 w-4"
                                 iconStrokeWidth={1.35}
                                 id="usdc"
                                 label="Explain USDC loans"
                                 panelClassName="left-0 top-full mt-md-1 -translate-x-1/2"
                                 setActiveTooltip={setActiveTooltip}
                              />
                              <span>All loans are issued and repaid in USDC.</span>
                           </div>
                        </div>

                        <div className="flex flex-col gap-md-1" data-tour-target="loan-repayment-amount">
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

                        <div className="flex flex-col gap-md-1" data-tour-target="loan-repayment-date">
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
                        </div>

                        <div className="flex flex-col gap-md-1" data-tour-target="loan-reason">
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
                              isVerified && !isSubmitting
                                 ? 'bg-md-primary-1200 transition duration-150 ease-out hover:bg-[#5200c8] active:scale-[0.98] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-md-primary-900 focus-visible:ring-offset-2'
                                 : 'cursor-not-allowed bg-md-neutral-600'
                           }`}
                           type="submit"
                           disabled={!isVerified || isSubmitting}
                        >
                           {isSubmitting ? 'Submitting...' : 'Make Your Request'}
                        </button>
                     </>
                  )}
               </form>
            )}
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
