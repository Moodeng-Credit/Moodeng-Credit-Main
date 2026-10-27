// Posts "referral code owner needs money now" to the admin Telegram channel with ✅ Paid / ⏳ Not paid yet.
// Called by the notify_referral_code_payout triggers on referral_code_payouts (service key as bearer).
//
//   { payoutId }                                  new payout → post the card (remembered in admin_message_refs)
//   { payoutId, event: 'decided', decidedBy? }    status changed (e.g. Paid in the admin panel) → stamp the card.
//                                                 A no-op if the Telegram button already stamped it.
//   { claimId }                                   an affiliate added a friend they referred (submit_referral_claim)
//                                                 → card asking the team to find them in Admin → Referral codes.
import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

import { openInAdminButton, sendAdminCard, stampDecisionCards } from '../_shared/adminCards.ts';
import { buildPayoutCallback, buildPayoutCard, type PayoutRow, payoutSelect, payoutStampHeader } from '../_shared/referralPayouts.ts';
import type { TelegramInlineKeyboard } from '../_shared/telegram.ts';

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

// Tracking only — approving a claim adds the friend to the owner's /affiliate list, no payout.
const postClaimCard = async (supabase: SupabaseClient, claimId: string) => {
   const { data: claim, error } = await supabase
      .from('referral_claims')
      .select(
         'id, friend_name, friend_contact, owner_user_id, code:referral_codes(code), owner:users!referral_claims_owner_user_id_fkey(username, display_name)'
      )
      .eq('id', claimId)
      .maybeSingle();
   if (error) throw new Error(error.message);
   if (!claim) return json({ error: 'Claim not found' }, 404);
   const chatId = await getSetting(supabase, 'kyc_alert_chat_id');
   if (!chatId) return json({ error: 'kyc_alert_chat_id is not set' }, 500);

   const c = claim as unknown as {
      id: string;
      friend_name: string;
      friend_contact: string | null;
      owner_user_id: string;
      code: { code: string } | null;
      owner: { username: string | null; display_name: string | null } | null;
   };
   const owner = c.owner?.display_name?.trim() || (c.owner?.username ? `@${c.owner.username}` : 'An affiliate');
   const text = [
      `🙋 ${owner} says they referred someone`,
      '',
      `Friend: ${c.friend_name}${c.friend_contact ? ` · ${c.friend_contact}` : ''}`,
      `Code: ${c.code?.code ?? '—'}`,
      '',
      'Find them in Admin → Referral codes → Friends to check, then ✅ Approve. Tracking only, no payout.'
   ].join('\n');
   const siteUrl = (Deno.env.get('VITE_SITE_URL') ?? Deno.env.get('SITE_URL') ?? 'https://moodeng.app').replace(/\/$/, '');
   const keyboard: TelegramInlineKeyboard = [[{ text: '🔎 Check in admin', url: `${siteUrl}/admin/referrals` }]];
   await sendAdminCard(supabase, chatId, { kind: 'referral_claim', refId: c.id, text, keyboard });
   return json({ ok: true });
};

serve(async (req) => {
   if (req.method !== 'POST') return json({ error: 'Method not allowed' }, 405);

   const supabase = createClient(Deno.env.get('SUPABASE_URL') ?? '', Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '');
   if (!(await isAuthorized(supabase, req))) return json({ error: 'Unauthorized' }, 401);

   try {
      const { payoutId, event, decidedBy, claimId } = (await req.json().catch(() => ({}))) as {
         payoutId?: string;
         event?: string;
         decidedBy?: string | null;
         claimId?: string;
      };
      if (claimId) return await postClaimCard(supabase, claimId);
      if (!payoutId) return json({ error: 'payoutId is required' }, 400);

      const { data, error } = await supabase.from('referral_code_payouts').select(payoutSelect).eq('id', payoutId).maybeSingle();
      if (error) throw new Error(error.message);
      if (!data) return json({ error: 'Payout not found' }, 404);
      const payout = data as unknown as PayoutRow;

      if (event === 'decided') {
         if (payout.status !== 'paid') return json({ ok: true, stamped: 0 });
         const by = payout.paid_by?.endsWith('via Telegram')
            ? payout.paid_by.replace(/ via Telegram$/, '')
            : decidedBy
              ? `${decidedBy} (admin panel)`
              : 'the admin panel';
         const stamped = await stampDecisionCards(supabase, 'referral_payout', payout.id, { header: payoutStampHeader(payout), by });
         return json({ ok: true, stamped });
      }

      const chatId = await getSetting(supabase, 'kyc_alert_chat_id');
      if (!chatId) return json({ error: 'kyc_alert_chat_id is not set' }, 500);

      const keyboard: TelegramInlineKeyboard = [
         [
            { text: '✅ Paid', callback_data: buildPayoutCallback('paid', payout.id) },
            { text: '⏳ Not paid yet', callback_data: buildPayoutCallback('unpaid', payout.id) }
         ]
      ];
      if (payout.owner_user_id) keyboard.push([openInAdminButton(payout.owner_user_id, payout.owner?.username ?? null)]);
      await sendAdminCard(supabase, chatId, { kind: 'referral_payout', refId: payout.id, text: buildPayoutCard(payout), keyboard });
      return json({ ok: true });
   } catch (err) {
      console.error('referral-payout-telegram-notification failed', err instanceof Error ? err.message : err);
      return json({ error: err instanceof Error ? err.message : 'Unexpected error' }, 500);
   }
});
