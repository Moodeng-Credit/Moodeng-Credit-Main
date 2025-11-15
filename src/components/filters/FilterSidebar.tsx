import { type ChangeEvent } from 'react';

import { LOAN_AMOUNTS, LOAN_TIME_PERIODS, NETWORKS, REPAYMENT_RATES } from '@/constants/loanOptions';

interface FilterSidebarProps {
   // Amount filters
   amount: string;
   onAmountChange: (amount: string) => void;
   customAmount: string;
   onCustomAmountChange: (value: string) => void;

   // Rate filters
   rate: string;
   onRateChange: (rate: string) => void;

   // Date filters
   selectedDate: Date | null;
   onDateChange: (date: Date | null) => void;

   // Loan time filters
   loanTime: string;
   onLoanTimeChange: (time: string) => void;

   // Network filters
   currentNetwork: string;
   onNetworkChange: (network: string) => void;
}

export default function FilterSidebar({
   amount,
   onAmountChange,
   customAmount,
   onCustomAmountChange,
   rate,
   onRateChange,
   selectedDate,
   onDateChange,
   loanTime,
   onLoanTimeChange,
   currentNetwork,
   onNetworkChange
}: FilterSidebarProps) {
   const handleAmountCheckbox = (value: string) => {
      onAmountChange(value === amount ? '' : value);
   };

   const handleRateCheckbox = (value: string) => {
      onRateChange(value === rate ? '' : value);
   };

   const handleLoanTimeCheckbox = (value: string) => {
      onLoanTimeChange(value === loanTime ? '' : value);
   };

   const handleNetworkCheckbox = (value: string) => {
      onNetworkChange(value === currentNetwork ? '' : value);
   };

   const handleDateChange = (e: ChangeEvent<HTMLInputElement>) => {
      const value = e.target.value;
      onDateChange(value ? new Date(value) : null);
   };

   return (
      <aside className="w-full md:w-64 flex-shrink-0">
         <h2 className="font-semibold text-gray-900 text-sm mb-4">Filters</h2>
         <form className="space-y-6 text-xs md:text-sm text-gray-700">
            {/* Set Lending Limit */}
            <fieldset>
               <legend className="font-semibold mb-2">Set Lending Limit</legend>
               <input
                  value={customAmount}
                  onChange={(e: ChangeEvent<HTMLInputElement>) => onCustomAmountChange(e.target.value)}
                  className="w-full border border-gray-300 rounded px-2 py-1 mb-3 text-xs md:text-sm"
                  placeholder="Custom amount"
                  type="number"
               />
               <div className="space-y-1">
                  {LOAN_AMOUNTS.map((loanAmount) => (
                     <label key={loanAmount} className="flex items-center space-x-2 cursor-pointer">
                        <input
                           className="form-checkbox text-blue-600"
                           type="checkbox"
                           checked={amount === String(loanAmount)}
                           value={loanAmount}
                           onChange={() => handleAmountCheckbox(String(loanAmount))}
                        />
                        <span>${loanAmount}</span>
                     </label>
                  ))}
               </div>
            </fieldset>

            {/* Repayment Amount */}
            <fieldset>
               <legend className="font-semibold mb-2">Repayment amount</legend>
               <div className="space-y-1">
                  {REPAYMENT_RATES.map((repaymentRate) => (
                     <label key={repaymentRate.value} className="flex items-center space-x-2 cursor-pointer">
                        <input
                           className="form-checkbox text-blue-600"
                           type="checkbox"
                           checked={rate === repaymentRate.value}
                           value={repaymentRate.value}
                           onChange={() => handleRateCheckbox(repaymentRate.value)}
                        />
                        <span>{repaymentRate.label}</span>
                     </label>
                  ))}
               </div>
            </fieldset>

            {/* Repayment Date */}
            <fieldset>
               <legend className="font-semibold mb-2">Repayment Date</legend>
               <input
                  value={selectedDate ? selectedDate.toISOString().split('T')[0] : ''}
                  onChange={handleDateChange}
                  className="w-full border border-gray-300 rounded px-2 py-1 text-xs md:text-sm"
                  type="date"
               />
            </fieldset>

            {/* Borrow Type / Loan Time */}
            <fieldset>
               <legend className="font-semibold mb-2">Borrow Type</legend>
               <div className="space-y-1">
                  {LOAN_TIME_PERIODS.map((period) => (
                     <label key={period.value} className="flex items-center space-x-2 cursor-pointer">
                        <input
                           className="form-checkbox text-blue-600"
                           type="checkbox"
                           checked={loanTime === period.value}
                           value={period.value}
                           onChange={() => handleLoanTimeCheckbox(period.value)}
                        />
                        <span>{period.label}</span>
                     </label>
                  ))}
               </div>
            </fieldset>

            {/* Network */}
            <fieldset>
               <legend className="font-semibold mb-2">Network</legend>
               <div className="space-y-1">
                  {NETWORKS.map((network) => (
                     <label key={network.value} className="flex items-center space-x-2 cursor-pointer">
                        <input
                           className="form-checkbox text-blue-600"
                           type="checkbox"
                           checked={currentNetwork === network.value}
                           value={network.value}
                           onChange={() => handleNetworkCheckbox(network.value)}
                        />
                        <span>{network.label}</span>
                     </label>
                  ))}
               </div>
               <p className="text-gray-400 text-[9px] mt-1">More Networks...</p>
            </fieldset>
         </form>
      </aside>
   );
}
