import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

import { sendPushToUser } from '../_shared/pushDelivery.ts';
import type { PushLocale, PushPayload } from '../_shared/pushMessages.ts';
import { sendTelegramMessage } from '../_shared/telegram.ts';

// Cron-driven (every 15 min) reminders for booked video calls, so borrowers actually show up.
// Two rungs per booking, deduped by users.video_call_reminder_stage (0 none, 1 day-before,
// 2 hour-before): a "tomorrow" nudge inside 24h, and a "starting soon" nudge inside ~1h. Delivered
// over web push (they subscribed) and Telegram (when connected + account-activity notifications on).
//
// verify_jwt stays on (no config.toml entry → project default), and the pg_cron job calls it with
// the service key, so only a valid project token reaches it. Never throws per-user: one borrower's
// failed push must not stop the rest of the batch.

const SUPABASE_URL = Deno.env.get('SUPABASE_URL') ?? '';
const SERVICE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '';
const SITE_URL = (Deno.env.get('VITE_SITE_URL') ?? Deno.env.get('SITE_URL') ?? 'https://app.moodeng.credit').replace(/\/$/, '');

const CORS = {
   'Access-Control-Allow-Origin': '*',
   'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type'
};
const json = (body: Record<string, unknown>, status = 200) =>
   new Response(JSON.stringify(body), { status, headers: { ...CORS, 'Content-Type': 'application/json' } });

const DAY_MINUTES = 24 * 60;
// Slightly above the 15-min cron interval + the 60-min target, so a call ~1h out is caught on the
// tick before it, never skipped between ticks.
const SOON_MINUTES = 70;

type ReminderUser = {
   id: string;
   username: string | null;
   chat_id: string | number | null;
   notif_account_activity: boolean | null;
   video_call_starts_at: string;
   video_call_reminder_stage: number | null;
};

serve(async (req) => {
   if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS });
   if (!SUPABASE_URL || !SERVICE_KEY) {
      console.error('video-call-reminders: missing SUPABASE_URL / service key');
      return json({ error: 'not_configured' }, 500);
   }

   const svc = createClient(SUPABASE_URL, SERVICE_KEY);
   const now = Date.now();
   const nowIso = new Date(now).toISOString();
   const horizonIso = new Date(now + 25 * 60 * 60 * 1000).toISOString();

   // Only future calls within the next ~25h that haven't had the final reminder yet.
   const { data, error } = await svc
      .from('users')
      .select('id, username, chat_id, notif_account_activity, video_call_starts_at, video_call_reminder_stage')
      .not('video_call_starts_at', 'is', null)
      .gt('video_call_starts_at', nowIso)
      .lt('video_call_starts_at', horizonIso)
      .lt('video_call_reminder_stage', 2);

   if (error) {
      console.error('video-call-reminders: query failed', error.message);
      return json({ error: 'query_failed' }, 500);
   }

   const users = (data ?? []) as ReminderUser[];
   let sent = 0;

   for (const u of users) {
      const startsAt = Date.parse(u.video_call_starts_at);
      if (Number.isNaN(startsAt)) continue;
      const minutesUntil = (startsAt - now) / 60000;
      const stage = u.video_call_reminder_stage ?? 0;

      // Highest rung this booking now qualifies for; skip if we've already sent it (or a later one).
      const targetStage = minutesUntil <= SOON_MINUTES ? 2 : minutesUntil <= DAY_MINUTES ? 1 : 0;
      if (targetStage <= stage) continue;

      const soon = targetStage === 2;
      const title = soon ? 'Your Moodeng call is starting soon' : 'Reminder: your Moodeng video call';
      const when = soon ? 'in under an hour' : 'coming up in the next day';
      const body = `Your quick video hello with the Moodeng team is ${when}. Tap for the details and link.`;
      const url = `${SITE_URL}/request-board`;

      // Web push — borrowers opt in by subscribing, so a booked call is fair game to remind on.
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

      // Telegram — only when connected and account-activity notifications aren't switched off.
      if (u.chat_id && u.notif_account_activity !== false) {
         try {
            await sendTelegramMessage(u.chat_id, `${title}\n\n${body}`);
         } catch (err) {
            console.error('video-call-reminders: telegram failed for', u.id, err instanceof Error ? err.message : err);
         }
      }

      const { error: updateError } = await svc.from('users').update({ video_call_reminder_stage: targetStage }).eq('id', u.id);
      if (updateError) {
         console.error('video-call-reminders: stage update failed for', u.id, updateError.message);
         continue;
      }
      sent++;
   }

   return json({ ok: true, scanned: users.length, sent });
});
