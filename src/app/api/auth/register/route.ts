import type { NextRequest } from 'next/server';

import { prisma } from '@/lib/database';
import { registerSchema, transformUserToResponse } from '@/lib/schemas/auth';
import { sendMail } from '@/lib/services/email';
import { handleApiRequest } from '@/lib/utils/apiRequestHandler';
import { generateToken, hashPassword, setAuthCookie } from '@/lib/utils/auth';
import { handleCors } from '@/lib/utils/cors';
import { generateUsername, verifyGoogleToken, verifyTelegramAuth } from '@/lib/utils/oauth';
import { WorldId } from '@/types/authTypes';
import { ERROR_CODES } from '@/types/errorCodes';
import { SUCCESS_CODES } from '@/types/successCodes';

export async function POST(request: NextRequest) {
   return handleApiRequest(
      request,
      async (data) => {
         let email: string;
         let username: string;
         let password: string | null;
         let googleId: string | undefined;
         let telegramId: number | undefined;
         let telegramUsername: string | undefined;

         // Handle Google OAuth registration
         if (data.googleCredential) {
            const googleData = await verifyGoogleToken(data.googleCredential);

            const existingGoogleUser = await prisma.user.findUnique({ where: { googleId: googleData.googleId } });
            if (existingGoogleUser) {
               throw { code: ERROR_CODES.USER_ALREADY_EXISTS, message: 'Google account already registered' };
            }

            const existingEmail = await prisma.user.findUnique({ where: { email: googleData.email! } });
            if (existingEmail) {
               throw { code: ERROR_CODES.USER_ALREADY_EXISTS, message: 'Email already registered' };
            }

            email = googleData.email!;
            googleId = googleData.googleId;
            username = data.username || generateUsername(googleData.email, googleData.name);
            password = null;
         }
         // Handle Telegram registration
         else if (data.telegramAuthData) {
            const telegramData = verifyTelegramAuth(JSON.parse(data.telegramAuthData));

            const existingTelegramUser = await prisma.user.findUnique({ where: { telegramId: telegramData.telegramId } });
            if (existingTelegramUser) {
               throw { code: ERROR_CODES.USER_ALREADY_EXISTS, message: 'Telegram account already registered' };
            }

            telegramId = telegramData.telegramId;
            telegramUsername = telegramData.username;
            username = data.username || telegramData.username || `user_${telegramData.telegramId}`;
            email = data.email || `telegram_${telegramData.telegramId}@moodeng.placeholder`;
            password = null;
         }
         // Handle traditional email/password registration
         else {
            if (!data.email || !data.password || !data.username) {
               throw { code: ERROR_CODES.AUTH_INVALID_CREDENTIALS, message: 'Missing required fields' };
            }

            const existingUser = await prisma.user.findUnique({ where: { username: data.username } });
            if (existingUser) {
               throw { code: ERROR_CODES.USER_ALREADY_EXISTS, message: 'Username already exists' };
            }

            const existingEmail = await prisma.user.findUnique({ where: { email: data.email } });
            if (existingEmail) {
               throw { code: ERROR_CODES.USER_ALREADY_EXISTS, message: 'Email already exists' };
            }

            email = data.email;
            username = data.username;
            password = data.password;
         }

         let finalUsername = username;
         let usernameExists = await prisma.user.findUnique({ where: { username: finalUsername } });
         let counter = 1;
         while (usernameExists) {
            finalUsername = `${username}_${counter}`;
            usernameExists = await prisma.user.findUnique({ where: { username: finalUsername } });
            counter++;
         }

         // Hash password (only for traditional registration)
         const hashedPassword = password ? await hashPassword(password) : null;

         // Create user
         const user = await prisma.user.create({
            data: {
               username: finalUsername,
               isWorldId: WorldId.INACTIVE,
               password: hashedPassword || undefined,
               email,
               telegramUsername: data.telegramUsername || telegramUsername || undefined,
               googleId: googleId || undefined,
               telegramId: telegramId || undefined,
               mal: 3,
               nal: 0,
               cs: 15
            }
         });

         const token = generateToken(user.id);

         // Send welcome email (only for non-placeholder emails)
         if (!email.includes('@moodeng.placeholder')) {
            try {
               await sendMail(email, 'Register successful', 'Register successful');
               console.log('Email sent successful');
            } catch (error) {
               console.error('Error occurred while sending email:', error);
            }
         }

         return {
            token,
            user: transformUserToResponse(user)
         };
      },
      {
         schema: registerSchema,
         successCode: SUCCESS_CODES.AUTH_REGISTER_SUCCESS,
         beforeResponse: (response, result: { token: string }) => {
            setAuthCookie(response, result.token);
         }
      }
   );
}
export async function OPTIONS(request: NextRequest) {
   return handleCors(request);
}
