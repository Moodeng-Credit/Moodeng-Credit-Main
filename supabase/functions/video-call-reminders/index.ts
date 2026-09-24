import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

import { zoomActiveForHost } from '../_shared/attendance.ts';
import { sendPushToUser } from '../_shared/pushDelivery.ts';
import type { PushLocale, PushPayload } from '../_shared/pushMessages.ts';
import { sendTelegramMessage, type TelegramInlineKeyboard } from '../_shared/telegram.ts';
import {
   buildConfirmUrl,
   formatCallTime,
   formatCallTimeForTeam,
   sendKeepSpotMessenger,
   sendReminderMessenger,
   sendStartingMessenger,
   sendWaitingMessenger
} from '../_shared/videoCall.ts';
import { autoMarkNoShow, closeReleasedCall, promptAdminsForAttendance } from '../_shared/videoCallOutcome.ts';
import { RUNG, type Rung, shouldReleaseSlot, skipsDayBeforeReminder, skipsKeepSpot, targetRung } from './lib.ts';

// Cron-driven (every 5 min) no-show defence for booked video calls. The full ladder — day-before,
// keep-your-spot, hour-before / slot release, starting now, we're waiting, admin prompt, auto
// no-show — and its timing rules live in ./lib.ts. Channels: web push, Telegram (when connected +
// account-activity on) and Messenger (SendPulse, only inside Meta's 24h window).
//
// verify_jwt stays on (no config.toml entry → project default), and the pg_cron job calls it with
// the service key, so only a valid project token reaches it. Never throws per-user: one borrower's
// failed send must not stop the rest of the batch.

const SUPABASE_URL = Deno.env.get('SUPABASE_URL') ?? '';
const SERVICE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '';
const SITE_URL = (Deno.env.get('VITE_SITE_URL') ?? Deno.env.get('MOODENG_APP_URL') ?? Deno.env.get('SITE_URL') ?? 'https://moodeng.app').replace(/\/$/, '');

const CORS = {
   'Access-Control-Allow-Origin': '*',
   'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type'
};
const json = (body: Record<string, unknown>, status = 200) =>
   new Response(JSON.stringify(body), { status, headers: { ...CORS, 'Content-Type': 'application/json' } });

// Don't dig up old calls (e.g. the first run after deploy) — the ladder ends an hour after the start.
const LOOKBACK_H = 6;

type ReminderUser = {
   id: string;
   username: string | null;
   chat_id: string | number | null;
   notif_account_activity: boolean | null;
   messenger_psid: string | null;
   video_call_host: string | null;
   video_call_starts_at: string;
   video_call_scheduled_at: string | null;
   video_call_timezone: string | null;
   video_call_join_url: string | null;
   video_call_booking_uid: string | null;
   video_call_meeting_id: string | null;
   video_call_arrived_at: string | null;
   video_call_confirm_token: string | null;
   video_call_confirmed_at: string | null;
   video_call_keep_spot_asked_at: string | null;
   video_call_reminder_stage: number | null;
   loan_access_status: string | null;
};

const COLUMNS =
   'id, username, chat_id, notif_account_activity, messenger_psid, video_call_host, video_call_starts_at, video_call_scheduled_at, video_call_timezone, video_call_join_url, video_call_booking_uid, video_call_meeting_id, video_call_arrived_at, video_call_confirm_token, video_call_confirmed_at, video_call_keep_spot_asked_at, video_call_reminder_stage, loan_access_status';

// deno-lint-ignore no-explicit-any
type Svc = any;

const push = async (svc: Svc, u: ReminderUser, title: string, body: string, url: string) => {
   try {
      const buildPayload = (_locale: PushLocale): PushPayload => ({
         type: 'video_call_reminder',
         title,
         body,
         url,
         tag: 'video-call-reminder',
         requireInteraction: true
      });
      await sendPushToUser(svc, u.id, buildPayload, { urgency: 'high' });
   } catch (err) {
      console.error('video-call-reminders: push failed for', u.id, err instanceof Error ? err.message : err);
   }
};

// Returns true only when Telegram actually accepted it.
const telegram = async (u: ReminderUser, text: string, inlineKeyboard?: TelegramInlineKeyboard): Promise<boolean> => {
   if (!u.chat_id || u.notif_account_activity === false) return false;
   try {
      await sendTelegramMessage(u.chat_id, text, inlineKeyboard ? { inlineKeyboard } : {});
      return true;
   } catch (err) {
      console.error('video-call-reminders: telegram failed for', u.id, err instanceof Error ? err.message : err);
      return false;
   }
};

const logMessenger = (u: ReminderUser, result: { ok: boolean; reason?: string }) => {
   if (!result.ok && result.reason !== 'no_contact') console.log('video-call-reminders: messenger skipped for', u.id, result.reason);
};

const joinButton = (u: ReminderUser): TelegramInlineKeyboard | undefined =>
   u.video_call_join_url ? [[{ text: '🎥 Join the call', url: u.video_call_join_url }]] : undefined;

// Cancel on Cal.com with the host's own key (the same keys calcom-round-robin books with).
const cancelCalBooking = async (host: string | null, uid: string): Promise<boolean> => {
   const apiKey = host ? Deno.env.get(`CALCOM_API_KEY_${host.toUpperCase()}`) : '';
   if (!apiKey) return false;
   try {
      const res = await fetch(`https://api.cal.com/v2/bookings/${encodeURIComponent(uid)}/cancel`, {
         method: 'POST',
         headers: { Authorization: `Bearer ${apiKey}`, 'cal-api-version': '2024-08-13', 'Content-Type': 'application/json' },
         body: JSON.stringify({ cancellationReason: 'Not confirmed — the slot was released so another borrower can book it.' })
      });
      return res.ok;
   } catch (err) {
      console.error('video-call-reminders: cal cancel failed', err instanceof Error ? err.message : err);
      return false;
   }
};

const BOOKING_FIELDS = ['video_call_scheduled_at', 'video_call_starts_at', 'video_call_host', 'video_call_booking_uid', 'video_call_join_url', 'video_call_meeting_id'] as const;

// Free an unconfirmed slot. Our booking fields are cleared *before* cancelling on Cal.com, so the
// cancel webhook that follows matches nothing (no second "your call was cancelled" message). If
// Cal.com refuses, the booking is restored and the borrower just gets the normal reminder.
const releaseSlot = async (svc: Svc, u: ReminderUser): Promise<boolean> => {
   const snapshot = Object.fromEntries(BOOKING_FIELDS.map((f) => [f, (u as unknown as Record<string, unknown>)[f] ?? null]));
   const cleared = Object.fromEntries(BOOKING_FIELDS.map((f) => [f, null]));
   const { data: claimed } = await svc
      .from('users')
      .update(cleared)
      .eq('id', u.id)
      .eq('video_call_booking_uid', u.video_call_booking_uid)
      .is('video_call_confirmed_at', null)
      .select('id')
      .maybeSingle();
   if (!claimed) return false; // confirmed or rebooked in the meantime

   if (!(await cancelCalBooking(u.video_call_host, u.video_call_booking_uid as string))) {
      await svc.from('users').update(snapshot).eq('id', u.id);
      return false;
   }
   await closeReleasedCall(svc, u.id, formatCallTimeForTeam(u.video_call_starts_at, u.video_call_timezone));
   return true;
};

const hourBefore = async (svc: Svc, u: ReminderUser) => {
   const at = formatCallTime(u.video_call_starts_at, u.video_call_timezone);
   const body = `Your quick video hello with the Moodeng team starts in under an hour: ${at}. Have your ID ready.`;
   await push(svc, u, 'Your Moodeng call is starting soon', body, u.video_call_join_url ?? `${SITE_URL}/request-board`);
   await telegram(u, `Your Moodeng call is starting soon\n\n${body}`, joinButton(u));
   logMessenger(u, await sendReminderMessenger(u, 2));
};

// Runs the one rung this booking just reached. Returns a short label for the response tally.
const runRung = async (svc: Svc, u: ReminderUser, rung: Rung, zoomActive: boolean): Promise<string | null> => {
   const startsAt = Date.parse(u.video_call_starts_at);
   const at = formatCallTime(u.video_call_starts_at, u.video_call_timezone);
   const zoomMissing = zoomActive && Boolean(u.video_call_meeting_id) && !u.video_call_arrived_at;

   switch (rung) {
      case RUNG.DAY: {
         if (skipsDayBeforeReminder(u.video_call_scheduled_at, startsAt)) return null;
         const body = `Your quick video hello with the Moodeng team is coming up: ${at}. Tap for the details and link.`;
         await push(svc, u, 'Reminder: your Moodeng video call', body, `${SITE_URL}/request-board`);
         await telegram(u, `Reminder: your Moodeng video call\n\n${body}`);
         logMessenger(u, await sendReminderMessenger(u, 1));
         return 'day';
      }
      case RUNG.KEEP_SPOT: {
         if (u.video_call_confirmed_at || skipsKeepSpot(u.video_call_scheduled_at, startsAt) || !u.video_call_confirm_token) return null;
         const confirmUrl = buildConfirmUrl(u.video_call_confirm_token);
         const body = `Still coming at ${at}? Tap to keep your spot — unconfirmed spots are released 1 hour before.`;
         await push(svc, u, 'Keep your Moodeng call?', body, confirmUrl);
         const viaTelegram = await telegram(u, `Keep your Moodeng call?\n\n${body}`, [[{ text: "✅ I'll be there", url: confirmUrl }]]);
         const viaMessenger = await sendKeepSpotMessenger(u);
         logMessenger(u, viaMessenger);
         // Only a message that verifiably landed makes the slot releasable later.
         if (viaMessenger.ok || viaTelegram) {
            await svc.from('users').update({ video_call_keep_spot_asked_at: new Date().toISOString() }).eq('id', u.id);
         }
         return 'keep_spot';
      }
      case RUNG.HOUR: {
         if (shouldReleaseSlot(u) && (await releaseSlot(svc, u))) return 'released';
         await hourBefore(svc, u);
         return 'hour';
      }
      case RUNG.STARTING: {
         if (u.video_call_arrived_at) return null;
         const body = `Your call is starting now — ${at}. Tap to join.`;
         await push(svc, u, 'Your Moodeng call is starting now 👋', body, u.video_call_join_url ?? `${SITE_URL}/request-board`);
         await telegram(u, `Your Moodeng call is starting now 👋\n\n${body}`, joinButton(u));
         logMessenger(u, await sendStartingMessenger(u));
         return 'starting';
      }
      case RUNG.WAITING: {
         // Only when Zoom can vouch they're not there — otherwise we'd nag someone already in the call.
         if (!zoomMissing) return null;
         await push(svc, u, "We're ready for you 🙂", 'Tap to join your Moodeng call now.', u.video_call_join_url ?? `${SITE_URL}/request-board`);
         await telegram(u, "We're ready for you 🙂\n\nTap to join your Moodeng call now. Can't make it? Reply on Messenger and we'll find a new time.", joinButton(u));
         logMessenger(u, await sendWaitingMessenger(u));
         return 'waiting';
      }
      case RUNG.PROMPT: {
         await promptAdminsForAttendance(svc, u.id);
         return 'prompt';
      }
      case RUNG.AUTO_NO_SHOW: {
         if (!zoomMissing) return null;
         return (await autoMarkNoShow(svc, u.id)) ? 'auto_no_show' : null;
      }
      default:
         return null;
   }
};

serve(async (req) => {
   if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS });
   if (!SUPABASE_URL || !SERVICE_KEY) {
      console.error('video-call-reminders: missing SUPABASE_URL / service key');
      return json({ error: 'not_configured' }, 500);
   }

   const svc = createClient(SUPABASE_URL, SERVICE_KEY);
   const now = Date.now();

   // Every booking from LOOKBACK_H ago to ~25h ahead that hasn't finished the ladder or been decided.
   const { data, error } = await svc
      .from('users')
      .select(COLUMNS)
      .not('video_call_starts_at', 'is', null)
      .gt('video_call_starts_at', new Date(now - LOOKBACK_H * 60 * 60 * 1000).toISOString())
      .lt('video_call_starts_at', new Date(now + 25 * 60 * 60 * 1000).toISOString())
      .lt('video_call_reminder_stage', RUNG.AUTO_NO_SHOW)
      .is('video_call_outcome', null);
   if (error) {
      console.error('video-call-reminders: query failed', error.message);
      return json({ error: 'query_failed' }, 500);
   }

   const zoomByHost = new Map<string, boolean>();
   const tally: Record<string, number> = {};
   const users = (data ?? []) as ReminderUser[];

   for (const u of users) {
      const startsAt = Date.parse(u.video_call_starts_at);
      if (Number.isNaN(startsAt)) continue;
      // Already rejected by an admin: no "starting now", no "did they show up?", no auto no-show.
      if (u.loan_access_status === 'rejected') continue;
      const rung = targetRung((startsAt - now) / 60000);
      if (rung <= (u.video_call_reminder_stage ?? 0)) continue;

      // Claim the rung first so an overlapping or slow tick can't send the same message twice.
      const { data: claimed } = await svc
         .from('users')
         .update({ video_call_reminder_stage: rung })
         .eq('id', u.id)
         .lt('video_call_reminder_stage', rung)
         .select('id')
         .maybeSingle();
      if (!claimed) continue;

      const host = u.video_call_host ?? '';
      if (!zoomByHost.has(host)) zoomByHost.set(host, await zoomActiveForHost(svc, host));
      try {
         const label = await runRung(svc, u, rung, zoomByHost.get(host) ?? false);
         if (label) tally[label] = (tally[label] ?? 0) + 1;
      } catch (err) {
         console.error('video-call-reminders: rung', rung, 'failed for', u.id, err instanceof Error ? err.message : err);
      }
   }

   return json({ ok: true, scanned: users.length, ...tally });
});
