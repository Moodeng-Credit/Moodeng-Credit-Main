import { type PointerEvent, type ReactNode, useEffect, useMemo, useRef, useState } from 'react';

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
   const dragStartY = useRef<number | null>(null);
   const dragOffsetRef = useRef(0);
   const sideSwipeStart = useRef<{ x: number; y: number } | null>(null);
   const sideSwipeOffsetRef = useRef(0);
   const [dragOffset, setDragOffset] = useState(0);
   const [sideSwipeOffset, setSideSwipeOffset] = useState(0);

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

   const handleDragStart = (event: PointerEvent<HTMLDivElement>) => {
      dragStartY.current = event.clientY;
      dragOffsetRef.current = 0;
      event.currentTarget.setPointerCapture(event.pointerId);
   };

   const handleDragMove = (event: PointerEvent<HTMLDivElement>) => {
      if (dragStartY.current === null) return;
      const nextOffset = Math.max(0, event.clientY - dragStartY.current);
      dragOffsetRef.current = nextOffset;
      setDragOffset(nextOffset);
   };

   const handleDragEnd = (event: PointerEvent<HTMLDivElement>) => {
      if (dragStartY.current === null) return;
      event.currentTarget.releasePointerCapture(event.pointerId);
      if (dragOffsetRef.current > 96) {
         onClose?.();
      }
      dragStartY.current = null;
      dragOffsetRef.current = 0;
      setDragOffset(0);
   };

   const handleSideSwipeStart = (event: PointerEvent<HTMLDivElement>) => {
      sideSwipeStart.current = { x: event.clientX, y: event.clientY };
      sideSwipeOffsetRef.current = 0;
      event.currentTarget.setPointerCapture(event.pointerId);
   };

   const handleSideSwipeMove = (event: PointerEvent<HTMLDivElement>) => {
      if (!sideSwipeStart.current) return;
      const nextX = Math.max(0, event.clientX - sideSwipeStart.current.x);
      const nextY = Math.abs(event.clientY - sideSwipeStart.current.y);
      if (nextY > nextX && nextY > 16) return;
      sideSwipeOffsetRef.current = nextX;
      setSideSwipeOffset(nextX);
   };

   const handleSideSwipeEnd = (event: PointerEvent<HTMLDivElement>) => {
      if (!sideSwipeStart.current) return;
      event.currentTarget.releasePointerCapture(event.pointerId);
      if (sideSwipeOffsetRef.current > 80) {
         onClose?.();
      }
      sideSwipeStart.current = null;
      sideSwipeOffsetRef.current = 0;
      setSideSwipeOffset(0);
   };

   return (
      <div className="fixed inset-0 z-[70] flex items-end justify-center">
         <button aria-label="Close filters" className="absolute inset-0 bg-black/40" type="button" onClick={onClose} />

         <aside
            className="relative w-full sm:max-w-[440px] max-h-[85vh] rounded-t-[24px] sm:rounded-[24px] sm:mb-6 bg-md-neutral-100 shadow-2xl flex flex-col overflow-hidden animate-[filterSheetUp_0.25s_ease-out] transition-transform duration-150 ease-out"
            style={{ transform: `translate(${sideSwipeOffset}px, ${dragOffset}px)` }}
         >
            <style>
               {`
                  @keyframes filterSheetUp {
                     from { transform: translateY(100%); }
                     to { transform: translateY(0); }
                  }
               `}
            </style>

            <div
               aria-label="Swipe right to close filters"
               className="absolute bottom-0 left-0 top-0 z-10 w-8 touch-none cursor-ew-resize select-none"
               onPointerDown={handleSideSwipeStart}
               onPointerMove={handleSideSwipeMove}
               onPointerUp={handleSideSwipeEnd}
               onPointerCancel={handleSideSwipeEnd}
               role="presentation"
            />

            <div className="bg-md-neutral-100 shrink-0">
               <div
                  className="touch-none cursor-grab select-none pb-4 pt-3 active:cursor-grabbing"
                  onPointerDown={handleDragStart}
                  onPointerMove={handleDragMove}
                  onPointerUp={handleDragEnd}
                  onPointerCancel={handleDragEnd}
               >
                  <div className="w-10 h-1 bg-md-neutral-500 rounded-full mx-auto" />
               </div>
               <h2 className="text-md-h5 font-semibold text-md-heading px-md-4 mb-4">Filters</h2>

               <div className="flex gap-1.5 px-md-4 pb-3 overflow-x-auto">
                  {tabs.map((tab) => (
                     <button
                        key={tab.id}
                        type="button"
                        onClick={() => setActiveTab(tab.id)}
                        className={`shrink-0 px-3 py-1.5 rounded-md-sm border text-md-b3 font-medium whitespace-nowrap transition-all duration-150 active:scale-[0.97] focus:outline-none focus-visible:ring-2 focus-visible:ring-md-primary-1200 ${
                           activeTab === tab.id
                              ? 'bg-md-primary-100 text-md-primary-1200 border-md-primary-1200 shadow-sm'
                              : 'bg-md-neutral-100 text-md-neutral-1100 border-md-neutral-600 hover:bg-md-neutral-200 hover:border-md-neutral-800'
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
                  className="flex-1 rounded-md-lg border border-md-neutral-600 px-5 py-3 text-md-b1 font-medium text-md-heading transition-all duration-150 hover:bg-md-neutral-200 hover:border-md-neutral-800 active:scale-[0.98] active:bg-md-neutral-300 focus:outline-none focus-visible:ring-2 focus-visible:ring-md-primary-1200"
               >
                  Reset
               </button>
               <button
                  type="button"
                  onClick={applyFilters}
                  className="flex-1 rounded-md-lg bg-md-primary-1200 px-5 py-3 text-md-b1 font-medium text-md-neutral-100 transition-all duration-150 hover:brightness-95 active:scale-[0.98] active:brightness-90 focus:outline-none focus-visible:ring-2 focus-visible:ring-md-primary-1200"
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
         className={`px-3.5 py-2 rounded-md-sm border text-md-b3 font-normal transition-all duration-150 active:scale-[0.97] focus:outline-none focus-visible:ring-2 focus-visible:ring-md-primary-1200 ${
            selected
               ? 'bg-md-primary-100 text-md-primary-1200 border-md-primary-1200 shadow-sm'
               : 'bg-md-neutral-100 text-md-neutral-1100 border-md-neutral-600 hover:bg-md-neutral-200 hover:border-md-neutral-800'
         }`}
      >
         {label}
      </button>
   );
}
