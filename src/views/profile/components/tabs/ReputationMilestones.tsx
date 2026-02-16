import { useMemo } from 'react';

import type { Loan } from '@/types/loanTypes';
import { parseDateSafely } from '@/utils/dateFormatters';
import { toNumber } from '@/utils/decimalHelpers';

type MilestoneStatus = 'next' | 'locked' | 'completed';

interface Milestone {
   id: string;
   icon: string;
   title: string;
   description: string;
   status: MilestoneStatus;
   requirement?: number; // How many needed to unlock
   current?: number; // Current progress
}

interface ReputationMilestonesProps {
   loans: Loan[];
   onViewAllClick?: () => void;
}

const ReputationMilestones = ({ loans, onViewAllClick }: ReputationMilestonesProps) => {
   const milestones = useMemo(() => {
      // Calculate on-time repayments
      const paidLoans = loans.filter((loan) => loan.repaymentStatus === 'Paid');
      const onTimeRepayments = paidLoans.filter((loan) => {
         const repaidAmount = toNumber(loan.repaidAmount);
         const totalRepayment = toNumber(loan.totalRepaymentAmount);
         const isFullyRepaid = totalRepayment > 0 ? repaidAmount >= totalRepayment : repaidAmount > 0;

         if (!isFullyRepaid) return false;

         const paidAt = parseDateSafely(loan.updatedAt);
         const dueDate = parseDateSafely(loan.dueDate);
         return paidAt.getTime() <= dueDate.getTime();
      });

      const onTimeCount = onTimeRepayments.length;

      const milestoneList: Milestone[] = [
         {
            id: 'repay_1',
            icon: 'fa-circle-check',
            title: 'Repay a loan on time',
            description: 'Increase your Trust Level',
            requirement: 1,
            current: onTimeCount,
            status: onTimeCount >= 1 ? 'completed' : 'next'
         },
         {
            id: 'repay_2',
            icon: 'fa-clock',
            title: 'Repay 2 loans on time',
            description: 'Build reputation with lenders',
            requirement: 2,
            current: onTimeCount,
            status: onTimeCount >= 2 ? 'completed' : onTimeCount >= 1 ? 'next' : 'locked'
         },
         {
            id: 'repay_5',
            icon: 'fa-star',
            title: 'Repay 5 loans on time',
            description: 'Unlock higher credit limits',
            requirement: 5,
            current: onTimeCount,
            status: onTimeCount >= 5 ? 'completed' : onTimeCount >= 2 ? 'next' : 'locked'
         },
         {
            id: 'repay_10',
            icon: 'fa-trophy',
            title: 'Repay 10 loans on time',
            description: 'Become a trusted borrower',
            requirement: 10,
            current: onTimeCount,
            status: onTimeCount >= 10 ? 'completed' : onTimeCount >= 5 ? 'next' : 'locked'
         }
      ];

      return milestoneList;
   }, [loans]);

   const getStatusColor = (status: MilestoneStatus) => {
      switch (status) {
         case 'completed':
            return 'bg-green-100 text-green-700';
         case 'next':
            return 'bg-purple-100 text-purple-700';
         case 'locked':
            return 'bg-gray-100 text-gray-400';
      }
   };

   const getButtonStyle = (status: MilestoneStatus) => {
      switch (status) {
         case 'completed':
            return 'bg-green-600 text-white cursor-default';
         case 'next':
            return 'bg-purple-600 text-white hover:bg-purple-700';
         case 'locked':
            return 'bg-gray-300 text-gray-500 cursor-not-allowed';
      }
   };

   return (
      <div className="bg-white rounded-xl p-6 space-y-4">
         <div className="flex items-center justify-between">
            <h2 className="font-extrabold text-xl select-none">Reputation Milestones</h2>
            {onViewAllClick && (
               <button
                  onClick={onViewAllClick}
                  className="text-sm text-purple-600 hover:text-purple-700 font-semibold"
                  type="button"
               >
                  View All Milestones
               </button>
            )}
         </div>

         <p className="text-sm text-gray-600">Complete milestones to unlock higher loan levels.</p>

         <div className="space-y-3">
            {milestones.map((milestone) => (
               <div
                  key={milestone.id}
                  className={`flex items-center justify-between p-4 rounded-lg border-2 transition ${
                     milestone.status === 'next'
                        ? 'border-purple-300 bg-purple-50'
                        : milestone.status === 'completed'
                          ? 'border-green-300 bg-green-50'
                          : 'border-gray-200 bg-gray-50'
                  }`}
               >
                  <div className="flex items-center gap-4">
                     {/* Icon */}
                     <div
                        className={`w-12 h-12 rounded-full flex items-center justify-center ${getStatusColor(milestone.status)}`}
                     >
                        {milestone.status === 'locked' ? (
                           <i className="fa-solid fa-lock text-xl" />
                        ) : milestone.status === 'completed' ? (
                           <i className="fa-solid fa-check text-xl" />
                        ) : (
                           <i className={`fa-solid ${milestone.icon} text-xl`} />
                        )}
                     </div>

                     {/* Content */}
                     <div>
                        {milestone.status === 'next' && (
                           <div className="text-xs font-semibold text-purple-600 mb-1">Next milestone</div>
                        )}
                        <h3 className="font-semibold text-gray-900">{milestone.title}</h3>
                        <p className="text-sm text-gray-600">{milestone.description}</p>
                        {milestone.requirement !== undefined && milestone.current !== undefined && (
                           <div
                              className="text-xs text-gray-500 mt-1"
                              role="status"
                              aria-label={`Progress: ${Math.min(milestone.current, milestone.requirement)} out of ${milestone.requirement} loans completed`}
                           >
                              Progress: {Math.min(milestone.current, milestone.requirement)}/{milestone.requirement}
                           </div>
                        )}
                     </div>
                  </div>

                  {/* Action Button */}
                  <button
                     className={`px-4 py-2 rounded-md font-semibold text-sm transition ${getButtonStyle(milestone.status)}`}
                     disabled={milestone.status === 'locked' || milestone.status === 'completed'}
                     type="button"
                  >
                     {milestone.status === 'completed' ? (
                        <>
                           <i className="fa-solid fa-check mr-1" /> Completed
                        </>
                     ) : milestone.status === 'locked' ? (
                        <>
                           <i className="fa-solid fa-lock mr-1" /> Locked
                        </>
                     ) : (
                        'View Milestone'
                     )}
                  </button>
               </div>
            ))}
         </div>
      </div>
   );
};

export default ReputationMilestones;
