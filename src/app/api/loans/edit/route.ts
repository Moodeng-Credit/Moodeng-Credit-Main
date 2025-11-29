import type { NextRequest } from 'next/server';

import { prisma } from '@/lib/database';
import { updateLoanSchema } from '@/lib/schemas/loans';
import { sendMail } from '@/lib/services/email';
import { handleApiRequest } from '@/lib/utils/apiRequestHandler';
import { handleCors } from '@/lib/utils/cors';
import { ERROR_CODES } from '@/types/errorCodes';
import { RepaymentStatus } from '@/types/loanTypes';
import { SUCCESS_CODES } from '@/types/successCodes';

export async function POST(request: NextRequest) {
   return handleApiRequest(
      request,
      async (data, userId) => {
         const loan = await prisma.loan.findUnique({ where: { id: data.loanId } });
         if (!loan) {
            throw { code: ERROR_CODES.LOAN_NOT_FOUND, status: 404 };
         }

         if (!userId) {
            throw { code: ERROR_CODES.AUTH_UNAUTHORIZED, status: 401 };
         }

         const authenticatedUser = await prisma.user.findUnique({ where: { id: userId } });
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

         const borrower = loan.borrowerUser ? await prisma.user.findUnique({ where: { username: loan.borrowerUser } }) : null;
         const lender = loan.lenderUser ? await prisma.user.findUnique({ where: { username: loan.lenderUser } }) : null;

         // Build update object
         const updateData: any = {};

         if (data.totalRepaymentAmount !== undefined) updateData.totalRepaymentAmount = data.totalRepaymentAmount;
         if (data.repaymentStatus) updateData.repaymentStatus = data.repaymentStatus;
         if (data.loanStatus) updateData.loanStatus = data.loanStatus;

         // Use transaction if we need to update borrower
         if (data.repaymentStatus === RepaymentStatus.PAID && borrower) {
            await prisma.$transaction(async (tx) => {
               const borrowerUpdateData: any = {
                  nal: { decrement: 1 }
               };

               if (loan.loanAmount === borrower.cs) {
                  if (borrower.cs === 15) {
                     borrowerUpdateData.cs = { increment: 5 };
                  } else {
                     borrowerUpdateData.cs = { increment: 20 };
                  }
                  if (borrower.mal < 3) {
                     borrowerUpdateData.mal = { increment: 1 };
                  }
               }

               await tx.user.update({
                  where: { id: borrower.id },
                  data: borrowerUpdateData
               });

               await tx.loan.update({
                  where: { id: data.loanId },
                  data: updateData
               });
            });
         } else {
            await prisma.loan.update({
               where: { id: data.loanId },
               data: updateData
            });
         }

         const updatedLoan = await prisma.loan.findUnique({ where: { id: data.loanId } });

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
