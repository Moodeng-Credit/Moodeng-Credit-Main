import { format } from 'date-fns';

import StatusBadge from '@/components/ui/StatusBadge';
import type { Transaction } from '@/types/transactionTypes';

interface TransactionCardProps {
   transaction: Transaction;
}

export default function TransactionCard({ transaction }: TransactionCardProps) {
   const { title, lender_name, date, amount_paid, total_amount, status } = transaction;

   // Format the date
   const formattedDate = format(new Date(date), 'MMM dd, yyyy');

   // Determine if amount is incoming or outgoing
   // For borrowers: incoming (+) is when receiving loan, outgoing (-) is when repaying
   // We'll use amount_paid to determine direction (positive = received, negative = paid)
   const isIncoming = amount_paid > 0;
   const amountColor = isIncoming ? 'text-green-600' : 'text-red-600';
   const amountPrefix = isIncoming ? '+' : '-';

   return (
      <div className="flex items-start gap-3 p-4 bg-white border border-gray-200 rounded-lg hover:shadow-md transition-shadow">
         {/* Avatar placeholder */}
         <div className="flex-shrink-0 w-12 h-12 bg-gray-200 rounded-full flex items-center justify-center">
            <span className="text-gray-500 text-sm font-semibold">
               {lender_name.charAt(0).toUpperCase()}
            </span>
         </div>

         {/* Content */}
         <div className="flex-1 min-w-0">
            {/* Title */}
            <h3 className="text-sm font-semibold text-gray-900 truncate">{title}</h3>

            {/* Subtitle: Lender + Date */}
            <p className="text-xs text-gray-500 mt-1">
               Lent by {lender_name} • {formattedDate}
            </p>
         </div>

         {/* Right Section: Amount + Status */}
         <div className="flex flex-col items-end gap-1 flex-shrink-0">
            {/* Amount */}
            <div className="text-right">
               <p className={`text-sm font-bold ${amountColor}`}>
                  {amountPrefix}${Math.abs(amount_paid).toFixed(2)}
               </p>
               <p className="text-xs text-gray-500">out of ${total_amount.toFixed(2)}</p>
            </div>

            {/* Status Badge */}
            <StatusBadge status={status} />
         </div>
      </div>
   );
}
