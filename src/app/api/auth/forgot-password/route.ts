import type { NextRequest } from 'next/server';

import crypto from 'crypto';

import User from '@/lib/models/User';
import { forgotPasswordSchema } from '@/lib/schemas/auth';
import { sendMail } from '@/lib/services/email';
import { handleApiRequest } from '@/lib/utils/apiRequestHandler';
import { ERROR_CODES } from '@/types/errorCodes';
import { SUCCESS_CODES } from '@/types/successCodes';

export async function POST(request: NextRequest) {
   return handleApiRequest(
      request,
      async (data) => {
         const { email } = data;

         const user = await User.findOne({ email });

         // Always return success even if user doesn't exist (security best practice)
         if (!user) {
            return {
               message: 'If an account with that email exists, a password reset link has been sent.'
            };
         }

         // Don't allow password reset for OAuth users (Google, Telegram)
         if (user.googleId || user.telegramId) {
            return {
               message: 'If an account with that email exists, a password reset link has been sent.'
            };
         }

         // Generate reset token
         const resetToken = crypto.randomBytes(32).toString('hex');
         const resetTokenExpiry = new Date(Date.now() + 3600000); // 1 hour from now

         user.resetToken = resetToken;
         user.resetTokenExpiry = resetTokenExpiry;
         await user.save();

         const resetUrl = `${process.env.NEXT_PUBLIC_SITE_URL}/reset-password?token=${resetToken}`;

         const emailSubject = 'Password Reset Request - Moodeng Credit';
         const emailMessage = `Hello ${user.username},

You requested to reset your password. Please click the link below to reset your password:

${resetUrl}

This link will expire in 1 hour.

If you did not request this password reset, please ignore this email.

Best regards,
Moodeng Credit Team`;

         const emailResult = await sendMail(email, emailSubject, emailMessage);

         if (!emailResult.success) {
            throw {
               code: ERROR_CODES.SERVER_ERROR,
               status: 500,
               message: 'Failed to send password reset email'
            };
         }

         return {
            message: 'If an account with that email exists, a password reset link has been sent.'
         };
      },
      {
         schema: forgotPasswordSchema,
         requireAuth: false,
         successCode: SUCCESS_CODES.PASSWORD_RESET_EMAIL_SENT
      }
   );
}
