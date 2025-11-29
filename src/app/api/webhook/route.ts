import type { NextRequest } from 'next/server';

import axios from '@/lib/axios';
import { prisma } from '@/lib/database';
import { handleApiRequest } from '@/lib/utils/apiRequestHandler';
import { handleCors } from '@/lib/utils/cors';
import { SUCCESS_CODES } from '@/types/successCodes';

export async function POST(request: NextRequest) {
   // Parse Telegram webhook payload manually
   const body = await request.json();

   return handleApiRequest(
      request,
      async () => {
         const message = body.message;

         if (message && message.from) {
            const chatId = message.chat.id;
            const username = message.from.username;

            const user = await prisma.user.findUnique({ where: { telegramUsername: username } });

            if (user && user.chatId !== chatId) {
               await prisma.user.update({
                  where: { id: user.id },
                  data: { chatId }
               });

               await axios.post(process.env.TELEGRAM_API_URL!, {
                  chat_id: chatId,
                  text: `Hi ${username}, your chat ID has been saved. You will now receive notifications from us.`
               });
            }
         }

         return {};
      },
      {
         successCode: SUCCESS_CODES.WEBHOOK_PROCESSED
      }
   );
}
export async function OPTIONS(request: NextRequest) {
   return handleCors(request);
}
