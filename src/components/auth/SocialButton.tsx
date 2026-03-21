import { type ReactNode } from 'react';

export type SocialButtonVariant = 'outline' | 'solid';

interface SocialButtonProps {
   icon: ReactNode;
   text: string;
   variant?: SocialButtonVariant;
   backgroundColor?: string;
   textColor?: string;
   onClick?: () => void;
   type?: 'button' | 'submit';
   disabled?: boolean;
   className?: string;
   /** Render custom content instead of default button (for embedding OAuth widgets) */
   children?: ReactNode;
}

export function SocialButton({
   icon,
   text,
   variant = 'outline',
   backgroundColor,
   textColor,
   onClick,
   type = 'button',
   disabled = false,
   className = '',
   children
}: SocialButtonProps) {
   const isSolid = variant === 'solid';
   const baseClasses =
      'flex items-center justify-center gap-3 w-full py-3 px-4 rounded-xl text-base font-medium transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed';
   const outlineClasses = 'bg-white border border-neutral-200 text-black hover:bg-neutral-50 hover:border-neutral-300';
   const solidClasses = textColor ?? 'text-white';

   const style: React.CSSProperties = isSolid && backgroundColor ? { backgroundColor } : {};

   if (children) {
      return (
         <div
            className={`${baseClasses} min-h-[48px] ${isSolid ? solidClasses : outlineClasses} ${className}`}
            style={style}
         >
            {children}
         </div>
      );
   }

   return (
      <button
         type={type}
         onClick={onClick}
         disabled={disabled}
         className={`${baseClasses} ${isSolid ? solidClasses : outlineClasses} ${className}`}
         style={style}
      >
         <span className="shrink-0 w-5 h-5 flex items-center justify-center">{icon}</span>
         <span>{text}</span>
      </button>
   );
}
