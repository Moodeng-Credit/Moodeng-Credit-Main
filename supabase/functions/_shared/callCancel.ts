// 🗑️ Cancel call, inside Telegram: the team drops a borrower's booked call without leaving the chat.
//
//    🗑️ Cancel call (on the booking card, the moved-call card and the "📋 Call in N min" card)
//      → "Cancel Jiji's call (Sat 18 Oct, 4:15 PM)?" ✅ Yes, cancel it / ✖ Keep it
//      → ✅ → Cal.com cancels the booking (its Zoom meeting and calendar events go with it)
//
// Quiet on our side: the borrower gets no "your call was cancelled, rebook" message from us (Cal.com
// still emails the attendees its own cancellation). Our booking fields are cleared *before* the Cal.com
// cancel — same as the reminder job's releaseSlot — so the BOOKING_CANCELLED webhook that follows
// matches nothing and doesn't message the borrower or post "they cancelled their call". If Cal.com
// refuses, the booking is put back and nothing changed.
//
// callback_data: "cc:<o|y|x>:<user id>".
import { personName, stampDecisionCards } from './adminCards.ts';
import { cancelCalBooking } from './calcomCancel.ts';
import { postDiscord } from './discord.ts';
import { callTelegramApi, sendTelegramMessage, type TelegramInlineKeyboard } from './telegram.ts';
import { formatCallTimeForTeam } from './videoCall.ts';

// deno-lint-ignore no-explicit-any
type SupabaseClient = any;

const PREFIX = 'cc:';
type Step = 'open' | 'yes' | 'keep';
const CODE: Record<Step, string> = { open: 'o', yes: 'y', keep: 'x' };
const STEP: Record<string, Step> = { o: 'open', y: 'yes', x: 'keep' };

export type CancelAction = { step: Step; userId: string };

export const buildCancelCallback = (step: Step, userId: string) => `${PREFIX}${CODE[step]}:${userId}`;
export const parseCancelCallback = (data?: string | null): CancelAction | null => {
   const match = (data ?? '').match(/^cc:([oyx]):([0-9a-f-]{36})$/i);
   if (!match) return null;
   return { step: STEP[match[1].toLowerCase()], userId: match[2].toLowerCase() };
};

// The button on call cards.
export const cancelCallButton = (userId: string) => ({ text: '🗑️ Cancel call', callback_data: buildCancelCallback('open', userId) });

const BOOKING_FIELDS = [
   'video_call_scheduled_at',
   'video_call_starts_at',
   'video_call_host',
   'video_call_booking_uid',
   'video_call_join_url',
   'video_call_meeting_id'
] as const;
const CALL_COLUMNS = `id, username, display_name, email, video_call_timezone, ${BOOKING_FIELDS.join(', ')}`;

type CallRow = {
   id: string;
   username: string | null;
   display_name: string | null;
   email: string | null;
   video_call_timezone: string | null;
} & Record<(typeof BOOKING_FIELDS)[number], string | null>;

const loadCall = async (svc: SupabaseClient, userId: string): Promise<CallRow | null> => {
   const { data } = await svc.from('users').select(CALL_COLUMNS).eq('id', userId).maybeSingle();
   return (data as CallRow | null) ?? null;
};
const nameOf = (u: CallRow) => u.display_name?.trim() || (u.username ? `@${u.username}` : u.email || 'this borrower');
const hasUpcomingCall = (u: CallRow | null): u is CallRow & { video_call_starts_at: string; video_call_booking_uid: string } =>
   Boolean(u?.video_call_booking_uid && u.video_call_starts_at && Date.parse(u.video_call_starts_at) > Date.now());

type View = { text: string; keyboard: TelegramInlineKeyboard };

export const confirmCancelView = (u: CallRow & { video_call_starts_at: string }): View => ({
   text: `🗑️ Cancel ${nameOf(u)}'s call?\n${formatCallTimeForTeam(u.video_call_starts_at, u.video_call_timezone)}\n\nCal.com cancels the booking, its Zoom meeting and the calendar events, and emails them its cancellation. We don't message them, and their call request is closed.`,
   keyboard: [
      [
         { text: '✅ Yes, cancel it', callback_data: buildCancelCallback('yes', u.id) },
         { text: '✖ Keep it', callback_data: buildCancelCallback('keep', u.id) }
      ]
   ]
});

const edit = async (chatId: number | string, messageId: number, view: View | string) => {
   const { text, keyboard } = typeof view === 'string' ? { text: view, keyboard: [] } : view;
   try {
      await callTelegramApi('editMessageText', {
         chat_id: chatId,
         message_id: messageId,
         text,
         disable_web_page_preview: true,
         reply_markup: { inline_keyboard: keyboard }
      });
   } catch (err) {
      // "message is not modified" (a double tap) is harmless.
      console.error('callCancel: edit failed', err instanceof Error ? err.message : err);
   }
};

// Cancel on Cal.com and close the call request — no message to the borrower. Returns null when done,
// or why it didn't happen.
export const cancelCallQuietly = async (svc: SupabaseClient, u: CallRow & { video_call_booking_uid: string }, by: string): Promise<string | null> => {
   const snapshot = Object.fromEntries(BOOKING_FIELDS.map((f) => [f, u[f] ?? null]));
   const cleared = Object.fromEntries(BOOKING_FIELDS.map((f) => [f, null]));
   const { data: claimed } = await svc
      .from('users')
      .update(cleared)
      .eq('id', u.id)
      .eq('video_call_booking_uid', u.video_call_booking_uid)
      .select('id')
      .maybeSingle();
   if (!claimed) return 'Their booking changed in the meantime — nothing cancelled.';

   if (!(await cancelCalBooking(u.video_call_host, u.video_call_booking_uid, 'Cancelled by the Moodeng team.'))) {
      await svc.from('users').update(snapshot).eq('id', u.id);
      return "Cal.com didn't cancel it — nothing changed. Try again, or cancel it on Cal.com.";
   }

   const { data: closed } = await svc
      .from('loan_access_requests')
      .update({ status: 'expired', decided_at: new Date().toISOString(), decided_by: `call-cancelled by ${by}` })
      .eq('user_id', u.id)
      .eq('status', 'pending')
      .eq('kind', 'call')
      .select('id');
   if (closed?.length) {
      await svc.from('users').update({ loan_access_status: 'none' }).eq('id', u.id).eq('loan_access_status', 'pending');
   }
   await stampDecisionCards(svc, 'loan_access', u.id, `🗑️ CALL CANCELLED — ${personName(u)}'s call was cancelled by the team`, { by });
   return null;
};

// Post the confirm prompt (from a card's button) — the card itself stays as it was.
const postConfirm = async (svc: SupabaseClient, chatId: number | string, userId: string): Promise<string> => {
   const u = await loadCall(svc, userId);
   if (!u) return 'Borrower not found.';
   if (!hasUpcomingCall(u)) return `${nameOf(u)} has no upcoming call to cancel.`;
   const view = confirmCancelView(u);
   await sendTelegramMessage(chatId, view.text, { inlineKeyboard: view.keyboard });
   return 'Confirm below 👇';
};

// A tap on 🗑️ Cancel call or its confirm prompt. Returns the short toast for answerCallbackQuery.
export const handleCancelStep = async (
   svc: SupabaseClient,
   action: CancelAction,
   chatId: number | string,
   messageId: number,
   by: string
): Promise<string> => {
   if (action.step === 'open') return await postConfirm(svc, chatId, action.userId);

   const u = await loadCall(svc, action.userId);
   if (action.step === 'keep') {
      await edit(chatId, messageId, `${u ? `${nameOf(u)}'s` : 'The'} call is kept.`);
      return 'Kept';
   }
   if (!hasUpcomingCall(u)) {
      await edit(chatId, messageId, `${u ? nameOf(u) : 'This borrower'} has no upcoming call to cancel any more.`);
      return 'No upcoming call';
   }

   const when = formatCallTimeForTeam(u.video_call_starts_at, u.video_call_timezone);
   await edit(chatId, messageId, `🗑️ Cancelling ${nameOf(u)}'s call (${when})…`);
   const failed = await cancelCallQuietly(svc, u, by);
   if (failed) {
      await edit(chatId, messageId, { text: `⚠️ ${nameOf(u)}'s call (${when})\n\n${failed}`, keyboard: confirmCancelView(u).keyboard });
      return failed.slice(0, 190);
   }
   const text = `🗑️ Cancelled ${nameOf(u)}'s call (${when}) — by ${by}. Zoom + calendar removed, request closed; we didn't message them.`;
   await edit(chatId, messageId, text);
   await postDiscord({ content: text }, { prefer: ['DISCORD_BOOKINGS_WEBHOOK_URL'] });
   return '✅ Cancelled';
};
