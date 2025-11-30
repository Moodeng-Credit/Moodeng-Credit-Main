import type { NextRequest } from 'next/server';

import { z } from 'zod';

import { prisma } from '@/lib/database';
import { handleApiRequest } from '@/lib/utils/apiRequestHandler';
import { serialiseUser } from '@/lib/utils/apiResponse';
import { handleCors } from '@/lib/utils/cors';
import { WorldId } from '@/types/authTypes';
import { ERROR_CODES } from '@/types/errorCodes';
import { SUCCESS_CODES } from '@/types/successCodes';

const updateUserWorldIdSchema = z.object({
   isWorldId: z.enum([WorldId.INACTIVE, WorldId.ACTIVE])
});

export async function POST(request: NextRequest) {
   return handleApiRequest(
      request,
      async (data, userId) => {
         const user = await prisma.user.findUnique({
            where: { id: userId },
            omit: { password: true, resetToken: true, resetTokenExpiry: true, nullifierHash: true }
         });
         if (!user) {
            throw { code: ERROR_CODES.USER_NOT_FOUND, status: 404 };
         }

         const updatedUser = await prisma.user.update({
            where: { id: userId },
            data: { isWorldId: data.isWorldId },
            omit: { password: true, resetToken: true, resetTokenExpiry: true, nullifierHash: true }
         });

         return serialiseUser(updatedUser);
      },
      {
         schema: updateUserWorldIdSchema,
         requireAuth: true,
         successCode: SUCCESS_CODES.USER_UPDATED
      }
   );
}
export async function OPTIONS(request: NextRequest) {
   return handleCors(request);
}
