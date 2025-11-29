import type { NextRequest } from 'next/server';

import { prisma } from '@/lib/database';
import { transformUserToResponse } from '@/lib/schemas/auth';
import { handleApiRequest } from '@/lib/utils/apiRequestHandler';
import { handleCors } from '@/lib/utils/cors';
import { ERROR_CODES } from '@/types/errorCodes';
import { SUCCESS_CODES } from '@/types/successCodes';

export async function GET(request: NextRequest) {
   return handleApiRequest(
      request,
      async (data, userId) => {
         const user = await prisma.user.findUnique({
            where: { id: userId },
            omit: { password: true }
         });
         if (!user) {
            throw { code: ERROR_CODES.USER_NOT_FOUND, status: 404 };
         }
         return transformUserToResponse(user);
      },
      {
         requireAuth: true,
         successCode: SUCCESS_CODES.USER_FETCHED
      }
   );
}

export async function OPTIONS(request: NextRequest) {
   return handleCors(request);
}
