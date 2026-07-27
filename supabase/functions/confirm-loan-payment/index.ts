import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

import {
   computeCumulativeBorrowedAmount,
   computeYearOneIouPointsDelta,
   evaluateCreditProgression,
   getYearOneIouBorrowerBonusPoints,
   LOAN_FUNDING_POINTS_PER_USDC,
   toNumber
} from '../_shared/creditAndPoints.ts';

// Server-side proof-of-payment gate for loan funding/repayment.
//
// Previously the client wrote loan_status/repayment_status/repaid_amount/hash directly via
// supabase.from('loans').update(...) after *claiming* to have sent USDC — nothing ever checked
// the chain, so any authenticated user could mark any loan "Lent" or "Paid" for any amount by
// calling the Supabase client directly (no real transfer required). A DB trigger (see migration
// 20260710000000_lock_down_loan_money_columns.sql) now rejects client writes to those columns,
// making this function the only path that can set them — it independently verifies the on-chain
// (or Base Pay bundler) transfer before writing anything, via the service-role key, then runs the
// same points/credit/notification side effects the client thunk used to (updateLoanStatus).
//
// Body: { loanId: string, hash: string, method: 'wallet' | 'base', action: 'fund' | 'repay' }
// Response: { loan: <updated loans row>, sideEffectErrors: [...] } | { error: string, retry?: bool }

const corsHeaders = {
   'Access-Control-Allow-Origin': '*',
   'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
   'Access-Control-Allow-Methods': 'POST, OPTIONS'
};

const jsonResponse = (body: Record<string, unknown>, status = 200) =>
   new Response(JSON.stringify(body), { status, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });

const USDC_ADDRESS = (Deno.env.get('BASE_USDC_ADDRESS') || '0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913').toLowerCase();
const TRANSFER_TOPIC = '0xddf252ad1be2c89b69c2b068fc378daa952ba7f163c4a11628f55a4df523b3ef';
// Same public bundler endpoint @base-org/account's own getPaymentStatus() calls — no secret needed.
const BUNDLER_URL = 'https://api.developer.coinbase.com/rpc/v1/base/S-fOd2n2Oi4fl4e1Crm83XeDXZ7tkg8O';
const ALCHEMY_ID = Deno.env.get('ALCHEMY_ID') ?? '';
const RPC_URL = ALCHEMY_ID ? `https://base-mainnet.g.alchemy.com/v2/${ALCHEMY_ID}` : 'https://mainnet.base.org';
const REQUEST_EXPIRATION_MS = 7 * 24 * 60 * 60 * 1000;

const topicToAddress = (topic: string) => `0x${topic.slice(-40)}`.toLowerCase();
const hexToBigInt = (hex: string) => (hex && hex !== '0x' ? BigInt(hex) : 0n);

interface RawLog {
   address?: string;
   topics?: string[];
   data?: string;
}

interface DecodedTransfer {
   from: string;
   to: string;
   value: bigint;
}

const decodeUsdcTransfers = (logs: RawLog[] | undefined): DecodedTransfer[] => {
   const transfers: DecodedTransfer[] = [];
   for (const log of logs ?? []) {
      if ((log.address ?? '').toLowerCase() !== USDC_ADDRESS) continue;
      const topics = log.topics ?? [];
      if (topics[0]?.toLowerCase() !== TRANSFER_TOPIC || topics.length < 3) continue;
      transfers.push({
         from: topicToAddress(topics[1]),
         to: topicToAddress(topics[2]),
         value: hexToBigInt(log.data ?? '0x0')
      });
   }
   return transfers;
};

const rpcCall = async (url: string, method: string, params: unknown[]) => {
   const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ jsonrpc: '2.0', id: 1, method, params })
   });
   const json = await res.json();
   if (json.error) throw new Error(json.error.message || 'RPC error');
   return json.result;
};

class PaymentNotConfirmedError extends Error {
   constructor() {
      super('Payment is not confirmed on-chain yet');
   }
}

interface VerifiedTransfer {
   from: string;
   to: string;
   micros: bigint;
   blockNumber?: string;
   // The real, Basescan-verifiable on-chain transaction hash. For 'wallet' payments this equals the
   // input hash; for 'base' (ERC-4337) payments the input is a userOperation hash — which 404s on the
   // explorer — so we surface the bundler's resolved transactionHash instead.
   txHash?: string;
}

// Confirms `hash` on-chain and returns the USDC transfer it produced. Throws
// PaymentNotConfirmedError if it's simply not landed yet (caller should retry), or a plain
// Error for anything short of "money definitely moved to someone" (failed tx, wrong token, no
// USDC transfer in the receipt at all).
const verifyPayment = async (method: 'wallet' | 'base', hash: string): Promise<VerifiedTransfer> => {
   if (method === 'base') {
      const result = await rpcCall(BUNDLER_URL, 'eth_getUserOperationReceipt', [hash]);
      if (!result) throw new PaymentNotConfirmedError();
      if (!result.success) throw new Error('Payment failed on-chain');
      const transfers = decodeUsdcTransfers(result.receipt?.logs);
      if (transfers.length === 0) throw new Error('No USDC transfer found in this payment');
      const sender = (result.sender ?? '').toLowerCase();
      const bySender = transfers.filter((t) => t.from === sender);
      const chosen = bySender[0] ?? transfers[0];
      return {
         from: chosen.from,
         to: chosen.to,
         micros: chosen.value,
         blockNumber: result.receipt?.blockNumber,
         txHash: result.receipt?.transactionHash
      };
   }

   const receipt = await rpcCall(RPC_URL, 'eth_getTransactionReceipt', [hash]);
   if (!receipt) throw new PaymentNotConfirmedError();
   if (receipt.status !== '0x1') throw new Error('Transaction failed on-chain');
   const transfers = decodeUsdcTransfers(receipt.logs);
   if (transfers.length === 0) throw new Error('No USDC transfer found in this transaction');
   return {
      from: transfers[0].from,
      to: transfers[0].to,
      micros: transfers[0].value,
      blockNumber: receipt.blockNumber,
      txHash: receipt.transactionHash ?? hash
   };
};

// Best-effort block timestamp (ms) for the freshness check. Fail-open: any RPC/parse problem returns
// null so the caller skips the check rather than false-rejecting a legitimate payment.
const getBlockTimestampMs = async (blockNumber?: string): Promise<number | null> => {
   if (!blockNumber) return null;
   try {
      const block = await rpcCall(RPC_URL, 'eth_getBlockByNumber', [blockNumber, false]);
      if (!block?.timestamp) return null;
      return Number(BigInt(block.timestamp)) * 1000;
   } catch {
      return null;
   }
};

type SideEffectError = { type: 'award_points' | 'loan_notification' | 'credit_progression'; message: string };
// deno-lint-ignore no-explicit-any
type Admin = any;

// Mirrors the fund-branch side effects that used to run in updateLoanStatus: award IOU points to
// the lender, scaled by the borrower's prior funded-loan count.
const awardFundingPoints = async (admin: Admin, loan: Record<string, unknown>): Promise<SideEffectError[]> => {
   const errors: SideEffectError[] = [];
   const lenderId = loan.lender_user_id as string | null;
   const borrowerId = loan.borrower_user_id as string | null;
   if (!lenderId) return errors;
   if (!borrowerId) {
      errors.push({ type: 'award_points', message: 'Funded loan has no borrower user id; cannot award points.' });
      return errors;
   }

   const { count, error: countError } = await admin
      .from('loans')
      .select('id', { count: 'exact', head: true })
      .eq('borrower_user_id', borrowerId)
      .eq('loan_status', 'Lent')
      .neq('id', loan.id);

   if (countError) {
      errors.push({ type: 'award_points', message: countError.message });
      return errors;
   }

   const priorFundedLoanCount = count ?? 0;
   const pointsDelta = computeYearOneIouPointsDelta(String(loan.loan_amount), priorFundedLoanCount);
   const { error: pointsError } = await admin.rpc('award_points', {
      user_id_input: lenderId,
      source_type_input: 'loan',
      source_id_input: loan.id,
      event_type_input: 'funded',
      delta_input: pointsDelta.toString(),
      metadata_input: {
         loan_id: loan.id,
         loan_amount: String(loan.loan_amount),
         loan_tracking_id: loan.tracking_id,
         loan_funded_at: loan.funded_at,
         reward_year: 1,
         base_points_per_usdc: LOAN_FUNDING_POINTS_PER_USDC,
         borrower_prior_funded_loan_count: priorFundedLoanCount,
         borrower_loan_number: priorFundedLoanCount + 1,
         borrower_bonus_points: getYearOneIouBorrowerBonusPoints(priorFundedLoanCount)
      }
   });
   if (pointsError) errors.push({ type: 'award_points', message: pointsError.message });
   return errors;
};

// Mirrors the repay-branch credit-progression logic that used to run in updateLoanStatus: on a
// fully-repaid loan, level up the borrower's credit limit (or pause it if late). This is now the
// ONLY writer of users.cs / credit_progression_paused once the Phase 3 lock lands.
const applyCreditProgression = async (admin: Admin, loan: Record<string, unknown>): Promise<SideEffectError[]> => {
   const errors: SideEffectError[] = [];
   const borrowerId = loan.borrower_user_id as string | null;
   if (!borrowerId || !loan.due_date) return errors;

   const { data: borrower, error: borrowerError } = await admin
      .from('users')
      .select('id, cs, is_world_id, is_didit, credit_progression_paused')
      .eq('id', borrowerId)
      .single();
   if (borrowerError || !borrower) {
      errors.push({ type: 'credit_progression', message: borrowerError?.message ?? 'Borrower not found' });
      return errors;
   }

   const { data: paidLoans, error: paidLoansError } = await admin
      .from('loans')
      .select('loan_amount, repaid_amount, total_repayment_amount, due_date, repaid_at, updated_at')
      .eq('borrower_user_id', borrowerId)
      .eq('repayment_status', 'Paid');
   if (paidLoansError) {
      errors.push({ type: 'credit_progression', message: paidLoansError.message });
      return errors;
   }

   const evaluation = evaluateCreditProgression({
      currentLimit: borrower.cs ?? 0,
      // Any supported identity method grants verified status for credit progression, mirroring the
      // frontend isUserVerified(). Didit is the majority path; gating on World ID alone stalled
      // Didit-verified borrowers' credit-limit growth (this is the authoritative writer).
      isVerified: borrower.is_world_id === 'ACTIVE' || borrower.is_didit === 'ACTIVE',
      isPaused: borrower.credit_progression_paused ?? false,
      repaidAmount: toNumber(loan.repaid_amount as number | string | null),
      totalRepaymentAmount: toNumber(loan.total_repayment_amount as number | string | null),
      cumulativeBorrowedAmount: computeCumulativeBorrowedAmount(paidLoans ?? []),
      dueDate: String(loan.due_date),
      paidAt: String(loan.repaid_at ?? loan.updated_at ?? new Date().toISOString())
   });

   const userUpdates: Record<string, unknown> = {};
   if (evaluation.shouldPause && !borrower.credit_progression_paused) userUpdates.credit_progression_paused = true;
   // Recovery: a clean, on-time full repayment un-latches a previously paused borrower so future
   // repayments can level them up again. Without this, a single (or falsely-flagged) late payment
   // freezes credit progression permanently.
   if (!evaluation.isLate && evaluation.isFullyRepaid && borrower.credit_progression_paused) {
      userUpdates.credit_progression_paused = false;
   }
   if (evaluation.shouldLevelUp) userUpdates.cs = evaluation.nextLimit;

   if (Object.keys(userUpdates).length > 0) {
      const { error: userUpdateError } = await admin.from('users').update(userUpdates).eq('id', borrower.id);
      if (userUpdateError) errors.push({ type: 'credit_progression', message: userUpdateError.message });
   }
   return errors;
};

serve(async (req) => {
   if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
   if (req.method !== 'POST') return jsonResponse({ error: 'Method not allowed' }, 405);

   let body: { loanId?: string; hash?: string; method?: string; action?: string };
   try {
      body = await req.json();
   } catch {
      return jsonResponse({ error: 'Invalid JSON body' }, 400);
   }

   const { loanId, hash, method, action } = body;
   if (
      !loanId ||
      !hash ||
      (method !== 'wallet' && method !== 'base') ||
      (action !== 'fund' && action !== 'repay' && action !== 'return-interest')
   ) {
      return jsonResponse({ error: 'Missing or invalid loanId, hash, method, or action' }, 400);
   }

   const authHeader = req.headers.get('Authorization');
   if (!authHeader) return jsonResponse({ error: 'Missing Authorization header' }, 401);

   const supabaseUrl = Deno.env.get('SUPABASE_URL') ?? '';
   const anonKey = Deno.env.get('SUPABASE_ANON_KEY') ?? '';
   const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '';

   const callerClient = createClient(supabaseUrl, anonKey, { global: { headers: { Authorization: authHeader } } });
   const { data: userData, error: userError } = await callerClient.auth.getUser();
   if (userError || !userData?.user) {
      return jsonResponse({ error: 'Not authenticated' }, 401);
   }
   const callerId = userData.user.id;

   const admin = createClient(supabaseUrl, serviceRoleKey);

   const { data: loan, error: loanError } = await admin.from('loans').select('*').eq('id', loanId).single();
   if (loanError || !loan) {
      return jsonResponse({ error: 'Loan not found' }, 404);
   }

   // Every hash may only ever fund/repay ONE loan, ever — otherwise a single real payment could
   // be replayed across many loans to fake-fund/repay all of them.
   const { data: existingHash } = await admin.from('used_payment_hashes').select('hash').eq('hash', hash).maybeSingle();
   if (existingHash) {
      return jsonResponse({ error: 'This transaction has already been used to update a loan' }, 409);
   }

   let expectedRecipient: string | null;
   let requiredMicros: bigint;
   let stateFloorIso: string | null; // the payment's on-chain block must not predate this loan state

   if (action === 'fund') {
      if (loan.loan_status !== 'Requested' || loan.lender_user_id) {
         return jsonResponse({ error: 'This loan is no longer open for funding' }, 409);
      }
      if (loan.created_at && new Date(loan.created_at).getTime() + REQUEST_EXPIRATION_MS <= Date.now()) {
         return jsonResponse({ error: 'This loan request has expired. Ask the borrower to post a new request.' }, 409);
      }
      if (loan.borrower_user_id === callerId) {
         return jsonResponse({ error: 'You cannot fund your own loan request' }, 403);
      }
      expectedRecipient = loan.borrower_wallet;
      requiredMicros = BigInt(Math.round(Number(loan.loan_amount) * 1e6));
      stateFloorIso = loan.created_at ?? null;
   } else if (action === 'repay') {
      if (loan.borrower_user_id !== callerId) {
         return jsonResponse({ error: 'Only the borrower can repay this loan' }, 403);
      }
      if (loan.loan_status !== 'Lent' || loan.repayment_status === 'Paid') {
         return jsonResponse({ error: 'This loan is not awaiting repayment' }, 409);
      }
      expectedRecipient = loan.lender_wallet;
      const remaining = Number(loan.total_repayment_amount) - Number(loan.repaid_amount ?? 0);
      if (remaining <= 0) {
         return jsonResponse({ error: 'This loan has already been fully repaid' }, 409);
      }
      requiredMicros = 1n; // any positive on-chain transfer counts; the real amount drives repaid_amount below
      stateFloorIso = loan.funded_at ?? loan.created_at ?? null;
   } else {
      // return-interest: the LENDER refunds the interest (total_repayment - principal) to the borrower's
      // wallet. The client used to write interest_returned_at/interest_return_hash with no proof, so a
      // lender could mark it returned without paying. Now it must clear the same on-chain gate.
      if (loan.lender_user_id !== callerId) {
         return jsonResponse({ error: 'Only the lender can return interest on this loan' }, 403);
      }
      if (loan.repayment_status !== 'Paid') {
         return jsonResponse({ error: 'Interest can only be returned after the loan is fully repaid' }, 409);
      }
      if (loan.interest_returned_at) {
         return jsonResponse({ error: 'Interest has already been returned for this loan' }, 409);
      }
      const interest = Number(loan.total_repayment_amount) - Number(loan.loan_amount);
      if (interest <= 0.005) {
         return jsonResponse({ error: 'This loan has no interest to return' }, 409);
      }
      expectedRecipient = loan.borrower_wallet;
      requiredMicros = BigInt(Math.round(interest * 1e6));
      stateFloorIso = loan.repaid_at ?? loan.funded_at ?? null;
   }

   if (!expectedRecipient) {
      return jsonResponse({ error: 'Loan is missing a destination wallet' }, 409);
   }

   let transfer: VerifiedTransfer;
   try {
      transfer = await verifyPayment(method, hash);
   } catch (err) {
      if (err instanceof PaymentNotConfirmedError) {
         return jsonResponse({ error: err.message, retry: true }, 202);
      }
      return jsonResponse({ error: err instanceof Error ? err.message : 'Payment verification failed' }, 402);
   }

   if (transfer.to !== expectedRecipient.toLowerCase()) {
      return jsonResponse({ error: 'Payment was not sent to the expected wallet' }, 402);
   }
   if (transfer.micros < requiredMicros) {
      return jsonResponse({ error: 'Payment amount is less than required' }, 402);
   }

   // Freshness: a valid payment must post-date the loan state it confirms. This blocks replaying an
   // OLD, unrelated USDC transfer that merely landed on the (public) recipient wallet — used_payment_hashes
   // stops reusing a hash, but not the first use of a stale transfer. We deliberately do NOT bind the
   // sender to the caller's wallet: lenders/borrowers may pay from any wallet (the product's intentional
   // no-wallet-lock design). Best-effort + fail-open — only reject on a positively-fetched block timestamp
   // that clearly predates the floor, so an RPC hiccup can never false-reject a real payment.
   if (stateFloorIso) {
      const blockTsMs = await getBlockTimestampMs(transfer.blockNumber);
      const floorMs = new Date(stateFloorIso).getTime();
      const GRACE_MS = 10 * 60 * 1000; // clock-skew allowance between chain time and our DB timestamps
      if (blockTsMs !== null && Number.isFinite(floorMs) && blockTsMs < floorMs - GRACE_MS) {
         return jsonResponse({ error: 'This payment predates the loan and cannot be used to confirm it' }, 402);
      }
   }

   const { error: insertHashError } = await admin.from('used_payment_hashes').insert({ hash, loan_id: loanId });
   if (insertHashError) {
      // Unique violation ⇒ a concurrent request already claimed this hash.
      return jsonResponse({ error: 'This transaction has already been used to update a loan' }, 409);
   }

   const updates: Record<string, unknown> = {};

   // Record the real, explorer-verifiable tx hash in loans.hash (dedup still keys on the raw input
   // `hash` via used_payment_hashes above, so replay protection is unchanged). Before this, base-wallet
   // payments stored the userOperation hash here, which 404s on Basescan and made repayment disputes
   // impossible to self-verify.
   const recordHash = transfer.txHash ?? hash;

   if (action === 'fund') {
      updates.hash = [...(loan.hash ?? []), recordHash];
      updates.lender_user_id = callerId;
      updates.lender_wallet = transfer.from;
      updates.loan_status = 'Lent';
      updates.funded_at = new Date().toISOString();
   } else if (action === 'repay') {
      updates.hash = [...(loan.hash ?? []), recordHash];
      const paidUsd = Number(transfer.micros) / 1e6;
      const newRepaidAmount = Math.min(Number(loan.repaid_amount ?? 0) + paidUsd, Number(loan.total_repayment_amount));
      const isFullyRepaid = newRepaidAmount >= Number(loan.total_repayment_amount) - 0.005;
      updates.repaid_amount = newRepaidAmount;
      updates.repayment_status = isFullyRepaid ? 'Paid' : 'Partial';
      if (isFullyRepaid) {
         updates.repaid_at = new Date().toISOString();
      }
   } else {
      // return-interest: interest_return_hash is a single-hash column (not the payment-log array).
      updates.interest_returned_at = new Date().toISOString();
      updates.interest_return_hash = recordHash;
   }

   const { data: updatedLoan, error: updateError } = await admin.from('loans').update(updates).eq('id', loanId).select().single();
   if (updateError || !updatedLoan) {
      return jsonResponse({ error: updateError?.message || 'Failed to update loan' }, 500);
   }

   // --- side effects (points / credit / notifications). These mirror the old client thunk; a
   // failure here does NOT undo the verified payment write — surface it and let the caller/reconciler
   // decide, exactly as before. ---
   const sideEffectErrors: SideEffectError[] = [];

   if (action === 'fund') {
      sideEffectErrors.push(...(await awardFundingPoints(admin, updatedLoan)));
      const { error: notifyError } = await admin.functions.invoke('loan-funded-notification', { body: { loanId } });
      if (notifyError) sideEffectErrors.push({ type: 'loan_notification', message: notifyError.message });
   } else if (action === 'repay' && updatedLoan.repayment_status === 'Paid') {
      // Guarded on action, not just status: a return-interest call also leaves the loan 'Paid', and
      // must NOT re-run credit progression / re-fire the repayment notification.
      sideEffectErrors.push(...(await applyCreditProgression(admin, updatedLoan)));
      const { error: notifyError } = await admin.functions.invoke('loan-repayment-received-notification', { body: { loanId } });
      if (notifyError) sideEffectErrors.push({ type: 'loan_notification', message: notifyError.message });
   }

   return jsonResponse({ loan: updatedLoan, sideEffectErrors });
});
