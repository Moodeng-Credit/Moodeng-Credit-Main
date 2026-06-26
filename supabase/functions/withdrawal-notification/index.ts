import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

import { sendEmail } from '../_shared/email.ts';
import { getBorrowerTelegramNotificationsEnabled } from '../_shared/borrowerNotificationDelivery.ts';
import { sendTelegramMessage } from '../_shared/telegram.ts';

const corsHeaders = {
   'Access-Control-Allow-Origin': '*',
   'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
   'Access-Control-Allow-Methods': 'POST, OPTIONS'
};

type SupabaseClient = ReturnType<typeof createClient>;

const formatAmount = (amount: number) =>
   Number.isFinite(amount) ? amount.toLocaleString('en-US', { maximumFractionDigits: 2 }) : String(amount);

const shortRef = (hash: string) => (hash.length > 14 ? `${hash.slice(0, 8)}…${hash.slice(-6)}` : hash);

const buildEmail = (amount: number, exchange: string, txHash: string) => {
   const amt = formatAmount(amount);
   const subject = `Your ${amt} USDC withdrawal is on its way`;
   const text =
      `Your withdrawal of ${amt} USDC to ${exchange} has been sent and is on its way. ` +
      `It usually arrives within a few minutes. ` +
      `If it hasn't arrived, contact support with this reference: ${txHash}.`;
   const html =
      `<p>Your withdrawal of <strong>${amt} USDC</strong> to <strong>${exchange}</strong> has been sent and is on its way.</p>` +
      `<p>It usually arrives within a few minutes.</p>` +
      `<p style="color:#6b7280;font-size:13px">If it hasn't arrived, contact support with this reference:<br/><code>${txHash}</code></p>`;
   return { subject, text, html };
};

const buildTelegram = (amount: number, exchange: string, txHash: string) =>
   `✅ Your ${formatAmount(amount)} USDC withdrawal to ${exchange} is on its way — it usually arrives within a few minutes.\n\n` +
   `Reference: ${shortRef(txHash)}`;

serve(async (req) => {
   if (req.method === 'OPTIONS') {
      return new Response('ok', { headers: corsHeaders });
   }

   if (req.method !== 'POST') {
      return new Response(JSON.stringify({ error: 'Method not allowed' }), { status: 405, headers: corsHeaders });
   }

   const { withdrawalId } = await req.json().catch(() => ({}));

   if (!withdrawalId) {
      return new Response(JSON.stringify({ error: 'withdrawalId is required' }), { status: 400, headers: corsHeaders });
   }

   const supabase: SupabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
   );

   const { data: withdrawal, error: withdrawalError } = await supabase
      .from('withdrawals')
      .select('id, borrower_user_id, amount, exchange, tx_hash, notified_at')
      .eq('id', withdrawalId)
      .maybeSingle();

   if (withdrawalError) {
      return new Response(JSON.stringify({ error: withdrawalError.message }), { status: 500, headers: corsHeaders });
   }

   if (!withdrawal) {
      return new Response(JSON.stringify({ error: 'Withdrawal not found' }), { status: 404, headers: corsHeaders });
   }

   // Dedup: only notify once per withdrawal, even if the client retries the invoke.
   if (withdrawal.notified_at) {
      return new Response(JSON.stringify({ message: 'Notification already sent' }), { status: 200, headers: corsHeaders });
   }

   const { data: borrower, error: borrowerError } = await supabase
      .from('users')
      .select('id, email, chat_id, notif_transaction_activity')
      .eq('id', withdrawal.borrower_user_id)
      .maybeSingle();

   if (borrowerError) {
      return new Response(JSON.stringify({ error: borrowerError.message }), { status: 500, headers: corsHeaders });
   }

   // Respect the borrower's money-movement notification preference.
   if (borrower?.notif_transaction_activity === false) {
      await supabase.from('withdrawals').update({ notified_at: new Date().toISOString() }).eq('id', withdrawal.id);
      return new Response(JSON.stringify({ message: 'Notifications disabled for user' }), { status: 200, headers: corsHeaders });
   }

   if (!borrower?.email && !borrower?.chat_id) {
      return new Response(JSON.stringify({ error: 'Borrower notification target not found' }), { status: 404, headers: corsHeaders });
   }

   const amount = Number(withdrawal.amount);
   let emailSent = false;
   let telegramSent = false;

   // Route by whatever channel the borrower actually has — email if they signed
   // up with email, Telegram if they connected it (most borrowers have one).
   if (borrower.email) {
      try {
         const { subject, text, html } = buildEmail(amount, withdrawal.exchange, withdrawal.tx_hash);
         await sendEmail(borrower.email, subject, text, html);
         emailSent = true;
      } catch (err) {
         console.error('Withdrawal email failed:', err instanceof Error ? err.message : err);
      }
   }

   if (borrower.chat_id) {
      try {
         const telegramEnabled = await getBorrowerTelegramNotificationsEnabled(supabase);
         if (telegramEnabled) {
            await sendTelegramMessage(borrower.chat_id, buildTelegram(amount, withdrawal.exchange, withdrawal.tx_hash));
            telegramSent = true;
         }
      } catch (err) {
         console.error('Withdrawal Telegram failed:', err instanceof Error ? err.message : err);
      }
   }

   if (!emailSent && !telegramSent) {
      return new Response(JSON.stringify({ error: 'No notification could be delivered' }), { status: 502, headers: corsHeaders });
   }

   await supabase.from('withdrawals').update({ notified_at: new Date().toISOString() }).eq('id', withdrawal.id);

   return new Response(JSON.stringify({ message: 'Notification sent', emailSent, telegramSent }), {
      status: 200,
      headers: corsHeaders
   });
});
