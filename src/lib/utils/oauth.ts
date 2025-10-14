/**
 * OAuth utility functions for Google and Telegram authentication
 * Shared between login and register routes
 */
import crypto from 'crypto';
import { OAuth2Client } from 'google-auth-library';

import { ERROR_CODES } from '@/types/errorCodes';

const googleClient = new OAuth2Client(process.env.GOOGLE_CLIENT_ID);

/**
 * Verify Google OAuth token and extract user info
 */
export async function verifyGoogleToken(credential: string) {
   try {
      const ticket = await googleClient.verifyIdToken({
         idToken: credential,
         audience: process.env.GOOGLE_CLIENT_ID
      });

      const payload = ticket.getPayload();
      if (!payload) {
         throw { code: ERROR_CODES.AUTH_INVALID_CREDENTIALS, status: 401 };
      }

      return {
         googleId: payload.sub,
         email: payload.email,
         name: payload.name,
         picture: payload.picture
      };
   } catch (error) {
      console.error('Google token verification failed:', error);
      throw { code: ERROR_CODES.AUTH_INVALID_CREDENTIALS, status: 401 };
   }
}

/**
 * Verify Telegram auth data using bot token
 * Based on Telegram Login Widget documentation
 */
export function verifyTelegramAuth(authData: Record<string, string>) {
   const botToken = process.env.TELEGRAM_BOT_TOKEN;
   if (!botToken) {
      throw { code: ERROR_CODES.AUTH_INVALID_CREDENTIALS, status: 500 };
   }

   const { hash, ...data } = authData;

   // Check auth_date is recent (within 24 hours)
   const authDate = parseInt(data.auth_date || '0');
   const currentTime = Math.floor(Date.now() / 1000);
   if (currentTime - authDate > 86400) {
      throw { code: ERROR_CODES.AUTH_INVALID_CREDENTIALS, status: 401, message: 'Telegram auth data expired' };
   }

   // Create data check string
   const dataCheckArr = Object.keys(data)
      .sort()
      .map((key) => `${key}=${data[key]}`);
   const dataCheckString = dataCheckArr.join('\n');

   // Create secret key from bot token
   const secretKey = crypto.createHash('sha256').update(botToken).digest();

   // Create hash
   const hmac = crypto.createHmac('sha256', secretKey).update(dataCheckString).digest('hex');

   if (hmac !== hash) {
      throw { code: ERROR_CODES.AUTH_INVALID_CREDENTIALS, status: 401, message: 'Invalid Telegram auth data' };
   }

   return {
      telegramId: parseInt(data.id),
      username: data.username,
      firstName: data.first_name,
      lastName: data.last_name,
      photoUrl: data.photo_url
   };
}

/**
 * Generate a unique username from email or name
 */
export function generateUsername(email?: string, name?: string): string {
   let base = '';

   if (email) {
      base = email.split('@')[0].toLowerCase();
   } else if (name) {
      base = name.toLowerCase();
   } else {
      base = 'user';
   }

   // Remove invalid characters
   return base.replace(/[^a-z0-9_-]/g, '');
}

/**
 * Generate a temporary wallet address placeholder
 * User can update this later with their real wallet
 */
export function generateTempWalletAddress(): string {
   const random1 = Math.random().toString(16).substring(2, 15).padEnd(13, '0');
   const random2 = Math.random().toString(16).substring(2, 15).padEnd(13, '0');
   const random3 = Math.random().toString(16).substring(2, 15).padEnd(14, '0');
   return `0x${random1}${random2}${random3}`;
}

/**
 * Generate a random password for OAuth users
 * These users won't use password login, but we need it for the schema
 */
export function generateRandomPassword(): string {
   return crypto.randomBytes(32).toString('hex');
}
