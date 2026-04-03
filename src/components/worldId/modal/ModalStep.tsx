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
      <div className={`flex gap-3 items-center font-sans border border-md-neutral-500 justify-center rounded-[14px] p-5 bg-md-primary-100`}>
         <div
            className={`flex h-8 w-8 text-white flex-shrink-0 text-xl font-semibold items-center justify-center rounded-xl bg-md-primary-1200`}
         >
            {icon || <span className="text-white  ">{stepNumber}</span>}
         </div>

         <div className="flex-1 text-left">
            <h3 className="text-base font-medium leading-tighter text-md-neutral-2000">{title}</h3>
            <p className="text-xs font-regular leading-tighter text-md-neutral-1400">{description}</p>
         </div>
      </div>
   );
};
