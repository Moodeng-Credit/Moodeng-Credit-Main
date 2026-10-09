import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

import {
   type Channel,
   deliverToPerson,
   EMAIL_GAP_MS,
   loadFirstNames,
   messengerOpen,
   type Outcome,
   planFor
} from '../_shared/campaignDelivery.ts';
import { AUTOMATION_ID, CAP_DAYS, loadJourney, planComeback, STEP_WINDOW_DAYS } from '../_shared/comebackJourney.ts';

// Admin → Campaigns: one re-engagement message to a ready-made audience, each person reached on the
// best channel they can actually receive (see _shared/campaignDelivery.ts; migration
// 20261010090000_admin_campaigns.sql). The automatic journeys live in campaign-automations.
//
//   { action: 'audience', audience: 'past_idle' | 'fb_not_borrowing', idleDays? }
//        → who's in it right now, and the channel each would get
//   { action: 'send', campaignId (client uuid), name, audience, idleDays?, subject, message, userIds }
//        → sends; a retry with the same campaignId skips whoever already got it (unique per channel)
//   { action: 'history' }                → recent campaigns with per-channel counts
//   { action: 'recipients', campaignId } → who got what
//   { action: 'automations' }            → the automatic journeys, their steps and recent sends
//   { action: 'save_automation', id, enabled, steps: [{ step, delayDays, subject, message }] }
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

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));
const UUID = /^[0-9a-f-]{36}$/i;

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

// deno-lint-ignore no-explicit-any
type Svc = any;

const loadAudience = async (svc: Svc, audience: string, idleDays: number): Promise<AudienceRow[]> => {
   const { data, error } = await svc.rpc('admin_campaign_audience', { p_audience: audience, p_idle_days: idleDays });
   if (error) throw new Error(error.message);
   return (data ?? []) as AudienceRow[];
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

   const outcomes: Outcome[] = [];
   let first = true;
   for (const userId of userIds) {
      const row = inAudience.get(userId);
      if (!row) {
         outcomes.push({ userId, channel: null, status: 'skipped', detail: 'no_longer_in_audience' });
         continue;
      }
      if (!first) await sleep(EMAIL_GAP_MS);
      first = false;
      const firstName = names.get(userId) || row.display_name?.trim() || 'there';
      outcomes.push(...(await deliverToPerson(svc, row, firstName, { subject, message, pushTag: `campaign-${campaignId}` }, { claim, finish })));
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

// The automatic journey: its steps, who's due today (and who the weekly limit is holding back), and
// the last 30 days of sends.
const automationsAction = async (svc: Svc) => {
   const { automation, steps } = await loadJourney(svc);
   if (!automation) return json({ automations: [] });
   const { due, capped } = await planComeback(svc, steps);
   const since = new Date(Date.now() - 30 * 86400000).toISOString();
   const { data: sends, error } = await svc
      .from('admin_automation_sends')
      .select('user_id, step, channel, status, detail, created_at, users(username, email, display_name)')
      .eq('automation_id', AUTOMATION_ID)
      .gte('created_at', since)
      .order('created_at', { ascending: false })
      .limit(300);
   if (error) throw new Error(error.message);
   const brief = (d: (typeof due)[number]) => ({
      userId: d.person.user_id,
      name: d.person.display_name || d.person.username || d.person.email || d.person.user_id,
      step: d.step.step,
      daysSinceRepaid: d.person.days_since
   });
   return json({
      automations: [
         {
            ...automation,
            stepWindowDays: STEP_WINDOW_DAYS,
            capDays: CAP_DAYS,
            steps,
            dueToday: due.map(brief),
            waitingForLimit: capped.map(brief),
            recentSends: sends ?? []
         }
      ]
   });
};

const saveAutomationAction = async (svc: Svc, body: Record<string, unknown>, actorId: string) => {
   if (body.id !== AUTOMATION_ID) return json({ error: 'Unknown automation' }, 400);
   const steps = (Array.isArray(body.steps) ? body.steps : []) as Array<Record<string, unknown>>;
   const clean = steps.map((s) => ({
      automation_id: AUTOMATION_ID,
      step: Number(s.step),
      delay_days: Math.round(Number(s.delayDays)),
      subject: String(s.subject ?? '').trim(),
      message: String(s.message ?? '').trim()
   }));
   for (const s of clean) {
      if (!Number.isInteger(s.step) || s.step < 1) return json({ error: 'Bad step' }, 400);
      if (!Number.isInteger(s.delay_days) || s.delay_days < 1 || s.delay_days > 365) return json({ error: 'Days must be 1–365' }, 400);
      if (!s.subject || s.subject.length > MAX_SUBJECT) return json({ error: `Step ${s.step}: subject is required (max ${MAX_SUBJECT})` }, 400);
      if (!s.message || s.message.length > MAX_MESSAGE) return json({ error: `Step ${s.step}: message is required (max ${MAX_MESSAGE})` }, 400);
   }
   if (new Set(clean.map((s) => s.delay_days)).size !== clean.length) return json({ error: 'Each step needs a different day' }, 400);
   if (clean.length) {
      const { error } = await svc.from('admin_automation_steps').upsert(clean, { onConflict: 'automation_id,step' });
      if (error) throw new Error(error.message);
   }
   if (typeof body.enabled === 'boolean') {
      const { error } = await svc
         .from('admin_automations')
         .update({ enabled: body.enabled, updated_at: new Date().toISOString(), updated_by: actorId })
         .eq('id', AUTOMATION_ID);
      if (error) throw new Error(error.message);
   }
   return automationsAction(svc);
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
      if (body.action === 'automations') return await automationsAction(svc);
      if (body.action === 'save_automation') return await saveAutomationAction(svc, body, callerId);
      return json({ error: 'Unknown action' }, 400);
   } catch (err) {
      console.error('admin-campaigns failed:', err instanceof Error ? err.message : err);
      return json({ error: 'Something went wrong — try again.' }, 500);
   }
});
