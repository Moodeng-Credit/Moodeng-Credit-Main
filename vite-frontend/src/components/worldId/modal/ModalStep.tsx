import { type FC, type ReactNode } from 'react';

interface ModalStepProps {
   stepNumber: number;
   title: string;
   description: string;
   icon?: ReactNode;
   iconColor?: string;
   bgColor?: string;
}

export const ModalStep: FC<ModalStepProps> = ({
   stepNumber,
   title,
   description,
   icon,
   iconColor = 'bg-blue-100 text-blue-600',
   bgColor = 'bg-gray-50'
}) => {
   return (
      <div className={`flex gap-4 rounded-2xl p-6 ${bgColor}`}>
         <div className={`flex h-12 w-12 flex-shrink-0 items-center justify-center rounded-xl ${iconColor}`}>
            {icon || <span className="text-xl font-bold">{stepNumber}</span>}
         </div>

         <div className="flex-1">
            <h3 className="mb-2 text-lg font-semibold text-gray-900">
               {stepNumber}. {title}
            </h3>
            <p className="text-sm leading-relaxed text-gray-600">{description}</p>
         </div>
      </div>
   );
};
