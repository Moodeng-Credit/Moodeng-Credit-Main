import type { NextRequest } from 'next/server';

import { z } from 'zod';

import { prisma } from '@/lib/database';
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
         return await prisma.loan.findMany({
            where: {
               OR: [{ borrowerUser: data.username }, { lenderUser: data.username }]
            }
         });
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
