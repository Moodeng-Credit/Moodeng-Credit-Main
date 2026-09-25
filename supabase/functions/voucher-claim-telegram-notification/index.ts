// Posts a new GrabFood voucher claim to the admin Telegram channel with Mark sent / Reject buttons.
// Called by the notify_voucher_claim_telegram trigger on voucher_claims (service key as bearer).
import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

import { sendTelegramMessage } from '../_shared/telegram.ts';
import { buildVoucherCallback, buildVoucherClaimCard, type VoucherClaimRow } from '../_shared/voucherClaims.ts';

type SupabaseClient = ReturnType<typeof createClient<any>>;

const json = (body: unknown, status = 200) =>
   new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } });

const getSetting = async (supabase: SupabaseClient, key: string) => {
   const { data, error } = await supabase.from('telegram_bot_settings').select('value').eq('key', key).maybeSingle();
   if (error) throw new Error(error.message);
   return data?.value as string | undefined;
};

const isAuthorized = async (supabase: SupabaseClient, req: Request) => {
   const authorization = req.headers.get('Authorization') ?? '';
   const secret = authorization.startsWith('Bearer ') ? authorization.slice(7).trim() : req.headers.get('x-notification-secret');
   if (!secret) return false;
   const expected = Deno.env.get('SUPABASE_SECRET_KEY') ?? Deno.env.get('TELEGRAM_NOTIFICATION_SECRET');
   if (expected && secret === expected) return true;
   const { data } = await supabase.rpc('verify_internal_notification_secret', { candidate: secret });
   return data === true;
};

serve(async (req) => {
   if (req.method !== 'POST') return json({ error: 'Method not allowed' }, 405);

   const supabase = createClient(Deno.env.get('SUPABASE_URL') ?? '', Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '');
   if (!(await isAuthorized(supabase, req))) return json({ error: 'Unauthorized' }, 401);

   try {
      const { claimId } = (await req.json().catch(() => ({}))) as { claimId?: string };
      if (!claimId) return json({ error: 'claimId is required' }, 400);

      const { data: claim, error } = await supabase
         .from('voucher_claims')
         .select('id, reward, amount_php, full_name, mobile, email, status, created_at, users(username)')
         .eq('id', claimId)
         .maybeSingle();
      if (error) throw new Error(error.message);
      if (!claim) return json({ error: 'Claim not found' }, 404);

      const chatId = await getSetting(supabase, 'kyc_alert_chat_id');
      if (!chatId) return json({ error: 'kyc_alert_chat_id is not set' }, 500);

      await sendTelegramMessage(chatId, buildVoucherClaimCard(claim as unknown as VoucherClaimRow), {
         inlineKeyboard: [
            [
               { text: '✅ Mark sent', callback_data: buildVoucherCallback('sent', claim.id) },
               { text: '❌ Reject', callback_data: buildVoucherCallback('rejected', claim.id) }
            ]
         ]
      });
      return json({ ok: true });
   } catch (err) {
      console.error('voucher-claim-telegram-notification failed', err instanceof Error ? err.message : err);
      return json({ error: err instanceof Error ? err.message : 'Unexpected error' }, 500);
   }
});
