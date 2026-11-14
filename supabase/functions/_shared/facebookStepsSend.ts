import {
   FB_CATCHUP_AFTER_MS,
   FB_CATCHUP_BEFORE_MS,
   FB_STEPS_CARD,
   FB_STEPS_TELEGRAM_KEYBOARD,
   FB_STEPS_TEXT,
   fbStepsCatchUpReason,
   fbStepsStaleBefore
} from './facebookSteps.ts';
import { isIdTrackUser } from './idTrack.ts';
import { sendMessengerMessage } from './sendpulse.ts';
import { sendTelegramMessage } from './telegram.ts';

// deno-lint-ignore no-explicit-any
type Svc = any;

type StepsUser = {
   id: string;
   messenger_psid: string | null;
   chat_id: string | number | null;
   video_call_starts_at: string | null;
};

export type FbStepsResult = { ok: true; channel: 'messenger' | 'telegram' } | { ok: false; reason: string };

// Sends the "add Emma + join the group" message: Messenger first (the borrower tapped ✅ within the
// hour, so Meta's 24h window is open), Telegram when Messenger can't reach them.
//   force: false → automatic (zoom-webhook, the moment Zoom first sees the borrower): once per call,
//                  claimed in the database first so Zoom's retries or waiting-room + joined events
//                  can't send it twice. Indonesia-track borrowers are skipped (their flow is Bahasa,
//                  on Telegram, and has its own contact steps).
//   force: true  → the host's "Send Facebook steps" button on the call sheet: always sends.
export const sendFacebookSteps = async (svc: Svc, u: StepsUser, opts: { force: boolean }): Promise<FbStepsResult> => {
   const nowIso = new Date().toISOString();
   if (!opts.force) {
      if (await isIdTrackUser(svc, u.id)) return { ok: false, reason: 'id_track' };
      const { data: claimed, error } = await svc
         .from('users')
         .update({ video_call_fb_steps_sent_at: nowIso })
         .eq('id', u.id)
         .or(`video_call_fb_steps_sent_at.is.null,video_call_fb_steps_sent_at.lt.${fbStepsStaleBefore(u.video_call_starts_at)}`)
         .select('id')
         .maybeSingle();
      if (error) return { ok: false, reason: 'claim_failed' };
      if (!claimed) return { ok: false, reason: 'already_sent' };
   }

   let result: FbStepsResult = { ok: false, reason: 'no_channel' };
   const messenger = await sendMessengerMessage(u.messenger_psid, { text: FB_STEPS_TEXT, card: FB_STEPS_CARD });
   if (messenger.ok) result = { ok: true, channel: 'messenger' };
   else if (u.chat_id) {
      try {
         await sendTelegramMessage(u.chat_id, FB_STEPS_TEXT, { inlineKeyboard: FB_STEPS_TELEGRAM_KEYBOARD });
         result = { ok: true, channel: 'telegram' };
      } catch (err) {
         console.error('facebook-steps: telegram failed for', u.id, err instanceof Error ? err.message : err);
         result = { ok: false, reason: 'send_failed' };
      }
   } else result = { ok: false, reason: messenger.reason };

   // Record a forced send; give back an automatic claim that reached nobody so the button shows "not sent".
   if (result.ok && opts.force) await svc.from('users').update({ video_call_fb_steps_sent_at: nowIso }).eq('id', u.id);
   if (!result.ok && !opts.force) await svc.from('users').update({ video_call_fb_steps_sent_at: null }).eq('id', u.id).eq('video_call_fb_steps_sent_at', nowIso);
   console.log(`facebook-steps: ${u.id.slice(0, 8)} ${opts.force ? 'button' : 'auto'} → ${result.ok ? result.channel : result.reason}`);
   return result;
};

type CatchUpRow = StepsUser & {
   video_call_outcome: string | null;
   video_call_arrived_at: string | null;
   video_call_joined_at: string | null;
   video_call_fb_steps_sent_at: string | null;
};

// The 5-minute safety net (video-call-reminders): finds calls that are on, where the borrower looks
// present and the links never went out (fbStepsCatchUpReason), and sends them. Uses the same once-per-
// call claim as the Zoom trigger, so the two can't double up. Returns how many it sent; never throws.
export const runFacebookStepsCatchUp = async (svc: Svc, now = Date.now()): Promise<number> => {
   try {
      const { data, error } = await svc
         .from('users')
         .select('id, messenger_psid, chat_id, video_call_starts_at, video_call_outcome, video_call_arrived_at, video_call_joined_at, video_call_fb_steps_sent_at')
         .not('video_call_booking_uid', 'is', null)
         .gt('video_call_starts_at', new Date(now - FB_CATCHUP_AFTER_MS).toISOString())
         .lt('video_call_starts_at', new Date(now + FB_CATCHUP_BEFORE_MS).toISOString())
         .limit(50);
      if (error) {
         console.error('facebook-steps: catch-up query failed', error.message);
         return 0;
      }
      const calls = (data ?? []) as CatchUpRow[];
      if (!calls.length) return 0;

      const { data: sheets } = await svc
         .from('call_screenings')
         .select('user_id, call_starts_at, updated_at')
         .in('user_id', calls.map((c) => c.id))
         .gt('updated_at', new Date(now - FB_CATCHUP_AFTER_MS - 60 * 60 * 1000).toISOString());
      const sheetFor = (c: CatchUpRow): string | null => {
         const start = c.video_call_starts_at ? Date.parse(c.video_call_starts_at) : NaN;
         const row = ((sheets ?? []) as Array<{ user_id: string; call_starts_at: string | null; updated_at: string }>).find(
            (s) => s.user_id === c.id && s.call_starts_at !== null && Date.parse(s.call_starts_at) === start
         );
         return row?.updated_at ?? null;
      };

      let sent = 0;
      for (const c of calls) {
         const reason = fbStepsCatchUpReason(
            {
               startsAt: c.video_call_starts_at,
               sentAt: c.video_call_fb_steps_sent_at,
               outcome: c.video_call_outcome,
               arrivedAt: c.video_call_arrived_at,
               joinedAt: c.video_call_joined_at,
               sheetUpdatedAt: sheetFor(c)
            },
            now
         );
         if (!reason) continue;
         const result = await sendFacebookSteps(svc, c, { force: false });
         console.log(`facebook-steps: catch-up (${reason}) ${c.id.slice(0, 8)} → ${result.ok ? result.channel : result.reason}`);
         if (result.ok) sent += 1;
      }
      return sent;
   } catch (err) {
      console.error('facebook-steps: catch-up threw', err instanceof Error ? err.message : err);
      return 0;
   }
};
