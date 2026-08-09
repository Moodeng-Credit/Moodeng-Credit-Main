// Pushes a new loan request to the lenders who have already been repaid in full
// by that same borrower.
//
// This is deliberately *not* the broad lender broadcast (that's
// loan-request-telegram-notification) and not the team suggestion feed (that's
// loan-request-lender-suggestions). The audience here is narrow and earned: a
// lender who has personally been paid back by this borrower. They have their own
// evidence, they need no diligence, and they are the fastest fill available — so
// they get the one channel that reaches a lock screen.
//
// Fired by private.notify_loan_request_telegram() on INSERT of a 'Requested' loan.

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

import { loadPushSubscriptions, sendPushToSubscriptions } from '../_shared/pushDelivery.ts';
import { buildRepeatBorrowerPushPayload } from '../_shared/pushMessages.ts';

const corsHeaders = {
   'Access-Control-Allow-Origin': '*',
   'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
   'Access-Control-Allow-Methods': 'POST, OPTIONS'
};

type SupabaseClient = any;

type PriorLoanRow = {
   lender_user_id: string | null;
   total_repayment_amount: number | string | null;
   repaid_amount: number | string | null;
   loan_amount: number | string | null;
   repayment_status: string | null;
   loan_status: string | null;
   is_deleted?: boolean | null;
};

type LenderRow = {
   id: string;
   notif_push: boolean | null;
   notif_account_activity: boolean | null;
};

type RepeatLender = {
   lenderId: string;
   repaidLoanCount: number;
   repaidTotal: number;
};

const json = (body: unknown, status = 200) =>
   new Response(JSON.stringify(body), { status, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });

const toAmount = (value: number | string | null | undefined) => {
   const amount = Number(value ?? 0);
   return Number.isFinite(amount) ? amount : 0;
};

const getSetting = async (supabase: SupabaseClient, key: string) => {
   const { data, error } = await supabase.from('telegram_bot_settings').select('value').eq('key', key).maybeSingle();
   if (error) throw new Error(error.message);
   return data?.value as string | undefined;
};

const getRequestSecret = (req: Request) => {
   const authorization = req.headers.get('Authorization') ?? '';
   const bearerToken = authorization.startsWith('Bearer ') ? authorization.slice('Bearer '.length).trim() : null;
   return bearerToken ?? req.headers.get('x-notification-secret');
};

// Mirrors the sibling loan-request functions: accept the service key directly, or
// fall back to the DB-stored internal secret verifier.
const authorizeInternalRequest = async (supabase: SupabaseClient, req: Request) => {
   const requestSecret = getRequestSecret(req);
   if (!requestSecret) {
      return { authorized: false, status: 401, error: 'Unauthorized' };
   }

   const expectedSecret = Deno.env.get('SUPABASE_SECRET_KEY') ?? Deno.env.get('TELEGRAM_NOTIFICATION_SECRET');
   if (expectedSecret && requestSecret === expectedSecret) {
      return { authorized: true, status: 200, error: null };
   }

   const { data, error } = await supabase.rpc('verify_internal_notification_secret', { candidate: requestSecret });
   if (error) {
      return { authorized: false, status: 500, error: error.message };
   }
   if (data !== true) {
      return { authorized: false, status: 401, error: 'Unauthorized' };
   }

   return { authorized: true, status: 200, error: null };
};

/**
 * "Has repaid me" means the loan reached repayment_status 'Paid' — a partial
 * repayment is not a track record, and an open loan is exposure, not history.
 * Deleted rows are excluded so an admin-removed loan can't manufacture trust.
 */
const collectRepeatLenders = (priorLoans: PriorLoanRow[]): RepeatLender[] => {
   const byLender = new Map<string, RepeatLender>();

   for (const loan of priorLoans) {
      if (!loan.lender_user_id || loan.is_deleted === true) {
         continue;
      }
      if (loan.repayment_status !== 'Paid') {
         continue;
      }

      const existing = byLender.get(loan.lender_user_id) ?? {
         lenderId: loan.lender_user_id,
         repaidLoanCount: 0,
         repaidTotal: 0
      };

      existing.repaidLoanCount += 1;
      // Prefer what was actually repaid; fall back to the contracted total, then
      // the principal, so an older row with a null repaid_amount still counts.
      existing.repaidTotal +=
         toAmount(loan.repaid_amount) || toAmount(loan.total_repayment_amount) || toAmount(loan.loan_amount);

      byLender.set(loan.lender_user_id, existing);
   }

   return Array.from(byLender.values()).sort((a, b) => b.repaidTotal - a.repaidTotal);
};

serve(async (req) => {
   if (req.method === 'OPTIONS') {
      return new Response('ok', { headers: corsHeaders });
   }

   if (req.method !== 'POST') {
      return json({ error: 'Method not allowed' }, 405);
   }

   const supabase = createClient(Deno.env.get('SUPABASE_URL') ?? '', Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '');
   const authorization = await authorizeInternalRequest(supabase, req);
   if (!authorization.authorized) {
      return json({ error: authorization.error }, authorization.status);
   }

   try {
      const { loanId, dryRun = false, mock = false, locale = 'en' } = await req.json().catch(() => ({}));

      // Preview the exact copy without touching the DB or any push service.
      if (mock) {
         return json({
            payload: buildRepeatBorrowerPushPayload(
               {
                  loanId: 'mock-loan-id',
                  borrowerUsername: 'malee',
                  requestAmount: 25,
                  repaidLoanCount: 2,
                  repaidTotal: 41.5,
                  reason: 'School supplies for my daughter'
               },
               locale
            )
         });
      }

      if (!loanId) {
         return json({ error: 'loanId is required' }, 400);
      }

      const enabled = (await getSetting(supabase, 'repeat_borrower_push_enabled')) !== 'false';
      if (!enabled && !dryRun) {
         return json({ message: 'Repeat-borrower push is disabled.' });
      }

      const { data: loan, error: loanError } = await supabase
         .from('loans')
         .select('id, loan_amount, reason, borrower_user_id, loan_status')
         .eq('id', loanId)
         .maybeSingle();

      if (loanError) throw new Error(loanError.message);
      if (!loan) return json({ error: 'Loan not found' }, 404);
      if (loan.loan_status !== 'Requested') return json({ message: 'Loan is not an active request.' });
      if (!loan.borrower_user_id) return json({ message: 'Loan has no borrower.' });

      const { data: borrower } = await supabase
         .from('users')
         .select('username')
         .eq('id', loan.borrower_user_id)
         .maybeSingle();

      const { data: priorLoans, error: priorLoansError } = await supabase
         .from('loans')
         .select('lender_user_id, total_repayment_amount, repaid_amount, loan_amount, repayment_status, loan_status, is_deleted')
         .eq('borrower_user_id', loan.borrower_user_id)
         .eq('repayment_status', 'Paid')
         .neq('id', loan.id);

      if (priorLoansError) throw new Error(priorLoansError.message);

      const repeatLenders = collectRepeatLenders((priorLoans ?? []) as PriorLoanRow[]);
      if (!repeatLenders.length) {
         return json({ message: 'No lender has been repaid by this borrower yet.', notified: 0 });
      }

      // Channel + category opt-outs. A new lending opportunity is "activity you've
      // missed", so it sits under notif_account_activity rather than the
      // money-movement category.
      const { data: lenderRows, error: lendersError } = await supabase
         .from('users')
         .select('id, notif_push, notif_account_activity')
         .in(
            'id',
            repeatLenders.map((lender) => lender.lenderId)
         );

      if (lendersError) throw new Error(lendersError.message);

      const optedIn = new Set(
         ((lenderRows ?? []) as LenderRow[])
            .filter((row) => row.notif_push !== false && row.notif_account_activity !== false)
            .map((row) => row.id)
      );

      // One push per lender per request, even if the trigger re-fires.
      const { data: alreadySent, error: alreadySentError } = await supabase
         .from('loan_notifications')
         .select('user_id')
         .eq('loan_id', loan.id)
         .eq('notification_type', 'repeat_borrower_request');

      if (alreadySentError) throw new Error(alreadySentError.message);

      const alreadyNotified = new Set(((alreadySent ?? []) as Array<{ user_id: string }>).map((row) => row.user_id));

      const targets = repeatLenders.filter(
         (lender) => optedIn.has(lender.lenderId) && !alreadyNotified.has(lender.lenderId)
      );

      if (!targets.length) {
         return json({ message: 'No eligible repeat lenders to notify.', notified: 0 });
      }

      const subscriptionsByUser = await loadPushSubscriptions(
         supabase,
         targets.map((lender) => lender.lenderId)
      );

      if (dryRun) {
         return json({
            targets: targets.map((lender) => ({
               ...lender,
               devices: (subscriptionsByUser.get(lender.lenderId) ?? []).length,
               payload: buildRepeatBorrowerPushPayload(
                  {
                     loanId: loan.id,
                     borrowerUsername: borrower?.username ?? null,
                     requestAmount: toAmount(loan.loan_amount),
                     repaidLoanCount: lender.repaidLoanCount,
                     repaidTotal: lender.repaidTotal,
                     reason: loan.reason ?? null
                  },
                  locale
               )
            }))
         });
      }

      let notified = 0;
      const deliveredLenderIds: string[] = [];

      for (const lender of targets) {
         const subscriptions = subscriptionsByUser.get(lender.lenderId) ?? [];
         if (!subscriptions.length) {
            continue;
         }

         const result = await sendPushToSubscriptions(
            supabase,
            subscriptions,
            (pushLocale) =>
               buildRepeatBorrowerPushPayload(
                  {
                     loanId: loan.id,
                     borrowerUsername: borrower?.username ?? null,
                     requestAmount: toAmount(loan.loan_amount),
                     repaidLoanCount: lender.repaidLoanCount,
                     repaidTotal: lender.repaidTotal,
                     reason: loan.reason ?? null
                  },
                  pushLocale
               ),
            // Requests are filled first-come; a stale one helps nobody.
            { urgency: 'high', ttlSeconds: 6 * 60 * 60 }
         );

         if (result.sent > 0) {
            notified += 1;
            deliveredLenderIds.push(lender.lenderId);
         }
      }

      // Only record what actually reached a device, so a lender whose only phone
      // was offline still gets the push if the request is reposted.
      if (deliveredLenderIds.length) {
         const { error: recordError } = await supabase.from('loan_notifications').insert(
            deliveredLenderIds.map((lenderId) => ({
               loan_id: loan.id,
               user_id: lenderId,
               notification_type: 'repeat_borrower_request'
            }))
         );

         if (recordError) {
            console.error('Failed to record repeat-borrower push', recordError.message);
         }
      }

      return json({ message: 'Repeat-borrower push processed', eligible: targets.length, notified });
   } catch (error) {
      return json({ error: error instanceof Error ? error.message : 'Repeat-borrower push failed' }, 500);
   }
});
