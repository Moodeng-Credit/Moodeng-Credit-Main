import { CASHOUT_COUNTRIES, type CashoutCountry } from '@/hooks/useCashoutCountry';

interface CountrySwitchProps {
   value: CashoutCountry;
   onChange: (country: CashoutCountry) => void;
   label?: string;
   className?: string;
}

// Segmented "Where are you?" control for the withdraw and repay screens — always visible so a
// borrower whose IP was misread can still reach their own country's options.
export default function CountrySwitch({ value, onChange, label = 'Where are you?', className = '' }: CountrySwitchProps) {
   return (
      <div className={className}>
         <p className="mb-1.5 text-[12px] font-semibold text-[#6b6090] dark:text-[#a095c8]">{label}</p>
         <div role="radiogroup" aria-label={label} className="flex gap-1.5">
            {CASHOUT_COUNTRIES.map((option) => {
               const active = option.code === value;
               return (
                  <button
                     key={option.code}
                     type="button"
                     role="radio"
                     aria-checked={active}
                     onClick={() => onChange(option.code)}
                     style={{ touchAction: 'manipulation' }}
                     className={`flex min-h-[40px] flex-1 items-center justify-center gap-1.5 rounded-full px-2 text-[13px] font-semibold transition focus:outline-none focus-visible:ring-2 focus-visible:ring-[#6c3fe0]/50 ${
                        active
                           ? 'border-2 border-[#6c3fe0] bg-[#f3effe] text-[#1a1240] dark:bg-[#2a1740] dark:text-white'
                           : 'border border-[#e9e3f8] bg-white text-[#6b6090] hover:border-[#c4b5fd] dark:border-[#3d2a60] dark:bg-[#1e1535] dark:text-[#a095c8]'
                     }`}
                  >
                     <span aria-hidden="true">{option.flag}</span>
                     {option.label}
                  </button>
               );
            })}
         </div>
      </div>
   );
}
