import { type RepaymentStatusType } from '@/types/loanTypes';

interface StatusBadgeProps {
   status: string; // Accept any string status value
   className?: string;
}

const statusConfig = {
   paid: {
      label: 'PAID',
      className: 'bg-green-100 text-green-700 border-green-300'
   },
   partial: {
      label: 'PARTIAL',
      className: 'bg-yellow-100 text-yellow-700 border-yellow-300'
   },
   pending: {
      label: 'PENDING',
      className: 'bg-blue-100 text-blue-700 border-blue-300'
   },
   default: {
      label: 'DEFAULT',
      className: 'bg-red-100 text-red-700 border-red-300'
   },
   active: {
      label: 'ACTIVE',
      className: 'bg-blue-100 text-blue-700 border-blue-300'
   }
};

export default function StatusBadge({ status, className = '' }: StatusBadgeProps) {
   const normalizedStatus = status.toLowerCase();
   const config = statusConfig[normalizedStatus as keyof typeof statusConfig] || statusConfig.pending;

   return (
      <span
         className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium border ${config.className} ${className}`}
      >
         {config.label}
      </span>
   );
}
