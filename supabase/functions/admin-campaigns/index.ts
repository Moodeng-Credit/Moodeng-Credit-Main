import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

import { sendEmail } from '../_shared/email.ts';
import { SITE_URL } from '../_shared/loanAccess.ts';
import { sendPushToUser } from '../_shared/pushDelivery.ts';
import { getMessengerContact, isInsideMessagingWindow, isSendPulseConfigured, sendMessengerMessage } from '../_shared/sendpulse.ts';
import { unsubscribeUrl } from '../_shared/unsubscribe.ts';

// Admin → Campaigns: one re-engagement message to a ready-made audience, each person reached on the
// best channel they can actually receive (migration 20261010090000_admin_campaigns.sql):
//   * Messenger — when Meta's 24h window is open (they messaged the Page in the last day). Outside
//     it Meta refuses free-form messages (message tags were retired), so instead:
//   * email (unless they unsubscribed; every email carries an unsubscribe link + one-click header)
//     and an app push to any device they've turned notifications on for.
//
//   { action: 'audience', audience: 'past_idle' | 'fb_not_borrowing', idleDays? }
//        → who's in it right now, and the channel each would get
//   { action: 'send', campaignId (client uuid), name, audience, idleDays?, subject, message, userIds }
//        → sends; a retry with the same campaignId skips whoever already got it (unique per channel)
//   { action: 'history' }                → recent campaigns with per-channel counts
//   { action: 'recipients', campaignId } → who got what
//
// Callers: an active owner/admin/support session only.

const corsHeaders = {
   'Access-Control-Allow-Origin': '*',
   'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
   'Access-Control-Allow-Methods': 'POST, OPTIONS'
};
const json = (body: unknown, status = 200) =>
   new Response(JSON.stringify(body), { status, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });

const AUDIENCES = new Set(['past_idle', 'fb_not_borrowing']);
// Email goes out one by one (Resend: 2 requests/second) inside this request, so keep a send short.
const MAX_PER_SEND = 100;
const MAX_NAME = 120;
const MAX_SUBJECT = 200;
const MAX_MESSAGE = 2000; // Messenger's text limit.
const EMAIL_GAP_MS = 600;
const PUSH_BODY_MAX = 180;

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));
const UUID = /^[0-9a-f-]{36}$/i;

// KYC names come off the document, often in capitals ("JOAN MAE") — show them the way people write them.
const titleCase = (value: string) =>
   value
      .toLowerCase()
      .replace(/(^|[\s'-])(\p{L})/gu, (_m, sep: string, ch: string) => sep + ch.toUpperCase())
      .trim();
const fill = (template: string, firstName: string) => template.replace(/\{\s*first_name\s*\}/gi, firstName);
const escapeHtml = (value: string) => value.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

const emailHtml = (text: string, unsubscribe: string) =>
   `<div style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;font-size:15px;line-height:1.55;color:#1a1a1a;max-width:560px">${text
      .split(/\n{2,}/)
      .map((para) => `<p style="margin:0 0 14px">${escapeHtml(para).replace(/\n/g, '<br>')}</p>`)
      .join('')}<p style="margin:28px 0 0;font-size:12px;color:#8a8a8a">You're getting this because you have a Moodeng Credit account. <a href="${escapeHtml(unsubscribe)}" style="color:#8a8a8a">Unsubscribe from updates</a> — loan and account emails still come through.</p></div>`;
const emailText = (text: string, unsubscribe: string) =>
   `${text}\n\n—\nYou're getting this because you have a Moodeng Credit account. Unsubscribe from updates: ${unsubscribe}`;

type AudienceRow = {
   user_id: string;
   email: string | null;
   display_name: string | null;
   username: string | null;
   messenger_psid: string | null;
   messenger_verified_at: string | null;
   email_unsubscribed_at: string | null;
   funded_loans: number;
   last_funded_at: string | null;
   last_repaid_at: string | null;
};
type Channel = 'messenger' | 'email' | 'push';

// deno-lint-ignore no-explicit-any
type Svc = any;

const loadAudience = async (svc: Svc, audience: string, idleDays: number): Promise<AudienceRow[]> => {
   const { data, error } = await svc.rpc('admin_campaign_audience', { p_audience: audience, p_idle_days: idleDays });
   if (error) throw new Error(error.message);
   return (data ?? []) as AudienceRow[];
};

const loadFirstNames = async (svc: Svc, ids: string[]) => {
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

// Is their Messenger window open right now? (They messaged the Page in the last ~day.)
const messengerOpen = async (psid: string | null) => {
   if (!psid || !isSendPulseConfigured()) return false;
   return isInsideMessagingWindow(await getMessengerContact(psid));
};

const planFor = (row: AudienceRow, open: boolean): Channel[] => {
   if (open) return ['messenger'];
   const channels: Channel[] = [];
   if (row.email && !row.email_unsubscribed_at) channels.push('email');
   channels.push('push');
   return channels;
};

const audienceAction = async (svc: Svc, body: Record<string, unknown>) => {
   const audience = String(body.audience ?? '');
   if (!AUDIENCES.has(audience)) return json({ error: 'Unknown audience' }, 400);
   const idleDays = Math.max(0, Math.min(3650, Number(body.idleDays ?? 30) || 0));
   const rows = await loadAudience(svc, audience, idleDays);
   const ids = rows.map((r) => r.user_id);
   const names = await loadFirstNames(svc, ids);

   // When we last reached each of them, so nobody gets campaigns back to back.
   const { data: lastSends } = ids.length
      ? await svc.from('admin_campaign_sends').select('user_id, created_at').in('user_id', ids).eq('status', 'sent').order('created_at', { ascending: false })
      : { data: [] };
   const lastContacted = new Map<string, string>();
   for (const s of (lastSends ?? []) as Array<{ user_id: string; created_at: string }>) {
      if (!lastContacted.has(s.user_id)) lastContacted.set(s.user_id, s.created_at);
   }

   const people = await Promise.all(
      rows.map(async (r) => {
         const open = await messengerOpen(r.messenger_psid);
         return {
            userId: r.user_id,
            firstName: names.get(r.user_id) || r.display_name?.trim() || 'there',
            displayName: r.display_name,
            username: r.username,
            email: r.email,
            hasMessenger: Boolean(r.messenger_verified_at),
            messengerOpen: open,
            unsubscribed: Boolean(r.email_unsubscribed_at),
            channels: planFor(r, open),
            fundedLoans: r.funded_loans,
            lastFundedAt: r.last_funded_at,
            lastRepaidAt: r.last_repaid_at,
            lastContactedAt: lastContacted.get(r.user_id) ?? null
         };
      })
   );
   return json({ audience, idleDays, people });
};

const sendAction = async (svc: Svc, body: Record<string, unknown>, actorId: string) => {
   const campaignId = String(body.campaignId ?? '');
   const audience = String(body.audience ?? '');
   const idleDays = Math.max(0, Math.min(3650, Number(body.idleDays ?? 30) || 0));
   const name = String(body.name ?? '').trim().slice(0, MAX_NAME);
   const subject = String(body.subject ?? '').trim();
   const message = String(body.message ?? '').trim();
   const userIds = [...new Set((Array.isArray(body.userIds) ? body.userIds : []).filter((id): id is string => typeof id === 'string' && UUID.test(id)))];

   if (!UUID.test(campaignId)) return json({ error: 'Missing campaign id' }, 400);
   if (!AUDIENCES.has(audience)) return json({ error: 'Unknown audience' }, 400);
   if (!subject || subject.length > MAX_SUBJECT) return json({ error: `Subject is required (max ${MAX_SUBJECT} characters)` }, 400);
   if (!message || message.length > MAX_MESSAGE) return json({ error: `Message is required (max ${MAX_MESSAGE} characters — Messenger's limit)` }, 400);
   if (!userIds.length) return json({ error: 'Pick at least one person' }, 400);
   if (userIds.length > MAX_PER_SEND) return json({ error: `At most ${MAX_PER_SEND} people per send` }, 400);

   // Only people still in the audience right now — someone who borrowed since the preview drops out.
   const rows = await loadAudience(svc, audience, idleDays);
   const inAudience = new Map(rows.map((r) => [r.user_id, r]));
   const names = await loadFirstNames(svc, userIds);

   const { error: campaignError } = await svc
      .from('admin_campaigns')
      .upsert(
         { id: campaignId, name: name || subject, audience, audience_params: { idleDays }, subject, message, created_by: actorId },
         { onConflict: 'id', ignoreDuplicates: true }
      );
   if (campaignError) throw new Error(campaignError.message);

   // Claim (campaign, person, channel) first: an existing row means a previous attempt got there.
   const claim = async (userId: string, channel: Channel) => {
      const { data } = await svc
         .from('admin_campaign_sends')
         .upsert({ campaign_id: campaignId, user_id: userId, channel, status: 'pending' }, { onConflict: 'campaign_id,user_id,channel', ignoreDuplicates: true })
         .select('id');
      if (data?.length) return true;
      // A failed earlier attempt may be retried; a sent / pending / skipped one is not.
      const { data: retry } = await svc
         .from('admin_campaign_sends')
         .update({ status: 'pending', detail: null })
         .eq('campaign_id', campaignId)
         .eq('user_id', userId)
         .eq('channel', channel)
         .eq('status', 'failed')
         .select('id');
      return Boolean(retry?.length);
   };
   const finish = (userId: string, channel: Channel, status: 'sent' | 'failed' | 'skipped', detail?: string) =>
      svc
         .from('admin_campaign_sends')
         .update({ status, detail: detail ?? null })
         .eq('campaign_id', campaignId)
         .eq('user_id', userId)
         .eq('channel', channel);

   type Outcome = { userId: string; channel: Channel | null; status: 'sent' | 'failed' | 'skipped'; detail?: string };
   const outcomes: Outcome[] = [];
   let emailSent = false;

   for (const userId of userIds) {
      const row = inAudience.get(userId);
      if (!row) {
         outcomes.push({ userId, channel: null, status: 'skipped', detail: 'no_longer_in_audience' });
         continue;
      }
      const firstName = names.get(userId) || row.display_name?.trim() || 'there';
      const text = fill(message, firstName);
      const title = fill(subject, firstName);

      // 1) Messenger, when the window is open. If it fails, fall through to email + push.
      if (await messengerOpen(row.messenger_psid)) {
         if (await claim(userId, 'messenger')) {
            const res = await sendMessengerMessage(row.messenger_psid, { text });
            if (res.ok) {
               await finish(userId, 'messenger', 'sent');
               outcomes.push({ userId, channel: 'messenger', status: 'sent' });
               continue;
            }
            await finish(userId, 'messenger', 'failed', res.reason);
         } else {
            outcomes.push({ userId, channel: 'messenger', status: 'skipped', detail: 'already_sent' });
            continue;
         }
      }

      // 2) Email (unless unsubscribed / no address).
      if (row.email && !row.email_unsubscribed_at) {
         if (await claim(userId, 'email')) {
            if (emailSent) await sleep(EMAIL_GAP_MS);
            emailSent = true;
            try {
               const unsubscribe = await unsubscribeUrl(userId);
               await sendEmail(row.email, title, emailText(text, unsubscribe), emailHtml(text, unsubscribe), undefined, {
                  'List-Unsubscribe': `<${unsubscribe}>`,
                  'List-Unsubscribe-Post': 'List-Unsubscribe=One-Click'
               });
               await finish(userId, 'email', 'sent');
               outcomes.push({ userId, channel: 'email', status: 'sent' });
            } catch (err) {
               const detail = err instanceof Error ? err.message.slice(0, 300) : 'send_failed';
               await finish(userId, 'email', 'failed', detail);
               outcomes.push({ userId, channel: 'email', status: 'failed', detail });
            }
         } else {
            outcomes.push({ userId, channel: 'email', status: 'skipped', detail: 'already_sent' });
         }
      } else {
         outcomes.push({ userId, channel: 'email', status: 'skipped', detail: row.email_unsubscribed_at ? 'unsubscribed' : 'no_email' });
      }

      // 3) Push, to any device they turned notifications on for.
      if (await claim(userId, 'push')) {
         try {
            const res = await sendPushToUser(
               svc,
               userId,
               () => ({
                  type: 'campaign',
                  title,
                  body: text.length > PUSH_BODY_MAX ? `${text.slice(0, PUSH_BODY_MAX - 1)}…` : text,
                  url: `${SITE_URL}/request-board`,
                  tag: `campaign-${campaignId}`
               }),
               { urgency: 'normal' }
            );
            const status = res.sent > 0 ? 'sent' : 'skipped';
            const detail = res.sent > 0 ? undefined : res.failed > 0 ? 'push_failed' : 'no_device';
            await finish(userId, 'push', status, detail);
            outcomes.push({ userId, channel: 'push', status, detail });
         } catch (err) {
            const detail = err instanceof Error ? err.message.slice(0, 300) : 'push_failed';
            await finish(userId, 'push', 'failed', detail);
            outcomes.push({ userId, channel: 'push', status: 'failed', detail });
         }
      }
   }

   const count = (channel: Channel) => outcomes.filter((o) => o.channel === channel && o.status === 'sent').length;
   const reached = new Set(outcomes.filter((o) => o.status === 'sent').map((o) => o.userId)).size;
   return json({
      campaignId,
      reached,
      messenger: count('messenger'),
      email: count('email'),
      push: count('push'),
      failed: outcomes.filter((o) => o.status === 'failed').length,
      outcomes
   });
};

const historyAction = async (svc: Svc) => {
   const { data: campaigns, error } = await svc
      .from('admin_campaigns')
      .select('id, name, audience, audience_params, subject, created_at')
      .order('created_at', { ascending: false })
      .limit(30);
   if (error) throw new Error(error.message);
   const ids = ((campaigns ?? []) as Array<{ id: string }>).map((c) => c.id);
   const { data: sends } = ids.length
      ? await svc.from('admin_campaign_sends').select('campaign_id, user_id, channel, status').in('campaign_id', ids)
      : { data: [] };
   const rows = (sends ?? []) as Array<{ campaign_id: string; user_id: string; channel: Channel; status: string }>;
   return json({
      campaigns: ((campaigns ?? []) as Array<Record<string, unknown> & { id: string }>).map((c) => {
         const mine = rows.filter((s) => s.campaign_id === c.id);
         const sent = (channel: Channel) => mine.filter((s) => s.channel === channel && s.status === 'sent').length;
         return {
            ...c,
            reached: new Set(mine.filter((s) => s.status === 'sent').map((s) => s.user_id)).size,
            messenger: sent('messenger'),
            email: sent('email'),
            push: sent('push'),
            failed: mine.filter((s) => s.status === 'failed').length
         };
      })
   });
};

const recipientsAction = async (svc: Svc, body: Record<string, unknown>) => {
   const campaignId = String(body.campaignId ?? '');
   if (!UUID.test(campaignId)) return json({ error: 'Missing campaign id' }, 400);
   const { data, error } = await svc
      .from('admin_campaign_sends')
      .select('user_id, channel, status, detail, created_at, users(username, email, display_name)')
      .eq('campaign_id', campaignId)
      .order('created_at', { ascending: true });
   if (error) throw new Error(error.message);
   return json({ sends: data ?? [] });
};

serve(async (req) => {
   if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
   if (req.method !== 'POST') return json({ error: 'Method not allowed' }, 405);

   const svc = createClient(Deno.env.get('SUPABASE_URL') ?? '', Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '', {
      auth: { autoRefreshToken: false, persistSession: false }
   });

   const jwt = (req.headers.get('Authorization') ?? '').replace(/^Bearer\s+/i, '').trim();
   if (!jwt) return json({ error: 'Missing authorization token' }, 401);
   const { data: userData, error: userError } = await svc.auth.getUser(jwt);
   const callerId = userData?.user?.id;
   if (userError || !callerId) return json({ error: 'Invalid session' }, 401);
   const { data: adminRow } = await svc
      .from('admin_users')
      .select('user_id')
      .eq('user_id', callerId)
      .eq('active', true)
      .in('role', ['owner', 'admin', 'support'])
      .maybeSingle();
   if (!adminRow) return json({ error: 'Forbidden: admin account required' }, 403);

   const body = ((await req.json().catch(() => null)) ?? {}) as Record<string, unknown>;
   try {
      if (body.action === 'audience') return await audienceAction(svc, body);
      if (body.action === 'send') return await sendAction(svc, body, callerId);
      if (body.action === 'history') return await historyAction(svc);
      if (body.action === 'recipients') return await recipientsAction(svc, body);
      return json({ error: 'Unknown action' }, 400);
   } catch (err) {
      console.error('admin-campaigns failed:', err instanceof Error ? err.message : err);
      return json({ error: 'Something went wrong — try again.' }, 500);
   }
});
