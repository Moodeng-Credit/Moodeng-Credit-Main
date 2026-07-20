import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

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

type TelegramUpdate = {
   message?: TelegramMessage;
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

      // Lender-roster commands are honored only in the private team channel.
      const teamChatId = await getTeamChatId(supabase);
      if (
         teamChatId &&
         String(message.chat.id) === String(teamChatId) &&
         /^\/(addlender|lenders|removelender)\b/i.test(message.text ?? '')
      ) {
         await handleLenderRosterCommand(supabase, message);
         return jsonResponse({ message: 'Lender roster command handled' });
      }

      await handleSupportAgentMessage(supabase, message);
      return jsonResponse({ message: 'Group message handled' });
   } catch (error) {
      return jsonResponse({ error: error instanceof Error ? error.message : 'Telegram webhook failed' }, 500);
   }
});
