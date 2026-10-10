import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

import { ATTENDANCE_COLUMNS, describeAttendance, zoomActiveForHost } from '../_shared/attendance.ts';
import { postDiscord } from '../_shared/discord.ts';
import { BORROWER_COLUMNS, type BorrowerRow, decideLoanAccess, notifyBorrower, REQUEST_COLUMNS, who } from '../_shared/loanAccess.ts';
import { recordCallOutcome } from '../_shared/videoCallOutcome.ts';

// Call approvals in the admin panel — the same decisions as the Telegram card's buttons and
// /showed · /noshow · /approve · /reject, so the host can approve a borrower the moment the call
// ends instead of waiting for the "Did they show up?" card. Every decision goes through the same
// shared functions as Telegram (recordCallOutcome / decideLoanAccess), so the borrower gets the
// same message and a second tap from Telegram is a no-op.
//
// Two actions (POST JSON):
//   { action: 'list' }                                        → { rows }
//   { action: 'decide', userId, decision: 'attended' | 'no_show' }      (video call)
//   { action: 'decide', requestId, decision: 'approved' | 'rejected' } (no-call approval request)
//   { action: 'approve_user', userId }  approve from the Directory, call or not: decides their pending
//                                       request if they have one, else approves them directly
//                                                             → { ok, summary }
// verify_jwt is on; the caller must also be an active admin.

const CORS = {
   'Access-Control-Allow-Origin': '*',
   'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
   'Access-Control-Allow-Methods': 'POST, OPTIONS'
};
const json = (body: Record<string, unknown>, status = 200) =>
   new Response(JSON.stringify(body), { status, headers: { ...CORS, 'Content-Type': 'application/json' } });

// Calls from two days back (late decisions, no-show corrections) to a day ahead.
const LOOKBACK_H = 48;
const LOOKAHEAD_H = 24;

const USER_COLUMNS = `${BORROWER_COLUMNS}, video_call_outcome, video_call_outcome_at, video_call_join_url, ${ATTENDANCE_COLUMNS}`;

type UserRow = {
   id: string;
   username: string | null;
   email: string | null;
   display_name: string | null;
   loan_access_status: string | null;
   video_call_starts_at: string | null;
   video_call_outcome: string | null;
   video_call_outcome_at: string | null;
   video_call_join_url: string | null;
   video_call_host: string | null;
   video_call_meeting_id: string | null;
   video_call_arrived_at: string | null;
   video_call_joined_at: string | null;
   video_call_left_at: string | null;
};
type RequestRow = { id: string; user_id: string; kind: string; display_name: string | null; reason: string | null; created_at: string };

serve(async (req) => {
   if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS });
   if (req.method !== 'POST') return json({ error: 'Method not allowed' }, 405);

   const svc = createClient(Deno.env.get('SUPABASE_URL') ?? '', Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '');

   const token = (req.headers.get('Authorization') ?? '').replace(/^Bearer\s+/i, '').trim();
   if (!token) return json({ error: 'Missing authorization token' }, 401);
   const { data: userData, error: userError } = await svc.auth.getUser(token);
   const callerId = userData?.user?.id;
   if (userError || !callerId) return json({ error: 'Invalid session' }, 401);
   const { data: adminRow } = await svc
      .from('admin_users')
      .select('display_name')
      .eq('user_id', callerId)
      .eq('active', true)
      .in('role', ['owner', 'admin', 'support'])
      .maybeSingle();
   if (!adminRow) return json({ error: 'Forbidden: admin account required' }, 403);
   const decidedBy = `${(adminRow as { display_name: string | null }).display_name || userData.user?.email || 'admin'} (admin panel)`;

   const body = (await req.json().catch(() => ({}))) as Record<string, unknown>;

   try {
      if (body.action === 'list') {
         const now = Date.now();
         const [{ data: calls, error: callsError }, { data: pending, error: pendingError }] = await Promise.all([
            svc
               .from('users')
               .select(USER_COLUMNS)
               .not('video_call_booking_uid', 'is', null)
               .gt('video_call_starts_at', new Date(now - LOOKBACK_H * 3600000).toISOString())
               .lt('video_call_starts_at', new Date(now + LOOKAHEAD_H * 3600000).toISOString())
               .order('video_call_starts_at', { ascending: true })
               .limit(200),
            svc.from('loan_access_requests').select(REQUEST_COLUMNS).eq('status', 'pending').order('created_at', { ascending: true }).limit(100)
         ]);
         if (callsError) throw new Error(callsError.message);
         if (pendingError) throw new Error(pendingError.message);

         const users = new Map<string, UserRow>(((calls ?? []) as UserRow[]).map((u) => [u.id, u]));
         const requests = (pending ?? []) as RequestRow[];
         const missing = requests.map((r) => r.user_id).filter((id) => !users.has(id));
         if (missing.length) {
            const { data: extra, error: extraError } = await svc.from('users').select(USER_COLUMNS).in('id', missing);
            if (extraError) throw new Error(extraError.message);
            for (const u of (extra ?? []) as UserRow[]) users.set(u.id, u);
         }
         const requestByUser = new Map(requests.map((r) => [r.user_id, r]));

         const zoomByHost = new Map<string, boolean>();
         const rows = [];
         for (const u of users.values()) {
            const host = u.video_call_host ?? '';
            if (!zoomByHost.has(host)) zoomByHost.set(host, await zoomActiveForHost(svc, host));
            const request = requestByUser.get(u.id) ?? null;
            rows.push({
               userId: u.id,
               name: who(u, request?.display_name),
               username: u.username,
               loanAccessStatus: u.loan_access_status,
               callStartsAt: u.video_call_starts_at,
               host: u.video_call_host,
               joinUrl: u.video_call_join_url,
               attendance: u.video_call_starts_at ? describeAttendance(u, zoomByHost.get(host) ?? false) : null,
               outcome: u.video_call_outcome,
               outcomeAt: u.video_call_outcome_at,
               request: request ? { id: request.id, kind: request.kind, reason: request.reason, createdAt: request.created_at } : null
            });
         }
         return json({ rows });
      }

      if (body.action === 'decide') {
         const decision = body.decision;
         if ((decision === 'attended' || decision === 'no_show') && typeof body.userId === 'string') {
            const result = await recordCallOutcome(svc, body.userId, decision, decidedBy);
            return json(result);
         }
         if ((decision === 'approved' || decision === 'rejected') && typeof body.requestId === 'string') {
            const result = await decideLoanAccess(svc, body.requestId, decision, decidedBy);
            return json({ ok: result.ok, summary: result.summary });
         }
         return json({ error: 'Invalid decision' }, 400);
      }

      if (body.action === 'approve_user' && typeof body.userId === 'string') {
         const { data: pendingRequest } = await svc
            .from('loan_access_requests')
            .select('id')
            .eq('user_id', body.userId)
            .eq('status', 'pending')
            .order('created_at', { ascending: false })
            .limit(1)
            .maybeSingle();
         if (pendingRequest) {
            const result = await decideLoanAccess(svc, (pendingRequest as { id: string }).id, 'approved', decidedBy);
            return json({ ok: result.ok, summary: result.summary });
         }
         // No request to decide: approve directly. Conditional, so a double tap approves (and
         // messages the borrower) only once. Approving here means the team has cleared them, so it
         // also counts as the intro call: without video_call_outcome = 'attended' the loan form asked
         // them to book a second call and hold_request_until_first_call hid their request from lenders.
         const approvedAt = new Date().toISOString();
         const { data: approved, error: approveError } = await svc
            .from('users')
            .update({
               loan_access_status: 'approved',
               loan_access_approved_at: approvedAt,
               loan_access_seen_at: null,
               video_call_outcome: 'attended',
               video_call_outcome_at: approvedAt
            })
            .eq('id', body.userId)
            .or('loan_access_status.is.null,loan_access_status.neq.approved')
            .select(BORROWER_COLUMNS)
            .maybeSingle();
         if (approveError) throw new Error(approveError.message);
         if (!approved) return json({ ok: false, summary: 'Already approved — nothing changed.' });
         await notifyBorrower(svc, approved as BorrowerRow, 'approved');
         const summary = `✅ Approved: ${who(approved as BorrowerRow)} — by ${decidedBy}`;
         await postDiscord({ content: `🔓 Loan access ${summary}` }, { prefer: ['DISCORD_BOOKINGS_WEBHOOK_URL'] });
         return json({ ok: true, summary });
      }

      return json({ error: 'Unknown action' }, 400);
   } catch (err) {
      console.error('admin-call-approvals:', err instanceof Error ? err.message : err);
      return json({ error: err instanceof Error ? err.message : 'Request failed' }, 500);
   }
});
