import { useMemo, useState } from 'react';

import {
   BarChart3,
   Briefcase,
   BriefcaseBusiness,
   Bus,
   CalendarDays,
   Check,
   Clock3,
   FileText,
   LockKeyhole,
   type LucideIcon,
   PencilLine,
   ShieldCheck,
   Stethoscope,
   TriangleAlert,
   Users,
   WalletCards
} from 'lucide-react';
import { useLocation, useNavigate } from 'react-router-dom';

import { OnboardingHeader } from '@/views/onboarding/OnboardingHeader';

type SingleField = 'incomeSetup' | 'incomeRhythm' | 'payday' | 'paydayWindow';

type BorrowerContextState = Record<SingleField, string> & {
   cashGaps: string[];
   note: string;
};

type Option = {
   label: string;
   value: string;
};

type SingleSection = {
   field: SingleField;
   icon: LucideIcon;
   title: string;
   options: Option[];
};

type CashGapOption = Option & {
   icon: LucideIcon;
};

const NOTE_LIMIT = 120;

const EMPTY_CONTEXT: BorrowerContextState = {
   incomeSetup: '',
   incomeRhythm: '',
   payday: '',
   paydayWindow: '',
   cashGaps: [],
   note: ''
};

const PREVIEW_CONTEXT: BorrowerContextState = {
   incomeSetup: 'full_time',
   incomeRhythm: 'mostly_steady',
   payday: 'every_2_weeks',
   paydayWindow: '15_20',
   cashGaps: ['bills_before_payday', 'transport', 'family_needs'],
   note: 'I usually repay after payday and use small loans for short-term work needs.'
};

const singleSections: SingleSection[] = [
   {
      field: 'incomeSetup',
      icon: BriefcaseBusiness,
      title: 'Income setup',
      options: [
         { label: 'Full-time', value: 'full_time' },
         { label: 'Part-time', value: 'part_time' },
         { label: 'Contract / temp', value: 'contract_temp' },
         { label: 'Freelance / gig', value: 'freelance_gig' },
         { label: 'Self-employed', value: 'self_employed' },
         { label: 'Irregular income', value: 'irregular_income' }
      ]
   },
   {
      field: 'incomeRhythm',
      icon: BarChart3,
      title: 'Income rhythm',
      options: [
         { label: 'Very steady', value: 'very_steady' },
         { label: 'Mostly steady', value: 'mostly_steady' },
         { label: 'Varies', value: 'varies' },
         { label: 'Project-based', value: 'project_based' }
      ]
   },
   {
      field: 'payday',
      icon: CalendarDays,
      title: 'Typical payday',
      options: [
         { label: 'Weekly', value: 'weekly' },
         { label: 'Every 2 weeks', value: 'every_2_weeks' },
         { label: 'Twice a month', value: 'twice_a_month' },
         { label: 'Monthly', value: 'monthly' },
         { label: 'Varies', value: 'varies' }
      ]
   },
   {
      field: 'paydayWindow',
      icon: Clock3,
      title: 'Payday window',
      options: [
         { label: '1st-5th', value: '1_5' },
         { label: '10th-15th', value: '10_15' },
         { label: '15th-20th', value: '15_20' },
         { label: '25th-30th', value: '25_30' },
         { label: 'It varies', value: 'it_varies' }
      ]
   }
];

const cashGapOptions: CashGapOption[] = [
   { label: 'Bills before payday', value: 'bills_before_payday', icon: FileText },
   { label: 'Transport', value: 'transport', icon: Bus },
   { label: 'Work supplies', value: 'work_supplies', icon: Briefcase },
   { label: 'Family needs', value: 'family_needs', icon: Users },
   { label: 'Medical', value: 'medical', icon: Stethoscope },
   { label: 'Emergency expense', value: 'emergency_expense', icon: TriangleAlert }
];

function buildInitialContext(isPreview: boolean): BorrowerContextState {
   const context = isPreview ? PREVIEW_CONTEXT : EMPTY_CONTEXT;
   return {
      ...context,
      cashGaps: [...context.cashGaps]
   };
}

export default function BorrowerContext() {
   const navigate = useNavigate();
   const location = useLocation();
   const isPreview = location.pathname.includes('borrower-context-preview');
   const nextPath = isPreview ? '/onboarding/wallet-preview?role=borrower' : '/onboarding/wallet';
   const [context, setContext] = useState<BorrowerContextState>(() => buildInitialContext(isPreview));
   const [attemptedSave, setAttemptedSave] = useState(false);

   const completedRequiredFields = useMemo(() => singleSections.filter((section) => Boolean(context[section.field])).length, [context]);
   const canSave = completedRequiredFields === singleSections.length;

   const handleSingleSelect = (field: SingleField, value: string) => {
      setContext((current) => ({ ...current, [field]: value }));
   };

   const handleCashGapToggle = (value: string) => {
      setContext((current) => {
         const hasValue = current.cashGaps.includes(value);
         return {
            ...current,
            cashGaps: hasValue ? current.cashGaps.filter((item) => item !== value) : [...current.cashGaps, value]
         };
      });
   };

   const handleSave = () => {
      setAttemptedSave(true);

      if (!canSave) {
         return;
      }

      try {
         window.localStorage.setItem('moodeng-borrower-context-draft', JSON.stringify(context));
      } catch {
         // Local storage is only a temporary handoff until this is wired to the account record.
      }

      navigate(nextPath, { state: { borrowerContext: context } });
   };

   return (
      <div className="min-h-screen bg-gradient-to-b from-[#fbfafd] to-white flex flex-col max-w-[440px] mx-auto w-full">
         <OnboardingHeader title="Borrower Context" />

         <main className="flex flex-col gap-md-4 px-md-4 pb-md-5">
            <section className="flex flex-col gap-md-1 text-center">
               <p className="text-md-b3 font-semibold uppercase tracking-[0.14em] text-md-primary-900">Step 2 of 3</p>
               <h2 className="text-md-display text-md-heading">Help lenders understand your repayment timing.</h2>
               <p className="text-md-b1 font-medium text-md-neutral-700">
                  Share work rhythm and cash-flow context without employer names, addresses, or contacts.
               </p>
            </section>

            <section className="rounded-md-xl border border-md-neutral-400 bg-white p-md-3 shadow-[0_14px_34px_rgba(31,28,37,0.06)]">
               <div className="mb-md-3 flex flex-col gap-md-2 rounded-md-lg bg-md-primary-900/5 p-md-3 min-[390px]:flex-row min-[390px]:items-center min-[390px]:justify-between">
                  <span className="inline-flex w-fit shrink-0 items-center justify-center whitespace-nowrap rounded-md-pill bg-md-primary-100 px-md-3 py-md-1 text-md-b2 font-semibold text-md-primary-1200">
                     Step 2 of 3
                  </span>
                  <div className="flex items-center gap-md-1 text-md-b3 font-semibold text-md-neutral-1200">
                     <ShieldCheck className="size-4 shrink-0 text-md-primary-900" strokeWidth={2.1} />
                     No employer name, address, or contacts required.
                  </div>
               </div>

               <div className="flex flex-col">
                  {singleSections.map((section, index) => (
                     <ContextSection key={section.field} index={index + 1} icon={section.icon} title={section.title} isFirst={index === 0}>
                        <div className="grid grid-cols-1 gap-md-2 min-[360px]:grid-cols-2">
                           {section.options.map((option) => (
                              <SelectButton
                                 key={option.value}
                                 label={option.label}
                                 isSelected={context[section.field] === option.value}
                                 onClick={() => handleSingleSelect(section.field, option.value)}
                              />
                           ))}
                        </div>
                     </ContextSection>
                  ))}

                  <ContextSection index={5} icon={WalletCards} title="Common cash-flow gaps" helperText="Select all that apply">
                     <div className="grid grid-cols-1 gap-md-2 min-[360px]:grid-cols-2">
                        {cashGapOptions.map((option) => (
                           <SelectButton
                              key={option.value}
                              label={option.label}
                              icon={option.icon}
                              isSelected={context.cashGaps.includes(option.value)}
                              onClick={() => handleCashGapToggle(option.value)}
                           />
                        ))}
                     </div>
                  </ContextSection>

                  <ContextSection index={6} icon={PencilLine} title="Optional note">
                     <label className="sr-only" htmlFor="borrower-context-note">
                        Optional note
                     </label>
                     <div className="rounded-md-input border border-md-neutral-500 bg-md-neutral-100 px-md-3 py-md-2 focus-within:border-md-primary-900 focus-within:ring-2 focus-within:ring-md-primary-100">
                        <textarea
                           id="borrower-context-note"
                           value={context.note}
                           maxLength={NOTE_LIMIT}
                           onChange={(event) => setContext((current) => ({ ...current, note: event.target.value }))}
                           placeholder="Example: I usually repay after payday and use small loans for short-term work needs."
                           className="min-h-[92px] w-full resize-none bg-transparent text-md-b1 font-medium text-md-heading placeholder:text-md-neutral-700 focus:outline-none"
                        />
                        <div className="text-right text-md-b3 font-semibold text-md-neutral-900">
                           {context.note.length}/{NOTE_LIMIT}
                        </div>
                     </div>
                  </ContextSection>
               </div>
            </section>

            {attemptedSave && !canSave ? (
               <p className="rounded-md-lg border border-md-primary-200 bg-md-primary-100 px-md-3 py-md-2 text-center text-md-b2 font-semibold text-md-primary-1200">
                  Choose your income setup, rhythm, typical payday, and payday window before saving.
               </p>
            ) : null}

            <div className="flex flex-col gap-md-3 pb-md-2">
               <button
                  type="button"
                  onClick={handleSave}
                  className="flex min-h-[56px] w-full items-center justify-center gap-md-1 rounded-md-lg bg-md-primary-1200 px-md-4 py-md-3 text-md-b1 font-semibold text-md-neutral-100 transition active:scale-[0.99] focus:outline-none focus-visible:ring-2 focus-visible:ring-md-primary-900 focus-visible:ring-offset-2"
               >
                  <LockKeyhole className="size-5" strokeWidth={2.2} />
                  Save context
               </button>
               <button
                  type="button"
                  onClick={() => navigate(nextPath)}
                  className="min-h-[44px] text-md-b1 font-semibold text-md-primary-1200 transition active:scale-[0.99] focus:outline-none focus-visible:ring-2 focus-visible:ring-md-primary-900 focus-visible:ring-offset-2"
               >
                  Skip for now
               </button>
            </div>
         </main>
      </div>
   );
}

function ContextSection({
   index,
   icon: Icon,
   title,
   helperText,
   isFirst = false,
   children
}: {
   index: number;
   icon: LucideIcon;
   title: string;
   helperText?: string;
   isFirst?: boolean;
   children: React.ReactNode;
}) {
   return (
      <section className={`${isFirst ? 'pt-0' : 'border-t border-md-neutral-300 pt-md-3'} pb-md-3`}>
         <div className="mb-md-2 flex items-center gap-md-2">
            <span className="flex size-9 shrink-0 items-center justify-center rounded-md-pill bg-md-primary-100 text-md-primary-900">
               <Icon className="size-5" strokeWidth={2} />
            </span>
            <div className="min-w-0 flex-1">
               <div className="flex flex-wrap items-baseline gap-x-md-1 gap-y-md-0">
                  <h3 className="text-md-h5 text-md-heading">
                     {index}. {title}
                  </h3>
                  {helperText ? <span className="text-md-b3 font-semibold text-md-neutral-900">{helperText}</span> : null}
               </div>
            </div>
         </div>
         {children}
      </section>
   );
}

function SelectButton({
   label,
   icon: Icon,
   isSelected,
   onClick
}: {
   label: string;
   icon?: LucideIcon;
   isSelected: boolean;
   onClick: () => void;
}) {
   return (
      <button
         type="button"
         aria-pressed={isSelected}
         onClick={onClick}
         className={`relative flex min-h-[48px] items-center justify-center gap-md-1 rounded-md-input border px-md-2 py-md-2 pr-9 text-center text-md-b2 font-semibold transition active:scale-[0.99] focus:outline-none focus-visible:ring-2 focus-visible:ring-md-primary-900 focus-visible:ring-offset-1 ${
            isSelected
               ? 'border-md-primary-900 bg-md-primary-100 text-md-primary-1200 shadow-[0_0_0_1px_rgba(131,54,240,0.10)]'
               : 'border-md-neutral-500 bg-white text-md-neutral-1200'
         }`}
      >
         {Icon ? (
            <Icon className={`size-5 shrink-0 ${isSelected ? 'text-md-primary-900' : 'text-md-neutral-900'}`} strokeWidth={2} />
         ) : null}
         <span className="min-w-0">{label}</span>
         {isSelected ? (
            <span className="absolute right-2 top-1/2 flex size-6 -translate-y-1/2 items-center justify-center rounded-md-pill bg-md-primary-900 text-white">
               <Check className="size-4" strokeWidth={2.4} />
            </span>
         ) : null}
      </button>
   );
}
