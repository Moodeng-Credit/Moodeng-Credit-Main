import { forgotPasswordSchema } from '@/lib/schemas/auth';
import { createSupabaseAdminClient } from '@/lib/supabase';
import { handleApiRequest } from '@/lib/utils/apiRequestHandler';
import { ERROR_CODES } from '@/types/errorCodes';
import { SUCCESS_CODES } from '@/types/successCodes';
import type { NextRequest } from 'next/server';

export async function POST(request: NextRequest) {
   return handleApiRequest(
      request,
      async (data) => {
         const validatedData = forgotPasswordSchema.parse(data);
         const supabase = createSupabaseAdminClient();

         // Get the redirect URL from environment variables
         const redirectUrl = process.env.NEXT_PUBLIC_REDIRECT_URL || 'http://localhost:3000/reset-password';

         // Send password reset email via Supabase Auth
         const { error } = await supabase.auth.resetPasswordForEmail(validatedData.email, {
            redirectTo: redirectUrl
         });

         if (error) {
            throw {
               code: ERROR_CODES.SERVER_ERROR,
               status: 400,
               message: error.message || 'Failed to send password reset email'
            };
         }

         return {
            message: 'Password reset email sent. Please check your inbox for further instructions.'
         };
      },
      {
         requireAuth: false,
         successCode: SUCCESS_CODES.PASSWORD_RESET_EMAIL_SENT
      }
   );
}
