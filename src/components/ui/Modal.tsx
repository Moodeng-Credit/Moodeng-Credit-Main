import { type ReactNode } from 'react';

interface ModalProps {
   isOpen: boolean;
   onClose: () => void;
   title?: string;
   children: ReactNode;
   size?: 'sm' | 'md' | 'lg' | 'xl';
   showCloseButton?: boolean;
}

const sizeStyles = {
   sm: 'max-w-md',
   md: 'max-w-lg',
   lg: 'max-w-2xl',
   xl: 'max-w-4xl'
};

export default function Modal({ isOpen, onClose, title, children, size = 'md', showCloseButton = true }: ModalProps) {
   if (!isOpen) return null;

   return (
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50">
         {showCloseButton ? (
            <button onClick={onClose} className="text-gray-600 hover:text-gray-800 fixed top-4 right-4 z-50">
               ✖
            </button>
         ) : null}
         <div className={`bg-white rounded-2xl shadow-md mx-auto flex flex-col ${sizeStyles[size]}`}>
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
