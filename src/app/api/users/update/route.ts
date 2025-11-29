import type { NextRequest } from 'next/server';

import { z } from 'zod';

import User from '@/lib/models/User';
import { transformUserToResponse } from '@/lib/schemas/auth';
import { handleApiRequest } from '@/lib/utils/apiRequestHandler';
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
         const user = await User.findById(userId).select('-password');
         if (!user) {
            throw { code: ERROR_CODES.USER_NOT_FOUND, status: 404 };
         }

         user.isWorldId = data.isWorldId;
         await user.save();

         return transformUserToResponse(user);
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
