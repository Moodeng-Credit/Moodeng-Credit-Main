import { type PointerEvent, type ReactNode, useEffect, useId, useMemo, useRef, useState } from 'react';

import { Check, HelpCircle } from 'lucide-react';

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
   { id: 'rate', label: 'Payback %' },
   { id: 'date', label: 'Date' },
   { id: 'type', label: 'Type' }
];

export default function FilterSidebar({ filters, onFiltersChange, customAmount, onCustomAmountChange, onClose }: FilterSidebarProps) {
   const [activeTab, setActiveTab] = useState<FilterTab>('amount');
   const [draftFilters, setDraftFilters] = useState<LoanFilters>(filters);
   const draftFiltersRef = useRef(filters);
   const draftCustomAmountRef = useRef(customAmount);
   const dragStartY = useRef<number | null>(null);
   const dragOffsetRef = useRef(0);
   const sideSwipeStart = useRef<{ x: number; y: number } | null>(null);
   const sideSwipeOffsetRef = useRef(0);
   const [dragOffset, setDragOffset] = useState(0);
   const [sideSwipeOffset, setSideSwipeOffset] = useState(0);

   useEffect(() => {
      draftFiltersRef.current = filters;
      draftCustomAmountRef.current = customAmount;
      setDraftFilters(filters);
   }, [filters, customAmount]);

   const selectedBorrowTypes = useMemo(() => draftFilters.borrowType || [], [draftFilters.borrowType]);

   const updateDraft = (nextFilters: Partial<LoanFilters>, nextCustomAmount = draftCustomAmountRef.current) => {
      const updated = { ...draftFiltersRef.current, ...nextFilters };
      if ('loanTime' in nextFilters && nextFilters.loanTime) updated.date = null;
      if ('date' in nextFilters && nextFilters.date) updated.loanTime = '';

      draftFiltersRef.current = updated;
      draftCustomAmountRef.current = nextCustomAmount;
      setDraftFilters(updated);

      onCustomAmountChange(nextCustomAmount);
      onFiltersChange({
         amount: updated.amount || '',
         rate: updated.rate || '',
         date: updated.date || null,
         loanTime: updated.loanTime || '',
         borrowType: updated.borrowType || [],
         network: updated.network || [],
         sortBy: updated.sortBy
      });
   };

   const toggleSingleValue = (field: 'amount' | 'rate' | 'loanTime', value: string) => {
      const nextValue = draftFiltersRef.current[field] === value ? '' : value;
      updateDraft({ [field]: nextValue }, field === 'amount' && nextValue ? '' : draftCustomAmountRef.current);
   };

   const toggleBorrowType = (value: string) => {
      const currentBorrowTypes = draftFiltersRef.current.borrowType || [];
      updateDraft({
         borrowType: currentBorrowTypes.includes(value)
            ? currentBorrowTypes.filter((type) => type !== value)
            : [...currentBorrowTypes, value]
      });
   };

   const handleTabChange = (tab: FilterTab) => {
      setActiveTab(tab);
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
         <button aria-label="Close filters" className="absolute inset-0 bg-transparent" type="button" onClick={onClose} />

         <aside
            className="relative flex max-h-[85vh] w-full flex-col overflow-hidden rounded-t-[24px] border border-white/70 bg-gradient-to-b from-[#fdfbff] via-white to-white shadow-[0_-14px_42px_rgba(96,16,210,0.16),0_-2px_12px_rgba(0,0,0,0.08)] transition-transform duration-150 ease-out animate-[filterSheetUp_0.25s_ease-out] dark:border-[#342248] dark:from-[#17101f] dark:via-[#17101f] dark:to-[#120c19] dark:shadow-[0_-14px_42px_rgba(0,0,0,0.5)] sm:mb-6 sm:max-w-[440px] sm:rounded-[24px]"
            style={{ transform: `translate(${sideSwipeOffset}px, ${dragOffset}px)` }}
         >
            <style>
               {`
                  @keyframes filterSheetUp {
                     from { transform: translateY(100%); }
                     to { transform: translateY(0); }
                  }

                  .filter-control {
                     -webkit-tap-highlight-color: transparent;
                     appearance: none;
                     outline: none !important;
                  }

                  .filter-control:focus,
                  .filter-control:active {
                     outline: none !important;
                  }

                  .filter-control:active {
                     background: #F7F2FF !important;
                     border-color: #7C2DFF !important;
                     box-shadow: 0 0 0 5px rgba(124, 45, 255, 0.16), 0 7px 18px rgba(96, 16, 210, 0.20), inset 0 1px 0 rgba(255, 255, 255, 0.92) !important;
                     transform: scale(0.97);
                  }

                  .filter-control:focus-visible {
                     outline: 3px solid #C7A6FF !important;
                     outline-offset: 4px;
                  }

                  .filter-control:active:focus-visible {
                     outline: none !important;
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

            <div className="shrink-0 bg-gradient-to-b from-[#fdfbff] via-white to-white dark:from-[#17101f] dark:via-[#17101f] dark:to-[#17101f]">
               <div
                  className="touch-none cursor-grab select-none pb-4 pt-3 active:cursor-grabbing"
                  onPointerDown={handleDragStart}
                  onPointerMove={handleDragMove}
                  onPointerUp={handleDragEnd}
                  onPointerCancel={handleDragEnd}
               >
                  <div className="mx-auto h-1 w-10 rounded-full bg-gradient-to-r from-[#b8a4f5] to-md-primary-1200 shadow-[0_1px_3px_rgba(96,16,210,0.22)] dark:from-[#d6c6ff] dark:to-[#8f5bff]" />
               </div>
               <h2 className="mb-4 px-md-4 text-md-h5 font-semibold text-md-heading [text-shadow:0_1px_2px_rgba(0,0,0,0.03)] dark:text-[#f6f0ff]">
                  Filters
               </h2>

               <div className="flex items-center gap-1.5 overflow-x-auto px-md-4 pb-3">
                  {tabs.map((tab) => (
                     <button
                        key={tab.id}
                        type="button"
                        onClick={() => handleTabChange(tab.id)}
                        className={`filter-control flex h-12 shrink-0 items-center justify-center rounded-[10px] border px-3.5 text-md-b3 font-medium leading-none whitespace-nowrap transition-all duration-150 ${
                           activeTab === tab.id
                              ? 'border-[#7C2DFF] bg-[#F7F2FF] text-[#5B16E8] shadow-[0_3px_10px_rgba(96,16,210,0.14),inset_0_0_0_1px_rgba(124,45,255,0.45)] dark:border-[#a77bff] dark:bg-[#26133d] dark:text-[#f4edff] dark:shadow-[0_3px_10px_rgba(0,0,0,0.28),inset_0_0_0_1px_rgba(167,123,255,0.45)]'
                              : 'border-transparent bg-white text-md-neutral-1100 shadow-[0_2px_8px_rgba(82,57,130,0.08),inset_0_1px_0_rgba(255,255,255,0.92)] hover:shadow-[0_3px_10px_rgba(82,57,130,0.11),inset_0_1px_0_rgba(255,255,255,0.92)] dark:border-[#2e203d] dark:bg-[#21162c] dark:text-[#f0e9f8] dark:shadow-[0_2px_8px_rgba(0,0,0,0.24)] dark:hover:bg-[#281b35]'
                        }`}
                     >
                        {tab.label}
                     </button>
                  ))}
               </div>
            </div>

            <div className="flex-1 overflow-y-auto border-t border-[#eee8f7] px-md-4 pb-6 pt-4 dark:border-[#31213f]">
               {activeTab === 'amount' ? (
                  <FilterSection title="Credit Limit">
                     <div className="grid grid-cols-2 gap-2">
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
               ) : null}

               {activeTab === 'rate' ? (
                  <FilterSection
                     title="Payback Amount"
                     tooltip="Payback is the total amount the borrower agrees to return. This filters the extra payback above the loan principal. Example: a $10 loan with a $13 payback is 30%."
                  >
                     <div className="grid grid-cols-2 gap-2">
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
               ) : null}

               {activeTab === 'date' ? (
                  <FilterSection title="Repayment Date">
                     <div className="grid grid-cols-2 gap-2">
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
               ) : null}

               {activeTab === 'type' ? (
                  <FilterSection title="Borrow Type">
                     <div className="grid grid-cols-2 gap-2">
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
               ) : null}
            </div>
         </aside>
      </div>
   );
}

function FilterSection({ title, tooltip, children }: { title: string; tooltip?: string; children: ReactNode }) {
   const [isTooltipOpen, setIsTooltipOpen] = useState(false);
   const tooltipId = useId();

   return (
      <section>
         <div className="mb-3 flex items-center gap-1.5">
            <h3 className="text-md-b1 font-normal text-md-heading dark:text-[#f6f0ff]">{title}</h3>
            {tooltip ? (
               <span className="group relative inline-flex">
                  <button
                     type="button"
                     aria-label={`${title} help`}
                     aria-describedby={isTooltipOpen ? tooltipId : undefined}
                     aria-expanded={isTooltipOpen}
                     onClick={() => setIsTooltipOpen((open) => !open)}
                     onBlur={() => setIsTooltipOpen(false)}
                     className="flex h-6 w-6 items-center justify-center rounded-full text-md-primary-1200 transition-colors duration-150 hover:bg-md-primary-100 focus:outline-none focus-visible:ring-2 focus-visible:ring-md-primary-1200 dark:text-[#c7a6ff] dark:hover:bg-[#2b1a3d]"
                  >
                     <HelpCircle aria-hidden="true" className="h-4 w-4" strokeWidth={2} />
                  </button>
                  <span
                     id={tooltipId}
                     role="tooltip"
                     className={`absolute left-1/2 top-full z-20 mt-2 w-[260px] -translate-x-1/2 rounded-[12px] border border-[#d6bcfa] bg-white px-3 py-2 text-left text-xs font-medium leading-[18px] text-[#3c3150] shadow-[0_8px_22px_rgba(27,28,29,0.14)] transition-opacity duration-150 group-hover:visible group-hover:opacity-100 dark:border-[#5a3f7b] dark:bg-[#21162c] dark:text-[#f0e9f8] dark:shadow-[0_8px_22px_rgba(0,0,0,0.38)] ${
                        isTooltipOpen ? 'visible opacity-100' : 'invisible opacity-0'
                     }`}
                  >
                     {tooltip}
                  </span>
               </span>
            ) : null}
         </div>
         {children}
      </section>
   );
}

function FilterChip({ label, selected, onClick }: { label: string; selected: boolean; onClick: () => void }) {
   return (
      <button
         type="button"
         onClick={onClick}
         aria-pressed={selected}
         className={`filter-control relative flex min-h-[54px] w-full items-center justify-center rounded-[10px] border px-4 py-2.5 pr-7 text-center text-md-b3 font-medium transition-all duration-150 ${
            selected
               ? 'border-[1.5px] border-[#C99BFF] bg-[#FBF7FF] text-[#5B16E8] shadow-[0_2px_8px_rgba(96,16,210,0.16),inset_0_1px_0_rgba(255,255,255,0.92)] dark:border-[#c99bff] dark:bg-[#2a1740] dark:text-[#f4edff] dark:shadow-[0_2px_8px_rgba(0,0,0,0.28)]'
               : 'border-transparent bg-white text-md-neutral-1100 shadow-[0_2px_8px_rgba(82,57,130,0.08),inset_0_1px_0_rgba(255,255,255,0.92)] hover:shadow-[0_3px_10px_rgba(82,57,130,0.11),inset_0_1px_0_rgba(255,255,255,0.92)] dark:border-[#2e203d] dark:bg-[#21162c] dark:text-[#f0e9f8] dark:shadow-[0_2px_8px_rgba(0,0,0,0.24)] dark:hover:bg-[#281b35]'
         }`}
      >
         {label}
         {selected ? (
            <Check aria-hidden="true" className="absolute right-1.5 top-1.5 h-3 w-3" strokeWidth={3} style={{ color: '#5B16E8' }} />
         ) : null}
      </button>
   );
}
