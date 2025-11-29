import type { NextRequest } from 'next/server';

import Loan from '@/lib/models/Loan';
import User from '@/lib/models/User';
import { updateLoanSchema } from '@/lib/schemas/loans';
import { sendMail } from '@/lib/services/email';
import { handleApiRequest } from '@/lib/utils/apiRequestHandler';
import { handleCors } from '@/lib/utils/cors';
import { ERROR_CODES } from '@/types/errorCodes';
import type { Loan as LoanType } from '@/types/loanTypes';
import { RepaymentStatus } from '@/types/loanTypes';
import { SUCCESS_CODES } from '@/types/successCodes';

export async function POST(request: NextRequest) {
   return handleApiRequest(
      request,
      async (data, userId) => {
         const loan = (await Loan.findById(data.loanId).lean()) as LoanType | null;
         if (!loan) {
            throw { code: ERROR_CODES.LOAN_NOT_FOUND, status: 404 };
         }

         if (!userId) {
            throw { code: ERROR_CODES.AUTH_UNAUTHORIZED, status: 401 };
         }

         const authenticatedUser = await User.findById(userId);
         if (!authenticatedUser) {
            throw { code: ERROR_CODES.USER_NOT_FOUND, status: 404 };
         }

         if (data.totalRepaymentAmount !== undefined || data.repaymentStatus) {
            if (loan.borrowerUser !== authenticatedUser.username) {
               throw { code: ERROR_CODES.LOAN_UNAUTHORIZED, status: 403 };
            }

            if (data.totalRepaymentAmount !== undefined && data.totalRepaymentAmount > loan.repaidAmount) {
               throw { code: ERROR_CODES.LOAN_INVALID_AMOUNT, status: 400 };
            }
         }

         if (data.loanStatus && data.loanStatus === 'Lent') {
            if (loan.lenderUser !== authenticatedUser.username) {
               throw { code: ERROR_CODES.LOAN_UNAUTHORIZED, status: 403 };
            }
         }

         const borrower = await User.findOne({ username: loan.borrowerUser });
         const lender = await User.findOne({ username: loan.lenderUser });

         // Build update object with only the fields we want to update
         const updateFields: Partial<LoanType> = {
            updatedAt: new Date().toISOString()
         };

         if (data.totalRepaymentAmount !== undefined) updateFields.totalRepaymentAmount = data.totalRepaymentAmount;
         if (data.repaymentStatus) updateFields.repaymentStatus = data.repaymentStatus;
         if (data.loanStatus) updateFields.loanStatus = data.loanStatus;

         if (data.repaymentStatus === RepaymentStatus.PAID && borrower) {
            borrower.nal = borrower.nal - 1;
            if (loan.loanAmount === borrower.cs) {
               if (borrower.cs === 15) borrower.cs = borrower.cs + 5;
               else borrower.cs = borrower.cs + 20;
               if (borrower.mal < 3) borrower.mal = borrower.mal + 1;
            }
            await borrower.save();
         }

         // Use findByIdAndUpdate to avoid touching existing date fields
         const updatedLoan = await Loan.findByIdAndUpdate(data.loanId, { $set: updateFields }, { new: true, runValidators: false }).lean();

         if (!updatedLoan) {
            throw { code: ERROR_CODES.LOAN_NOT_FOUND, status: 404 };
         }

         if (lender) {
            try {
               await sendMail(
                  lender.email,
                  "You got asked for a Loan/You've Received a Repayment/Loan Fully Repaid - Your Impact is Growing",
                  `Dear ${lender.username},\n${loan.reason}`
               );
            } catch (error) {
               console.error('Error occurred while sending lender email:', error);
            }
         }

         if (borrower) {
            try {
               await sendMail(
                  borrower.email,
                  'Confirmation of Successful Loan Repayment/Your Loan has been Accepted',
                  `Dear ${borrower.username},\n${loan.days}`
               );
            } catch (error) {
               console.error('Error occurred while sending borrower email:', error);
            }
         }

         return updatedLoan;
      },
      {
         schema: updateLoanSchema,
         requireAuth: true,
         successCode: SUCCESS_CODES.LOAN_UPDATED
      }
   );
}
export async function OPTIONS(request: NextRequest) {
   return handleCors(request);
}
