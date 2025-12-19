import { type ButtonHTMLAttributes, type ReactNode } from 'react';

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
   variant?: 'primary' | 'secondary' | 'outline' | 'ghost' | 'danger' | 'success';
   size?: 'sm' | 'md' | 'lg';
   fullWidth?: boolean;
   children: ReactNode;
   icon?: ReactNode;
}

const variantStyles = {
   primary: 'bg-blue-600 text-white hover:bg-blue-700',
   secondary: 'bg-gray-200 text-gray-900 hover:bg-gray-300',
   outline: 'border border-gray-300 text-gray-700 hover:bg-gray-100',
   ghost: 'text-gray-700 hover:bg-gray-100',
   danger: 'bg-red-600 text-white hover:bg-red-700',
   success: 'bg-green-600 text-white hover:bg-green-700'
};

const sizeStyles = {
   sm: 'px-3 py-1 text-xs',
   md: 'px-5 py-2 text-sm',
   lg: 'px-6 py-3 text-base'
};

export default function Button({
   variant = 'primary',
   size = 'md',
   fullWidth = false,
   children,
   icon,
   className = '',
   disabled,
   ...props
}: ButtonProps) {
   const baseStyles = 'font-semibold rounded-md transition-colors duration-200 flex items-center justify-center gap-2';
   const widthStyles = fullWidth ? 'w-full' : '';
   const disabledStyles = disabled ? 'opacity-50 cursor-not-allowed' : '';

   const combinedClassName = `
      ${baseStyles}
      ${variantStyles[variant]}
      ${sizeStyles[size]}
      ${widthStyles}
      ${disabledStyles}
      ${className}
   `.trim();

   return (
      <button className={combinedClassName} disabled={disabled} {...props}>
         {icon ? <span>{icon}</span> : null}
         {children}
      </button>
   );
}
