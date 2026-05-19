import { type ChangeEvent, type ReactNode, useState } from 'react';
import { AlertTriangle, Eye, EyeOff, HelpCircle } from 'lucide-react';

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
   tooltip?: string;
   showEyeToggle?: boolean;
   isPasswordVisible?: boolean;
   onTogglePasswordVisibility?: () => void;
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
   tooltip,
   showEyeToggle = false,
   isPasswordVisible,
   onTogglePasswordVisibility
}: AuthInputFieldProps) {
   const [localShowPassword, setLocalShowPassword] = useState(false);
   const showPassword = isPasswordVisible ?? localShowPassword;
   const type = showEyeToggle ? (showPassword ? 'text' : 'password') : initialType;
   const handleTogglePassword = onTogglePasswordVisibility ?? (() => setLocalShowPassword((p) => !p));

   const isAmber = error && errorVariant === 'amber';
   const errorBorder = isAmber ? 'border-[#F8C800]' : error ? 'border-[#FA1024]' : 'border-[#B5ACBE]';
   const errorText = isAmber ? 'text-[#AE8C00]' : error ? 'text-[#B60413]' : 'text-[#70617F]';
   const errorPlaceholder = isAmber ? 'placeholder:text-[#AE8C00]' : error ? 'placeholder:text-[#B60413]' : 'placeholder:text-[#70617F]';
   const errorInputText = isAmber ? 'text-[#AE8C00]' : error ? 'text-[#B60413]' : 'text-[#040033]';

   return (
      <div className="flex flex-col gap-2 w-full">
         <div className="flex flex-row items-center justify-between gap-2">
            <span className="inline-flex items-center gap-2">
               <label className="text-base font-semibold text-[#040033] tracking-[-0.02em]">{label}</label>
               {tooltip && (
                  <span className="group relative inline-flex">
                     <button
                        type="button"
                        className="flex h-5 w-5 items-center justify-center rounded-full text-[#70617F] outline-none transition-colors hover:text-[#8336F0] focus-visible:ring-2 focus-visible:ring-[#D6BCFA]"
                        aria-label={`${label} help`}
                     >
                        <HelpCircle className="h-4 w-4" strokeWidth={1.8} />
                     </button>
                     <span className="pointer-events-none absolute left-1/2 top-7 z-20 w-[260px] -translate-x-1/2 rounded-[12px] border border-[#D6BCFA] bg-[#FDFBFD] px-3 py-2 text-left text-xs font-medium leading-[18px] tracking-[-0.02em] text-[#4D4359] opacity-0 shadow-[0px_8px_18px_rgba(27,28,29,0.12)] transition-opacity group-hover:opacity-100 group-focus-within:opacity-100">
                        {tooltip}
                     </span>
                  </span>
               )}
            </span>
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
            className={`flex items-center gap-2 w-full h-12 rounded-[12px] border bg-[#FDFCFD] shadow-[0px_2px_4px_rgba(27,28,29,0.04)] px-4 py-3 ${errorBorder}`}
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
               className={`flex-1 min-w-0 bg-transparent text-base outline-none ${errorPlaceholder} ${errorInputText}`}
            />
            {showEyeToggle && (
               <button
                  type="button"
                  onClick={handleTogglePassword}
                  className="shrink-0 w-6 h-6 flex items-center justify-center text-[#8336F0] hover:opacity-80"
                  aria-label={showPassword ? 'Hide password' : 'Show password'}
               >
                  {showPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
               </button>
            )}
         </div>
      </div>
   );
}
