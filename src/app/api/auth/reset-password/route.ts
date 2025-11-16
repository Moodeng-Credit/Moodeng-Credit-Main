import type { NextRequest } from 'next/server';

import User from '@/lib/models/User';
import { resetPasswordSchema } from '@/lib/schemas/auth';
import { handleApiRequest } from '@/lib/utils/apiRequestHandler';
import { hashPassword } from '@/lib/utils/auth';
import { ERROR_CODES } from '@/types/errorCodes';
import { SUCCESS_CODES } from '@/types/successCodes';

export async function POST(request: NextRequest) {
   return handleApiRequest(
      request,
      async (data) => {
         const { token, password } = data;

         // Find user with valid reset token
         const user = await User.findOne({
            resetToken: token,
            resetTokenExpiry: { $gt: Date.now() }
         });

         if (!user) {
            throw {
               code: ERROR_CODES.AUTH_INVALID_TOKEN,
               status: 400,
               message: 'Invalid or expired reset token'
            };
         }

         // Update password and clear reset token
         user.password = await hashPassword(password);
         user.resetToken = undefined;
         user.resetTokenExpiry = undefined;
         user.updatedAt = new Date();

         await user.save();

         return {
            message: 'Password has been reset successfully. You can now login with your new password.'
         };
      },
      {
         schema: resetPasswordSchema,
         requireAuth: false,
         successCode: SUCCESS_CODES.PASSWORD_RESET_SUCCESS
      }
   );
}
