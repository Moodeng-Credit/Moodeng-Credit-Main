import type { NextRequest } from 'next/server';

import User from '@/lib/models/User';
import { registerSchema } from '@/lib/schemas/auth';
import { sendMail } from '@/lib/services/email';
import { handleApiRequest } from '@/lib/utils/apiRequestHandler';
import { generateToken, hashPassword, setAuthCookie, validatePasswordStrength } from '@/lib/utils/auth';
import { handleCors } from '@/lib/utils/cors';
import { WorldId } from '@/types/authTypes';
import { ERROR_CODES } from '@/types/errorCodes';
import { SUCCESS_CODES } from '@/types/successCodes';

export async function POST(request: NextRequest) {
   return handleApiRequest(
      request,
      async (data) => {
         if (!validatePasswordStrength(data.password)) {
            throw { code: ERROR_CODES.AUTH_PASSWORD_WEAK };
         }

         const existingUser = await User.findOne({ username: data.username });
         if (existingUser) {
            throw { code: ERROR_CODES.USER_ALREADY_EXISTS };
         }

         const existingEmail = await User.findOne({ email: data.email });
         if (existingEmail) {
            throw { code: ERROR_CODES.USER_ALREADY_EXISTS };
         }

         const existingWallet = await User.findOne({ walletAddress: data.walletAddress });
         if (existingWallet) {
            throw { code: ERROR_CODES.USER_ALREADY_EXISTS };
         }

         const hashedPassword = await hashPassword(data.password);
         const user = new User({
            username: data.username,
            walletAddress: data.walletAddress,
            isWorldId: WorldId.INACTIVE, // Default to inactive
            password: hashedPassword,
            email: data.email,
            telegramUsername: data.telegramUsername,
            chatId: undefined,
            mal: 3,
            nal: 0,
            cs: 15
         });

         await user.save();

         const token = generateToken(user._id.toString());

         // Send welcome email
         try {
            await sendMail(data.email, 'Register successful', 'Register successful');
            console.log('Email sent successful');
         } catch (error) {
            console.error('Error occurred while sending email:', error);
         }

         return {
            token,
            user: {
               _id: user._id,
               username: user.username,
               email: user.email,
               walletAddress: user.walletAddress,
               isWorldId: user.isWorldId,
               telegramUsername: user.telegramUsername,
               chatId: user.chatId,
               mal: user.mal,
               nal: user.nal,
               cs: user.cs,
               createdAt: user.createdAt,
               updatedAt: user.updatedAt
            }
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
