import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
   'Access-Control-Allow-Origin': '*',
   'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type'
};

interface TelegramUpdate {
   update_id: number;
   message?: {
      message_id: number;
      from: {
         id: number;
         is_bot: boolean;
         first_name: string;
         username?: string;
      };
      chat: {
         id: number;
         type: string;
      };
      date: number;
      text?: string;
   };
}

serve(async (req) => {
   if (req.method === 'OPTIONS') {
      return new Response('ok', { headers: corsHeaders });
   }

   try {
      const update: TelegramUpdate = await req.json();

      if (!update.message) {
         return new Response(JSON.stringify({ ok: true }), {
            status: 200,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' }
         });
      }

      const { message } = update;
      const chatId = message.chat.id;
      const telegramId = message.from.id;
      const telegramUsername = message.from.username;
      const text = message.text || '';

      const botToken = Deno.env.get('TELEGRAM_BOT_TOKEN');

      // Handle /start command
      if (text.startsWith('/start')) {
         const parts = text.split(' ');
         const username = parts[1]; // Deep link parameter

         if (username) {
            // Link Telegram account to user
            const supabaseAdmin = createClient(
               Deno.env.get('SUPABASE_URL') ?? '',
               Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
               {
                  auth: {
                     autoRefreshToken: false,
                     persistSession: false
                  }
               }
            );

            const { error } = await supabaseAdmin
               .from('users')
               .update({
                  telegram_id: telegramId,
                  telegram_username: telegramUsername,
                  chat_id: chatId
               })
               .eq('username', username);

            if (error) {
               await sendTelegramMessage(botToken!, chatId, 'Failed to link your account. Please try again.');
            } else {
               await sendTelegramMessage(
                  botToken!,
                  chatId,
                  `Welcome! Your Telegram account has been linked to ${username}. You will now receive notifications here.`
               );
            }
         } else {
            await sendTelegramMessage(
               botToken!,
               chatId,
               'Welcome to Moodeng Credit Bot! Please use the link from your profile page to connect your account.'
            );
         }
      }

      return new Response(JSON.stringify({ ok: true }), {
         status: 200,
         headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
   } catch (error) {
      console.error('Webhook error:', error);
      return new Response(JSON.stringify({ error: 'Internal server error' }), {
         status: 500,
         headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
   }
});

async function sendTelegramMessage(botToken: string, chatId: number, text: string) {
   await fetch(`https://api.telegram.org/bot${botToken}/sendMessage`, {
      method: 'POST',
      headers: {
         'Content-Type': 'application/json'
      },
      body: JSON.stringify({
         chat_id: chatId,
         text
      })
   });
}
