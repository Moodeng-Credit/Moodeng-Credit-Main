import { type ChangeEvent, type JSX } from 'react';

interface FormInputProps {
   type: 'text' | 'email' | 'password';
   placeholder: string;
   value: string;
   onChange: (e: ChangeEvent<HTMLInputElement>) => void;
   error?: boolean;
   icon: JSX.Element;
   focusColor?: string;
}

export default function FormInput({
   type,
   placeholder,
   value,
   onChange,
   error,
   icon,
   focusColor = 'focus:ring-emerald-500'
}: FormInputProps): JSX.Element {
   return (
      <div className="relative">
         <div className="absolute inset-y-0 left-0 pl-3 flex items-center justify-center pointer-events-none">{icon}</div>
         <input
            required
            type={type}
            placeholder={placeholder}
            className={`w-full border pl-10 pr-4 py-3 rounded-lg ${error ? 'border-red-500' : 'border-gray-300'} focus:outline-none focus:ring-2 ${focusColor}`}
            value={value}
            onChange={onChange}
         />
      </div>
   );
}
