import type { NextRequest } from 'next/server';

import User from '@/lib/models/User';
import { loginSchema, transformUserToResponse } from '@/lib/schemas/auth';
import { handleApiRequest } from '@/lib/utils/apiRequestHandler';
import { comparePassword, generateToken, setAuthCookie } from '@/lib/utils/auth';
import { handleCors } from '@/lib/utils/cors';
import { verifyGoogleToken, verifyTelegramAuth } from '@/lib/utils/oauth';
import { ERROR_CODES } from '@/types/errorCodes';
import { SUCCESS_CODES } from '@/types/successCodes';

export async function POST(request: NextRequest) {
   return handleApiRequest(
      request,
      async (data) => {
         let user;

         // Handle Google OAuth login
         if (data.googleCredential) {
            const googleData = await verifyGoogleToken(data.googleCredential);

            user = await User.findOne({ googleId: googleData.googleId });
            if (!user) {
               throw { code: ERROR_CODES.AUTH_INVALID_CREDENTIALS, status: 401, message: 'Google account not registered' };
            }
         }
         // Handle Telegram login
         else if (data.telegramAuthData) {
            const telegramData = verifyTelegramAuth(JSON.parse(data.telegramAuthData));

            user = await User.findOne({ telegramId: telegramData.telegramId });
            if (!user) {
               throw { code: ERROR_CODES.AUTH_INVALID_CREDENTIALS, status: 401, message: 'Telegram account not registered' };
            }
         }
         // Handle traditional username/password login
         else {
            if (!data.username || !data.password) {
               throw { code: ERROR_CODES.AUTH_INVALID_CREDENTIALS, status: 400, message: 'Missing credentials' };
            }

            user = await User.findOne({ username: data.username });
            if (!user) {
               throw { code: ERROR_CODES.AUTH_INVALID_CREDENTIALS, status: 401 };
            }

            const isMatch = await comparePassword(data.password, user.password);
            if (!isMatch) {
               throw { code: ERROR_CODES.AUTH_INVALID_CREDENTIALS, status: 401 };
            }
         }

         const token = generateToken(user._id.toString());

         return {
            token, // Used by beforeResponse to set cookie
            user: transformUserToResponse(user)
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
