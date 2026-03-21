import { type ChangeEvent, type ReactNode, useState } from 'react';
import { Eye, EyeOff } from 'lucide-react';

interface AuthInputFieldProps {
   label: string;
   type: 'email' | 'password' | 'text';
   placeholder: string;
   value: string;
   onChange: (e: ChangeEvent<HTMLInputElement>) => void;
   error?: boolean;
   icon: ReactNode;
   showEyeToggle?: boolean;
}

export function AuthInputField({
   label,
   type: initialType,
   placeholder,
   value,
   onChange,
   error,
   icon,
   showEyeToggle = false
}: AuthInputFieldProps) {
   const [showPassword, setShowPassword] = useState(false);
   const type = showEyeToggle ? (showPassword ? 'text' : 'password') : initialType;

   return (
      <div className="flex flex-col gap-2 w-full">
         <label className="text-base font-semibold text-[#040033] tracking-[-0.02em]">{label}</label>
         <div
            className={`flex items-center gap-2 w-full h-12 px-4 rounded-xl border bg-[#FDFCFD] shadow-[0px_2px_4px_rgba(27,28,29,0.04)] ${
               error ? 'border-red-500' : 'border-[#B5ACBE]'
            }`}
         >
            <span className="shrink-0 w-6 h-6 flex items-center justify-center text-[#70617F]">{icon}</span>
            <input
               type={type}
               placeholder={placeholder}
               value={value}
               onChange={onChange}
               required
               className="flex-1 min-w-0 bg-transparent text-base text-[#040033] placeholder:text-[#70617F] outline-none"
            />
            {showEyeToggle && (
               <button
                  type="button"
                  onClick={() => setShowPassword((p) => !p)}
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
