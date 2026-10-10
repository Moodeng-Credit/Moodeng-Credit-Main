import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

import { sendEmail } from '../_shared/email.ts';

// Admin → users, email side: write one message, tick the people, and each gets their own copy
// addressed by name. Sent from support@moodeng.app (replies land in the support inbox).
//
//   { action: 'send', recipients: [{ userId, name? }], subject, message, dedupeKey? }
//     `message` / `subject` may use {first_name} — filled per person from `name` if given, else
//     their KYC first name, else display name, else "there". Sent one by one (Resend rate limit)
//     and each send is logged to admin_audit_logs (action 'admin_email_sent'). With a dedupeKey,
//     anyone already sent that key is skipped, so a retried batch never double-sends.
//
// Callers: an active owner/admin/support session (the admin panel), or server-side with
// X-Admin-Token = ADMIN_API_TOKEN (fail-closed: no token configured → header path refused).

const corsHeaders = {
   'Access-Control-Allow-Origin': '*',
   'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-admin-token',
   'Access-Control-Allow-Methods': 'POST, OPTIONS'
};
const json = (body: unknown, status = 200) =>
   new Response(JSON.stringify(body), { status, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });

const MAX_RECIPIENTS = 200;
const MAX_SUBJECT = 200;
const MAX_MESSAGE = 10000;
// Resend's default limit is 2 requests/second.
const SEND_GAP_MS = 600;

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

// KYC names come off the document, often in capitals ("JOAN MAE") — show them the way people write them.
const titleCase = (value: string) =>
   value
      .toLowerCase()
      .replace(/(^|[\s'-])(\p{L})/gu, (_m, sep: string, ch: string) => sep + ch.toUpperCase())
      .trim();

const fill = (template: string, firstName: string) => template.replace(/\{\s*first_name\s*\}/gi, firstName);

const escapeHtml = (value: string) => value.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

const toHtml = (text: string) =>
   `<div style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;font-size:15px;line-height:1.55;color:#1a1a1a;max-width:560px">${text
      .split(/\n{2,}/)
      .map((para) => `<p style="margin:0 0 14px">${escapeHtml(para).replace(/\n/g, '<br>')}</p>`)
      .join('')}</div>`;

type Recipient = { userId: string; name?: string | null };

serve(async (req) => {
   if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
   if (req.method !== 'POST') return json({ error: 'Method not allowed' }, 405);

   const svc = createClient(Deno.env.get('SUPABASE_URL') ?? '', Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '', {
      auth: { autoRefreshToken: false, persistSession: false }
   });

   // Auth: server-side token, or an active admin's session.
   let actorId: string | null = null;
   const adminToken = (Deno.env.get('ADMIN_API_TOKEN') ?? '').trim();
   const presentedToken = (req.headers.get('X-Admin-Token') ?? '').trim();
   if (presentedToken) {
      if (!adminToken || presentedToken !== adminToken) return json({ error: 'unauthorized' }, 401);
   } else {
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
      actorId = callerId;
   }

   const body = (await req.json().catch(() => null)) as {
      action?: string;
      recipients?: Recipient[];
      subject?: string;
      message?: string;
      dedupeKey?: string;
      // Account/loan notices that must reach the person even if they unsubscribed from marketing.
      transactional?: boolean;
   } | null;
   if (!body || body.action !== 'send') return json({ error: 'Unknown action' }, 400);

   const subject = (body.subject ?? '').trim();
   const message = (body.message ?? '').trim();
   const dedupeKey = (body.dedupeKey ?? '').trim() || null;
   const transactional = body.transactional === true;
   const recipients = (Array.isArray(body.recipients) ? body.recipients : []).filter(
      (r): r is Recipient => typeof r?.userId === 'string' && r.userId.length > 0
   );
   if (!subject || subject.length > MAX_SUBJECT) return json({ error: 'Subject is required (max 200 characters)' }, 400);
   if (!message || message.length > MAX_MESSAGE) return json({ error: 'Message is required (max 10,000 characters)' }, 400);
   if (recipients.length === 0) return json({ error: 'Pick at least one person' }, 400);
   if (recipients.length > MAX_RECIPIENTS) return json({ error: `At most ${MAX_RECIPIENTS} people per send` }, 400);

   const ids = [...new Set(recipients.map((r) => r.userId))];
   const [{ data: users, error: usersError }, { data: kyc }] = await Promise.all([
      svc.from('users').select('id, email, display_name, email_unsubscribed_at').in('id', ids),
      svc
         .from('kyc_identities')
         .select('user_id, first_name, session_created_at')
         .in('user_id', ids)
         .order('session_created_at', { ascending: false })
   ]);
   if (usersError) return json({ error: 'Could not load recipients' }, 500);

   const kycFirstName = new Map<string, string>();
   for (const row of (kyc ?? []) as Array<{ user_id: string; first_name: string | null }>) {
      if (row.first_name?.trim() && !kycFirstName.has(row.user_id)) kycFirstName.set(row.user_id, row.first_name.trim());
   }
   const userById = new Map(
      (
         (users ?? []) as Array<{ id: string; email: string | null; display_name: string | null; email_unsubscribed_at: string | null }>
      ).map((u) => [u.id, u])
   );

   let alreadySent = new Set<string>();
   if (dedupeKey) {
      const { data: prior } = await svc
         .from('admin_audit_logs')
         .select('target_user_id')
         .eq('action', 'admin_email_sent')
         .eq('metadata->>dedupe_key', dedupeKey)
         .in('target_user_id', ids);
      alreadySent = new Set(((prior ?? []) as Array<{ target_user_id: string }>).map((p) => p.target_user_id));
   }

   type Result = { userId: string; email: string | null; name: string; status: 'sent' | 'skipped' | 'failed'; reason?: string };
   const results: Result[] = [];
   let first = true;
   for (const recipient of recipients) {
      const user = userById.get(recipient.userId);
      const name = recipient.name?.trim() || titleCase(kycFirstName.get(recipient.userId) ?? '') || user?.display_name?.trim() || 'there';
      const email = user?.email?.trim() || null;

      if (!user) {
         results.push({ userId: recipient.userId, email, name, status: 'failed', reason: 'user_not_found' });
         continue;
      }
      if (!email) {
         results.push({ userId: recipient.userId, email, name, status: 'failed', reason: 'no_email' });
         continue;
      }
      if (user.email_unsubscribed_at && !transactional) {
         results.push({ userId: recipient.userId, email, name, status: 'skipped', reason: 'unsubscribed' });
         continue;
      }
      if (alreadySent.has(recipient.userId)) {
         results.push({ userId: recipient.userId, email, name, status: 'skipped', reason: 'already_sent' });
         continue;
      }

      if (!first) await sleep(SEND_GAP_MS);
      first = false;

      const personalSubject = fill(subject, name);
      const personalText = fill(message, name);
      try {
         await sendEmail(email, personalSubject, personalText, toHtml(personalText));
      } catch (err) {
         results.push({
            userId: recipient.userId,
            email,
            name,
            status: 'failed',
            reason: err instanceof Error ? err.message : 'send_failed'
         });
         continue;
      }

      alreadySent.add(recipient.userId);
      await svc.from('admin_audit_logs').insert({
         actor_user_id: actorId,
         action: 'admin_email_sent',
         target_table: 'users',
         target_id: recipient.userId,
         target_user_id: recipient.userId,
         metadata: { subject: personalSubject, dedupe_key: dedupeKey, email }
      });
      results.push({ userId: recipient.userId, email, name, status: 'sent' });
   }

   return json({
      sent: results.filter((r) => r.status === 'sent').length,
      skipped: results.filter((r) => r.status === 'skipped').length,
      failed: results.filter((r) => r.status === 'failed').length,
      results
   });
});
