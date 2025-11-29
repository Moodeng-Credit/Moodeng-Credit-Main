import type { NextRequest } from 'next/server';

import { z } from 'zod';

import Loan from '@/lib/models/Loan';
import { usernameSchema } from '@/lib/schemas/fields';
import { handleApiRequest } from '@/lib/utils/apiRequestHandler';
import { handleCors } from '@/lib/utils/cors';
import { SUCCESS_CODES } from '@/types/successCodes';

const getLoansByUsernameSchema = z.object({
   username: usernameSchema
});

export async function POST(request: NextRequest) {
   return handleApiRequest(
      request,
      async (data) => {
         return await Loan.find({
            $or: [{ borrowerUser: data.username }, { lenderUser: data.username }]
         }).lean();
      },
      {
         schema: getLoansByUsernameSchema,
         requireAuth: true,
         successCode: SUCCESS_CODES.LOANS_FETCHED
      }
   );
}

export async function OPTIONS(request: NextRequest) {
   return handleCors(request);
}
