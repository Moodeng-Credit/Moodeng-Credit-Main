import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
   'Access-Control-Allow-Origin': '*',
   'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type'
};

serve(async (req) => {
   if (req.method === 'OPTIONS') {
      return new Response('ok', { headers: corsHeaders });
   }

   try {
      const body = await req.json();
      const message = body.message;
      const text = message?.text?.trim();

      const telegramApiUrl = Deno.env.get('TELEGRAM_API_URL');
      const telegramToken = Deno.env.get('TELEGRAM_API_TOKEN');
      const sendTelegramMessage = async (chatId: number | string, responseText: string) => {
         const url = telegramApiUrl ?? (telegramToken ? `https://api.telegram.org/bot${telegramToken}/sendMessage` : null);
         if (!url) return;

         await fetch(url, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
               chat_id: chatId,
               text: responseText
            })
         });
      };

      if (message && message.from) {
         const chatId = message.chat.id;
         const username = message.from.username;
         const chatType = message.chat.type;

         if ((chatType === 'group' || chatType === 'supergroup') && text?.startsWith('/chatid')) {
            await sendTelegramMessage(chatId, `Telegram chat_id for this group: ${chatId}`);
         }

         const supabase = createClient(Deno.env.get('SUPABASE_URL') ?? '', Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '');

         const startPayload = text?.startsWith('/start ') ? text.replace('/start ', '').trim() : '';
         const isUuidPayload = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(startPayload);

         if (message.chat.type === 'private' && isUuidPayload) {
            const { data: user } = await supabase.from('users').select('id, chat_id').eq('id', startPayload).single();

            if (user && user.chat_id !== chatId) {
               await supabase.from('users').update({ chat_id: chatId }).eq('id', user.id);
               await sendTelegramMessage(chatId, 'Your Telegram is connected to Moodeng Credit staging notifications.');
            }
         } else if (username) {
            const { data: user } = await supabase.from('users').select('id, chat_id').eq('telegram_username', username).single();

            if (user && user.chat_id !== chatId) {
               await supabase.from('users').update({ chat_id: chatId }).eq('id', user.id);
               await sendTelegramMessage(
                  chatId,
                  `Hi ${username}, your chat ID has been saved. You will now receive notifications from us.`
               );
            }
         }
      }

      return new Response(JSON.stringify({ message: 'Webhook processed' }), {
         headers: { ...corsHeaders, 'Content-Type': 'application/json' },
         status: 200
      });
   } catch (error) {
      return new Response(JSON.stringify({ error: 'Internal server error', details: error.message }), {
         headers: { ...corsHeaders, 'Content-Type': 'application/json' },
         status: 500
      });
   }
});
