import { resetPasswordSchema } from '@/lib/schemas/auth';
import { getSupabaseBrowserClient } from '@/lib/supabase/client';
import { handleApiRequest } from '@/lib/utils/apiRequestHandler';
import { ERROR_CODES } from '@/types/errorCodes';
import { SUCCESS_CODES } from '@/types/successCodes';
import type { NextRequest } from 'next/server';

export async function POST(request: NextRequest) {
   return handleApiRequest(
      request,
      async (data) => {
         const validatedData = resetPasswordSchema.parse(data);

         // The client passes the password and we update it using the client instance
         // which will have access to the session from the email link
         const supabase = getSupabaseBrowserClient();

         const { error } = await supabase.auth.updateUser({
            password: validatedData.password
         });

         if (error) {
            throw {
               code: ERROR_CODES.AUTH_INVALID_TOKEN,
               status: 401,
               message: error.message || 'Failed to reset password. The link may have expired.'
            };
         }

         return {
            message: 'Password reset successfully. You can now log in with your new password.'
         };
      },
      {
         requireAuth: false,
         successCode: SUCCESS_CODES.PASSWORD_RESET_SUCCESS
      }
   );
}

