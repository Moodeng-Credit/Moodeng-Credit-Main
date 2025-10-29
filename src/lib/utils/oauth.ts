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
   console.log('Telegram auth data received:', authData);

   const botToken = process.env.TELEGRAM_API_TOKEN;
   if (!botToken) {
      console.error('TELEGRAM_API_TOKEN not found');
      throw { code: ERROR_CODES.AUTH_INVALID_CREDENTIALS, status: 500 };
   }

   const { hash, ...data } = authData;
   console.log('Data after hash extraction:', data);
   console.log('Hash to verify:', hash);

   // Create data check string
   const dataCheckArr = Object.keys(data)
      .sort()
      .map((key) => `${key}=${data[key]}`);
   const dataCheckString = dataCheckArr.join('\n');
   console.log('Data check string:', dataCheckString);

   // Create secret key from bot token
   const secretKey = crypto.createHash('sha256').update(botToken).digest();
   console.log('Secret key created');

   // Create hash
   const hmac = crypto.createHmac('sha256', secretKey).update(dataCheckString).digest('hex');
   console.log('Generated HMAC:', hmac);
   console.log('Expected hash:', hash);

   if (hmac !== hash) {
      console.error('Hash verification failed');
      throw { code: ERROR_CODES.AUTH_INVALID_CREDENTIALS, status: 401, message: 'Invalid Telegram auth data' };
   }

   console.log('Telegram auth verification successful');
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
