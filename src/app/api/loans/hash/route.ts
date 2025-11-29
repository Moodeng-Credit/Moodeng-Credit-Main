import type { NextRequest } from 'next/server';

import Loan from '@/lib/models/Loan';
import { hashLoanSchema } from '@/lib/schemas/loans';
import { handleApiRequest } from '@/lib/utils/apiRequestHandler';
import { handleCors } from '@/lib/utils/cors';
import { ERROR_CODES } from '@/types/errorCodes';
import { SUCCESS_CODES } from '@/types/successCodes';

export async function POST(request: NextRequest) {
   return handleApiRequest(
      request,
      async (data) => {
         const loan = await Loan.findByIdAndUpdate(data.loanId, { $push: { hash: data.hash } }, { new: true }).lean();

         if (!loan) {
            throw { code: ERROR_CODES.LOAN_NOT_FOUND, status: 404 };
         }

         return { loan };
      },
      {
         schema: hashLoanSchema,
         requireAuth: true,
         successCode: SUCCESS_CODES.LOAN_HASH_ADDED
      }
   );
}
export async function OPTIONS(request: NextRequest) {
   return handleCors(request);
}
