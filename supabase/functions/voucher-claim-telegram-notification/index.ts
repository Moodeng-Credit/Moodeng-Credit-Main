// GrabMart voucher payouts: send each new one straight away, and tell the admin Telegram channel.
// Called by the notify_voucher_claim_telegram trigger on voucher_claims (service key as bearer), and by
// the admin Vouchers page (admin's session token as bearer).
//
//   { claimId }                                  new payout → send its code (pool, else Bitrefill). Sent: post
//                                                an info card. Not sent: post the card with ✅ Send code /
//                                                ❌ Reject and why (remembered in admin_telegram_cards).
//   { claimId, event: 'decided', decidedBy? }    claim left 'pending' (notify_voucher_claim_decided) → stamp the
//                                                card's after-state, e.g. when it was decided in the admin panel.
//                                                A no-op if the Telegram button already stamped it.
//   { claimId, event: 'admin_send' }             admin Vouchers page → Send code (admin session required).
//                                                Lives here because the project is at its function limit.
import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

import { openInAdminButton, sendAdminCard, stampDecisionCards } from '../_shared/adminCards.ts';
import {
   buildVoucherCallback,
   buildVoucherClaimCard,
   buildVoucherSentCard,
   sendVoucherCode,
   type VoucherClaimRow,
   voucherDecidedBy,
   voucherStampHeader
} from '../_shared/voucherClaims.ts';

type SupabaseClient = ReturnType<typeof createClient<any>>;

const corsHeaders = {
   'Access-Control-Allow-Origin': '*',
   'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
   'Access-Control-Allow-Methods': 'POST, OPTIONS'
};

const json = (body: unknown, status = 200) =>
   new Response(JSON.stringify(body), { status, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });

const getSetting = async (supabase: SupabaseClient, key: string) => {
   const { data, error } = await supabase.from('telegram_bot_settings').select('value').eq('key', key).maybeSingle();
   if (error) throw new Error(error.message);
   return data?.value as string | undefined;
};

const bearer = (req: Request) => {
   const authorization = req.headers.get('Authorization') ?? '';
   return authorization.startsWith('Bearer ') ? authorization.slice(7).trim() : req.headers.get('x-notification-secret');
};

const isAuthorized = async (supabase: SupabaseClient, req: Request) => {
   const secret = bearer(req);
   if (!secret) return false;
   const expected = Deno.env.get('SUPABASE_SECRET_KEY') ?? Deno.env.get('TELEGRAM_NOTIFICATION_SECRET');
   if (expected && secret === expected) return true;
   const { data } = await supabase.rpc('verify_internal_notification_secret', { candidate: secret });
   return data === true;
};

/** The calling admin's handle, or null when the bearer isn't an active admin's session. Mirrors admin-loan-notify. */
const adminFromSession = async (supabase: SupabaseClient, req: Request): Promise<string | null> => {
   const token = bearer(req);
   if (!token) return null;
   const { data: userData, error } = await supabase.auth.getUser(token);
   const callerId = userData?.user?.id;
   if (error || !callerId) return null;
   const { data: adminRow } = await supabase
      .from('admin_users')
      .select('user_id')
      .eq('user_id', callerId)
      .eq('active', true)
      .in('role', ['owner', 'admin', 'support'])
      .maybeSingle();
   if (!adminRow) return null;
   const { data: caller } = await supabase.from('users').select('username, email').eq('id', callerId).maybeSingle();
   return caller?.username ? `@${caller.username}` : (caller?.email ?? 'admin');
};

serve(async (req) => {
   if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
   if (req.method !== 'POST') return json({ error: 'Method not allowed' }, 405);

   const supabase = createClient(Deno.env.get('SUPABASE_URL') ?? '', Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '');

   try {
      const { claimId, event, decidedBy } = (await req.json().catch(() => ({}))) as {
         claimId?: string;
         event?: string;
         decidedBy?: string | null;
      };
      if (!claimId || !/^[0-9a-f-]{36}$/i.test(claimId)) return json({ error: 'claimId is required' }, 400);

      if (event === 'admin_send') {
         const admin = await adminFromSession(supabase, req);
         if (!admin) return json({ error: 'Forbidden: admin account required' }, 403);
         return json(await sendVoucherCode(supabase, claimId, `${admin} (admin page)`));
      }

      if (!(await isAuthorized(supabase, req))) return json({ error: 'Unauthorized' }, 401);

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
      const row = claim as unknown as VoucherClaimRow;

      // Send it now; the card only asks for a tap when that didn't work.
      const sent = claim.status === 'pending' ? await sendVoucherCode(supabase, claim.id, 'auto') : null;
      if (sent?.ok) {
         await sendAdminCard(supabase, chatId, {
            kind: 'voucher',
            refId: claim.id,
            text: buildVoucherSentCard(row, sent.summary),
            keyboard: [[openInAdminButton(claim.user_id, username)]]
         });
         return json({ ok: true, sent: true });
      }

      await sendAdminCard(supabase, chatId, {
         kind: 'voucher',
         refId: claim.id,
         text: buildVoucherClaimCard(row, sent?.summary ?? null),
         keyboard: [
            [
               { text: '✅ Send code', callback_data: buildVoucherCallback('sent', claim.id) },
               { text: '❌ Reject', callback_data: buildVoucherCallback('rejected', claim.id) }
            ],
            [openInAdminButton(claim.user_id, username)]
         ]
      });
      return json({ ok: true, sent: false });
   } catch (err) {
      console.error('voucher-claim-telegram-notification failed', err instanceof Error ? err.message : err);
      return json({ error: err instanceof Error ? err.message : 'Unexpected error' }, 500);
   }
});
