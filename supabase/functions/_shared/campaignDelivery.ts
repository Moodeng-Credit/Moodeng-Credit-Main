// One re-engagement message, delivered on the best channel a borrower can receive — shared by
// Admin → Campaigns (admin-campaigns) and the automatic journeys (campaign-automations):
//   1. Messenger, when Meta's 24h window is open (they messaged the Page in the last day). Outside
//      it Meta refuses free-form messages (message tags were retired), so instead:
//   2. email — unless they unsubscribed — with an unsubscribe link + one-click List-Unsubscribe, and
//   3. an app push to any device they turned notifications on for.
// The caller owns the send log: `claim` reserves (person, channel) before sending (false = already
// done, skip), `finish` records the outcome. That's what makes a retry never double-send.

import { sendEmail } from './email.ts';
import { SITE_URL } from './loanAccess.ts';
import { sendPushToUser } from './pushDelivery.ts';
import { getMessengerContact, isInsideMessagingWindow, isSendPulseConfigured, sendMessengerMessage } from './sendpulse.ts';
import { unsubscribeUrl } from './unsubscribe.ts';

// deno-lint-ignore no-explicit-any
type Svc = any;

export type Channel = 'messenger' | 'email' | 'push';
export type SendStatus = 'sent' | 'failed' | 'skipped';
export type Outcome = { userId: string; channel: Channel | null; status: SendStatus; detail?: string };

export type DeliveryPerson = {
   user_id: string;
   email: string | null;
   display_name: string | null;
   messenger_psid: string | null;
   email_unsubscribed_at: string | null;
};

export type DeliveryLog = {
   claim: (userId: string, channel: Channel) => Promise<boolean>;
   finish: (userId: string, channel: Channel, status: SendStatus, detail?: string) => Promise<unknown>;
};

const PUSH_BODY_MAX = 180;
// Resend allows 2 requests/second; callers send people one after another.
export const EMAIL_GAP_MS = 600;

// KYC names come off the document, often in capitals ("JOAN MAE") — show them the way people write them.
export const titleCase = (value: string) =>
   value
      .toLowerCase()
      .replace(/(^|[\s'-])(\p{L})/gu, (_m, sep: string, ch: string) => sep + ch.toUpperCase())
      .trim();
export const fill = (template: string, firstName: string) => template.replace(/\{\s*first_name\s*\}/gi, firstName);
const escapeHtml = (value: string) => value.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

const emailHtml = (text: string, unsubscribe: string) =>
   `<div style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;font-size:15px;line-height:1.55;color:#1a1a1a;max-width:560px">${text
      .split(/\n{2,}/)
      .map((para) => `<p style="margin:0 0 14px">${escapeHtml(para).replace(/\n/g, '<br>')}</p>`)
      .join('')}<p style="margin:28px 0 0;font-size:12px;color:#8a8a8a">You're getting this because you have a Moodeng Credit account. <a href="${escapeHtml(unsubscribe)}" style="color:#8a8a8a">Unsubscribe from updates</a> — loan and account emails still come through.</p></div>`;
const emailText = (text: string, unsubscribe: string) =>
   `${text}\n\n—\nYou're getting this because you have a Moodeng Credit account. Unsubscribe from updates: ${unsubscribe}`;

export const loadFirstNames = async (svc: Svc, ids: string[]) => {
   const names = new Map<string, string>();
   if (!ids.length) return names;
   const { data } = await svc
      .from('kyc_identities')
      .select('user_id, first_name, session_created_at')
      .in('user_id', ids)
      .order('session_created_at', { ascending: false });
   for (const row of (data ?? []) as Array<{ user_id: string; first_name: string | null }>) {
      if (row.first_name?.trim() && !names.has(row.user_id)) names.set(row.user_id, titleCase(row.first_name.trim()));
   }
   return names;
};

// Is their Messenger window open right now?
export const messengerOpen = async (psid: string | null) => {
   if (!psid || !isSendPulseConfigured()) return false;
   return isInsideMessagingWindow(await getMessengerContact(psid));
};

export const planFor = (person: DeliveryPerson, open: boolean): Channel[] => {
   if (open) return ['messenger'];
   const channels: Channel[] = [];
   if (person.email && !person.email_unsubscribed_at) channels.push('email');
   channels.push('push');
   return channels;
};

// Sends to one person. `pushTag` collapses repeat pushes of the same message on a device.
export const deliverToPerson = async (
   svc: Svc,
   person: DeliveryPerson,
   firstName: string,
   content: { subject: string; message: string; pushTag: string },
   log: DeliveryLog
): Promise<Outcome[]> => {
   const userId = person.user_id;
   const text = fill(content.message, firstName);
   const title = fill(content.subject, firstName);
   const outcomes: Outcome[] = [];

   // 1) Messenger, when the window is open. If it fails, fall through to email + push.
   if (await messengerOpen(person.messenger_psid)) {
      if (!(await log.claim(userId, 'messenger'))) return [{ userId, channel: 'messenger', status: 'skipped', detail: 'already_sent' }];
      const res = await sendMessengerMessage(person.messenger_psid, { text });
      if (res.ok) {
         await log.finish(userId, 'messenger', 'sent');
         return [{ userId, channel: 'messenger', status: 'sent' }];
      }
      await log.finish(userId, 'messenger', 'failed', res.reason);
      outcomes.push({ userId, channel: 'messenger', status: 'failed', detail: res.reason });
   }

   // 2) Email, unless unsubscribed / no address.
   if (person.email && !person.email_unsubscribed_at) {
      if (await log.claim(userId, 'email')) {
         try {
            const unsubscribe = await unsubscribeUrl(userId);
            await sendEmail(person.email, title, emailText(text, unsubscribe), emailHtml(text, unsubscribe), undefined, {
               'List-Unsubscribe': `<${unsubscribe}>`,
               'List-Unsubscribe-Post': 'List-Unsubscribe=One-Click'
            });
            await log.finish(userId, 'email', 'sent');
            outcomes.push({ userId, channel: 'email', status: 'sent' });
         } catch (err) {
            const detail = err instanceof Error ? err.message.slice(0, 300) : 'send_failed';
            await log.finish(userId, 'email', 'failed', detail);
            outcomes.push({ userId, channel: 'email', status: 'failed', detail });
         }
      } else {
         outcomes.push({ userId, channel: 'email', status: 'skipped', detail: 'already_sent' });
      }
   } else {
      outcomes.push({ userId, channel: 'email', status: 'skipped', detail: person.email_unsubscribed_at ? 'unsubscribed' : 'no_email' });
   }

   // 3) Push, to any device they turned notifications on for.
   if (await log.claim(userId, 'push')) {
      try {
         const res = await sendPushToUser(
            svc,
            userId,
            () => ({
               type: 'campaign',
               title,
               body: text.length > PUSH_BODY_MAX ? `${text.slice(0, PUSH_BODY_MAX - 1)}…` : text,
               url: `${SITE_URL}/request-board`,
               tag: content.pushTag
            }),
            { urgency: 'normal' }
         );
         const status: SendStatus = res.sent > 0 ? 'sent' : 'skipped';
         const detail = res.sent > 0 ? undefined : res.failed > 0 ? 'push_failed' : 'no_device';
         await log.finish(userId, 'push', status, detail);
         outcomes.push({ userId, channel: 'push', status, detail });
      } catch (err) {
         const detail = err instanceof Error ? err.message.slice(0, 300) : 'push_failed';
         await log.finish(userId, 'push', 'failed', detail);
         outcomes.push({ userId, channel: 'push', status: 'failed', detail });
      }
   }
   return outcomes;
};

// Did anything (a manual campaign or an automation) reach them in the last `days`? The weekly cap.
export const contactedWithin = async (svc: Svc, userIds: string[], days: number): Promise<Set<string>> => {
   if (!userIds.length) return new Set();
   const since = new Date(Date.now() - days * 86400000).toISOString();
   const [{ data: manual }, { data: auto }] = await Promise.all([
      svc.from('admin_campaign_sends').select('user_id').in('user_id', userIds).eq('status', 'sent').gte('created_at', since),
      svc.from('admin_automation_sends').select('user_id').in('user_id', userIds).eq('status', 'sent').gte('created_at', since)
   ]);
   return new Set([...((manual ?? []) as Array<{ user_id: string }>), ...((auto ?? []) as Array<{ user_id: string }>)].map((r) => r.user_id));
};
