import type { NextRequest } from 'next/server';

import { prisma } from '@/lib/database';
import { sendMail } from '@/lib/services/email';
import { handleApiRequest } from '@/lib/utils/apiRequestHandler';
import { serialiseUser } from '@/lib/utils/apiResponse';
import { generateToken, setAuthCookie } from '@/lib/utils/auth';
import { handleCors } from '@/lib/utils/cors';
import { generateUsername, verifyGoogleToken } from '@/lib/utils/oauth';
import { WorldId } from '@/types/authTypes';
import { ERROR_CODES } from '@/types/errorCodes';
import { SUCCESS_CODES } from '@/types/successCodes';
import { z } from 'zod';

const googleAuthSchema = z.object({
   googleCredential: z.string()
});

/**
 * Unified Google OAuth endpoint
 * Automatically determines whether to login or register based on DB lookup
 */
export async function POST(request: NextRequest) {
   return handleApiRequest(
      request,
      async (data) => {
         const googleData = await verifyGoogleToken(data.googleCredential);

         // Check if user already exists with this Google ID
         let user = await prisma.user.findUnique({ where: { googleId: googleData.googleId } });

         if (user) {
            // User exists with this Google ID - login flow
            const token = generateToken(user.id);
            return {
               token,
               user: serialiseUser(user),
               isNewUser: false
            };
         }

         // Check if email already exists (user registered with email/password)
         const existingEmailUser = await prisma.user.findUnique({ where: { email: googleData.email! } });
         if (existingEmailUser) {
            // DO NOT auto-link - this is a security risk
            // User must link Google account while logged in via their original method
            throw {
               code: ERROR_CODES.AUTH_EMAIL_EXISTS,
               status: 409,
               message: 'An account with this email already exists. Please sign in with your password.'
            };
         }

         // New user - register flow
         const email = googleData.email!;
         const googleId = googleData.googleId;
         let username = generateUsername(googleData.email, googleData.name);

         // Ensure unique username
         let usernameExists = await prisma.user.findUnique({ where: { username } });
         let counter = 1;
         while (usernameExists) {
            username = `${generateUsername(googleData.email, googleData.name)}_${counter}`;
            usernameExists = await prisma.user.findUnique({ where: { username } });
            counter++;
         }

         // Create new user
         user = await prisma.user.create({
            data: {
               username,
               isWorldId: WorldId.INACTIVE,
               email,
               googleId,
               mal: 3,
               nal: 0,
               cs: 15
            }
         });

         const token = generateToken(user.id);

         // Send welcome email
         try {
            await sendMail(email, 'Welcome to Moodeng Credit', 'Your account has been created successfully!');
            console.log('Welcome email sent');
         } catch (error) {
            console.error('Error occurred while sending email:', error);
         }

         return {
            token,
            user: serialiseUser(user),
            isNewUser: true
         };
      },
      {
         schema: googleAuthSchema,
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
