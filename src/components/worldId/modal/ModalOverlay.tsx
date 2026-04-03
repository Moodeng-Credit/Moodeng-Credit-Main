import { type FC, type ReactNode } from 'react';

interface ModalOverlayProps {
   isOpen: boolean;
   onClose: () => void;
   children: ReactNode;
   ariaLabelledBy?: string;
   ariaDescribedBy?: string;
}

export const ModalOverlay: FC<ModalOverlayProps> = ({ isOpen, onClose, children, ariaLabelledBy, ariaDescribedBy }) => {
   if (!isOpen) return null;

   return (
      <div
         className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 "
         onClick={onClose}
         role="dialog"
         aria-modal="true"
         aria-labelledby={ariaLabelledBy}
         aria-describedby={ariaDescribedBy}
      >
         <div className="relative max-h-[100vh] w-full max-w-modal overflow-y-auto" onClick={(e) => e.stopPropagation()}>
            {children}
         </div>
      </div>
   );
};
