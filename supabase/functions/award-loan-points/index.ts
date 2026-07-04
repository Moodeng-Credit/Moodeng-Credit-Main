import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

// Awards IOU (Trust Points) reward points to a loan's lender when it is funded.
//
// Why this exists: `award_points` is a SECURITY DEFINER RPC that takes an arbitrary
// user_id and point delta. It used to be called straight from the browser, so any client
// (even logged-out) could POST /rest/v1/rpc/award_points and mint unlimited points for any
// account — forging the entire rewards economy. This function moves the award server-side:
//   • the caller must be authenticated AND be the loan's lender (auth.uid === lender_user_id),
//   • the loan, amount, borrower and prior-loan count are re-read from the DB under
//     service_role — the client cannot influence how many points are granted,
//   • only then is `award_points` invoked (with service_role), which is no longer callable
//     by anon/authenticated (see the accompanying migration).
//
// The point math is a faithful port of src/shared/points.ts (BigInt, identical rules) so the
// awarded amount matches what the client used to compute. Keep the two in sync.

const corsHeaders = {
   'Access-Control-Allow-Origin': '*',
   'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
   'Access-Control-Allow-Methods': 'POST, OPTIONS'
};

const json = (body: Record<string, unknown>, status = 200) =>
   new Response(JSON.stringify(body), { status, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });

// --- points math, ported 1:1 from src/shared/points.ts ---
const POINTS_SCALE = 6;
const LOAN_FUNDING_POINTS_PER_USDC = 1;
const LOAN_FUNDING_POINTS_MULTIPLIER = BigInt(LOAN_FUNDING_POINTS_PER_USDC);
const DECIMAL_PATTERN = /^\d+(\.\d+)?$/;

const parseAmountToMinorUnits = (amount: string | number): bigint => {
   const normalized = typeof amount === 'number' ? amount.toString() : amount.trim();
   if (normalized.length === 0 || normalized.includes('e') || normalized.includes('E')) {
      throw new Error('Loan amount must be a base-10 number');
   }
   if (!DECIMAL_PATTERN.test(normalized)) {
      throw new Error('Loan amount must be a positive number');
   }
   const [whole, fraction = ''] = normalized.split('.');
   if (fraction.length > POINTS_SCALE) {
      throw new Error(`Loan amount must have at most ${POINTS_SCALE} decimal places`);
   }
   const paddedFraction = fraction.padEnd(POINTS_SCALE, '0');
   const scaleFactor = 10n ** BigInt(POINTS_SCALE);
   return BigInt(whole) * scaleFactor + BigInt(paddedFraction || '0');
};

const computePointsDelta = (loanAmount: string | number): bigint =>
   parseAmountToMinorUnits(loanAmount) * LOAN_FUNDING_POINTS_MULTIPLIER;

const pointsMajorToMinor = (points: number): bigint =>
   BigInt(Math.trunc(points)) * 10n ** BigInt(POINTS_SCALE);

const getYearOneIouBorrowerBonusPoints = (borrowerPriorFundedLoanCount: number): number => {
   const priorFundedLoans = Math.max(0, Math.trunc(borrowerPriorFundedLoanCount));
   if (priorFundedLoans === 0) return 25;
   if (priorFundedLoans === 1) return 20;
   if (priorFundedLoans === 2) return 15;
   return 10;
};

const computeYearOneIouPointsDelta = (loanAmount: string | number, borrowerPriorFundedLoanCount: number): bigint =>
   computePointsDelta(loanAmount) + pointsMajorToMinor(getYearOneIouBorrowerBonusPoints(borrowerPriorFundedLoanCount));
// --- end ported math ---

serve(async (req) => {
   if (req.method === 'OPTIONS') {
      return new Response('ok', { headers: corsHeaders });
   }
   if (req.method !== 'POST') {
      return json({ error: 'Method not allowed' }, 405);
   }

   try {
      const accessToken = req.headers.get('Authorization')?.replace(/^Bearer\s+/i, '').trim();
      if (!accessToken) {
         return json({ error: 'Missing authorization token' }, 401);
      }

      let loanId: string | undefined;
      try {
         const body = (await req.json()) as { loan_id?: unknown };
         if (typeof body?.loan_id === 'string' && body.loan_id.length > 0) loanId = body.loan_id;
      } catch {
         // fall through to the missing-id error
      }
      if (!loanId) {
         return json({ error: 'Missing loan_id' }, 400);
      }

      const supabase = createClient(
         Deno.env.get('SUPABASE_URL') ?? '',
         Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
         { auth: { autoRefreshToken: false, persistSession: false } }
      );

      // Who is calling?
      const {
         data: { user },
         error: userError
      } = await supabase.auth.getUser(accessToken);
      if (userError || !user) {
         return json({ error: 'Invalid authorization token' }, 401);
      }

      // Re-read the loan under service_role — the client cannot influence these values.
      const { data: loan, error: loanError } = await supabase
         .from('loans')
         .select('id, loan_status, lender_user_id, borrower_user_id, loan_amount, tracking_id, funded_at')
         .eq('id', loanId)
         .maybeSingle();

      if (loanError) {
         return json({ error: loanError.message }, 500);
      }
      if (!loan) {
         return json({ error: 'Loan not found' }, 404);
      }
      if (loan.loan_status !== 'Lent') {
         return json({ error: 'Loan is not funded', code: 'NOT_LENT' }, 409);
      }
      if (!loan.lender_user_id || !loan.borrower_user_id) {
         return json({ error: 'Loan is missing lender or borrower', code: 'INCOMPLETE_LOAN' }, 409);
      }
      // Only the loan's own lender may trigger the award. This is what makes it un-forgeable.
      if (user.id !== loan.lender_user_id) {
         return json({ error: 'Caller is not the lender of this loan', code: 'FORBIDDEN' }, 403);
      }

      // Borrower's prior funded loans (excluding this one) — drives the bonus tier.
      const { count: priorCount, error: countError } = await supabase
         .from('loans')
         .select('id', { count: 'exact', head: true })
         .eq('borrower_user_id', loan.borrower_user_id)
         .eq('loan_status', 'Lent')
         .neq('id', loan.id);
      if (countError) {
         return json({ error: countError.message }, 500);
      }

      const priorFundedLoanCount = priorCount ?? 0;
      const borrowerBonusPoints = getYearOneIouBorrowerBonusPoints(priorFundedLoanCount);
      const pointsDelta = computeYearOneIouPointsDelta(String(loan.loan_amount), priorFundedLoanCount);

      const metadata = {
         loan_id: loan.id,
         loan_amount: String(loan.loan_amount),
         loan_tracking_id: loan.tracking_id,
         loan_funded_at: loan.funded_at,
         reward_year: 1,
         base_points_per_usdc: LOAN_FUNDING_POINTS_PER_USDC,
         borrower_prior_funded_loan_count: priorFundedLoanCount,
         borrower_loan_number: priorFundedLoanCount + 1,
         borrower_bonus_points: borrowerBonusPoints
      };

      const { data: awardData, error: awardError } = await supabase.rpc('award_points', {
         user_id_input: loan.lender_user_id,
         source_type_input: 'loan',
         source_id_input: loan.id,
         event_type_input: 'funded',
         delta_input: pointsDelta.toString(),
         metadata_input: metadata
      });
      if (awardError) {
         console.error('[award-loan-points] award_points failed:', awardError.message);
         return json({ error: awardError.message }, 500);
      }

      // award_points returns a single row { applied, event_id, points_total }.
      const result = Array.isArray(awardData) ? awardData[0] : awardData;
      return json({ ok: true, ...(result ?? {}) });
   } catch (error) {
      const message = error instanceof Error ? error.message : 'Internal server error';
      console.error('[award-loan-points] Unhandled error:', message);
      return json({ error: message }, 500);
   }
});
