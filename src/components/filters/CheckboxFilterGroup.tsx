import { type ChangeEvent } from 'react';

export interface FilterOption {
   value: string;
   label: string;
   checked: boolean;
}

interface CheckboxFilterGroupProps {
   legend: string;
   options: FilterOption[];
   onChange: (value: string) => void;
   customInput?: {
      enabled: boolean;
      placeholder: string;
      value: string;
      onChange: (value: string) => void;
   };
}

export default function CheckboxFilterGroup({ legend, options, onChange, customInput }: CheckboxFilterGroupProps) {
   return (
      <fieldset className="p-4 border border-gray-300 rounded-lg">
         <legend className="text-sm font-semibold text-gray-700 px-2">{legend}</legend>
         <div className="space-y-2 mt-2">
            {options.map((option) => (
               <label key={option.value} className="flex items-center gap-2 cursor-pointer">
                  <input
                     type="checkbox"
                     checked={option.checked}
                     onChange={() => onChange(option.value)}
                     className="w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
                  />
                  <span className="text-sm text-gray-700">{option.label}</span>
               </label>
            ))}
            {customInput?.enabled && (
               <div className="mt-3">
                  <input
                     type="text"
                     placeholder={customInput.placeholder}
                     value={customInput.value}
                     onChange={(e: ChangeEvent<HTMLInputElement>) => customInput.onChange(e.target.value)}
                     className="w-full px-3 py-2 text-sm border border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500"
                  />
               </div>
            )}
         </div>
      </fieldset>
   );
}
