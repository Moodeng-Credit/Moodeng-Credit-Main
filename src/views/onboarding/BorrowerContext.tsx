import { useMemo, useState } from 'react';

import {
   ArrowRight,
   Bolt,
   Briefcase,
   BriefcaseBusiness,
   Bus,
   Check,
   Clock3,
   FileText,
   Heart,
   LockKeyhole,
   type LucideIcon,
   ShieldCheck,
   Stethoscope,
   TriangleAlert,
   Users,
   WalletCards,
   Wrench
} from 'lucide-react';
import { useLocation, useNavigate } from 'react-router-dom';

type SingleField = 'incomeSetup' | 'paydayWindow';

type BorrowerContextState = Record<SingleField, string> & {
   cashGaps: string[];
   note: string;
};

type Option = {
   label: string;
   value: string;
   description: string;
   icon: LucideIcon;
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

type StepId = 'income' | 'payday' | 'gaps' | 'review';

type Step = {
   id: StepId;
   label: string;
};

const NOTE_LIMIT = 120;

const steps: Step[] = [
   { id: 'income', label: 'Income' },
   { id: 'payday', label: 'Payday' },
   { id: 'gaps', label: 'Gaps' },
   { id: 'review', label: 'Review' }
];

const EMPTY_CONTEXT: BorrowerContextState = {
   incomeSetup: '',
   paydayWindow: '',
   cashGaps: [],
   note: ''
};

const PREVIEW_CONTEXT: BorrowerContextState = {
   incomeSetup: '',
   paydayWindow: '',
   cashGaps: [],
   note: ''
};

const singleSections: SingleSection[] = [
   {
      field: 'incomeSetup',
      icon: BriefcaseBusiness,
      title: 'Income setup',
      options: [
         { label: 'Full-time employee', value: 'full_time', description: 'Regular salary from one employer', icon: BriefcaseBusiness },
         { label: 'Part-time', value: 'part_time', description: 'Scheduled hours, under 30/week', icon: Clock3 },
         { label: 'Contract / Temp', value: 'contract_temp', description: 'Fixed-term or agency work', icon: FileText },
         { label: 'Freelance / Gig', value: 'freelance_gig', description: 'Project-based or platform work', icon: Bolt },
         { label: 'Self-employed', value: 'self_employed', description: 'Own business or sole trader', icon: Users },
         { label: 'Irregular income', value: 'irregular_income', description: 'Income varies month to month', icon: WalletCards }
      ]
   },
   {
      field: 'paydayWindow',
      icon: Clock3,
      title: 'Payday timing',
      options: [
         { label: 'Early month', value: '1_5', description: '1st - 5th', icon: Clock3 },
         { label: 'Mid-month', value: '10_15', description: '10th - 15th', icon: Clock3 },
         { label: 'Late mid', value: '15_20', description: '15th - 20th', icon: Clock3 },
         { label: 'End of month', value: '25_30', description: '25th - 30th', icon: Clock3 },
         { label: 'It varies', value: 'it_varies', description: 'No fixed schedule', icon: Clock3 }
      ]
   }
];

const cashGapOptions: CashGapOption[] = [
   { label: 'Bills before payday', value: 'bills_before_payday', description: '', icon: FileText },
   { label: 'Transport costs', value: 'transport', description: '', icon: Bus },
   { label: 'Work supplies', value: 'work_supplies', description: '', icon: Wrench },
   { label: 'Family needs', value: 'family_needs', description: '', icon: Heart },
   { label: 'Medical expenses', value: 'medical', description: '', icon: Stethoscope },
   { label: 'Emergency costs', value: 'emergency_expense', description: '', icon: TriangleAlert }
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
   const [activeStep, setActiveStep] = useState(0);

   const completedRequiredFields = useMemo(() => singleSections.filter((section) => Boolean(context[section.field])).length, [context]);
   const requiredComplete = completedRequiredFields === singleSections.length;
   const currentStep = steps[activeStep];
   const canContinue =
      currentStep.id === 'income'
         ? Boolean(context.incomeSetup)
         : currentStep.id === 'payday'
           ? Boolean(context.paydayWindow)
           : currentStep.id === 'review'
             ? requiredComplete
             : true;

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
      if (!requiredComplete) {
         return;
      }

      try {
         window.localStorage.setItem('moodeng-borrower-context-draft', JSON.stringify(context));
      } catch {
         // Local storage is only a temporary handoff until this is wired to the account record.
      }

      navigate(nextPath, { state: { borrowerContext: context } });
   };

   const handleContinue = () => {
      if (!canContinue) {
         return;
      }

      if (activeStep === steps.length - 1) {
         handleSave();
         return;
      }

      setActiveStep((step) => step + 1);
   };

   return (
      <div className="min-h-screen bg-[#f7f6fb] flex flex-col mx-auto w-full max-w-[760px]">
         <main className="flex flex-1 flex-col px-md-3 py-md-3 min-[560px]:px-md-5 min-[560px]:py-md-5">
            <section className="flex min-h-[calc(100vh-24px)] flex-col overflow-hidden rounded-[28px] border border-md-neutral-300 bg-md-neutral-100 shadow-[0_18px_48px_rgba(47,39,68,0.14)] min-[560px]:min-h-[680px]">
               <StepProgress activeStep={activeStep} />

               <div className="flex flex-1 flex-col border-t border-md-neutral-300 px-md-4 py-md-5 min-[560px]:px-md-6">
                  {currentStep.id === 'income' ? (
                     <QuestionStep
                        icon={BriefcaseBusiness}
                        title="How do you earn income?"
                        options={singleSections[0].options}
                        selectedValues={[context.incomeSetup]}
                        onSelect={(value) => handleSingleSelect('incomeSetup', value)}
                     />
                  ) : null}

                  {currentStep.id === 'payday' ? (
                     <QuestionStep
                        icon={Clock3}
                        title="When do you usually get paid?"
                        helperText="This helps lenders understand your cash-flow timing."
                        options={singleSections[1].options}
                        selectedValues={[context.paydayWindow]}
                        onSelect={(value) => handleSingleSelect('paydayWindow', value)}
                        variant="schedule"
                     />
                  ) : null}

                  {currentStep.id === 'gaps' ? (
                     <QuestionStep
                        icon={WalletCards}
                        title="What causes cash-flow gaps?"
                        helperText="Select all that apply, completely optional."
                        options={cashGapOptions}
                        selectedValues={context.cashGaps}
                        onSelect={handleCashGapToggle}
                        variant="compact"
                     />
                  ) : null}

                  {currentStep.id === 'review' ? (
                     <ReviewStep context={context} onNoteChange={(note) => setContext((current) => ({ ...current, note }))} />
                  ) : null}

                  <div className="mt-auto flex flex-col gap-md-3 pt-md-5">
                     {currentStep.id === 'gaps' ? (
                        <button
                           type="button"
                           onClick={() => setActiveStep((step) => step + 1)}
                           className="mx-auto inline-flex min-h-[40px] items-center justify-center gap-md-1 px-md-2 text-md-b1 font-medium text-md-neutral-1000 transition active:scale-[0.99] focus:outline-none focus-visible:ring-2 focus-visible:ring-md-primary-900 focus-visible:ring-offset-2"
                        >
                           Skip this step
                           <ArrowRight className="size-4" strokeWidth={2.2} />
                        </button>
                     ) : null}

                     <div className={activeStep === 0 ? 'flex' : 'grid grid-cols-[92px_minmax(0,1fr)] gap-md-2 min-[390px]:grid-cols-[112px_minmax(0,1fr)]'}>
                        <button
                           type="button"
                           disabled={activeStep === 0}
                           onClick={() => setActiveStep((step) => Math.max(0, step - 1))}
                           className={`min-h-[52px] items-center justify-center gap-md-1 rounded-[12px] border border-md-neutral-300 bg-md-neutral-100 text-md-b1 font-semibold text-md-heading shadow-[0_8px_20px_rgba(47,39,68,0.12)] transition active:scale-[0.99] disabled:hidden focus:outline-none focus-visible:ring-2 focus-visible:ring-md-primary-900 focus-visible:ring-offset-2 ${
                              activeStep === 0 ? 'hidden' : 'flex'
                           }`}
                        >
                           <ArrowRight className="size-5 rotate-180" strokeWidth={2.2} />
                           Back
                        </button>
                        <button
                           type="button"
                           disabled={!canContinue}
                           onClick={handleContinue}
                           className="flex min-h-[56px] w-full items-center justify-center gap-md-2 rounded-[14px] bg-md-primary-1200 px-md-4 py-md-3 text-md-b1 font-semibold text-md-neutral-100 shadow-[0_10px_24px_rgba(105,48,232,0.22)] transition active:scale-[0.99] disabled:bg-md-primary-600 disabled:text-md-neutral-100 disabled:shadow-none focus:outline-none focus-visible:ring-2 focus-visible:ring-md-primary-900 focus-visible:ring-offset-2"
                        >
                           {currentStep.id === 'review' ? (
                              <>
                                 <LockKeyhole className="size-5" strokeWidth={2.2} />
                                 Save context
                              </>
                           ) : (
                              <>
                                 Continue
                                 <ArrowRight className="size-5" strokeWidth={2.2} />
                              </>
                           )}
                        </button>
                     </div>
                  </div>
               </div>
            </section>
         </main>
      </div>
   );
}

function StepProgress({ activeStep }: { activeStep: number }) {
   return (
      <div className="px-md-4 pb-md-5 pt-md-6">
         <div className="grid grid-cols-[1fr_20px_1fr_20px_1fr_20px_1fr] items-start min-[420px]:grid-cols-[1fr_30px_1fr_30px_1fr_30px_1fr]">
            {steps.map((step, index) => (
               <div key={step.id} className="contents">
                  <div className="flex flex-col items-center gap-md-2">
                     <span
                        className={`flex size-12 items-center justify-center rounded-md-pill text-md-h5 font-semibold min-[420px]:size-14 min-[420px]:text-md-h4 ${
                           index <= activeStep ? 'bg-md-primary-1200 text-md-neutral-100' : 'bg-md-neutral-300 text-md-neutral-1100'
                        }`}
                     >
                        {index < activeStep ? <Check className="size-6 min-[420px]:size-7" strokeWidth={2.8} /> : index + 1}
                     </span>
                     <span className={`text-center text-md-b2 font-semibold ${index <= activeStep ? 'text-md-primary-1200' : 'text-md-neutral-1000'}`}>
                        {step.label}
                     </span>
                  </div>
                  {index < steps.length - 1 ? (
                     <div
                        className={`mt-[23px] h-[3px] rounded-md-pill min-[420px]:mt-[27px] ${
                           index < activeStep ? 'bg-md-primary-900' : 'bg-md-neutral-400'
                        }`}
                     />
                  ) : null}
               </div>
            ))}
         </div>
      </div>
   );
}

function QuestionStep({
   icon: Icon,
   title,
   helperText,
   options,
   selectedValues,
   onSelect,
   variant = 'detail'
}: {
   icon: LucideIcon;
   title: string;
   helperText?: string;
   options: Option[];
   selectedValues: string[];
   onSelect: (value: string) => void;
   variant?: 'detail' | 'schedule' | 'compact';
}) {
   const isGrid = variant !== 'detail';

   return (
      <div className="flex flex-col gap-md-3">
         <div className="flex items-start gap-md-2">
            <Icon className="mt-[5px] size-7 shrink-0 text-md-primary-1200" strokeWidth={2.2} />
            <div className="min-w-0">
               <h1 className="text-[28px] font-semibold leading-[34px] text-md-heading">{title}</h1>
               {helperText ? <p className="mt-md-1 text-md-b2 font-medium text-md-neutral-1000">{helperText}</p> : null}
            </div>
         </div>

         <div className={isGrid ? 'grid grid-cols-1 gap-md-2 min-[560px]:grid-cols-2' : 'flex flex-col gap-md-2'}>
            {options.map((option) => (
               <OptionCard
                  key={option.value}
                  label={option.label}
                  description={option.description}
                  icon={option.icon}
                  isSelected={selectedValues.includes(option.value)}
                  onClick={() => onSelect(option.value)}
                  variant={variant}
               />
            ))}
         </div>
      </div>
   );
}

function ReviewStep({
   context,
   onNoteChange
}: {
   context: BorrowerContextState;
   onNoteChange: (note: string) => void;
}) {
   const incomeLabel = singleSections[0].options.find((option) => option.value === context.incomeSetup)?.label ?? 'Not selected';
   const paydayOption = singleSections[1].options.find((option) => option.value === context.paydayWindow);
   const paydayLabel = paydayOption ? `${paydayOption.label}, ${paydayOption.description}` : 'Not selected';
   const gapLabels = cashGapOptions.filter((option) => context.cashGaps.includes(option.value)).map((option) => option.label);

   return (
      <div className="flex flex-col gap-md-3">
         <div className="flex items-start gap-md-2">
            <ShieldCheck className="mt-[5px] size-7 shrink-0 text-md-primary-1200" strokeWidth={2.2} />
            <div className="min-w-0">
               <h1 className="text-[28px] font-semibold leading-[34px] text-md-heading">Review your borrower bio.</h1>
               <p className="mt-md-1 text-md-b2 font-medium text-md-neutral-1000">Private details stay out.</p>
            </div>
         </div>

         <div className="grid gap-md-2">
            <SummaryRow label="Income" value={incomeLabel} />
            <SummaryRow label="Payday" value={paydayLabel} />
            <SummaryRow label="Gaps" value={gapLabels.length > 0 ? gapLabels.join(', ') : 'No common gaps selected'} />
         </div>

         <label className="flex flex-col gap-md-1">
            <span className="text-md-b2 font-semibold text-md-heading">Note</span>
            <div className="rounded-md-input border border-md-neutral-500 bg-white px-md-3 py-md-2 focus-within:border-md-primary-900 focus-within:ring-2 focus-within:ring-md-primary-100">
               <textarea
                  value={context.note}
                  maxLength={NOTE_LIMIT}
                  onChange={(event) => onNoteChange(event.target.value)}
                  placeholder="Example: I usually repay after payday."
                  className="min-h-[76px] w-full resize-none bg-transparent text-md-b1 font-medium text-md-heading placeholder:text-md-neutral-700 focus:outline-none"
               />
               <div className="text-right text-md-b3 font-semibold text-md-neutral-900">
                  {context.note.length}/{NOTE_LIMIT}
               </div>
            </div>
         </label>
      </div>
   );
}

function SummaryRow({ label, value }: { label: string; value: string }) {
   return (
      <div className="rounded-md-input border border-md-neutral-400 bg-white px-md-3 py-md-2">
         <p className="text-md-b3 font-semibold text-md-neutral-1000">{label}</p>
         <p className="mt-[2px] text-md-b1 font-semibold text-md-heading">{value}</p>
      </div>
   );
}

function OptionCard({
   label,
   description,
   icon: Icon,
   isSelected,
   onClick,
   variant = 'detail'
}: {
   label: string;
   description: string;
   icon: LucideIcon;
   isSelected: boolean;
   onClick: () => void;
   variant?: 'detail' | 'schedule' | 'compact';
}) {
   if (variant === 'schedule') {
      return (
         <button
            type="button"
            aria-pressed={isSelected}
            onClick={onClick}
            className={`min-h-[92px] rounded-[18px] border-2 bg-white px-md-3 py-md-3 text-left transition active:scale-[0.99] focus:outline-none focus-visible:ring-2 focus-visible:ring-md-primary-900 focus-visible:ring-offset-1 ${
               isSelected
                  ? 'border-md-primary-900 bg-md-primary-100 text-md-primary-1200 shadow-[0_8px_18px_rgba(105,48,232,0.12)]'
                  : 'border-md-neutral-400 text-md-neutral-1200'
            }`}
         >
            <span className="block text-md-h5 font-semibold leading-[24px] text-md-heading">{label}</span>
            <span className="mt-[2px] block text-md-b1 font-medium leading-[22px] text-md-neutral-1000">{description}</span>
         </button>
      );
   }

   if (variant === 'compact') {
      return (
         <button
            type="button"
            aria-pressed={isSelected}
            onClick={onClick}
            className={`grid min-h-[76px] w-full grid-cols-[32px_minmax(0,1fr)_24px] items-center gap-md-2 rounded-[18px] border-2 px-md-3 py-md-3 text-left transition active:scale-[0.99] focus:outline-none focus-visible:ring-2 focus-visible:ring-md-primary-900 focus-visible:ring-offset-1 ${
               isSelected
                  ? 'border-md-primary-900 bg-md-primary-100 text-md-primary-1200 shadow-[0_8px_20px_rgba(105,48,232,0.18)]'
                  : 'border-md-neutral-400 bg-white text-md-neutral-1200'
            }`}
         >
            <Icon className={`size-6 shrink-0 ${isSelected ? 'text-md-primary-900' : 'text-md-neutral-1000'}`} strokeWidth={2} />
            <span className={`min-w-0 text-md-b1 font-semibold leading-[22px] ${isSelected ? 'text-md-primary-1200' : 'text-md-heading'}`}>
               {label}
            </span>
            {isSelected ? (
               <span className="flex size-6 shrink-0 items-center justify-center rounded-md-pill bg-md-primary-900 text-md-neutral-100">
                  <Check className="size-4" strokeWidth={2.6} />
               </span>
            ) : (
               <span aria-hidden="true" />
            )}
         </button>
      );
   }

   return (
      <button
         type="button"
         aria-pressed={isSelected}
         onClick={onClick}
         className={`grid min-h-[82px] w-full grid-cols-[36px_minmax(0,1fr)_24px] items-center gap-md-2 rounded-[20px] border-2 px-md-3 py-md-3 text-left transition active:scale-[0.99] focus:outline-none focus-visible:ring-2 focus-visible:ring-md-primary-900 focus-visible:ring-offset-1 ${
            isSelected
               ? 'border-md-primary-900 bg-white text-md-primary-1200 shadow-[0_0_0_1px_rgba(131,54,240,0.08)]'
               : 'border-md-neutral-400 bg-white text-md-neutral-1200'
         }`}
      >
         <Icon className={`size-7 shrink-0 ${isSelected ? 'text-md-primary-900' : 'text-md-neutral-1000'}`} strokeWidth={2} />
         <span className="min-w-0">
            <span className="block text-md-h5 font-semibold leading-[24px] text-md-heading">{label}</span>
            <span className="mt-[2px] block text-md-b1 font-medium leading-[22px] text-md-neutral-1000">{description}</span>
         </span>
         {isSelected ? (
            <span className="ml-md-0 flex size-5 shrink-0 items-center justify-center rounded-md-pill bg-md-primary-900 text-md-neutral-100">
               <Check className="size-3.5" strokeWidth={2.4} />
            </span>
         ) : (
            <span aria-hidden="true" />
         )}
      </button>
   );
}
