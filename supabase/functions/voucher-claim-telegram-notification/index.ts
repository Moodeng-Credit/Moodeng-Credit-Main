// Food voucher claims: send each new one straight away (Xoxo link, else Bitrefill), and tell the admin
// Telegram channel.
// Called by the notify_voucher_claim_telegram trigger on voucher_claims (service key as bearer), and by
// the admin Vouchers page (admin's session token as bearer).
//
//   { claimId }                                  new claim → send it (Xoxo links, else Bitrefill). Sent: post
//                                                an info card. Not sent: post the card with ✅ Send code /
//                                                ❌ Reject and why (remembered in admin_telegram_cards).
//   { claimId, event: 'decided', decidedBy? }    claim left 'pending' (notify_voucher_claim_decided) → stamp the
//                                                card's after-state, e.g. when it was decided in the admin panel.
//                                                A no-op if the Telegram button already stamped it.
//   { claimId, event: 'receipt' }                borrower tapped I got it / Didn't get it (notify_voucher_receipt) →
//                                                a one-line Telegram message.
//   { event: 'digest', nudge? }                  daily 10:00 Bangkok (voucher-daily-digest cron): who earned but
//                                                hasn't claimed, what's stuck, who hasn't confirmed. First nudges
//                                                the unclaimed / unconfirmed on Messenger (once per amount, see
//                                                voucher_messenger_nudges), then posts the digest with 💬 / 👤 buttons.
//                                                nudge: false skips the Messenger nudges (list only).
// Every post to the rewards group is also mirrored to Discord #rewards (toDiscord).
//   { event: 'announce', text }                  internal: post a team notice to the rewards group (e.g. how a new
//                                                rewards feature works), from the same bot as the cards.
//   { claimId, event: 'admin_send' }             admin Vouchers page → Send code (admin session required).
//                                                Lives here because the project is at its function limit.
import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

import { openInAdminButton, sendAdminCard, stampDecisionCards } from '../_shared/adminCards.ts';
import { mirrorToDiscord } from '../_shared/discord.ts';
import { getGiftawayBalance, getGiftawayConfig, parseGiftawaySource, resendGiftawayOrder } from '../_shared/giftaway.ts';
import { sendTelegramMessage } from '../_shared/telegram.ts';
import {
   buildVoucherCallback,
   buildVoucherClaimCard,
   buildRewardNudgeMessage,
   buildVoucherDigest,
   buildVoucherDigestKeyboard,
   buildVoucherReceiptMessage,
   buildVoucherSentCard,
   loadMessengerContact,
   messageBorrower,
   messengerChatButton,
   sendVoucherCode,
   type VoucherClaimRow,
   type VoucherDigest,
   type VoucherDigestPerson,
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

// Everything posted to the Telegram rewards group is mirrored to Discord #rewards
// (vault DISCORD_REWARDS_WEBHOOK_URL via discord_rewards_webhook()); unset = Telegram only.
const toDiscord = async (supabase: SupabaseClient, text: string, keyboard?: Parameters<typeof mirrorToDiscord>[2]) => {
   const { data } = await supabase.rpc('discord_rewards_webhook');
   await mirrorToDiscord(typeof data === 'string' ? data : null, text, keyboard);
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

// Nudge on Messenger: earned-not-claimed, and sent-but-no-"I got it" after a day. Each person once per
// amount (a new reward raises the amount and nudges again). Only remembered when it went through, so
// someone outside Meta's 24h window is tried again tomorrow.
const NUDGE_KINDS = ['unclaimed', 'no_answer'] as const;

const nudgeOnMessenger = async (supabase: SupabaseClient, digest: VoucherDigest) => {
   const { data: past } = await supabase.from('voucher_messenger_nudges').select('user_id, kind, amount_php');
   const last = new Map(((past ?? []) as Array<{ user_id: string; kind: string; amount_php: number | string }>).map((r) => [`${r.user_id}:${r.kind}`, Number(r.amount_php)]));
   for (const kind of NUDGE_KINDS) {
      for (const person of (digest[kind] ?? []) as VoucherDigestPerson[]) {
         const amountPhp = Number(person.amountPhp);
         if (!person.userId || !person.messengerContactId) continue;
         if (kind === 'no_answer' && (person.days ?? 0) < 1) continue;
         if ((last.get(`${person.userId}:${kind}`) ?? 0) >= amountPhp) continue;
         const facebook = await loadMessengerContact(supabase, person.userId);
         const outcome = await messageBorrower(facebook, buildRewardNudgeMessage({ kind, firstName: facebook?.firstName ?? null, locale: facebook?.locale ?? 'en', amountPhp }));
         person.nudge = outcome === 'sent' ? 'sent' : 'failed';
         if (outcome === 'sent') {
            await supabase
               .from('voucher_messenger_nudges')
               .upsert({ user_id: person.userId, kind, amount_php: amountPhp, nudged_at: new Date().toISOString() }, { onConflict: 'user_id,kind' });
         }
      }
   }
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
      const { claimId, event, decidedBy, text, nudge } = (await req.json().catch(() => ({}))) as {
         claimId?: string;
         event?: string;
         decidedBy?: string | null;
         text?: string;
         // digest: false = just post the list, no Messenger nudges (e.g. an extra run outside 10:00).
         nudge?: boolean;
      };
      if (event === 'announce') {
         if (!(await isAuthorized(supabase, req))) return json({ error: 'Unauthorized' }, 401);
         if (typeof text !== 'string' || !text.trim() || text.length > 4000) return json({ error: 'text is required (≤4000 chars)' }, 400);
         const chatId = (await getSetting(supabase, 'voucher_alert_chat_id')) ?? (await getSetting(supabase, 'kyc_alert_chat_id'));
         if (!chatId) return json({ error: 'voucher_alert_chat_id / kyc_alert_chat_id is not set' }, 500);
         const sent = (await sendTelegramMessage(chatId, text.trim())) as { message_id?: number } | undefined;
         await toDiscord(supabase, text.trim());
         return json({ ok: true, messageId: sent?.message_id ?? null });
      }

      if (event === 'digest') {
         if (!(await isAuthorized(supabase, req))) return json({ error: 'Unauthorized' }, 401);
         const chatId = (await getSetting(supabase, 'voucher_alert_chat_id')) ?? (await getSetting(supabase, 'kyc_alert_chat_id'));
         if (!chatId) return json({ error: 'voucher_alert_chat_id / kyc_alert_chat_id is not set' }, 500);
         const { data: digest, error: digestError } = await supabase.rpc('voucher_daily_digest');
         if (digestError) throw new Error(digestError.message);
         const { count: linksLeft } = await supabase
            .from('voucher_codes')
            .select('id', { count: 'exact', head: true })
            .is('assigned_at', null)
            .eq('amount_php', 50);
         const giftaway = await getGiftawayConfig(supabase);
         const giftawayCredits = giftaway ? await getGiftawayBalance(giftaway) : null;
         if (nudge !== false) await nudgeOnMessenger(supabase, digest as VoucherDigest);
         const keyboard = buildVoucherDigestKeyboard(digest as VoucherDigest);
         const digestText = buildVoucherDigest(digest as VoucherDigest, linksLeft ?? null, giftawayCredits);
         await sendTelegramMessage(chatId, digestText, keyboard.length ? { inlineKeyboard: keyboard } : {});
         await toDiscord(supabase, digestText, keyboard);
         return json({ ok: true });
      }

      if (!claimId || !/^[0-9a-f-]{36}$/i.test(claimId)) return json({ error: 'claimId is required' }, 400);

      if (event === 'admin_send') {
         const admin = await adminFromSession(supabase, req);
         if (!admin) return json({ error: 'Forbidden: admin account required' }, 403);
         return json(await sendVoucherCode(supabase, claimId, `${admin} (admin page)`));
      }

      if (!(await isAuthorized(supabase, req))) return json({ error: 'Unauthorized' }, 401);

      const { data: claim, error } = await supabase
         .from('voucher_claims')
         .select('id, user_id, reward, amount_php, brand, full_name, mobile, email, status, admin_note, received_at, created_at, users(username)')
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

      // Voucher cards go to their own group (voucher_alert_chat_id), else the admin/KYC chat.
      const chatId = (await getSetting(supabase, 'voucher_alert_chat_id')) ?? (await getSetting(supabase, 'kyc_alert_chat_id'));
      if (!chatId) return json({ error: 'voucher_alert_chat_id / kyc_alert_chat_id is not set' }, 500);

      if (event === 'receipt') {
         const chatButton = claim.received_at ? null : messengerChatButton(await loadMessengerContact(supabase, claim.user_id), claim.full_name);
         // "Didn't get it" on a Giftaway eGift: have Giftaway send it again straight away.
         let resent: boolean | null = null;
         if (!claim.received_at) {
            const { data: codes } = await supabase.from('voucher_codes').select('source').eq('claim_id', claim.id).like('source', 'giftaway %').limit(1);
            const order = parseGiftawaySource(codes?.[0]?.source);
            const giftaway = order ? await getGiftawayConfig(supabase) : null;
            if (order && giftaway) resent = await resendGiftawayOrder(giftaway, order.referenceNo, order.orderId);
         }
         const receiptText = buildVoucherReceiptMessage(claim as unknown as VoucherClaimRow & { received_at?: string | null }, resent);
         await sendTelegramMessage(chatId, receiptText, chatButton ? { inlineKeyboard: [[chatButton]] } : {});
         await toDiscord(supabase, receiptText, chatButton ? [[chatButton]] : []);
         return json({ ok: true });
      }
      const username = (Array.isArray(claim.users) ? claim.users[0]?.username : (claim.users as { username?: string | null } | null)?.username) ?? null;
      const row = claim as unknown as VoucherClaimRow;
      const facebook = await loadMessengerContact(supabase, claim.user_id);
      const chatButton = messengerChatButton(facebook, claim.full_name);

      // Send it now; the card only asks for a tap when that didn't work.
      const sent = claim.status === 'pending' ? await sendVoucherCode(supabase, claim.id, 'auto') : null;
      if (sent?.ok) {
         const sentCard = { text: buildVoucherSentCard(row, sent.summary, facebook), keyboard: [...(chatButton ? [[chatButton]] : []), [openInAdminButton(claim.user_id, username)]] };
         await sendAdminCard(supabase, chatId, { kind: 'voucher', refId: claim.id, ...sentCard });
         await toDiscord(supabase, sentCard.text, sentCard.keyboard);
         return json({ ok: true, sent: true });
      }

      const claimCard = buildVoucherClaimCard(row, sent?.summary ?? null, facebook);
      const links = [...(chatButton ? [[chatButton]] : []), [openInAdminButton(claim.user_id, username)]];
      await sendAdminCard(supabase, chatId, {
         kind: 'voucher',
         refId: claim.id,
         text: claimCard,
         keyboard: [
            [
               { text: '✅ Send code', callback_data: buildVoucherCallback('sent', claim.id) },
               { text: '❌ Reject', callback_data: buildVoucherCallback('rejected', claim.id) }
            ],
            ...links
         ]
      });
      await toDiscord(supabase, `${claimCard}\n\n→ Send or reject it in the Telegram rewards group (✅ Send code / ❌ Reject) or Admin → Food vouchers.`, links);
      return json({ ok: true, sent: false });
   } catch (err) {
      console.error('voucher-claim-telegram-notification failed', err instanceof Error ? err.message : err);
      return json({ error: err instanceof Error ? err.message : 'Unexpected error' }, 500);
   }
});
