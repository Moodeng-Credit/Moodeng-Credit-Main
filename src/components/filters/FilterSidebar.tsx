import { type ReactNode, useEffect, useMemo, useState } from 'react';

import type { LoanFilters } from '@/utils/loanFilters';

import { BORROW_TYPES, LOAN_AMOUNTS, LOAN_TIME_PERIODS, REPAYMENT_RATES } from '@/constants/loanOptions';

interface FilterSidebarProps {
   filters: LoanFilters;
   onFiltersChange: (filters: Partial<LoanFilters>) => void;
   customAmount: string;
   onCustomAmountChange: (value: string) => void;
   onClose?: () => void;
}

type FilterTab = 'amount' | 'rate' | 'date' | 'type';

const tabs: { id: FilterTab; label: string }[] = [
   { id: 'amount', label: 'Credit Limit' },
   { id: 'rate', label: 'Repayment %' },
   { id: 'date', label: 'Date' },
   { id: 'type', label: 'Type' }
];

const emptyFilters: LoanFilters = {
   amount: '',
   rate: '',
   date: null,
   loanTime: '',
   borrowType: [],
   network: [],
   search: '',
   sortBy: undefined
};

export default function FilterSidebar({
   filters,
   onFiltersChange,
   customAmount,
   onCustomAmountChange,
   onClose
}: FilterSidebarProps) {
   const [activeTab, setActiveTab] = useState<FilterTab>('amount');
   const [draftFilters, setDraftFilters] = useState<LoanFilters>(filters);
   const [draftCustomAmount, setDraftCustomAmount] = useState(customAmount);

   useEffect(() => {
      setDraftFilters(filters);
      setDraftCustomAmount(customAmount);
   }, [filters, customAmount]);

   const selectedBorrowTypes = useMemo(() => draftFilters.borrowType || [], [draftFilters.borrowType]);

   const updateDraft = (nextFilters: Partial<LoanFilters>) => {
      setDraftFilters((prev) => {
         const updated = { ...prev, ...nextFilters };
         if ('loanTime' in nextFilters && nextFilters.loanTime) updated.date = null;
         if ('date' in nextFilters && nextFilters.date) updated.loanTime = '';
         return updated;
      });
   };

   const toggleSingleValue = (field: 'amount' | 'rate' | 'loanTime', value: string) => {
      updateDraft({ [field]: draftFilters[field] === value ? '' : value });
      if (field === 'amount' && draftFilters.amount !== value) {
         setDraftCustomAmount('');
      }
   };

   const toggleBorrowType = (value: string) => {
      updateDraft({
         borrowType: selectedBorrowTypes.includes(value)
            ? selectedBorrowTypes.filter((type) => type !== value)
            : [...selectedBorrowTypes, value]
      });
   };

   const resetFilters = () => {
      setDraftFilters(emptyFilters);
      setDraftCustomAmount('');
   };

   const applyFilters = () => {
      onCustomAmountChange(draftCustomAmount);
      onFiltersChange({
         amount: draftFilters.amount || '',
         rate: draftFilters.rate || '',
         date: draftFilters.date || null,
         loanTime: draftFilters.loanTime || '',
         borrowType: draftFilters.borrowType || [],
         network: draftFilters.network || [],
         sortBy: draftFilters.sortBy
      });
      onClose?.();
   };

   return (
      <div className="fixed inset-0 z-[70] flex items-end justify-center">
         <button aria-label="Close filters" className="absolute inset-0 bg-black/40" type="button" onClick={onClose} />

         <aside className="relative w-full sm:max-w-[440px] max-h-[85vh] rounded-t-[24px] sm:rounded-[24px] sm:mb-6 bg-md-neutral-100 shadow-2xl flex flex-col overflow-hidden animate-[filterSheetUp_0.25s_ease-out]">
            <style>
               {`
                  @keyframes filterSheetUp {
                     from { transform: translateY(100%); }
                     to { transform: translateY(0); }
                  }
               `}
            </style>

            <div className="bg-md-neutral-100 shrink-0">
               <div className="w-10 h-1 bg-md-neutral-500 rounded-full mx-auto mt-3 mb-4" />
               <h2 className="text-md-h5 font-semibold text-md-heading px-md-4 mb-4">Filters</h2>

               <div className="flex gap-1.5 px-md-4 pb-3 overflow-x-auto">
                  {tabs.map((tab) => (
                     <button
                        key={tab.id}
                        type="button"
                        onClick={() => setActiveTab(tab.id)}
                        className={`shrink-0 px-3 py-1.5 rounded-md-sm border text-md-b3 font-medium whitespace-nowrap transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-md-primary-1200 ${
                           activeTab === tab.id
                              ? 'bg-md-primary-100 text-md-primary-1200 border-md-primary-1200'
                              : 'bg-md-neutral-100 text-md-neutral-1100 border-md-neutral-600'
                        }`}
                     >
                        {tab.label}
                     </button>
                  ))}
               </div>
            </div>

            <div className="flex-1 overflow-y-auto px-md-4 pt-4 pb-6 border-t border-md-neutral-300">
               {activeTab === 'amount' && (
                  <FilterSection title="Credit Limit">
                     <div className="flex flex-wrap gap-2">
                        {LOAN_AMOUNTS.map((amount) => (
                           <FilterChip
                              key={amount.value}
                              label={amount.label}
                              selected={draftFilters.amount === amount.value}
                              onClick={() => toggleSingleValue('amount', amount.value)}
                           />
                        ))}
                     </div>
                  </FilterSection>
               )}

               {activeTab === 'rate' && (
                  <FilterSection title="Repayment Amount">
                     <div className="flex flex-wrap gap-2">
                        {REPAYMENT_RATES.map((rate) => (
                           <FilterChip
                              key={rate.value}
                              label={rate.label}
                              selected={draftFilters.rate === rate.value}
                              onClick={() => toggleSingleValue('rate', rate.value)}
                           />
                        ))}
                     </div>
                  </FilterSection>
               )}

               {activeTab === 'date' && (
                  <FilterSection title="Repayment Date">
                     <div className="flex flex-wrap gap-2">
                        {LOAN_TIME_PERIODS.map((period) => (
                           <FilterChip
                              key={period.value}
                              label={period.label}
                              selected={draftFilters.loanTime === period.value}
                              onClick={() => toggleSingleValue('loanTime', period.value)}
                           />
                        ))}
                     </div>
                  </FilterSection>
               )}

               {activeTab === 'type' && (
                  <FilterSection title="Borrow Type">
                     <div className="flex flex-wrap gap-2">
                        {BORROW_TYPES.map((type) => (
                           <FilterChip
                              key={type.value}
                              label={type.label}
                              selected={selectedBorrowTypes.includes(type.value)}
                              onClick={() => toggleBorrowType(type.value)}
                           />
                        ))}
                     </div>
                  </FilterSection>
               )}
            </div>

            <div className="shrink-0 bg-md-neutral-100 px-md-4 py-4 border-t border-md-neutral-400 flex gap-3">
               <button
                  type="button"
                  onClick={resetFilters}
                  className="flex-1 rounded-md-lg border border-md-neutral-600 px-5 py-3 text-md-b1 font-medium text-md-heading focus:outline-none focus-visible:ring-2 focus-visible:ring-md-primary-1200"
               >
                  Reset
               </button>
               <button
                  type="button"
                  onClick={applyFilters}
                  className="flex-1 rounded-md-lg bg-md-primary-1200 px-5 py-3 text-md-b1 font-medium text-md-neutral-100 focus:outline-none focus-visible:ring-2 focus-visible:ring-md-primary-1200"
               >
                  Apply
               </button>
            </div>
         </aside>
      </div>
   );
}

function FilterSection({ title, children }: { title: string; children: ReactNode }) {
   return (
      <div>
         <h3 className="text-md-b1 font-normal text-md-heading mb-3">{title}</h3>
         {children}
      </div>
   );
}

function FilterChip({ label, selected, onClick }: { label: string; selected: boolean; onClick: () => void }) {
   return (
      <button
         type="button"
         onClick={onClick}
         className={`px-3.5 py-2 rounded-md-sm border text-md-b3 font-normal transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-md-primary-1200 ${
            selected
               ? 'bg-md-primary-100 text-md-primary-1200 border-md-primary-1200'
               : 'bg-md-neutral-100 text-md-neutral-1100 border-md-neutral-600'
         }`}
      >
         {label}
      </button>
   );
}
