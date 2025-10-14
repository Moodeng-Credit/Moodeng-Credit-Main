import type { NextRequest } from 'next/server';

import User from '@/lib/models/User';
import { registerSchema, transformUserToResponse } from '@/lib/schemas/auth';
import { sendMail } from '@/lib/services/email';
import { handleApiRequest } from '@/lib/utils/apiRequestHandler';
import { generateToken, hashPassword, setAuthCookie, validatePasswordStrength } from '@/lib/utils/auth';
import { handleCors } from '@/lib/utils/cors';
import {
   generateRandomPassword,
   generateTempWalletAddress,
   generateUsername,
   verifyGoogleToken,
   verifyTelegramAuth
} from '@/lib/utils/oauth';
import { WorldId } from '@/types/authTypes';
import { ERROR_CODES } from '@/types/errorCodes';
import { SUCCESS_CODES } from '@/types/successCodes';

export async function POST(request: NextRequest) {
   return handleApiRequest(
      request,
      async (data) => {
         let email: string;
         let username: string;
         let walletAddress: string;
         let password: string;
         let googleId: string | undefined;
         let telegramId: number | undefined;
         let telegramUsername: string | undefined;

         // Handle Google OAuth registration
         if (data.googleCredential) {
            const googleData = await verifyGoogleToken(data.googleCredential);

            // Check if user already exists with this Google ID
            const existingGoogleUser = await User.findOne({ googleId: googleData.googleId });
            if (existingGoogleUser) {
               throw { code: ERROR_CODES.USER_ALREADY_EXISTS, message: 'Google account already registered' };
            }

            // Check if email already exists
            const existingEmail = await User.findOne({ email: googleData.email });
            if (existingEmail) {
               throw { code: ERROR_CODES.USER_ALREADY_EXISTS, message: 'Email already registered' };
            }

            email = googleData.email!;
            googleId = googleData.googleId;
            username = data.username || generateUsername(googleData.email, googleData.name);
            walletAddress = data.walletAddress || generateTempWalletAddress();
            password = generateRandomPassword();
         }
         // Handle Telegram registration
         else if (data.telegramAuthData) {
            const telegramData = verifyTelegramAuth(JSON.parse(data.telegramAuthData));

            // Check if user already exists with this Telegram ID
            const existingTelegramUser = await User.findOne({ telegramId: telegramData.telegramId });
            if (existingTelegramUser) {
               throw { code: ERROR_CODES.USER_ALREADY_EXISTS, message: 'Telegram account already registered' };
            }

            telegramId = telegramData.telegramId;
            telegramUsername = telegramData.username;
            username = data.username || telegramData.username || `user_${telegramData.telegramId}`;
            email = data.email || `telegram_${telegramData.telegramId}@moodeng.placeholder`;
            walletAddress = data.walletAddress || generateTempWalletAddress();
            password = generateRandomPassword();
         }
         // Handle traditional email/password registration
         else {
            if (!data.email || !data.password || !data.username || !data.walletAddress) {
               throw { code: ERROR_CODES.AUTH_INVALID_CREDENTIALS, message: 'Missing required fields' };
            }

            if (!validatePasswordStrength(data.password)) {
               throw { code: ERROR_CODES.AUTH_PASSWORD_WEAK };
            }

            const existingUser = await User.findOne({ username: data.username });
            if (existingUser) {
               throw { code: ERROR_CODES.USER_ALREADY_EXISTS, message: 'Username already exists' };
            }

            const existingEmail = await User.findOne({ email: data.email });
            if (existingEmail) {
               throw { code: ERROR_CODES.USER_ALREADY_EXISTS, message: 'Email already exists' };
            }

            const existingWallet = await User.findOne({ walletAddress: data.walletAddress });
            if (existingWallet) {
               throw { code: ERROR_CODES.USER_ALREADY_EXISTS, message: 'Wallet already exists' };
            }

            email = data.email;
            username = data.username;
            walletAddress = data.walletAddress;
            password = data.password;
         }

         // Ensure username is unique
         let finalUsername = username;
         let usernameExists = await User.findOne({ username: finalUsername });
         let counter = 1;
         while (usernameExists) {
            finalUsername = `${username}_${counter}`;
            usernameExists = await User.findOne({ username: finalUsername });
            counter++;
         }

         // Hash password
         const hashedPassword = await hashPassword(password);

         // Create user
         const user = new User({
            username: finalUsername,
            walletAddress,
            isWorldId: WorldId.INACTIVE,
            password: hashedPassword,
            email,
            telegramUsername: data.telegramUsername || telegramUsername,
            googleId,
            telegramId,
            chatId: undefined,
            mal: 3,
            nal: 0,
            cs: 15
         });

         await user.save();

         const token = generateToken(user._id.toString());

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
