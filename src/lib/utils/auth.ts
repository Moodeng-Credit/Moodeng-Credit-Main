import { cookies } from 'next/headers';
import type { NextRequest } from 'next/server';

import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';

interface JWTPayload {
   user: {
      id: string;
   };
}

export const hashPassword = async (password: string): Promise<string> => {
   const salt = await bcrypt.genSalt(10);
   return await bcrypt.hash(password, salt);
};

export const comparePassword = async (password: string, hashedPassword: string): Promise<boolean> => {
   return await bcrypt.compare(password, hashedPassword);
};

export const generateToken = (userId: string): string => {
   const payload: JWTPayload = {
      user: {
         id: userId
      }
   };

   const token = jwt.sign(payload, process.env.JWT_SECRET!, {
      expiresIn: '24h'
   });

   return token;
};

export const verifyToken = (token: string | null): JWTPayload | null => {
   if (!token) {
      return null;
   }
   try {
      return jwt.verify(token, process.env.JWT_SECRET!) as JWTPayload;
   } catch (error) {
      console.error('Error verifying token:', error);
      return null;
   }
};

export const getTokenFromCookies = async (): Promise<string | null> => {
   try {
      const cookieStore = await cookies();
      return cookieStore.get('token')?.value || null;
   } catch (error) {
      console.error('Error getting token from cookies:', error);
      return null;
   }
};

export const getTokenFromRequest = (request: NextRequest): string | null => {
   const token = request.cookies.get('token')?.value || null;
   return token;
};

export const validatePasswordStrength = (password: string): boolean => {
   const regex = /^[a-zA-Z0-9!@#$%^&*()+=._-]{6,}$/g;
   return password.match(regex) !== null;
};

export { clearAuthCookie, setAuthCookie } from '@/lib/utils/cookieConfig';
