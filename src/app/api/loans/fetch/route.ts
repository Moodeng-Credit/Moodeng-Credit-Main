import type { NextRequest } from 'next/server';

import { prisma } from '@/lib/database';
import { handleApiRequest } from '@/lib/utils/apiRequestHandler';
import { handleCors } from '@/lib/utils/cors';
import { SUCCESS_CODES } from '@/types/successCodes';

export async function GET(request: NextRequest) {
   return handleApiRequest(
      request,
      async () => {
         return await prisma.loan.findMany({
            where: { lenderWallet: null }
         });
      },
      {
         requireAuth: true,
         successCode: SUCCESS_CODES.LOANS_FETCHED
      }
   );
}
export async function OPTIONS(request: NextRequest) {
   return handleCors(request);
}
