import type { NextRequest } from 'next/server';

import { prisma } from '@/lib/database';
import { transformUserToResponse, updateUserSchema } from '@/lib/schemas/auth';
import { sendMail } from '@/lib/services/email';
import { handleApiRequest } from '@/lib/utils/apiRequestHandler';
import { generateToken, hashPassword, setAuthCookie } from '@/lib/utils/auth';
import { handleCors } from '@/lib/utils/cors';
import { ERROR_CODES } from '@/types/errorCodes';
import { SUCCESS_CODES } from '@/types/successCodes';

export async function POST(request: NextRequest) {
   let authToken: string | undefined;

   return handleApiRequest(
      request,
      async (data, userId) => {
         const user = await prisma.user.findUnique({ where: { id: userId } });
         if (!user) {
            throw { code: ERROR_CODES.USER_NOT_FOUND, status: 404 };
         }

         // Track if we need to regenerate token (for security-sensitive changes)
         let requiresNewToken = false;

         // Build update object
         const updateData: any = {};

         if (data.password) {
            updateData.password = await hashPassword(data.password);
            requiresNewToken = true;
         }
         if (data.telegramUsername !== undefined) {
            updateData.telegramUsername = data.telegramUsername || null;
         }
         if (data.username) {
            updateData.username = data.username;
            requiresNewToken = true;
         }
         if (data.email) {
            updateData.email = data.email;
            requiresNewToken = true;
         }
         if (data.walletAddress !== undefined) {
            updateData.walletAddress = data.walletAddress || null;
         }

         // Update user with Prisma (updatedAt handled automatically)
         const updatedUser = await prisma.user.update({
            where: { id: userId },
            data: updateData
         });

         // Only regenerate token for security-sensitive changes
         if (requiresNewToken) {
            authToken = generateToken(updatedUser.id);
         }

         // Send email if email was updated
         if (data.email) {
            try {
               await sendMail(updatedUser.email, 'Update successful', 'Account Details Updated Successfully.');
               console.log('Email sent successful');
            } catch (error) {
               console.error('Error occurred while sending email:', error);
            }
         }

         return {
            user: transformUserToResponse(updatedUser)
         };
      },
      {
         schema: updateUserSchema,
         requireAuth: true,
         successCode: SUCCESS_CODES.AUTH_UPDATE_SUCCESS,
         beforeResponse: (response) => {
            // Only set new cookie if we generated a new token
            if (authToken) {
               setAuthCookie(response, authToken);
            }
         }
      }
   );
}
export async function OPTIONS(request: NextRequest) {
   return handleCors(request);
}
