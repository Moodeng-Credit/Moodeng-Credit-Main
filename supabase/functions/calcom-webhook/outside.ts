// Bookings that reach us without our moodeng_user_id (George, 2026-11-26: "when people rebook it
// doesn't show up in messenger"). Two ways that happens:
//   • Cal.com moved one of our bookings but dropped its metadata → match the booking it replaces
//     (rescheduledFromUid) to the borrower holding it, and let the normal "moved" path run.
//   • The borrower booked on Cal.com's own page (a Cal.com email or a saved link, often right after
//     their call was cancelled) → match the attendee email to one borrower and treat it like a booking
//     made in the app: stamp the call, restart reminders, "You're booked" on Messenger, team ping.
// Anything we can't place safely goes to the team instead of being dropped silently.
import { openInAdminButton } from '../_shared/adminCards.ts';
import { ATTENDANCE_RESET, meetingIdFromJoinUrl } from '../_shared/attendance.ts';
import { fetchAccountEmail, hostApiKey } from '../_shared/calcomSlots.ts';
import { cancelCallButton } from '../_shared/callCancel.ts';
import { changeTimeLinkButton } from '../_shared/callReschedule.ts';
import { autoRejectForStrikes, logCallEvent } from '../_shared/callStrikes.ts';
import { postDiscord } from '../_shared/discord.ts';
import { BORROWER_COLUMNS, type BorrowerRow, getCallChangesChatId, who } from '../_shared/loanAccess.ts';
import { isCallInbox, isPlaceholderEmail } from '../_shared/placeholderEmail.ts';
import { sendTelegramMessage, type TelegramInlineKeyboard } from '../_shared/telegram.ts';
import { testAccountRow } from '../_shared/testAccount.ts';
import { formatCallTimeForTeam, newConfirmToken, sendBookedMessenger } from '../_shared/videoCall.ts';
import type { CalcomBooking, OutsideDetails } from './parse.ts';

// deno-lint-ignore no-explicit-any
type Svc = any;

const HOST_IDS = ['george', 'emma'] as const;

/** The borrower holding the booking a metadata-less reschedule replaces, if any. */
export const findHolderOfBooking = async (svc: Svc, uid: string | null): Promise<string | null> => {
   if (!uid) return null;
   const { data } = await svc.from('users').select('id').eq('video_call_booking_uid', uid).limit(2);
   const rows = (data ?? []) as Array<{ id: string }>;
   return rows.length === 1 ? rows[0].id : null;
};

// ilike so case doesn't matter, with its wildcards escaped (emails can contain "_").
const escapeLike = (value: string) => value.replace(/[\\%_]/g, (c) => `\\${c}`);

/** Real attendee emails (not our placeholders / call inbox) → distinct borrower ids. */
export const usersForEmails = async (svc: Svc, emails: string[]): Promise<string[]> => {
   const ids = new Set<string>();
   for (const email of emails) {
      if (isPlaceholderEmail(email) || isCallInbox(email) || email.endsWith('@moodeng.app')) continue;
      const { data } = await svc.from('users').select('id').ilike('email', escapeLike(email)).limit(3);
      for (const row of (data ?? []) as Array<{ id: string }>) ids.add(row.id);
   }
   return [...ids];
};

/** Which of our hosts owns the Cal.com account the booking is on. */
const hostFromOrganizer = async (organizerEmail: string | null): Promise<'george' | 'emma' | null> => {
   if (!organizerEmail) return null;
   for (const id of HOST_IDS) {
      const key = hostApiKey(id);
      if (key && (await fetchAccountEmail(key))?.toLowerCase() === organizerEmail) return id;
   }
   return null;
};

const tellTeam = async (svc: Svc, text: string, keyboard?: TelegramInlineKeyboard) => {
   try {
      const chat = await getCallChangesChatId(svc);
      if (chat) await sendTelegramMessage(chat, text, keyboard ? { inlineKeyboard: keyboard } : undefined);
   } catch (err) {
      console.error('calcom-webhook: outside-booking telegram failed', err instanceof Error ? err.message : err);
   }
   await postDiscord({ content: text }, { prefer: ['DISCORD_BOOKINGS_WEBHOOK_URL'] });
};

/**
 * A BOOKING_CREATED / BOOKING_RESCHEDULED with no moodeng_user_id that isn't a move of a call we
 * know: place it by the attendee's email, or hand it to the team.
 */
export const adoptOutsideBooking = async (svc: Svc, booking: CalcomBooking, details: OutsideDetails): Promise<string> => {
   const when = booking.startsAt ? formatCallTimeForTeam(booking.startsAt, details.attendeeTimeZone) : 'unknown time';
   const attendee = `${details.attendeeName ?? 'someone'} (${booking.attendeeEmails.join(', ') || 'no email'})`;
   if (!booking.bookingUid || !booking.startsAt || Date.parse(booking.startsAt) <= Date.now()) return 'not_upcoming';

   const ids = await usersForEmails(svc, booking.attendeeEmails);
   if (ids.length !== 1) {
      await tellTeam(
         svc,
         `📅 Call booked straight on Cal.com (not through the app) — ${ids.length ? 'more than one account has this email' : 'no Moodeng account has this email'}, so no reminders or Messenger message go out.\nWith: ${attendee}\nWhen: ${when}`
      );
      return ids.length ? 'ambiguous' : 'no_match';
   }
   const userId = ids[0];
   const { data: row } = await svc.from('users').select(`${BORROWER_COLUMNS}, video_call_outcome`).eq('id', userId).maybeSingle();
   const u = row as (BorrowerRow & { video_call_outcome?: string | null }) | null;
   if (!u) return 'no_match';

   if (u.loan_access_status === 'rejected') {
      await tellTeam(
         svc,
         `📅 ${who(u)} is rejected but booked a call straight on Cal.com: ${when}. Cancel it in Cal.com if it shouldn't happen.`,
         [[openInAdminButton(u.id, u.username)]]
      );
      return 'rejected';
   }
   const holdsOther =
      u.video_call_booking_uid &&
      u.video_call_booking_uid !== booking.bookingUid &&
      u.video_call_starts_at &&
      Date.parse(u.video_call_starts_at) > Date.now();
   if (holdsOther) {
      await tellTeam(
         svc,
         `📅 ${who(u)} booked a second call straight on Cal.com: ${when}. Kept the one they already had (${formatCallTimeForTeam(u.video_call_starts_at as string, u.video_call_timezone)}) — cancel one of them in Cal.com.`,
         [[openInAdminButton(u.id, u.username)]]
      );
      return 'has_call';
   }

   const host = booking.host ?? (await hostFromOrganizer(details.organizerEmail));
   const { data: stamped, error } = await svc
      .from('users')
      .update({
         video_call_scheduled_at: new Date().toISOString(),
         video_call_host: host,
         video_call_starts_at: booking.startsAt,
         video_call_booking_uid: booking.bookingUid,
         video_call_timezone: u.video_call_timezone ?? details.attendeeTimeZone ?? 'Asia/Manila',
         ...(booking.joinUrl ? { video_call_join_url: booking.joinUrl, video_call_meeting_id: meetingIdFromJoinUrl(booking.joinUrl) } : {}),
         ...ATTENDANCE_RESET,
         video_call_reminder_stage: 0,
         video_call_confirm_token: newConfirmToken(),
         video_call_confirmed_at: null,
         ...(u.video_call_outcome === 'attended' ? {} : { video_call_outcome: null, video_call_outcome_at: null })
      })
      .eq('id', userId)
      .select(
         'messenger_psid, video_call_host, video_call_starts_at, video_call_timezone, video_call_join_url, video_call_confirm_token, video_call_confirmed_at, video_call_booking_uid'
      )
      .maybeSingle();
   if (error || !stamped) {
      console.error('calcom-webhook: adopt outside booking failed', error?.message);
      return 'failed';
   }
   await logCallEvent(svc, userId, 'booked', booking.startsAt);
   // Same rule as booking in the app: booking again counts as a reschedule; the 3rd rejects them
   // (rejectUser cancels the call we just stamped).
   if (await autoRejectForStrikes(svc, userId)) return 'rejected_strikes';

   const sent = await sendBookedMessenger(stamped);
   if (!sent.ok) console.log('calcom-webhook: outside booking messenger skipped:', sent.reason);
   await tellTeam(
      svc,
      [
         `📅 ${who(u)} booked straight on Cal.com (not through the app)`,
         `When: ${formatCallTimeForTeam(booking.startsAt, (stamped as { video_call_timezone?: string | null }).video_call_timezone)}`,
         `Host: ${host ?? 'unknown — check Cal.com'}`,
         `Join: ${booking.joinUrl ?? 'no link on the booking'}`,
         sent.ok
            ? 'Sent them the booked message on Messenger. Reminders are on.'
            : `⚠️ Messenger message NOT sent (${'reason' in sent ? sent.reason : 'failed'}). Reminders are on.`
      ].join('\n'),
      [
         [await changeTimeLinkButton(u.id), cancelCallButton(u.id)],
         [openInAdminButton(u.id, u.username)],
         ...testAccountRow(u.id, u.is_test)
      ]
   );
   return 'adopted';
};
