import { format, parseISO } from 'date-fns';
import { useSelector } from 'react-redux';
import { Link } from 'react-router-dom';

import type { RootState } from '@/store/store';
import type { Loan } from '@/types/loanTypes';
import { formatNumber } from '@/utils/decimalHelpers';
import { parseDateSafely } from '@/utils/dateFormatters';

interface BorrowerRequestCardProps {
   loan: Loan;
   onViewRequest: () => void;
}

export default function BorrowerRequestCard({ loan, onViewRequest }: BorrowerRequestCardProps) {
   const borrowerUserId = loan.borrowerUser || '';
   const userProfiles = useSelector((state: RootState) => state.auth.userProfiles);
   const borrowerProfile = borrowerUserId ? userProfiles[borrowerUserId] : undefined;
   const borrowerUsername = borrowerProfile?.username ?? '';
   const borrowerDisplayName = borrowerUsername || 'Unknown user';
   
   // Check if borrower is in good standing (can customize this logic)
   const isGoodStanding = borrowerProfile?.cs && borrowerProfile.cs >= 50;
   
   const dueDate = parseISO(loan.dueDate);
   const formattedDueDate = format(dueDate, 'MMM dd yyyy');
   
   const loanReason = loan.reason?.trim() ? loan.reason.trim() : 'Help me with my loan request';

   return (
      <div className="bg-white rounded-2xl border border-gray-200 shadow-sm hover:shadow-md transition-shadow p-6">
         {/* Request Title */}
         <h3 className="text-lg font-semibold text-gray-900 mb-3">
            {loanReason}
         </h3>
         
         {/* Borrower Info */}
         <div className="flex items-center gap-2 mb-4">
            <span className="text-sm text-gray-700">
               by{' '}
               {borrowerUsername ? (
                  <Link 
                     to={`/user/${borrowerUsername}`} 
                     className="font-medium text-gray-900 hover:text-purple-600 transition"
                  >
                     {borrowerDisplayName}
                  </Link>
               ) : (
                  <span className="font-medium text-gray-900">{borrowerDisplayName}</span>
               )}
            </span>
            
            {/* Good Standing Badge */}
            {isGoodStanding && (
               <span className="px-2 py-0.5 bg-green-100 text-green-700 text-xs font-medium rounded-full">
                  Good Standing
               </span>
            )}
            
            {/* OP Badge */}
            <span className="px-2 py-0.5 bg-red-500 text-white text-xs font-bold rounded">
               OP
            </span>
         </div>
         
         {/* Due Date */}
         <div className="mb-4">
            <p className="text-sm text-gray-600">
               Due on <span className="font-medium text-gray-900">{formattedDueDate}</span>
            </p>
         </div>
         
         {/* Amounts */}
         <div className="grid grid-cols-2 gap-4 mb-6 bg-gray-50 rounded-lg p-4">
            <div>
               <p className="text-xs text-gray-600 mb-1">Borrowing USDC</p>
               <p className="text-2xl font-semibold text-gray-900">
                  ${formatNumber(loan.loanAmount)}
               </p>
            </div>
            <div>
               <p className="text-xs text-gray-600 mb-1">Get back USDC</p>
               <p className="text-2xl font-semibold text-green-600">
                  ${formatNumber(loan.totalRepaymentAmount)}
               </p>
            </div>
         </div>
         
         {/* Action Buttons */}
         <div className="flex flex-col gap-2">
            <button
               onClick={onViewRequest}
               className="w-full bg-purple-600 text-white font-semibold py-3 rounded-lg hover:bg-purple-700 transition flex items-center justify-center gap-2"
            >
               View Request
               <i className="fas fa-arrow-right text-sm"></i>
            </button>
            
            {borrowerUsername && (
               <Link
                  to={`/user/${borrowerUsername}`}
                  className="w-full text-center text-purple-600 font-medium py-2 hover:text-purple-700 transition flex items-center justify-center gap-1"
               >
                  View Borrower Details
                  <i className="fas fa-external-link-alt text-xs"></i>
               </Link>
            )}
         </div>
      </div>
   );
}
