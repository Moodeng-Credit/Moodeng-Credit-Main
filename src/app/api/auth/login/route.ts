import type { NextRequest } from 'next/server';

import User from '@/lib/models/User';
import { loginSchema } from '@/lib/schemas/auth';
import { handleApiRequest } from '@/lib/utils/apiRequestHandler';
import { comparePassword, generateToken, setAuthCookie } from '@/lib/utils/auth';
import { handleCors } from '@/lib/utils/cors';
import { ERROR_CODES } from '@/types/errorCodes';
import { SUCCESS_CODES } from '@/types/successCodes';

export async function POST(request: NextRequest) {
   return handleApiRequest(
      request,
      async (data) => {
         const user = await User.findOne({ username: data.username });
         if (!user) {
            throw { code: ERROR_CODES.AUTH_INVALID_CREDENTIALS, status: 401 };
         }

         const isMatch = await comparePassword(data.password, user.password);
         if (!isMatch) {
            throw { code: ERROR_CODES.AUTH_INVALID_CREDENTIALS, status: 401 };
         }

         const token = generateToken(user._id.toString());

         return {
            token, // Used by beforeResponse to set cookie
            user: {
               _id: user._id,
               username: user.username,
               email: user.email,
               walletAddress: user.walletAddress,
               isWorldId: user.isWorldId,
               telegramUsername: user.telegramUsername,
               chatId: user.chatId,
               mal: user.mal,
               nal: user.nal,
               cs: user.cs,
               createdAt: user.createdAt,
               updatedAt: user.updatedAt
            }
         };
      },
      {
         schema: loginSchema,
         successCode: SUCCESS_CODES.AUTH_LOGIN_SUCCESS,
         beforeResponse: (response, result: { token: string }) => {
            setAuthCookie(response, result.token);
         }
      }
   );
}

export async function OPTIONS(request: NextRequest) {
   return handleCors(request);
}
