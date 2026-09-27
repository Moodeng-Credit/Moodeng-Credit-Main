import { postDiscord } from './discord.ts';
import { sendEmail } from './email.ts';
import { sendPushToUser } from './pushDelivery.ts';
import { buildVerificationDecisionPushPayload, type PushLocale } from './pushMessages.ts';
import { sendMessengerMessage } from './sendpulse.ts';
import { sendTelegramMessage } from './telegram.ts';

// Didit outcome notifications, shared by didit-webhook (push) and check-didit-status
// (pull sync). Both paths can discover the same status change — a webhook can arrive
// late after the sync already told the user — so every send goes through
// claimDiditNotification first: an atomic compare-and-set on users.didit_notify_marker
// keyed "<session_id>:<outcome>". Whichever path claims the marker sends; the loser
// skips. A new outcome for the same session (review -> approved) is a new marker, so
// follow-up notifications still go out.

// deno-lint-ignore no-explicit-any
type AdminSupabase = any;

/**
 * Atomically claim the right to notify about this session outcome (a normalized status
 * key like 'approved', 'review', 'declined', 'abandoned', 'duplicate'). Returns true
 * when this caller won the claim (row updated), false when someone already claimed it.
 * Concurrent claims are safe: the second UPDATE waits on the row lock and re-evaluates
 * the WHERE against the committed marker, matching zero rows.
 */
export const claimDiditNotification = async (
   adminSupabase: AdminSupabase,
   userId: string,
   outcome: string,
   sessionId?: string
): Promise<boolean> => {
   const marker = `${sessionId ?? 'unknown'}:${outcome}`;
   try {
      const { data, error } = await adminSupabase
         .from('users')
         .update({ didit_notify_marker: marker })
         .eq('id', userId)
         .not('didit_notify_marker', 'is', null)
         .neq('didit_notify_marker', marker)
         .select('id');
      if (error) throw error;
      if (Array.isArray(data) && data.length > 0) return true;

      // Marker was NULL (never notified) — .neq() doesn't match NULL, so claim it here.
      const { data: nullClaim, error: nullError } = await adminSupabase
         .from('users')
         .update({ didit_notify_marker: marker })
         .eq('id', userId)
         .is('didit_notify_marker', null)
         .select('id');
      if (nullError) throw nullError;
      return Array.isArray(nullClaim) && nullClaim.length > 0;
   } catch (err) {
      console.error('[diditNotifications] Claim failed:', err instanceof Error ? err.message : err);
      // Fail open for the webhook-only world's behavior: better a rare duplicate
      // notification than a silently missing one.
      return true;
   }
};

// Fire-and-forget Telegram alert so the team hears about KYC outcomes (especially
// manual reviews, which otherwise sit invisible until the user complains).
// Destination = telegram_bot_settings key 'kyc_alert_chat_id'; no-ops when unset.
// Never throws — an alert failure must not fail the caller.
export const notifyAdmins = async (
   adminSupabase: AdminSupabase,
   userId: string,
   outcome: string,
   sessionId?: string
) => {
   try {
      const { data: setting } = await adminSupabase
         .from('telegram_bot_settings')
         .select('value')
         .eq('key', 'kyc_alert_chat_id')
         .maybeSingle();
      const chatId = (setting as { value?: string } | null)?.value?.trim();

      const { data: profile } = await adminSupabase
         .from('users')
         .select('email, username')
         .eq('id', userId)
         .maybeSingle();
      const p = profile as { email?: string; username?: string } | null;
      const who = [p?.username, p?.email].filter(Boolean).join(' · ') || userId;

      // Telegram (kyc_alert_chat_id) and Discord are independent best-effort channels: a missing
      // chat id or a failed Telegram send must not stop the Discord alert, and vice-versa.
      if (chatId) {
         await sendTelegramMessage(
            chatId,
            `🪪 Didit KYC — ${outcome}\nUser: ${who}\nUser ID: ${userId}${sessionId ? `\nSession: ${sessionId}` : ''}`
         ).catch((err: unknown) => console.error('[diditNotifications] Telegram admin alert failed:', err instanceof Error ? err.message : err));
      }

      const outcomeColor: Record<string, number> = {
         approved: 0x2ecc71,
         review: 0xf1c40f,
         declined: 0xe74c3c,
         abandoned: 0x95a5a6,
         duplicate: 0xe67e22
      };
      await postDiscord(
         {
            embeds: [
               {
                  title: `🪪 Didit KYC — ${outcome}`,
                  color: outcomeColor[outcome.toLowerCase()] ?? 0x5865f2,
                  fields: [
                     { name: 'User', value: who, inline: true },
                     { name: 'User ID', value: userId, inline: true },
                     ...(sessionId ? [{ name: 'Session', value: sessionId, inline: false }] : [])
                  ],
                  timestamp: new Date().toISOString()
               }
            ]
         },
         { prefer: ['DISCORD_KYC_WEBHOOK_URL'] }
      );
   } catch (err) {
      console.error('[diditNotifications] Admin alert failed:', err instanceof Error ? err.message : err);
   }
};

// User-facing outcome notification (email + Telegram + Web Push + Facebook Messenger
// when connected), respecting the account-activity notification preference. This closes
// the "silent webhook" gap: a manual review finishing (or an abandoned session) otherwise
// produces no signal the user ever sees unless they happen to reopen the app. Push and
// Messenger are the two channels the manual-review card asks the borrower to connect, so
// the approval reaches them the moment it clears — the whole point of "tell her it was
// approved". Never throws.
export type UserNotifyOutcome = 'approved' | 'review' | 'declined' | 'abandoned';

export const USER_NOTIFY_COPY: Record<UserNotifyOutcome, { subject: string; body: (reason?: string) => string; cta: string }> = {
   approved: {
      subject: 'You’re verified on Moodeng! 🎉',
      body: () =>
         'Great news — your identity verification is complete and your Moodeng account is fully unlocked. You can now request loans and start building trust with lenders.',
      cta: 'Open Moodeng'
   },
   review: {
      subject: 'Your Moodeng verification is in manual review',
      body: () =>
         'Your documents need a quick human review — this usually takes a few hours and at most 1 business day. We’ll message you the moment it’s done. No action needed.',
      cta: 'Check status'
   },
   declined: {
      subject: 'Your Moodeng verification didn’t pass',
      body: (reason) =>
         `We couldn’t verify your identity this time.${reason ? ` Reason: ${reason}.` : ''} You can try again any time — or message our team and we’ll help you sort it out.`,
      cta: 'Try again'
   },
   abandoned: {
      subject: 'Finish your Moodeng verification',
      body: () =>
         'You were almost done! Your verification session was closed before all the steps were finished. It only takes about 3 minutes to complete — pick up where you left off.',
      cta: 'Finish verifying'
   }
};

export const notifyUser = async (
   adminSupabase: AdminSupabase,
   userId: string,
   outcome: UserNotifyOutcome,
   reason?: string
) => {
   try {
      const { data } = await adminSupabase
         .from('users')
         .select('email, chat_id, messenger_psid, notif_account_activity, notif_push')
         .eq('id', userId)
         .maybeSingle();
      const user = data as {
         email?: string | null;
         chat_id?: string | number | null;
         messenger_psid?: string | null;
         notif_account_activity?: boolean | null;
         notif_push?: boolean | null;
      } | null;
      if (!user || user.notif_account_activity === false) return;

      const copy = USER_NOTIFY_COPY[outcome];
      const siteUrl = (Deno.env.get('VITE_SITE_URL') ?? Deno.env.get('MOODENG_APP_URL') ?? 'https://moodeng.app').replace(/\/$/, '');
      const verifyUrl = `${siteUrl}/verify`;
      const text = `${copy.body(reason)}\n\n${copy.cta}: ${verifyUrl}`;

      const email = user.email?.trim();
      if (email) {
         await sendEmail(email, copy.subject, text).catch((err: unknown) => {
            console.error('[diditNotifications] User email notification failed:', err instanceof Error ? err.message : err);
         });
      }
      if (user.chat_id) {
         await sendTelegramMessage(user.chat_id, `${copy.subject}\n\n${copy.body(reason)}`, {
            inlineKeyboard: [[{ text: copy.cta, url: verifyUrl }]]
         }).catch((err: unknown) => {
            console.error('[diditNotifications] User Telegram notification failed:', err instanceof Error ? err.message : err);
         });
      }

      // Web Push, per registered device in its own locale. Additive and best-effort:
      // sendPushToUser no-ops when VAPID is unset or the user has no device, and never
      // throws. Gated by the notif_push toggle on top of the account-activity check above.
      if (user.notif_push !== false) {
         await sendPushToUser(
            adminSupabase,
            userId,
            (locale: PushLocale) => buildVerificationDecisionPushPayload(outcome, locale, reason),
            { urgency: 'high' }
         ).catch((err: unknown) => {
            console.error('[diditNotifications] User push notification failed:', err instanceof Error ? err.message : err);
         });
      }

      // Facebook Messenger, for a borrower who connected it on the manual-review card.
      // SendPulse only delivers inside Messenger's 24h window, so this lands when the
      // review clears soon after they set it up (the common case) and silently no-ops
      // otherwise — email/push still carry it. Never throws.
      if (user.messenger_psid) {
         await sendMessengerMessage(user.messenger_psid, {
            text: `${copy.subject}\n\n${copy.body(reason)}`,
            card: { title: copy.subject, button: { title: copy.cta, url: verifyUrl } }
         }).catch((err: unknown) => {
            console.error('[diditNotifications] User Messenger notification failed:', err instanceof Error ? err.message : err);
         });
      }
   } catch (err) {
      console.error('[diditNotifications] User notification failed:', err instanceof Error ? err.message : err);
   }
};
