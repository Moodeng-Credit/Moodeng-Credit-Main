import type { NextRequest } from 'next/server';

import { prisma } from '@/lib/database';
import { deleteLoanSchema } from '@/lib/schemas/loans';
import { handleApiRequest } from '@/lib/utils/apiRequestHandler';
import { handleCors } from '@/lib/utils/cors';
import { ERROR_CODES } from '@/types/errorCodes';
import { SUCCESS_CODES } from '@/types/successCodes';

export async function POST(request: NextRequest) {
   return handleApiRequest(
      request,
      async (data) => {
         const loan = await prisma.loan.findUnique({ where: { id: data.loanId } });
         if (!loan) {
            throw { code: ERROR_CODES.LOAN_NOT_FOUND, status: 404 };
         }

         // Use transaction to decrement nal for both users and delete loan
         await prisma.$transaction(async (tx) => {
            if (loan.lenderUser) {
               const lender = await tx.user.findUnique({ where: { username: loan.lenderUser } });
               if (lender) {
                  await tx.user.update({
                     where: { id: lender.id },
                     data: { nal: { decrement: 1 } }
                  });
               }
            }

            if (loan.borrowerUser) {
               const borrower = await tx.user.findUnique({ where: { username: loan.borrowerUser } });
               if (borrower) {
                  await tx.user.update({
                     where: { id: borrower.id },
                     data: { nal: { decrement: 1 } }
                  });
               }
            }

            await tx.loan.delete({ where: { id: data.loanId } });
         });

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
