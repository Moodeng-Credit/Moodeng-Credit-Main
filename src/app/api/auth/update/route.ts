import type { NextRequest } from 'next/server';

import User from '@/lib/models/User';
import { transformUserToResponse, updateUserSchema } from '@/lib/schemas/auth';
import { sendMail } from '@/lib/services/email';
import { handleApiRequest } from '@/lib/utils/apiRequestHandler';
import { generateToken, hashPassword, setAuthCookie, validatePasswordStrength } from '@/lib/utils/auth';
import { handleCors } from '@/lib/utils/cors';
import { ERROR_CODES } from '@/types/errorCodes';
import { SUCCESS_CODES } from '@/types/successCodes';

export async function POST(request: NextRequest) {
   let authToken: string;

   return handleApiRequest(
      request,
      async (data, userId) => {
         if (data.password && !validatePasswordStrength(data.password)) {
            throw { code: ERROR_CODES.AUTH_PASSWORD_WEAK };
         }

         const user = await User.findById(userId);
         if (!user) {
            throw { code: ERROR_CODES.USER_NOT_FOUND, status: 404 };
         }

         if (data.password) {
            user.password = await hashPassword(data.password);
         }
         if (data.telegramUsername !== undefined) {
            user.telegramUsername = data.telegramUsername || undefined;
         }
         if (data.username) {
            user.username = data.username;
         }
         if (data.email) {
            user.email = data.email;
         }
         if (data.walletAddress) {
            user.walletAddress = data.walletAddress;
         }
         user.updatedAt = new Date();

         await user.save();

         authToken = generateToken(user._id.toString());

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
            setAuthCookie(response, authToken);
         }
      }
   );
}
export async function OPTIONS(request: NextRequest) {
   return handleCors(request);
}
