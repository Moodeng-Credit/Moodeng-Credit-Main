import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

import { BORROWER_COLUMNS, notifyAdminsOfRequest, notifyBorrower, REQUEST_COLUMNS } from '../_shared/loanAccess.ts';

// Connect → Approve → Apply (docs/HANDOFF_BORROWER_VERIFICATION.md §13).
//
//   action=submit  (borrower JWT)  — the "Let's connect" card. Requires a proven contact line
//                                   (Messenger, or WhatsApp once live), flips the borrower to
//                                   pending, records the reach-out, and pings admins on Telegram
//                                   + Discord. The live flow (telegram_bot_settings.loan_flow) sets
//                                   the kind: 'approval' → Approve/Reject buttons; 'call' → needs a
//                                   booked video call, decided by Showed up / No-show after it.
//                                   In 'open' there's no gate, and referred borrowers skip it, so both are refused.
//   action=expire  (hourly cron)   — pending requests older than 7 days go back to none, with a
//                                   nudge to reach out again. Idempotent and only touches rows
//                                   already past expires_at, so an extra call is harmless.
//
// The decision itself happens in telegram-webhook (buttons or /approve /reject).
// verify_jwt stays on (project default): every caller needs a valid project token, and submit
// additionally resolves the borrower from that token — never from the body.

const SUPABASE_URL = Deno.env.get('SUPABASE_URL') ?? '';
const SUPABASE_ANON_KEY = Deno.env.get('SUPABASE_ANON_KEY') ?? '';
const SERVICE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '';

const CORS = {
   'Access-Control-Allow-Origin': '*',
   'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
   'Access-Control-Allow-Methods': 'POST, OPTIONS'
};
const json = (body: Record<string, unknown>, status = 200) =>
   new Response(JSON.stringify(body), { status, headers: { ...CORS, 'Content-Type': 'application/json' } });

const MAX_REASON = 500;
const MAX_NAME = 80;
const MAX_REFERRAL = 40;

const clip = (value: unknown, max: number) => (typeof value === 'string' ? value.trim().slice(0, max) : '');

// deno-lint-ignore no-explicit-any
const submit = async (req: Request, svc: any, body: Record<string, unknown>) => {
   const authClient = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
      global: { headers: { Authorization: req.headers.get('Authorization') ?? '' } }
   });
   const { data: auth } = await authClient.auth.getUser();
   const userId = auth?.user?.id;
   if (!userId) return json({ ok: false, error: 'unauthorized' }, 401);

   const { data: borrower, error } = await svc
      .from('users')
      .select(`${BORROWER_COLUMNS}, user_role, account_status, redeemed_referral_code_id`)
      .eq('id', userId)
      .maybeSingle();
   if (error) throw new Error(error.message);
   if (!borrower) return json({ ok: false, error: 'no_profile' }, 404);
   if (borrower.account_status && borrower.account_status !== 'active') return json({ ok: false, error: 'account_inactive' }, 403);
   if (borrower.user_role === 'lender') return json({ ok: false, error: 'not_borrower' }, 403);

   // Already through, or already waiting — report the state rather than erroring, so a double tap
   // or a stale screen just lands on the right card.
   if (borrower.loan_access_status === 'approved' || borrower.loan_access_status === 'pending') {
      return json({ ok: true, status: borrower.loan_access_status });
   }

   const { data: flowData } = await svc.rpc('get_loan_flow');
   const flow = typeof flowData === 'string' ? flowData : 'open';
   if (flow === 'open') return json({ ok: false, error: 'gate_off' }, 409);
   // Referred borrowers skip the gate entirely (they apply straight away), so nothing to request.
   if (borrower.redeemed_referral_code_id) return json({ ok: false, error: 'has_referral' }, 409);

   // Call flow: the reach-out IS the booked call, so there must be one coming up.
   if (flow === 'call' && !(borrower.video_call_starts_at && Date.parse(borrower.video_call_starts_at) > Date.now())) {
      return json({ ok: false, error: 'call_not_booked' }, 400);
   }

   // The whole point of connecting: we must have a line we've proven works.
   const channel = borrower.messenger_verified_at ? 'messenger' : borrower.whatsapp_verified_at ? 'whatsapp' : null;
   if (!channel) return json({ ok: false, error: 'contact_not_verified' }, 400);

   const reason = clip(body.reason, MAX_REASON);
   if (reason.length < 3) return json({ ok: false, error: 'reason_required' }, 400);

   const { data: request, error: insertError } = await svc
      .from('loan_access_requests')
      .insert({
         user_id: userId,
         display_name: clip(body.displayName, MAX_NAME) || borrower.display_name || null,
         reason,
         referral_code: clip(body.referralCode, MAX_REFERRAL).toUpperCase() || null,
         channel,
         kind: flow === 'call' ? 'call' : 'approval',
         // A call request stays open until a week after the call, not a week after booking.
         ...(flow === 'call' && borrower.video_call_starts_at
            ? { expires_at: new Date(Date.parse(borrower.video_call_starts_at) + 7 * 86400000).toISOString() }
            : {})
      })
      .select(REQUEST_COLUMNS)
      .single();
   if (insertError) {
      // Unique open-request index: a concurrent submit already created it.
      if (insertError.code === '23505') return json({ ok: true, status: 'pending' });
      throw new Error(insertError.message);
   }

   const { error: statusError } = await svc.from('users').update({ loan_access_status: 'pending' }).eq('id', userId);
   if (statusError) throw new Error(statusError.message);

   await notifyAdminsOfRequest(svc, request, borrower);
   return json({ ok: true, status: 'pending' });
};

// deno-lint-ignore no-explicit-any
const expire = async (svc: any) => {
   const { data: stale, error } = await svc
      .from('loan_access_requests')
      .update({ status: 'expired', decided_at: new Date().toISOString(), decided_by: 'cron' })
      .eq('status', 'pending')
      .lt('expires_at', new Date().toISOString())
      .select('user_id');
   if (error) throw new Error(error.message);

   let nudged = 0;
   for (const row of (stale ?? []) as Array<{ user_id: string }>) {
      // Only reset users still pending — never downgrade someone an admin decided meanwhile.
      const { data: borrower } = await svc
         .from('users')
         .update({ loan_access_status: 'none' })
         .eq('id', row.user_id)
         .eq('loan_access_status', 'pending')
         .select(BORROWER_COLUMNS)
         .maybeSingle();
      if (!borrower) continue;
      await notifyBorrower(svc, borrower, 'expired');
      nudged++;
   }
   return json({ ok: true, expired: stale?.length ?? 0, nudged });
};

serve(async (req) => {
   if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS });
   if (req.method !== 'POST') return json({ error: 'method_not_allowed' }, 405);
   if (!SUPABASE_URL || !SERVICE_KEY) {
      console.error('loan-access: missing SUPABASE_URL / service key');
      return json({ error: 'not_configured' }, 500);
   }

   const svc = createClient(SUPABASE_URL, SERVICE_KEY);
   const body = ((await req.json().catch(() => ({}))) ?? {}) as Record<string, unknown>;

   try {
      if (body.action === 'submit') return await submit(req, svc, body);
      if (body.action === 'expire') return await expire(svc);
      return json({ error: 'unknown_action' }, 400);
   } catch (err) {
      console.error('loan-access failed:', err instanceof Error ? err.message : err);
      return json({ ok: false, error: 'internal_error' }, 500);
   }
});
