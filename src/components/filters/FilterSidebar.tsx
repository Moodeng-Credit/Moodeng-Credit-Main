import { type ChangeEvent, useCallback, useMemo } from 'react';

import CheckboxFilterGroup, { type FilterOption } from '@/components/filters/CheckboxFilterGroup';

import type { LoanFilters } from '@/utils/loanFilters';

import { LOAN_AMOUNTS, LOAN_TIME_PERIODS, REPAYMENT_RATES } from '@/constants/loanOptions';

interface FilterSidebarProps {
   filters: LoanFilters;
   onFiltersChange: (filters: Partial<LoanFilters>) => void;
   customAmount: string;
   onCustomAmountChange: (value: string) => void;
}

export default function FilterSidebar({ filters, onFiltersChange, customAmount, onCustomAmountChange }: FilterSidebarProps) {
   // Convert LOAN_AMOUNTS to FilterOption[]
   const amountOptions: FilterOption[] = useMemo(
      () =>
         LOAN_AMOUNTS.map((amount) => ({
            value: String(amount),
            label: `$${amount}`,
            checked: filters.amount === String(amount)
         })),
      [filters.amount]
   );

   // Convert REPAYMENT_RATES to FilterOption[]
   const rateOptions: FilterOption[] = useMemo(
      () =>
         REPAYMENT_RATES.map((rate) => ({
            value: rate.value,
            label: rate.label,
            checked: filters.rate === rate.value
         })),
      [filters.rate]
   );

   // Convert LOAN_TIME_PERIODS to FilterOption[]
   const loanTimeOptions: FilterOption[] = useMemo(
      () =>
         LOAN_TIME_PERIODS.map((period) => ({
            value: period.value,
            label: period.label,
            checked: filters.loanTime === period.value
         })),
      [filters.loanTime]
   );

   const handleFilterChange = useCallback(
      (filterKey: keyof LoanFilters) => (value: string) => {
         onFiltersChange({
            [filterKey]: filters[filterKey] === value ? '' : value
         });

         if (filterKey === 'amount' && filters[filterKey] !== value) {
            onCustomAmountChange('');
         }
      },
      [filters, onFiltersChange, onCustomAmountChange]
   );

   const handleDateChange = useCallback(
      (e: ChangeEvent<HTMLInputElement>) => {
         const value = e.target.value;
         onFiltersChange({
            date: value ? new Date(value) : null
         });
      },
      [onFiltersChange]
   );

   return (
      <aside className="w-full md:w-64 flex-shrink-0">
         <h2 className="font-semibold text-gray-900 text-sm mb-4">Filters</h2>
         <form className="space-y-6 text-xs md:text-sm text-gray-700">
            {/* Set Lending Limit */}
            <fieldset>
               <legend className="font-semibold mb-2">Set Lending Limit</legend>
               <input
                  value={customAmount}
                  onChange={(e: ChangeEvent<HTMLInputElement>) => {
                     onCustomAmountChange(e.target.value);
                     if (e.target.value && filters.amount) {
                        onFiltersChange({ amount: '' });
                     }
                  }}
                  className="w-full border border-gray-300 rounded px-2 py-1 mb-3 text-xs md:text-sm"
                  placeholder="Custom amount"
                  type="number"
               />
               <div className="space-y-1">
                  {amountOptions.map((option) => (
                     <label key={option.value} className="flex items-center space-x-2 cursor-pointer">
                        <input
                           className="form-checkbox text-blue-600"
                           type="checkbox"
                           checked={option.checked}
                           value={option.value}
                           onChange={() => handleFilterChange('amount')(option.value)}
                        />
                        <span>{option.label}</span>
                     </label>
                  ))}
               </div>
            </fieldset>

            {/* Repayment Amount */}
            <CheckboxFilterGroup legend="Repayment amount" options={rateOptions} onChange={handleFilterChange('rate')} />

            {/* Repayment Date */}
            <fieldset>
               <legend className="font-semibold mb-2">Repayment Date</legend>
               <input
                  value={filters.date ? filters.date.toISOString().split('T')[0] : ''}
                  onChange={handleDateChange}
                  className="w-full border border-gray-300 rounded px-2 py-1 text-xs md:text-sm"
                  type="date"
               />
            </fieldset>

            {/* Borrow Type / Loan Time */}
            <CheckboxFilterGroup legend="Borrow Type" options={loanTimeOptions} onChange={handleFilterChange('loanTime')} />
         </form>
      </aside>
   );
}
