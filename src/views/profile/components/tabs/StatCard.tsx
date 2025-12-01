import { formatNumber } from '@/utils/decimalHelpers';

import type { StatCardConfig } from '@/views/profile/components/tabs/types';

interface StatCardProps {
   config: StatCardConfig;
   count: number;
   total: number;
}

const StatCard = ({ config, count, total }: StatCardProps) => {
   const Icon = config.icon;
   return (
      <div className={`${config.bgColor} rounded-xl p-5 select-none relative`}>
         <div className="flex items-center space-x-3 mb-3">
            <div className={`${config.iconBg} text-white rounded-full p-2.5 text-xs`}>
               <Icon size={12} />
            </div>
            <div className="font-extrabold text-2xl text-[#111827]">{count}</div>
         </div>
         <div className="text-sm font-semibold text-[#111827] mb-1">{config.label}</div>
         <div className={`text-xs font-bold ${config.textColor} mb-1`}>Total</div>
         <div className="font-extrabold text-lg text-[#111827]">${formatNumber(total)}</div>
      </div>
   );
};

export default StatCard;
