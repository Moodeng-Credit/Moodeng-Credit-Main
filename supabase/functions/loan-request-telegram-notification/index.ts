import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

import { buildTelegramLoanRequestMessage } from '../_shared/telegramLoanNotifications.ts';

const corsHeaders = {
   'Access-Control-Allow-Origin': '*',
   'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
   'Access-Control-Allow-Methods': 'POST, OPTIONS'
};

const getSetting = async (supabase: ReturnType<typeof createClient>, key: string) => {
   const { data, error } = await supabase.from('telegram_bot_settings').select('value').eq('key', key).maybeSingle();
   if (error) throw new Error(error.message);
   return data?.value as string | undefined;
};

const getRequestSecret = (req: Request) => {
   const authorization = req.headers.get('Authorization') ?? '';
   const bearerToken = authorization.startsWith('Bearer ') ? authorization.slice('Bearer '.length).trim() : null;
   return bearerToken ?? req.headers.get('x-notification-secret');
};

const authorizeInternalRequest = async (supabase: ReturnType<typeof createClient>, req: Request) => {
   const requestSecret = getRequestSecret(req);
   if (!requestSecret) {
      return { authorized: false, status: 401, error: 'Unauthorized' };
   }

   const expectedSecret = Deno.env.get('SUPABASE_SECRET_KEY') ?? Deno.env.get('TELEGRAM_NOTIFICATION_SECRET');
   if (expectedSecret && requestSecret === expectedSecret) {
      return { authorized: true, status: 200, error: null };
   }

   const { data, error } = await supabase.rpc('verify_internal_notification_secret', { candidate: requestSecret });
   if (error) {
      return { authorized: false, status: 500, error: error.message };
   }

   if (data !== true) {
      return { authorized: false, status: 401, error: 'Unauthorized' };
   }

   return { authorized: true, status: 200, error: null };
};

const buildLoanUrl = (loanId: string) => {
   const siteUrl = Deno.env.get('VITE_SITE_URL') ?? Deno.env.get('SITE_URL') ?? 'https://app.moodeng.credit';
   return `${siteUrl.replace(/\/$/, '')}/request-board?loan=${loanId}`;
};

const sendTelegramMessage = async (chatId: string, text: string, loanUrl: string) => {
   const token = Deno.env.get('TELEGRAM_API_TOKEN') ?? Deno.env.get('TELEGRAM_BOT_TOKEN');
   if (!token) throw new Error('TELEGRAM_API_TOKEN is not configured.');

   const response = await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
         chat_id: chatId,
         text,
         disable_web_page_preview: true,
         reply_markup: {
            inline_keyboard: [[{ text: 'Fund this loan', url: loanUrl }]]
         }
      })
   });

   const result = await response.json().catch(() => null);
   if (!response.ok || !result?.ok) {
      throw new Error(result?.description ?? `Telegram sendMessage failed with ${response.status}`);
   }

   return result;
};

serve(async (req) => {
   if (req.method === 'OPTIONS') {
      return new Response('ok', { headers: corsHeaders });
   }

   if (req.method !== 'POST') {
      return new Response(JSON.stringify({ error: 'Method not allowed' }), { status: 405, headers: corsHeaders });
   }

   const supabase = createClient(Deno.env.get('SUPABASE_URL') ?? '', Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '');
   const authorization = await authorizeInternalRequest(supabase, req);
   if (!authorization.authorized) {
      return new Response(JSON.stringify({ error: authorization.error }), {
         status: authorization.status,
         headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
   }

   try {
      const { loanId, dryRun = false } = await req.json().catch(() => ({}));
      if (!loanId) {
         return new Response(JSON.stringify({ error: 'loanId is required' }), { status: 400, headers: corsHeaders });
      }

      const enabled = (await getSetting(supabase, 'lender_notifications_enabled')) === 'true';

      if (!enabled && !dryRun) {
         return new Response(JSON.stringify({ message: 'Telegram lender notifications are disabled.' }), {
            status: 200,
            headers: corsHeaders
         });
      }

      const { data: loan, error: loanError } = await supabase
         .from('loans')
         .select('id, tracking_id, loan_amount, coin, due_date, created_at, reason, borrower_user_id, loan_status')
         .eq('id', loanId)
         .maybeSingle();

      if (loanError) throw new Error(loanError.message);
      if (!loan) {
         return new Response(JSON.stringify({ error: 'Loan not found' }), { status: 404, headers: corsHeaders });
      }

      if (loan.loan_status !== 'Requested') {
         return new Response(JSON.stringify({ message: 'Loan is not an active request.' }), { status: 200, headers: corsHeaders });
      }

      const { data: borrower } = loan.borrower_user_id
         ? await supabase.from('users').select('username, mal').eq('id', loan.borrower_user_id).maybeSingle()
         : { data: null };

      const { data: history, error: historyError } = loan.borrower_user_id
         ? await supabase
              .from('loans')
              .select('id, loan_amount, created_at, funded_at, updated_at, loan_status, repayment_status, lender_user_id')
              .eq('borrower_user_id', loan.borrower_user_id)
              .order('created_at', { ascending: true })
         : { data: [], error: null };

      if (historyError) throw new Error(historyError.message);

      const loanUrl = buildLoanUrl(loan.id);
      const message = buildTelegramLoanRequestMessage(loan, history ?? [], borrower, loanUrl);

      if (dryRun) {
         return new Response(JSON.stringify({ message, loanUrl }), {
            status: 200,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' }
         });
      }

      const chatId =
         (await getSetting(supabase, 'lender_group_chat_id')) ??
         Deno.env.get('TELEGRAM_LENDER_GROUP_CHAT_ID') ??
         Deno.env.get('STAGING_TELEGRAM_LENDER_GROUP_CHAT_ID');

      if (!chatId) {
         throw new Error('lender_group_chat_id is not configured.');
      }

      await sendTelegramMessage(chatId, message, loanUrl);

      return new Response(JSON.stringify({ message: 'Telegram lender notification sent' }), {
         status: 200,
         headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
   } catch (error) {
      return new Response(JSON.stringify({ error: error.message }), {
         status: 500,
         headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
   }
});
