import { type ChangeEvent, type ReactNode, useState } from 'react';
import { AlertTriangle, Eye, EyeOff } from 'lucide-react';

type ErrorVariant = 'red' | 'amber';

interface AuthInputFieldProps {
   label: string;
   type: 'email' | 'password' | 'text';
   placeholder: string;
   value: string;
   onChange: (e: ChangeEvent<HTMLInputElement>) => void;
   error?: boolean;
   /** Inline error text shown next to the label */
   errorMessage?: string;
   /** Error style: red (default) or amber/warning */
   errorVariant?: ErrorVariant;
   icon: ReactNode;
   showEyeToggle?: boolean;
   disabled?: boolean;
}

export function AuthInputField({
   label,
   type: initialType,
   placeholder,
   value,
   onChange,
   error,
   errorMessage,
   errorVariant = 'red',
   icon,
   showEyeToggle = false,
   disabled = false
}: AuthInputFieldProps) {
   const [showPassword, setShowPassword] = useState(false);
   const type = showEyeToggle ? (showPassword ? 'text' : 'password') : initialType;

   const isAmber = error && errorVariant === 'amber';
   const errorBorder = isAmber ? 'border-[#F8C800]' : error ? 'border-[#FA1024]' : 'border-[#B5ACBE]';
   const errorText = isAmber ? 'text-[#AE8C00]' : error ? 'text-[#B60413]' : 'text-[#70617F]';
   const errorPlaceholder = isAmber ? 'placeholder:text-[#AE8C00]' : error ? 'placeholder:text-[#B60413]' : 'placeholder:text-[#70617F]';
   const errorInputText = isAmber ? 'text-[#AE8C00]' : error ? 'text-[#B60413]' : 'text-[#040033]';

   return (
      <div className="flex flex-col gap-2 w-full">
         <div className="flex flex-row items-center justify-between gap-2">
            <label className="text-base font-semibold text-[#040033] tracking-[-0.02em]">{label}</label>
            {error && errorMessage && (
               <span
                  className={`inline-flex items-center gap-2 shrink-0 text-sm font-semibold leading-[21px] tracking-[-0.02em] ${
                     isAmber ? 'text-[#AE8C00]' : 'text-[#8F030F]'
                  }`}
               >
                  <AlertTriangle
                     className="shrink-0 w-5 h-5"
                     strokeWidth={1.5}
                     aria-hidden
                  />
                  {errorMessage}
               </span>
            )}
         </div>
         <div
            className={`flex items-center gap-2 w-full h-12 rounded-[12px] border bg-[#FDFCFD] shadow-[0px_2px_4px_rgba(27,28,29,0.04)] px-4 py-3 ${errorBorder} ${disabled ? 'opacity-60' : ''}`}
         >
            <span className={`shrink-0 w-6 h-6 flex items-center justify-center [&_svg]:text-inherit ${errorText}`}>
               {icon}
            </span>
            <input
               type={type}
               placeholder={placeholder}
               value={value}
               onChange={onChange}
               required
               disabled={disabled}
               className={`flex-1 min-w-0 bg-transparent text-base outline-none disabled:cursor-not-allowed ${errorPlaceholder} ${errorInputText}`}
            />
            {showEyeToggle && (
               <button
                  type="button"
                  disabled={disabled}
                  onClick={() => setShowPassword((p) => !p)}
                  className="shrink-0 w-6 h-6 flex items-center justify-center text-[#8336F0] hover:opacity-80 disabled:pointer-events-none disabled:opacity-50"
                  aria-label={showPassword ? 'Hide password' : 'Show password'}
               >
                  {showPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
               </button>
            )}
         </div>
      </div>
   );
}
