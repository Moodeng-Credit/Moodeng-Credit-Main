import { type ChangeEvent, type InputHTMLAttributes } from 'react';

import Button from '@/components/ui/Button';

interface FormFieldProps extends Omit<InputHTMLAttributes<HTMLInputElement>, 'onChange'> {
   label: string;
   value: string;
   onChange: (value: string) => void;
   actionButton?: {
      label: string;
      onClick: () => void;
   };
   description?: string;
}

export default function FormField({
   label,
   value,
   onChange,
   actionButton,
   description,
   id,
   type = 'text',
   placeholder,
   disabled,
   ...props
}: FormFieldProps) {
   return (
      <div className="grid grid-cols-12 items-center gap-3">
         <div className="col-span-3">
            <label htmlFor={id} className="text-[#0a1a5f] font-semibold text-[10px] leading-[12px] select-none block">
               {label}
            </label>
            {description && <p className="text-[8px] text-[#4a4a4a] font-normal leading-[10px] mt-1">{description}</p>}
         </div>
         <input
            id={id}
            type={type}
            placeholder={placeholder}
            value={value}
            onChange={(e: ChangeEvent<HTMLInputElement>) => onChange(e.target.value)}
            disabled={disabled}
            className="col-span-6 bg-[#e0e7ff] rounded px-2 py-1 text-[#3b82f6] text-[10px] font-normal leading-[12px] outline-none disabled:text-[#4a4a4a]"
            {...props}
         />
         {actionButton && (
            <button
               type="button"
               onClick={actionButton.onClick}
               className="col-span-3 bg-[#1e40af] text-white rounded px-3 py-1 text-[10px] font-semibold leading-[12px] hover:bg-[#1e3a8a] transition"
            >
               {actionButton.label}
            </button>
         )}
      </div>
   );
}
