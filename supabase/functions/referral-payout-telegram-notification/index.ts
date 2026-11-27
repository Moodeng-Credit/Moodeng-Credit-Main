// Posts "referral code owner needs money now" to the admin Telegram channel with ✅ Paid / ⏳ Not paid yet.
// Called by the notify_referral_code_payout triggers on referral_code_payouts (service key as bearer).
//
//   { payoutId }                                  new payout → post the card (remembered in admin_message_refs)
//   { payoutId, event: 'decided', decidedBy? }    status changed (e.g. Paid in the admin panel) → stamp the card.
//                                                 A no-op if the Telegram button already stamped it.
//   { claimId }                                   an affiliate added a friend they referred (submit_referral_claim)
//                                                 → card asking the team to find them in Admin → Referral codes.
//   { interestRefundId }                          "Pay zero interest": an invited friend repaid, so the inviter's
//                                                 interest is owed (notify_interest_refund) → who, how much, wallet.
//   { interestRefundId, event: 'sent', decidedBy? } marked Sent in the admin panel → stamp the card.
//   { invoiceId }                                 an affiliate sent their monthly invoice (affiliate_invoices insert)
//                                                 → who, which month, how much, which wallet, each friend line.
//   { creatorApp: { event, id, code? } }           moodeng.app/creator applications: code / confirmation /
//                                                 approved / rejected emails + the team card (_shared/creatorApplications)
//   { payday: 'YYYY-MM-DD', test? }               15th / 30th (affiliate-payday cron): one card per code owner with
//                                                 every unpaid "funded friend" payout (referral_codes.pay_on_funded_from),
//                                                 or one "nothing owed" line. Chat: affiliate_payday_chat_id (else
//                                                 kyc_alert_chat_id). test → 🧪 prefix.
import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

import { formatDecidedAt, openInAdminButton, sendAdminCard, stampDecisionCards } from '../_shared/adminCards.ts';
import {
   type CreatorApp,
   creatorApprovedEmail,
   creatorCodeEmail,
   creatorRejectedEmail,
   creatorSubmittedEmail,
   creatorTeamCard
} from '../_shared/creatorApplications.ts';
import { sendEmail } from '../_shared/email.ts';
import { buildPayoutCallback, buildPayoutCard, type PayoutRow, payoutSelect, payoutStampHeader } from '../_shared/referralPayouts.ts';
import { sendTelegramMessage, type TelegramInlineKeyboard } from '../_shared/telegram.ts';

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

// A borrower added a friend by hand. Team-made code: tracking only. Personal code: approving links the
// friend, and pays the $5 if they joined within 30 days of the claim (admin_decide_referral_claim).
const postClaimCard = async (supabase: SupabaseClient, claimId: string) => {
   const { data: claim, error } = await supabase
      .from('referral_claims')
      .select(
         'id, friend_name, friend_contact, friend_facebook_url, owner_user_id, code:referral_codes(code), owner:users!referral_claims_owner_user_id_fkey(username, display_name), suggested:users!referral_claims_suggested_user_id_fkey(username, display_name)'
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
      friend_facebook_url: string | null;
      owner_user_id: string;
      code: { code: string } | null;
      owner: { username: string | null; display_name: string | null } | null;
      suggested: { username: string | null; display_name: string | null } | null;
   };
   const owner = c.owner?.display_name?.trim() || (c.owner?.username ? `@${c.owner.username}` : 'An affiliate');
   const text = [
      `🙋 ${owner} says they referred someone`,
      '',
      `Friend: ${c.friend_name}${c.friend_contact ? ` · ${c.friend_contact}` : ''}`,
      ...(c.friend_facebook_url ? [`Facebook: ${c.friend_facebook_url}`] : []),
      `Code: ${c.code?.code ?? 'personal invite code'}`,
      ...(c.suggested
         ? [`Match found: ${c.suggested.display_name?.trim() || `@${c.suggested.username ?? '?'}`} (one tap to approve in admin)`]
         : []),
      '',
      c.code
         ? 'Find them in Admin → Referral codes → Friends to check, then ✅ Approve. Tracking only, no payout.'
         : 'Find them in Admin → Referral codes → Friends to check, then ✅ Approve. Pays $5 when they repay if they joined in the last 30 days.'
   ].join('\n');
   const siteUrl = (Deno.env.get('VITE_SITE_URL') ?? Deno.env.get('SITE_URL') ?? 'https://moodeng.app').replace(/\/$/, '');
   const keyboard: TelegramInlineKeyboard = [[{ text: '🔎 Check in admin', url: `${siteUrl}/admin/referrals` }]];
   await sendAdminCard(supabase, chatId, { kind: 'referral_claim', refId: c.id, text, keyboard });
   return json({ ok: true });
};

type Person = { id?: string; username: string | null; display_name: string | null; email?: string | null } | null;

type InterestRefundRow = {
   id: string;
   status: string;
   amount_usd: number;
   interest_usd: number;
   kind: string | null;
   tx_hash: string | null;
   created_at: string;
   user: (Person & { wallet_address: string | null }) | null;
   loan: { loan_amount: number; total_repayment_amount: number } | null;
   friend: { referred: Person } | null;
};

const personLabel = (p: Person) => p?.display_name?.trim() || (p?.username ? `@${p.username}` : null) || p?.email || 'Someone';
const usd = (value: number) => `$${Number(value).toFixed(2)}`;

// "Pay zero interest": who to pay, how much, to which wallet, and that it's due now.
const handleInterestRefund = async (supabase: SupabaseClient, refundId: string, event?: string, decidedBy?: string | null) => {
   const { data, error } = await supabase
      .from('interest_refunds')
      .select(
         'id, status, amount_usd, interest_usd, kind, tx_hash, created_at, user:users!interest_refunds_user_id_fkey(id, username, display_name, email, wallet_address), loan:loans!interest_refunds_loan_id_fkey(loan_amount, total_repayment_amount), friend:friend_referrals!interest_refunds_friend_referral_id_fkey(referred:users!friend_referrals_referred_user_id_fkey(username, display_name))'
      )
      .eq('id', refundId)
      .maybeSingle();
   if (error) throw new Error(error.message);
   if (!data) return json({ error: 'Interest refund not found' }, 404);
   const r = data as unknown as InterestRefundRow;
   const who = personLabel(r.user);
   const isBonus = r.kind === 'bonus';
   const isCash = r.kind === 'cash' || isBonus;
   const friendName = personLabel(r.friend?.referred ?? null);

   if (event === 'sent') {
      if (r.status !== 'sent') return json({ ok: true, stamped: 0 });
      const stamped = await stampDecisionCards(supabase, 'interest_refund', r.id, {
         header: isBonus
            ? `✅ SENT — ${who} got ${usd(r.amount_usd)} USDC Shark Fighter bonus`
            : isCash
              ? `✅ SENT — ${who} got ${usd(r.amount_usd)} USDC affiliate reward`
              : `✅ SENT — ${who} got ${usd(r.amount_usd)} USDC back`,
         detail: r.tx_hash ? `Tx: ${r.tx_hash}` : null,
         by: decidedBy ? `${decidedBy} (admin panel)` : 'the admin panel'
      });
      return json({ ok: true, stamped });
   }

   const chatId = await getSetting(supabase, 'kyc_alert_chat_id');
   if (!chatId) return json({ error: 'kyc_alert_chat_id is not set' }, 500);

   const text = isBonus
      ? [
           `🎁 Pay ${who} ${usd(r.amount_usd)} USDC now — Shark Fighter bonus (10 friends repaid on time)`,
           '',
           `To (USDC on Base): ${r.user?.wallet_address || 'NO WALLET ON FILE — message them first'}`,
           `Who: ${who}${r.user?.username ? ` (@${r.user.username})` : ''}${r.user?.email ? ` · ${r.user.email}` : ''}`,
           'Why: a full stamp card. 10 friends joined with their code and repaid on time',
           `Owed since: ${formatDecidedAt(new Date(r.created_at))}`,
           '',
           'Send it, then mark ✅ Sent in Admin → Referral codes → Affiliate payouts.'
        ].join('\n')
      : isCash
        ? [
             `💸 Pay ${who} ${usd(r.amount_usd)} USDC now — affiliate reward (friend ${friendName} repaid)`,
             '',
             `To (USDC on Base): ${r.user?.wallet_address || 'NO WALLET ON FILE — message them first'}`,
             `Who: ${who}${r.user?.username ? ` (@${r.user.username})` : ''}${r.user?.email ? ` · ${r.user.email}` : ''}`,
             `Why: their friend ${friendName} joined with their code and repaid a loan on time (${usd(r.amount_usd)} per friend)`,
             `Owed since: ${formatDecidedAt(new Date(r.created_at))}`,
             '',
             'Send it, then mark ✅ Sent in Admin → Referral codes → Affiliate payouts.'
          ].join('\n')
        : [
             `💸 Pay ${who} ${usd(r.amount_usd)} USDC now — interest refund`,
             '',
             `To (USDC on Base): ${r.user?.wallet_address || 'NO WALLET ON FILE — message them first'}`,
             `Who: ${who}${r.user?.username ? ` (@${r.user.username})` : ''}${r.user?.email ? ` · ${r.user.email}` : ''}`,
             `Why: their friend ${personLabel(r.friend?.referred ?? null)} joined with their code and repaid a loan`,
             `Their loan: ${usd(r.loan?.loan_amount ?? 0)} → ${usd(r.loan?.total_repayment_amount ?? 0)} (interest ${usd(r.interest_usd)}${Number(r.amount_usd) < Number(r.interest_usd) ? ', capped at $5' : ''})`,
             `Owed since: ${formatDecidedAt(new Date(r.created_at))}`,
             '',
             'Send it, then mark ✅ Sent in Admin → Referral codes → Interest refunds.'
          ].join('\n');
   const siteUrl = (Deno.env.get('VITE_SITE_URL') ?? Deno.env.get('SITE_URL') ?? 'https://moodeng.app').replace(/\/$/, '');
   const keyboard: TelegramInlineKeyboard = [[{ text: '💸 Mark sent in admin', url: `${siteUrl}/admin/referrals` }]];
   if (r.user?.id) keyboard.push([openInAdminButton(r.user.id, r.user.username)]);
   await sendAdminCard(supabase, chatId, { kind: 'interest_refund', refId: r.id, text, keyboard });
   return json({ ok: true });
};

type InvoiceItem = { amount: number | string; label: string };

// Monthly invoice: everything still owed to one affiliate, sent by them at the end of the month.
const postInvoiceCard = async (supabase: SupabaseClient, invoiceId: string) => {
   const { data, error } = await supabase
      .from('affiliate_invoices')
      .select(
         'id, month, owed, ahead, amount, items, wallet_address, note, owner_user_id, owner:users!affiliate_invoices_owner_user_id_fkey(id, username, display_name, email)'
      )
      .eq('id', invoiceId)
      .maybeSingle();
   if (error) throw new Error(error.message);
   if (!data) return json({ error: 'Invoice not found' }, 404);
   const inv = data as unknown as {
      id: string;
      month: string;
      owed: number;
      ahead: number;
      amount: number;
      items: InvoiceItem[];
      wallet_address: string | null;
      note: string | null;
      owner_user_id: string;
      owner: Person;
   };
   const chatId = await getSetting(supabase, 'kyc_alert_chat_id');
   if (!chatId) return json({ error: 'kyc_alert_chat_id is not set' }, 500);

   const who = personLabel(inv.owner);
   const monthName = new Date(`${inv.month}T00:00:00Z`).toLocaleDateString('en-US', { month: 'long', year: 'numeric', timeZone: 'UTC' });
   const items = Array.isArray(inv.items) ? inv.items : [];
   const text = [
      `🧾 ${who} sent their ${monthName} invoice — pay ${usd(inv.amount)} USDC`,
      '',
      `To (USDC on Base): ${inv.wallet_address || 'NO WALLET ON FILE — message them first'}`,
      `Who: ${who}${inv.owner?.username ? ` (@${inv.owner.username})` : ''}${inv.owner?.email ? ` · ${inv.owner.email}` : ''}`,
      '',
      ...items.slice(0, 30).map((i) => `• ${usd(Number(i.amount))} — ${i.label}`),
      ...(items.length > 30 ? [`• …and ${items.length - 30} more`] : []),
      ...(Number(inv.ahead) > 0 ? [`Already paid ahead: −${usd(inv.ahead)} (total owed ${usd(inv.owed)})`] : []),
      ...(inv.note ? ['', `Note: ${inv.note}`] : []),
      '',
      'Pay it in Admin → Affiliate payouts (one tap sends USDC and marks every line paid).'
   ].join('\n');
   const siteUrl = (Deno.env.get('VITE_SITE_URL') ?? Deno.env.get('SITE_URL') ?? 'https://moodeng.app').replace(/\/$/, '');
   const keyboard: TelegramInlineKeyboard = [[{ text: '💸 Pay in admin', url: `${siteUrl}/admin/affiliates` }]];
   keyboard.push([openInAdminButton(inv.owner_user_id, inv.owner?.username ?? null)]);
   await sendAdminCard(supabase, chatId, { kind: 'affiliate_invoice', refId: inv.id, text, keyboard });
   return json({ ok: true });
};

type PaydayRow = {
   id: string;
   code: string;
   amount: number | null;
   created_at: string;
   owner_user_id: string;
   owner: (Person & { wallet_address: string | null }) | null;
   referred: Person;
};

// Payday (15th and 30th): what each partner earned from friends we funded, still unpaid. One card per owner.
const postPaydayCards = async (supabase: SupabaseClient, payday: string, test = false) => {
   const { data, error } = await supabase
      .from('referral_code_payouts')
      .select(
         'id, code, amount, created_at, owner_user_id, owner:users!referral_code_payouts_owner_user_id_fkey(id, username, display_name, email, wallet_address), referred:users!referral_code_payouts_referred_user_id_fkey(username, display_name)'
      )
      .eq('earned_on', 'funded')
      .eq('status', 'unpaid')
      .order('created_at');
   if (error) throw new Error(error.message);
   const rows = (data ?? []) as unknown as PaydayRow[];
   const paydayChat = await getSetting(supabase, 'affiliate_payday_chat_id');
   const adminChat = await getSetting(supabase, 'kyc_alert_chat_id');
   if (!paydayChat && !adminChat) return json({ error: 'affiliate_payday_chat_id / kyc_alert_chat_id is not set' }, 500);
   const prefix = test ? '🧪 TEST — ' : '';
   // Payday chat first; if the bot can't post there (not added, chat moved), the admin chat gets it with a note.
   const send = async (text: string, options: Parameters<typeof sendTelegramMessage>[2] = {}) => {
      if (paydayChat) {
         try {
            return await sendTelegramMessage(paydayChat, text, options);
         } catch (err) {
            console.error('payday chat send failed, using admin chat', err instanceof Error ? err.message : err);
            if (!adminChat || adminChat === paydayChat) throw err;
            return await sendTelegramMessage(
               adminChat,
               `${text}\n\n⚠️ Couldn't post in the payday chat (${paydayChat}). Add @MoodenCreditstaging_bot there.`,
               options
            );
         }
      }
      return await sendTelegramMessage(adminChat as string, text, options);
   };

   const byOwner = new Map<string, PaydayRow[]>();
   for (const r of rows) byOwner.set(r.owner_user_id, [...(byOwner.get(r.owner_user_id) ?? []), r]);
   const siteUrl = (Deno.env.get('VITE_SITE_URL') ?? Deno.env.get('SITE_URL') ?? 'https://moodeng.app').replace(/\/$/, '');
   const dayName = new Date(`${payday}T00:00:00Z`).toLocaleDateString('en-US', { month: 'short', day: 'numeric', timeZone: 'UTC' });

   if (!rows.length) {
      await send(`${prefix}💸 Payday ${dayName}: nothing to pay partners this time — no new funded friends since the last payday.`);
      return json({ ok: true, cards: 0 });
   }

   for (const [ownerId, lines] of byOwner) {
      const owner = lines[0].owner;
      const who = personLabel(owner);
      const total = lines.reduce((sum, l) => sum + Number(l.amount ?? 0), 0);
      const text = [
         `${prefix}💸 Payday ${dayName}: pay ${who} ${usd(total)} USDC — ${lines.length} funded friend${lines.length === 1 ? '' : 's'}`,
         '',
         `To (USDC on Base): ${owner?.wallet_address || 'NO WALLET ON FILE — message them first'}`,
         `Who: ${who}${owner?.username ? ` (@${owner.username})` : ''}${owner?.email ? ` · ${owner.email}` : ''}`,
         '',
         ...lines
            .slice(0, 30)
            .map(
               (l) =>
                  `• ${usd(Number(l.amount ?? 0))} — ${l.code}: ${personLabel(l.referred)} (funded ${formatDecidedAt(new Date(l.created_at))})`
            ),
         ...(lines.length > 30 ? [`• …and ${lines.length - 30} more`] : []),
         '',
         'Deal: $5 per friend we verified and funded, paid on the 15th and 30th. Pay it in Admin → Affiliate payouts (one tap sends USDC and marks every line paid).'
      ].join('\n');
      const keyboard: TelegramInlineKeyboard = [[{ text: '💸 Pay in admin', url: `${siteUrl}/admin/affiliates` }]];
      keyboard.push([openInAdminButton(ownerId, owner?.username ?? null)]);
      await send(text, { inlineKeyboard: keyboard, aboutUserIds: [ownerId] });
   }
   return json({ ok: true, cards: byOwner.size });
};

const handleCreatorApp = async (supabase: SupabaseClient, msg: { event?: string; id?: string; code?: string }) => {
   if (!msg.id) return json({ error: 'creatorApp.id is required' }, 400);
   const { data, error } = await supabase.from('creator_applications').select('*').eq('id', msg.id).maybeSingle();
   if (error) throw new Error(error.message);
   if (!data) return json({ error: 'Application not found' }, 404);
   const app = data as unknown as CreatorApp;
   const mail =
      msg.event === 'code' && msg.code && /^\d{6}$/.test(msg.code)
         ? creatorCodeEmail(app, msg.code)
         : msg.event === 'submitted'
           ? creatorSubmittedEmail(app)
           : msg.event === 'approved'
             ? creatorApprovedEmail(app)
             : msg.event === 'rejected'
               ? creatorRejectedEmail(app)
               : null;
   if (!mail) return json({ error: 'Unknown creatorApp event' }, 400);
   await sendEmail(app.email, mail.subject, mail.text, mail.html);
   if (msg.event === 'submitted') {
      const chatId = await getSetting(supabase, 'kyc_alert_chat_id');
      if (chatId) {
         await sendTelegramMessage(chatId, creatorTeamCard(app), {
            inlineKeyboard: [[{ text: 'Open in Admin', url: 'https://moodeng.app/admin/affiliates' }]]
         });
      }
   }
   return json({ ok: true });
};

serve(async (req) => {
   if (req.method !== 'POST') return json({ error: 'Method not allowed' }, 405);

   const supabase = createClient(Deno.env.get('SUPABASE_URL') ?? '', Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '');
   if (!(await isAuthorized(supabase, req))) return json({ error: 'Unauthorized' }, 401);

   try {
      const { payoutId, event, decidedBy, claimId, interestRefundId, invoiceId, payday, test, creatorApp } = (await req
         .json()
         .catch(() => ({}))) as {
         creatorApp?: { event?: string; id?: string; code?: string };
         payday?: string;
         test?: boolean;
         invoiceId?: string;
         payoutId?: string;
         event?: string;
         decidedBy?: string | null;
         claimId?: string;
         interestRefundId?: string;
      };
      if (creatorApp) return await handleCreatorApp(supabase, creatorApp);
      if (payday) return await postPaydayCards(supabase, payday, test === true);
      if (invoiceId) return await postInvoiceCard(supabase, invoiceId);
      if (claimId) return await postClaimCard(supabase, claimId);
      if (interestRefundId) return await handleInterestRefund(supabase, interestRefundId, event, decidedBy);
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
