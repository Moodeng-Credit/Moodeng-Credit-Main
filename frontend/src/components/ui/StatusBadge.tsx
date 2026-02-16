import { type RepaymentStatusType, RepaymentStatus } from '@/types/loanTypes';

interface StatusBadgeProps {
   status: RepaymentStatusType | string;
   className?: string;
}

const statusConfig = {
   [RepaymentStatus.PAID]: {
      label: 'PAID',
      className: 'bg-green-100 text-green-700 border-green-300'
   },
   [RepaymentStatus.PARTIAL]: {
      label: 'PARTIAL',
      className: 'bg-yellow-100 text-yellow-700 border-yellow-300'
   },
   [RepaymentStatus.UNPAID]: {
      label: 'PENDING',
      className: 'bg-blue-100 text-blue-700 border-blue-300'
   },
   DEFAULT: {
      label: 'DEFAULT',
      className: 'bg-red-100 text-red-700 border-red-300'
   },
   PENDING: {
      label: 'PENDING',
      className: 'bg-blue-100 text-blue-700 border-blue-300'
   },
   ACTIVE: {
      label: 'ACTIVE',
      className: 'bg-blue-100 text-blue-700 border-blue-300'
   }
};

export default function StatusBadge({ status, className = '' }: StatusBadgeProps) {
   const config = statusConfig[status as keyof typeof statusConfig] || statusConfig.PENDING;

   return (
      <span
         className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium border ${config.className} ${className}`}
      >
         {config.label}
      </span>
   );
}
