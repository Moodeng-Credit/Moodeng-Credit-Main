import { type ChangeEvent } from 'react';

export interface RadioOption {
   value: string;
   label: string;
}

interface RadioFilterGroupProps {
   name: string;
   options: RadioOption[];
   selectedValue: string;
   onChange: (value: string) => void;
   customInput?: {
      placeholder: string;
      value: string;
      onChange: (value: string) => void;
   };
}

export default function RadioFilterGroup({ name, options, selectedValue, onChange, customInput }: RadioFilterGroupProps) {
   return (
      <div className="space-y-3">
         {customInput ? (
            <input
               type="text"
               placeholder={customInput.placeholder}
               value={customInput.value}
               onChange={(e: ChangeEvent<HTMLInputElement>) => customInput.onChange(e.target.value)}
               className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:ring-blue-500 focus:border-blue-500 focus:outline-none"
            />
         ) : null}
         <div className="space-y-2">
            {options.map((option) => (
               <label key={option.value} className="flex items-center gap-3 cursor-pointer">
                  <input
                     type="radio"
                     name={name}
                     value={option.value}
                     checked={selectedValue === option.value}
                     onChange={() => onChange(option.value)}
                     className="w-4 h-4 text-blue-600 border-gray-300 focus:ring-blue-500"
                  />
                  <span className="text-sm text-gray-700">{option.label}</span>
               </label>
            ))}
         </div>
      </div>
   );
}
