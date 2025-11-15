import type { ReactNode } from 'react';
import { useEffect } from 'react';

interface ModalProps {
   isOpen: boolean;
   onClose: () => void;
   title?: string;
   children: ReactNode;
   size?: 'sm' | 'md' | 'lg' | 'xl';
   showCloseButton?: boolean;
   className?: string;
}

const sizeStyles = {
   sm: 'max-w-md',
   md: 'max-w-lg',
   lg: 'max-w-2xl',
   xl: 'max-w-4xl'
};

export default function Modal({ isOpen, onClose, title, children, size = 'md', showCloseButton = true, className = '' }: ModalProps) {
   // Prevent body scroll when modal is open
   useEffect(() => {
      if (isOpen) {
         document.body.style.overflow = 'hidden';
      } else {
         document.body.style.overflow = 'unset';
      }

      return () => {
         document.body.style.overflow = 'unset';
      };
   }, [isOpen]);

   // Close on Escape key
   useEffect(() => {
      const handleEscape = (e: KeyboardEvent) => {
         if (e.key === 'Escape' && isOpen) {
            onClose();
         }
      };

      document.addEventListener('keydown', handleEscape);
      return () => document.removeEventListener('keydown', handleEscape);
   }, [isOpen, onClose]);

   if (!isOpen) return null;

   return (
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50" onClick={onClose}>
         {showCloseButton ? (
            <button
               onClick={onClose}
               className="fixed top-4 right-4 z-50 text-gray-600 hover:text-gray-800 transition-colors"
               aria-label="Close modal"
            >
               ✖
            </button>
         ) : null}
         <div
            className={`bg-white rounded-2xl shadow-md mx-auto flex flex-col ${sizeStyles[size]} ${className}`}
            onClick={(e) => e.stopPropagation()}
         >
            {title ? (
               <header className="bg-[#1E56FF] rounded-t-2xl px-6 py-4">
                  <h2 className="text-white font-extrabold text-lg">{title}</h2>
               </header>
            ) : null}
            <div className="p-6">{children}</div>
         </div>
      </div>
   );
}

interface ModalHeaderProps {
   children: ReactNode;
   className?: string;
}

export function ModalHeader({ children, className = '' }: ModalHeaderProps) {
   return <div className={`px-5 ${className}`}>{children}</div>;
}

interface ModalBodyProps {
   children: ReactNode;
   className?: string;
}

export function ModalBody({ children, className = '' }: ModalBodyProps) {
   return <div className={`px-5 ${className}`}>{children}</div>;
}

interface ModalFooterProps {
   children: ReactNode;
   className?: string;
}

export function ModalFooter({ children, className = '' }: ModalFooterProps) {
   return <div className={`px-5 ${className}`}>{children}</div>;
}
