import { type FC, type ReactNode } from 'react';

interface ModalStepProps {
   stepNumber: number;
   title: string;
   description: string;
   icon?: ReactNode;
   iconColor?: string;
   bgColor?: string;
}

export const ModalStep: FC<ModalStepProps> = ({ stepNumber, title, description, icon }) => {
   return (
      <div className="flex gap-3 items-center font-sans border border-md-neutral-500 justify-center rounded-[14px] p-3 sm:p-5 bg-md-primary-100">
         <div className="flex h-7 w-7 sm:h-8 sm:w-8 text-white flex-shrink-0 text-base sm:text-xl font-semibold items-center justify-center rounded-xl bg-md-primary-1200">
            {icon || <span className="text-white">{stepNumber}</span>}
         </div>
         <div className="flex-1 text-left">
            <h3 className="text-sm sm:text-base font-medium leading-tight text-md-neutral-2000">{title}</h3>
            <p className="text-[11px] sm:text-xs font-regular leading-tight text-md-neutral-1400">{description}</p>
         </div>
      </div>
   );
};
