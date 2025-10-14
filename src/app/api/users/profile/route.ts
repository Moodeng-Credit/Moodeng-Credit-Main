import type { NextRequest } from 'next/server';

import User from '@/lib/models/User';
import { getUserProfileSchema } from '@/lib/schemas/auth';
import { handleApiRequest } from '@/lib/utils/apiRequestHandler';
import { handleCors } from '@/lib/utils/cors';
import { ERROR_CODES } from '@/types/errorCodes';
import { SUCCESS_CODES } from '@/types/successCodes';

export async function POST(request: NextRequest) {
   return handleApiRequest(
      request,
      async (data) => {
         const user = await User.findOne({ username: data.username }).select('username isWorldId createdAt cs nal -_id');

         if (!user) {
            throw { code: ERROR_CODES.USER_NOT_FOUND, status: 404 };
         }

         return user;
      },
      {
         schema: getUserProfileSchema,
         requireAuth: true,
         successCode: SUCCESS_CODES.USER_PROFILE_FETCHED
      }
   );
}

export async function OPTIONS(request: NextRequest) {
   return handleCors(request);
}
