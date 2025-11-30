import type { NextRequest } from 'next/server';

import { prisma } from '@/lib/database';
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
         const user = await prisma.user.findFirst({
            where: {
               resetToken: token,
               resetTokenExpiry: { gt: new Date() }
            }
         });

         if (!user) {
            throw {
               code: ERROR_CODES.AUTH_INVALID_TOKEN,
               status: 400,
               message: 'Invalid or expired reset token'
            };
         }

         await prisma.user.update({
            where: { id: user.id },
            data: {
               password: await hashPassword(password),
               resetToken: null,
               resetTokenExpiry: null
            }
         });

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
