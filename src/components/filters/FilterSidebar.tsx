import { type ChangeEvent, useCallback, useState } from 'react';

import DatePicker from '@/components/filters/DatePicker';

import type { LoanFilters } from '@/utils/loanFilters';

import { BORROW_TYPES, LOAN_AMOUNTS, LOAN_TIME_PERIODS, REPAYMENT_RATES } from '@/constants/loanOptions';

interface FilterSidebarProps {
   filters: LoanFilters;
   onFiltersChange: (filters: Partial<LoanFilters>) => void;
   customAmount: string;
   onCustomAmountChange: (value: string) => void;
}

export default function FilterSidebar({ filters, onFiltersChange, customAmount, onCustomAmountChange }: FilterSidebarProps) {
   const [customRepaymentAmount, setCustomRepaymentAmount] = useState('');

   const handleAmountChange = useCallback(
      (value: string) => {
         onFiltersChange({
            amount: filters.amount === value ? '' : value
         });
         if (filters.amount !== value) {
            onCustomAmountChange('');
         }
      },
      [filters.amount, onFiltersChange, onCustomAmountChange]
   );

   const handleRateChange = useCallback(
      (value: string) => {
         onFiltersChange({
            rate: filters.rate === value ? '' : value
         });
         if (filters.rate !== value) {
            setCustomRepaymentAmount('');
         }
      },
      [filters.rate, onFiltersChange]
   );

   const handleDateChange = useCallback(
      (date: Date | null) => {
         onFiltersChange({ date });
      },
      [onFiltersChange]
   );

   const handleLoanTimeChange = useCallback(
      (value: string) => {
         onFiltersChange({
            loanTime: filters.loanTime === value ? '' : value
         });
      },
      [filters.loanTime, onFiltersChange]
   );

   const handleBorrowTypeChange = useCallback(
      (value: string) => {
         const currentTypes = filters.borrowType || [];
         const newTypes = currentTypes.includes(value) ? currentTypes.filter((t) => t !== value) : [...currentTypes, value];
         onFiltersChange({ borrowType: newTypes });
      },
      [filters.borrowType, onFiltersChange]
   );

   return (
      <aside className="w-full md:w-72 flex-shrink-0">
         <h2 className="font-bold text-[#1a1a2e] text-xl mb-6">Filters</h2>

         <div className="space-y-6">
            {/* Set Lending Limit */}
            <div>
               <h3 className="font-semibold text-gray-900 text-sm mb-3">Set Lending Limit</h3>
               <input
                  value={customAmount}
                  onChange={(e: ChangeEvent<HTMLInputElement>) => {
                     onCustomAmountChange(e.target.value);
                     if (e.target.value && filters.amount) {
                        onFiltersChange({ amount: '' });
                     }
                  }}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 mb-3 text-sm focus:ring-blue-500 focus:border-blue-500 focus:outline-none"
                  placeholder="Custom Amount"
                  type="number"
               />
               <div className="space-y-2">
                  {LOAN_AMOUNTS.map((amount) => (
                     <label key={amount} className="flex items-center gap-3 cursor-pointer">
                        <input
                           type="radio"
                           name="lendingLimit"
                           value={amount}
                           checked={filters.amount === String(amount)}
                           onChange={() => handleAmountChange(String(amount))}
                           className="w-4 h-4 text-blue-600 border-gray-300 focus:ring-blue-500"
                        />
                        <span className="text-sm text-gray-700">${amount}</span>
                     </label>
                  ))}
               </div>
            </div>

            {/* Repayment Amount */}
            <div>
               <h3 className="font-semibold text-gray-900 text-sm mb-3">Repayment Amount</h3>
               <input
                  value={customRepaymentAmount}
                  onChange={(e: ChangeEvent<HTMLInputElement>) => {
                     setCustomRepaymentAmount(e.target.value);
                     if (e.target.value && filters.rate) {
                        onFiltersChange({ rate: '' });
                     }
                  }}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 mb-3 text-sm focus:ring-blue-500 focus:border-blue-500 focus:outline-none"
                  placeholder="Custom Amount"
                  type="text"
               />
               <div className="space-y-2">
                  {REPAYMENT_RATES.map((rate) => (
                     <label key={rate.value} className="flex items-center gap-3 cursor-pointer">
                        <input
                           type="radio"
                           name="repaymentRate"
                           value={rate.value}
                           checked={filters.rate === rate.value}
                           onChange={() => handleRateChange(rate.value)}
                           className="w-4 h-4 text-blue-600 border-gray-300 focus:ring-blue-500"
                        />
                        <span className="text-sm text-gray-700">{rate.label}</span>
                     </label>
                  ))}
               </div>
            </div>

            {/* Repayment Date */}
            <div>
               <h3 className="font-semibold text-gray-900 text-sm mb-3">Repayment Date</h3>
               <div className="mb-3">
                  <DatePicker value={filters.date || null} onChange={handleDateChange} placeholder="Pick a date..." />
               </div>
               <div className="space-y-2">
                  {LOAN_TIME_PERIODS.map((period) => (
                     <label key={period.value} className="flex items-center gap-3 cursor-pointer">
                        <input
                           type="radio"
                           name="loanTime"
                           value={period.value}
                           checked={filters.loanTime === period.value}
                           onChange={() => handleLoanTimeChange(period.value)}
                           className="w-4 h-4 text-blue-600 border-gray-300 focus:ring-blue-500"
                        />
                        <span className="text-sm text-gray-700">{period.label}</span>
                     </label>
                  ))}
               </div>
            </div>

            {/* Borrow Type */}
            <div>
               <h3 className="font-semibold text-gray-900 text-sm mb-3">Borrow Type</h3>
               <div className="space-y-2">
                  {BORROW_TYPES.map((type) => (
                     <label key={type.value} className="flex items-center gap-3 cursor-pointer">
                        <input
                           type="checkbox"
                           value={type.value}
                           checked={filters.borrowType?.includes(type.value) || false}
                           onChange={() => handleBorrowTypeChange(type.value)}
                           className="w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
                        />
                        <span className="text-sm text-gray-700">{type.label}</span>
                     </label>
                  ))}
               </div>
            </div>
         </div>
      </aside>
   );
}
