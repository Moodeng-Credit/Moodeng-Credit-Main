import { FB_STEPS_CARD, FB_STEPS_TELEGRAM_KEYBOARD, FB_STEPS_TEXT, fbStepsStaleBefore } from './facebookSteps.ts';
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
