import { format } from 'date-fns';
import { ExternalLink } from 'lucide-react';
import { useSelector } from 'react-redux';
import { Link } from 'react-router-dom';

import { Badge } from '@/components/shadcn/badge';
import { Button } from '@/components/shadcn/button';
import { Card, CardContent } from '@/components/shadcn/card';

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

   const isGoodStanding = borrowerProfile?.cs && borrowerProfile.cs >= 50;

   const dueDate = parseDateSafely(loan.dueDate);
   const formattedDueDate = format(dueDate, 'MMM dd yyyy');

   const loanReason = loan.reason?.trim() ? loan.reason.trim() : 'Help me with my loan request';

   return (
      <Card className="overflow-hidden rounded-2xl border border-border bg-card shadow-sm transition-shadow hover:shadow-md">
         <CardContent className="p-6">
            <h3 className="text-lg font-semibold text-foreground mb-3">{loanReason}</h3>

            <div className="flex items-center gap-2 mb-4 flex-wrap">
               <span className="text-sm text-muted-foreground">
                  by{' '}
                  {borrowerUsername ? (
                     <Link
                        to={`/user/${borrowerUsername}`}
                        className="font-medium text-foreground hover:text-[#6d57ff] transition-colors"
                     >
                        {borrowerDisplayName}
                     </Link>
                  ) : (
                     <span className="font-medium text-foreground">{borrowerDisplayName}</span>
                  )}
               </span>
               {isGoodStanding && (
                  <Badge variant="success" className="rounded-md">
                     Good Standing
                  </Badge>
               )}
               <Badge className="rounded-md bg-destructive/90 text-destructive-foreground border-0">
                  OP
               </Badge>
            </div>

            <p className="text-sm text-muted-foreground mb-4">
               Due on <span className="font-medium text-foreground">{formattedDueDate}</span>
            </p>

            <div className="grid grid-cols-2 gap-4 mb-6 rounded-lg bg-muted/50 p-4">
               <div>
                  <p className="text-xs text-muted-foreground mb-1">Borrowing USDC</p>
                  <p className="text-2xl font-semibold text-foreground">
                     ${formatNumber(loan.loanAmount)}
                  </p>
               </div>
               <div>
                  <p className="text-xs text-muted-foreground mb-1">Get back USDC</p>
                  <p className="text-2xl font-semibold text-emerald-600">
                     ${formatNumber(loan.totalRepaymentAmount)}
                  </p>
               </div>
            </div>

            <div className="flex flex-col gap-2">
               <Button
                  onClick={onViewRequest}
                  className="w-full h-11 rounded-lg bg-[#6d57ff] hover:bg-[#5b46e0] font-semibold"
               >
                  View Request
                  <svg
                     className="ml-2 size-4"
                     fill="none"
                     stroke="currentColor"
                     viewBox="0 0 24 24"
                  >
                     <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M9 5l7 7-7 7"
                     />
                  </svg>
               </Button>
               {borrowerUsername && (
                  <Link
                     to={`/user/${borrowerUsername}`}
                     className="flex items-center justify-center gap-1.5 text-sm font-medium text-[#6d57ff] hover:text-[#5b46e0] transition-colors py-2"
                  >
                     View Borrower Details
                     <ExternalLink className="size-3.5" />
                  </Link>
               )}
            </div>
         </CardContent>
      </Card>
   );
}
