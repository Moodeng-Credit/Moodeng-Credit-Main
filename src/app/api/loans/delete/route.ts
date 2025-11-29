import type { NextRequest } from 'next/server';

import Loan from '@/lib/models/Loan';
import User from '@/lib/models/User';
import { deleteLoanSchema } from '@/lib/schemas/loans';
import { handleApiRequest } from '@/lib/utils/apiRequestHandler';
import { handleCors } from '@/lib/utils/cors';
import { ERROR_CODES } from '@/types/errorCodes';
import { SUCCESS_CODES } from '@/types/successCodes';

export async function POST(request: NextRequest) {
   return handleApiRequest(
      request,
      async (data) => {
         const loan = await Loan.findById(data.loanId);
         if (!loan) {
            throw { code: ERROR_CODES.LOAN_NOT_FOUND, status: 404 };
         }

         if (loan.lenderUser) {
            const lender = await User.findOne({ username: loan.lenderUser });
            if (lender) {
               lender.nal = lender.nal - 1;
               await lender.save();
            }
         }

         if (loan.borrowerUser) {
            const borrower = await User.findOne({ username: loan.borrowerUser });
            if (borrower) {
               borrower.nal = borrower.nal - 1;
               await borrower.save();
            }
         }

         await Loan.findByIdAndDelete(data.loanId);

         return {};
      },
      {
         schema: deleteLoanSchema,
         requireAuth: true,
         successCode: SUCCESS_CODES.LOAN_DELETED
      }
   );
}
export async function OPTIONS(request: NextRequest) {
   return handleCors(request);
}
