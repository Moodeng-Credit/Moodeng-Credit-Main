// Posts a new GrabFood voucher claim to the admin Telegram channel with Mark sent / Reject buttons.
// Called by the notify_voucher_claim_telegram trigger on voucher_claims (service key as bearer).
//
//   { claimId }                                  new claim → post the card (remembered in admin_telegram_cards)
//   { claimId, event: 'decided', decidedBy? }    claim left 'pending' (notify_voucher_claim_decided) → stamp the
//                                                card's after-state, e.g. when it was decided in the admin panel.
//                                                A no-op if the Telegram button already stamped it.
import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

import { openInAdminButton, sendAdminCard, stampDecisionCards } from '../_shared/adminCards.ts';
import {
   buildVoucherCallback,
   buildVoucherClaimCard,
   type VoucherClaimRow,
   voucherDecidedBy,
   voucherStampHeader
} from '../_shared/voucherClaims.ts';

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
      const { claimId, event, decidedBy } = (await req.json().catch(() => ({}))) as {
         claimId?: string;
         event?: string;
         decidedBy?: string | null;
      };
      if (!claimId) return json({ error: 'claimId is required' }, 400);

      const { data: claim, error } = await supabase
         .from('voucher_claims')
         .select('id, user_id, reward, amount_php, full_name, mobile, email, status, admin_note, created_at, users(username)')
         .eq('id', claimId)
         .maybeSingle();
      if (error) throw new Error(error.message);
      if (!claim) return json({ error: 'Claim not found' }, 404);

      if (event === 'decided') {
         if (claim.status !== 'sent' && claim.status !== 'rejected') return json({ ok: true, stamped: 0 });
         const by = voucherDecidedBy(claim.admin_note) ?? (decidedBy ? `${decidedBy} (admin panel)` : 'the admin panel');
         const stamped = await stampDecisionCards(supabase, 'voucher', claim.id, {
            header: voucherStampHeader(claim.status, claim),
            // A rejection reason typed in the admin panel is for the team — show it on the card.
            detail: claim.status === 'rejected' && claim.admin_note && !voucherDecidedBy(claim.admin_note) ? `Reason: ${claim.admin_note}` : null,
            by
         });
         return json({ ok: true, stamped });
      }

      const chatId = await getSetting(supabase, 'kyc_alert_chat_id');
      if (!chatId) return json({ error: 'kyc_alert_chat_id is not set' }, 500);

      const username = (Array.isArray(claim.users) ? claim.users[0]?.username : (claim.users as { username?: string | null } | null)?.username) ?? null;
      await sendAdminCard(supabase, chatId, {
         kind: 'voucher',
         refId: claim.id,
         text: buildVoucherClaimCard(claim as unknown as VoucherClaimRow),
         keyboard: [
            [
               { text: '✅ Mark sent', callback_data: buildVoucherCallback('sent', claim.id) },
               { text: '❌ Reject', callback_data: buildVoucherCallback('rejected', claim.id) }
            ],
            [openInAdminButton(claim.user_id, username)]
         ]
      });
      return json({ ok: true });
   } catch (err) {
      console.error('voucher-claim-telegram-notification failed', err instanceof Error ? err.message : err);
      return json({ error: err instanceof Error ? err.message : 'Unexpected error' }, 500);
   }
});
