import type { NextRequest } from 'next/server';

import User from '@/lib/models/User';
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
         const user = await User.findById(userId);
         if (!user) {
            throw { code: ERROR_CODES.USER_NOT_FOUND, status: 404 };
         }

         // Track if we need to regenerate token (for security-sensitive changes)
         let requiresNewToken = false;

         if (data.password) {
            user.password = await hashPassword(data.password);
            requiresNewToken = true;
         }
         if (data.telegramUsername !== undefined) {
            user.telegramUsername = data.telegramUsername || undefined;
         }
         if (data.username) {
            user.username = data.username;
            requiresNewToken = true;
         }
         if (data.email) {
            user.email = data.email;
            requiresNewToken = true;
         }
         if (data.walletAddress !== undefined) {
            user.walletAddress = data.walletAddress;
            // Wallet address update doesn't require new token
         }
         user.updatedAt = new Date();

         await user.save();

         // Only regenerate token for security-sensitive changes
         if (requiresNewToken) {
            authToken = generateToken(user._id.toString());
         }

         // Send email if email was updated
         if (data.email) {
            try {
               await sendMail(user.email, 'Update successful', 'Account Details Updated Successfully.');
               console.log('Email sent successful');
            } catch (error) {
               console.error('Error occurred while sending email:', error);
            }
         }

         return {
            user: transformUserToResponse(user)
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
