import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

import { postDiscord } from '../_shared/discord.ts';
import {
   computeYearOneIouPointsDelta,
   evaluateCreditProgression,
   getEffectiveCreditLimit,
   getYearOneIouBorrowerBonusPoints,
   LOAN_FUNDING_POINTS_PER_USDC,
   toNumber
} from '../_shared/creditAndPoints.ts';
import { DEFAULT_TIMEZONE, loanTimezone, pastDueAt } from '../_shared/loanDeadline.ts';

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
// Response: { loan: <updated loans row>, sideEffectErrors: [...], creditLevelUp: { fromLimit, toLimit } | null }
//           | { error: string, retry?: bool }

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

// --- Repayment browser feed (Discord) --------------------------------------------------------
// Surface which browser a borrower repays from. Base Account (passkey + popup) can't complete
// inside social in-app browsers (Facebook / Instagram / Messenger / …), while the Openfort
// embedded wallet can — so an in-app browser is exactly the case worth flagging. Best-effort:
// the User-Agent comes from the borrower's own confirm-loan-payment request.
const describeBrowser = (ua: string | null): { label: string; isInApp: boolean } => {
   if (!ua) return { label: 'Unknown', isInApp: false };
   // In-app webviews first — these are the ones that break the Base wallet popup/passkey.
   if (/FBAN|FBAV|FB_IAB|FBIOS/i.test(ua)) return { label: 'Facebook in-app browser', isInApp: true };
   if (/Messenger/i.test(ua)) return { label: 'Messenger in-app browser', isInApp: true };
   if (/Instagram/i.test(ua)) return { label: 'Instagram in-app browser', isInApp: true };
   if (/\bLine\//i.test(ua)) return { label: 'LINE in-app browser', isInApp: true };
   if (/musical_ly|BytedanceWebview|TikTok/i.test(ua)) return { label: 'TikTok in-app browser', isInApp: true };
   if (/Twitter/i.test(ua)) return { label: 'Twitter/X in-app browser', isInApp: true };
   // Normal browsers (order matters: Samsung / Edge / Chrome UAs all also contain "Safari").
   if (/SamsungBrowser/i.test(ua)) return { label: 'Samsung Internet', isInApp: false };
   if (/Edg\//i.test(ua)) return { label: 'Edge', isInApp: false };
   if (/OPR\/|Opera/i.test(ua)) return { label: 'Opera', isInApp: false };
   if (/Firefox\//i.test(ua)) return { label: 'Firefox', isInApp: false };
   if (/CriOS|Chrome\//i.test(ua)) return { label: 'Chrome', isInApp: false };
   if (/Safari\//i.test(ua)) return { label: 'Safari', isInApp: false };
   return { label: 'Other', isInApp: false };
};

// Posts one repayment line to a Discord channel via DISCORD_REPAY_WEBHOOK_URL; no-ops when unset.
// Deliberately no fallback to the login webhook — #logins is login events only. Red embed for in-app browsers (the users who may
// get stuck on Base), green otherwise. Fire-and-forget — never affects the payment response.
const postRepayFeed = async (details: {
   username: string | null;
   email: string | null;
   repaidAmount: number;
   totalAmount: number;
   coin: string;
   trackingId: string | null;
   fullyRepaid: boolean;
   browser: { label: string; isInApp: boolean };
   userAgent: string | null;
}) => {
   const webhook = Deno.env.get('DISCORD_REPAY_WEBHOOK_URL');
   if (!webhook) return;

   const { username, email, repaidAmount, totalAmount, coin, trackingId, fullyRepaid, browser, userAgent } = details;
   const embed = {
      title: `💸 Repayment — ${username ?? 'unknown user'}`,
      color: browser.isInApp ? 0xe74c3c : 0x2ecc71,
      fields: [
         { name: 'User', value: `${username ?? '—'}\n${email ?? '—'}`, inline: true },
         {
            name: 'Amount',
            value: `$${repaidAmount.toFixed(2)} / $${totalAmount.toFixed(2)} ${coin}${fullyRepaid ? ' ✅ paid in full' : ' (partial)'}`,
            inline: true
         },
         { name: 'Browser', value: `${browser.isInApp ? '🚩 ' : ''}${browser.label}`, inline: true },
         { name: 'Loan', value: trackingId ?? '—', inline: false }
      ],
      footer: { text: (userAgent ?? 'no user-agent').slice(0, 180) },
      timestamp: new Date().toISOString()
   };

   try {
      await fetch(webhook, {
         method: 'POST',
         headers: { 'Content-Type': 'application/json' },
         body: JSON.stringify({ embeds: [embed] })
      });
   } catch {
      // Best-effort — the repay feed must never affect the payment response.
   }
};

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

const USER_OPERATION_EVENT_TOPIC = '0x49628fd1471006c1482da88028e9ce4dbb080b815c9b0344d39e5a8e6ec1419f';

// The smart-account payments (ERC-4337 userOperations) inside a transaction, by sender.
const decodeUserOpHashes = (logs: RawLog[] | undefined, sender: string): string[] =>
   (logs ?? [])
      .filter((log) => (log.topics ?? [])[0]?.toLowerCase() === USER_OPERATION_EVENT_TOPIC && (log.topics ?? []).length >= 3)
      .filter((log) => topicToAddress((log.topics as string[])[2]) === sender)
      .map((log) => (log.topics as string[])[1].toLowerCase());

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
   // Hashes this payment spends against replay. A Base Account payment spends only its userOp hash
   // (a bundler can put several people's payments in one transaction, so the bundle tx hash isn't
   // this payment's). A plain transaction spends its own hash plus any of the sender's userOps inside
   // it, so resubmitting a Base payment's bundle tx as a 'wallet' payment can't count it twice.
   spendHashes: string[];
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
         txHash: result.receipt?.transactionHash,
         spendHashes: [hash.toLowerCase()]
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
      txHash: receipt.transactionHash ?? hash,
      spendHashes: [...new Set([hash.toLowerCase(), ...decodeUserOpHashes(receipt.logs, transfers[0].from)])]
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
// fully-repaid full-limit loan, level up the borrower's credit limit. This is the ONLY writer of
// users.cs once the Phase 3 lock lands. (The limit the loan was measured against is recorded by
// public.record_loan_payment in the same update that marks it Paid.)
type CreditLevelUp = { fromLimit: number; toLimit: number };

const applyCreditProgression = async (
   admin: Admin,
   loan: Record<string, unknown>
): Promise<{ errors: SideEffectError[]; levelUp: CreditLevelUp | null }> => {
   const errors: SideEffectError[] = [];
   const borrowerId = loan.borrower_user_id as string | null;
   if (!borrowerId || !loan.due_date) return { errors, levelUp: null };

   const { data: borrower, error: borrowerError } = await admin
      .from('users')
      .select('id, cs, is_world_id, is_didit')
      .eq('id', borrowerId)
      .single();
   if (borrowerError || !borrower) {
      errors.push({ type: 'credit_progression', message: borrowerError?.message ?? 'Borrower not found' });
      return { errors, levelUp: null };
   }

   const evaluation = evaluateCreditProgression({
      currentLimit: borrower.cs ?? 0,
      // Any supported identity method grants verified status for credit progression, mirroring the
      // frontend isUserVerified(). Didit is the majority path; gating on World ID alone stalled
      // Didit-verified borrowers' credit-limit growth (this is the authoritative writer).
      isVerified: borrower.is_world_id === 'ACTIVE' || borrower.is_didit === 'ACTIVE',
      repaidAmount: toNumber(loan.repaid_amount as number | string | null),
      totalRepaymentAmount: toNumber(loan.total_repayment_amount as number | string | null),
      loanAmount: toNumber(loan.loan_amount as number | string | null),
      dueDate: String(loan.due_date),
      paidAt: String(loan.repaid_at ?? loan.updated_at ?? new Date().toISOString())
   });

   if (!evaluation.shouldLevelUp) return { errors, levelUp: null };

   // Compare-and-set on the limit we evaluated against: if two final repayments race, only the
   // first raises the limit, so one full-limit loan can never level a borrower up twice.
   const levelUp = admin.from('users').update({ cs: evaluation.nextLimit }).eq('id', borrower.id);
   const { data: leveled, error: userUpdateError } = await (borrower.cs === null ? levelUp.is('cs', null) : levelUp.eq('cs', borrower.cs)).select('id');
   if (userUpdateError) {
      errors.push({ type: 'credit_progression', message: userUpdateError.message });
      return { errors, levelUp: null };
   }
   if (!leveled?.length) {
      // The limit changed between reading and writing (a referral, an admin edit, a race). The borrower
      // earned this level-up, so don't lose it silently: tell the team to look.
      const { data: nowRow } = await admin.from('users').select('cs').eq('id', borrower.id).maybeSingle();
      const message = `level-up skipped: the limit changed from $${borrower.cs ?? '?'} to $${nowRow?.cs ?? '?'} during this repayment`;
      errors.push({ type: 'credit_progression', message });
      await postDiscord(
         { content: `⚠️ ${loan.tracking_id}: a full-limit loan was repaid in full but the borrower was NOT levelled up (${message}). Check their limit.` },
         { prefer: ['DISCORD_REPAY_WEBHOOK_URL'] }
      );
      return { errors, levelUp: null };
   }
   return { errors, levelUp: { fromLimit: getEffectiveCreditLimit(borrower.cs, true), toLimit: evaluation.nextLimit } };
};

// True when `wallet` is one the borrower is known to use: their profile wallet, or a wallet one of
// their loans was paid out to. There is no record of past repayment senders to check against.
const isKnownBorrowerWallet = async (admin: Admin, borrowerId: string | null, wallet: string): Promise<boolean> => {
   if (!borrowerId) return false;
   const target = wallet.toLowerCase();
   const { data: user } = await admin.from('users').select('wallet_address').eq('id', borrowerId).maybeSingle();
   if ((user?.wallet_address ?? '').toLowerCase() === target) return true;
   const { data: loans } = await admin.from('loans').select('borrower_wallet').eq('borrower_user_id', borrowerId);
   return ((loans ?? []) as { borrower_wallet: string | null }[]).some((row) => (row.borrower_wallet ?? '').toLowerCase() === target);
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
   // One spelling per hash: Base reads a hash in any letter case, so the replay check compares lowercase.
   if (typeof hash !== 'string' || !/^0x[0-9a-fA-F]{64}$/.test(hash)) {
      return jsonResponse({ error: 'Invalid transaction hash' }, 400);
   }
   const normalizedHash = hash.toLowerCase();

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

   // Every hash may only ever fund/repay ONE loan, ever — otherwise a single real payment could
   // be replayed across many loans to fake-fund/repay all of them.
   const { data: existingHash } = await admin.from('used_payment_hashes').select('hash').eq('hash', normalizedHash).maybeSingle();
   if (existingHash) {
      return jsonResponse({ error: 'This transaction has already been used to update a loan' }, 409);
   }

   const { data: loan, error: loanError } = await admin.from('loans').select('*').eq('id', loanId).maybeSingle();
   if (loanError) {
      return jsonResponse({ error: 'Failed to load loan' }, 500);
   }
   if (!loan) {
      // The request was deleted (or never existed) but a lender may already have sent the USDC: if the
      // payment verifies, tell the team so it can be refunded. Nothing is recorded.
      if (action === 'fund') {
         try {
            const orphan = await verifyPayment(method, hash);
            await postDiscord(
               {
                  content: `⚠️ Loan ${loanId} no longer exists, but a verified ${(Number(orphan.micros) / 1e6).toFixed(2)} USDC funding payment (${(orphan.txHash ?? hash).toLowerCase()}, from ${orphan.from} to ${orphan.to}, lender user ${callerId}) was sent for it. It was NOT recorded and needs refunding.`
               },
               { prefer: ['DISCORD_REPAY_WEBHOOK_URL'] }
            );
            return jsonResponse({ error: 'This request no longer exists. Contact support for a refund.' }, 409);
         } catch (err) {
            if (err instanceof PaymentNotConfirmedError) return jsonResponse({ error: err.message, retry: true }, 202);
         }
      }
      return jsonResponse({ error: 'Loan not found' }, 404);
   }

   let expectedRecipient: string | null;
   let requiredMicros: bigint;
   // The loan can't take this payment any more (funded by someone else, expired, already repaid), but
   // the USDC may already have moved: verify it anyway and tell the team, so it can be refunded.
   let closedReason: string | null = null;
   let stateFloorIso: string | null; // the payment's on-chain block must not predate this loan state

   if (action === 'fund') {
      if (loan.loan_status !== 'Requested' || loan.lender_user_id) {
         closedReason = 'it was already funded';
      } else if (loan.created_at && new Date(loan.created_at).getTime() + REQUEST_EXPIRATION_MS <= Date.now()) {
         closedReason = 'the request had expired';
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
      if (loan.loan_status !== 'Lent') {
         return jsonResponse({ error: 'This loan is not awaiting repayment' }, 409);
      }
      expectedRecipient = loan.lender_wallet;
      const remaining = Number(loan.total_repayment_amount) - Number(loan.repaid_amount ?? 0);
      if (loan.repayment_status === 'Paid' || remaining <= 0) {
         closedReason = 'the loan was already fully repaid';
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

   const recordHash = (transfer.txHash ?? hash).toLowerCase();
   const alertUnrecorded = async (what: string) => {
      console.error(`confirm-loan-payment: ${loan.tracking_id} unrecorded payment ${recordHash} from ${transfer.from}: ${what}`);
      await postDiscord(
         {
            content: `⚠️ ${loan.tracking_id}: a verified ${(Number(transfer.micros) / 1e6).toFixed(2)} USDC payment (${recordHash}, from ${transfer.from}) was NOT recorded because ${what}. It needs refunding.`
         },
         { prefer: ['DISCORD_REPAY_WEBHOOK_URL'] }
      );
   };

   if (closedReason) {
      // Spend this payment's hashes first: if any is already spent it's a resubmission of a payment
      // that WAS recorded (e.g. a Base payment resubmitted by its bundle tx), so there's nothing to
      // refund; and spending them means a retry of a genuinely late payment alerts only once.
      const { error: spendError } = await admin
         .from('used_payment_hashes')
         .insert([...new Set([normalizedHash, ...transfer.spendHashes])].map((spent) => ({ hash: spent, loan_id: loanId })));
      if (spendError) {
         return jsonResponse({ error: 'This transaction has already been used to update a loan' }, 409);
      }
      await alertUnrecorded(closedReason);
      return jsonResponse({ error: `This payment couldn't be applied because ${closedReason}. Contact support for a refund.` }, 409);
   }

   // Record it in one locked database transaction (public.record_loan_payment): it re-checks the loan
   // is still open for this action, spends this payment's hashes (see VerifiedTransfer.spendHashes)
   // and updates the loan. Two payments at once queue instead of overwriting each other, two lenders
   // can't both fund, and a failed update leaves the hashes unspent so the payment can be retried.
   const { data: recorded, error: recordError } = await admin.rpc('record_loan_payment', {
      p_loan_id: loanId,
      p_action: action,
      p_caller: callerId,
      p_spend_hashes: [...new Set([normalizedHash, ...transfer.spendHashes])],
      p_record_hash: recordHash,
      p_amount_micros: Number(transfer.micros),
      p_from: transfer.from
   });
   if (recordError) {
      return jsonResponse({ error: recordError.message || 'Failed to update loan' }, 500);
   }
   const recordedError = (recorded as { error?: string } | null)?.error;
   if (recordedError) {
      if (recordedError === 'hash_used') {
         return jsonResponse({ error: 'This transaction has already been used to update a loan' }, 409);
      }
      const { error: spendLateError } = await admin
         .from('used_payment_hashes')
         .insert([...new Set([normalizedHash, ...transfer.spendHashes])].map((spent) => ({ hash: spent, loan_id: loanId })));
      if (spendLateError) {
         return jsonResponse({ error: 'This transaction has already been used to update a loan' }, 409);
      }
      const why =
         recordedError === 'not_open'
            ? 'someone else funded it a moment earlier'
            : recordedError === 'not_awaiting_repayment'
              ? 'the loan was already fully repaid'
              : `the loan couldn't take it (${recordedError})`;
      await alertUnrecorded(why);
      return jsonResponse({ error: `This payment couldn't be applied because ${why}. Contact support for a refund.` }, 409);
   }
   // A repayment from a wallet we don't know for this borrower is still recorded (borrowers often pay
   // from an exchange), but the team should check it really came from them.
   const senderIsKnown = action === 'repay' ? await isKnownBorrowerWallet(admin, loan.borrower_user_id, transfer.from) : true;
   if (!senderIsKnown) {
      await postDiscord(
         {
            content: `⚠️ ${loan.tracking_id}: repayment from unknown sender — check. ${(Number(transfer.micros) / 1e6).toFixed(2)} USDC (${recordHash}) came from ${transfer.from}, which isn't a wallet on file for this borrower. It was recorded.`
         },
         { prefer: ['DISCORD_REPAY_WEBHOOK_URL'] }
      );
   }
   // Paid more than was owed: the loan is closed at its total; the extra goes back to the borrower.
   const overpaidMicros = Number((recorded as { overpaid_micros?: number } | null)?.overpaid_micros ?? 0);
   if (overpaidMicros > 5000) {
      // Only name the sender as the refund address when it's one of the borrower's own wallets: an
      // exchange hot wallet (or someone else's) is not where the borrower's money should go back to.
      const refundTo = senderIsKnown
         ? `the extra needs sending back to ${transfer.from}`
         : `it came from an unknown sender (${transfer.from}), so confirm the borrower's own wallet before refunding the extra`;
      await postDiscord(
         {
            content: `⚠️ ${loan.tracking_id}: the borrower paid ${(overpaidMicros / 1e6).toFixed(2)} USDC more than was left (${recordHash}). The loan is closed; ${refundTo}.`
         },
         { prefer: ['DISCORD_REPAY_WEBHOOK_URL'] }
      );
   }
   const updatedLoan = (recorded as { loan?: Record<string, unknown> } | null)?.loan;
   if (!updatedLoan) {
      return jsonResponse({ error: 'Failed to update loan' }, 500);
   }

   // --- side effects (points / credit / notifications). These mirror the old client thunk; a
   // failure here does NOT undo the verified payment write — surface it and let the caller/reconciler
   // decide, exactly as before. ---
   const sideEffectErrors: SideEffectError[] = [];
   let creditLevelUp: CreditLevelUp | null = null;

   if (action === 'fund') {
      if (loan.on_hold_since) {
         console.warn(`confirm-loan-payment: ${loan.tracking_id} was funded while on hold (${loan.on_hold_reason ?? 'unknown'})`);
         await postDiscord(
            { content: `⚠️ ${loan.tracking_id} was funded while on hold (${loan.on_hold_reason === 'no_show' ? 'borrower missed their call' : loan.on_hold_reason ?? 'unknown'}). The payment is recorded; check in with the borrower.` },
            { prefer: ['DISCORD_REPAY_WEBHOOK_URL'] }
         );
      }
      // The app won't fund a request whose due day is over, but the USDC has already reached the
      // borrower by now, so record it and ask the team to extend it rather than strand the payment.
      if (loan.due_date && Date.now() >= pastDueAt(loan.due_date, loanTimezone(loan, DEFAULT_TIMEZONE)).getTime()) {
         console.warn(`confirm-loan-payment: ${loan.tracking_id} was funded after its due day (${loan.due_date})`);
         await postDiscord(
            { content: `⚠️ ${loan.tracking_id} was funded after its due day (${String(loan.due_date).slice(0, 10)}), so it starts overdue. The payment is recorded; extend the due date in admin.` },
            { prefer: ['DISCORD_REPAY_WEBHOOK_URL'] }
         );
      }
      sideEffectErrors.push(...(await awardFundingPoints(admin, updatedLoan)));
      const { error: notifyError } = await admin.functions.invoke('loan-funded-notification', { body: { loanId } });
      if (notifyError) sideEffectErrors.push({ type: 'loan_notification', message: notifyError.message });
   } else if (action === 'repay' && updatedLoan.repayment_status === 'Paid') {
      // Guarded on action, not just status: a return-interest call also leaves the loan 'Paid', and
      // must NOT re-run credit progression / re-fire the repayment notification.
      const progression = await applyCreditProgression(admin, updatedLoan);
      sideEffectErrors.push(...progression.errors);
      creditLevelUp = progression.levelUp;
      const { error: notifyError } = await admin.functions.invoke('loan-repayment-received-notification', { body: { loanId } });
      if (notifyError) sideEffectErrors.push({ type: 'loan_notification', message: notifyError.message });
   }

   // Repay browser feed → Discord. Fires on every repayment (partial or full), flags in-app
   // browsers (Facebook/etc.) where the Base wallet can't complete. Best-effort and awaited only
   // so the fetch starts; failures are swallowed inside postRepayFeed and never block the response.
   if (action === 'repay') {
      const { data: borrowerRow } = await admin
         .from('users')
         .select('username, email')
         .eq('id', updatedLoan.borrower_user_id)
         .maybeSingle();
      await postRepayFeed({
         username: borrowerRow?.username ?? null,
         email: borrowerRow?.email ?? null,
         repaidAmount: toNumber(updatedLoan.repaid_amount as number | string | null),
         totalAmount: toNumber(updatedLoan.total_repayment_amount as number | string | null),
         coin: (updatedLoan.coin as string | null)?.trim() || 'USDC',
         trackingId: (updatedLoan.tracking_id as string | null) ?? null,
         fullyRepaid: updatedLoan.repayment_status === 'Paid',
         browser: describeBrowser(req.headers.get('user-agent')),
         userAgent: req.headers.get('user-agent')
      });
   }

   return jsonResponse({ loan: updatedLoan, sideEffectErrors, creditLevelUp });
});
