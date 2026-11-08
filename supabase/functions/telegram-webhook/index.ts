// The bot's Telegram webhook. setWebhook must point here (…/functions/v1/telegram-webhook) with
// allowed_updates ["message","callback_query"] — otherwise the admin-card buttons (Showed up / No-show,
// Approve / Reject, Mark sent) and admin commands silently do nothing. Check with getWebhookInfo.
import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

import {
   alreadyDecidedHeader,
   type CardStamp,
   claimCard,
   findAdminCard,
   linkRows,
   personName,
   stampCard,
   stampDecisionCards,
   withAdminLink
} from '../_shared/adminCards.ts';
import {
   decideKycReview,
   kycReviewConfirmRows,
   kycReviewDecisionRow,
   parseKycRetryCallback,
   parseKycReviewCallback,
   resetKycTries
} from '../_shared/kycCards.ts';
import {
   answerCallback,
   decideLoanAccess,
   escapeLike,
   findPendingRequest,
   parseDecisionCallback,
   setCardButtons,
   shortId
} from '../_shared/loanAccess.ts';
import { markMessengerVerified, messengerVerifiedStamp, parseMessengerVerifyCallback } from '../_shared/messengerStuckAlert.ts';
import { payoutWalletStatus } from '../_shared/idPayoutWallet.ts';
import { findIdUserByTelegram, handleIdBotCallback, handleIdMenuMessage } from '../_shared/idBot.ts';
import { handleIdFreeText } from '../_shared/idHelper.ts';
import { handleWaltPayoutCallback } from '../_shared/idWaltPayouts.ts';
import { handleSweepCommand, handleWalletDepositCallback } from '../_shared/idRepayments.ts';
import { formatCallTime } from '../_shared/videoCall.ts';
import { handleRescheduleStep, parseRescheduleCallback, postReschedulePicker } from '../_shared/callReschedule.ts';
import { handleCancelStep, parseCancelCallback } from '../_shared/callCancel.ts';
import { parseOutcomeCallback, recordCallOutcome } from '../_shared/videoCallOutcome.ts';
import { buildPayoutCallback, markPayoutPaid, parsePayoutCallback } from '../_shared/referralPayouts.ts';
import { decideVoucherClaim, parseMessengerNudgeCallback, parseVoucherCallback, sendNudgeOnMessenger } from '../_shared/voucherClaims.ts';
import {
   callTelegramApi,
   closeTelegramForumTopic,
   createTelegramForumTopic,
   sendTelegramMessage,
   type TelegramInlineKeyboard
} from '../_shared/telegram.ts';
import {
   parseTestAccountCallback,
   type TestAccountCallback,
   testAccountConfirmKeyboard,
   testAccountQuestion,
   withoutTestAccountRow
} from '../_shared/testAccount.ts';

const corsHeaders = {
   'Access-Control-Allow-Origin': '*',
   'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-telegram-bot-api-secret-token',
   'Access-Control-Allow-Methods': 'POST, OPTIONS'
};

type SupabaseClient = any;

type TelegramChat = {
   id: number;
   type?: string;
   username?: string;
   first_name?: string;
   last_name?: string;
};

type TelegramUser = {
   id: number;
   is_bot?: boolean;
   username?: string;
   first_name?: string;
   last_name?: string;
   /** IETF tag of the user's Telegram app language, e.g. 'id', 'en'. */
   language_code?: string;
};

type TelegramMessage = {
   message_id: number;
   message_thread_id?: number;
   text?: string;
   chat: TelegramChat;
   from?: TelegramUser;
   reply_markup?: { inline_keyboard?: TelegramInlineKeyboard };
   reply_to_message?: TelegramMessage;
};

type TelegramCallbackQuery = {
   id: string;
   from: TelegramUser;
   data?: string;
   message?: TelegramMessage;
};

type TelegramUpdate = {
   message?: TelegramMessage;
   callback_query?: TelegramCallbackQuery;
};

const jsonResponse = (body: Record<string, unknown>, status = 200) =>
   new Response(JSON.stringify(body), {
      status,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
   });

const getTelegramStartPayload = (text?: string) => {
   const match = text?.match(/^\/start(?:@\w+)?(?:\s+(.+))?$/i);
   return match?.[1]?.trim() ?? '';
};

const getSenderChatId = (message: TelegramMessage) => message.from?.id ?? message.chat.id;

const getSenderUsername = (message: TelegramMessage) => message.from?.username ?? message.chat.username ?? null;

const getDisplayName = (message: TelegramMessage) => {
   const username = getSenderUsername(message);
   if (username) {
      return `@${username}`;
   }

   const parts = [message.from?.first_name ?? message.chat.first_name, message.from?.last_name ?? message.chat.last_name].filter(Boolean);
   return parts.join(' ').trim() || String(getSenderChatId(message));
};

const getSetting = async (supabase: SupabaseClient, key: string) => {
   const { data, error } = await supabase.from('telegram_bot_settings').select('value').eq('key', key).maybeSingle();
   if (error) throw new Error(error.message);
   return data?.value as string | undefined;
};

const getSupportGroupChatId = async (supabase: SupabaseClient) =>
   Deno.env.get('TELEGRAM_SUPPORT_GROUP_CHAT_ID') ?? (await getSetting(supabase, 'support_group_chat_id'));

const getTeamChatId = async (supabase: SupabaseClient) =>
   Deno.env.get('TEAM_TELEGRAM_CHAT_ID') ?? (await getSetting(supabase, 'team_group_chat_id'));

const normalizeHandle = (value?: string | null) => (value ?? '').trim().replace(/^@/, '').toLowerCase();

// Manual lender-prospect roster, managed from the private team channel:
//   /addlender Name, @handle, note   — handle & note optional
//   /lenders                         — list the roster
//   /removelender name or @handle    — soft-delete a prospect
// Returns true if the message was a recognized roster command.
const handleLenderRosterCommand = async (supabase: SupabaseClient, message: TelegramMessage) => {
   const text = (message.text ?? '').trim();
   const chatId = message.chat.id;

   const addMatch = text.match(/^\/addlender(?:@\w+)?(?:\s+([\s\S]*))?$/i);
   if (addMatch) {
      const arg = (addMatch[1] ?? '').trim();
      const [namePart, handlePart, ...noteParts] = arg.split(',').map((part) => part.trim());
      const name = namePart ?? '';
      if (!name) {
         await sendTelegramMessage(chatId, 'Usage: /addlender Name, @handle, note\n(handle and note are optional)');
         return true;
      }

      const { error } = await supabase.from('lender_prospects').insert({
         name,
         handle: handlePart || null,
         note: noteParts.join(', ').trim() || null,
         added_by: getSenderUsername(message) ?? getDisplayName(message)
      });
      if (error) throw new Error(error.message);

      await sendTelegramMessage(chatId, `Added ${name}${handlePart ? ` (${handlePart})` : ''} to the prospect roster.`);
      return true;
   }

   if (/^\/lenders(?:@\w+)?\s*$/i.test(text)) {
      const { data, error } = await supabase
         .from('lender_prospects')
         .select('name, handle, note')
         .eq('is_active', true)
         .order('created_at', { ascending: false });
      if (error) throw new Error(error.message);

      if (!data?.length) {
         await sendTelegramMessage(chatId, 'The prospect roster is empty.\nAdd someone with: /addlender Name, @handle, note');
         return true;
      }

      const list = data
         .map((prospect: { name: string; handle?: string | null; note?: string | null }, index: number) => {
            const bits = [prospect.handle, prospect.note].filter(Boolean).join(' · ');
            return `${index + 1}. ${prospect.name}${bits ? ` — ${bits}` : ''}`;
         })
         .join('\n');
      await sendTelegramMessage(chatId, `📇 Prospect roster (${data.length}):\n${list}`);
      return true;
   }

   const removeMatch = text.match(/^\/removelender(?:@\w+)?(?:\s+([\s\S]*))?$/i);
   if (removeMatch) {
      const arg = (removeMatch[1] ?? '').trim();
      if (!arg) {
         await sendTelegramMessage(chatId, 'Usage: /removelender name or @handle');
         return true;
      }

      const { data, error } = await supabase.from('lender_prospects').select('id, name, handle').eq('is_active', true);
      if (error) throw new Error(error.message);

      const argHandle = normalizeHandle(arg);
      const argLower = arg.toLowerCase();
      const matches = (data ?? []).filter(
         (prospect: { name: string; handle?: string | null }) =>
            (argHandle !== '' && normalizeHandle(prospect.handle) === argHandle) || prospect.name?.toLowerCase() === argLower
      );

      if (!matches.length) {
         await sendTelegramMessage(chatId, `No active prospect matches "${arg}". Use /lenders to see the roster.`);
         return true;
      }
      if (matches.length > 1) {
         await sendTelegramMessage(chatId, `"${arg}" matches ${matches.length} prospects. Remove by exact @handle instead.`);
         return true;
      }

      const { error: removeError } = await supabase.from('lender_prospects').update({ is_active: false }).eq('id', matches[0].id);
      if (removeError) throw new Error(removeError.message);

      await sendTelegramMessage(chatId, `Removed ${matches[0].name} from the roster.`);
      return true;
   }

   return false;
};

// Manual Facebook Messenger verification, confirmed from the admin channel.
//
// Automated Messenger (m.me?ref= → messenger-webhook) needs Meta App Review for pages_messaging,
// which takes months, so until that clears the loop is human-closed: the borrower sends a code to
// the MoodengCredit Facebook Page, an admin reads it in the Page inbox and relays it here with
//   /confirm MDNG-XXXX
// We map the code → the borrower server-side and flip users.messenger_verified_at. Honored ONLY in
// an admin channel (team or KYC), never a random group. Returns true if it handled the message.
const handleMessengerConfirmCommand = async (supabase: SupabaseClient, message: TelegramMessage) => {
   const match = (message.text ?? '').trim().match(/^\/confirm(?:@\w+)?(?:\s+([A-Za-z0-9-]+))?/i);
   if (!match) return false;
   const chatId = message.chat.id;
   const code = (match[1] ?? '').trim();

   if (!code) {
      await sendTelegramMessage(
         chatId,
         'Usage: /confirm <code>\nThe code the borrower sent to the MoodengCredit Facebook Page inbox, e.g. /confirm MDNG-4821'
      );
      return true;
   }

   const { data: pending, error } = await supabase
      .from('contact_verification_codes')
      .select('id, user_id, expires_at, verified_at')
      .ilike('code', code)
      .eq('channel', 'messenger')
      .maybeSingle();
   if (error) throw new Error(error.message);

   if (!pending) {
      await sendTelegramMessage(chatId, `No pending Messenger code "${code}" — it may be mistyped, already used, or from a different channel.`);
      return true;
   }
   if (pending.verified_at) {
      await sendTelegramMessage(chatId, `Code "${code}" is already verified. Nothing to do.`);
      return true;
   }
   if (new Date(pending.expires_at).getTime() < Date.now()) {
      await sendTelegramMessage(chatId, `Code "${code}" has expired — ask the borrower to tap "Verify via Messenger" again for a fresh code.`);
      return true;
   }

   const now = new Date().toISOString();
   const { error: codeError } = await supabase.from('contact_verification_codes').update({ verified_at: now }).eq('id', pending.id);
   if (codeError) throw new Error(codeError.message);
   const { error: userError } = await supabase.from('users').update({ messenger_verified_at: now }).eq('id', pending.user_id);
   if (userError) throw new Error(userError.message);

   const { data: prof } = await supabase.from('users').select('username, email, display_name').eq('id', pending.user_id).maybeSingle();
   const who = [prof?.username, prof?.email].filter(Boolean).join(' · ') || pending.user_id;
   // Their "Facebook not confirmed" / "Is this them?" cards are resolved now.
   await stampDecisionCards(supabase, 'messenger', pending.user_id, messengerVerifiedStamp(personName(prof), adminHandle(message.from)));
   await sendTelegramMessage(chatId, `✅ Messenger verified for ${who}. Their loan request can now continue.`);
   return true;
};

const adminHandle = (from?: TelegramUser) =>
   from?.username ? `@${from.username}` : [from?.first_name, from?.last_name].filter(Boolean).join(' ') || String(from?.id ?? 'admin');

// Connect → Approve → Apply, typed form (works even if a card's buttons are gone):
//   /approve <id or @username>   /reject <id or @username>
//   /showed <id or @username>    /noshow <id or @username>   (video-call attendance)
// <id> is the 8-char request id printed on the admin card. Admin channels only.
// /showed and /noshow decide a pending 'call' request; with no pending request (open flow) they
// just record attendance on the borrower's latest call.
const COMMAND_DECISION: Record<string, 'approved' | 'rejected' | 'no_show'> = {
   approve: 'approved',
   reject: 'rejected',
   showed: 'approved',
   noshow: 'no_show'
};

const handleLoanAccessCommand = async (supabase: SupabaseClient, message: TelegramMessage) => {
   const match = (message.text ?? '').trim().match(/^\/(approve|reject|showed|noshow)(?:@\w+)?(?:\s+(\S+))?/i);
   if (!match) return false;
   const chatId = message.chat.id;
   const command = match[1].toLowerCase();
   const decision = COMMAND_DECISION[command];
   const arg = (match[2] ?? '').trim();

   if (!arg) {
      await sendTelegramMessage(chatId, `Usage: /${match[1].toLowerCase()} <request id or @username>\nThe id is on the "wants to connect" card.`);
      return true;
   }

   const request = await findPendingRequest(supabase, arg);
   if (request === 'ambiguous') {
      await sendTelegramMessage(chatId, `"${arg}" matches more than one pending request — use more of the id.`);
      return true;
   }
   if (!request) {
      // Open flow: no request to decide — record attendance on their call instead.
      if (command === 'showed' || command === 'noshow') {
         // Accept @username, the user's id, or the id of an already-decided request (e.g. after an
         // automatic no-show the request is no longer pending, but /showed must still correct it).
         const cleaned = arg.replace(/^@/, '');
         let user: { id: string } | null = null;
         if (/^[0-9a-f-]{36}$/i.test(cleaned)) {
            const { data } = await supabase.from('users').select('id').eq('id', cleaned).maybeSingle();
            user = (data as { id: string } | null) ?? null;
         }
         if (!user && /^[0-9a-f-]{6,36}$/i.test(cleaned)) {
            // ids are uuids (no ILIKE on uuid), so match the prefix here over recent requests.
            const { data: recent } = await supabase
               .from('loan_access_requests')
               .select('id, user_id')
               .order('created_at', { ascending: false })
               .limit(500);
            const rows = ((recent ?? []) as Array<{ id: string; user_id: string }>).filter((row) =>
               row.id.toLowerCase().startsWith(cleaned.toLowerCase())
            );
            if (new Set(rows.map((row) => row.user_id)).size === 1) user = { id: rows[0].user_id };
         }
         if (!user) {
            const { data } = await supabase.from('users').select('id').ilike('username', escapeLike(cleaned)).maybeSingle();
            user = (data as { id: string } | null) ?? null;
         }
         if (user?.id) {
            const result = await recordCallOutcome(supabase, user.id, command === 'showed' ? 'attended' : 'no_show', adminHandle(message.from));
            await sendTelegramMessage(chatId, result.summary);
            return true;
         }
      }
      await sendTelegramMessage(chatId, `No pending loan-access request matches "${arg}".`);
      return true;
   }

   const result = await decideLoanAccess(supabase, request.id, decision, adminHandle(message.from));
   await sendTelegramMessage(chatId, result.ok ? `${result.summary} (${shortId(request.id)})` : result.summary);
   return true;
};

// The inline buttons on admin cards: la: (loan-access Approve / Reject / Showed up / No-show),
// vc: (open-flow call attendance), vo: (food voucher claim Send code / Reject), mv: (stuck
// Facebook confirmation → Mark Facebook verified), kr: (out of KYC tries → 3 more tries), kv:
// (Didit manual review → ✅ Approve / ❌ Decline, each with a confirm tap) and rp: (referral code
// owner payout ✅ Paid / ⏳ Not paid yet).
// Honored only when the card sits in an admin channel, so a forwarded card can't be tapped from
// anywhere else.
//
// After the tap the card shows its after-state (adminCards.ts). Cards remembered in
// admin_message_refs are stamped by the decision itself, together with the person's other cards;
// older cards (posted before that table) and taps that changed nothing are stamped here.
const SAVING_CALLBACK = 'busy';

type ButtonResult = { ok: boolean; summary: string; stamp?: CardStamp; retry?: boolean };

const handleAdminCallback = async (supabase: SupabaseClient, query: TelegramCallbackQuery, adminChatIds: string[]) => {
   if (query.data === SAVING_CALLBACK) {
      await answerCallback(query.id, '⏳ Still saving — one moment…');
      return;
   }
   const parsed = parseDecisionCallback(query.data);
   const outcome = parsed ? null : parseOutcomeCallback(query.data);
   const voucher = parsed || outcome ? null : parseVoucherCallback(query.data);
   const messenger = parsed || outcome || voucher ? null : parseMessengerVerifyCallback(query.data);
   const kycRetry = parsed || outcome || voucher || messenger ? null : parseKycRetryCallback(query.data);
   const payout = parsed || outcome || voucher || messenger || kycRetry ? null : parsePayoutCallback(query.data);
   const kycReview = parsed || outcome || voucher || messenger || kycRetry || payout ? null : parseKycReviewCallback(query.data);
   if (!parsed && !outcome && !voucher && !messenger && !kycRetry && !payout && !kycReview) {
      await answerCallback(query.id, 'Unknown action.');
      return;
   }
   const cardChatId = query.message?.chat.id;
   if (!cardChatId || !adminChatIds.includes(String(cardChatId))) {
      await answerCallback(query.id, 'Not allowed here.');
      return;
   }

   // ⏳ Not paid yet: nothing to save — it stays unpaid. Keep just ✅ Paid (+ links) on the card.
   if (payout?.decision === 'unpaid') {
      const card = query.message;
      const links = (card?.reply_markup?.inline_keyboard ?? []).filter((row) => row.some((b) => 'url' in b));
      await Promise.all([
         answerCallback(query.id, "⏳ Left as not paid yet — tap ✅ Paid once they're paid."),
         card
            ? setCardButtons(cardChatId, card.message_id, [
                 [{ text: '✅ Paid', callback_data: buildPayoutCallback('paid', payout.payoutId) }],
                 ...links
              ])
            : null
      ]);
      return;
   }

   // KYC review: the first tap on ✅ Approve / ❌ Decline (and ◀ Back) only swaps the buttons — the
   // verdict goes to Didit on the "Yes, …" tap. Links (Didit console, admin) stay on the card.
   if (kycReview && (kycReview.step === 'approve' || kycReview.step === 'decline' || kycReview.step === 'back')) {
      const card = query.message;
      const links = (card?.reply_markup?.inline_keyboard ?? []).filter((row) => row.some((b) => 'url' in b));
      const rows =
         kycReview.step === 'back' ? [kycReviewDecisionRow(kycReview.userId)] : kycReviewConfirmRows(kycReview.userId, kycReview.step);
      await Promise.all([
         answerCallback(
            query.id,
            kycReview.step === 'approve'
               ? 'Tap ✅ Yes to approve their ID.'
               : kycReview.step === 'decline'
                 ? 'Tap ❌ Yes to decline — it uses one of their 3 tries.'
                 : ''
         ),
         card ? setCardButtons(cardChatId, card.message_id, [...rows, ...links]) : null
      ]);
      return;
   }

   // Acknowledge the tap right away — the decision (database + Messenger / email / push to the
   // borrower + Discord) takes a few seconds, and a silent button reads as "nothing happened".
   const card = query.message;
   const by = adminHandle(query.from);
   const [, , remembered] = await Promise.all([
      answerCallback(query.id, '⏳ Saving…'),
      card ? setCardButtons(cardChatId, card.message_id, [[{ text: '⏳ Saving…', callback_data: SAVING_CALLBACK }]]) : null,
      // Read before deciding: the decision deletes the ref when it stamps the card.
      card ? findAdminCard(supabase, cardChatId, card.message_id) : null
   ]);

   try {
      let userId: string | null = outcome?.userId ?? messenger?.userId ?? kycRetry?.userId ?? kycReview?.userId ?? null;
      let result: ButtonResult;
      if (parsed) {
         const decided = await decideLoanAccess(supabase, parsed.requestId, parsed.decision, by);
         if (decided.ok) userId = decided.request.user_id;
         result = decided;
      } else if (outcome) {
         result = await recordCallOutcome(supabase, outcome.userId, outcome.outcome, by, outcome.callKey);
      } else if (voucher) {
         result = await decideVoucherClaim(supabase, voucher.claimId, voucher.decision, by);
      } else if (payout) {
         result = await markPayoutPaid(supabase, payout.payoutId, by);
      } else if (messenger) {
         result = await markMessengerVerified(supabase, messenger.userId, by);
      } else if (kycReview) {
         result = await decideKycReview(supabase, kycReview.userId, kycReview.step === 'yes_approve' ? 'Approved' : 'Declined', by);
      } else {
         result = await resetKycTries(supabase, kycRetry!.userId, by);
      }
      // A voucher send that can be retried (pool empty, Bitrefill not ready) changed nothing: keep the buttons.
      if (result.retry) {
         if (card?.reply_markup?.inline_keyboard) await setCardButtons(cardChatId, card.message_id, card.reply_markup.inline_keyboard);
         await sendTelegramMessage(cardChatId, `⚠️ Not sent: ${result.summary}`);
         return;
      }
      if (card) {
         const stamp: CardStamp =
            result.stamp ?? (result.ok ? { header: result.summary, by } : { header: alreadyDecidedHeader(result.summary), by, verb: 'Tapped by' });
         if (remembered) {
            // Still remembered = the decision didn't stamp it (nothing changed): stamp it here. A
            // no-show (stamp with buttons) did stamp it and keeps it remembered for ✅ Approve anyway.
            // A sent voucher already re-rendered its cards and keeps them for the delivered / opened /
            // tapped updates, so it isn't claimed here.
            const keepsUpdating = Boolean(voucher && result.ok && voucher.decision === 'sent');
            if (!result.stamp?.buttons && !keepsUpdating && (await claimCard(supabase, cardChatId, card.message_id))) {
               await stampCard(cardChatId, card.message_id, remembered.text, remembered.links, stamp);
            }
         } else {
            // Posted before admin_message_refs: stamp from the tapped message, keeping its links.
            const links = withAdminLink(linkRows(card.reply_markup?.inline_keyboard), userId);
            await stampCard(cardChatId, card.message_id, card.text ?? '', links, stamp);
         }
      }
   } catch (error) {
      // Put the buttons back so it can be tapped again, and say why it didn't save.
      const reason = error instanceof Error ? error.message : String(error);
      console.error('telegram-webhook: admin button failed', reason);
      if (card?.reply_markup?.inline_keyboard) await setCardButtons(cardChatId, card.message_id, card.reply_markup.inline_keyboard);
      await sendTelegramMessage(cardChatId, `⚠️ That didn't save — tap the button again. (${reason.slice(0, 200)})`);
   }
};

// /pending — everyone waiting on a decision, oldest first, with the id for /approve etc. A safety
// net for when a card scrolls away. Admin channels only.
const handlePendingCommand = async (supabase: SupabaseClient, message: TelegramMessage) => {
   const { data, error } = await supabase
      .from('loan_access_requests')
      .select('id, user_id, kind, display_name, created_at, users!inner(username, email, video_call_starts_at)')
      .eq('status', 'pending')
      .eq('users.is_test', false)
      .order('created_at', { ascending: true })
      .limit(30);
   if (error) throw new Error(error.message);
   const rows = (data ?? []) as Array<{
      id: string;
      kind: string;
      display_name: string | null;
      users: { username: string | null; email: string | null; video_call_starts_at: string | null };
   }>;
   if (!rows.length) {
      await sendTelegramMessage(message.chat.id, 'Nobody is waiting — no pending requests. 🎉');
      return;
   }
   const lines = rows.map((r, i) => {
      const name = [r.display_name, r.users?.username ? `@${r.users.username}` : null].filter(Boolean).join(' ') || r.users?.email || r.id;
      const call = r.kind === 'call' && r.users?.video_call_starts_at ? ` · call ${formatCallTime(r.users.video_call_starts_at, 'Asia/Bangkok')}` : '';
      return `${i + 1}. ${name}${call} — ${shortId(r.id)}`;
   });
   await sendTelegramMessage(
      message.chat.id,
      `⏳ Waiting on you (${rows.length}):\n${lines.join('\n')}\n\nDecide with /showed · /noshow · /approve · /reject + the id.`
   );
};

// Which borrower flow is live (docs/HANDOFF_BORROWER_VERIFICATION.md §13):
//   /loanflow                  show the current one
//   /loanflow open|call|approval   switch — takes effect for borrowers immediately, no deploy
const LOAN_FLOWS: Record<string, string> = {
   open: 'OPEN — book a call, request posts right away (the old flow)',
   call: 'CALL — request unlocks only after you tap ✅ Showed up',
   approval: 'APPROVAL — you approve in Telegram, no call'
};

const handleLoanFlowCommand = async (supabase: SupabaseClient, message: TelegramMessage) => {
   const match = (message.text ?? '').trim().match(/^\/loanflow(?:@\w+)?(?:\s+(\S+))?/i);
   if (!match) return false;
   const chatId = message.chat.id;
   const wanted = (match[1] ?? '').trim().toLowerCase();

   if (!wanted) {
      const current = (await getSetting(supabase, 'loan_flow')) ?? 'open';
      await sendTelegramMessage(
         chatId,
         `Borrower flow now: ${LOAN_FLOWS[current] ?? LOAN_FLOWS.open}\n\nSwitch with /loanflow open · /loanflow call · /loanflow approval`
      );
      return true;
   }
   if (!LOAN_FLOWS[wanted]) {
      await sendTelegramMessage(chatId, 'Usage: /loanflow open | call | approval');
      return true;
   }

   const { error } = await supabase
      .from('telegram_bot_settings')
      .upsert({ key: 'loan_flow', value: wanted }, { onConflict: 'key' });
   if (error) throw new Error(error.message);
   await sendTelegramMessage(chatId, `✅ Borrower flow switched to ${LOAN_FLOWS[wanted]} — by ${adminHandle(message.from)}`);
   return true;
};

// Pre-KYC gate (migration 20261009120000): new borrowers connect Messenger + book a call and are
// approved after it before they can verify their ID.
//   /kycgate          show whether it's on
//   /kycgate on|off   switch — off = the old flow (KYC right after the wallet)
const KYC_GATE_STATES: Record<string, string> = {
   on: 'ON — new borrowers meet the team (Messenger + call, ✅ Showed up) before ID verification',
   off: 'OFF — new borrowers verify their ID right after setting up their wallet (the old flow)'
};

const handleKycGateCommand = async (supabase: SupabaseClient, message: TelegramMessage) => {
   const match = (message.text ?? '').trim().match(/^\/kycgate(?:@\w+)?(?:\s+(\S+))?/i);
   if (!match) return false;
   const chatId = message.chat.id;
   const wanted = (match[1] ?? '').trim().toLowerCase();

   if (!wanted) {
      const current = (await getSetting(supabase, 'kyc_gate')) === 'off' ? 'off' : 'on';
      await sendTelegramMessage(chatId, `Pre-KYC gate: ${KYC_GATE_STATES[current]}\n\nSwitch with /kycgate on · /kycgate off`);
      return true;
   }
   if (!KYC_GATE_STATES[wanted]) {
      await sendTelegramMessage(chatId, 'Usage: /kycgate on | off');
      return true;
   }

   const { error } = await supabase
      .from('telegram_bot_settings')
      .upsert({ key: 'kyc_gate', value: wanted }, { onConflict: 'key' });
   if (error) throw new Error(error.message);
   await sendTelegramMessage(chatId, `✅ Pre-KYC gate switched ${KYC_GATE_STATES[wanted]} — by ${adminHandle(message.from)}`);
   return true;
};

// Indonesia track (docs/INDONESIA_TRACK.md, migration 20261107120000):
//   /idtrack              show the switch and the loan rules
//   /idtrack off|test|on  who can JOIN the track (test = is_test accounts only)
//   /idloans 5,10         allowed loan amounts in USD
//   /idterm 14            longest loan term in days
const ID_TRACK_STATES: Record<string, string> = {
   off: 'OFF — nobody new joins (people already on it keep their rules)',
   test: 'TEST — only test accounts can join',
   on: 'ON — Indonesians can join from /id'
};
const ID_TRACK_USAGE = 'Switch with /idtrack off · /idtrack test · /idtrack on\nLoan amounts: /idloans 5,10 · Longest term: /idterm 14';

const handleIdTrackCommand = async (supabase: SupabaseClient, message: TelegramMessage) => {
   const text = (message.text ?? '').trim();
   const chatId = message.chat.id;
   const by = adminHandle(message.from);
   const upsert = async (key: string, value: string) => {
      const { error } = await supabase.from('telegram_bot_settings').upsert({ key, value }, { onConflict: 'key' });
      if (error) throw new Error(error.message);
   };

   const amounts = text.match(/^\/idloans(?:@\w+)?(?:\s+(.+))?$/i);
   if (amounts) {
      const parts = (amounts[1] ?? '').trim().split(/[\s,]+/).filter(Boolean);
      const valid = parts.length > 0 && parts.length <= 6 && parts.every((p) => /^\d{1,3}(\.\d{1,2})?$/.test(p) && Number(p) >= 1 && Number(p) <= 100);
      if (!valid) {
         await sendTelegramMessage(chatId, 'Usage: /idloans 5,10 — dollars (cents allowed), $1–$100, up to 6 amounts.');
         return true;
      }
      const value = [...new Set(parts.map(Number))].sort((a, b) => a - b).join(',');
      await upsert('id_loan_amounts', value);
      await sendTelegramMessage(chatId, `✅ 🇮🇩 Indonesia loan amounts: ${value.split(',').map((a) => `$${a}`).join(' · ')} — by ${by}`);
      return true;
   }

   const term = text.match(/^\/idterm(?:@\w+)?(?:\s+(\S+))?/i);
   if (term) {
      const days = Number(term[1]);
      if (!/^\d{1,2}$/.test(term[1] ?? '') || days < 1 || days > 60) {
         await sendTelegramMessage(chatId, 'Usage: /idterm 14 — the longest loan term in days (1–60).');
         return true;
      }
      await upsert('id_max_term_days', String(days));
      await sendTelegramMessage(chatId, `✅ 🇮🇩 Indonesia loans must be repaid within ${days} days — by ${by}`);
      return true;
   }

   const match = text.match(/^\/idtrack(?:@\w+)?(?:\s+(\S+))?/i);
   if (!match) return false;
   const wanted = (match[1] ?? '').trim().toLowerCase();
   if (!wanted) {
      const [track, loans, maxDays] = await Promise.all([
         getSetting(supabase, 'id_track'),
         getSetting(supabase, 'id_loan_amounts'),
         getSetting(supabase, 'id_max_term_days')
      ]);
      const current = track && ID_TRACK_STATES[track] ? track : 'off';
      const { count } = await supabase.from('users').select('id', { count: 'exact', head: true }).eq('market', 'ID');
      await sendTelegramMessage(
         chatId,
         `🇮🇩 Indonesia track: ${ID_TRACK_STATES[current]}\nLoans: ${String(loans ?? '5,10')
            .split(',')
            .map((a) => `$${a.trim()}`)
            .join(' · ')}, repaid within ${maxDays ?? '14'} days\nPeople on the track: ${count ?? '?'}\n\n${ID_TRACK_USAGE}`
      );
      return true;
   }
   if (!ID_TRACK_STATES[wanted]) {
      await sendTelegramMessage(chatId, 'Usage: /idtrack off | test | on');
      return true;
   }
   await upsert('id_track', wanted);
   await sendTelegramMessage(chatId, `✅ 🇮🇩 Indonesia track switched ${ID_TRACK_STATES[wanted]} — by ${by}`);
   return true;
};

// Indonesia payout wallet (migration 20261107150000, _shared/idPayoutWallet.ts):
//   /idautopay         show the switch, the wallet address, its balance and today's total
//   /idautopay on|off  pay open Indonesian requests automatically from the payout wallet
const handleIdAutopayCommand = async (supabase: SupabaseClient, message: TelegramMessage) => {
   const match = (message.text ?? '').trim().match(/^\/idautopay(?:@\w+)?(?:\s+(\S+))?/i);
   if (!match) return false;
   const chatId = message.chat.id;
   const wanted = (match[1] ?? '').trim().toLowerCase();
   if (wanted && wanted !== 'on' && wanted !== 'off') {
      await sendTelegramMessage(chatId, 'Usage: /idautopay on | off');
      return true;
   }
   const status = await payoutWalletStatus(supabase);
   if (!wanted) {
      const money = (v: number | null, unit: string) => (v == null ? '? (BNB Chain unreachable)' : `${v.toFixed(unit === 'BNB' ? 4 : 2)} ${unit}`);
      const lines = [
         `🇮🇩 Auto-payouts: ${status.autopay === 'on' ? 'ON — open Indonesian requests are paid from the payout wallet' : 'OFF — pay by hand (or "Pay now" in admin)'}`,
         status.configured ? null : '⚠️ Openfort keys not set (vault secret OPENFORT_PAYOUT).',
         status.address
            ? `Wallet (BNB Chain): ${status.address}\nBalance: ${money(status.usdc, 'USDC')} · ${money(status.bnb, 'BNB')}`
            : 'No payout wallet yet — create it in admin → Requests.',
         `Paid today: $${status.paidTodayUsd.toFixed(2)} of $${status.dailyCapUsd} · max $${status.maxUsd} per loan`,
         status.address ? 'Top up: Binance TH → Withdraw USDC → network BSC → the address above' : null,
         '',
         'Switch with /idautopay on · /idautopay off'
      ];
      await sendTelegramMessage(chatId, lines.filter((l) => l !== null).join('\n'));
      return true;
   }
   if (wanted === 'on' && (!status.configured || !status.address)) {
      await sendTelegramMessage(
         chatId,
         !status.configured
            ? '⚠️ Can’t switch on: the Openfort keys aren’t set (vault secret OPENFORT_PAYOUT).'
            : '⚠️ Can’t switch on: no payout wallet yet. Create it in admin → Requests first.'
      );
      return true;
   }
   const { error } = await supabase.from('telegram_bot_settings').upsert({ key: 'id_autopay', value: wanted }, { onConflict: 'key' });
   if (error) throw new Error(error.message);
   await sendTelegramMessage(
      chatId,
      wanted === 'on'
         ? `✅ 🇮🇩 Auto-payouts ON — open Indonesian requests up to $${status.maxUsd} are paid from the payout wallet (cap $${status.dailyCapUsd}/day). Balance: ${status.usdc == null ? '?' : `${status.usdc.toFixed(2)} USDC`} — by ${adminHandle(message.from)}`
         : `✅ 🇮🇩 Auto-payouts OFF — pay by hand from now on (payouts already sent still get confirmed) — by ${adminHandle(message.from)}`
   );
   return true;
};

// KYC tries (kyc_declines): after 3 declines a borrower must message us before trying again.
//   /kycretry @username   gives them 3 fresh tries (voids their counted declines)
const handleKycRetryCommand = async (supabase: SupabaseClient, message: TelegramMessage) => {
   const match = (message.text ?? '').trim().match(/^\/kycretry(?:@\w+)?(?:\s+(\S+))?/i);
   if (!match) return false;
   const chatId = message.chat.id;
   const arg = (match[1] ?? '').trim().replace(/^@/, '');
   if (!arg) {
      await sendTelegramMessage(chatId, 'Usage: /kycretry @username — gives them 3 more ID verification tries');
      return true;
   }
   const { data: user } = /^[0-9a-f-]{36}$/i.test(arg)
      ? await supabase.from('users').select('id, username').eq('id', arg).maybeSingle()
      : await supabase.from('users').select('id, username').ilike('username', escapeLike(arg)).maybeSingle();
   if (!user) {
      await sendTelegramMessage(chatId, `No user found for ${arg}.`);
      return true;
   }
   // Same as the 🔁 button on the "Out of KYC tries" card, which it stamps.
   const result = await resetKycTries(supabase, user.id, adminHandle(message.from));
   await sendTelegramMessage(chatId, result.summary);
   return true;
};

// Test accounts (users.is_test): left out of the ☀️ Onboarding check-in, /pending and the money
// stats, so team test sign-ups don't read as real people to chase.
//   /testaccount                      list them
//   /testaccount @a @b …              mark as test
//   /testaccount off @a …             mark as real again
const handleTestAccountCommand = async (supabase: SupabaseClient, message: TelegramMessage) => {
   const match = (message.text ?? '').trim().match(/^\/testaccount(?:@\w+)?(?:\s+([\s\S]+))?/i);
   if (!match) return false;
   const chatId = message.chat.id;
   const words = (match[1] ?? '').trim().split(/\s+/).filter(Boolean);
   const off = words[0]?.toLowerCase() === 'off';
   const handles = (off ? words.slice(1) : words).map((w) => w.replace(/^@/, '').replace(/,$/, '')).filter(Boolean);

   if (!handles.length) {
      if (off) {
         await sendTelegramMessage(chatId, 'Usage: /testaccount off @username');
         return true;
      }
      const { data } = await supabase.from('users').select('username, email').eq('is_test', true).order('created_at', { ascending: false }).limit(50);
      const rows = (data ?? []) as Array<{ username: string | null; email: string | null }>;
      await sendTelegramMessage(
         chatId,
         rows.length
            ? `🧪 Test accounts (${rows.length}):\n${rows.map((r, i) => `${i + 1}. ${r.username ? `@${r.username}` : r.email}`).join('\n')}\n\nAdd with /testaccount @username · undo with /testaccount off @username`
            : 'No test accounts yet. Add with /testaccount @username'
      );
      return true;
   }

   const done: string[] = [];
   const missing: string[] = [];
   for (const handle of handles) {
      const { data: user } = /^[0-9a-f-]{36}$/i.test(handle)
         ? await supabase.from('users').select('id, username').eq('id', handle).maybeSingle()
         : await supabase.from('users').select('id, username').ilike('username', escapeLike(handle)).maybeSingle();
      if (!user) {
         missing.push(handle);
         continue;
      }
      const { error } = await supabase.from('users').update({ is_test: !off }).eq('id', user.id);
      if (error) throw new Error(error.message);
      done.push(user.username ? `@${user.username}` : user.id);
   }
   await sendTelegramMessage(
      chatId,
      [
         done.length ? `🧪 ${off ? 'Marked real again' : 'Marked as test'}: ${done.join(', ')} — by ${adminHandle(message.from)}` : null,
         missing.length ? `No user found for: ${missing.join(', ')}` : null
      ]
         .filter(Boolean)
         .join('\n')
   );
   return true;
};

// 🧪 Test account? on a person card (_shared/testAccount.ts): ask → a confirm under the card;
// ✅ Yes → users.is_test and the 🧪 row comes off the card; ✖ No → the confirm goes away.
const handleTestAccountCallback = async (
   supabase: SupabaseClient,
   query: TelegramCallbackQuery,
   step: TestAccountCallback,
   allowedChatIds: string[]
) => {
   const msg = query.message;
   if (!msg || !allowedChatIds.includes(String(msg.chat.id))) {
      await answerCallback(query.id, 'Not allowed here.');
      return;
   }
   const chatId = msg.chat.id;
   if (step.step === 'no') {
      await answerCallback(query.id, 'Left as a real account.');
      await callTelegramApi('deleteMessage', { chat_id: chatId, message_id: msg.message_id }).catch(() =>
         setCardButtons(chatId, msg.message_id, [])
      );
      return;
   }

   const { data: user } = await supabase.from('users').select('id, username, display_name, is_test').eq('id', step.userId).maybeSingle();
   if (!user) {
      await answerCallback(query.id, 'Account not found.');
      return;
   }
   const name = [user.display_name?.trim(), user.username ? `@${user.username}` : null].filter(Boolean).join(' ') || personName(user);

   if (step.step === 'ask') {
      if (user.is_test) {
         await answerCallback(query.id, `${name} is already a test account.`);
         await setCardButtons(chatId, msg.message_id, withoutTestAccountRow(msg.reply_markup?.inline_keyboard));
         return;
      }
      await answerCallback(query.id, 'Confirm below 👇');
      await callTelegramApi('sendMessage', {
         chat_id: chatId,
         text: testAccountQuestion(name),
         ...(msg.message_thread_id ? { message_thread_id: msg.message_thread_id } : {}),
         reply_parameters: { message_id: msg.message_id, allow_sending_without_reply: true },
         reply_markup: { inline_keyboard: testAccountConfirmKeyboard(user.id) }
      });
      return;
   }

   const { error } = await supabase.from('users').update({ is_test: true }).eq('id', user.id);
   if (error) {
      await answerCallback(query.id, `⚠️ Didn't save — tap again. (${error.message.slice(0, 120)})`);
      return;
   }
   await answerCallback(query.id, '🧪 Marked as a test account.');
   await callTelegramApi('editMessageText', {
      chat_id: chatId,
      message_id: msg.message_id,
      text: `🧪 ${name} is now a test account — by ${adminHandle(query.from)}\nUndo with /testaccount off ${user.username ? `@${user.username}` : user.id}`,
      reply_markup: { inline_keyboard: [] }
   }).catch((err: unknown) => console.error('telegram-webhook: test confirm edit failed', err instanceof Error ? err.message : err));
   const card = msg.reply_to_message;
   if (card?.reply_markup?.inline_keyboard) await setCardButtons(chatId, card.message_id, withoutTestAccountRow(card.reply_markup.inline_keyboard));
};

const verifyTelegramSecret = (req: Request) => {
   const expectedSecret = Deno.env.get('TELEGRAM_WEBHOOK_SECRET');
   if (!expectedSecret) {
      // Fail closed: an unsigned webhook would let anyone post fake updates (incl. sign-in taps).
      console.error('telegram-webhook: TELEGRAM_WEBHOOK_SECRET is not set — rejecting the update');
      return false;
   }

   // setWebhook only accepts A–Z a–z 0–9 _ - in secret_token, so the webhook is registered with the
   // secret stripped to those characters (telegram-webhook-audit). Accept either form.
   const header = req.headers.get('x-telegram-bot-api-secret-token');
   return header === expectedSecret || header === expectedSecret.replace(/[^A-Za-z0-9_-]/g, '').slice(0, 256);
};

const connectTelegramAlerts = async (supabase: SupabaseClient, message: TelegramMessage, userId: string) => {
   const chatId = getSenderChatId(message);
   const telegramUsername = getSenderUsername(message);

   const { data: connectedUser, error } = await supabase
      .from('users')
      .update({
         chat_id: chatId,
         telegram_id: chatId,
         ...(telegramUsername ? { telegram_username: telegramUsername } : {})
      })
      .eq('id', userId)
      .select('id')
      .maybeSingle();

   if (error) {
      if (error.code === '23505') {
         await sendTelegramMessage(
            chatId,
            'This Telegram account is already connected to another Moodeng account. Sign in with that account, or contact support if you need help moving alerts.'
         );
         return;
      }

      throw new Error(error.message);
   }

   if (!connectedUser) {
      await sendTelegramMessage(chatId, 'Moodeng could not find that account. Open Account Settings and try Connect Telegram again.');
      return;
   }

   await sendTelegramMessage(
      chatId,
      'Telegram alerts are connected. Moodeng can now send private loan updates here when notifications are enabled.'
   );
};

const consumeConnectToken = async (supabase: SupabaseClient, message: TelegramMessage, payload: string) => {
   const token = payload.replace(/^connect_/, '').trim();
   const chatId = getSenderChatId(message);

   const { data: tokenRow, error } = await supabase
      .from('telegram_connect_tokens')
      .select('id, user_id, expires_at, consumed_at')
      .eq('token', token)
      .maybeSingle();

   if (error) throw new Error(error.message);

   const isExpired = tokenRow?.expires_at ? new Date(tokenRow.expires_at).getTime() < Date.now() : true;
   if (!tokenRow || tokenRow.consumed_at || isExpired) {
      await sendTelegramMessage(chatId, 'This Telegram connection link expired. Open Account Settings and tap Connect Telegram again.');
      return;
   }

   await connectTelegramAlerts(supabase, message, tokenRow.user_id);
   await supabase.from('telegram_connect_tokens').update({ consumed_at: new Date().toISOString() }).eq('id', tokenRow.id);
};

const sha256Hex = async (value: string) => {
   const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(value));
   return Array.from(new Uint8Array(digest))
      .map((b) => b.toString(16).padStart(2, '0'))
      .join('');
};

// "/start login_<code>" (telegram-login app_start). Start alone never signs anyone in — someone could
// have been sent another person's link. We show which device asked and when, and ask the person who
// pressed Start to tap the 2-digit number on their Moodeng page out of three. Only the right number,
// from that same Telegram account, claims the code (handleAppLoginTap). Migration 20261107180000.
const APP_LOGIN_PROMPT_MAX_AGE_MS = 10 * 60 * 1000;

const loginCopy = (bahasa: boolean) =>
   bahasa
      ? {
           invalid: 'Link masuk tidak valid. Coba lagi dari halaman Moodeng.',
           expired: '⏰ Link masuk ini sudah dipakai atau kedaluwarsa. Kembali ke halaman Moodeng dan tekan "Daftar dengan Telegram" lagi.',
           prompt: (device: string, at: string, where: string) =>
              `🔐 Masuk ke Moodeng?\n\nPerangkat: ${device}${where ? `\nNegara: ${where}` : ''}\nWaktu: ${at}\n\n⚠️ Ini memberi AKSES PENUH ke akun Moodeng kamu (pinjaman dan uangmu) kepada perangkat itu.\nPilih angka HANYA jika kamu sendiri yang sedang membuka Moodeng di HP kamu. Jangan pernah pilih angka karena disuruh orang lain — Moodeng tidak pernah meminta itu.\n\nPilih angka yang tampil di layar Moodeng kamu:`,
           notMe: '🚫 Bukan saya',
           done: (device: string) =>
              `✅ Kamu sudah masuk di ${device}.\n\nKembali ke Facebook (atau browser tempat kamu mulai) untuk lanjut. Mulai sekarang Moodeng akan mengabari kamu di sini.`,
           cancelled: '🚫 Dibatalkan. Tidak ada yang masuk ke akunmu.',
           wrong: '❌ Angkanya salah, jadi kami batalkan demi keamanan. Kembali ke halaman Moodeng dan coba lagi.',
           notYours: 'Ini bukan permintaan kamu.',
           toastOk: 'Berhasil masuk ✅',
           toastNo: 'Dibatalkan'
        }
      : {
           invalid: 'That sign-in link is not valid. Try again from the Moodeng page.',
           expired: '⏰ This sign-in link was already used or expired. Go back to the Moodeng page and tap "Sign up with Telegram" again.',
           prompt: (device: string, at: string, where: string) =>
              `🔐 Sign in to Moodeng?\n\nDevice: ${device}${where ? `\nCountry: ${where}` : ''}\nTime: ${at}\n\n⚠️ This gives that device FULL ACCESS to your Moodeng account (your loans and money).\nOnly pick a number if YOU are opening Moodeng on your own phone right now. Never pick one because someone told you to — Moodeng never asks for that.\n\nTap the number shown on your Moodeng screen:`,
           notMe: '🚫 Not me',
           done: (device: string) =>
              `✅ You’re signed in on ${device}.\n\nGo back to Facebook (or the browser you started in) to continue. From now on Moodeng will message you here.`,
           cancelled: '🚫 Cancelled. Nobody was signed in to your account.',
           wrong: '❌ Wrong number, so we cancelled it to keep you safe. Go back to the Moodeng page and try again.',
           notYours: 'This isn’t your request.',
           toastOk: 'Signed in ✅',
           toastNo: 'Cancelled'
        };

const isBahasa = (user?: TelegramUser) => (user?.language_code ?? 'id').toLowerCase().startsWith('id');

const wibTime = (iso: string) =>
   `${new Date(iso).toLocaleString('id-ID', { timeZone: 'Asia/Jakarta', hour: '2-digit', minute: '2-digit', day: 'numeric', month: 'short' })} WIB`;

/** Three decoys (10–99) different from the real number and each other, shuffled in with it. */
const matchChoices = (real: number): number[] => {
   const picks = new Set<number>([real]);
   const buf = new Uint8Array(1);
   while (picks.size < 4) {
      crypto.getRandomValues(buf);
      if (buf[0] < 180) picks.add(10 + (buf[0] % 90));
   }
   const list = [...picks];
   for (let i = list.length - 1; i > 0; i -= 1) {
      crypto.getRandomValues(buf);
      const j = buf[0] % (i + 1);
      [list[i], list[j]] = [list[j], list[i]];
   }
   return list;
};

const claimAppLogin = async (supabase: SupabaseClient, message: TelegramMessage, payload: string) => {
   const code = payload.replace(/^login_/, '').trim();
   const chatId = getSenderChatId(message);
   const from = message.from;
   const t = loginCopy(isBahasa(from));
   if (!from?.id || !/^[A-Za-z0-9_-]{16,64}$/.test(code)) {
      await sendTelegramMessage(chatId, t.invalid);
      return;
   }
   const now = new Date().toISOString();
   // The first Telegram account to press Start owns the prompt; nobody else can answer it.
   const { data: row, error } = await supabase
      .from('telegram_app_logins')
      .update({ pending_telegram_id: from.id, prompted_at: now })
      .eq('code_hash', await sha256Hex(code))
      .is('claimed_at', null)
      .gt('expires_at', now)
      .or(`pending_telegram_id.is.null,pending_telegram_id.eq.${from.id}`)
      .select('id, match_number, match_choices, device_label, location_label, created_at')
      .maybeSingle();
   if (error) throw new Error(error.message);
   if (!row) {
      await sendTelegramMessage(chatId, t.expired);
      return;
   }
   // The same choices every time Start is pressed: new decoys would give the real number away.
   let choices: number[] | null = Array.isArray(row.match_choices) && row.match_choices.length === 4 ? row.match_choices.map(Number) : null;
   if (!choices) {
      const fresh = matchChoices(Number(row.match_number));
      const { data: stored } = await supabase
         .from('telegram_app_logins')
         .update({ match_choices: fresh })
         .eq('id', row.id)
         .is('match_choices', null)
         .select('match_choices')
         .maybeSingle();
      if (stored?.match_choices) choices = (stored.match_choices as number[]).map(Number);
      else {
         const { data: again } = await supabase.from('telegram_app_logins').select('match_choices').eq('id', row.id).maybeSingle();
         choices = Array.isArray(again?.match_choices) ? (again.match_choices as number[]).map(Number) : fresh;
      }
   }
   await sendTelegramMessage(chatId, t.prompt(row.device_label || 'Browser', wibTime(row.created_at), row.location_label ?? ''), {
      inlineKeyboard: [
         choices.map((n: number) => ({ text: String(n), callback_data: `tl:${row.id}:${n}` })),
         [{ text: t.notMe, callback_data: `tl:${row.id}:x` }]
      ]
   });
};

/** A tap on the number prompt. Returns true when it handled the callback. */
const handleAppLoginTap = async (supabase: SupabaseClient, query: TelegramCallbackQuery): Promise<boolean> => {
   const match = /^tl:([0-9a-f-]{36}):(\d{2}|x)$/.exec(query.data ?? '');
   if (!match) return false;
   const [, rowId, choice] = match;
   const t = loginCopy(isBahasa(query.from));
   const chatId = query.message?.chat.id;
   const messageId = query.message?.message_id;
   const finish = async (text: string, toast: string) => {
      await answerCallback(query.id, toast);
      if (chatId && messageId) {
         await callTelegramApi('editMessageText', { chat_id: chatId, message_id: messageId, text, reply_markup: { inline_keyboard: [] } }).catch(
            (err: unknown) => console.error('telegram-webhook: login prompt edit failed', err instanceof Error ? err.message : err)
         );
      }
   };
   // Private chats only, and only the account that pressed Start.
   if (query.message?.chat.type !== 'private') {
      await answerCallback(query.id, t.notYours);
      return true;
   }
   const { data: row } = await supabase
      .from('telegram_app_logins')
      .select('id, match_number, device_label, pending_telegram_id, prompted_at, expires_at, claimed_at')
      .eq('id', rowId)
      .maybeSingle();
   if (!row || Number(row.pending_telegram_id) !== query.from.id) {
      await answerCallback(query.id, t.notYours);
      return true;
   }
   const now = Date.now();
   const stale =
      row.claimed_at ||
      new Date(row.expires_at).getTime() < now ||
      !row.prompted_at ||
      now - new Date(row.prompted_at).getTime() > APP_LOGIN_PROMPT_MAX_AGE_MS;
   if (stale) {
      await finish(t.expired, t.toastNo);
      return true;
   }
   if (choice === 'x' || Number(choice) !== Number(row.match_number)) {
      // "Not me" or a wrong number: kill the code so the page can never collect a session.
      await supabase.from('telegram_app_logins').update({ expires_at: new Date(now).toISOString() }).eq('id', row.id).is('claimed_at', null);
      await finish(choice === 'x' ? t.cancelled : t.wrong, t.toastNo);
      return true;
   }
   const from = query.from;
   const { data: claimed } = await supabase
      .from('telegram_app_logins')
      .update({
         telegram_id: from.id,
         telegram_username: from.username ?? null,
         first_name: from.first_name ?? null,
         last_name: from.last_name ?? null,
         claimed_at: new Date(now).toISOString()
      })
      .eq('id', row.id)
      .eq('pending_telegram_id', from.id)
      .is('claimed_at', null)
      .gt('expires_at', new Date(now).toISOString())
      .select('id')
      .maybeSingle();
   await finish(claimed ? t.done(row.device_label || 'Browser') : t.expired, claimed ? t.toastOk : t.toastNo);
   return true;
};

const getOpenSupportSession = async (supabase: SupabaseClient, customerChatId: number) => {
   const { data, error } = await supabase
      .from('support_sessions')
      .select('id, thread_id, status')
      .eq('customer_chat_id', customerChatId)
      .eq('status', 'open')
      .maybeSingle();

   if (error) throw new Error(error.message);
   return data as { id: string; thread_id: number; status: string } | null;
};

const startSupportSession = async (supabase: SupabaseClient, message: TelegramMessage) => {
   const customerChatId = getSenderChatId(message);
   const supportGroupChatId = await getSupportGroupChatId(supabase);
   if (!supportGroupChatId) {
      await sendTelegramMessage(customerChatId, 'Moodeng support is not fully connected yet. Please use the support link in the app.');
      return;
   }

   const existingSession = await getOpenSupportSession(supabase, customerChatId);
   if (existingSession) {
      await sendTelegramMessage(customerChatId, 'You are already connected to Moodeng support. Send your message here.');
      return;
   }

   const topic = await createTelegramForumTopic(supportGroupChatId, `Support ${getDisplayName(message)}`.slice(0, 128));
   const username = getSenderUsername(message);
   const now = new Date().toISOString();

   const { error } = await supabase.from('support_sessions').upsert(
      {
         customer_chat_id: customerChatId,
         thread_id: topic.message_thread_id,
         username,
         status: 'open',
         created_at: now,
         updated_at: now,
         resolved_at: null
      },
      { onConflict: 'customer_chat_id' }
   );

   if (error) throw new Error(error.message);

   await sendTelegramMessage(customerChatId, 'You are connected to Moodeng support. Send your question here and the team will reply.');
   await sendTelegramMessage(
      supportGroupChatId,
      `New Moodeng support chat from ${getDisplayName(message)}.\nReply in this topic to DM the customer.\nUse /resolve when finished.`,
      { messageThreadId: topic.message_thread_id }
   );
};

const forwardCustomerMessageToSupport = async (supabase: SupabaseClient, message: TelegramMessage) => {
   const customerChatId = getSenderChatId(message);
   const supportGroupChatId = await getSupportGroupChatId(supabase);
   const session = await getOpenSupportSession(supabase, customerChatId);

   if (!supportGroupChatId || !session) {
      await sendTelegramMessage(customerChatId, 'To start a private Moodeng support chat, send /start support.');
      return;
   }

   await sendTelegramMessage(supportGroupChatId, `${getDisplayName(message)}:\n${message.text ?? ''}`, {
      messageThreadId: session.thread_id
   });

   await supabase.from('support_sessions').update({ updated_at: new Date().toISOString() }).eq('id', session.id);
};

const handleSupportAgentMessage = async (supabase: SupabaseClient, message: TelegramMessage) => {
   const supportGroupChatId = await getSupportGroupChatId(supabase);
   if (!supportGroupChatId || String(message.chat.id) !== String(supportGroupChatId) || !message.message_thread_id) {
      return;
   }

   const { data: session, error } = await supabase
      .from('support_sessions')
      .select('id, customer_chat_id')
      .eq('thread_id', message.message_thread_id)
      .eq('status', 'open')
      .maybeSingle();

   if (error) throw new Error(error.message);
   if (!session) return;

   if (/^\/resolve(?:@\w+)?/i.test(message.text ?? '')) {
      const now = new Date().toISOString();
      await supabase.from('support_sessions').update({ status: 'resolved', resolved_at: now, updated_at: now }).eq('id', session.id);
      await sendTelegramMessage(session.customer_chat_id, 'Your Moodeng support conversation has been closed. Start a new chat from the app if you need more help.');
      await closeTelegramForumTopic(supportGroupChatId, message.message_thread_id);
      return;
   }

   if (!message.text?.trim()) {
      return;
   }

   await sendTelegramMessage(session.customer_chat_id, `Moodeng Support:\n${message.text.trim()}`);
   await supabase.from('support_sessions').update({ updated_at: new Date().toISOString() }).eq('id', session.id);
};

const recordReferralStart = async (supabase: SupabaseClient, message: TelegramMessage, referralCode: string) => {
   const chatId = getSenderChatId(message);
   const username = getSenderUsername(message);

   await supabase.from('telegram_referral_clicks').insert({
      chat_id: chatId,
      username,
      referral_code: referralCode
   });

   await sendTelegramMessage(
      chatId,
      'Moodeng saved this referral start. Continue by creating your Moodeng account from the website so the referral can be matched.'
   );
};

serve(async (req) => {
   if (req.method === 'OPTIONS') {
      return new Response('ok', { headers: corsHeaders });
   }

   if (req.method !== 'POST') {
      return jsonResponse({ error: 'Method not allowed' }, 405);
   }

   if (!verifyTelegramSecret(req)) {
      return jsonResponse({ error: 'Unauthorized' }, 401);
   }

   const supabase = createClient(Deno.env.get('SUPABASE_URL') ?? '', Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '');
   const update = (await req.json().catch(() => ({}))) as TelegramUpdate;
   const message = update.message;

   try {
      if (update.callback_query) {
         // Telegram-app sign-in: the number prompt (private chat).
         if (await handleAppLoginTap(supabase, update.callback_query)) {
            return jsonResponse({ message: 'App login tap handled' });
         }
         // Indonesia track bot menu + in-chat loans (private chat, market 'ID' only; _shared/idBot.ts).
         if (await handleIdBotCallback(supabase, update.callback_query)) {
            return jsonResponse({ message: 'Indonesia bot callback handled' });
         }
         // Indonesia: "✅ Sent" on a Walt Transfer payout card (admin chats only; idwp:<loan id>).
         if (await handleWaltPayoutCallback(supabase, update.callback_query)) {
            return jsonResponse({ message: 'Indonesia Walt payout handled' });
         }
         // Indonesia payout wallet: unmatched-money card, refunds, /idsweep confirm (admin chats only).
         if (await handleWalletDepositCallback(supabase, update.callback_query)) {
            return jsonResponse({ message: 'Indonesia wallet callback handled' });
         }
         const teamChatId = await getTeamChatId(supabase);
         const kycChatId = await getSetting(supabase, 'kyc_alert_chat_id');
         // 🔄 Change time picker: the admin chats and the call-changes group.
         const reschedule = parseRescheduleCallback(update.callback_query.data);
         if (reschedule) {
            const query = update.callback_query;
            const chatId = query.message?.chat.id;
            const allowed = [teamChatId, kycChatId, await getSetting(supabase, 'call_changes_chat_id')].filter(Boolean).map(String);
            if (!chatId || !query.message || !allowed.includes(String(chatId))) {
               await answerCallback(query.id, 'Not allowed here.');
            } else {
               await answerCallback(query.id, '⏳ One moment…');
               try {
                  const toast = await handleRescheduleStep(supabase, reschedule, chatId, query.message.message_id, adminHandle(query.from));
                  if (reschedule.step === 'open' && !toast.startsWith('Pick')) await sendTelegramMessage(chatId, toast);
               } catch (error) {
                  const reason = error instanceof Error ? error.message : String(error);
                  console.error('telegram-webhook: change time failed', reason);
                  await sendTelegramMessage(chatId, `⚠️ Change time failed — try again. (${reason.slice(0, 200)})`);
               }
            }
            return jsonResponse({ message: 'Reschedule handled' });
         }
         // 🗑️ Cancel call: the admin chats, the team group (📋 Call in N min cards) and the call-changes group.
         const cancel = parseCancelCallback(update.callback_query.data);
         if (cancel) {
            const query = update.callback_query;
            const chatId = query.message?.chat.id;
            const allowed = [teamChatId, kycChatId, await getSetting(supabase, 'team_group_chat_id'), await getSetting(supabase, 'call_changes_chat_id')]
               .filter(Boolean)
               .map(String);
            if (!chatId || !query.message || !allowed.includes(String(chatId))) {
               await answerCallback(query.id, 'Not allowed here.');
            } else {
               await answerCallback(query.id, '⏳ One moment…');
               try {
                  const toast = await handleCancelStep(supabase, cancel, chatId, query.message.message_id, adminHandle(query.from));
                  if (cancel.step === 'open' && !toast.startsWith('Confirm')) await sendTelegramMessage(chatId, toast);
               } catch (error) {
                  const reason = error instanceof Error ? error.message : String(error);
                  console.error('telegram-webhook: cancel call failed', reason);
                  await sendTelegramMessage(chatId, `⚠️ Cancel call failed — try again. (${reason.slice(0, 200)})`);
               }
            }
            return jsonResponse({ message: 'Cancel call handled' });
         }
         // 🧪 Test account?: the admin chats and the call-changes group (where the moved-call cards go).
         const testAccount = parseTestAccountCallback(update.callback_query.data);
         if (testAccount) {
            const allowed = [teamChatId, kycChatId, await getSetting(supabase, 'call_changes_chat_id')].filter(Boolean).map(String);
            await handleTestAccountCallback(supabase, update.callback_query, testAccount, allowed);
            return jsonResponse({ message: 'Test account handled' });
         }
         // 📤 Send on Messenger, under the daily rewards check (voucher_alert_chat_id).
         const nudge = parseMessengerNudgeCallback(update.callback_query.data);
         if (nudge) {
            const query = update.callback_query;
            const chatId = query.message?.chat.id;
            const allowed = [teamChatId, kycChatId, await getSetting(supabase, 'voucher_alert_chat_id')].filter(Boolean).map(String);
            if (!chatId || !allowed.includes(String(chatId))) {
               await answerCallback(query.id, 'Not allowed here.');
            } else {
               await answerCallback(query.id, '⏳ Sending on Messenger…');
               await sendTelegramMessage(chatId, await sendNudgeOnMessenger(supabase, nudge.userId, adminHandle(query.from)));
            }
            return jsonResponse({ message: 'Messenger nudge handled' });
         }
         // Food voucher cards live in their own group (voucher_alert_chat_id).
         await handleAdminCallback(
            supabase,
            update.callback_query,
            [teamChatId, kycChatId, await getSetting(supabase, 'voucher_alert_chat_id')].filter(Boolean).map(String)
         );
         return jsonResponse({ message: 'Callback handled' });
      }

      if (!message || message.from?.is_bot) {
         return jsonResponse({ message: 'Ignored' });
      }

      if (message.chat.type === 'private') {
         const payload = getTelegramStartPayload(message.text);
         if (payload === 'support') {
            await startSupportSession(supabase, message);
            return jsonResponse({ message: 'Support session started' });
         }

         if (payload.startsWith('connect_')) {
            await consumeConnectToken(supabase, message, payload);
            return jsonResponse({ message: 'Telegram alerts connected' });
         }

         // Sign in with the Telegram app (telegram-login app_start / app_poll): claim the code with the
         // account that pressed Start; the page waiting in Facebook's browser then gets its session.
         if (payload.startsWith('login_')) {
            await claimAppLogin(supabase, message, payload);
            return jsonResponse({ message: 'App login claimed' });
         }

         if (payload) {
            await recordReferralStart(supabase, message, payload);
            return jsonResponse({ message: 'Referral start recorded' });
         }

         // Indonesia track: /menu, a bare /start, "menu" or "pinjaman" → the bot menu. Everyone else
         // (and any other text) goes on to support as before.
         if (await handleIdMenuMessage(supabase, message)) {
            return jsonResponse({ message: 'Indonesia bot menu sent' });
         }

         // Indonesia track: a typed question with no human support chat open → the AI helper answers
         // from the guides (_shared/idHelper.ts); when it can't, a support chat is opened for the team.
         if (!(await getOpenSupportSession(supabase, getSenderChatId(message)))) {
            const idUser = await findIdUserByTelegram(supabase, message.from?.id ?? message.chat.id);
            const outcome = idUser ? await handleIdFreeText(supabase, message, idUser) : false;
            if (outcome === 'answered') return jsonResponse({ message: 'Indonesia helper answered' });
            if (outcome === 'handoff') {
               await startSupportSession(supabase, message);
               await forwardCustomerMessageToSupport(supabase, message);
               return jsonResponse({ message: 'Indonesia helper handed off to support' });
            }
         }

         await forwardCustomerMessageToSupport(supabase, message);
         return jsonResponse({ message: 'Private message handled' });
      }

      // /chatid in any group — how a new group's id gets into telegram_bot_settings.
      if (/^\/chatid(?:@\w+)?\b/i.test(message.text ?? '')) {
         await sendTelegramMessage(message.chat.id, `Telegram chat_id for this group: ${message.chat.id}`);
         return jsonResponse({ message: 'Chat id sent' });
      }

      // Admin channels: the private team channel and the KYC admin channel.
      const teamChatId = await getTeamChatId(supabase);
      const kycChatId = await getSetting(supabase, 'kyc_alert_chat_id');
      const isAdminChannel = [teamChatId, kycChatId].some((id) => id && String(message.chat.id) === String(id));

      // Lender-roster commands are honored only in the private team channel.
      if (
         teamChatId &&
         String(message.chat.id) === String(teamChatId) &&
         /^\/(addlender|lenders|removelender)\b/i.test(message.text ?? '')
      ) {
         await handleLenderRosterCommand(supabase, message);
         return jsonResponse({ message: 'Lender roster command handled' });
      }

      // /move @username — the 🔄 Change time picker for their call. Admin chats + call-changes group.
      if (/^\/move(?:@\w+)?\b/i.test(message.text ?? '')) {
         const callChangesChatId = await getSetting(supabase, 'call_changes_chat_id');
         if (isAdminChannel || (callChangesChatId && String(message.chat.id) === String(callChangesChatId))) {
            const arg = (message.text ?? '').trim().split(/\s+/)[1]?.replace(/^@/, '') ?? '';
            if (!arg) {
               await sendTelegramMessage(message.chat.id, 'Usage: /move @username — then pick the new day and time.');
            } else {
               const { data: who } = await supabase.from('users').select('id').ilike('username', escapeLike(arg)).maybeSingle();
               const reply = who ? await postReschedulePicker(supabase, message.chat.id, (who as { id: string }).id) : `No borrower called @${arg}.`;
               if (!reply.startsWith('Pick')) await sendTelegramMessage(message.chat.id, reply);
            }
            return jsonResponse({ message: 'Move command handled' });
         }
      }

      // Manual Messenger verification confirm — either admin channel.
      if (isAdminChannel && /^\/confirm\b/i.test(message.text ?? '')) {
         await handleMessengerConfirmCommand(supabase, message);
         return jsonResponse({ message: 'Messenger confirm handled' });
      }

      // Connect → Approve → Apply typed decisions + call attendance — either admin channel.
      if (isAdminChannel && /^\/(approve|reject|showed|noshow)\b/i.test(message.text ?? '')) {
         await handleLoanAccessCommand(supabase, message);
         return jsonResponse({ message: 'Loan access command handled' });
      }

      // Who's waiting on a decision — either admin channel.
      if (isAdminChannel && /^\/pending\b/i.test(message.text ?? '')) {
         await handlePendingCommand(supabase, message);
         return jsonResponse({ message: 'Pending list handled' });
      }

      // Borrower-flow switch — either admin channel.
      if (isAdminChannel && /^\/loanflow\b/i.test(message.text ?? '')) {
         await handleLoanFlowCommand(supabase, message);
         return jsonResponse({ message: 'Loan flow command handled' });
      }

      // KYC tries reset — either admin channel.
      if (isAdminChannel && /^\/kycretry\b/i.test(message.text ?? '')) {
         await handleKycRetryCommand(supabase, message);
         return jsonResponse({ message: 'KYC retry command handled' });
      }

      // Test-account flag — either admin channel.
      if (isAdminChannel && /^\/testaccount\b/i.test(message.text ?? '')) {
         await handleTestAccountCommand(supabase, message);
         return jsonResponse({ message: 'Test account command handled' });
      }

      // Pre-KYC gate switch — either admin channel.
      if (isAdminChannel && /^\/kycgate\b/i.test(message.text ?? '')) {
         await handleKycGateCommand(supabase, message);
         return jsonResponse({ message: 'KYC gate command handled' });
      }

      // Indonesia track switch + loan rules — either admin channel.
      if (isAdminChannel && /^\/(idtrack|idloans|idterm)\b/i.test(message.text ?? '')) {
         await handleIdTrackCommand(supabase, message);
         return jsonResponse({ message: 'Indonesia track command handled' });
      }

      // Indonesia payout wallet switch — either admin channel.
      // Indonesia payout wallet: send money out to the one fixed sweep address.
      if (isAdminChannel && /^\/idsweep\b/i.test(message.text ?? '')) {
         await handleSweepCommand(supabase, message);
         return jsonResponse({ message: 'Indonesia sweep command handled' });
      }

      if (isAdminChannel && /^\/idautopay\b/i.test(message.text ?? '')) {
         await handleIdAutopayCommand(supabase, message);
         return jsonResponse({ message: 'Indonesia autopay command handled' });
      }

      await handleSupportAgentMessage(supabase, message);
      return jsonResponse({ message: 'Group message handled' });
   } catch (error) {
      return jsonResponse({ error: error instanceof Error ? error.message : 'Telegram webhook failed' }, 500);
   }
});
