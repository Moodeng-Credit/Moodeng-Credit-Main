import { type NextRequest } from 'next/server';

import { handleApiRequest } from '@/lib/utils/apiRequestHandler';
import { clearAuthCookie } from '@/lib/utils/auth';
import { handleCors } from '@/lib/utils/cors';
import { SUCCESS_CODES } from '@/types/successCodes';

export async function POST(request: NextRequest) {
   return handleApiRequest(
      request,
      async () => {
         return {};
      },
      {
         successCode: SUCCESS_CODES.AUTH_LOGOUT_SUCCESS,
         beforeResponse: (response) => {
            clearAuthCookie(response);
         }
      }
   );
}
export async function OPTIONS(request: NextRequest) {
   return handleCors(request);
}
