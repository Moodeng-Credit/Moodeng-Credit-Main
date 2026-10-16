// 🔄 Change time, inside Telegram: the team moves a borrower's call without leaving the chat.
//
//    🔄 Change time (on a call card, or /move @username)
//      → the bot posts a picker: the days that have free times
//      → tap a day → its free times (Bangkok)
//      → tap a time → "Move Jiji's call to Sat 18 Oct, 4:15 PM?" ✅ Move it / ◀ Back
//      → ✅ → Cal.com reschedules the booking (same host, same Zoom flow)
// Cal.com then fires BOOKING_RESCHEDULED and calcom-webhook does the rest: new time on the borrower's
// row, reminders restart, the borrower is told on Messenger, and the call-changes group is posted.
//
// The free times are the same ones the borrower's booking page offers (calcomSlots.ts: the host's
// Cal.com availability inside the team's open hours), always re-read, never cached.
//
// callback_data (max 64 bytes): "rs:<o|b|x>:<user id>", "rs:d:<user id>:<YYYYMMDD>",
// "rs:<s|y>:<user id>:<start in base-36 minutes>".
import { CALL_TIME_ZONE, fetchSlots, hostApiKey, rescheduleCalBooking, resolveEventTypeId } from './calcomSlots.ts';
import { callTelegramApi, sendTelegramMessage, type TelegramInlineKeyboard } from './telegram.ts';
import { formatCallTimeForTeam } from './videoCall.ts';

// deno-lint-ignore no-explicit-any
type SupabaseClient = any;

const PREFIX = 'rs:';
const DAYS_AHEAD = 14;
// Not offered: anything starting sooner than this (the borrower needs time to see the new time).
const MIN_LEAD_MS = 30 * 60_000;
const DEFAULT_HOST = 'emma';

type Step = 'open' | 'day' | 'days' | 'slot' | 'yes' | 'close';
const CODE: Record<Step, string> = { open: 'o', day: 'd', days: 'b', slot: 's', yes: 'y', close: 'x' };
const STEP: Record<string, Step> = Object.fromEntries(Object.entries(CODE).map(([k, v]) => [v, k as Step]));

export type RescheduleAction = { step: Step; userId: string; arg: string | null };

export const buildRescheduleCallback = (step: Step, userId: string, arg?: string) => `${PREFIX}${CODE[step]}:${userId}${arg ? `:${arg}` : ''}`;
export const parseRescheduleCallback = (data?: string | null): RescheduleAction | null => {
   const match = (data ?? '').match(/^rs:([odbsyx]):([0-9a-f-]{36})(?::([0-9a-z]+))?$/i);
   if (!match) return null;
   return { step: STEP[match[1].toLowerCase()], userId: match[2].toLowerCase(), arg: match[3]?.toLowerCase() ?? null };
};

// The button on call cards.
export const changeTimeButton = (userId: string) => ({ text: '🔄 Change time', callback_data: buildRescheduleCallback('open', userId) });

export const startKey = (iso: string) => Math.floor(Date.parse(iso) / 60000).toString(36);
const startFromKey = (key: string) => new Date(parseInt(key, 36) * 60000).toISOString();

// Bangkok calendar day, "20261018".
export const bangkokDay = (iso: string) =>
   new Intl.DateTimeFormat('en-CA', { timeZone: CALL_TIME_ZONE, year: 'numeric', month: '2-digit', day: '2-digit' })
      .format(new Date(iso))
      .replace(/-/g, '');
const dayLabel = (iso: string) =>
   new Date(iso).toLocaleDateString('en-US', { timeZone: CALL_TIME_ZONE, weekday: 'short', month: 'short', day: 'numeric' });
const clock = (iso: string) =>
   new Date(iso).toLocaleTimeString('en-US', { timeZone: CALL_TIME_ZONE, hour: 'numeric', minute: '2-digit' });

type CallRow = {
   id: string;
   username: string | null;
   display_name: string | null;
   email: string | null;
   video_call_starts_at: string | null;
   video_call_timezone: string | null;
   video_call_booking_uid: string | null;
   video_call_host: string | null;
};
const CALL_COLUMNS = 'id, username, display_name, email, video_call_starts_at, video_call_timezone, video_call_booking_uid, video_call_host';

const loadCall = async (svc: SupabaseClient, userId: string): Promise<CallRow | null> => {
   const { data } = await svc.from('users').select(CALL_COLUMNS).eq('id', userId).maybeSingle();
   return (data as CallRow | null) ?? null;
};
const nameOf = (u: CallRow) => u.display_name?.trim() || (u.username ? `@${u.username}` : u.email || 'this borrower');
const hasUpcomingCall = (u: CallRow | null): u is CallRow & { video_call_starts_at: string; video_call_booking_uid: string } =>
   Boolean(u?.video_call_booking_uid && u.video_call_starts_at && Date.parse(u.video_call_starts_at) > Date.now());

// Free starts on the borrower's host's calendar, soonest first, minus their current time.
export const freeSlots = async (u: CallRow): Promise<string[]> => {
   const apiKey = hostApiKey(u.video_call_host || DEFAULT_HOST);
   if (!apiKey) return [];
   const eventTypeId = await resolveEventTypeId(apiKey);
   if (!eventTypeId) return [];
   const ymd = (ms: number) => new Date(ms).toISOString().slice(0, 10);
   const slots = await fetchSlots(apiKey, eventTypeId, ymd(Date.now() - 86400000), ymd(Date.now() + DAYS_AHEAD * 86400000), CALL_TIME_ZONE);
   const current = u.video_call_starts_at ? Date.parse(u.video_call_starts_at) : NaN;
   const earliest = Date.now() + MIN_LEAD_MS;
   return [...new Set(slots.map((s) => new Date(s).toISOString()))]
      .filter((s) => Date.parse(s) >= earliest && Date.parse(s) !== current)
      .sort();
};

const header = (u: CallRow & { video_call_starts_at: string }) =>
   `🔄 Move ${nameOf(u)}'s call\nNow: ${formatCallTimeForTeam(u.video_call_starts_at, u.video_call_timezone)}`;
const closeRow = (userId: string) => [{ text: '✖ Close', callback_data: buildRescheduleCallback('close', userId) }];

type View = { text: string; keyboard: TelegramInlineKeyboard };

export const daysView = (u: CallRow & { video_call_starts_at: string }, slots: string[]): View => {
   const byDay = new Map<string, string[]>();
   for (const s of slots) byDay.set(bangkokDay(s), [...(byDay.get(bangkokDay(s)) ?? []), s]);
   if (!byDay.size) {
      return { text: `${header(u)}\n\nNo free times in the next ${DAYS_AHEAD} days on Cal.com.`, keyboard: [closeRow(u.id)] };
   }
   const buttons = [...byDay.entries()].map(([day, list]) => ({
      text: `${dayLabel(list[0])} · ${list.length}`,
      callback_data: buildRescheduleCallback('day', u.id, day)
   }));
   const rows: TelegramInlineKeyboard = [];
   for (let i = 0; i < buttons.length; i += 2) rows.push(buttons.slice(i, i + 2));
   return { text: `${header(u)}\n\nPick a day (Bangkok time · number of free times):`, keyboard: [...rows, closeRow(u.id)] };
};

export const dayView = (u: CallRow & { video_call_starts_at: string }, slots: string[], day: string): View => {
   const list = slots.filter((s) => bangkokDay(s) === day);
   const back = [{ text: '◀ Days', callback_data: buildRescheduleCallback('days', u.id) }, ...closeRow(u.id)];
   if (!list.length) return { text: `${header(u)}\n\nThat day has no free times left — pick another.`, keyboard: [back] };
   const buttons = list.map((s) => ({ text: clock(s), callback_data: buildRescheduleCallback('slot', u.id, startKey(s)) }));
   const rows: TelegramInlineKeyboard = [];
   for (let i = 0; i < buttons.length; i += 4) rows.push(buttons.slice(i, i + 4));
   return { text: `${header(u)}\n\n${dayLabel(list[0])} — pick a time (Bangkok):`, keyboard: [...rows, back] };
};

const confirmView = (u: CallRow & { video_call_starts_at: string }, start: string): View => ({
   text: `${header(u)}\n\nMove it to ${formatCallTimeForTeam(start, u.video_call_timezone)}?\nThey'll get a Messenger message and a Cal.com email with the new time.`,
   keyboard: [
      [{ text: '✅ Move it', callback_data: buildRescheduleCallback('yes', u.id, startKey(start)) }],
      [{ text: '◀ Back', callback_data: buildRescheduleCallback('day', u.id, bangkokDay(start)) }, ...closeRow(u.id)]
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
      console.error('callReschedule: edit failed', err instanceof Error ? err.message : err);
   }
};

// Post a fresh picker (from a card's button or /move) — the card itself stays as it was.
export const postReschedulePicker = async (svc: SupabaseClient, chatId: number | string, userId: string): Promise<string> => {
   const u = await loadCall(svc, userId);
   if (!u) return 'Borrower not found.';
   if (!hasUpcomingCall(u)) return `${nameOf(u)} has no upcoming call to move.`;
   const view = daysView(u, await freeSlots(u));
   await sendTelegramMessage(chatId, view.text, { inlineKeyboard: view.keyboard });
   return 'Pick a new time below 👇';
};

// A tap on the picker. Returns the short toast for answerCallbackQuery.
export const handleRescheduleStep = async (
   svc: SupabaseClient,
   action: RescheduleAction,
   chatId: number | string,
   messageId: number,
   by: string
): Promise<string> => {
   if (action.step === 'open') return await postReschedulePicker(svc, chatId, action.userId);

   const u = await loadCall(svc, action.userId);
   if (action.step === 'close') {
      await edit(chatId, messageId, u?.video_call_starts_at ? `${header(u as CallRow & { video_call_starts_at: string })}\n\nLeft as it is.` : 'Closed.');
      return 'Closed';
   }
   if (!hasUpcomingCall(u)) {
      await edit(chatId, messageId, `${u ? nameOf(u) : 'This borrower'} has no upcoming call to move any more.`);
      return 'No upcoming call';
   }

   if (action.step === 'slot' && action.arg) {
      const start = startFromKey(action.arg);
      await edit(chatId, messageId, confirmView(u, start));
      return formatCallTimeForTeam(start).slice(0, 190);
   }

   if (action.step === 'yes' && action.arg) {
      const start = startFromKey(action.arg);
      if (Date.parse(start) < Date.now() + 5 * 60_000) {
         await edit(chatId, messageId, daysView(u, await freeSlots(u)));
         return 'That time has passed — pick another.';
      }
      await edit(chatId, messageId, { text: `${header(u)}\n\n⏳ Moving it to ${formatCallTimeForTeam(start, u.video_call_timezone)}…`, keyboard: [] });
      const result = await rescheduleCalBooking(u.video_call_host || DEFAULT_HOST, u.video_call_booking_uid, start, `Moved by ${by} (Moodeng team)`);
      if ('uid' in result) {
         await edit(
            chatId,
            messageId,
            `✅ Moved ${nameOf(u)}'s call\nWas: ${formatCallTimeForTeam(u.video_call_starts_at, u.video_call_timezone)}\nNow: ${formatCallTimeForTeam(start, u.video_call_timezone)}\nMoved by ${by}. They're being told on Messenger + by Cal.com email.`
         );
         return '✅ Moved';
      }
      if (result.error === 'taken') {
         const view = daysView(u, await freeSlots(u));
         await edit(chatId, messageId, { text: `⚠️ That time was just taken.\n\n${view.text}`, keyboard: view.keyboard });
         return 'That time was just taken';
      }
      await edit(chatId, messageId, {
         text: `${header(u)}\n\n⚠️ Cal.com didn't move it${result.message ? ` (${result.message.slice(0, 200)})` : ''}. Nothing changed — try again, or use Cal.com.`,
         keyboard: [[{ text: '◀ Days', callback_data: buildRescheduleCallback('days', u.id) }, ...closeRow(u.id)]]
      });
      return "Cal.com didn't move it";
   }

   const slots = await freeSlots(u);
   if (action.step === 'day' && action.arg) {
      await edit(chatId, messageId, dayView(u, slots, action.arg));
      return 'Pick a time';
   }
   await edit(chatId, messageId, daysView(u, slots));
   return 'Pick a day';
};
