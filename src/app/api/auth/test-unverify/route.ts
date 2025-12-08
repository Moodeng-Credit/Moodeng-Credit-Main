import type { NextRequest } from 'next/server';

import { createSupabaseAdminClient } from '@/lib/supabase';
import { handleApiRequest } from '@/lib/utils/apiRequestHandler';
import { WorldId } from '@/types/authTypes';
import { ERROR_CODES } from '@/types/errorCodes';
import { SUCCESS_CODES } from '@/types/successCodes';

export async function POST(request: NextRequest) {
   return handleApiRequest(
      request,
      async (data, userId) => {
         const supabase = createSupabaseAdminClient();

         // Update the user as worldId = INACTIVE (for testing purposes)
         const { error } = await supabase
            .from('users')
            .update({ is_world_id: WorldId.INACTIVE })
            .eq('id', userId);

         if (error) {
            throw { code: ERROR_CODES.SERVER_ERROR, status: 500 };
         }

         return { isWorldId: WorldId.INACTIVE };
      },
      {
         requireAuth: true,
         successCode: SUCCESS_CODES.AUTH_UPDATE_SUCCESS
      }
   );
}
