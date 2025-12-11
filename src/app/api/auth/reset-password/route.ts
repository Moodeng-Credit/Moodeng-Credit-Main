import type { NextRequest } from 'next/server';
import { createSupabaseAdminClient } from '@/lib/supabase';
import { handleApiRequest } from '@/lib/utils/apiRequestHandler';
import { resetPasswordSchema } from '@/lib/schemas/auth';
import { ERROR_CODES } from '@/types/errorCodes';
import { SUCCESS_CODES } from '@/types/successCodes';

export async function POST(request: NextRequest) {
   return handleApiRequest(
      request,
      async (data) => {
         const validatedData = resetPasswordSchema.parse(data);
         const supabase = createSupabaseAdminClient();

         // Update password using the reset token
         const { error } = await supabase.auth.updateUser(
            { password: validatedData.password },
            { jwt: validatedData.token }
         );

         if (error) {
            throw {
               code: ERROR_CODES.AUTH_INVALID_TOKEN,
               status: 400,
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
