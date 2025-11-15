import type { ReactNode } from 'react';

interface StatCardProps {
   value: string | number;
   label: string;
   icon?: ReactNode;
   footer?: ReactNode;
   className?: string;
}

export function StatCard({ value, label, icon, footer, className = '' }: StatCardProps) {
   return (
      <div className={`bg-[#1F2937] rounded-xl p-6 ${className}`}>
         <div className="flex justify-between items-start mb-4">
            <div>
               <div className="text-5xl font-bold mb-2">{value}</div>
               <div className="text-gray-400">{label}</div>
            </div>
            {icon ? <div>{icon}</div> : null}
         </div>
         {footer ? <div>{footer}</div> : null}
      </div>
   );
}
