import type { NextRequest } from 'next/server';

import { prisma } from '@/lib/database';
import { handleApiRequest } from '@/lib/utils/apiRequestHandler';
import { WorldId } from '@/types/authTypes';
import { SUCCESS_CODES } from '@/types/successCodes';

export async function POST(request: NextRequest) {
   return handleApiRequest(
      request,
      async (data, userId) => {
         // Update the user as worldId = INACTIVE (for testing purposes)
         await prisma.user.update({
            where: { id: userId },
            data: { isWorldId: WorldId.INACTIVE }
         });

         return { isWorldId: WorldId.INACTIVE };
      },
      {
         requireAuth: true,
         successCode: SUCCESS_CODES.AUTH_UPDATE_SUCCESS
      }
   );
}
