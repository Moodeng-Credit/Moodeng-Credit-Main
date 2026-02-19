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
         className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-[2px]"
         onClick={onClose}
         role="dialog"
         aria-modal="true"
         aria-labelledby={ariaLabelledBy}
         aria-describedby={ariaDescribedBy}
      >
         <div className="relative w-full max-w-md max-h-[90vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
            {children}
         </div>
      </div>
   );
};
