import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

import {
   answerCallback,
   decideLoanAccess,
   escapeLike,
   findPendingRequest,
   parseDecisionCallback,
   shortId,
   stampAdminCard
} from '../_shared/loanAccess.ts';
import { formatCallTime } from '../_shared/videoCall.ts';
import { parseOutcomeCallback, recordCallOutcome } from '../_shared/videoCallOutcome.ts';
import {
   closeTelegramForumTopic,
   createTelegramForumTopic,
   sendTelegramMessage
} from '../_shared/telegram.ts';

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
};

type TelegramMessage = {
   message_id: number;
   message_thread_id?: number;
   text?: string;
   chat: TelegramChat;
   from?: TelegramUser;
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

   const { data: prof } = await supabase.from('users').select('username, email').eq('id', pending.user_id).maybeSingle();
   const who = [prof?.username, prof?.email].filter(Boolean).join(' · ') || pending.user_id;
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
         const { data: user } = await supabase.from('users').select('id').ilike('username', escapeLike(arg.replace(/^@/, ''))).maybeSingle();
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

// The inline buttons on admin cards: la: (loan-access Approve / Reject / Showed up / No-show) and
// vc: (open-flow call attendance). Honored only when the card sits in an admin channel, so a
// forwarded card can't be tapped from anywhere else.
const handleAdminCallback = async (supabase: SupabaseClient, query: TelegramCallbackQuery, adminChatIds: string[]) => {
   const parsed = parseDecisionCallback(query.data);
   const outcome = parsed ? null : parseOutcomeCallback(query.data);
   if (!parsed && !outcome) {
      await answerCallback(query.id, 'Unknown action.');
      return;
   }
   const cardChatId = query.message?.chat.id;
   if (!cardChatId || !adminChatIds.includes(String(cardChatId))) {
      await answerCallback(query.id, 'Not allowed here.');
      return;
   }

   const result = parsed
      ? await decideLoanAccess(supabase, parsed.requestId, parsed.decision, adminHandle(query.from))
      : await recordCallOutcome(supabase, outcome!.userId, outcome!.outcome, adminHandle(query.from));
   await answerCallback(query.id, result.summary);
   if (query.message) await stampAdminCard(cardChatId, query.message.message_id, query.message.text ?? '', result.summary);
};

// /pending — everyone waiting on a decision, oldest first, with the id for /approve etc. A safety
// net for when a card scrolls away. Admin channels only.
const handlePendingCommand = async (supabase: SupabaseClient, message: TelegramMessage) => {
   const { data, error } = await supabase
      .from('loan_access_requests')
      .select('id, user_id, kind, display_name, created_at, users!inner(username, email, video_call_starts_at)')
      .eq('status', 'pending')
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

const verifyTelegramSecret = (req: Request) => {
   const expectedSecret = Deno.env.get('TELEGRAM_WEBHOOK_SECRET');
   if (!expectedSecret) {
      return true;
   }

   return req.headers.get('x-telegram-bot-api-secret-token') === expectedSecret;
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
         const teamChatId = await getTeamChatId(supabase);
         const kycChatId = await getSetting(supabase, 'kyc_alert_chat_id');
         await handleAdminCallback(
            supabase,
            update.callback_query,
            [teamChatId, kycChatId].filter(Boolean).map(String)
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

         if (payload) {
            await recordReferralStart(supabase, message, payload);
            return jsonResponse({ message: 'Referral start recorded' });
         }

         await forwardCustomerMessageToSupport(supabase, message);
         return jsonResponse({ message: 'Private message handled' });
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

      await handleSupportAgentMessage(supabase, message);
      return jsonResponse({ message: 'Group message handled' });
   } catch (error) {
      return jsonResponse({ error: error instanceof Error ? error.message : 'Telegram webhook failed' }, 500);
   }
});
