import { useEffect, useState } from 'react';

import { useDispatch } from 'react-redux';

import { TOAST_TYPES } from '@/components/ToastSystem/config/toastConfig';
import { useToast } from '@/components/ToastSystem/hooks/useToast';
import type { BorrowerContextState } from '@/lib/borrowerContextFit';
import { updateBorrowerContext } from '@/store/slices/authSlice';
import type { AppDispatch } from '@/store/store';
import type { User } from '@/types/authTypes';
import {
   BorrowerContextChipSection,
   BorrowerContextRadioSection,
   cashGapOptions,
   emptyBorrowerContext,
   incomeSetupOptions,
   INCOME_SETUP_TO_TYPE,
   inputShellClass,
   mapBorrowerContextForSave,
   monthlyExpensesOptions,
   monthlyIncomeOptions,
   PAYDAY_WINDOW_TO_CONFIG,
   paydayWindowOptions
} from '@/views/dashboard/components/LoanRequestModal';

// ─── Reverse mappings: saved DB values → UI option codes ───

const TYPE_TO_INCOME_SETUP: Record<string, string> = Object.fromEntries(
   Object.entries(INCOME_SETUP_TO_TYPE).map(([uiValue, dbValue]) => [dbValue, uiValue])
);

function resolvePaydayWindow(paydayType?: string | null, paydayStart?: number | null, paydayEnd?: number | null): string {
   if (!paydayType) return '';
   if (paydayType === 'irregular') return 'varies';

   const start = paydayStart ?? null;
   const end = paydayEnd ?? null;
   const match = Object.entries(PAYDAY_WINDOW_TO_CONFIG).find(
      ([, config]) => config.type === paydayType && config.start === start && config.end === end
   );
   return match?.[0] ?? '';
}

function buildContextFromUser(user: User | null | undefined): BorrowerContextState {
   if (!user) return emptyBorrowerContext;

   return {
      incomeSetup: (user.incomeType && TYPE_TO_INCOME_SETUP[user.incomeType]) || '',
      paydayWindow: resolvePaydayWindow(user.paydayType, user.paydayStart, user.paydayEnd),
      cashGaps: user.gapReasons ?? [],
      monthlyIncome: user.monthlyIncome ?? '',
      monthlyExpenses: user.monthlyExpenses ?? '',
      otherIncome: user.otherIncome ?? '',
      profession: user.profession ?? ''
   };
}

// ─── Edit Bio Info Modal ───

interface EditBioInfoModalProps {
   isOpen: boolean;
   onClose: () => void;
   user: User | null | undefined;
}

export default function EditBioInfoModal({ isOpen, onClose, user }: EditBioInfoModalProps) {
   const dispatch = useDispatch<AppDispatch>();
   const { showToast } = useToast();

   const [context, setContext] = useState<BorrowerContextState>(() => buildContextFromUser(user));
   const [hasOtherIncome, setHasOtherIncome] = useState<boolean>(Boolean(user?.otherIncome));
   const [isSaving, setIsSaving] = useState(false);
   const [error, setError] = useState('');

   // Re-sync local state with the latest saved values whenever the modal is (re)opened.
   useEffect(() => {
      if (isOpen) {
         const next = buildContextFromUser(user);
         setContext(next);
         setHasOtherIncome(Boolean(next.otherIncome));
         setError('');
      }
      // eslint-disable-next-line react-hooks/exhaustive-deps
   }, [isOpen]);

   const handleClose = () => {
      if (isSaving) return;
      setError('');
      onClose();
   };

   const canSave = Boolean(context.incomeSetup && context.paydayWindow && context.cashGaps.length > 0);

   const handleSave = async () => {
      if (!canSave || isSaving) return;

      setError('');
      setIsSaving(true);

      const payload = mapBorrowerContextForSave({
         ...context,
         otherIncome: hasOtherIncome ? context.otherIncome : ''
      });

      const result = await dispatch(updateBorrowerContext(payload));
      setIsSaving(false);

      if (updateBorrowerContext.fulfilled.match(result)) {
         showToast(TOAST_TYPES.SUCCESS, 'Bio info saved', 'Your income and budget details have been updated.');
         onClose();
      } else {
         setError(result.error?.message || 'Failed to save bio info. Please try again.');
      }
   };

   if (!isOpen) return null;

   return (
      <div className="fixed inset-0 z-[60] flex items-center justify-center bg-[#12071f]/50 px-5" onClick={handleClose}>
         <div
            className="flex w-full max-w-modal max-h-[85vh] flex-col gap-md-3 overflow-y-auto rounded-md-lg bg-white p-md-4"
            onClick={(e) => e.stopPropagation()}
         >
            <div className="flex flex-col gap-2 text-center">
               <h2 className="text-md-h4 font-semibold text-md-heading">Change Bio Info</h2>
               <p className="text-md-b1 text-md-neutral-1200">
                  Update the details lenders see about your work, income, and what you typically need help with.
               </p>
            </div>

            <div className="flex flex-col gap-1.5">
               <p className="text-md-b2 font-semibold text-md-heading">What do you do for work?</p>
               <p className="text-md-b3 text-md-neutral-700">e.g. teacher, nurse, market vendor, driver</p>
               <input
                  className={`w-full px-md-3 py-md-2 text-md-b2 text-md-heading placeholder:text-md-neutral-600 focus:outline-none ${inputShellClass}`}
                  maxLength={60}
                  onChange={(e) => setContext((current) => ({ ...current, profession: e.target.value }))}
                  placeholder="e.g. teacher"
                  type="text"
                  value={context.profession ?? ''}
               />
            </div>

            <BorrowerContextRadioSection
               label="How would you describe your work?"
               onSelect={(value) => setContext((current) => ({ ...current, incomeSetup: value }))}
               options={incomeSetupOptions}
               selectedValue={context.incomeSetup}
            />

            <BorrowerContextChipSection
               helper="Helps lenders see that repayment timing makes sense."
               label="When do you usually get paid?"
               onSelect={(value) => setContext((current) => ({ ...current, paydayWindow: value }))}
               options={paydayWindowOptions}
               selectedValues={[context.paydayWindow]}
            />

            <BorrowerContextChipSection
               label="What is your approximate monthly income?"
               helper="Helps lenders gauge repayment capacity."
               onSelect={(value) => setContext((current) => ({ ...current, monthlyIncome: value }))}
               options={monthlyIncomeOptions}
               selectedValues={[context.monthlyIncome ?? '']}
            />

            <BorrowerContextChipSection
               label="What do your recurring expenses cost per month?"
               helper="Helps lenders understand your financial commitments."
               onSelect={(value) => setContext((current) => ({ ...current, monthlyExpenses: value }))}
               options={monthlyExpensesOptions}
               selectedValues={[context.monthlyExpenses ?? '']}
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
                              if (!next) setContext((current) => ({ ...current, otherIncome: '' }));
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
                     className={`w-full px-md-3 py-md-2 text-md-b2 text-md-heading placeholder:text-md-neutral-600 focus:outline-none ${inputShellClass}`}
                     maxLength={60}
                     onChange={(e) => setContext((current) => ({ ...current, otherIncome: e.target.value }))}
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
               onSelect={(value) =>
                  setContext((current) => ({
                     ...current,
                     cashGaps: current.cashGaps.includes(value)
                        ? current.cashGaps.filter((entry) => entry !== value)
                        : [...current.cashGaps, value]
                  }))
               }
               options={cashGapOptions}
               selectedValues={context.cashGaps}
            />

            {error ? <p className="text-md-b3 text-md-red-400 text-center w-full">{error}</p> : null}

            <button
               type="button"
               disabled={!canSave || isSaving}
               onClick={handleSave}
               className="w-full py-md-3 px-md-4 bg-md-primary-1200 rounded-md-lg text-md-b1 font-semibold text-md-neutral-100 flex items-center justify-center gap-2 disabled:opacity-50"
            >
               {isSaving ? 'Saving...' : 'Save bio info'}
            </button>
            <button
               type="button"
               onClick={handleClose}
               disabled={isSaving}
               className="w-full py-md-3 px-md-4 border border-md-primary-1200 rounded-md-lg text-md-b1 font-semibold text-md-primary-1200 disabled:opacity-50"
            >
               Cancel
            </button>
         </div>
      </div>
   );
}
