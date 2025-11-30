import type { NextRequest } from 'next/server';

import { prisma } from '@/lib/database';
import { loginSchema } from '@/lib/schemas/auth';
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

            user = await prisma.user.findUnique({
               where: { googleId: googleData.googleId },
               omit: { password: true, resetToken: true, resetTokenExpiry: true, nullifierHash: true }
            });
            if (!user) {
               throw { code: ERROR_CODES.AUTH_INVALID_CREDENTIALS, status: 401, message: 'Google account not registered' };
            }
         }
         // Handle Telegram login
         else if (data.telegramAuthData) {
            const telegramData = verifyTelegramAuth(JSON.parse(data.telegramAuthData));

            user = await prisma.user.findUnique({
               where: { telegramId: telegramData.telegramId },
               omit: { password: true, resetToken: true, resetTokenExpiry: true, nullifierHash: true }
            });
            if (!user) {
               throw { code: ERROR_CODES.AUTH_INVALID_CREDENTIALS, status: 401, message: 'Telegram account not registered' };
            }
         }
         // Handle traditional username/password login
         else {
            if (!data.username || !data.password) {
               throw { code: ERROR_CODES.AUTH_INVALID_CREDENTIALS, status: 400, message: 'Missing credentials' };
            }

            const userWithPassword = await prisma.user.findUnique({ where: { username: data.username } });
            if (!userWithPassword) {
               throw { code: ERROR_CODES.AUTH_INVALID_CREDENTIALS, status: 401 };
            }

            // Check if user has a password (not an OAuth user)
            if (!userWithPassword.password) {
               throw {
                  code: ERROR_CODES.AUTH_INVALID_CREDENTIALS,
                  status: 401,
                  message: 'This account uses OAuth authentication. Please use Google or Telegram login instead.'
               };
            }

            const isMatch = await comparePassword(data.password, userWithPassword.password);
            if (!isMatch) {
               throw { code: ERROR_CODES.AUTH_INVALID_CREDENTIALS, status: 401 };
            }

            // Get user without sensitive fields
            user = await prisma.user.findUnique({
               where: { id: userWithPassword.id },
               omit: { password: true, resetToken: true, resetTokenExpiry: true, nullifierHash: true }
            });
         }

         const token = generateToken(user!.id);

         return {
            token, // Used by beforeResponse to set cookie
            user
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
