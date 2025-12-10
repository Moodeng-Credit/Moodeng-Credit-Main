import type { NextRequest } from 'next/server';

import { sendMail } from '@/lib/services/email';
import { createSupabaseAdminClient } from '@/lib/supabase';
import { handleApiRequest } from '@/lib/utils/apiRequestHandler';
import { ERROR_CODES } from '@/types/errorCodes';
import { SUCCESS_CODES } from '@/types/successCodes';

export async function POST(request: NextRequest) {
   return handleApiRequest(
      request,
      async (data, userId) => {
         const supabase = createSupabaseAdminClient();
         const { data: user, error } = await supabase.from('users').select('*').eq('id', userId).single();

         if (error || !user) {
            throw { code: ERROR_CODES.USER_NOT_FOUND, status: 404 };
         }

         const emailSubject = 'Test Email from Moodeng Credit';
         const emailMessage = `Hello ${user.username},

This is a test email to verify that your email notifications are working correctly.

If you received this message, your email settings are configured properly!

Best regards,
Moodeng Credit Team`;

         const emailResult = await sendMail(user.email, emailSubject, emailMessage);

         if (!emailResult.success) {
            throw {
               code: ERROR_CODES.SERVER_ERROR,
               status: 500,
               message: 'Failed to send test email'
            };
         }

         return {
            message: 'Test email sent successfully! Please check your inbox.'
         };
      },
      {
         requireAuth: true,
         successCode: SUCCESS_CODES.SUCCESS
      }
   );
}
