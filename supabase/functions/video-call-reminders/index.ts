import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

import { zoomActiveForHost } from '../_shared/attendance.ts';
import { sendPushToUser } from '../_shared/pushDelivery.ts';
import type { PushLocale, PushPayload } from '../_shared/pushMessages.ts';
import { sendTelegramMessage, type TelegramInlineKeyboard } from '../_shared/telegram.ts';
import { testAccountRow } from '../_shared/testAccount.ts';
import {
   buildConfirmUrl,
   formatCallTime,
   formatCallTimeForTeam,
   sendConfirmAskMessenger,
   sendReminderMessenger,
   sendStartingMessenger,
   sendWaitingMessenger
} from '../_shared/videoCall.ts';
import { autoMarkNoShow, closeReleasedCall, promptAdminsForAttendance } from '../_shared/videoCallOutcome.ts';
import { buildCallConfirmTemplate, CALL_CONFIRM_WHATSAPP_SETTING_KEY, CONFIRM_CLOSES_MIN, RUNG, type Rung, shouldReleaseSlot, skipsConfirmAsk, skipsDayBeforeReminder, targetRung } from './lib.ts';
import { cancelCalBooking } from '../_shared/calcomCancel.ts';
import { cancelCallButton } from '../_shared/callCancel.ts';
import { isInternalRequest } from '../_shared/internalAuth.ts';
import { postDiscord } from '../_shared/discord.ts';
import { getTelegramBotSettingEnabled } from '../_shared/borrowerNotificationDelivery.ts';
import { sendWhatsAppTemplate } from '../_shared/sendpulse.ts';
import { nudgeStalledChats } from '../_shared/messengerBookingBot.ts';
import { runFacebookStepsCatchUp } from '../_shared/facebookStepsSend.ts';
import { type IdEvent, type IdEventData, isIdTrackUser, runIdOnboardingNudges, sendIdTelegram } from '../_shared/idTrack.ts';
import { runAutoPayouts, runWaltPayoutScan } from '../_shared/idManualFunding.ts';
import { runWaltWatch } from '../_shared/waltWatch.ts';
import { runVaultBridges, runVaultPaybackDigest } from '../_shared/idVaultBridge.ts';
import { runIdrRepricing } from '../_shared/fxRates.ts';
import { runIdRepayNudges, runIdRepayments, runWaltArrivedDigest } from '../_shared/idRepayments.ts';
import { runIdWaBridgeNudges } from '../_shared/idWaBridge.ts';
import { runWaltTransferPayoutCards } from '../_shared/idWaltPayouts.ts';

// Cron-driven (every 5 min) no-show defence for booked video calls. The full ladder — day-before,
// confirm-or-cancel (1h before) / cancel unconfirmed (30 min before), starting now, we're waiting, admin prompt, auto
// no-show — and its timing rules live in ./lib.ts. Channels: web push, Telegram (when connected +
// account-activity on), Messenger (SendPulse, only inside Meta's 24h window) and, for the 1h ✅ ask
// only, a WhatsApp template when Messenger can't reach them.
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
   whatsapp_contact_id: string | null;
   display_name: string | null;
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
   'id, username, chat_id, notif_account_activity, messenger_psid, whatsapp_contact_id, display_name, video_call_host, video_call_starts_at, video_call_scheduled_at, video_call_timezone, video_call_join_url, video_call_booking_uid, video_call_meeting_id, video_call_arrived_at, video_call_confirm_token, video_call_confirmed_at, video_call_keep_spot_asked_at, video_call_reminder_stage, loan_access_status';

// deno-lint-ignore no-explicit-any
type Svc = any;

// Returns true when at least one device accepted it.
const push = async (svc: Svc, u: ReminderUser, title: string, body: string, url: string): Promise<boolean> => {
   try {
      const buildPayload = (_locale: PushLocale): PushPayload => ({
         type: 'video_call_reminder',
         title,
         body,
         url,
         tag: 'video-call-reminder',
         requireInteraction: true
      });
      return (await sendPushToUser(svc, u.id, buildPayload, { urgency: 'high' })).sent > 0;
   } catch (err) {
      console.error('video-call-reminders: push failed for', u.id, err instanceof Error ? err.message : err);
      return false;
   }
};

// Returns true only when Telegram actually accepted it. Indonesia track (market 'ID'): the Bahasa
// version (idTrack.ts) instead, always — Telegram is their one channel.
const telegram = async (
   u: ReminderUser,
   text: string,
   inlineKeyboard?: TelegramInlineKeyboard,
   id?: { svc: Svc; event: IdEvent; data?: IdEventData }
): Promise<boolean> => {
   if (id && (await isIdTrackUser(id.svc, u.id))) return await sendIdTelegram(id.svc, u.id, id.event, id.data);
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

const cancelSlot = (host: string | null, uid: string) =>
   cancelCalBooking(host, uid, 'Not confirmed in the hour before — the call was cancelled and the slot released.');

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

   if (!(await cancelSlot(u.video_call_host, u.video_call_booking_uid as string))) {
      await svc.from('users').update(snapshot).eq('id', u.id);
      return false;
   }
   await closeReleasedCall(svc, u.id, formatCallTimeForTeam(u.video_call_starts_at, u.video_call_timezone));
   return true;
};

// The 1-hour text (UniSMS, PH numbers on file; see 20261111220000_call_sms_reminders.sql). True when it went out.
const callSms = async (svc: Svc, u: ReminderUser, kind: 'confirm' | 'hour'): Promise<boolean> => {
   try {
      const { data, error } = await svc.rpc('call_sms_remind', { p_user: u.id, p_kind: kind });
      if (error) throw new Error(error.message);
      if (data !== 'no_number' && data !== 'off') console.log('video-call-reminders: text reminder for', u.id, kind, data);
      return data === 'sent' || data === 'unconfirmed';
   } catch (err) {
      console.error('video-call-reminders: text reminder failed for', u.id, err instanceof Error ? err.message : err);
      return false;
   }
};

const hourBefore = async (svc: Svc, u: ReminderUser) => {
   const at = formatCallTime(u.video_call_starts_at, u.video_call_timezone);
   const body = `Your quick video hello with the Moodeng team starts in under an hour: ${at}. Have your ID ready and video on.`;
   await push(svc, u, 'Your Moodeng call is starting soon', body, u.video_call_join_url ?? `${SITE_URL}/request-board`);
   await telegram(u, `Your Moodeng call is starting soon\n\n${body}`, joinButton(u), {
      svc,
      event: 'call_hour',
      data: { callAt: u.video_call_starts_at, joinUrl: u.video_call_join_url }
   });
   logMessenger(u, await sendReminderMessenger(u, 2));
   await callSms(svc, u, 'hour');
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
         await telegram(u, `Reminder: your Moodeng video call\n\n${body}`, undefined, {
            svc,
            event: 'call_reminder_day',
            data: { callAt: u.video_call_starts_at, joinUrl: u.video_call_join_url }
         });
         logMessenger(u, await sendReminderMessenger(u, 1));
         return 'day';
      }
      case RUNG.CONFIRM: {
         // Already confirmed, or booked so late the booking counts as the confirmation: plain reminder.
         if (u.video_call_confirmed_at || skipsConfirmAsk(u.video_call_scheduled_at, startsAt) || !u.video_call_confirm_token) {
            await hourBefore(svc, u);
            return 'hour';
         }
         const confirmUrl = buildConfirmUrl(u.video_call_confirm_token);
         const body = `Your call is in 1 hour — ${at}. Bring your original ID and turn on video. Tap ✅ I'll be there within ${60 - CONFIRM_CLOSES_MIN} minutes, or the call is cancelled automatically.`;
         const viaPush = await push(svc, u, 'Confirm your Moodeng call ✅', body, confirmUrl);
         const viaTelegram = await telegram(u, `Confirm your Moodeng call ✅\n\n${body}`, [[{ text: "✅ I'll be there", url: confirmUrl }]], {
            svc,
            event: 'call_confirm',
            data: { callAt: u.video_call_starts_at, confirmUrl }
         });
         const viaMessenger = await sendConfirmAskMessenger(u);
         logMessenger(u, viaMessenger);
         // Messenger couldn't reach them (outside its 24h window): the approved WhatsApp template, if
         // they connected WhatsApp and the switch is on.
         let viaWhatsApp = false;
         if (!viaMessenger.ok && u.whatsapp_contact_id && (await getTelegramBotSettingEnabled(svc, CALL_CONFIRM_WHATSAPP_SETTING_KEY).catch(() => false))) {
            const firstName = (u.display_name ?? '').trim().split(/\s+/)[0] || u.username;
            const sent = await sendWhatsAppTemplate(u.whatsapp_contact_id, buildCallConfirmTemplate(firstName, at, u.video_call_confirm_token));
            viaWhatsApp = sent.ok;
            console.log('video-call-reminders: whatsapp confirm for', u.id, sent.ok ? 'sent' : `not sent (${sent.reason})`);
         }
         // The call is cancellable at the deadline even when the ask reached them nowhere (George,
         // 2026-11-02): they were told at booking that an unconfirmed call is cancelled, they can still
         // confirm in the app, and an unreachable borrower who kept the slot didn't come (Oct 29).
         const viaSms = await callSms(svc, u, 'confirm');
         const landed = viaMessenger.ok || viaWhatsApp || viaTelegram || viaPush || viaSms;
         if (!landed) console.log('video-call-reminders: confirm ask reached no channel for', u.id, '— cancelled at the deadline unless they confirm in the app');
         await svc.from('users').update({ video_call_keep_spot_asked_at: new Date().toISOString() }).eq('id', u.id);
         return landed ? 'confirm_ask' : 'confirm_ask_unreached';
      }
      case RUNG.RELEASE: {
         if (shouldReleaseSlot(u) && (await releaseSlot(svc, u))) return 'released';
         return null;
      }
      case RUNG.STARTING: {
         // The admins' Showed up / No-show card goes out now, not 20 min in, so a borrower can be
         // approved the moment the call ends. Best-effort: it must never block the borrower's ping.
         await promptAdminsForAttendance(svc, u.id, { starting: true }).catch((err) =>
            console.error('video-call-reminders: early attendance card failed for', u.id, err instanceof Error ? err.message : err)
         );
         if (u.video_call_arrived_at) return 'starting';
         const body = `Your call is starting now — ${at}. Tap to join.`;
         await push(svc, u, 'Your Moodeng call is starting now 👋', body, u.video_call_join_url ?? `${SITE_URL}/request-board`);
         await telegram(u, `Your Moodeng call is starting now 👋\n\n${body}`, joinButton(u), {
            svc,
            event: 'call_starting',
            data: { joinUrl: u.video_call_join_url }
         });
         logMessenger(u, await sendStartingMessenger(u));
         return 'starting';
      }
      case RUNG.WAITING: {
         // Only when Zoom can vouch they're not there — otherwise we'd nag someone already in the call.
         if (!zoomMissing) return null;
         await push(svc, u, "We're ready for you 🙂", 'Tap to join your Moodeng call now.', u.video_call_join_url ?? `${SITE_URL}/request-board`);
         await telegram(u, "We're ready for you 🙂\n\nTap to join your Moodeng call now. Can't make it? Reply on Messenger and we'll find a new time.", joinButton(u), {
            svc,
            event: 'call_waiting',
            data: { joinUrl: u.video_call_join_url }
         });
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
   if (!(await isInternalRequest(svc, req))) return json({ error: 'unauthorized' }, 401);
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

   tally.sheet_alerts = await alertCallSheets(svc, now);
   // Messenger booking chats that stopped partway a few hours ago: one nudge each (no new function: free-plan cap).
   tally.booking_nudges = await nudgeStalledChats(svc);
   // Safety net for the on-call Facebook steps: borrower is there, links never went out → send now.
   tally.fb_steps_catchup = await runFacebookStepsCatchUp(svc, now);
   // Indonesia track: stalled onboarding → a Telegram nudge (max 3, one per 24h; idTrack.ts). This job
   // runs every 5 min, so the pass only runs in the first tick of each hour.
   if (new Date(now).getUTCMinutes() < 5) tally.id_nudges = await runIdOnboardingNudges(svc, now);
   // Indonesia: people who started on WhatsApp and haven't reached Telegram / tapped the sign-up button.
   const bridgeNudges = await runIdWaBridgeNudges(svc, now);
   tally.id_bridge_wa_nudges = bridgeNudges.whatsapp;
   tally.id_bridge_tg_nudges = bridgeNudges.telegram;
   // Indonesia track, one shared budget of ≤ 90 s (deadlines passed down; every Openfort call times out
   // at 20 s and no send starts with < 30 s left). Money first: the payout wallet (settle payments in
   // flight, BNB Chain checks on failed ones, new payouts when /idautopay is on), then the hand-payout
   // scan, then the rupiah repricing. None of them throw.
   const idStart = Date.now();
   const idDeadline = idStart + 90_000;
   try {
      const auto = await runAutoPayouts(svc, now, idStart + 50_000);
      tally.walt_auto_settled = auto.settled;
      tally.walt_auto_funded = auto.funded;
      tally.walt_auto_sent = auto.sent;
      tally.walt_auto_failed = auto.failed;
      tally.walt_auto_chain_checked = auto.chainChecked;
   } catch (err) {
      console.error('video-call-reminders: auto payouts failed', err);
   }
   // Walt watch: Moodeng's Walt history (read-only) confirms Walt Transfer payouts and repayments by itself.
   try {
      const w = await runWaltWatch(svc, Math.min(idDeadline, Date.now() + 30_000));
      tally.walt_watch_seen = w.seen;
      tally.walt_watch_acted = w.acted;
      if (w.error) console.error('video-call-reminders: walt watch', w.error);
   } catch (err) {
      console.error('video-call-reminders: walt watch failed', err);
   }
   // Vault-funded loans bridging Base → BNB Chain (LI.FI), and repayments going back (/idvault).
   try {
      tally.vault_bridges = await runVaultBridges(svc, Math.min(idDeadline, Date.now() + 45_000));
   } catch (err) {
      console.error('video-call-reminders: vault bridges failed', err);
   }
   // Mondays 09:00 Bangkok: what the vault is still owed for repaid Indonesian loans, and how to pay it.
   try {
      tally.vault_payback_card = (await runVaultPaybackDigest(svc, now)) ? 1 : 0;
   } catch (err) {
      console.error('video-call-reminders: vault payback card failed', err);
   }
   // Walt Transfer mode (the default): one "send X USDT to @user" card per open request for the team.
   try {
      const cards = await runWaltTransferPayoutCards(svc, now, Math.max(Date.now() + 10_000, idDeadline - 40_000));
      tally.walt_payout_cards = cards.cards;
      tally.walt_username_asked = cards.askedUsername;
      tally.walt_payout_reminded = cards.reminded;
   } catch (err) {
      console.error('video-call-reminders: Walt payout cards failed', err);
   }
   // Loans paid by hand from Binance TH to Walt — confirm them on BNB Chain.
   const walt = await runWaltPayoutScan(svc, now, Math.max(Date.now(), idDeadline - 15_000));
   tally.walt_payouts_checked = walt.checked;
   tally.walt_payouts_found = walt.found;
   tally.walt_payouts_alerted = walt.alerted;
   // Repayments sent from Walt straight to the payout wallet (bot 💰 Bayar / app): find + record them.
   try {
      const repay = await runIdRepayments(svc, Math.max(Date.now() + 20_000, idDeadline - 5_000));
      tally.walt_repay_seen = repay.seen;
      tally.walt_repay_recorded = repay.recorded + repay.resumed;
      tally.walt_repay_unmatched = repay.unmatched;
      tally.walt_repay_nudged = await runIdRepayNudges(svc, now);
   } catch (err) {
      console.error('video-call-reminders: wallet repayments failed', err);
   }
   // 20:00 Bangkok: one "✅ All arrived" card for every Walt repayment still waiting for a tap.
   try {
      tally.walt_arrived_digest = (await runWaltArrivedDigest(svc, now)) ? 1 : 0;
   } catch (err) {
      console.error('video-call-reminders: arrived digest failed', err);
   }
   // Rupiah peg — refresh USD/IDR (stored at most every 6h; ID requests are refused while no rate under
   // 36h old exists) and re-price open ID loans; team ping on a >5% move.
   try {
      await runIdrRepricing(svc, idDeadline);
   } catch (err) {
      console.error('video-call-reminders: IDR repricing failed', err);
   }
   return json({ ok: true, scanned: users.length, ...tally });
});

// ~15 minutes before each onboarding call: "open the call sheet" to Alerts Moodeng HQ (the Telegram team
// group, telegram_bot_settings.team_group_chat_id) and Discord #bookings, with buttons to the call
// sheet (admin → Call approvals, opened on this borrower) and the Zoom. Once per booked start time
// (users.video_call_sheet_alerted_for), so a rebooked call gets a fresh one.
const SHEET_ALERT_BEFORE_MIN = 20;
// deno-lint-ignore no-explicit-any
const alertCallSheets = async (svc: any, now: number): Promise<number> => {
   const { data } = await svc
      .from('users')
      .select('id, username, display_name, video_call_host, video_call_starts_at, video_call_timezone, video_call_join_url, video_call_sheet_alerted_for, is_test')
      .gt('video_call_starts_at', new Date(now - 10 * 60 * 1000).toISOString())
      .lt('video_call_starts_at', new Date(now + SHEET_ALERT_BEFORE_MIN * 60 * 1000).toISOString())
      .is('video_call_outcome', null)
      .neq('loan_access_status', 'rejected');
   const rows = (data ?? []) as Array<{
      id: string;
      username: string | null;
      display_name: string | null;
      video_call_host: string | null;
      video_call_starts_at: string;
      video_call_timezone: string | null;
      video_call_join_url: string | null;
      video_call_sheet_alerted_for: string | null;
      is_test: boolean | null;
   }>;
   const { data: chatRow } = await svc.from('telegram_bot_settings').select('value').eq('key', 'team_group_chat_id').maybeSingle();
   const chatId = (chatRow?.value as string | undefined) ?? Deno.env.get('TEAM_TELEGRAM_CHAT_ID');
   let sent = 0;
   for (const u of rows) {
      if (u.video_call_sheet_alerted_for && Date.parse(u.video_call_sheet_alerted_for) === Date.parse(u.video_call_starts_at)) continue;
      // Claim it first so two overlapping ticks can't both post.
      const { data: claimed } = await svc
         .from('users')
         .update({ video_call_sheet_alerted_for: u.video_call_starts_at, video_call_sheet_alerted_at: new Date().toISOString() })
         .eq('id', u.id)
         .or(`video_call_sheet_alerted_for.is.null,video_call_sheet_alerted_for.neq.${u.video_call_starts_at}`)
         .select('id')
         .maybeSingle();
      if (!claimed) continue;

      const name = [u.display_name, u.username ? `@${u.username}` : null].filter(Boolean).join(' · ') || 'a borrower';
      const minutes = Math.max(0, Math.round((Date.parse(u.video_call_starts_at) - now) / 60000));
      const host = u.video_call_host ? ` · with ${u.video_call_host[0].toUpperCase()}${u.video_call_host.slice(1)}` : '';
      const sheetUrl = `${SITE_URL}/admin/calls?sheet=${u.id}`;
      const text = `📋 Call ${minutes > 0 ? `in ${minutes} min` : 'starting now'} — ${name}\n${formatCallTimeForTeam(u.video_call_starts_at, u.video_call_timezone)}${host}\n\nOpen the call sheet before you join and fill it in during the call.`;
      const keyboard: TelegramInlineKeyboard = [
         [{ text: '📋 Open call sheet', url: sheetUrl }],
         ...(u.video_call_join_url ? [[{ text: '🎥 Join Zoom', url: u.video_call_join_url }]] : []),
         [cancelCallButton(u.id)],
         ...testAccountRow(u.id, u.is_test)
      ];
      if (chatId) {
         await sendTelegramMessage(chatId, text, { inlineKeyboard: keyboard }).catch((err) =>
            console.error('video-call-reminders: sheet alert Telegram failed', err instanceof Error ? err.message : err)
         );
      }
      await postDiscord(
         { content: `${text}\n📋 Call sheet: <${sheetUrl}>${u.video_call_join_url ? `\n🎥 Zoom: <${u.video_call_join_url}>` : ''}` },
         { prefer: ['DISCORD_BOOKINGS_WEBHOOK_URL'] }
      );
      sent += 1;
   }
   return sent;
};
