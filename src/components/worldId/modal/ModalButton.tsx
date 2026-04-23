import { type FC, type ReactNode } from 'react';

type ButtonVariant = 'primary' | 'secondary' | 'outline';

interface ModalButtonProps {
   children: ReactNode;
   onClick?: () => void;
   variant?: ButtonVariant;
   icon?: ReactNode;
   iconPosition?: 'left' | 'right';
   disabled?: boolean;
   fullWidth?: boolean;
   className?: string;
}

export const ModalButton: FC<ModalButtonProps> = ({
   children,
   onClick,
   variant = 'primary',
   icon,
   iconPosition = 'left',
   disabled = false,
   fullWidth = true,
   className = ''
}) => {
   const baseStyles =
      'flex items-center justify-center gap-2 rounded-2xl px-5 py-3 sm:py-4 font-semibold transition-all duration-200 disabled:cursor-not-allowed disabled:opacity-50';

   const variantStyles: Record<ButtonVariant, string> = {
      primary: 'bg-md-primary-1200 text-base text-white font-sans',
      secondary: 'bg-green-500 text-white hover:bg-green-600 shadow-lg',
      outline: 'border-2 border-gray-300 bg-white text-gray-700 hover:bg-gray-50'
   };

   const widthStyles = fullWidth ? 'w-full' : '';

   return (
      <button onClick={onClick} disabled={disabled} className={`${baseStyles} ${variantStyles[variant]} ${widthStyles} ${className}`}>
         {icon && iconPosition === 'left' && <span>{icon}</span>}
         <span>{children}</span>
         {icon && iconPosition === 'right' && <span>{icon}</span>}
      </button>
   );
};
