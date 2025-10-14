import { type FC, type ReactNode } from 'react';

import { X } from 'lucide-react';

interface ModalHeaderProps {
   icon?: ReactNode;
   title: string;
   description?: string;
   onClose?: () => void;
   titleId?: string;
   descriptionId?: string;
}

export const ModalHeader: FC<ModalHeaderProps> = ({ icon, title, description, onClose, titleId, descriptionId }) => {
   return (
      <div className="relative rounded-t-3xl bg-gradient-to-br from-blue-600 to-purple-600 px-8 py-10 text-white">
         {onClose ? (
            <button
               onClick={onClose}
               className="absolute right-6 top-6 text-white/80 transition-colors hover:text-white"
               aria-label="Close modal"
            >
               <X size={24} />
            </button>
         ) : null}

         {icon ? <div className="mb-6 flex justify-center">{icon}</div> : null}

         <h2 id={titleId} className="text-center text-3xl font-bold">
            {title}
         </h2>

         {description ? (
            <p id={descriptionId} className="mt-4 text-center text-base leading-relaxed text-white/90">
               {description}
            </p>
         ) : null}
      </div>
   );
};
